// app/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CVJson } from "../lib/cvSchema";
import { migrateCvShape } from "../lib/cvSchema";

// ─────────────────────────────────────────────────────────────
// Static component imports (no dynamic import)
// ─────────────────────────────────────────────────────────────
import CVEditor from "./(components)/CVEditor";
import DocSearchPanel from "./(components)/DocSearchPanel";
import LanguagePicker from "./(components)/LanguagePicker";
import MaskingToggles from "./(components)/MaskingToggles";
import type { MaskPolicy } from "../lib/mask";
import UploadPanel from "./(components)/UploadPanel";

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
type TemplateId =
  | "pdf-kyndryl"
  | "pdf-europass"
  | "pdf-europass2"
  | "docx-ep"
  | "docx-kyndryl"
  | "docx-europass"
  | "docx-europass2"
  | "pptx-kyndryl-sm";

const DEFAULT_TEMPLATE: TemplateId = "pdf-kyndryl";

const TEMPLATE_META: Record<
  TemplateId,
  { kind: "pdf" | "docx" | "pptx"; label: string }
> = {
  "pdf-kyndryl": { kind: "pdf", label: "Kyndryl PDF" },
  "pdf-europass": { kind: "pdf", label: "Europass PDF" },
  "pdf-europass2": { kind: "pdf", label: "Europass 2 PDF" },
  "docx-ep": { kind: "docx", label: "European Parliament DOCX" },
  "docx-kyndryl": { kind: "docx", label: "Kyndryl DOCX" },
  "docx-europass": { kind: "docx", label: "Europass DOCX" },
  "docx-europass2": { kind: "docx", label: "Europass 2 DOCX" },
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
  const [maskPolicy, setMaskPolicy] = useState<MaskPolicy>({
    email: false,
    phone: false,
    location: false,
  });

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewCt, setPreviewCt] = useState<"pdf" | "html" | null>(null);

  const [busy, setBusy] = useState<boolean>(false);
  const urlRef = useRef<string | null>(null);
  const [searchRefresh, setSearchRefresh] = useState<number>(0);
  const [searchAutoQuery, setSearchAutoQuery] = useState<string>("");

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
        const msg =
          json?.error || `Failed to convert to CVJson (HTTP ${res.status})`;
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

  // Use this CV (from upload)
  async function handleUploadCv(raw: any) {
    try {
      setBusy(true);
      const maybe = raw?.cv ?? raw?.data ?? raw?.result ?? raw;
      const out = migrateCvShape(maybe);
      if (!out?.candidate?.name)
        throw new Error("Server returned no CV data (missing candidate.name).");
      setCv(out as CVJson);
      setPreviewUrl(null);
      setPreviewCt(null);
    } catch (e: any) {
      console.error(e);
      alert(`Upload failed: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }
  // Preview
  async function doPreview() {
    if (!cv) return alert("Load or edit a CV first.");
    try {
      setBusy(true);

      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: cv,
          cv,
          template,
          templateId: template,
          locale,
          maskPolicy,
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

      // Force HTML path for DOCX/PPTX previews
      if (
        template === "docx-ep" ||
        template === "docx-kyndryl" ||
        template === "docx-europass" ||
        template === "docx-europass2" ||
        template === "pptx-kyndryl-sm"
      ) {
        const html = await res.text().catch(() => "");
        const page = html?.trim()
          ? html
          : fallbackHtml("No HTML from server", cv, template);
        makeUrl(new Blob([page], { type: "text/html" }));
        setPreviewCt("html");
        return;
      }

      // PDF path
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

      const { kind } = TEMPLATE_META[template];
      const route = `/api/export/${kind}`;

      const res = await fetch(route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: cv,
          cv,
          template,
          templateId: template,
          locale,
          maskPolicy,
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
      const candidateName = cv?.candidate?.name || "";
      setSearchAutoQuery(candidateName);
      setSearchRefresh((v) => v + 1);
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
          <LanguagePicker
            {...({ value: locale, onChange: setLocale } as any)}
          />
          <MaskingToggles
            {...({ value: maskPolicy, onChange: setMaskPolicy } as any)}
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
          <UploadPanel onLoaded={handleUploadCv} />
          <DocSearchPanel
            {...({
              onSelect: handleUseThisCV,
              refreshKey: searchRefresh,
              autoQuery: searchAutoQuery,
            } as any)}
          />
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
