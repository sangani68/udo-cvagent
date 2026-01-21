// app/api/preview/route.ts
import { NextRequest } from "next/server";
import React from "react";
import ReactPDF from "@react-pdf/renderer";
import { buildViewData } from "@/lib/preview-pipeline";
import { buildHtmlPreview } from "@/lib/htmlPreview";

export const runtime = "nodejs";

// Map UI ids -> component ids
function mapTemplateId(id?: string): string {
  const t = (id || "pdf-kyndryl").toLowerCase();
  if (t === "pdf-kyndryl") return "kyndryl";
  if (t === "pdf-europass") return "europass";
  if (t === "pdf-europass2") return "europass2";
  return t;
}

const loaders: Record<string, () => Promise<any>> = {
  kyndryl: () => import("@/components/pdf/KyndrylPDF"),
  europass: () => import("@/components/pdf/EuropassPDF"),
  europass2: () => import("@/components/pdf/Europass2PDF"),
};

function pickComponent(mod: any) {
  return mod?.default ?? Object.values(mod || {})[0];
}

// Convert Node stream -> Web ReadableStream for Response
function nodeToWebStream(nodeStream: any): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on?.("data", (chunk: any) => {
        if (chunk instanceof Uint8Array) controller.enqueue(chunk);
        else if (typeof Buffer !== "undefined" && Buffer.isBuffer?.(chunk))
          controller.enqueue(new Uint8Array(chunk));
        else if (typeof chunk === "string")
          controller.enqueue(new TextEncoder().encode(chunk));
        else controller.enqueue(new Uint8Array(Buffer.from(chunk)));
      });
      nodeStream.on?.("end", () => controller.close());
      nodeStream.on?.("error", (err: any) => controller.error(err));
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { data, template, locale } = await buildViewData({
      cv: body?.cv ?? body?.data ?? body,
      template: body?.template,
      locale: body?.locale ?? "en",
      maskPersonal: !!body?.maskPersonal,
    });

    if (template === "docx-ep" || template === "pptx-kyndryl-sm") {
      const html = await buildHtmlPreview(data, template);
      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    const tpl = mapTemplateId(template);
    const load = loaders[tpl];
    if (!load) {
      return new Response(
        JSON.stringify({ error: `Unknown PDF template: ${tpl}` }),
        { status: 400 }
      );
    }

    const mod = await load();
    const Template = pickComponent(mod);
    if (!Template) {
      return new Response(
        JSON.stringify({ error: `Failed to load PDF component: ${tpl}` }),
        { status: 500 }
      );
    }

    const element = React.createElement(Template, { data, locale });
    const nodeStream =
      typeof (ReactPDF as any).renderToStream === "function"
        ? await (ReactPDF as any).renderToStream(element)
        : typeof (ReactPDF as any).pdf === "function" &&
          typeof (ReactPDF as any).pdf(element)?.toStream === "function"
        ? await (ReactPDF as any).pdf(element).toStream()
        : null;

    if (!nodeStream) {
      const pdfInstance = (ReactPDF as any).pdf?.(element);
      if (pdfInstance?.toBuffer) {
        const out = await pdfInstance.toBuffer();
        const buf =
          out instanceof ArrayBuffer
            ? Buffer.from(out)
            : ArrayBuffer.isView(out)
            ? Buffer.from(out as Uint8Array)
            : Buffer.isBuffer(out)
            ? out
            : Buffer.from(out ?? []);
        return new Response(buf, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": "inline; filename=\"preview.pdf\"",
            "Cache-Control": "no-store",
          },
        });
      }
      return new Response(
        JSON.stringify({ error: "React-PDF did not expose a stream or buffer" }),
        { status: 500 }
      );
    }

    const webStream = nodeToWebStream(nodeStream);
    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=\"preview.pdf\"",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: String(err?.message ?? err) }),
      { status: 500 }
    );
  }
}
