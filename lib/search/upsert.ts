import { SearchClient, AzureKeyCredential } from '@azure/search-documents';

const endpoint  = process.env.AZURE_SEARCH_ENDPOINT!;
const key       = process.env.AZURE_SEARCH_API_KEY!;
const indexName = process.env.AZURE_SEARCH_INDEX || 'cvkb';

const AOAI_ENDPOINT     = process.env.AZURE_OPENAI_ENDPOINT;
const AOAI_KEY          = process.env.AZURE_OPENAI_API_KEY;
const AOAI_API_VERSION  = process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview';
const EMBED_MODEL       = process.env.AZURE_OPENAI_EMBED_MODEL || 'text-embedding-3-small';

function b64url(s: string) {
  return Buffer.from(s).toString('base64').replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');
}

async function tryEmbed(text: string): Promise<number[] | undefined> {
  if (!AOAI_ENDPOINT || !AOAI_KEY) return undefined;
  try {
    const r = await fetch(
      `${AOAI_ENDPOINT}/openai/deployments/${EMBED_MODEL}/embeddings?api-version=${AOAI_API_VERSION}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'api-key': AOAI_KEY }, body: JSON.stringify({ input: text || '' }) }
    );
    if (!r.ok) return undefined;
    const j = await r.json();
    return j?.data?.[0]?.embedding as number[] | undefined;
  } catch { return undefined; }
}

function flattenCvToText(data: any): string {
  const parts: string[] = [];
  const c = data?.candidate || data?.identity || {};
  parts.push(c.full_name || c.fullName || c.name || '', c.headline || '', c.summary || '');
  const skills = c.skills || data?.skills || [];
  (skills || []).forEach((s: any) => parts.push(typeof s === 'string' ? s : s?.name || ''));
  const exps = c.experience || data?.experience || [];
  for (const e of exps) {
    parts.push(e?.title || e?.role || '', e?.company || '', e?.summary || '');
    (e?.bullets || e?.highlights || []).forEach((b: any) => parts.push(typeof b === 'string' ? b : b?.text || ''));
  }
  return parts.filter(Boolean).join('\n');
}

export async function upsertCvDoc(payload: { id: string; url?: string | null; data: any; language?: string; }) {
  const { id, url, data, language } = payload;
  const client = new SearchClient(endpoint, indexName, new AzureKeyCredential(key));

  const safeId = b64url(String(id)); // <<< encode: no slashes, only URL-safe chars

  const name =
    data?.candidate?.full_name || data?.candidate?.fullName || data?.candidate?.name ||
    data?.identity?.full_name || data?.identity?.fullName || data?.identity?.name || 'unknown';

  const role   = data?.candidate?.headline || data?.candidate?.role || '';
  const skills = (data?.candidate?.skills || data?.skills || []).map((s: any) => (typeof s === 'string' ? s : s?.name || s)).filter(Boolean);
  const content = flattenCvToText(data);
  const vector = await tryEmbed(content || name || role || (skills || []).join(' '));

  const doc: any = {
    id: safeId,
    name,
    role,
    skills,
    language: language || data?.meta?.locale || 'en',
    url: url || null,
    content,
  };
  if (Array.isArray(vector)) doc.contentVector = vector;

  await client.mergeOrUploadDocuments([doc]);
}
