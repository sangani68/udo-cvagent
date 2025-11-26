// lib/aoai.ts
const AOAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || '';
const AOAI_KEY = process.env.AZURE_OPENAI_API_KEY || '';
const AOAI_CHAT = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || '';
const AOAI_EMBED = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || '';
const API_VER = '2024-06-01';

function assertConfigured() {
  if (!AOAI_ENDPOINT || !AOAI_KEY) throw new Error('Azure OpenAI not configured.');
}

export async function embedQuery(text: string): Promise<number[]> {
  assertConfigured();
  if (!AOAI_EMBED) throw new Error('AZURE_OPENAI_EMBEDDING_DEPLOYMENT missing');
  const url = `${AOAI_ENDPOINT}/openai/deployments/${AOAI_EMBED}/embeddings?api-version=${API_VER}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': AOAI_KEY },
    body: JSON.stringify({ input: text })
  });
  if (!res.ok) throw new Error(`Embeddings ${res.status}: ${await res.text().catch(()=>'(no body)')}`);
  const data = await res.json();
  return data?.data?.[0]?.embedding as number[]; // 3072-d for text-embedding-3-large
}

function extractJsonArray(s: string): string {
  const a = s.indexOf('['), b = s.lastIndexOf(']');
  if (a !== -1 && b !== -1 && b > a) return s.slice(a, b + 1);
  return s;
}

export async function expandQueryLLM(q: string): Promise<string[]> {
  assertConfigured();
  if (!AOAI_CHAT) return [q];

  const url = `${AOAI_ENDPOINT}/openai/deployments/${AOAI_CHAT}/chat/completions?api-version=${API_VER}`;
  const system = `You rewrite a CV search query into a few high-signal variants to retrieve the most relevant resumes.
Return ONLY a JSON array of strings, max 4 items, no prose. Keep each under 6 words. Prefer skills, role synonyms, and key tools.`;
  const user = `Original user text: ${q}`;

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'api-key': AOAI_KEY },
    body: JSON.stringify({
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });
  if (!r.ok) return [q];
  const data = await r.json();
  const content = data?.choices?.[0]?.message?.content ?? '[]';

  try {
    const arr = JSON.parse(extractJsonArray(String(content)));
    const uniq = Array.from(new Set([q, ...(Array.isArray(arr) ? arr : [])]))
      .map(String).filter(s => s.trim()).slice(0, 4);
    return uniq.length ? uniq : [q];
  } catch {
    return [q];
  }
}
