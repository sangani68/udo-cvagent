// lib/cv-templates.ts
export type CvTemplateId =
  | "pdf-europass"
  | "pdf-europass2"
  | "pdf-kyndryl"
  | "docx-european-parliament"
  | "docx-kyndryl"
  | "docx-europass"
  | "docx-europass2"
  | "pptx-kyndryl-sm";

export type CvTemplate = {
  id: CvTemplateId;
  label: string;
  kind: "pdf" | "docx" | "pptx";
  brand: "Europass" | "Kyndryl" | "European Parliament";
  description?: string;
  api: string;                  // API route to call
  payload?: Record<string, any>; // static payload defaults (merged with {cv, save})
};

export const CV_TEMPLATES: CvTemplate[] = [
  {
    id: "pdf-europass",
    label: "Europass (PDF)",
    kind: "pdf",
    brand: "Europass",
    description: "Clean Europass-style single-column PDF.",
    api: "/api/export/pdf",
    payload: { template: "europass" },
  },
  {
    id: "pdf-europass2",
    label: "Europass 2 (PDF)",
    kind: "pdf",
    brand: "Europass",
    description: "Alternate Europass layout with header identity.",
    api: "/api/export/pdf",
    payload: { template: "europass2" },
  },
  {
    id: "pdf-kyndryl",
    label: "Kyndryl (PDF)",
    kind: "pdf",
    brand: "Kyndryl",
    description: "Kyndryl-branded PDF with accent color.",
    api: "/api/export/pdf",
    payload: { template: "kyndryl" },
  },
  {
    id: "docx-european-parliament",
    label: "European Parliament (Word)",
    kind: "docx",
    brand: "European Parliament",
    description: "Formal DOCX layout for submissions.",
    api: "/api/export/docx",
  },
  {
    id: "docx-kyndryl",
    label: "Kyndryl (Word)",
    kind: "docx",
    brand: "Kyndryl",
    description: "Kyndryl-branded DOCX layout.",
    api: "/api/export/docx",
    payload: { template: "docx-kyndryl" },
  },
  {
    id: "docx-europass",
    label: "Europass (Word)",
    kind: "docx",
    brand: "Europass",
    description: "Europass single-column DOCX.",
    api: "/api/export/docx",
    payload: { template: "docx-europass" },
  },
  {
    id: "docx-europass2",
    label: "Europass 2 (Word)",
    kind: "docx",
    brand: "Europass",
    description: "Europass 2 DOCX layout with header identity.",
    api: "/api/export/docx",
    payload: { template: "docx-europass2" },
  },
  {
    id: "pptx-kyndryl-sm",
    label: "Kyndryl SM (PowerPoint)",
    kind: "pptx",
    brand: "Kyndryl",
    description: "3-slide summary deck (cover, experience, skills).",
    api: "/api/export/pptx",
  },
];
