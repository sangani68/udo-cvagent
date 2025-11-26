// app/api/preview/route.tsx
import { NextRequest } from "next/server";
import React from "react";
import { renderToStream } from "@react-pdf/renderer";

import { buildViewData } from "@/lib/preview-pipeline";
import KyndrylPDF from "@/components/pdf/KyndrylPDF";
import EuropassPDF from "@/components/pdf/EuropassPDF";
import { buildHtmlPreview } from "@/lib/htmlPreview";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const template =
      (body.templateId || body.template || "pdf-kyndryl") as string;

    // Use the unified preview pipeline (mask → normalize → translate)
    const { data } = await buildViewData({
      ...body,
      template,
      templateId: template,
    });

    // ── PDF templates (React-PDF, Kyndryl & Europass) ──
    if (template === "pdf-kyndryl") {
      const element = React.createElement(KyndrylPDF as any, { data });
      const stream = await (renderToStream as any)(element);
      return new Response(stream as any, {
        headers: { "Content-Type": "application/pdf" },
      });
    }

    if (template === "pdf-europass") {
      const element = React.createElement(EuropassPDF as any, { data });
      const stream = await (renderToStream as any)(element);
      return new Response(stream as any, {
        headers: { "Content-Type": "application/pdf" },
      });
    }

    // ── Everything else (DOCX / PPTX) → HTML snapshot ──
    const html = await buildHtmlPreview(data, template);
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
