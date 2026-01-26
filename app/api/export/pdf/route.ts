// app/api/export/pdf/route.ts
import { NextRequest } from "next/server";
import React from "react";
import ReactPDF from "@react-pdf/renderer"; // use default import for wide version support
import { buildViewData } from "@/lib/preview-pipeline";
import { uploadToCvkb } from "@/lib/azure";
import { buildExportFilename } from "@/lib/export-utils";

export const runtime = "nodejs";

// Map your UI ids → component ids
function mapTemplateId(id?: string): string {
  const t = (id || "pdf-kyndryl").toLowerCase();
  if (t === "pdf-kyndryl") return "kyndryl";
  if (t === "pdf-europass") return "europass";
  if (t === "pdf-europass2") return "europass2";
  return t;
}

// Load from your existing components under root/components/pdf/*
const loaders: Record<string, () => Promise<any>> = {
  kyndryl: () => import("../../../../components/pdf/KyndrylPDF"),
  europass: () => import("../../../../components/pdf/EuropassPDF"),
  europass2: () => import("../../../../components/pdf/Europass2PDF"),
};

function pickComponent(mod: any) {
  return mod?.default ?? Object.values(mod || {})[0];
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    stream.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

function sanitizeFilename(s: string) {
  return (s || "cv").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim();
}

function templateLabel(id?: string) {
  const t = (id || "").toLowerCase();
  if (t === "pdf-kyndryl") return "Kyndryl";
  if (t === "pdf-europass") return "Europass";
  if (t === "pdf-europass2") return "Europass2";
  return id || "Template";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // mask → normalize → deep-translate (and safe candidate.name)
    const { data, template, locale, cv } = await buildViewData({
      cv: body?.cv ?? body?.data ?? body,
      template: body?.template,
      locale: body?.locale ?? "en",
      maskPersonal: !!body?.maskPersonal,
      maskPolicy: body?.maskPolicy,
    });

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

    // Render with React-PDF server API → Node stream (no Buffer / no PDFDocument to Response)
    const element = React.createElement(Template, { data, locale });
    const nodeStream =
      typeof (ReactPDF as any).renderToStream === "function"
        ? await (ReactPDF as any).renderToStream(element)
        : typeof (ReactPDF as any).pdf === "function" &&
          typeof (ReactPDF as any).pdf(element)?.toStream === "function"
        ? await (ReactPDF as any).pdf(element).toStream()
        : null;

    let buf: Buffer | null = null;
    if (nodeStream) {
      buf = await streamToBuffer(nodeStream);
    } else {
      const pdfInstance = (ReactPDF as any).pdf?.(element);
      if (pdfInstance?.toBuffer) {
        const out = await pdfInstance.toBuffer();
        buf =
          out instanceof ArrayBuffer
            ? Buffer.from(out)
            : ArrayBuffer.isView(out)
            ? Buffer.from(out as Uint8Array)
            : Buffer.isBuffer(out)
            ? out
            : Buffer.from(out ?? []);
      }
    }

    if (!buf || buf.byteLength === 0) {
      return new Response(
        JSON.stringify({ error: "React-PDF did not expose a stream or buffer" }),
        { status: 500 }
      );
    }

    const filename = buildExportFilename(
      templateLabel(template),
      data?.candidate?.name || "Candidate",
      "pdf"
    );

    // Best-effort: upload to blob + sync into search
    try {
      await uploadToCvkb(`exports/${filename}`, buf, "application/pdf");
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
      console.error("[export/pdf] post-export sync failed:", e);
    }

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${sanitizeFilename(filename)}"`,
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
