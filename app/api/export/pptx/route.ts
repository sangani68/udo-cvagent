// app/api/export/pptx/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import type { CVJson } from "@/lib/cvSchema";
import type { MaskPolicy } from "@/lib/mask";
import { buildViewData } from "@/lib/preview-pipeline";
import { buildKyndrylSMView } from "@/lib/kyndryl-sm";
import { makeKyndrylSM } from "@/lib/pptx/KyndrylSM";
import { uploadToCvkb } from "@/lib/azure";
import { buildExportFilename } from "@/lib/export-utils";

type Payload = {
  data?: CVJson;
  cv?: CVJson;
  template?: string;
  templateId?: string;
  locale?: string;
  maskPersonal?: boolean;
  maskPolicy?: MaskPolicy;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Payload;
    const templateId = (body.templateId || body.template || "pptx-kyndryl-sm") as string;

    const original = (body.cv || body.data) as CVJson;
    if (!original?.candidate) {
      return NextResponse.json({ error: "No CV data to export." }, { status: 400 });
    }

    // Pick a safe locale (body.locale -> original.meta.locale -> "en")
    const targetLocale = (body.locale || original?.meta?.locale || "en").toLowerCase();

    // Use the same pipeline as preview/export
    const viewBody = {
      ...body,
      data: original,
      cv: original,
      template: templateId,
      templateId,
      locale: targetLocale,
      maskPolicy: body?.maskPolicy,
    };

    const { data } = await buildViewData(viewBody);

    const view = await buildKyndrylSMView(data, targetLocale);
    const bytes = (await makeKyndrylSM(view)) as Buffer;

    const filename = buildExportFilename(
      "KyndrylSM",
      data?.candidate?.name || "Candidate",
      "pptx"
    );

    // Best-effort: upload to blob + sync into search
    try {
      await uploadToCvkb(
        `exports/${filename}`,
        bytes,
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      );
      const origin = new URL(req.url).origin;
      await fetch(`${origin}/api/blob/run-and-wait?timeout=120&interval=3000&forceStart=1`, {
        method: "POST",
      });
      await fetch(`${origin}/api/hydrate-hybrid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          since: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          top: 1000,
        }),
      });
    } catch (e) {
      console.error("[export/pptx] post-export sync failed:", e);
    }

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
