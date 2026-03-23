// lib/cv-templates.ts
export type CvTemplateId =
  | "pdf-europass"
  | "pdf-europass2"
  | "pdf-kyndryl"
  | "docx-european-parliament"
  | "docx-kyndryl"
  | "docx-europass"
  | "docx-europass2"
  | "docx-ep-template"
  | "docx-non-key-personnel"
  | "pptx-kyndryl-sm"
  | "pptx-kyndryl-sm-anon"
  | "pptx-cv-template";

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
    id: "docx-ep-template",
    label: "European Parliament Template (Word)",
    kind: "docx",
    brand: "European Parliament",
    description: "Template-driven European Parliament export using the provided layout.",
    api: "/api/export/docx",
    payload: { template: "docx-ep-template" },
  },
  {
    id: "docx-non-key-personnel",
    label: "Non-key Personnel Table (Word)",
    kind: "docx",
    brand: "Kyndryl",
    description: "Template-driven competency table using the provided layout.",
    api: "/api/export/docx",
    payload: { template: "docx-non-key-personnel" },
  },
  {
    id: "pptx-kyndryl-sm",
    label: "Kyndryl SM (PowerPoint)",
    kind: "pptx",
    brand: "Kyndryl",
    description: "3-slide summary deck (cover, experience, skills).",
    api: "/api/export/pptx",
  },
  {
    id: "pptx-kyndryl-sm-anon",
    label: "Kyndryl SM (PowerPoint, Anonymized)",
    kind: "pptx",
    brand: "Kyndryl",
    description: "Seller-ready slide without employee name or photo.",
    api: "/api/export/pptx",
  },
  {
    id: "pptx-cv-template",
    label: "PPT CV Template (PowerPoint)",
    kind: "pptx",
    brand: "Kyndryl",
    description: "Template-preserving single-slide export using the provided PPT layout.",
    api: "/api/export/pptx",
  },
];
