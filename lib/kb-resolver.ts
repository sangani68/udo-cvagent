import { getTextFromAny } from "@/lib/cv-extract";
import { migrateCvShape, type CVJson } from "@/lib/cvSchema";
import { textToCvJson } from "@/lib/llm-cv";
import { hybridSearch, type SearchDoc } from "@/lib/search";

type ResolvePayload = {
  item?: any;
  url?: string;
  id?: string;
  content?: string;
  mime?: string;
  filename?: string;
};

type EvidenceDoc = {
  id?: string;
  name?: string;
  role?: string;
  url?: string;
  content?: string;
  updatedAt?: string;
  source: string;
};

const NAME_STOPWORDS = new Set([
  "cv",
  "resume",
  "profile",
  "worker",
  "professional",
  "print",
  "layout",
  "kyndryl",
  "document",
  "pptx",
  "pdf",
  "docx",
]);

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeName(value: string) {
  return clean(value)
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTitleCase(value: string) {
  return clean(value)
    .split(/\s+/)
    .map((part) => {
      if (!part) return part;
      const low = part.toLowerCase();
      return low.charAt(0).toUpperCase() + low.slice(1);
    })
    .join(" ");
}

function plausibleName(value: string) {
  const text = clean(value);
  if (!text) return false;
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 5) return false;
  const filtered = tokens.filter((token) => !NAME_STOPWORDS.has(token.toLowerCase()));
  if (filtered.length < 2) return false;
  return filtered.every((token) => /^[\p{L}'’. -]+$/u.test(token));
}

function inferNameFromFilename(filename?: string) {
  const stem = clean(filename || "")
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[()[\]]/g, " ")
    .replace(/\b\d{4}[-_/]\d{2}[-_/]\d{2}\b/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/[_-]+/g, " ");

  const tokens = stem
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !NAME_STOPWORDS.has(token.toLowerCase()));

  const candidates: string[] = [];
  for (let size = Math.min(4, tokens.length); size >= 2; size--) {
    for (let i = 0; i + size <= tokens.length; i++) {
      candidates.push(tokens.slice(i, i + size).join(" "));
    }
  }

  const match = candidates.find(plausibleName);
  return match ? toTitleCase(match) : "";
}

function inferNameFromText(text: string) {
  const raw = clean(text);
  if (!raw) return "";

  const explicit =
    /\bName:\s*([^\n|]+)/i.exec(raw)?.[1] ||
    /\bLegal Name:\s*([^\n|]+)/i.exec(raw)?.[1] ||
    /\bWorker:\s*([^\n|]+)/i.exec(raw)?.[1];
  if (explicit && plausibleName(explicit)) return toTitleCase(explicit);

  const lines = raw
    .split(/\r?\n/)
    .map((line) => clean(line))
    .filter(Boolean)
    .slice(0, 20);

  for (const line of lines) {
    if (plausibleName(line)) return toTitleCase(line);
    if (/^[A-Z][A-Z'’. -]{3,}$/.test(line) && plausibleName(toTitleCase(line))) {
      return toTitleCase(line);
    }
  }

  return "";
}

async function inferCandidateName(payload: ResolvePayload, selectedText: string) {
  const fromFields = [
    payload.item?.name,
    payload.item?.metadata_storage_name,
    payload.filename,
    payload.item?.candidate?.name,
  ]
    .map((value) => inferNameFromFilename(value))
    .find(Boolean);
  if (fromFields) return fromFields;

  const fromText = inferNameFromText(selectedText);
  if (fromText) return fromText;

  const excerpt = clean(selectedText).slice(0, 12000);
  if (!excerpt) return "";

  try {
    const endpoint = (process.env.AZURE_OPENAI_ENDPOINT || "").replace(/\/+$/, "");
    const apiKey =
      (process.env.AZURE_OPENAI_API_KEY || process.env.AZURE_OPENAI_KEY || "").trim();
    const deployment =
      (process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT || "").trim();
    if (!endpoint || !apiKey || !deployment) return "";

    const raw = await textToCvJson(excerpt, {
      endpoint,
      apiKey,
      deployment,
      apiVersion: process.env.AZURE_OPENAI_CHAT_API_VERSION || "2024-10-01-preview",
    });
    return clean(raw?.candidate?.name || "");
  } catch {
    return "";
  }
}

function docMatchesName(doc: EvidenceDoc, candidateName: string) {
  const name = normalizeName(candidateName);
  if (!name) return false;
  const docName = normalizeName(doc.name || "");
  if (docName && (docName === name || docName.includes(name) || name.includes(docName))) {
    return true;
  }

  const tokens = name.split(" ").filter(Boolean);
  const haystack = normalizeName(`${doc.name || ""}\n${doc.content || ""}`);
  if (!haystack) return false;
  return tokens.length >= 2 && tokens.every((token) => haystack.includes(token));
}

function sortByFreshness(a: EvidenceDoc, b: EvidenceDoc) {
  const ad = Date.parse(a.updatedAt || "1970-01-01");
  const bd = Date.parse(b.updatedAt || "1970-01-01");
  return bd - ad;
}

function dedupeDocs(docs: EvidenceDoc[]) {
  const seen = new Set<string>();
  const out: EvidenceDoc[] = [];
  for (const doc of docs) {
    const key = clean(doc.id || doc.url || `${doc.name}|${doc.updatedAt}`);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(doc);
  }
  return out;
}

function asEvidenceDoc(doc: SearchDoc, source = "knowledge-base"): EvidenceDoc {
  return {
    id: doc.id,
    name: clean(doc.name),
    role: clean(doc.role),
    url: clean(doc.url),
    content: clean(doc.content),
    updatedAt: clean(doc.updatedAt),
    source,
  };
}

async function searchEvidenceByName(candidateName: string) {
  const exact = `"${candidateName}"`;
  const [exactHits, broadHits] = await Promise.all([
    hybridSearch(exact, { top: 15 }).catch(() => ({ results: [] as SearchDoc[] })),
    hybridSearch(candidateName, { top: 15 }).catch(() => ({ results: [] as SearchDoc[] })),
  ]);

  const merged = dedupeDocs(
    [...exactHits.results, ...broadHits.results].map((doc) => asEvidenceDoc(doc))
  )
    .filter((doc) => docMatchesName(doc, candidateName))
    .sort(sortByFreshness);

  return merged;
}

function buildMergedKnowledgeText(candidateName: string, docs: EvidenceDoc[]) {
  const parts: string[] = [];
  parts.push(`Candidate Name: ${candidateName}`);
  parts.push("Use newer sources first when dates or facts conflict, but keep older sources when they add missing detail.");

  let total = 0;
  for (const [index, doc] of docs.entries()) {
    const content = clean(doc.content);
    if (!content) continue;
    const header = [
      `Source ${index + 1}`,
      doc.name ? `name=${doc.name}` : "",
      doc.role ? `role=${doc.role}` : "",
      doc.updatedAt ? `updatedAt=${doc.updatedAt}` : "",
      doc.url ? `url=${doc.url}` : "",
      `origin=${doc.source}`,
    ]
      .filter(Boolean)
      .join(" | ");

    const chunk = content.slice(0, 9000);
    total += chunk.length;
    if (total > 45000) break;
    parts.push(`${header}\n${chunk}`);
  }

  return parts.join("\n\n");
}

export async function resolveCvFromKnowledgeBase(payload: ResolvePayload): Promise<{
  cv: CVJson;
  candidateName: string;
  sources: EvidenceDoc[];
}> {
  const selected = await getTextFromAny(
    payload.content
      ? payload.content
      : payload.url
      ? { url: payload.url, name: payload.filename || payload.item?.name }
      : payload.item || {}
  );

  const selectedText = clean(payload.content || selected.text || payload.item?.content || "");
  const candidateName = await inferCandidateName(payload, selectedText);
  if (!candidateName) {
    throw new Error("Could not determine the candidate name from the selected document.");
  }

  const kbDocs = await searchEvidenceByName(candidateName);
  const selectedDoc: EvidenceDoc | null = selectedText
    ? {
        name: payload.filename || payload.item?.name || candidateName,
        url: payload.url || payload.item?.url || payload.item?.metadata_storage_path || "",
        content: selectedText,
        updatedAt: "",
        source: "selected-document",
      }
    : null;

  const sources = dedupeDocs([...(selectedDoc ? [selectedDoc] : []), ...kbDocs]).sort(sortByFreshness);
  const mergedText = buildMergedKnowledgeText(candidateName, sources);

  if (!mergedText.trim()) {
    throw new Error(`No knowledge-base evidence was found for ${candidateName}.`);
  }

  const endpoint = (process.env.AZURE_OPENAI_ENDPOINT || "").replace(/\/+$/, "");
  const apiKey =
    (process.env.AZURE_OPENAI_API_KEY || process.env.AZURE_OPENAI_KEY || "").trim();
  const deployment =
    (process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT || "").trim();
  const apiVersion = (process.env.AZURE_OPENAI_CHAT_API_VERSION || "2024-10-01-preview").trim();
  if (!endpoint || !apiKey || !deployment) {
    throw new Error("Azure OpenAI is not configured for knowledge-base CV resolution.");
  }

  const raw = await textToCvJson(mergedText, {
    endpoint,
    apiKey,
    deployment,
    apiVersion,
  });
  const cv = migrateCvShape(raw);
  cv.meta = {
    ...(cv.meta || {}),
    source: `kb-merge:${candidateName}`,
  };

  return { cv, candidateName, sources };
}
