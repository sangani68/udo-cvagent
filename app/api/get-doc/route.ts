// app/api/get-doc/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "Missing ?path=" }, { status: 400 });
  }

  // TODO: integrate with lib/search.fetchDocByPath when available
  return NextResponse.json({
    ok: true,
    path,
    content: null,
    note: "Stub response — wire to lib/search later."
  });
}
