// lib/server/sendFile.ts
import { NextResponse } from "next/server";

export function sanitizeFilename(s: string) {
  // Restrict to a safe subset for headers & blob paths
  return (s || "file")
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

// RFC 5987 percent-encoding for filename*
function encodeRFC5987(value: string) {
  return encodeURIComponent(value)
    .replace(/['()]/g, escape)
    .replace(/\*/g, "%2A")
    .replace(/%(7C|60|5E)/g, (m) => m.toLowerCase());
}

export function buildDownloadHeaders(mime: string, filename: string) {
  const safe = sanitizeFilename(filename);
  const headers = new Headers();
  headers.set("Content-Type", mime);
  // ASCII "filename" for older clients + RFC5987 "filename*" for UTF-8
  headers.set(
    "Content-Disposition",
    `attachment; filename="${safe}"; filename*=UTF-8''${encodeRFC5987(safe)}`
  );
  return headers;
}

export function sendFile(
  bytes: Uint8Array,
  mime: string,
  filename: string,
  extraHeaders?: Record<string, string>
) {
  const headers = buildDownloadHeaders(mime, filename);
  for (const [k, v] of Object.entries(extraHeaders || {})) headers.set(k, v);
  return new NextResponse(bytes as any, { status: 200, headers });
}

export function yyyymmdd(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}
