// lib/cv-view.ts
import type { CVJson } from "./cvSchema";

/** What the PDF templates read */
export type CvData = {
  candidate: {
    fullName?: string;
    name?: string;
    title?: string;
    summary?: string;

    email?: string;
    phone?: string;
    linkedin?: string;
    location?: string;
    contacts?: { email?: string; phone?: string; linkedin?: string };

    photoUrl?: string;

    skills: string[];

    experiences: Array<{
      title?: string;   // display (role)
      role?: string;
      company?: string;
      employer?: string;
      start?: string;
      end?: string;
      location?: string;
      bullets?: Array<{ text: string }>;
    }>;

    education: Array<{
      degree?: string;
      school?: string;
      start?: string;
      end?: string;
      location?: string;
    }>;

    languages: Array<{ name?: string; level?: string; levelText?: string }>;
  };
  cv: CVJson;
};

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x ?? {}));

/* ---------------- helpers ---------------- */
function splitLines(s?: string): string[] {
  const arr = (s || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  if (arr.length) return arr;
  return (s || "").split(/[•;·]+/).map((x) => x.trim()).filter(Boolean);
}

function takeArray(obj: any, keys: string[]): any[] {
  for (const k of keys) {
    const v = obj?.[k];
    if (Array.isArray(v) && v.length) return clone(v);
  }
  return [];
}

function takeNestedArray(obj: any, paths: string[][]): any[] {
  for (const p of paths) {
    let cur = obj;
    let ok = true;
    for (const seg of p) {
      cur = cur?.[seg];
      if (cur == null) { ok = false; break; }
    }
    if (ok && Array.isArray(cur) && cur.length) return clone(cur);
  }
  return [];
}

/** Deep search anywhere for arrays whose key matches a regex */
function findArraysByKeyRegex(root: any, keyRe: RegExp, max = 2): any[][] {
  const found: any[][] = [];
  const seen = new WeakSet<any>();
  const stack: any[] = [root];

  while (stack.length && found.length < max) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;
    if (seen.has(cur)) continue;
    seen.add(cur);

    if (Array.isArray(cur)) {
      for (const v of cur) stack.push(v);
      continue;
    }

    for (const [k, v] of Object.entries(cur)) {
      if (v && typeof v === "object") {
        if (Array.isArray(v) && keyRe.test(k) && v.length) {
          found.push(clone(v));
          if (found.length >= max) break;
        } else {
          stack.push(v);
        }
      }
    }
  }
  return found;
}

function normalizeBullets(input: any, max = 12): Array<{ text: string }> {
  const out: Array<{ text: string }> = [];
  const arr = Array.isArray(input) ? input : [];

  for (const b of arr) {
    if (typeof b === "string") {
      splitLines(b).forEach((t) => t && out.push({ text: t }));
    } else if (b && typeof b.text === "string") {
      const t = b.text.trim();
      if (t) out.push({ text: t });
    } else if (b && typeof b === "object") {
      const t = String(
        (b.detail ?? b.value ?? b.note ?? b.summary ?? b.description ?? b.responsibility ?? "") || ""
      ).trim();
      if (t) splitLines(t).forEach((x) => x && out.push({ text: x }));
    }
    if (out.length >= max) break;
  }
  return out.slice(0, max);
}

/* ---------------- tolerant view-model builder ---------------- */
export function toPreviewModel(cv: CVJson): CvData {
  const src: any = clone(cv || {});
  const c0: any = clone(src.candidate || {});

  // Identity + contacts (flatten both ways)
  const contacts = c0.contacts || {};
  const fullName = (c0.fullName ?? c0.name ?? "").trim();
  const title    = (c0.title ?? "").trim();
  const email    = (c0.email ?? contacts.email ?? "").trim();
  const phone    = (c0.phone ?? contacts.phone ?? "").trim();
  const linkedin = (c0.linkedin ?? contacts.linkedin ?? "").trim();
  const website  = (c0.website ?? contacts.website ?? "").trim();
  const location = (c0.location ?? "").trim();
  const summary  = (c0.summary ?? "").trim();
  const photoUrl = (c0.photoUrl ?? c0.photo?.dataUrl ?? "").trim();

  // Skills → [string]
  const skillsRaw = c0.skills ?? c0.skillList ?? c0.competencies ?? [];
  const skills = (Array.isArray(skillsRaw) ? skillsRaw : [])
    .map((x: any) => (typeof x === "string" ? x : (x?.name ?? x?.text ?? "")))
    .map((v) => String(v || "").trim())
    .filter(Boolean);

  // -------- EXPERIENCE: candidate.* OR root/sections deep scan --------
  // 1) Common candidate-level places
  let expSources: any[] =
    takeArray(c0, [
      "experiences", "experience", "work", "jobs", "positions",
      "employmentHistory", "professionalExperience", "Experience", "Experiences"
    ]) ||
    takeNestedArray(c0, [
      ["employment", "items"],                 // candidate.employment.items
      ["workExperience", "items"],            // candidate.workExperience.items
      ["professional", "experience"],         // nested custom
    ]);

  // 2) If still empty, scan the WHOLE cv object (root/sections/blocks/etc.)
  if (!expSources || expSources.length === 0) {
    const deep =
      findArraysByKeyRegex(src, /(experiences?|work|jobs|positions|employment|employmentHistory|professionalExperience)$/i, 2)
      .flat();
    if (deep.length) expSources = deep;
  }

  const experiences = (expSources as any[]).map((e: any) => {
    const role  = String(e?.role ?? e?.title ?? e?.position ?? "").trim();
    const comp  = String(e?.company ?? e?.employer ?? e?.organization ?? "").trim();
    const start = String(e?.start ?? e?.from ?? e?.startDate ?? e?.dateFrom ?? "").trim();
    const end   = String(e?.end ?? e?.to ?? e?.endDate ?? e?.dateTo ?? "").trim();
    const loc   = String(e?.location ?? e?.city ?? e?.place ?? "").trim();

    const bags: any[] = [];
    if (Array.isArray(e?.bullets))          bags.push(e.bullets);
    if (Array.isArray(e?.highlights))       bags.push(e.highlights);
    if (Array.isArray(e?.responsibilities)) bags.push(e.responsibilities);
    if (Array.isArray(e?.achievements))     bags.push(e.achievements);
    if (Array.isArray(e?.details))          bags.push(e.details);
    if (typeof e?.summary === "string")     bags.push(splitLines(e.summary));
    if (typeof e?.description === "string") bags.push(splitLines(e.description));
    const bullets = normalizeBullets(bags.flat(), 12);

    return {
      title: role || comp || "Role",
      role,
      company: comp,
      employer: comp,
      start,
      end,
      location: loc,
      bullets,
    };
  });

  // -------- EDUCATION: candidate.* OR root/sections deep scan --------
  let eduSources: any[] =
    takeArray(c0, [
      "education", "educations", "educationHistory", "studies", "academics",
      "Education", "Educations"
    ]) ||
    takeNestedArray(c0, [
      ["academics", "items"],
      ["educationSection", "items"],
    ]);

  if (!eduSources || eduSources.length === 0) {
    const deep =
      findArraysByKeyRegex(src, /(education|educations|educationHistory|academics|studies)$/i, 2)
      .flat();
    if (deep.length) eduSources = deep;
  }

  const education = (eduSources as any[]).map((ed: any) => ({
    degree:   String(ed?.degree ?? ed?.qualification ?? ed?.title ?? "").trim(),
    school:   String(ed?.school ?? ed?.institute ?? ed?.university ?? "").trim(),
    start:    String(ed?.start ?? ed?.from ?? ed?.startDate ?? ed?.dateFrom ?? "").trim(),
    end:      String(ed?.end ?? ed?.to ?? ed?.endDate ?? ed?.dateTo ?? "").trim(),
    location: String(ed?.location ?? ed?.city ?? "").trim(),
  }));

  // Languages
  const langRaw =
    takeArray(c0, ["languages", "languageSkills", "langs", "Languages"]) ||
    takeNestedArray(c0, [["languagesSection", "items"]]);
  const languages = (langRaw as any[])
    .map((l: any) => ({
      name: String(l?.name ?? l?.language ?? "").trim(),
      level: String(l?.level ?? l?.levelText ?? l?.proficiency ?? "").trim(),
      levelText: String(l?.levelText ?? l?.level ?? l?.proficiency ?? "").trim(),
    }))
    .filter((l) => l.name);

  const links = Array.isArray(c0.links) ? [...c0.links] : [];
  if (website && !links.some((l: any) => (l?.url || "") === website)) {
    links.push({ label: "Website", url: website });
  }
  if (linkedin && !links.some((l: any) => (l?.url || "") === linkedin)) {
    links.push({ label: "LinkedIn", url: linkedin });
  }

  const candidate = {
    fullName: fullName || "Candidate",
    name: fullName || "Candidate",
    title,
    summary,
    email,
    phone,
    linkedin,
    website,
    location,
    photoUrl,
    skills,
    experiences,
    education,
    languages,
    contacts: { email, phone, linkedin, website },
    links,
  };

  return { candidate, cv: src };
}
