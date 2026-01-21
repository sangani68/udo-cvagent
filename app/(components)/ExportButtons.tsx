"use client";
import * as React from "react";
import { exportPdf, exportDocx, exportPptx } from "@/lib/exportClient";

export function ExportButtons({ cv }: { cv: any }) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [syncStatus, setSyncStatus] = React.useState<string | null>(null);
  const [syncProgress, setSyncProgress] = React.useState(0);

  async function syncIndex() {
    try {
      setSyncStatus("Indexing…");
      setSyncProgress(10);
      await fetch("/api/setup-indexer", { method: "POST" }).catch(() => {});
      setSyncProgress(30);
      let idxRes = await fetch("/api/blob/run-and-wait?timeout=300&interval=3000&forceStart=1", {
        method: "POST",
      });
      let idxJson = await idxRes.json().catch(() => ({}));
      const hasIndexerError =
        Array.isArray(idxJson?.lastResult?.errors) &&
        idxJson.lastResult.errors.length > 0;
      if (hasIndexerError) {
        setSyncProgress(40);
        await fetch("/api/reset-blob-index/safe", { method: "POST" }).catch(() => {});
        idxRes = await fetch("/api/blob/run-and-wait?timeout=300&interval=3000&forceStart=1", {
          method: "POST",
        });
        idxJson = await idxRes.json().catch(() => ({}));
      }
      setSyncProgress(70);
      await fetch("/api/hydrate-hybrid", { method: "POST" });
      setSyncStatus("Indexed");
      setSyncProgress(100);
      setTimeout(() => setSyncStatus(null), 4000);
      setTimeout(() => setSyncProgress(0), 4000);
    } catch {
      setSyncStatus("Indexing failed");
      setSyncProgress(0);
    }
  }

  async function run(label: string, fn: () => Promise<any>) {
    setBusy(label);
    setSyncStatus(null);
    try {
      await fn();
      await syncIndex();
    } finally {
      setBusy(null);
    }
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
      {syncStatus ? (
        <div className="rounded-xl border p-3 text-xs text-gray-600">
          <div className="mb-1">{syncStatus}</div>
          <div className="h-2 w-full overflow-hidden rounded bg-gray-200">
            <div
              className="h-full bg-black transition-all"
              style={{ width: `${Math.min(100, Math.max(0, syncProgress))}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
