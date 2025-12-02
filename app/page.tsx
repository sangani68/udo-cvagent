"use client";
export const runtime = "nodejs";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { CVJson } from "../lib/cvSchema";
import { migrateCvShape } from "../lib/cvSchema";

/* ─────────────────────────────────────────────────────────────
   Safe dynamic-import helper
   ───────────────────────────────────────────────────────────── */
function makeFallback(label: string) {
  const Fallback: React.FC<any> = () => null;
  Fallback.displayName = `Missing(${label})`;
  return Fallback;
}
function safeResolver(mod: any, label: string, candidates: string[]): any {
  for (const k of candidates) if (mod && typeof mod[k] === "function") return mod[k];
  if (mod && typeof mod.default === "function") return mod.default;
  return makeFallback(label);
}
function safeLoad(importer: () => Promise<any>, label: string, candidates: string[] = ["default"]) {
  return importer().then((m) => safeResolver(m, label, candidates));
}

/* ─────────────────────────────────────────────────────────────
   Components
   ───────────────────────────────────────────────────────────── */
const CVEditor = dynamic(
  () => safeLoad(() => import("./(components)/CVEditor"), "CVEditor", ["CVEditor", "default"]),
  { ssr: false }
);
const DocSearchPanel = dynamic(
  () => safeLoad(() => import("./(components)/DocSearchPanel"), "DocSearchPanel", ["DocSearchPanel", "default"]),
  { ssr: false }
);
const LanguagePicker = dynamic(
  () => safeLoad(() => import("./(components)/LanguagePicker"), "LanguagePicker", ["LanguagePicker", "default"])
);
const MaskingToggles = dynamic(
  () => safeLoad(() => import("./(components)/MaskingToggles"), "MaskingToggles", ["MaskingToggles", "default"])
);

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="animate-spin text-gray-500"
      aria-label="loading"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
        opacity="0.2"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Types & constants
   ───────────────────────────────────────────────────────────── */
type TemplateId = "pdf-kyndryl" | "pdf-europass" | "docx-ep" | "pptx-kyndryl-sm";
const DEFAULT_TEMPLATE: TemplateId = "pdf-kyndryl";
const TEMPLATE_META: Record<TemplateId, { kind: "pdf" | "docx" | "pptx"; label: string }> = {
  "pdf-kyndryl": { kind: "pdf", label: "Kyndryl PDF" },
  "pdf-europass": { kind: "pdf", label: "Europass PDF" },
  "docx-ep": { kind: "docx", label: "European Parliament DOCX" },
  "pptx-kyndryl-sm": { kind: "pptx", label: "Kyndryl SM PPTX" },
};

/* ─────────────────────────────────────────────────────────────
   Page
   ───────────────────────────────────────────────────────────── */
export default function Page() {
  const router = useRouter();

  // ── Simple client-side auth guard ──────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const flag = sessionStorage.getItem("cv-agent-auth");
    if (flag !== "1") {
      router.replace("/landing");
    }
  }, [router]);

  const [cv, setCv] = useState<CVJson | null>(null);
  const [template, setTemplate] = useState<TemplateId>(DEFAULT_TEMPLATE);
  const [locale, setLocale] = useState<string>("en");
  const [maskPersonal, setMaskPersonal] = useState<boolean>(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewCt, setPreviewCt] = useState<"pdf" | "html" | null>(null);

  const [busy, setBusy] = useState<boolean>(false);
  const urlRef = useRef<string | null>(null);

  // Cleanup preview object URL
  useEffect(() => {
    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, []);

  // Use this CV (from search)
  async function handleUseThisCV(payload: any) {
    try {
      setBusy(true);
      const res = await fetch("/api/convert-to-cvjson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        const msg = json?.error || `Failed to convert to CVJson (HTTP ${res.status})`;
        throw new Error(msg);
      }
      const maybe = json.cv ?? json.data ?? json.result ?? json;
      const rawOut: any =
        maybe && typeof maybe === "object" ? maybe.cv ?? maybe : maybe;
      const out = migrateCvShape(rawOut);
      if (!out?.candidate?.name)
        throw new Error("Server returned no CV data (missing candidate.name).");

      setCv(out as CVJson);
      setPreviewUrl(null);
      setPreviewCt(null);
    } catch (e: any) {
      console.error(e);
      alert(`Use this CV failed: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  // Preview: detect content-type → <embed> for PDF, <iframe> for HTML
  async function doPreview() {
    if (!cv) return alert("Load or edit a CV first.");
    try {
      setBusy(true);

      // Always send both cv + template; server will build view data (mask → normalize → translate)
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: cv,
          cv,
          template,
          templateId: template,
          locale,
          maskPersonal,
        }),
      });

      if (!res.ok) {
        let msg = "Preview failed";
        try {
          const j = await res.json();
          msg = j?.error || msg;
        } catch {}
        throw new Error(msg);
      }

      const makeUrl = (blob: Blob) => {
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setPreviewUrl(url);
      };

      // Force HTML path for DOCX/PPTX previews (EP DOCX specifically renders HTML snapshot)
      if (template === "docx-ep" || template === "pptx-kyndryl-sm") {
        const html = await res.text().catch(() => "");
        const page = html?.trim()
          ? html
          : fallbackHtml("No HTML from server", cv, template);
        makeUrl(new Blob([page], { type: "text/html" }));
        setPreviewCt("html");
        return;
      }

      // PDF path (Kyndryl/Europass)
      const ct = (res.headers.get("Content-Type") || "").toLowerCase();
      if (ct.includes("application/pdf") || ct.includes("octet-stream")) {
        const blob = await res.blob();
        if (!blob || blob.size === 0) {
          const fb = new Blob(
            [fallbackHtml("Empty PDF from server", cv, template)],
            { type: "text/html" }
          );
          makeUrl(fb);
          setPreviewCt("html");
          return;
        }
        makeUrl(blob);
        setPreviewCt("pdf");
        return;
      }

      // Fallback: treat as HTML
      const html = await res.text().catch(() => "");
      const page = html?.trim()
        ? html
        : fallbackHtml("No HTML from server", cv, template);
      makeUrl(new Blob([page], { type: "text/html" }));
      setPreviewCt("html");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  // Export
  async function doExport() {
    if (!cv) return alert("Load or edit a CV first.");
    try {
      setBusy(true);

      const { kind } = TEMPLATE_META[template]; // "pdf" | "docx" | "pptx"
      const route = `/api/export/${kind}`; // /api/export/docx for EP

      const res = await fetch(route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: cv,
          cv,
          template,
          templateId: template,
          locale,
          maskPersonal,
        }),
      });

      if (!res.ok) {
        let msg = "Export failed";
        try {
          const j = await res.json();
          msg = j?.error || msg;
        } catch {}
        throw new Error(msg);
      }

      const blob = await res.blob();

      // Try to use filename from server; else fallback
      const cd = res.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="?([^"]+)"?/i);
      const fallbackName = `export_${template}.${kind}`;
      const filename = m?.[1] || fallbackName;

      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">CV Agent</h1>
        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border bg-white px-3 py-2 text-sm"
            value={template}
            onChange={(e) => setTemplate(e.target.value as TemplateId)}
            disabled={busy}
          >
            {Object.entries(TEMPLATE_META).map(([id, meta]) => (
              <option key={id} value={id}>
                {meta.label}
              </option>
            ))}
          </select>
          {/* Relax typing for dynamic component props */}
          <LanguagePicker
            {...({ value: locale, onChange: setLocale } as any)}
          />
          <MaskingToggles
            {...({ value: maskPersonal, onChange: setMaskPersonal } as any)}
          />
          <button
            onClick={doPreview}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-60"
            disabled={busy}
          >
            {busy ? "Working…" : "Preview"}
          </button>
          <button
            onClick={doExport}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
            disabled={busy}
          >
            Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Left: Search + Editor */}
        <div className="flex min-h-[70vh] flex-col gap-4">
          <DocSearchPanel {...({ onSelect: handleUseThisCV } as any)} />
          <div className="rounded-xl border p-3">
            <div className="mb-2 text-sm font-medium">
              Editor{" "}
              {cv?.candidate?.name ? (
                <span className="ml-2 text-gray-500">
                  — Loaded: {cv.candidate.name}
                </span>
              ) : null}
            </div>
            <CVEditor {...({ value: cv, onChange: setCv } as any)} />
          </div>
        </div>

        {/* Right: Preview */}
        <div className="min-h-[70vh] rounded-xl border p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium">
              Preview{" "}
              {previewCt ? (
                <span className="ml-1 text-gray-500">({previewCt})</span>
              ) : null}
            </div>
            {busy && <Spinner />}
          </div>

          {previewUrl ? (
            previewCt === "pdf" ? (
              <embed
                src={previewUrl}
                type="application/pdf"
                className="h-[70vh] w-full rounded-lg border"
              />
            ) : (
              <iframe
                src={previewUrl}
                className="h-[70vh] w-full rounded-lg border"
              />
            )
          ) : (
            <div className="grid h-[70vh] place-items-center rounded-lg bg-gray-50 text-gray-500">
              Click{" "}
              <span className="mx-1 rounded bg-black px-2 py-1 text-white">
                Preview
              </span>{" "}
              to render
            </div>
          )}
        </div>
      </div>
    </div>
  );

  function fallbackHtml(note: string, cv: CVJson, templateId: string) {
    const esc = (s: string) =>
      s.replace(/[&<>"]/g, (c) =>
        c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"
      );
    return `<!doctype html><meta charset="utf-8"><style>body{font-family:ui-sans-serif,system-ui;padding:24px}pre{background:#f6f8fa;padding:12px;border:1px solid #e5e7eb;border-radius:8px;white-space:pre-wrap}</style><h1>Preview (${templateId})</h1><p>${esc(
      note
    )}</p><pre>${esc(JSON.stringify(cv, null, 2))}</pre>`;
  }
}
