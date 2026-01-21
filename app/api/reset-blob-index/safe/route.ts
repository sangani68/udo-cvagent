// app/api/reset-blob-index/safe/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
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

async function post(path: string, body?: any) {
  const endpoint = must("AZURE_SEARCH_ENDPOINT").replace(/\/+$/, "");
  const key = must("AZURE_SEARCH_KEY");
  const url = `${endpoint}${path}?api-version=${APIv}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${path} ${res.status}: ${await res.text()}`);
  return res.json().catch(() => ({}));
}

export async function POST() {
  try {
    const blobIndex = process.env.AZURE_SEARCH_BLOB_INDEX || "cvkb-blob";
    const container = must("AZURE_STORAGE_CONTAINER");
    const conn = must("AZURE_STORAGE_CONN_STRING");

    // Drop old artifacts
    await del(`/indexers/${blobIndex}-indexer`);
    await del(`/indexes/${blobIndex}`);
    await del(`/datasources/${blobIndex}-ds`);

    // Recreate datasource
    await put(`/datasources/${blobIndex}-ds`, {
      name: `${blobIndex}-ds`,
      type: "azureblob",
      credentials: { connectionString: conn },
      container: { name: container },
    });

    // Recreate index with a SAFE key field (`id`)
    await put(`/indexes/${blobIndex}`, {
      name: blobIndex,
      fields: [
        { name: "id", type: "Edm.String", key: true, filterable: true, sortable: true },
        { name: "metadata_storage_path", type: "Edm.String", filterable: true, sortable: true },
        { name: "metadata_storage_name", type: "Edm.String", searchable: true, filterable: true },
        { name: "metadata_storage_last_modified", type: "Edm.DateTimeOffset", filterable: true, sortable: true },

        // Large text: searchable only (do NOT make filterable/sortable/facetable)
        { name: "content", type: "Edm.String", searchable: true },
      ],
    });

    // Recreate indexer — tolerant settings so 1–2 bad docs do NOT stop the whole run
    await put(`/indexers/${blobIndex}-indexer`, {
      name: `${blobIndex}-indexer`,
      dataSourceName: `${blobIndex}-ds`,
      targetIndexName: blobIndex,
      schedule: { interval: "PT30M" },
      parameters: {
        // Critical: keep going even if some documents fail
        maxFailedItems: -1,
        maxFailedItemsPerBatch: -1,
        configuration: {
          dataToExtract: "contentAndMetadata",
          parsingMode: "default",

          // Don’t stop the indexer if a file is encrypted/unsupported/etc.
          failOnUnprocessableDocument: false,
          failOnUnsupportedContentType: false,

          // Optional but helpful when a few docs exceed extraction limits
          indexStorageMetadataOnlyForOversizedDocuments: true,

          // Ensure file types are included
          indexedFileNameExtensions: ".pdf,.doc,.docx,.ppt,.pptx,.txt,.md",
        },
      },

      // Map blob path → id using base64Encode (safe key)
      fieldMappings: [
        {
          sourceFieldName: "metadata_storage_path",
          targetFieldName: "id",
          mappingFunction: { name: "base64Encode" },
        },
      ],
    });

    // Kick ingestion
    const ran = await post(`/indexers/${blobIndex}-indexer/run`);
    return NextResponse.json({ ok: true, note: "Blob index reset (safe key) + tolerant indexer kicked", ran });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
