// app/api/blob/run-and-wait/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const APIv = "2024-07-01";

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing`);
  return v;
}

async function sreq(method: "GET" | "POST", path: string, body?: any) {
  const endpoint = must("AZURE_SEARCH_ENDPOINT").replace(/\/+$/, "");
  const key = must("AZURE_SEARCH_KEY");
  const url = `${endpoint}${path}?api-version=${APIv}`;
  const res = await fetch(url, {
    method,
    headers: { "api-key": key, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} ${res.status}: ${await res.text()}`);
  return res.json().catch(() => ({}));
}

async function countDocs(indexName: string) {
  const j = await sreq("POST", `/indexes/${indexName}/docs/search`, {
    search: "*",
    count: true,
    top: 0,
  });
  return j?.["@odata.count"] ?? 0;
}

function isRunning(statusObj: any) {
  // Defensive checks across fields the API returns
  return (
    statusObj?.lastResult?.status === "inProgress" ||
    statusObj?.status === "inProgress" ||
    statusObj?.executionHistory?.[0]?.status === "inProgress"
  );
}

export async function POST(request: NextRequest) {
  try {
    const blobIndex = process.env.AZURE_SEARCH_BLOB_INDEX || "cvkb-blob";
    const searchParams = new URL(request.url).searchParams;
    const timeoutSec = Math.max(30, Math.min(1800, Number(searchParams.get("timeout")) || 600));
    const pollMs = Math.max(1000, Math.min(10000, Number(searchParams.get("interval")) || 5000));
    const forceStart = searchParams.get("forceStart") === "1"; // optional escape hatch

    const startedAt = Date.now();

    // Check current status first
    let status = await sreq("GET", `/indexers/${blobIndex}-indexer/status`);
    let alreadyRunning = isRunning(status);

    // Only start a new run if not already running (or if explicitly forced)
    if (!alreadyRunning || forceStart) {
      try {
        await sreq("POST", `/indexers/${blobIndex}-indexer/run`);
        alreadyRunning = false; // we just started a fresh run
        status = await sreq("GET", `/indexers/${blobIndex}-indexer/status`);
      } catch (e: any) {
        // If it's a 409 (already running), just fall through to polling
        if (!String(e?.message || "").includes(" 409: ")) throw e;
        alreadyRunning = true;
      }
    }

    // Poll until not in progress or timeout
    while (isRunning(status)) {
      if (Date.now() - startedAt > timeoutSec * 1000) break;
      await new Promise((r) => setTimeout(r, pollMs));
      status = await sreq("GET", `/indexers/${blobIndex}-indexer/status`);
    }

    const docs = await countDocs(blobIndex);

    return NextResponse.json({
      ok: true,
      blobIndex,
      docs,
      lastResult: status?.lastResult || null,
      recentHistory: status?.executionHistory?.slice?.(0, 3) || [],
      alreadyRunning,
      waitedMs: Date.now() - startedAt,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
