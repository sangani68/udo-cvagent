"use client";
import * as React from "react";
import { exportPdf, exportDocx, exportPptx } from "@/lib/exportClient";

export function ExportButtons({ cv }: { cv: any }) {
  const [busy, setBusy] = React.useState<string | null>(null);

  async function run(label: string, fn: () => Promise<any>) {
    setBusy(label);
    try { await fn(); } finally { setBusy(null); }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button
        className="rounded-xl border p-3 hover:shadow disabled:opacity-50"
        disabled={!!busy}
        onClick={() => run("europass", () => exportPdf("europass", cv, cv?.meta?.locale || "en"))}
      >
        {busy === "europass" ? "Exporting…" : "PDF — Europass"}
      </button>

      <button
        className="rounded-xl border p-3 hover:shadow disabled:opacity-50"
        disabled={!!busy}
        onClick={() => run("kyndryl", () => exportPdf("kyndryl", cv, cv?.meta?.locale || "en"))}
      >
        {busy === "kyndryl" ? "Exporting…" : "PDF — Kyndryl"}
      </button>

      <button
        className="rounded-xl border p-3 hover:shadow disabled:opacity-50"
        disabled={!!busy}
        onClick={() => run("docx", () => exportDocx(cv, cv?.meta?.locale || "en"))}
      >
        {busy === "docx" ? "Exporting…" : "Word — European Parliament"}
      </button>

      <button
        className="rounded-xl border p-3 hover:shadow disabled:opacity-50"
        disabled={!!busy}
        onClick={() => run("pptx", () => exportPptx(cv, cv?.meta?.locale || "en"))}
      >
        {busy === "pptx" ? "Exporting…" : "PPT — Kyndryl SM"}
      </button>
    </div>
  );
}
