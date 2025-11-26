// lib/cv-extract.ts
import { BlobServiceClient } from "@azure/storage-blob";
import type { Readable } from "node:stream";
import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * Detect mime by magic numbers / filename.
 */
function sniffMime(bytes: Uint8Array, filename?: string) {
  const header = Buffer.from(bytes.slice(0, 8));
  const name = (filename || "").toLowerCase();

  if (header.slice(0, 4).toString() === "%PDF") return "application/pdf";
  // ZIP header (OOXML: docx/pptx/xlsx are zip containers)
  if (header[0] === 0x50 && header[1] === 0x4b) {
    if (name.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (name.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    return "application/zip";
  }
  if (name.endsWith(".txt") || name.endsWith(".md")) return "text/plain";
  return "application/octet-stream";
}

/**
 * Safe text-ness check.
 */
function isLikelyText(s: unknown): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

/**
 * Extract text from DOCX/PPTX by unzipping and reading the main XML parts.
 * Uses a light dependency at runtime via dynamic import.
 */
async function unzip(bytes: Uint8Array) {
  // jszip is small and pure JS; import at runtime to keep build lean
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(bytes);
  return zip;
}

function simpleXmlText(xml: string, tag: string) {
  // find <tag> ... </tag> with minimal nesting assumptions
  const rx = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(xml))) {
    out.push(m[1]);
  }
  return out.join("\n");
}

/**
 * Extract visible text from DOCX.
 * - read word/document.xml
 * - collect all <w:t>...</w:t>
 */
async function extractDocx(zip: any): Promise<string> {
  const file = zip.file("word/document.xml");
  if (!file) return "";
 const xml = await file.async("string");
const textNodes = Array.from(xml.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g)).map(
  (m) =>
    ((m as RegExpMatchArray)[1] || "")
      .replace(/<!\[CDATA\[|\]\]>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
);
  return textNodes.join("\n");
}

/**
 * Extract visible text from PPTX.
 * - read ppt/slides/slide*.xml
 * - collect all <a:t>...</a:t>
 */
async function extractPptx(zip: any): Promise<string> {
  const files = zip.file(/^ppt\/slides\/slide\d+\.xml$/);
  if (!files?.length) return "";
  const chunks: string[] = [];
  for (const f of files) {
    const xml = await f.async("string");
const texts = Array.from(xml.matchAll(/<a:t[^>]*>(.*?)<\/a:t>/g)).map((m) =>
  ((m as RegExpMatchArray)[1] || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
);
    if (texts.length) {
      chunks.push(texts.join("\n"));
    }
  }
  return chunks.join("\n\n");
}

/**
 * Extract plain text from bytes. Supports:
 * - .docx / .pptx via jszip
 * - .txt (as-is)
 * - .pdf: try pdf-parse if available; otherwise return ""
 */
export async function extractTextFromBytes(bytes: Uint8Array, filename?: string): Promise<string> {
  const mime = sniffMime(bytes, filename);

  // Handle plain text early
  if (mime === "text/plain") {
    return Buffer.from(bytes).toString("utf8");
  }

  // PDF (best-effort)
  if (mime === "application/pdf") {
    try {
      const pdfParse = (await import("pdf-parse")).default as any;
      const out = await pdfParse(bytes);
      return isLikelyText(out?.text) ? out.text : "";
    } catch {
      // pdf-parse not installed or failed
      return "";
    }
  }

  // OOXML: DOCX / PPTX
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mime === "application/zip"
  ) {
    try {
      const zip = await unzip(bytes);
      if (mime.includes("wordprocessingml") || zip.file("word/document.xml")) {
        return await extractDocx(zip);
      }
      // fall back to pptx
      return await extractPptx(zip);
    } catch {
      return "";
    }
  }

  return "";
}

/**
 * Try multiple ways to get bytes from a "hit" or descriptor.
 * Accepts:
 *  - { content } -> return as text
 *  - { fields: { content } }
 *  - { url } (ADLS blob url without SAS) -> uses storage SDK
 *  - { path } local absolute path -> fs.readFile
 *  - raw string -> interpreted as text
 */
export async function getTextFromAny(input: any): Promise<{ text: string; note?: string }> {
  if (!input) return { text: "" };

  // raw string (already text)
  if (typeof input === "string" && input.trim().length > 0) {
    return { text: input };
  }

  // common Azure Cognitive Search hit shapes
  const text =
    input?.content ??
    input?.fields?.content ??
    input?.document?.content ??
    input?.highlights?.content?.join?.(" ");

  if (isLikelyText(text)) {
    return { text };
  }

  // Local path
  if (typeof input?.path === "string" && input.path.startsWith("/")) {
    try {
      const bytes = new Uint8Array(await fs.readFile(input.path));
      const extracted = await extractTextFromBytes(bytes, path.basename(input.path));
      return { text: extracted, note: "extracted-from-local-path" };
    } catch {
      // ignore
    }
  }

  // ADLS blob path (url or name fields)
  const container = process.env.AZURE_STORAGE_CONTAINER;
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.AZURE_STORAGE_CONN_STRING;

  const url =
    input?.url ||
    input?.fields?.url ||
    input?.metadata_storage_path ||
    input?.fields?.metadata_storage_path ||
    input?.blobUrl; // tolerate custom field

  // If we have a blob name under our container (not a full SAS), try downloading via SDK
  const nameGuess =
    input?.name ||
    input?.fields?.name ||
    (typeof url === "string" && url.includes(`/${container}/`) ? decodeURIComponent(url.split(`/${container}/`)[1] || "") : "");

  if (conn && container && nameGuess) {
    try {
      const blob = BlobServiceClient.fromConnectionString(conn)
        .getContainerClient(container)
        .getBlobClient(nameGuess);
      const resp = await blob.download();
      const buf = await streamToBuffer(resp.readableStreamBody as Readable);
      const extracted = await extractTextFromBytes(buf, nameGuess);
      return { text: extracted, note: "extracted-from-adls" };
    } catch {
      // ignore
    }
  }

  return { text: "" };
}

async function streamToBuffer(readable: Readable): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    readable.on("data", (d) => chunks.push(Buffer.from(d)));
    readable.on("end", () => resolve(Buffer.concat(chunks)));
    readable.on("error", reject);
  });
}

/**
 * Last-gasp cleanup for messy XML-y strings from poor extractors.
 * If you see schema urls / control characters, we try to salvage visible text.
 */
export function scrubWeirdExtraction(s: string): string {
  if (!isLikelyText(s)) return "";
  // If it looks like XML dump, try to prefer <a:t> and <w:t> content
  if (s.includes("<a:t") || s.includes("<w:t")) {
    const a = Array.from(s.matchAll(/<a:t[^>]*>(.*?)<\/a:t>/g)).map(m => m[1]);
    const w = Array.from(s.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g)).map(m => m[1]);
    const merged = [...a, ...w].join("\n");
    if (merged.trim()) return merged;
  }
  // Otherwise strip schema URIs and non-printables
  return s
    .replace(/https?:\/\/schemas\.[^\s]+/g, " ")
    .replace(/[{}[\]|\\^~_`]+/g, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
