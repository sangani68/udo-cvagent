// lib/previewFlow.ts
import { toPreviewModel, type CvData } from "./cv-view";

export type TemplateId =
  | "pdf-kyndryl"
  | "pdf-europass"
  | "pdf-europass2"
  | "docx-ep"
  | "docx-kyndryl"
  | "docx-europass"
  | "docx-europass2"
  | "pptx-kyndryl-sm";

export type PreviewState =
  | { mode: "pdf"; template: TemplateId; data: CvData }
  | { mode: "html"; template: TemplateId; html: string };

export type MaskPolicy = { email?: boolean; phone?: boolean; location?: boolean };

export function safeFileBase(s: string) {
  return (s || "candidate")
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .slice(0, 80);
}

export function chooseExportRoute(tpl: TemplateId) {
  if (tpl.startsWith("pdf")) return "/api/export/pdf";
  if (tpl.startsWith("docx")) return "/api/export/docx";
  if (tpl === "pptx-kyndryl-sm") return "/api/export/pptx";
  return "/api/export/pdf";
}

/** Build the preview data model the templates need, from the raw CV. */
export function buildPreviewModel(cv: any, _template: TemplateId): CvData {
  return toPreviewModel(cv);
}

/** Translate the CV and return a data model (CvData). */
export async function translateCv(
  cv: any,
  to: "en" | "fr" | "de" | "nl"
): Promise<CvData> {
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cv, to, from: cv?.meta?.locale || "en" }),
  });
  const j = await res.json().catch(() => ({}));
  // Prefer server-provided preview data
  if (j?.data) return j.data;
  // Else re-map the translated cv
  const translated = j?.cv || cv;
  return toPreviewModel(translated);
}

/** Apply GDPR-style masking to the preview data model. */
export function maskPreviewData(model: CvData, policy: MaskPolicy): CvData {
  const next: CvData = JSON.parse(JSON.stringify(model || {}));
  if (!next?.candidate) return next;

  if (policy?.email) next.candidate.email = "";
  if (policy?.phone) next.candidate.phone = "";
  if (policy?.location) next.candidate.location = "";

  return next;
}

/** Minimal HTML snapshot for DOCX/PPTX exporters that rely on HTML → file. */
export function buildHtmlSnapshot(data: CvData, _template: TemplateId) {
  const c = data?.candidate || {};
  const esc = (s: any) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const lines: string[] = [];
  lines.push(`<h1>${esc(c.fullName || "")}</h1>`);
  if (c.title) lines.push(`<h3>${esc(c.title)}</h3>`);
  const metaBits = [c.email, c.phone, c.location].filter(Boolean).map(esc);
  if (metaBits.length)
    lines.push(`<p><small>${metaBits.join(" • ")}</small></p>`);
  if (c.summary) lines.push(`<p>${esc(c.summary)}</p>`);

  if (Array.isArray(c.skills) && c.skills.length) {
    lines.push(`<h2>Skills</h2>`);
    lines.push(`<p>${c.skills.map(esc).join(", ")}</p>`);
  }

  if (Array.isArray(c.experiences) && c.experiences.length) {
    lines.push(`<h2>Experience</h2>`);
    for (const e of c.experiences as any[]) {
      const head = [e?.title, e?.company].filter(Boolean).map(esc).join(" — ");
      const dates = [e?.start, e?.end].filter(Boolean).map(esc).join(" – ");
      lines.push(
        `<h3>${head}${dates ? ` <small>(${dates})</small>` : ""}</h3>`
      );
      const rawBullets = Array.isArray(e?.bullets) ? e.bullets! : [];
      const bullets = rawBullets
        .map((b: any) => (typeof b === "string" ? b : b?.text))
        .filter(Boolean);
      if (bullets.length) {
        lines.push(`<ul>`);
        for (const b of bullets) lines.push(`<li>${esc(b)}</li>`);
        lines.push(`</ul>`);
      }
    }
  }

  if (Array.isArray(c.education) && c.education.length) {
    lines.push(`<h2>Education</h2>`);
    for (const ed of c.education as any[]) {
      // Support both old (title/org) and new (degree/school) shapes
      const head = [
        ed?.title ?? ed?.degree,
        ed?.org ?? ed?.school,
      ]
        .filter(Boolean)
        .map(esc)
        .join(" — ");
      const dates = [ed?.start, ed?.end].filter(Boolean).map(esc).join(" – ");
      lines.push(
        `<h3>${head}${dates ? ` <small>(${dates})</small>` : ""}</h3>`
      );
      const fieldOfStudy = ed?.fieldOfStudy || ed?.field || ed?.area || ed?.major || ed?.specialization;
      const eqfLevel = ed?.eqfLevel || ed?.eqf || ed?.levelEqf;
      if (fieldOfStudy) lines.push(`<p>Field(s) of study: ${esc(fieldOfStudy)}</p>`);
      if (eqfLevel) lines.push(`<p>Level in EQF: ${esc(eqfLevel)}</p>`);
      const details = (ed as any)?.details;
      if (details) lines.push(`<p>${esc(details)}</p>`);
    }
  }

  // Certifications are not in the strict CvData type, so treat as any
  const certs: any[] = Array.isArray((c as any).certifications)
    ? (c as any).certifications
    : [];
  if (certs.length) {
    lines.push(`<h2>Certifications</h2>`);
    lines.push(`<ul>`);
    for (const cert of certs) {
      const t = [cert?.name, cert?.date]
        .filter(Boolean)
        .map(esc)
        .join(" — ");
      lines.push(`<li>${t}</li>`);
    }
    lines.push(`</ul>`);
  }

  if (Array.isArray(c.languages) && c.languages.length) {
    lines.push(`<h2>Languages</h2>`);
    lines.push(
      `<p>${c.languages
        .map((l: any) =>
          [l?.name, l?.level].filter(Boolean).map(esc).join(" — ")
        )
        .join(", ")}</p>`
    );
  }

  return `<!doctype html><meta charset="utf-8"><body>${lines.join(
    "\n"
  )}</body>`;
}
