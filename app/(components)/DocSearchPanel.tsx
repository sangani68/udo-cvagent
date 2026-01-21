"use client";

import React from "react";

type Result = {
  id?: string;
  name?: string;
  url?: string;
  metadata_storage_path?: string;
  metadata_storage_name?: string;
  updatedAt?: string;
  content?: string;
};

type Props = {
  onSelect: (payload: any) => void;
  refreshKey?: number;
  autoQuery?: string;
};

export default function DocSearchPanel({ onSelect, refreshKey, autoQuery }: Props) {
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [results, setResults] = React.useState<Result[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  async function doSearch(qOverride?: string) {
    try {
      setBusy(true);
      setErr(null);
      setResults([]);
      const query = typeof qOverride === "string" ? qOverride : q;
      if (typeof qOverride === "string") setQ(qOverride);
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: query }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Search failed (${res.status})`);
      setResults((json?.results || json?.value || []) as Result[]);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  React.useEffect(() => {
    if (typeof refreshKey !== "number") return;
    const query = autoQuery ?? q;
    if (!query && results.length === 0) return;
    doSearch(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  function buildPayload(item: Result) {
    const name = item.name || item.metadata_storage_name || item.id || "document";

    // Prefer indexed full text when present
    if (typeof item.content === "string" && item.content.trim()) {
      return { item: { content: item.content }, filename: name };
    }

    // Otherwise send a URL the API can fetch:
    // - absolute http(s) → OK
    // - app-relative (served from /public) → OK
    const u = item.url || item.metadata_storage_path || "";
    if (typeof u === "string" && u.trim()) {
      const usable = /^https?:\/\//i.test(u) ? u : (u.startsWith("/") ? u : `/${u}`);
      return { url: usable, filename: name };
    }

    // Last resort: send whole item (API will error with details if unusable)
    return { item, filename: name };
  }

  function formatUpdated(value?: string) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  return (
    <div className="rounded-xl border p-3">
      <div className="mb-2 text-sm font-medium">Search</div>
      <div className="flex gap-2">
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="Search people / skills / keywords…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }}
        />
        <button
          onClick={doSearch}
          disabled={busy}
          className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-60"
        >
          {busy ? "Searching…" : "Search"}
        </button>
      </div>

      {err && <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{err}</div>}

      {!!results.length && (
        <div className="mt-3 divide-y rounded border">
          {results.map((r, i) => {
            const name = r.name || r.metadata_storage_name || r.id || `item-${i}`;
            const path = r.url || r.metadata_storage_path || r.metadata_storage_name || "";
            const updated =
              (r as any).updatedAt ||
              (r as any).metadata_storage_last_modified ||
              (r as any).fields?.updatedAt ||
              "";
            const updatedLabel = formatUpdated(updated);
            return (
              <div key={i} className="flex items-center justify-between gap-3 p-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{name}</div>
                  <div className="truncate text-xs text-gray-500">{String(path)}</div>
                  {updatedLabel ? (
                    <div className="truncate text-[11px] text-gray-500">
                      Created: {updatedLabel}
                    </div>
                  ) : null}
                </div>
                <button
                  onClick={() => onSelect(buildPayload(r))}
                  className="whitespace-nowrap rounded border px-2 py-1 text-xs hover:bg-gray-50"
                >
                  Use this CV
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
