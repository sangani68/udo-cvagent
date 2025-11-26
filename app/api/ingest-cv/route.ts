// app/api/ingest-cv/route.ts
// Proxies ANY upload to /api/convert-to-cvjson and wraps response as { ok: true, cv }

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const target = new URL("/api/convert-to-cvjson", req.url);
    const headers = new Headers(req.headers);
    headers.delete("content-length");
    headers.delete("host");
    headers.delete("connection");

    const proxied = await fetch(target.toString(), {
      method: "POST",
      headers,
      body: req.body,
      // @ts-expect-error required for streaming request bodies
      duplex: "half",
    });

    const data = await safeJson(proxied);
    if (!proxied.ok) {
      const msg = data?.error || `HTTP ${proxied.status}`;
      return NextResponse.json({ ok: false, error: msg }, { status: proxied.status });
    }

    const cv = data?.cv ?? null;
    if (!cv) return NextResponse.json({ ok: false, error: "No CV returned from convert-to-cvjson" }, { status: 502 });

    return NextResponse.json({ ok: true, cv });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}

async function safeJson(res: Response) { try { return await res.json(); } catch { return {}; } }
