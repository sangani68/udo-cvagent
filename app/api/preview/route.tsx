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
    const body = await req.json().catch(() => ({}));

    // 🔁 Single source of truth: mask → normalize → deep-translate
    const { data, template } = await buildViewData(body);
    // `data` is CvData (candidate, experience, education, skills, languages,…)

    // ── PDF templates (React-PDF, same as your frozen version) ──
    if (template === "pdf-kyndryl") {
      const stream = await renderToStream(React.createElement(KyndrylPDF as any, { data }));
      return new Response(stream as any, {
        headers: { "Content-Type": "application/pdf" },
      });
    }

    if (template === "pdf-europass") {
      const stream = await renderToStream(React.createElement(EuropassPDF as any, { data }));
      return new Response(stream as any, {
        headers: { "Content-Type": "application/pdf" },
      });
    }

    // ── Everything else (DOCX / PPTX) → HTML snapshot ──
    // For "docx-ep" this uses the EP Form 6 HTML we wired in lib/htmlPreview.ts
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
