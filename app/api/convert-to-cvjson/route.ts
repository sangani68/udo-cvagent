// app/api/convert-to-cvjson/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { extractTextFromBytes } from "@/lib/cv-extract";
import { textToCvJson } from "@/lib/llm-cv";
import { migrateCvShape, type CVJson } from "@/lib/cvSchema";

/* ── Accept self-signed TLS if you set ALLOW_INSECURE_TLS/ALLOW_SELF_SIGNED ── */
if (process.env.ALLOW_INSECURE_TLS || process.env.ALLOW_SELF_SIGNED) {
  // Undici (Next/Node fetch) honors this env flag
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

/* ── Helpers ── */
const bad = (msg: string, status = 400) =>
  NextResponse.json({ ok: false, error: String(msg) }, { status });

type UseThisPayload = {
  item?: any;
  url?: string;        // http(s) or app-relative (/public)
  id?: string;
  content?: string;    // plain text
  mime?: string;
  filename?: string;
};

function aoai() {
  const endpoint = (process.env.AZURE_OPENAI_ENDPOINT || "").trim();
  const apiKey =
    (process.env.AZURE_OPENAI_API_KEY || process.env.AZURE_OPENAI_KEY || "").trim();
  const deployment =
    (process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT || "").trim();
  const apiVersion = (process.env.AZURE_OPENAI_CHAT_API_VERSION || "2024-10-01-preview").trim();
  const miss: string[] = [];
  if (!endpoint)   miss.push("AZURE_OPENAI_ENDPOINT");
  if (!apiKey)     miss.push("AZURE_OPENAI_API_KEY");
  if (!deployment) miss.push("AZURE_OPENAI_CHAT_DEPLOYMENT");
  return { ok: miss.length === 0, miss, opts: { endpoint, apiKey, deployment, apiVersion } };
}

async function deepExtractLLM(text: string): Promise<CVJson> {
  const cfg = aoai();
  if (!cfg.ok) throw new Error(`Azure OpenAI not configured: ${cfg.miss.join(", ")}`);
  const raw = await textToCvJson(text, cfg.opts);
  return migrateCvShape(raw);
}

async function readBytes(urlOrPath: string, origin: string): Promise<Uint8Array> {
  // Support: absolute http(s) OR app-relative (served from /public)
  const isHttp = /^https?:\/\//i.test(urlOrPath);
  const u = isHttp ? urlOrPath : new URL(urlOrPath, origin).toString();
  const r = await fetch(u);
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${u}`);
  const ab = await r.arrayBuffer();
  return new Uint8Array(ab);
}

async function toTextFromBytes(name: string, bytes: Uint8Array) {
  if (/\.(txt|md)$/i.test(name)) return new TextDecoder().decode(bytes);
  const text = await extractTextFromBytes(Buffer.from(bytes), name);
  if (!text?.trim()) {
    const ext = (name.split(".").pop() || "").toLowerCase();
    const hint =
      ext === "pdf"
        ? "The PDF may be scanned or image-only. Try a text-based PDF or DOCX."
        : ext === "doc"
        ? "The .doc file may be protected or image-only. Try saving as .docx."
        : "Try a text-based PDF or DOCX.";
    throw new Error(`Extractor returned empty text. ${hint}`);
  }
  return text;
}

/* ── Handler ── */
export async function POST(req: NextRequest) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    const origin = `${req.nextUrl.protocol}//${req.nextUrl.host}`;

    // 0) Binary upload path (PDF/DOCX/etc from UI)
    if (!ct.includes("application/json")) {
      const bytes = new Uint8Array(await req.arrayBuffer());
      if (bytes?.length) {
        const name = req.headers.get("x-filename") || "upload";
        const text = await toTextFromBytes(name, bytes);
        const cv = await deepExtractLLM(text);
        (cv.meta = cv.meta || {}).source = name;
        return NextResponse.json({ ok: true, cv });
      }
    }

    const body = (await req.json().catch(() => ({}))) as UseThisPayload;

    // 1) Inline content
    if (typeof body.content === "string" && body.content.trim()) {
      const cv = await deepExtractLLM(body.content);
      if (body.filename) (cv.meta = cv.meta || {}).source = body.filename;
      return NextResponse.json({ ok: true, cv });
    }

    // 2) URL from payload or search item
    const url =
      body.url ||
      body.item?.url ||
      body.item?.metadata_storage_path ||          // Azure Search canonical
      body.item?.metadata_storage_name;            // sometimes a path-ish string

    if (typeof url === "string" && url.trim()) {
      const bytes = await readBytes(url, origin);
      const name = body.filename || url.split("/").pop() || "attachment";
      const text = await toTextFromBytes(name, bytes);
      const cv = await deepExtractLLM(text);
      (cv.meta = cv.meta || {}).source = body.filename || url;
      return NextResponse.json({ ok: true, cv });
    }

    // 3) Indexed full text (best when present)
    if (typeof body.item?.content === "string" && body.item.content.trim()) {
      const cv = await deepExtractLLM(body.item.content);
      if (body.filename) (cv.meta = cv.meta || {}).source = body.filename;
      return NextResponse.json({ ok: true, cv });
    }

    return bad(
      "No extractable text. Provide { content }, or a URL (http/https) or app-relative path (file in /public). If using search, include 'metadata_storage_path' or 'content'."
    );
  } catch (e: any) {
    console.error("[convert-to-cvjson] ERROR:", e?.message || e);
    return bad(e?.message || String(e), 400); // always JSON → no “fetch failed”
  }
}
