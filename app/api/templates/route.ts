export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

// Keep these ids in sync with lib/previewFlow.ts (TemplateId union)
type TemplateId = "pdf-kyndryl" | "pdf-europass" | "docx-ep" | "pptx-kyndryl-sm";

type TemplateEntry = {
  id: TemplateId;          // <- used by the UI
  key: TemplateId;         // <- backward compat if anything still reads `key`
  label: string;           // display text in UI
  kind: "pdf" | "docx" | "pptx";
  ext: "pdf" | "docx" | "pptx";
  previewable: boolean;    // true only for PDFs (React-PDF preview)
  export: {
    path: string;          // API route to call on Export
    method: "POST" | "GET";
    template?: string;     // optional hint for server-side switch
  };
};

const templates: TemplateEntry[] = [
  {
    id: "pdf-kyndryl",
    key: "pdf-kyndryl",
    label: "Kyndryl PDF (Default)",
    kind: "pdf",
    ext: "pdf",
    previewable: true,
    export: {
      path: "/api/export/pdf",
      method: "POST",
      // server route can select Kyndryl component when template === "kyndryl"
      template: "kyndryl",
    },
  },
  {
    id: "pdf-europass",
    key: "pdf-europass",
    label: "Europass PDF",
    kind: "pdf",
    ext: "pdf",
    previewable: true,
    export: {
      path: "/api/export/pdf",
      method: "POST",
      // server route can select Europass component when template === "europass"
      template: "europass",
    },
  },
  {
    id: "docx-ep",
    key: "docx-ep",
    label: "European Parliament (DOCX, Form 6)",
    kind: "docx",
    ext: "docx",
    previewable: false,
    export: {
      path: "/api/export/docx",
      method: "POST",
      // DOCX route currently builds EP Form 6 directly; no extra template param required
    },
  },
  {
    id: "pptx-kyndryl-sm",
    key: "pptx-kyndryl-sm",
    label: "Kyndryl Slide Master (PPTX)",
    kind: "pptx",
    ext: "pptx",
    previewable: false,
    export: {
      path: "/api/export/pptx",
      method: "POST",
    },
  },
];

export async function GET() {
  return NextResponse.json(
    {
      templates,
      // First item is treated as default by the UI; this is just explicit for clients that read it.
      default: "pdf-kyndryl",
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-CV-Template-Source": "api",
      },
    }
  );
}
