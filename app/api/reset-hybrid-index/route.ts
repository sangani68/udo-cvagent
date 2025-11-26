// app/api/reset-hybrid-index/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// REST API version that supports vector profiles + `dimensions` + `vectorQueries`
const APIv = "2024-07-01";

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing`);
  return v;
}

async function del(path: string) {
  const endpoint = must("AZURE_SEARCH_ENDPOINT").replace(/\/+$/, "");
  const key = must("AZURE_SEARCH_KEY");
  const url = `${endpoint}${path}?api-version=${APIv}`;
  const res = await fetch(url, { method: "DELETE", headers: { "api-key": key } });
  if (res.status === 404) return;
  if (!res.ok) throw new Error(`DELETE ${path} ${res.status}: ${await res.text()}`);
}

async function put(path: string, body: any) {
  const endpoint = must("AZURE_SEARCH_ENDPOINT").replace(/\/+$/, "");
  const key = must("AZURE_SEARCH_KEY");
  const url = `${endpoint}${path}?api-version=${APIv}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path} ${res.status}: ${await res.text()}`);
  return res.json().catch(() => ({}));
}

export async function POST() {
  try {
    const hybridIndex = process.env.AZURE_SEARCH_HYBRID_INDEX || "cvkb";

    // Drop old
    await del(`/indexes/${hybridIndex}`);

    // Recreate with schema that matches lib/search.ts (hybridSearch)
    const body = {
      name: hybridIndex,
      fields: [
        // Key + basic identity
        { name: "id", type: "Edm.String", key: true, filterable: true, sortable: true },
        { name: "name", type: "Edm.String", searchable: true },
        { name: "role", type: "Edm.String", searchable: true },
        { name: "language", type: "Edm.String", searchable: true, filterable: true, facetable: true },

        // Skills collection
        { name: "skills", type: "Collection(Edm.String)", searchable: true, filterable: true, facetable: true },

        // URL + template metadata
        { name: "url", type: "Edm.String", filterable: true },
        { name: "template", type: "Edm.String", filterable: true, facetable: true },

        // Large content – searchable only (no faceting/filtering to avoid term-size issues)
        { name: "content", type: "Edm.String", searchable: true },

        // Two date fields: `updatedAt` used by scoring profile, and `date` kept for compatibility
        { name: "updatedAt", type: "Edm.DateTimeOffset", filterable: true, sortable: true },
        { name: "date", type: "Edm.DateTimeOffset", filterable: true, sortable: true },

        // Vector field (OpenAI text-embedding-3-large: 3072 dims)
        {
          name: "contentVector",
          type: "Collection(Edm.Single)",
          searchable: true,
          retrievable: false,
          dimensions: 3072,
          vectorSearchProfile: "v1-hnsw",
        },
      ],

      vectorSearch: {
        algorithms: [
          {
            name: "hnsw-1",
            kind: "hnsw",
            hnswParameters: { m: 4, efConstruction: 400, efSearch: 200, metric: "cosine" },
          },
          {
            name: "eknn",
            kind: "exhaustiveKnn",
            exhaustiveKnnParameters: { metric: "cosine" },
          },
        ],
        profiles: [
          { name: "v1-hnsw", algorithm: "hnsw-1" },
          { name: "exact", algorithm: "eknn" },
        ],
      },

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

    const created = await put(`/indexes/${hybridIndex}`, body);
    return NextResponse.json({ ok: true, index: created?.name || hybridIndex, note: "Hybrid index reset" });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
