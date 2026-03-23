"use client";

import React from "react";

type Props = {
  onImported?: (result: { imported: number; names: string[] }) => void;
};

export default function WorkerProfileImportPanel({ onImported }: Props) {
  const [xlsxPath, setXlsxPath] = React.useState("");
  const [pdfPath, setPdfPath] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleImport() {
    try {
      setBusy(true);
      setError(null);
      setMessage(null);

      const res = await fetch("/api/import-worker-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xlsxPath: xlsxPath.trim(),
          pdfPath: pdfPath.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `Import failed (HTTP ${res.status})`);
      }

      setMessage(
        `Imported ${json.imported} worker profiles into the knowledge base.` +
          (json?.note ? ` ${json.note}` : "")
      );
      onImported?.({
        imported: Number(json.imported || 0),
        names: Array.isArray(json.names) ? json.names : [],
      });
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border p-3">
      <div className="mb-2 text-sm font-medium">Worker Profile Import</div>
      <div className="grid gap-2">
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="Absolute path to worker profile XLSX"
          value={xlsxPath}
          onChange={(e) => setXlsxPath(e.target.value)}
        />
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="Optional absolute path to source PDF"
          value={pdfPath}
          onChange={(e) => setPdfPath(e.target.value)}
        />
        <button
          onClick={handleImport}
          disabled={busy}
          className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-60"
        >
          {busy ? "Importing…" : "Import Profiles to KB"}
        </button>
      </div>

      {message ? (
        <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}
