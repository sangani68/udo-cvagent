// app/api/search/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { hybridSearch } from "../../../lib/search";
import { searchBlobIndex } from "../../../lib/azureSearch";

export async function POST(req: NextRequest) {
  try {
    const { q = "", top = 20, language } = await req.json().catch(() => ({}));
    const query = String(q || "");
    const out = await hybridSearch(query, { top: Number(top) || 20, language });
    if (out.results.length) {
      return NextResponse.json({ ok: true, results: out.results });
    }

    const blob = await searchBlobIndex(query, Number(top) || 20);
    const rows = (blob?.value || []).map((d: any) => ({
      id: d?.id,
      name: d?.metadata_storage_name,
      url: d?.metadata_storage_path,
      updatedAt: d?.metadata_storage_last_modified,
      content: d?.content,
    }));
    return NextResponse.json({ ok: true, results: rows });
  } catch (err: any) {
    const msg = err?.message || "Search failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const top = Number(searchParams.get("top") || 20);
  const language = (searchParams.get("language") as "en"|"fr"|"de"|"nl" | null) || undefined;

  try {
    const out = await hybridSearch(q, { top, language });
    if (out.results.length) {
      return NextResponse.json({ ok: true, results: out.results });
    }
    const blob = await searchBlobIndex(q, top);
    const rows = (blob?.value || []).map((d: any) => ({
      id: d?.id,
      name: d?.metadata_storage_name,
      url: d?.metadata_storage_path,
      updatedAt: d?.metadata_storage_last_modified,
      content: d?.content,
    }));
    return NextResponse.json({ ok: true, results: rows });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Search failed" }, { status: 500 });
  }
}
