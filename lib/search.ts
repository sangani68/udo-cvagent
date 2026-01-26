// lib/search.ts
import crypto from "node:crypto";
import type { Dispatcher } from "undici";
import { Agent as UndiciAgent } from "undici";

/** ---------- Public types ---------- */
export type SearchDoc = {
  id: string;
  name?: string;
  role?: string;
  language?: string;
  skills?: string[];
  url?: string;
  content?: string;
  updatedAt?: string;      // ISO
  contentVector?: number[];
};

/** ---------- Env wiring (robust) ---------- */
export const indexName = process.env.AZURE_SEARCH_INDEX || "cvkb";

const API_VERSION = process.env.AZURE_SEARCH_API_VERSION || "2024-07-01";
const VECTOR_DIM = Number(
  process.env.AZURE_OPENAI_EMBEDDING_DIMENSIONS ||
  process.env.VECTOR_DIMENSIONS ||
  3072 // text-embedding-3-large
);

function getEndpoint(): string {
  const endpoint =
    process.env.AZURE_SEARCH_ENDPOINT ||
    (process.env.AZURE_SEARCH_SERVICE
      ? `https://${process.env.AZURE_SEARCH_SERVICE}.search.windows.net`
      : "");
  if (!endpoint) throw new Error("AZURE_SEARCH_ENDPOINT or AZURE_SEARCH_SERVICE is required");
  return endpoint;
}

function getKey(): string {
  const key = process.env.AZURE_SEARCH_KEY || process.env.AZURE_SEARCH_API_KEY || "";
  if (!key) throw new Error("AZURE_SEARCH_KEY or AZURE_SEARCH_API_KEY is required");
  return key;
}

function searchHeaders() {
  return { "Content-Type": "application/json", "api-key": getKey() };
}

/** ---------- TLS helper (corporate/self-signed certs) ---------- */
const dispatcher: Dispatcher | undefined =
  process.env.ALLOW_SELF_SIGNED === "1"
    ? new UndiciAgent({ connect: { rejectUnauthorized: false } })
    : undefined;

function fx(url: string, init: RequestInit = {}) {
  return fetch(url, dispatcher ? { ...init, // @ts-expect-error: undici option
    dispatcher } : init);
}

/** ---------- Small helpers ---------- */
export function randomId(prefix = "cv") {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

function expandQuery(q: string) {
  const s = (q || "").trim();
  if (!s) return s;
  const adds: string[] = [];
  if (/project\s?manager|pm\b/i.test(s)) adds.push('"program manager"', "PRINCE2", "Agile");
  if (/security|cissp|cism|soc|zero trust/i.test(s)) adds.push("CISSP", "CISM", "Zero Trust");
  if (/mq|middleware|ibm/i.test(s)) adds.push("IBM MQ", "middleware");
  return Array.from(new Set([s, ...adds])).join(" ");
}

function groupByNamePreferNewest(docs: SearchDoc[]) {
  const map = new Map<string, SearchDoc>();
  for (const d of docs) {
    const key = (d.name || d.id || "").toLowerCase();
    if (!map.has(key)) { map.set(key, d); continue; }
    const prev = map.get(key)!;
    const pa = Date.parse(prev.updatedAt || "1970-01-01");
    const pb = Date.parse(d.updatedAt || "1970-01-01");
    if (pb > pa) map.set(key, d);
  }
  return Array.from(map.values()).sort((a, b) => {
    const pa = Date.parse(a.updatedAt || "1970-01-01");
    const pb = Date.parse(b.updatedAt || "1970-01-01");
    return pb - pa;
  });
}

/** ---------- Admin: drop / create / indexer ---------- */
export async function dropIndex(opts: { dropIndexer?: boolean; dropDataSource?: boolean } = {}) {
  const { dropIndexer = true, dropDataSource = true } = opts;
  const endpoint = getEndpoint();
  const dels: Promise<any>[] = [
    fx(`${endpoint}/indexes/${indexName}?api-version=${API_VERSION}`, {
      method: "DELETE", headers: searchHeaders(),
    }),
  ];
  if (dropIndexer) {
    dels.push(fx(`${endpoint}/indexers/${indexName}-blob-indexer?api-version=${API_VERSION}`, {
      method: "DELETE", headers: searchHeaders(),
    }));
  }
  if (dropDataSource) {
    dels.push(fx(`${endpoint}/datasources/${indexName}-blob-ds?api-version=${API_VERSION}`, {
      method: "DELETE", headers: searchHeaders(),
    }));
  }
  await Promise.all(dels);
  return { ok: true };
}

export async function createHybridIndex() {
  const endpoint = getEndpoint();

  const body = {
    name: indexName,
    fields: [
      { name: "id", type: "Edm.String", key: true, filterable: true },
      { name: "name", type: "Edm.String", searchable: true },
      { name: "role", type: "Edm.String", searchable: true },
      { name: "language", type: "Edm.String", searchable: true, filterable: true, facetable: true },
      { name: "skills", type: "Collection(Edm.String)", searchable: true, filterable: true, facetable: true },
      { name: "url", type: "Edm.String", filterable: true },

      // Keep large text NOT filterable/facetable
      { name: "content", type: "Edm.String", searchable: true },

      // Freshness requires DateTimeOffset
      { name: "updatedAt", type: "Edm.DateTimeOffset", filterable: true, sortable: true },

      // Vector field (2024-07-01 syntax)
      {
        name: "contentVector",
        type: "Collection(Edm.Single)",
        searchable: true,
        dimensions: VECTOR_DIM,
        vectorSearchProfile: "v1-hnsw",
        retrievable: false,
        stored: false,
      },
    ],

    semantic: {
      configurations: [
        {
          name: "semantic-cv",
          prioritizedFields: {
            titleField: { fieldName: "name" },
            prioritizedContentFields: [
              { fieldName: "content" },
              { fieldName: "role" },
              { fieldName: "skills" },
            ],
            prioritizedKeywordsFields: [
              { fieldName: "skills" },
              { fieldName: "role" },
            ],
          },
        },
      ],
    },

    vectorSearch: {
      algorithms: [
        { name: "hnsw-1", kind: "hnsw", hnswParameters: { m: 4, efConstruction: 400, efSearch: 200, metric: "cosine" } },
        { name: "eknn",  kind: "exhaustiveKnn", exhaustiveKnnParameters: { metric: "cosine" } },
      ],
      profiles: [
        { name: "v1-hnsw", algorithm: "hnsw-1" },
        { name: "exact",  algorithm: "eknn" },
      ],
    },

    scoringProfiles: [
      {
        name: "recency",
        text: { weights: { content: 4, role: 2, skills: 1 } },
        functions: [
          {
            type: "freshness",
            fieldName: "updatedAt",
            boost: 1.2,
            interpolation: "linear",
            freshness: { boostingDuration: "P180D" },
          },
        ],
      },
    ],

    similarity: { "@odata.type": "#Microsoft.Azure.Search.BM25Similarity" },
  };

  const res = await fx(`${endpoint}/indexes?api-version=${API_VERSION}`, {
    method: "POST", headers: searchHeaders(), body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Create index failed: ${await res.text()}`);
  return { ok: true, index: indexName };
}

export async function setupBlobDataSourceAndIndexer() {
  const endpoint = getEndpoint();

  const dsName = `${indexName}-blob-ds`;
  const indexerName = `${indexName}-blob-indexer`;

  // ---- Resolve storage credentials (supports multiple styles) ----
  const container = process.env.AZURE_STORAGE_CONTAINER || "cvkb";
  const account = process.env.AZURE_STORAGE_ACCOUNT || "";
  const accountKey = process.env.AZURE_STORAGE_KEY || "";
  const blobEndpoint = process.env.AZURE_BLOB_ENDPOINT || (account ? `https://${account}.blob.core.windows.net` : "");
  const accountSas = (process.env.AZURE_STORAGE_SAS || "").trim(); // ?sv=...
  const containerSasUrl = (process.env.AZURE_STORAGE_CONTAINER_SAS_URL || "").trim(); // full URL
  const resourceId = (process.env.AZURE_STORAGE_RESOURCE_ID || "").trim(); // for managed identity
  const explicitConnString = (process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.AZURE_STORAGE_CONN_STRING || "").trim();

  let connectionString = "";
  if (containerSasUrl) {
    connectionString = `ContainerSharedAccessUri=${containerSasUrl}`;
  } else if (accountSas && blobEndpoint) {
    const sasNoQ = accountSas.startsWith("?") ? accountSas.slice(1) : accountSas;
    connectionString = `BlobEndpoint=${blobEndpoint};SharedAccessSignature=${sasNoQ}`;
  } else if (account && accountKey) {
    connectionString = `DefaultEndpointsProtocol=https;AccountName=${account};AccountKey=${accountKey};EndpointSuffix=core.windows.net`;
  } else if (explicitConnString) {
    connectionString = explicitConnString;
  } else if (resourceId) {
    connectionString = `ResourceId=${resourceId}`;
  } else {
    throw new Error(
      "Storage credentials missing. Provide one of: AZURE_STORAGE_CONTAINER_SAS_URL, OR AZURE_STORAGE_SAS (+ AZURE_BLOB_ENDPOINT/AZURE_STORAGE_ACCOUNT), OR AZURE_STORAGE_ACCOUNT+AZURE_STORAGE_KEY, OR AZURE_STORAGE_CONNECTION_STRING, OR AZURE_STORAGE_RESOURCE_ID."
    );
  }

  // ---- Create data source ----
  {
    const dsBody = {
      name: dsName,
      type: "azureblob",
      credentials: { connectionString },
      container: { name: container },
    };
    const r = await fx(`${endpoint}/datasources?api-version=${API_VERSION}`, {
      method: "POST", headers: searchHeaders(), body: JSON.stringify(dsBody),
    });
    if (!r.ok && r.status !== 409) throw new Error(`Create datasource failed: ${await r.text()}`);
  }

  // ---- Create indexer (wider file types + tolerant) ----
  {
    const idxBody = {
      name: indexerName,
      dataSourceName: dsName,
      targetIndexName: indexName,
      schedule: { interval: "PT30M", startTime: new Date().toISOString() }, // optional
      parameters: {
        maxFailedItems: -1,
        maxFailedItemsPerBatch: -1,
        configuration: {
          parsingMode: "default",
          indexedFileNameExtensions: ".pdf,.doc,.docx,.ppt,.pptx,.txt,.md",
        },
      },
      fieldMappings: [
        { sourceFieldName: "metadata_storage_path", targetFieldName: "url" },
        { sourceFieldName: "metadata_storage_name", targetFieldName: "name" },
        { sourceFieldName: "metadata_storage_last_modified", targetFieldName: "updatedAt" }, // DateTimeOffset
      ],
    };
    const r = await fx(`${endpoint}/indexers?api-version=${API_VERSION}`, {
      method: "POST", headers: searchHeaders(), body: JSON.stringify(idxBody),
    });
    if (!r.ok && r.status !== 409) throw new Error(`Create indexer failed: ${await r.text()}`);
  }

  return { ok: true, ds: dsName, indexer: indexerName };
}

export async function runIndexer() {
  const endpoint = getEndpoint();
  const name = `${indexName}-blob-indexer`;
  const r = await fx(`${endpoint}/indexers/${name}/run?api-version=${API_VERSION}`, {
    method: "POST", headers: searchHeaders(),
  });
  if (!r.ok) throw new Error(`Run indexer failed: ${await r.text()}`);
  return { ok: true, ran: name };
}

/** ---------- Query (hybrid) ---------- */
export async function hybridSearch(
  q: string,
  opts: { top?: number; vector?: number[]; language?: "en" | "fr" | "de" | "nl" } = {}
) {
  const endpoint = getEndpoint();
  const top = opts.top ?? 20;

  const query = (q ?? "").trim();
  const body: any = {
    search: query ? expandQuery(q) : "*",
    top,
    scoringProfile: "recency",
    select: "id,name,role,language,skills,url,content,updatedAt",
  };

  // Semantic only when we actually have a query string (Azure rejects '*' with semantic)
  if (query) {
    body.queryType = "semantic";
    body.semanticConfiguration = "semantic-cv";
    body.captions = "extractive|highlight-false";
    body.answers = "extractive|count-1";

    // Only include queryLanguage on API versions that support it (>= 2024-11-01*)
    const v = process.env.AZURE_SEARCH_API_VERSION || "2024-07-01";
    if (v.localeCompare("2024-11-01", "en", { numeric: true }) >= 0 && opts.language) {
      body.queryLanguage = ({ en: "en-us", fr: "fr-fr", de: "de-de", nl: "nl-nl" } as const)[opts.language] || "en-us";
    }
  }

  if (opts.vector && Array.isArray(opts.vector)) {
    body.vectorQueries = [
      {
        kind: "vector",
        vector: opts.vector,
        fields: "contentVector",
        k: Math.min(top, 50),
      },
    ];
  }

  const res = await fx(`${endpoint}/indexes/${indexName}/docs/search?api-version=${API_VERSION}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": getKey() },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Search failed (${res.status}): ${text || "unknown error"}`);
  }
  const json = await res.json();
  const rows = (json?.value || []) as SearchDoc[];
  return { raw: json, results: groupByNamePreferNewest(rows) };
}
