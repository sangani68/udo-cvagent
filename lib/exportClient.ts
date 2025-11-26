// lib/exportClient.ts
// Purpose: client helpers that POST CV data to the export routes and trigger downloads.

type ExportKind = "pdf" | "docx" | "pptx";

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

/**
 * Generic export client used by all wrappers.
 * `data` can be CVJson or CvData – the server accepts either as `cv`/`data`.
 */
export async function exportCvClient(
  kind: ExportKind,
  data: any,
  options: {
    templateId: string;
    locale?: string;
    maskPersonal?: boolean;
  }
): Promise<void> {
  const route = `/api/export/${kind}`;

  const res = await fetch(route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data,
      cv: data, // export routes accept `cv` or `data`
      template: options.templateId,
      templateId: options.templateId,
      locale: options.locale,
      maskPersonal: options.maskPersonal,
    }),
  });

  if (!res.ok) {
    let msg = `Export failed (${res.status})`;
    try {
      const j = await res.json();
      msg = j?.error || msg;
    } catch {
      // ignore JSON parse errors and keep default message
    }
    throw new Error(msg);
  }

  const blob = await res.blob();

  // Try to get filename from Content-Disposition
  const cd = res.headers.get("Content-Disposition") || "";
  const m = cd.match(/filename="?([^"]+)"?/i);
  const fallbackName = `export_${options.templateId}.${kind}`;
  const filename = m?.[1] || fallbackName;

  downloadBlob(blob, filename);
}

/**
 * Legacy-style wrappers so existing imports keep working.
 * Signature: (cv, templateId, locale?, maskPersonal?)
 */
export async function exportPdf(
  cv: any,
  templateId: string,
  locale?: string,
  maskPersonal?: boolean
) {
  return exportCvClient("pdf", cv, { templateId, locale, maskPersonal });
}

export async function exportDocx(
  cv: any,
  templateId: string,
  locale?: string,
  maskPersonal?: boolean
) {
  return exportCvClient("docx", cv, { templateId, locale, maskPersonal });
}

export async function exportPptx(
  cv: any,
  templateId: string,
  locale?: string,
  maskPersonal?: boolean
) {
  return exportCvClient("pptx", cv, { templateId, locale, maskPersonal });
}
