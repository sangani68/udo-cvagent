"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import type { CVJson } from "../../lib/cvSchema";
import { toPreviewModel } from "../../lib/cv-view";
import KyndrylPDF from "@/components/pdf/KyndrylPDF";

// Coerce any URL/blob → data URL so images embed reliably
async function ensureDataUrl(input?: string | null): Promise<string | undefined> {
  if (!input) return undefined;
  if (input.startsWith("data:")) return input;
  try {
    const res = await fetch(input);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return input; // best effort
  }
}

function useObjectUrl(blob: Blob | null) {
  const [url, setUrl] = React.useState<string | null>(null);
  const prev = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!blob) return;
    const next = URL.createObjectURL(blob);
    setUrl(next);
    if (prev.current) URL.revokeObjectURL(prev.current);
    prev.current = next;
    return () => {
      if (prev.current) URL.revokeObjectURL(prev.current);
    };
  }, [blob]);
  return url;
}

export default function ClientPdfPreview({ data }: { data: CVJson }) {
  const [blob, setBlob] = React.useState<Blob | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const viewModel = React.useMemo(() => toPreviewModel(data), [data]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError(null);
      try {
        const candidate = (viewModel as any)?.candidate ?? {};
        const [photo, logo] = await Promise.all([
          ensureDataUrl(candidate.photo),
          ensureDataUrl(candidate.logo),
        ]);
        const hardened = { ...viewModel, candidate: { ...candidate, photo, logo } };
        const instance = pdf(<KyndrylPDF data={hardened as any} />);
        const out = await instance.toBlob();
        if (!cancelled) setBlob(out);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [viewModel]);

  const url = useObjectUrl(blob);

  if (error) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
        <div className="font-medium">Preview failed</div>
        <pre className="whitespace-pre-wrap text-xs mt-2">{error}</pre>
      </div>
    );
  }

  return (
    <div className="w-full h-[80vh] rounded-xl overflow-hidden border">
      {busy && <div className="p-3 text-sm opacity-70">Rendering preview…</div>}
      {url ? (
        <iframe src={url} className="w-full h-full" title="PDF Preview" />
      ) : (
        <div className="p-3 text-sm opacity-70">Preparing preview…</div>
      )}
    </div>
  );
}
