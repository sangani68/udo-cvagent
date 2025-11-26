// lib/exportClient.ts
// Purpose: client helpers that POST CvData to the export routes and trigger downloads.

import { toCvData } from "./cv-view";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type PdfTemplate = "kyndryl" | "europass";

export async function exportPdf(cvJson: any, template: PdfTemplate = "kyndryl", filename = "cv.pdf") {
  const data = toCvData(cvJson);
  const res = await fetch("/api/export/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template, data }),
  });
  if (!res.ok) throw new Error(`PDF export failed: ${res.status}`);
  const blob = await res.blob();
  downloadBlob(blob, filename);
}

export async function exportDocx(cvJson: any, filename = "cv.docx") {
  const data = toCvData(cvJson);
  const res = await fetch("/api/export/docx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`DOCX export failed: ${res.status}`);
  const blob = await res.blob();
  downloadBlob(blob, filename);
}

export async function exportPptx(cvJson: any, filename = "cv.pptx") {
  const data = toCvData(cvJson);
  const res = await fetch("/api/export/pptx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`PPTX export failed: ${res.status}`);
  const blob = await res.blob();
  downloadBlob(blob, filename);
}
