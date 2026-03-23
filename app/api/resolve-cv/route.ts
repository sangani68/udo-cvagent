import { NextRequest, NextResponse } from "next/server";
import { resolveCvFromKnowledgeBase } from "@/lib/kb-resolver";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await resolveCvFromKnowledgeBase(body || {});
    return NextResponse.json({
      ok: true,
      cv: result.cv,
      candidateName: result.candidateName,
      sources: result.sources.map((source) => ({
        name: source.name,
        role: source.role,
        url: source.url,
        updatedAt: source.updatedAt,
        source: source.source,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || error) },
      { status: 400 }
    );
  }
}
