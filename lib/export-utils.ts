import { BlobServiceClient } from "@azure/storage-blob";
import { yyyymmdd } from "./cv/naming";

export function nowStampUTC() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

export function safeStem(name = "Candidate") {
  return String(name).trim().replace(/[^\p{L}\p{N}_ -]+/gu, "").replace(/\s+/g, "_");
}

export function buildExportFilename(templateName: string, candidateName: string, ext: string) {
  const tpl = safeStem(templateName || "Template");
  const cand = safeStem(candidateName || "Candidate");
  const date = yyyymmdd();
  return `${tpl}_${cand}_${date}.${ext}`;
}

export async function uploadBytesToAdls(container: string, blobName: string, bytes: Uint8Array | Buffer, contentType: string) {
  const cs = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!cs) throw new Error("AZURE_STORAGE_CONNECTION_STRING missing");
  const svc = BlobServiceClient.fromConnectionString(cs);
  const c = svc.getContainerClient(container);
  await c.createIfNotExists();
  const blob = c.getBlockBlobClient(blobName);
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  await blob.uploadData(buf, { blobHTTPHeaders: { blobContentType: contentType } });
  const account = /AccountName=([^;]+)/.exec(cs)?.[1] || "";
  const url = `https://${account}.blob.core.windows.net/${container}/${encodeURIComponent(blobName)}`;
  return { url };
}
