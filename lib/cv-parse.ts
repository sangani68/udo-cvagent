// lib/cv-parse-strong.ts
// Deterministic parser tuned for your reference patterns:
// • "Customer: <Company> | Aug 2020 – Dec 2023 | Luxembourg, Luxembourg"
// • EP Form-6: "Employer: …", "Dates: Start … End …", "Client: …"
// • Generic "Title at Company" or "Title — Company | Dates | City, Country"

type Link = { label: string; url: string };
type Bullet = { text: string };
type Job = { title: string; company: string; start: string; end: string; location: string; bullets: Bullet[] };
type Edu = {
  school: string;
  degree: string;
  fieldOfStudy: string;
  eqfLevel: string;
  start: string;
  end: string;
  location: string;
  bullets: Bullet[];
};

export type IdentityCV = {
  identity: { full_name: string; email: string; phone: string; location: string; links: Link[]; photo: string };
  headline: string;
  summary: string;
  skills: { name: string }[];
  experience: Job[];
  education: Edu[];
  certifications: string[];
  languages: { name: string; level?: string }[];
  meta: { locale: string; export_template: string; pii_masking: { email: boolean; phone: boolean; location: boolean }; assets?: Record<string, any> };
};

/* ───────── Dictionaries & Regex ───────── */
const BULLET = /^\s*(?:[•●◦·\-*▪■⇢→››»]|–|\d+\.)\s+/;
const COMPANY_SUFFIX = /\b(Inc\.?|Ltd\.?|LLC|GmbH|S\.?A\.?|N\.?V\.?|B\.?V\.?|PLC|Co\.?|Corporation|Limited|AG|SAS|Oy|AB|BVBA|K\.?K\.?|Pvt\.?|SRL|SpA)\b/i;
const COMPANY_HINT  = /\b(Technologies|Systems|Solutions|Labs|Group|Holdings|Partners|Consulting|Software|Services|Bank|Studio|Digital|Analytics|Industries|International|Global)\b/i;
const TITLE_HINT    = /\b(Engineer|Developer|Consultant|Manager|Lead|Architect|Director|Head|Specialist|Analyst|Scientist|Officer|Administrator|Intern|Associate|Owner|Founder|Coach|Teacher|SME|Subject Matter Expert|Project Manager|Program Manager|Delivery Manager)\b/i;

const DATE_TOKEN =
  "(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?\\s+\\d{2,4}|\\d{4}-\\d{2}|\\d{1,2}/\\d{4}|\\d{1,2}/\\d{1,2}/\\d{4}|\\d{4}|\\bCURRENT\\b|\\bPRESENT\\b)";
const DATE_RANGE_RE = new RegExp(`(${DATE_TOKEN})(?:\\s*(?:-|–|—|to)\\s*(?:(?:Present|Current|Now|To\\s*Date)|${DATE_TOKEN}))?`, "i");

// Locations: prefer "City, Country/CC"
const LOC_CITY_COMMA = /[A-Za-zÀ-ÿ'().\- ]{2,},\s*[A-Za-zÀ-ÿ'().\- ]{2,}/;
const LOC_FLAGS      = /\b(Remote|Hybrid|Onsite|On-site)\b/i;

// Mild country list to improve ranking (common in your samples)
const COUNTRY_HINT = /\b(Belgium|Luxembourg|Netherlands|Germany|France|India|United Kingdom|UK|United States|USA)\b/i;

const HEADERS = [
  "summary","professional summary","profile","about","objective",
  "experience","professional experience","work experience","employment","work history","career history","projects","project experience",
  "education","academic","academics","qualifications","studies",
  "skills","technical skills","key skills","core skills","competencies","technology stack","tech stack",
  "certifications","certification","licenses","licences","awards",
  "languages","language skills","linguistic skills",
];

/* ───────── Public API ───────── */
export function parseCvTextToIdentity(text: string): IdentityCV {
  const lines = normalize(text);
  const buckets = splitByHeadings(lines);

  const id = extractIdentity(lines);
  const summary = parseSummary(buckets);
  const skills = parseSkills(buckets);
  const languages = parseLanguages(buckets);
  const certifications = parseCertifications(buckets);
  const experience = parseExperience(buckets);
  const education = parseEducation(buckets);

  const cv: IdentityCV = {
    identity: id,
    headline: id._headline || "",
    summary,
    skills: dedupBy(skills, (s) => s.name.toLowerCase()),
    languages: dedupBy(languages, (l) => (l.name + "|" + (l.level || "")).toLowerCase()),
    certifications,
    experience: tidyJobs(experience),
    education: tidyEdu(education),
    meta: { locale: "en", export_template: "pdf-kyndryl", pii_masking: { email: false, phone: true, location: false } },
  };

  if (!cv.skills.length) cv.skills = trySkillsInFreeText(summary);
  if (!cv.languages.length) cv.languages = tryLanguagesInFreeText(summary);

  // @ts-ignore temp internal
  delete cv.identity._headline;
  return cv;
}

/* ───────── Identity ───────── */
function extractIdentity(all: string[]) {
  const text = all.join("\n");
  const email = (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])[0] || "";
  const phone = (text.match(/(\+?\d[\d\-\s()]{8,}\d)/g) || [])[0] || "";

  const links: Link[] = [];
  const urlRe = /\b(https?:\/\/[^\s)]+|(?:www\.)[^\s)]+)\b/gi;
  Array.from(new Set((text.match(urlRe) || []).map((u) => u.replace(/[),.;]+$/, "")))).forEach((u) =>
    links.push({ label: /linkedin/i.test(u) ? "LinkedIn" : /github/i.test(u) ? "GitHub" : "Link", url: u.startsWith("http") ? u : `https://${u}` })
  );

  // Name + optional headline from top
  const top = all.slice(0, 18).filter((l) => !l.includes("@") && !/\+?\d/.test(l));
  let full_name = "", headline = "";
  for (const l of top) {
    const words = l.split(/\s+/);
    const titleish = words.filter((w) => /^[A-Z][a-z'.-]+$/.test(w)).length >= Math.ceil(words.length * 0.6);
    if (!full_name && words.length >= 2 && words.length <= 6 && titleish) { full_name = l; continue; }
    if (full_name && !headline && words.length <= 14 && !DATE_RANGE_RE.test(l)) { headline = l; break; }
  }

  // Location: prefer “City, CC/Country” and rank candidates with COUNTRY_HINT
  const locCandidates = all.slice(0, 30).flatMap((l) => l.split(/[|·•/]/).map((x) => x.trim()));
  const location = chooseBestLocation(locCandidates);

  return { full_name, email, phone, location, links, photo: "", _headline: headline } as any;
}

/* ───────── Section splitting ───────── */
function splitByHeadings(lines: string[]) {
  const buckets: Record<string, string[]> = {};
  let current = "_preamble";
  buckets[current] = [];
  for (const l of lines) {
    const h = isHeader(l);
    if (h) { current = h; buckets[current] = buckets[current] || []; continue; }
    (buckets[current] = buckets[current] || []).push(l);
  }
  return buckets;
}
function isHeader(t: string): string | "" {
  const m = HEADERS.find((h) => new RegExp(`^\\s*${escapeReg(h)}\\s*:?$`, "i").test(t));
  return m ? m.toLowerCase() : "";
}

/* ───────── Summary ───────── */
function parseSummary(buckets: Record<string, string[]>) {
  const pref =
    buckets["summary"] || buckets["professional summary"] || buckets["profile"] ||
    buckets["about"] || buckets["objective"] || buckets["_preamble"] || [];
  const cut = pref.findIndex((l) => DATE_RANGE_RE.test(l) || /(?:\sat\s| @ )/.test(l) || BULLET.test(l) || TITLE_HINT.test(l));
  const take = (cut >= 0 ? pref.slice(0, Math.max(1, cut)) : pref).slice(0, 8);
  return take.join(" ");
}

/* ───────── Skills/Languages/Certs ───────── */
function parseSkills(b: Record<string, string[]>) {
  const block = b["skills"] || b["technical skills"] || b["key skills"] || b["core skills"] || b["competencies"] || b["technology stack"] || b["tech stack"] || [];
  if (!block.length) return [];
  const tokens = block.join("\n").split(/\n|[,;|/•·]/).map((s) => s.replace(BULLET, "").trim()).filter(Boolean);
  return Array.from(new Set(tokens.map((t) => t.replace(/\s+/g, " ").trim()))).map((name) => ({ name }));
}
function trySkillsInFreeText(s: string) {
  const tokens = s.split(/[,;|/]/).map((x) => x.trim());
  return Array.from(new Set(tokens.filter((t) => /^[A-Za-z0-9#.+\-_/ ]{2,}$/.test(t) && t.length <= 40))).map((name) => ({ name }));
}

function parseLanguages(b: Record<string, string[]>) {
  const block = b["languages"] || b["language skills"] || b["linguistic skills"] || [];
  if (!block.length) return [];
  return block.map((l) => l.replace(BULLET, "").trim()).map((l) => {
    const m = l.match(/^(.+?)\s*(?:[-–—:]\s*|\s*\(|\s+)\s*(Native|Fluent|Professional|Bilingual|C2|C1|B2|B1|A2|A1|Intermediate|Basic|Elementary)(?:\))?$/i);
    return m ? { name: m[1].trim(), level: m[2].trim() } : { name: l };
  });
}
function tryLanguagesInFreeText(s: string) {
  const r = /\b(English|French|German|Dutch|Spanish|Italian|Portuguese|Polish|Hindi|Arabic|Chinese|Mandarin|Cantonese|Japanese|Korean|Russian)\b/gi;
  return Array.from(new Set((s.match(r) || []).map((x) => x.trim()))).map((name) => ({ name }));
}

function parseCertifications(b: Record<string, string[]>) {
  const block = b["certifications"] || b["certification"] || b["licenses"] || b["licences"] || [];
  return block.map((l) => l.replace(BULLET, "").trim()).filter(Boolean);
}

/* ───────── Experience ───────── */
function parseExperience(b: Record<string, string[]>) {
  const block =
    b["experience"] || b["professional experience"] || b["work experience"] ||
    b["employment"] || b["work history"] || b["career history"] ||
    b["projects"] || b["project experience"] || [];
  if (!block.length) return [];

  const out: Job[] = [];
  let cur: Job | null = null;

  const push = () => {
    if (!cur) return;
    cur.bullets = dedupBullets(cur.bullets);
    if (cur.title || cur.company || cur.bullets.length) out.push(cur);
    cur = null;
  };

  for (let i = 0; i < block.length; i++) {
    const l = block[i];

    // A) EP Form-6 structured lines
    if (/^Employer:\s*/i.test(l) || /^Project name:\s*/i.test(l)) {
      push();
      let employerLine = l;
      let employer = l.replace(/^Employer:\s*/i, "").trim();
      let projectName = "";

      if (/^Project name:/i.test(l)) {
        projectName = l.replace(/^Project name:\s*/i, "").trim();
        const nextEmployer = findNext(block, i, /^Employer:\s*/i, 5);
        if (nextEmployer) { employer = nextEmployer.replace(/^Employer:\s*/i, "").trim(); employerLine = nextEmployer; }
      }
      const datesLine = findNext(block, i, /^Dates:\s*/i, 6) || "";
      const start = (datesLine.match(/Start[^:]*:\s*([^.]+)/i)?.[1] || "").trim();
      const end   = (datesLine.match(/End[^:]*:\s*([^.]+)/i)?.[1] || "").trim();

      const clientLine = findNext(block, i, /^Client:\s*/i, 6) || "";
      const client = clientLine.replace(/^Client:\s*/i, "").trim();

      const location = chooseBestLocation([employerLine, clientLine, datesLine]);

      cur = {
        title: projectName || (client ? `Project: ${client}` : "Project"),
        company: employer,
        start, end, location, bullets: [],
      };
      continue;
    }

    // B) Europass “Customer: … | dates | location”
    if (/^Customer\s*:/i.test(l) || /^Client\s*:/i.test(l)) {
      push();
      const after = l.replace(/^(Customer|Client)\s*:\s*/i, "");
      const parts = after.split(/\s*\|\s*/).map((x) => x.trim());
      const company = (parts[0] || "").replace(/^(Customer|Client)\s*:\s*/i, "").trim();
      const datePart = parts.find((x) => DATE_RANGE_RE.test(x)) || "";
      const { start, end } = extractDates(datePart);
      const location = chooseBestLocation(parts);
      cur = { title: "", company, start, end, location, bullets: [] };
      continue;
    }

    // C) Generic header lines with separators (at/@/–/—/|/,)
    const sep = l.match(/\s+(?:at|@|–|—|-|,|\|)\s+/);
    const hasDate = DATE_RANGE_RE.test(l);
    const looksCompany = COMPANY_SUFFIX.test(l) || COMPANY_HINT.test(l) || isAllCaps(l);
    const looksTitle = TITLE_HINT.test(l);

    const next = block[i + 1] || "";
    const next2 = block[i + 2] || "";
    const prev = block[i - 1] || "";

    const tokenized = l.split(/\s*[|·•\/]\s*/).map((t) => t.trim());
    const locCandidates = [l, next, next2, ...tokenized].flatMap((x) => x.split(/[\t ]{2,}/)).map((x) => x.trim());
    const dateCand = [l, next, next2, ...tokenized].find((x) => DATE_RANGE_RE.test(x)) || "";

    const headerish = sep || hasDate || (looksTitle && (looksCompany || COMPANY_SUFFIX.test(next) || COMPANY_SUFFIX.test(prev)));
    if (headerish && !BULLET.test(l)) {
      push();

      let title = "", company = "";

      if (sep) {
        const [a, b] = l.split(sep[0]); const L = (a || "").trim(), R = (b || "").trim();
        if (isLikelyCompany(R) && !isLikelyCompany(L)) { title = L; company = R; }
        else if (isLikelyCompany(L) && !isLikelyCompany(R)) { company = L; title = R; }
        else if (looksTitle && isLikelyCompany(R)) { title = L; company = R; }
        else { title = L; company = R; }
      } else {
        const guess = guessTitleCompany(tokenized);
        title = guess.title || title;
        company = guess.company || company;

        if (!title || !company) {
          if (looksTitle && isLikelyCompany(next)) { title = title || l.trim(); company = company || next.trim(); }
          else if (isLikelyCompany(l) && TITLE_HINT.test(next)) { company = company || l.trim(); title = title || next.trim(); }
          else if (isLikelyCompany(prev) && !BULLET.test(prev)) { company = company || prev.trim(); title = title || l.trim(); }
          else { title = title || l.trim(); }
        }
      }

      // Strip noisy "(Client: …)" from title if present
      title = title.replace(/\s*\(Client:.*?\)\s*$/i, "").trim();

      const { start, end } = extractDates(dateCand);
      const location = chooseBestLocation(locCandidates);

      cur = { title, company, start, end, location, bullets: [] };
      continue;
    }

    // D) Bullets + bulletless responsibilities (avoid colon-label lines)
    if (BULLET.test(l) && cur) { cur.bullets.push({ text: l.replace(BULLET, "").trim() }); continue; }
    if (cur && !isHeader(l) && !DATE_RANGE_RE.test(l) && !/^(Employer|Customer|Client|Dates|Location|Project name)\s*:/i.test(l)) {
      const trimmed = l.trim();
      if (trimmed) cur.bullets.push({ text: trimmed });
    }
  }

  push();

  // Orphan bullets near top → attach to first job
  const orphan = block.slice(0, Math.min(10, block.length)).filter((x) => BULLET.test(x)).map((x) => x.replace(BULLET, "").trim());
  if (orphan.length && out.length) out[0].bullets = dedupBullets([...orphan.map((t) => ({ text: t })), ...out[0].bullets]);

  // Repair: missing company? borrow from nearby "Customer:/Client:" line
  for (let i = 0; i < out.length; i++) {
    if (!out[i].company) {
      const c = findBack(block, /^(Customer|Client)\s*:/i, 6, i);
      if (c) out[i].company = c.replace(/^(Customer|Client)\s*:\s*/i, "").split("|")[0].trim();
    }
  }

  return out;
}

/* ───────── Education ───────── */
function parseEducation(b: Record<string, string[]>) {
  const block = b["education"] || b["academic"] || b["academics"] || b["qualifications"] || [];
  if (!block.length) return [];

  const out: Edu[] = [];
  let cur: Edu | null = null;
  const DEG_RE = /(Bachelor|Master|BSc|MSc|BA|MA|MBA|PhD|MPhil|Diploma|Certificate|B\.?Eng|M\.?Eng|B\.?Tech|M\.?Tech|LLB|LLM|MD|DDS|DPhil|PG|MS|BS|BE)/i;
  const FIELD_RE = /^(?:Field(?:\(s\))?\s*of\s*study|Field\s*of\s*studies|Major|Specialization|Discipline)\s*:\s*(.+)$/i;
  const EQF_RE = /^(?:Level\s*in\s*EQF|EQF\s*Level|EQF)\s*:\s*(.+)$/i;

  const push = () => {
    if (!cur) return;
    cur.bullets = dedupBullets(cur.bullets);
    if (cur.school || cur.degree) out.push(cur);
    cur = null;
  };

  for (let i = 0; i < block.length; i++) {
    const l = block[i];

    if (BULLET.test(l) && cur) { cur.bullets.push({ text: l.replace(BULLET, "").trim() }); continue; }
    const fieldMatch = l.match(FIELD_RE);
    if (fieldMatch && cur) { cur.fieldOfStudy = fieldMatch[1].trim(); continue; }
    const eqfMatch = l.match(EQF_RE);
    if (eqfMatch && cur) { cur.eqfLevel = eqfMatch[1].trim(); continue; }

    const hasDeg = DEG_RE.test(l);
    const looksSchool = /University|College|School|Institute|Polytechnic|École|Universität|Universidade|Politecnico|Instituto|Academy/i.test(l) || isAllCaps(l);

    if ((hasDeg || looksSchool) && !/^(skills|languages|experience|projects|certifications)/i.test(l)) {
      push();

      let school = "", degree = "", fieldOfStudy = "", eqfLevel = "", start = "", end = "", location = "";
      const next = block[i + 1] || "", next2 = block[i + 2] || "";

      const sep = l.match(/\s+(?:–|—|-|\|)\s+/);
      if (sep) {
        const [a, b] = l.split(sep[0]);
        if (DEG_RE.test(a)) { degree = a.trim(); school = b.trim(); }
        else if (DEG_RE.test(b)) { school = a.trim(); degree = b.trim(); }
        else { school = a.trim(); degree = b.trim(); }
      } else {
        if (hasDeg) degree = l.trim();
        if (looksSchool) school = l.trim();
      }

      const dateCand = [l, next, next2].find((x) => DATE_RANGE_RE.test(x)) || "";
      const { start: ds, end: de } = extractDates(dateCand);
      const locCandidates = [l, next, next2].flatMap((x) => x.split(/[|·•/]/).map((s) => s.trim()));
      location = chooseBestLocation(locCandidates);
      start = ds; end = de;

      const fieldInline = [l, next, next2].map((x) => x.match(FIELD_RE)).find(Boolean);
      const eqfInline = [l, next, next2].map((x) => x.match(EQF_RE)).find(Boolean);
      if (fieldInline) fieldOfStudy = fieldInline[1].trim();
      if (eqfInline) eqfLevel = eqfInline[1].trim();

      cur = { school, degree, fieldOfStudy, eqfLevel, start, end, location, bullets: [] };
      continue;
    }

    if (cur && !DATE_RANGE_RE.test(l) && !isHeader(l) && looksLikeAchievement(l)) {
      cur.bullets.push({ text: l.trim() });
    }
  }

  push();
  return out;
}

/* ───────── helpers ───────── */
function normalize(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/\u2022/g, "•")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}
function isAllCaps(t: string) { if (!/[A-Za-z]/.test(t)) return false; const letters = t.replace(/[^A-Za-z]/g, ""); return letters.length > 1 && letters === letters.toUpperCase(); }
function isLikelyCompany(s: string) { return COMPANY_SUFFIX.test(s) || COMPANY_HINT.test(s) || isAllCaps(s); }
function looksLikeResponsibility(l: string) {
  return /^(Led|Owned|Managed|Built|Designed|Delivered|Drove|Created|Implemented|Migrated|Developed|Optimized|Improved|Reduced|Increased|Automated|Spearheaded|Coordinated|Launched|Wrote|Maintained|Enhanced|Architected|Defined|Directed|Oversaw|Mentored|Analyzed|Configured|Deployed|Integrated|Executed|Collaborated|Supported)\b/i.test(l)
    || /(?:\d+%|\d+\s+(?:users|requests|transactions|pipelines|reports|APIs|microservices|clients))/i.test(l);
}
function looksLikeAchievement(l: string) { return /Dean'?s|Honours|Honors|Merit|GPA|Grade|Dissertation|Thesis|Award|Scholarship|Cum Laude|Magna|Summa/i.test(l); }

function extractDates(s: string) {
  const m = (s || "").match(DATE_RANGE_RE);
  if (!m) return { start: "", end: "" };
  const parts = (m[0] || "").split(/-|–|—|to/i).map((x) => x.trim());
  const start = (parts[0] || "").trim();
  const endRaw = (parts[1] || "").trim();
  const end = /^(Present|Current|Now|To\s*Date|CURRENT)$/i.test(endRaw) ? "Present" : endRaw;
  return { start, end };
}

function chooseBestLocation(cands: string[]): string {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  const arr = cands.map(norm).filter(Boolean);

  // 1) All "City, Country/CC" candidates (rank by country hint and by being last)
  const cityComma = arr
    .map((c) => (LOC_CITY_COMMA.test(c) ? (c.match(LOC_CITY_COMMA) || [""])[0] : ""))
    .filter(Boolean);
  if (cityComma.length) {
    // prefer ones containing a known country name/CC, otherwise last one
    const ranked = cityComma.sort((a, b) => (COUNTRY_HINT.test(a) ? 1 : 0) - (COUNTRY_HINT.test(b) ? 1 : 0));
    return ranked[ranked.length - 1];
  }

  // 2) Parentheses "(City, Country)" inside any candidate
  for (const c of arr) {
    const paren = c.match(/\(([^)]+)\)/);
    if (paren && LOC_CITY_COMMA.test(paren[1])) return (paren[1].match(LOC_CITY_COMMA) || [""])[0];
  }

  // 3) Last resort: Remote/Hybrid flag
  let best = "";
  for (const c of arr) if (LOC_FLAGS.test(c)) best = (c.match(LOC_FLAGS) || [""])[0];
  return best;
}

function dedupBullets(bullets: Bullet[]) {
  const seen = new Set<string>();
  return bullets
    .map((b) => ({ text: b.text.replace(/\s+/g, " ").trim() }))
    .filter((b) => b.text && !seen.has(b.text.toLowerCase()) && seen.add(b.text.toLowerCase()))
    .slice(0, 60);
}
function tidyJobs(jobs: Job[]) {
  return jobs
    .map((j) => ({ ...j, bullets: dedupBullets(j.bullets || []) }))
    .filter((j) => j.title || j.company || j.bullets.length)
    .slice(0, 60);
}
function tidyEdu(edu: Edu[]) {
  return edu
    .map((e) => ({ ...e, bullets: dedupBullets(e.bullets || []) }))
    .filter((e) => e.school || e.degree)
    .slice(0, 40);
}
function escapeReg(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function dedupBy<T>(arr: T[], key: (t: T) => string) {
  const seen = new Set<string>();
  return arr.filter((x) => { const k = key(x); if (!k) return false; if (seen.has(k)) return false; seen.add(k); return true; });
}
function findNext(block: string[], idx: number, re: RegExp, lookahead = 5): string | null {
  for (let j = idx + 1; j <= idx + lookahead && j < block.length; j++) if (re.test(block[j])) return block[j];
  return null;
}
function findBack(block: string[], re: RegExp, look = 6, jobIndex = 0): string | null {
  for (let j = Math.max(0, jobIndex - look); j < block.length && j >= 0 && j <= jobIndex + look; j++) if (re.test(block[j])) return block[j];
  return null;
}
function guessTitleCompany(tokens: string[]): { title?: string; company?: string } {
  const cands = tokens.filter(Boolean);
  let title = "", company = "";
  for (const t of cands) {
    if (!company && isLikelyCompany(t)) { company = t; continue; }
    if (!title && TITLE_HINT.test(t)) { title = t; continue; }
  }
  if (!title && cands[0] && /^[A-Z][\w ./-]+$/.test(cands[0])) title = cands[0];
  if (!company) {
    const rest = cands.slice(1).find(isLikelyCompany);
    if (rest) company = rest;
  }
  return { title, company };
}
