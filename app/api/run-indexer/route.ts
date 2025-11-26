import { NextResponse } from "next/server";
import { runIndexer, indexName } from "@/lib/search";
export const runtime = "nodejs";

export async function POST() {
  try {
    const kicked = await runIndexer();
    const endpoint = process.env.AZURE_SEARCH_ENDPOINT!;
    const key = process.env.AZURE_SEARCH_KEY!;
    const name = `${indexName}-blob-indexer`;
    const statusRes = await fetch(`${endpoint}/indexers/${name}/status?api-version=2024-07-01`, { headers: { "api-key": key } });
    const text = await statusRes.text();
    let json: any = null; try { json = JSON.parse(text); } catch {}
    return NextResponse.json({ ok: true, kicked, statusHttp: statusRes.status, status: json ?? { raw: text } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
