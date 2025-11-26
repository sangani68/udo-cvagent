// app/api/hydrate-hybrid/route.ts
import { NextRequest, NextResponse } from "next/server";
import { queryBlobIndex, upsertHybridDocs, stableId } from "@/lib/azureSearch";

export const runtime = "nodejs";
export const maxDuration = 300;

type BlobDoc = {
  id: string;
  metadata_storage_name?: string;
  metadata_storage_path?: string;
  metadata_storage_last_modified?: string;
  content?: string;
};

export async function POST(req: NextRequest) {
  try {
    // Optional JSON body: { since?: string, top?: number }
    const body = (await req.json().catch(() => ({}))) as {
      since?: string;
      top?: number;
    };

    const top = Number(body.top || 1000);
    const since = typeof body.since === "string" && body.since.trim() ? body.since : undefined;

    // 1) Read from blob index (cvkb-blob)
    const blob = await queryBlobIndex(since, top);
    const rows = (blob?.value || []) as BlobDoc[];

    if (!rows.length) {
      return NextResponse.json({
        ok: true,
        indexed: 0,
        sourceDocs: 0,
        note: "No blob docs found to sync",
      });
    }

    // 2) Map blob docs → hybrid docs (cvkb)
    //    IMPORTANT: only send fields that exist in the cvkb schema:
    //    id, name, url, content, updatedAt
    const hybridDocs = rows.map((d) => {
      const path = d.metadata_storage_path || d.id || "";
      const name =
        d.metadata_storage_name ||
        (path ? path.replace(/^.*\//, "") : "") ||
        d.id ||
        "document";
      const updatedAt = d.metadata_storage_last_modified;
      const content = d.content || "";

      return {
        id: stableId(path || name),
        name,
        url: path,
        content,
        updatedAt,
      };
    });

    // 3) Upsert into hybrid index (cvkb)
    const result = await upsertHybridDocs(hybridDocs);

    return NextResponse.json({
      ok: true,
      sourceDocs: rows.length,
      indexed: result.actions,
    });
  } catch (e: any) {
    console.error("[hydrate-hybrid] ERROR:", e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
