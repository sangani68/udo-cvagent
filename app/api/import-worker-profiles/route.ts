import { access } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { importWorkerProfilesToKnowledgeBase } from "@/lib/workerProfiles";

export const runtime = "nodejs";
export const maxDuration = 300;

function isAbsolutePath(value: string) {
  return value.startsWith("/");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      xlsxPath?: string;
      pdfPath?: string;
    };

    const xlsxPath = String(body.xlsxPath || "").trim();
    const pdfPath = String(body.pdfPath || "").trim();

    if (!xlsxPath) {
      return NextResponse.json({ ok: false, error: "xlsxPath is required." }, { status: 400 });
    }
    if (!isAbsolutePath(xlsxPath)) {
      return NextResponse.json({ ok: false, error: "xlsxPath must be an absolute filesystem path." }, { status: 400 });
    }
    if (!/\.xlsx$/i.test(xlsxPath)) {
      return NextResponse.json({ ok: false, error: "xlsxPath must point to an .xlsx file." }, { status: 400 });
    }

    await access(xlsxPath);
    if (pdfPath) await access(pdfPath).catch(() => null);

    const result = await importWorkerProfilesToKnowledgeBase(xlsxPath);

    return NextResponse.json({
      ok: true,
      imported: result.count,
      names: result.names,
      note: pdfPath
        ? "Spreadsheet import completed. PDF path was accepted as supplemental source metadata but is not parsed page-by-page yet."
        : "Spreadsheet import completed.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}
