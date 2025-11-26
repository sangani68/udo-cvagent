// lib/azureSearch.ts
import crypto from 'crypto';

const APIv = '2023-11-01';

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing`);
  return v;
}

export function cfg() {
  return {
    endpoint: must('AZURE_SEARCH_ENDPOINT').replace(/\/+$/, ''),
    key: must('AZURE_SEARCH_KEY'),
    blobIndex: process.env.AZURE_SEARCH_BLOB_INDEX || 'cvkb-blob',
    hybridIndex: process.env.AZURE_SEARCH_HYBRID_INDEX || 'cvkb',
    aoai: {
      endpoint: must('AZURE_OPENAI_ENDPOINT').replace(/\/+$/, ''),
      key: must('AZURE_OPENAI_API_KEY'),
      embeddingDeployment: must('AZURE_OPENAI_EMBEDDING_DEPLOYMENT'),
    },
  };
}

async function asHttp(path: string, method: string, body?: any) {
  const { endpoint, key } = cfg();
  const url = `${endpoint}${path}${path.includes('?') ? '&' : '?'}api-version=${APIv}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'api-key': key,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${method} ${path} ${res.status}: ${txt}`);
  }
  return res.json().catch(() => ({}));
}

export async function createOrUpdateHybridIndex() {
  const { hybridIndex } = cfg();
  // Vector + semantic settings
  const body = {
    name: hybridIndex,
    fields: [
      { name: 'id', type: 'Edm.String', key: true, filterable: true },
      { name: 'name', type: 'Edm.String', searchable: true, filterable: true, facetable: true },
      { name: 'role', type: 'Edm.String', searchable: true, filterable: true, facetable: true },
      { name: 'language', type: 'Edm.String', searchable: true, filterable: true, facetable: true },
      { name: 'date', type: 'Edm.DateTimeOffset', filterable: true, sortable: true },
      { name: 'template', type: 'Edm.String', filterable: true, facetable: true },
      { name: 'url', type: 'Edm.String', filterable: true },
      { name: 'content', type: 'Edm.String', searchable: true },
      {
        name: 'contentVector',
        type: 'Collection(Edm.Single)',
        searchable: true,
        vectorSearchDimensions: 3072, // text-embedding-3-large
        vectorSearchConfiguration: 'hnsw',
      },
    ],
    vectorSearch: {
      algorithms: [{ name: 'hnsw', kind: 'hnsw' }],
    },
    semantic: {
      configurations: [
        {
          name: 'default',
          prioritizedFields: {
            titleField: { fieldName: 'name' },
            prioritizedContentFields: [{ fieldName: 'content' }],
          },
        },
      ],
    },
  };
  return asHttp(`/indexes/${hybridIndex}`, 'PUT', body);
}

export async function createOrUpdateBlobIndexer() {
  const { blobIndex } = cfg();
  const account = must('AZURE_STORAGE_ACCOUNT');
  const container = must('AZURE_STORAGE_CONTAINER');
  const conn = must('AZURE_STORAGE_CONN_STRING');

  // 1) datasource
  await asHttp(`/datasources/${blobIndex}-ds`, 'PUT', {
    name: `${blobIndex}-ds`,
    type: 'azureblob',
    credentials: { connectionString: conn },
    container: { name: container },
  });

  // 2) index
  await asHttp(`/indexes/${blobIndex}`, 'PUT', {
    name: blobIndex,
    fields: [
      { name: 'id', type: 'Edm.String', key: true, filterable: true },
      { name: 'metadata_storage_name', type: 'Edm.String', searchable: true, filterable: true },
      { name: 'metadata_storage_path', type: 'Edm.String', filterable: true },
      { name: 'metadata_storage_last_modified', type: 'Edm.DateTimeOffset', filterable: true, sortable: true },
      { name: 'content', type: 'Edm.String', searchable: true },
    ],
  });

  // 3) indexer (remove failOnUnsupportedContent — caused your 400)
  return asHttp(`/indexers/${blobIndex}-indexer`, 'PUT', {
    name: `${blobIndex}-indexer`,
    dataSourceName: `${blobIndex}-ds`,
    targetIndexName: blobIndex,
    schedule: { interval: 'PT30M' }, // every 30 mins
    parameters: {
      // keep defaults; do not set unsupported properties
      configuration: {
        dataToExtract: 'contentAndMetadata',
        parsingMode: 'default',
      },
    },
  });
}

export async function runBlobIndexerNow() {
  const { blobIndex } = cfg();
  return asHttp(`/indexers/${blobIndex}-indexer/run`, 'POST');
}

export async function queryBlobIndex(sinceIso?: string, top = 1000) {
  const { blobIndex } = cfg();
  const filter = sinceIso ? `metadata_storage_last_modified ge ${sinceIso}` : undefined;
  return asHttp(`/indexes/${blobIndex}/docs/search`, 'POST', {
    search: '*',
    select: 'id,metadata_storage_name,metadata_storage_path,metadata_storage_last_modified,content',
    orderby: 'metadata_storage_last_modified desc',
    top,
    filter,
  });
}

export async function upsertHybridDocs(docs: any[]) {
  const { hybridIndex } = cfg();
  if (docs.length === 0) return { ok: true, actions: 0 };

  // Azure Search allows ~1000 actions; keep batches small-ish
  const batches: any[][] = [];
  for (let i = 0; i < docs.length; i += 100) {
    batches.push(docs.slice(i, i + 100));
  }

  for (const batch of batches) {
    await asHttp(`/indexes/${hybridIndex}/docs/index`, "POST", {
      // NOTE: 2023-11-01+ expects `value`, not `actions`
      value: batch.map((d) => ({
        "@search.action": "mergeOrUpload",
        ...d,
      })),
    });
  }

  return { ok: true, actions: docs.length };
}

// ——— Azure OpenAI Embedding ———

export async function embed(text: string): Promise<number[]> {
  const { aoai } = cfg();
  const url = `${aoai.endpoint}/openai/deployments/${aoai.embeddingDeployment}/embeddings?api-version=2023-05-15`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': aoai.key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: text }),
  });
  if (!res.ok) throw new Error(`Embedding ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j.data?.[0]?.embedding || [];
}

// helpers

export function parseExportName(name: string) {
  // exports/<candidate>_<template>_<language>_<yyyymmdd>.pdf
  const base = name.replace(/^.*\//, '');
  const [stem] = base.split('.');
  const parts = stem.split('_');
  // Try to be resilient
  const candidate = parts[0] || 'Unknown';
  const template = parts[1] || '';
  const language = parts[2] || '';
  const dateStr = parts[3] || '';
  const date =
    dateStr && /^\d{8}$/.test(dateStr)
      ? new Date(`${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}T00:00:00Z`)
      : undefined;
  return { candidate, template, language, date };
}

export function stableId(path: string) {
  // Use a hash of path for key safety
  return crypto.createHash('sha1').update(path).digest('hex');
}
