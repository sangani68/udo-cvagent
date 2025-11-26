// lib/azure.ts
import { BlobServiceClient } from "@azure/storage-blob";

/* ========================== Blob helpers ========================== */
export function getBlobService() {
  const conn =
    process.env.AZURE_STORAGE_CONNECTION_STRING ||
    process.env.AZURE_STORAGE_CONN_STRING;
  if (!conn) throw new Error("AZURE_STORAGE_CONNECTION_STRING missing");
  return BlobServiceClient.fromConnectionString(conn);
}
export function getContainerName() {
  return process.env.AZURE_STORAGE_CONTAINER || "cvkb";
}
export async function uploadToCvkb(path: string, buf: Buffer, contentType?: string) {
  const svc = getBlobService();
  const container = svc.getContainerClient(getContainerName());
  await container.createIfNotExists();
  const blob = container.getBlockBlobClient(path.replace(/^\/+/, ""));
  await blob.uploadData(buf, {
    blobHTTPHeaders: contentType ? { blobContentType: contentType } : undefined,
  });
  return {
    path: blob.name,
    url: `https://${svc.accountName}.blob.core.windows.net/${container.containerName}/${blob.name}`,
  };
}

/* ========================== Search helpers ========================== */
function getSearchBase() {
  const service = process.env.AZURE_SEARCH_SERVICE;
  if (!service) throw new Error("AZURE_SEARCH_SERVICE missing");
  const apiVersion = process.env.AZURE_SEARCH_API_VERSION || "2024-07-01";
  return { base: `https://${service}.search.windows.net`, apiVersion };
}
async function getIndexDefinition(index: string) {
  const { base, apiVersion } = getSearchBase();
  const res = await fetch(`${base}/indexes/${index}?api-version=${apiVersion}`, {
    headers: { "api-key": process.env.AZURE_SEARCH_API_KEY! },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}
/** Find the first field that looks like a vector field in the given index definition. */
function findVectorFieldName(indexDef: any): string | undefined {
  const fields: any[] = indexDef?.fields || [];
  // 2024-07-01 exposes vector fields with these props:
  // - vectorSearchDimensions
  // - vectorSearchProfileName (sometimes vectorSearchProfile)
  for (const f of fields) {
    if (typeof f?.vectorSearchDimensions === "number") return f?.name;
    if (f?.vectorSearchProfileName || f?.vectorSearchProfile) return f?.name;
  }
  // Some older definitions use a convention field name:
  const maybe = fields.find((f) => /vector/i.test(f?.name || ""));
  return maybe?.name;
}

/** Normalizes a doc into a result the UI understands. */
function normalizeDoc(d: any) {
  return {
    id: d?.id ?? d?.documentId ?? d?.key ?? d?._id,
    name: d?.name ?? d?.title ?? d?.candidate?.name ?? d?.fields?.name,
    role: d?.role ?? d?.fields?.role,
    url: d?.url ?? d?.metadata_storage_path ?? d?.fields?.url,
    content: d?.content ?? d?.documentText,
    fields: d,
    "@search.score": d?.["@search.score"],
  };
}

/** Resilient search: vector+keyword when safe, else keyword, else last-resort GET. */
export async function searchCvIndex(q: string) {
  const apiKey = process.env.AZURE_SEARCH_API_KEY!;
  const index = process.env.AZURE_SEARCH_INDEX || "cvkb";
  const { base, apiVersion } = getSearchBase();
  const query = (q || "").trim() || "*";

  // 1) introspect index to detect vector field (skip vector if not found)
  let vectorField: string | undefined;
  try {
    const def = await getIndexDefinition(index);
    vectorField = findVectorFieldName(def);
  } catch {
    vectorField = undefined;
  }

  // 2) try to get an embedding if we have a vector field
  let embedding: number[] | undefined = undefined;
  if (vectorField) {
    try {
      embedding = await getEmbedding(query);
    } catch {
      embedding = undefined;
    }
  }

  // 3) build bodies
  const keywordBody: any = {
    search: query,
    searchMode: "any",
    top: 20,
    // keep select minimal/portable; UI will read from returned doc anyway
    queryType: "simple",
  };

  // 4) try hybrid first (only if we have both vector field + embedding)
  if (vectorField && embedding && Array.isArray(embedding)) {
    const hybridBody = {
      ...keywordBody,
      vectorQueries: [
        {
          kind: "vector",
          k: 20, // Azure 2024-07-01 uses "k"
          fields: vectorField,
          vector: embedding,
        },
      ],
    };

    const r1 = await fetch(`${base}/indexes/${index}/docs/search?api-version=${apiVersion}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify(hybridBody),
    });

    if (r1.ok) {
      const json = await r1.json();
      const arr = Array.isArray(json?.value) ? json.value : [];
      return { results: arr.map(normalizeDoc) };
    } else {
      // continue to keyword fallback
      const t = await r1.text().catch(() => "");
      console.warn("[searchCvIndex] hybrid failed -> keyword fallback:", r1.status, t);
    }
  }

  // 5) keyword-only POST
  const r2 = await fetch(`${base}/indexes/${index}/docs/search?api-version=${apiVersion}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify(keywordBody),
  });
  if (r2.ok) {
    const json = await r2.json();
    const arr = Array.isArray(json?.value) ? json.value : [];
    return { results: arr.map(normalizeDoc) };
  }

  // 6) last-resort GET (very simple querystring style)
  const r3 = await fetch(
    `${base}/indexes/${index}/docs?api-version=${apiVersion}&search=${encodeURIComponent(query)}&$top=20`,
    { headers: { "api-key": apiKey } }
  );
  if (r3.ok) {
    const json = await r3.json();
    const arr = Array.isArray(json?.value) ? json.value : [];
    return { results: arr.map(normalizeDoc), warning: "Keyword GET fallback used." };
  }

  // 7) if everything failed, return a soft warning instead of throwing
  const msg =
    (await r2.text().catch(() => "")) ||
    (await r3.text().catch(() => "")) ||
    "Search failed.";
  return { results: [], warning: msg };
}

/* ========================== Embeddings & Chat ========================== */
export async function getEmbedding(text: string): Promise<number[] | undefined> {
  try {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT!;
    const key = process.env.AZURE_OPENAI_API_KEY!;
    const deployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT!;
    const dims = Number(process.env.AZURE_OPENAI_EMBEDDING_DIMENSIONS || "3072");

    const r = await fetch(`${endpoint}/openai/deployments/${deployment}/embeddings?api-version=2024-06-01`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": key },
      body: JSON.stringify({ input: text, dimensions: dims }),
    });
    if (!r.ok) return undefined;
    const j = await r.json();
    const v = j?.data?.[0]?.embedding;
    return Array.isArray(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

export async function chatJson(prompt: string, jsonSchemaHint?: string) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT!;
  const key = process.env.AZURE_OPENAI_API_KEY!;
  const deployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT!;

  const sys = [
    "You are a helpful assistant that returns strictly JSON when asked.",
    jsonSchemaHint || "",
  ].filter(Boolean).join("\n");

  const r = await fetch(`${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-06-01`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": key },
    body: JSON.stringify({
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        { role: "user", content: prompt },
      ],
    }),
  });
  const j = await r.json();
  return j?.choices?.[0]?.message?.content;
}
