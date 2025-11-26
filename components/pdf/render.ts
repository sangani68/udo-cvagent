// components/pdf/render.ts
// Node-only renderer that returns a Buffer for React-PDF documents (v3+).
// Tolerant to different component prop names used historically.

import React from "react";
import { renderToStream } from "@react-pdf/renderer";

type CvData = any;

// --- Safe dynamic import helper (tolerate default/named exports) ---
function pickExport(mod: any, names: string[]) {
  for (const n of names) if (mod && typeof mod[n] === "function") return mod[n];
  if (mod && typeof mod.default === "function") return mod.default;
  return null;
}

async function loadPdfComponent(templateId: string): Promise<React.FC<any>> {
  if (templateId === "kyndryl") {
    const mod = await import("@/components/pdf/KyndrylPDF");
    const Comp = pickExport(mod, ["KyndrylPDF"]);
    if (!Comp) throw new Error("KyndrylPDF component not found");
    return Comp as any;
  }
  if (templateId === "europass") {
    const mod = await import("@/components/pdf/EuropassPDF");
    const Comp = pickExport(mod, ["EuropassPDF"]);
    if (!Comp) throw new Error("EuropassPDF component not found");
    return Comp as any;
  }
  throw new Error(`Unknown PDF template "${templateId}"`);
}

// Read a Node stream into a Buffer
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    stream.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

/**
 * Render a PDF template to Buffer.
 * @param templateId internal id: "kyndryl" | "europass"
 * @param data CvData produced by buildViewData(...)
 */
export async function renderPdf(templateId: string, data: CvData): Promise<Buffer> {
  const Component = await loadPdfComponent(templateId);

  // Ultra-tolerant props so legacy/frozen components keep working:
  const props = {
    data,                // most recent convention
    cv: data,            // some components expect "cv"
    view: data,          // some older code used "view"
    candidate: data?.candidate,
    experience: data?.experience,
    education: data?.education,
    meta: data?.meta,
  };

  const element = React.createElement(Component, props);

  const pdfStream = await renderToStream(element);
  const buf = await streamToBuffer(pdfStream);

  if (!buf || buf.byteLength === 0) {
    throw new Error("PDF render returned an empty buffer");
  }
  return buf;
}

export default renderPdf;
