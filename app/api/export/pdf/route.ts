// app/api/export/pdf/route.ts
import { NextRequest } from "next/server";
import React from "react";
import ReactPDF from "@react-pdf/renderer"; // use default import for wide version support
import { buildViewData } from "@/lib/preview-pipeline";

export const runtime = "nodejs";

// Map your UI ids → component ids
function mapTemplateId(id?: string): string {
  const t = (id || "pdf-kyndryl").toLowerCase();
  if (t === "pdf-kyndryl") return "kyndryl";
  if (t === "pdf-europass") return "europass";
  return t;
}

// Load from your existing components under root/components/pdf/*
const loaders: Record<string, () => Promise<any>> = {
  kyndryl: () => import("../../../../components/pdf/KyndrylPDF"),
  europass: () => import("../../../../components/pdf/EuropassPDF"),
};

function pickComponent(mod: any) {
  return mod?.default ?? Object.values(mod || {})[0];
}

// Convert Node stream → Web ReadableStream for Response
function nodeToWebStream(nodeStream: any): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on?.("data", (chunk: any) => {
        if (chunk instanceof Uint8Array) controller.enqueue(chunk);
        else if (typeof Buffer !== "undefined" && Buffer.isBuffer?.(chunk)) controller.enqueue(new Uint8Array(chunk));
        else if (typeof chunk === "string") controller.enqueue(new TextEncoder().encode(chunk));
        else controller.enqueue(new Uint8Array(Buffer.from(chunk)));
      });
      nodeStream.on?.("end", () => controller.close());
      nodeStream.on?.("error", (err: any) => controller.error(err));
    },
  });
}

function sanitizeFilename(s: string) {
  return (s || "cv").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // mask → normalize → deep-translate (and safe candidate.name)
    const { data, template, locale } = await buildViewData({
      cv: body?.cv ?? body?.data ?? body,
      template: body?.template,
      locale: body?.locale ?? "en",
      maskPersonal: !!body?.maskPersonal,
    });

    const tpl = mapTemplateId(template);
    const load = loaders[tpl];
    if (!load) {
      return new Response(JSON.stringify({ error: `Unknown PDF template: ${tpl}` }), { status: 400 });
    }

    const mod = await load();
    const Template = pickComponent(mod);
    if (!Template) {
      return new Response(JSON.stringify({ error: `Failed to load PDF component: ${tpl}` }), { status: 500 });
    }

    // Render with React-PDF server API → Node stream (no Buffer / no PDFDocument to Response)
    const element = React.createElement(Template, { data, locale });
    // Prefer renderToStream when available; otherwise pdf(element).toStream()
    const nodeStream =
      typeof (ReactPDF as any).renderToStream === "function"
        ? await (ReactPDF as any).renderToStream(element)
        : typeof (ReactPDF as any).pdf === "function" && typeof (ReactPDF as any).pdf(element)?.toStream === "function"
        ? await (ReactPDF as any).pdf(element).toStream()
        : null;

    if (!nodeStream) {
      // Fallback to toBuffer() (promise-form or callback-form)
      const pdfInstance = (ReactPDF as any).pdf?.(element);
      if (pdfInstance?.toBuffer) {
        const out = await pdfInstance.toBuffer();
        const buf =
          out instanceof ArrayBuffer ? Buffer.from(out)
          : ArrayBuffer.isView(out) ? Buffer.from(out as Uint8Array)
          : Buffer.isBuffer(out) ? out
          : Buffer.from(out ?? []);
        const filename = sanitizeFilename(data?.candidate?.name || "cv") + ".pdf";
        return new Response(buf, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store",
          },
        });
      }
      return new Response(JSON.stringify({ error: "React-PDF did not expose a stream or buffer" }), { status: 500 });
    }

    const webStream = nodeToWebStream(nodeStream);
    const filename = sanitizeFilename(data?.candidate?.name || "cv") + ".pdf";
    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), { status: 500 });
  }
}
