// app/api/retrieve-cv/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVICE  = process.env.AZURE_SEARCH_SERVICE!;
const API_KEY  = process.env.AZURE_SEARCH_API_KEY!;
const INDEX    = process.env.AZURE_SEARCH_INDEX || "cvkb";
const VERSION  = process.env.AZURE_SEARCH_API_VERSION || "2024-07-01";

function hasSearchEnv() { return Boolean(SERVICE && API_KEY && INDEX); }

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q   = url.searchParams.get("q") ?? "";
    const top = Number(url.searchParams.get("top") ?? 20);

    if (!hasSearchEnv()) return NextResponse.json({ value: [] });

    const endpoint = `https://${SERVICE}.search.windows.net/indexes/${INDEX}/docs/search?api-version=${VERSION}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": API_KEY },
      body: JSON.stringify({ search: q || "*", top, queryType: "simple" }),
    });
    if (!res.ok) throw new Error(`Search ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return NextResponse.json({ value: Array.isArray(data?.value) ? data.value : [] });
  } catch (err: any) {
    return NextResponse.json({ value: [], error: String(err?.message || err) }, { status: 200 });
  }
}
