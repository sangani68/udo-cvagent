// app/api/drop-index/route.ts
import { NextResponse } from "next/server";
import { dropIndex } from "@/lib/search";

export const runtime = "nodejs";

export async function POST() {
  try {
    const json = await dropIndex();
    return NextResponse.json(json);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
