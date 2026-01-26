import type { CvData } from "./cv-view";

export type KyndrylSMSlide = {
  name: string;
  title: string;
  location: string;
  previousRoles: string[];
  keySkills: string[];
  industryExpertise: string[];
  certifications: string[];
  bioSummary: string[];
  photoDataUrl?: string;
};

const LIMITS = {
  roles: 4,
  skills: 6,
  industry: 6,
  certs: 5,
  bio: 5,
};

function toStr(v: any) {
  return String(v ?? "").trim();
}

function toList(arr: any, max: number) {
  return (Array.isArray(arr) ? arr : [])
    .map((v) => toStr(v))
    .filter(Boolean)
    .slice(0, max);
}

function unique(arr: string[]) {
  const seen = new Set<string>();
  return arr.filter((v) => {
    const key = v.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sentenceSplit(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function fallbackFromCv(data: CvData): KyndrylSMSlide {
  const c: any = data?.candidate || {};
  const name = toStr(c.fullName || c.name || "Candidate");
  const title = toStr(c.title || "");
  const location = toStr(c.location || "");
  const photoDataUrl = toStr(c.photoUrl || c.photoDataUrl || "");

  const exp = Array.isArray(c.experiences) ? c.experiences : [];
  const previousRoles = exp
    .map((e: any) => {
      const role = toStr(e.title || e.role);
      const company = toStr(e.company || e.employer);
      return [role, company].filter(Boolean).join(", ");
    })
    .filter(Boolean)
    .slice(0, LIMITS.roles);

  const skills = Array.isArray(c.skills) ? c.skills : [];
  const keySkills = unique(toList(skills, LIMITS.skills));

  const certs = Array.isArray(c.certifications)
    ? c.certifications
    : Array.isArray(c.certificates)
    ? c.certificates
    : [];
  const certifications = unique(
    certs
      .map((cert: any) => toStr(cert?.name || cert?.title || cert))
      .filter(Boolean)
      .slice(0, LIMITS.certs)
  );

  const summary = toStr(c.summary || c.about || "");
  const bioSummary = unique(toList(sentenceSplit(summary), LIMITS.bio));

  return {
    name,
    title,
    location,
    previousRoles,
    keySkills,
    industryExpertise: [],
    certifications,
    bioSummary,
    photoDataUrl: photoDataUrl || undefined,
  };
}

function sanitizeSlide(input: any, fallback: KyndrylSMSlide): KyndrylSMSlide {
  const name = toStr(input?.name || fallback.name);
  const title = toStr(input?.title || fallback.title);
  const location = toStr(input?.location || fallback.location);
  const previousRoles = unique(toList(input?.previousRoles, LIMITS.roles));
  const keySkills = unique(toList(input?.keySkills, LIMITS.skills));
  const industryExpertise = unique(toList(input?.industryExpertise, LIMITS.industry));
  const certifications = unique(toList(input?.certifications, LIMITS.certs));
  const bioSummary = unique(toList(input?.bioSummary, LIMITS.bio));

  return {
    name: name || fallback.name,
    title,
    location,
    previousRoles: previousRoles.length ? previousRoles : fallback.previousRoles,
    keySkills: keySkills.length ? keySkills : fallback.keySkills,
    industryExpertise: industryExpertise.length ? industryExpertise : fallback.industryExpertise,
    certifications: certifications.length ? certifications : fallback.certifications,
    bioSummary: bioSummary.length ? bioSummary : fallback.bioSummary,
    photoDataUrl: toStr(input?.photoDataUrl || fallback.photoDataUrl || "") || undefined,
  };
}

async function llmTransform(data: CvData, locale: string): Promise<KyndrylSMSlide | null> {
  const endpoint = (process.env.AZURE_OPENAI_ENDPOINT || "").replace(/\/+$/, "");
  const apiKey = (process.env.AZURE_OPENAI_API_KEY || process.env.AZURE_OPENAI_KEY || "").trim();
  const deployment =
    (process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT || "").trim();
  const apiVersion = (process.env.AZURE_OPENAI_CHAT_API_VERSION || "2024-10-01-preview").trim();
  if (!endpoint || !apiKey || !deployment) return null;

  const c: any = data?.candidate || {};
  const payload = {
    name: c.fullName || c.name,
    title: c.title,
    location: c.location,
    summary: c.summary,
    skills: c.skills,
    experiences: c.experiences,
    certifications: c.certifications || c.certificates,
    languages: c.languages,
  };

  const system = `You format CV data into a single-slide summary for a Kyndryl profile card.
Return STRICT JSON only with this shape:
{
  "name": string,
  "title": string,
  "location": string,
  "previousRoles": string[],
  "keySkills": string[],
  "industryExpertise": string[],
  "certifications": string[],
  "bioSummary": string[]
}
Rules:
- Use only provided facts; do not invent.
- Keep lists concise: previousRoles max ${LIMITS.roles}, keySkills max ${LIMITS.skills}, industryExpertise max ${LIMITS.industry}, certifications max ${LIMITS.certs}, bioSummary max ${LIMITS.bio}.
- Format previousRoles like "Role, Company".
- bioSummary items should be short bullet sentences.`;

  const user = JSON.stringify({ locale, data: payload });
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) return null;
  const json = await res.json().catch(() => ({}));
  const content = json?.choices?.[0]?.message?.content || "{}";
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function buildKyndrylSMView(data: CvData, locale = "en"): Promise<KyndrylSMSlide> {
  const fallback = fallbackFromCv(data);
  const llm = await llmTransform(data, locale).catch(() => null);
  return sanitizeSlide(llm, fallback);
}

export function buildKyndrylSMHtml(view: KyndrylSMSlide): string {
  const esc = (s: any) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const list = (items: string[]) =>
    items.map((i) => `<li>${esc(i)}</li>`).join("");

  return `<!doctype html>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; background: #fff; }
    .slide { width: 1152px; height: 648px; display: grid; grid-template-columns: 30% 70%; }
    .left { background: ${BRAND}; color: #fff; padding: 32px 28px; position: relative; }
    .photo { width: 110px; height: 110px; background: #fff; margin-bottom: 16px; display:flex; align-items:center; justify-content:center; }
    .photo img { width: 102px; height: 102px; object-fit: cover; }
    .name { font-size: 20px; font-weight: 700; margin-bottom: 2px; }
    .title { font-size: 13px; font-weight: 600; margin-bottom: 2px; }
    .location { font-size: 12px; margin-bottom: 16px; }
    .left h3 { font-size: 12px; letter-spacing: .6px; margin: 18px 0 8px; text-transform: uppercase; }
    .left ul { margin: 0; padding-left: 0; font-size: 11.5px; list-style: none; }
    .left li { margin: 6px 0; }
    .left li::before { content: "– "; }
    .logo { position: absolute; bottom: 20px; left: 24px; font-weight: 700; font-size: 14px; }

    .right { padding: 30px 32px; }
    .top { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 22px; }
    .top h3 { color: ${BRAND}; font-size: 12px; letter-spacing: .6px; margin: 0 0 8px; text-transform: uppercase; }
    .top ul { margin: 0; padding-left: 0; font-size: 11.5px; list-style: none; }
    .top li { margin: 6px 0; }
    .top li::before { content: "– "; }
    .rule { border-top: 1px solid #b59a86; margin: 24px 0 18px; }
    .bio h3 { color: ${BRAND}; font-size: 12px; letter-spacing: .6px; margin: 0 0 10px; text-transform: uppercase; }
    .bio ul { margin: 0; padding-left: 0; font-size: 11.5px; list-style: none; }
    .bio li { margin: 8px 0; }
    .bio li::before { content: "– "; }
  </style>
  <div class="slide">
    <section class="left">
      ${view.photoDataUrl ? `<div class="photo"><img src="${view.photoDataUrl}" /></div>` : ""}
      <div class="name">${esc(view.name)}</div>
      ${view.title ? `<div class="title">${esc(view.title)}</div>` : ""}
      ${view.location ? `<div class="location">${esc(view.location)}</div>` : ""}
      <h3>Previous Roles</h3>
      <ul>${list(view.previousRoles)}</ul>
      <div class="logo">kyndryl</div>
    </section>
    <section class="right">
      <div class="top">
        <div>
          <h3>Key Skills</h3>
          <ul>${list(view.keySkills)}</ul>
        </div>
        <div>
          <h3>Industry/Domain Expertise</h3>
          <ul>${list(view.industryExpertise)}</ul>
        </div>
        <div>
          <h3>Certifications</h3>
          <ul>${list(view.certifications)}</ul>
        </div>
      </div>
      <div class="rule"></div>
      <div class="bio">
        <h3>Bio-Synopsis and Experience Summary</h3>
        <ul>${list(view.bioSummary)}</ul>
      </div>
    </section>
  </div>`;
}

const BRAND = "#FF462D";
