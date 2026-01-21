// app/api/blob/get-by-path/route.ts
import { NextRequest, NextResponse } from "next/server";
import { queryBlobDocByName, queryBlobDocByPath } from "@/lib/azureSearch";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { path?: string; name?: string };
    const path = body?.path;
    const name = body?.name;
    if (!path && !name) {
      return NextResponse.json({ error: "Missing path or name" }, { status: 400 });
    }
    let row: any = null;
    if (path) {
      const result = await queryBlobDocByPath(path);
      row = (result?.value || [])[0] || null;
    }
    if (!row && name) {
      const result = await queryBlobDocByName(name);
      row = (result?.value || [])[0] || null;
    }
    return NextResponse.json({ ok: true, doc: row });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
