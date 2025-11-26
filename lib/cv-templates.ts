export type CvTemplateId =
  | "pdf-europass"
  | "pdf-kyndryl"
  | "docx-european-parliament"
  | "pptx-kyndryl-sm";

export type CvTemplate = {
  id: CvTemplateId;
  label: string;
  kind: "pdf" | "docx" | "pptx";
  brand: "Europass" | "Kyndryl" | "European Parliament";
  description?: string;
  api: string;                 // API route to call
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
    payload: { template: "europass" }
  },
  {
    id: "pdf-kyndryl",
    label: "Kyndryl (PDF)",
    kind: "pdf",
    brand: "Kyndryl",
    description: "Kyndryl-branded PDF with accent color.",
    api: "/api/export/pdf",
    payload: { template: "kyndryl" }
  },
  {
    id: "docx-european-parliament",
    label: "European Parliament (Word)",
    kind: "docx",
    brand: "European Parliament",
    description: "Formal DOCX layout for submissions.",
    api: "/api/export/docx"
  },
  {
    id: "pptx-kyndryl-sm",
    label: "Kyndryl SM (PowerPoint)",
    kind: "pptx",
    brand: "Kyndryl",
    description: "3-slide summary deck (cover, experience, skills).",
    api: "/api/export/pptx"
  }
];
