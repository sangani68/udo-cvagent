// lib/llm-cv.ts
import type { CVJson } from "./cvSchema";

export type LlmCv = Partial<CVJson> & { _meta?: { confidence?: number; gaps?: string[] } };

const SYSTEM_PROMPT = `You are a CV parser for a Kyndryl-branded talent app.
Return STRICT JSON only in this shape:
{
  "candidate": {
    "name": string, "title"?: string, "summary"?: string, "location"?: string,
    "contacts": { "email"?: string, "phone"?: string, "linkedin"?: string },
    "skills": string[],
    "experience": [{ "employer"?: string, "role"?: string, "start"?: string, "end"?: string, "location"?: string, "bullets": [{ "text": string }] }],
    "education": [{ "degree"?: string, "school"?: string, "start"?: string, "end"?: string, "location"?: string }],
    "languages": [{ "name": string, "level"?: string }]
  },
  "_meta"?: { "confidence"?: number, "gaps"?: string[] }
}
Rules:
- Do not invent facts; extract only from provided text.
- Bullets MUST be objects: { "text": "..." }.
- Normalize phone/email/LinkedIn if present.
- Put languages at the end.
- Include _meta.confidence (0..1) and short _meta.gaps notes.`;

type LlmOpts = {
  language?: string;
  endpoint?: string;
  apiKey?: string;
  deployment?: string;
  apiVersion?: string;
};

export async function textToCvJson(text: string, opts?: LlmOpts): Promise<LlmCv> {
  const userInput = [
    opts?.language ? `Target language: ${opts.language}` : null,
    "---\nCV plain text follows:\n",
    (text || "").trim().slice(0, 35000),
  ]
    .filter(Boolean)
    .join("\n");

  const endpoint = (opts?.endpoint ?? process.env.AZURE_OPENAI_ENDPOINT ?? "").replace(
    /\/+$/,
    ""
  );
  const apiKey = (
    opts?.apiKey ??
    process.env.AZURE_OPENAI_API_KEY ??
    process.env.AZURE_OPENAI_KEY ??
    ""
  ).trim();
  const deployment = (
    opts?.deployment ??
    process.env.AZURE_OPENAI_CHAT_DEPLOYMENT ??
    process.env.AZURE_OPENAI_DEPLOYMENT ??
    ""
  ).trim();
  const apiVersion = (
    opts?.apiVersion ?? process.env.AZURE_OPENAI_CHAT_API_VERSION ?? "2024-10-01-preview"
  ).trim();

  if (!endpoint || !apiKey || !deployment) {
    const miss: string[] = [];
    if (!endpoint) miss.push("endpoint");
    if (!apiKey) miss.push("apiKey");
    if (!deployment) miss.push("deployment");
    throw new Error("Azure OpenAI settings missing: " + miss.join(", "));
  }

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      response_format: { type: "json_object" },
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userInput },
      ],
    }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(
      `Azure OpenAI ${res.status} for "${deployment}" @ "${endpoint}" v=${apiVersion}. ${msg}`
    );
  }

  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "{}";
  const raw = JSON.parse(content);
  const c = raw?.candidate ?? {};
  const toBullet = (b: any) => {
    const t = (typeof b === "string" ? b : b?.text || "").toString().trim();
    return t ? { text: t } : null;
  };
  const fix = (arr: any[], f: (x: any) => any) =>
    Array.isArray(arr) ? arr.map(f).filter(Boolean) : [];

  return {
    candidate: {
      name: String(c?.name || "").trim(),
      title: String(c?.title || "").trim(),
      summary: String(c?.summary || "").trim(),
      location: String(c?.location || "").trim(),
      contacts: {
        email: String(c?.contacts?.email || "").trim(),
        phone: String(c?.contacts?.phone || "").trim(),
        linkedin: String(c?.contacts?.linkedin || "").trim(),
      },
      skills: fix(c?.skills, (s) =>
        typeof s === "string" ? s.trim() : String(s?.name || "").trim()
      ),
      experience: fix(c?.experience, (e) => ({
        employer: String(e?.employer || "").trim(),
        role: String(e?.role || e?.title || "").trim(),
        start: String(e?.start || "").trim(),
        end: String(e?.end || "").trim(),
        location: String(e?.location || "").trim(),
        bullets: fix(e?.bullets, toBullet),
      })),
      education: fix(c?.education, (ed) => ({
        degree: String(ed?.degree || "").trim(),
        school: String(ed?.school || ed?.institute || "").trim(),
        start: String(ed?.start || "").trim(),
        end: String(ed?.end || "").trim(),
        location: String(ed?.location || "").trim(),
      })),
      languages: fix(c?.languages, (l) => ({
        name: String(l?.name || l?.language || "").trim(),
        level: String(l?.level || l?.proficiency || "").trim(),
      })).filter((l: any) => l.name),
    } as any,
    _meta: {
      confidence: clamp(raw?._meta?.confidence ?? estimateConfidence(raw)),
      gaps: Array.isArray(raw?._meta?.gaps) ? raw._meta.gaps.slice(0, 10) : inferGaps(raw),
    },
  } as LlmCv;
}

function clamp(n: any) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0.6;
}
function estimateConfidence(raw: any) {
  const c = raw?.candidate ?? {};
  let s = 0,
    t = 0;
  const add = (ok: any, w = 1) => {
    t += w;
    if (ok) s += w;
  };
  add(!!c?.name, 2);
  add((c?.experience?.length ?? 0) > 0, 2);
  add((c?.skills?.length ?? 0) > 2, 1);
  add(!!c?.contacts?.email, 1);
  add((c?.education?.length ?? 0) > 0, 1);
  return t ? s / t : 0.5;
}
function inferGaps(raw: any) {
  const c = raw?.candidate ?? {};
  const g: string[] = [];
  if (!c?.contacts?.email) g.push("missing email");
  if (!c?.contacts?.phone) g.push("missing phone");
  if (!c?.experience?.length) g.push("no experience parsed");
  else
    c.experience.forEach((e: any, i: number) => {
      if (!e?.start && !e?.end) g.push(`no dates in role #${i + 1}`);
      if (!e?.employer && !e?.role) g.push(`weak role header #${i + 1}`);
    });
  if (!c?.skills?.length) g.push("no skills parsed");
  return g.slice(0, 10);
}
