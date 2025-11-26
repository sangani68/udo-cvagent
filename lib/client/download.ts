// lib/client/download.ts
export function sanitizeFilename(s: string) {
  return (s || "file")
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function parseContentDispositionFilename(h: string | null): string | null {
  if (!h) return null;
  // filename* (RFC 5987)
  const star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(h);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      // fall through
    }
  }
  // filename="<...>" or filename=...
  const quoted = /filename\s*=\s*"([^"]+)"/i.exec(h);
  if (quoted?.[1]) return quoted[1];
  const bare = /filename\s*=\s*([^;]+)/i.exec(h);
  if (bare?.[1]) return bare[1].trim();
  return null;
}

export async function downloadResponse(res: Response, fallbackBaseName = "file") {
  const blob = await res.blob();

  // prefer server-provided filename, but keep it safe
  const cd = res.headers.get("Content-Disposition");
  const serverName = parseContentDispositionFilename(cd);
  const base = sanitizeFilename(serverName || fallbackBaseName);
  const ctype = res.headers.get("Content-Type") || "application/octet-stream";

  // Pick extension if missing
  const ext =
    ctype.includes("pdf") ? ".pdf" :
    ctype.includes("presentation") ? ".pptx" :
    ctype.includes("wordprocessingml") ? ".docx" :
    "";

  const filename = base.endsWith(ext) || !ext ? base : base + ext;

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", filename); // safe ascii string
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
