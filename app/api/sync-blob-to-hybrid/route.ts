// app/api/sync-blob-to-hybrid/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(_: NextRequest) {
  try {
    const service = process.env.AZURE_SEARCH_SERVICE!;
    const key = process.env.AZURE_SEARCH_API_KEY!;
    const apiVersion = process.env.AZURE_SEARCH_API_VERSION || "2024-07-01";
    const indexer = process.env.AZURE_SEARCH_BLOB_INDEXER || "cvkb-blob-indexer";

    const res = await fetch(`https://${service}.search.windows.net/indexers/${indexer}/run?api-version=${apiVersion}`, {
      method: "POST",
      headers: { "api-key": key },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Run indexer ${res.status}: ${text}` }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ran: indexer });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 400 });
  }
}
