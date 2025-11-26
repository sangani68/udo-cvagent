// app/api/search/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { hybridSearch } from "../../../lib/search";

export async function POST(req: NextRequest) {
  try {
    const { q = "", top = 20, language } = await req.json().catch(() => ({}));
    const out = await hybridSearch(String(q || ""), { top: Number(top) || 20, language });
    return NextResponse.json({ ok: true, results: out.results });
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
    return NextResponse.json({ ok: true, results: out.results });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Search failed" }, { status: 500 });
  }
}
