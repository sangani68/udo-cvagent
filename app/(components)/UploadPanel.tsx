"use client";

import React from "react";
import type { CVJson } from "@/lib/cvSchema";

type Props = {
  onLoaded: (cv: CVJson) => void;
};

export default function UploadPanel({ onLoaded }: Props) {
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(0);

  async function handleUpload() {
    if (!file) return setErr("Choose a file first.");
    try {
      setBusy(true);
      setErr(null);
      setStatus("Uploading file…");
      setProgress(10);

      const form = new FormData();
      form.append("file", file);
      const upRes = await fetch("/api/upload-cv", { method: "POST", body: form });
      const upJson = await upRes.json().catch(() => ({}));
      if (!upRes.ok || upJson?.ok === false) {
        throw new Error(upJson?.error || `Upload failed (HTTP ${upRes.status})`);
      }

      const blobUrl = upJson?.url as string | undefined;
      const blobPath = upJson?.path as string | undefined;
      const filename = (upJson?.name as string | undefined) || file.name || "upload";
      const indexedName =
        blobPath?.split("/").filter(Boolean).pop() ||
        filename ||
        "upload";

      setStatus("Ensuring indexer…");
      setProgress(25);
      await fetch("/api/setup-indexer", { method: "POST" }).catch(() => {});

      setStatus("Running indexer…");
      setProgress(35);
      let idxRes = await fetch("/api/blob/run-and-wait?timeout=300&interval=3000&forceStart=1", {
        method: "POST",
      });
      let idxJson = await idxRes.json().catch(() => ({}));
      const hasIndexerError =
        Array.isArray(idxJson?.lastResult?.errors) &&
        idxJson.lastResult.errors.length > 0;
      if (hasIndexerError) {
        setStatus("Repairing indexer…");
        setProgress(40);
        await fetch("/api/reset-blob-index/safe", { method: "POST" }).catch(() => {});
        idxRes = await fetch("/api/blob/run-and-wait?timeout=300&interval=3000&forceStart=1", {
          method: "POST",
        });
        idxJson = await idxRes.json().catch(() => ({}));
      }

      setStatus("Syncing search…");
      setProgress(55);
      await fetch("/api/hydrate-hybrid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          since: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          top: 1000,
        }),
      }).catch(() => {});

      setStatus("Waiting for extracted text…");
      setProgress(60);
      let content: string | undefined;
      const maxAttempts = 12;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const docRes = await fetch("/api/blob/get-by-path", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: blobUrl,
            name: indexedName,
          }),
        });
        const docJson = await docRes.json().catch(() => ({}));
        content = docJson?.doc?.content as string | undefined;
        if (content) break;
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
      if (!content) {
        setStatus("Trying server extraction…");
        setProgress(70);
        const gd = await fetch(`/api/get-doc?path=${encodeURIComponent(blobUrl || "")}`);
        const gdJson = await gd.json().catch(() => ({}));
        content = gdJson?.content as string | undefined;
      }
      if (!content) {
        const last = idxJson?.lastResult;
        const errMsg =
          Array.isArray(last?.errors) && last.errors[0]?.errorMessage
            ? ` Indexer error: ${last.errors[0].errorMessage}`
            : "";
        throw new Error(
          "Indexer did not return extracted text yet or the file is image-only. Please try again in a few minutes or upload a text-based PDF/DOCX." +
            errMsg
        );
      }

      setStatus("Building CV…");
      setProgress(85);
      const cvRes = await fetch("/api/convert-to-cvjson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, filename }),
      });
      const cvJson = await cvRes.json().catch(() => ({}));
      if (!cvRes.ok || cvJson?.ok === false) {
        throw new Error(cvJson?.error || `Convert failed (HTTP ${cvRes.status})`);
      }
      const cv = cvJson?.cv ?? cvJson?.data ?? cvJson?.result ?? cvJson;
      if (!cv) throw new Error("No CV returned from server.");
      onLoaded(cv as CVJson);
      setStatus("Ready");
      setProgress(100);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border p-3">
      <div className="mb-2 text-sm font-medium">Upload</div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="file"
          className="w-full rounded border px-3 py-2 text-sm"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md"
        />
        <button
          onClick={handleUpload}
          disabled={busy}
          className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-60"
        >
          {busy ? "Processing…" : "Upload & Build CV"}
        </button>
      </div>
      {err ? (
        <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {err}
        </div>
      ) : null}
      {status ? (
        <div className="mt-2">
          <div className="mb-1 text-[11px] text-gray-600">{status}</div>
          <div className="h-2 w-full overflow-hidden rounded bg-gray-200">
            <div
              className="h-full bg-black transition-all"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
