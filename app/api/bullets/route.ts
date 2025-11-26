// app/api/bullets/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const text: string = body?.text ?? "";

  // naive bullet generator fallback; swap for AOAI later
  const bullets = text
    .split(/\n+|[.;]\s+/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map(s => ({ text: s }));

  return NextResponse.json({ bullets });
}
