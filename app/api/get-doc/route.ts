// app/api/get-doc/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getTextFromAny } from "@/lib/cv-extract";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "Missing ?path=" }, { status: 400 });
  }

  try {
    const { text, note } = await getTextFromAny({ url: path });
    return NextResponse.json({
      ok: true,
      path,
      content: text || null,
      note: note || undefined,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
