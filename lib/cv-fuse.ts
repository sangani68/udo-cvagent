// lib/cv-fuse.ts
// Purpose: maximize field coverage in your editor after "Use this CV"
// Strategy: LLM JSON (primary) ⟶ rule parser (assist) ⟶ reconcile ⟶ strengthen
// Safe, idempotent, and shape-stable for your existing editor bindings.

import type { CVJson } from "./cvSchema";

export type PartialCV = Partial<CVJson> & {
  candidate?: Partial<CVJson["candidate"]> & {
    skills?: string[];
    experience?: Array<{
      employer?: string;
      role?: string;
      title?: string;
      start?: string;
      end?: string;
      location?: string;
      bullets?: Array<{ text: string } | string>;
    }>;
    education?: Array<{
      degree?: string;
      school?: string;
      start?: string;
      end?: string;
      location?: string;
    }>;
    languages?: Array<{ name?: string; level?: string }>;
  };
};

// Entry point used by ingest route
export function fuseCv(primary: PartialCV, assist: PartialCV): CVJson {
  const a = normalizeLoose(primary);
  const b = normalizeLoose(assist);

  // 1) Candidate top-level fields — prefer LLM, backfill from rules
  const cand = {
    name: pick(a.candidate?.name, b.candidate?.name),
    title: pick(a.candidate?.title, b.candidate?.title),
    summary: pick(a.candidate?.summary, b.candidate?.summary),
    location: pick(a.candidate?.location, b.candidate?.location),
    contacts: {
      email: pick(a.candidate?.contacts?.email, b.candidate?.contacts?.email),
      phone: pick(a.candidate?.contacts?.phone, b.candidate?.contacts?.phone),
      linkedin: pick(
        a.candidate?.contacts?.linkedin,
        b.candidate?.contacts?.linkedin
      ),
    },
  };

  // 2) Experience — align by (employer, role) or fuzzy window, then merge bullets/dates/locations
  const ex = mergeExperience(
    a.candidate?.experience || [],
    b.candidate?.experience || []
  );

  // 3) Education — dedupe by (school, degree)
  const ed = mergeEducation(
    a.candidate?.education || [],
    b.candidate?.education || []
  );

  // 4) Skills — union + ranked by frequency/priority keywords
  const skills = rankSkills([
    ...(a.candidate?.skills || []),
    ...(b.candidate?.skills || []),
  ]);

  // 5) Languages — dedupe by name, prefer CEFR level if provided
  const languages = mergeLanguages(
    a.candidate?.languages || [],
    b.candidate?.languages || []
  );

  return {
    candidate: {
      ...cand,
      skills,
      experience: ex,
      education: ed,
      languages,
    },
  } as CVJson;
}

// ──────────────────────────────────────────────────────────────
// Normalizers
// ──────────────────────────────────────────────────────────────
function normalizeLoose(cv: PartialCV): PartialCV {
  const c = cv?.candidate ?? {};

  const bullets = (bs: any[]): { text: string }[] =>
    (Array.isArray(bs) ? bs : [])
      .map((b) =>
        typeof b === "string" ? { text: b } : { text: (b?.text ?? "").toString() }
      )
      .map((b) => ({ text: b.text.replace(/\s+/g, " ").trim() }))
      .filter((b) => b.text.length > 0)
      .slice(0, 25);

  const experience = (((c as any).experience || []) as any[])
    .map((e) => ({
      employer: (e?.employer || (e as any)?.company || "")
        .toString()
        .trim(),
      role: (e?.role || (e as any)?.title || "").toString().trim(),
      start: (e?.start || (e as any)?.from || "").toString().trim(),
      end: (e?.end || (e as any)?.to || "").toString().trim(),
      location: (e?.location || "").toString().trim(),
      bullets: bullets((e?.bullets as any[]) || []),
    }))
    .filter(
      (e) => e.employer || e.role || e.start || e.end || e.bullets.length
    );

  const education = (((c as any).education || []) as any[])
    .map((ed) => ({
      degree: (ed?.degree || "").toString().trim(),
      school: (ed?.school || (ed as any)?.institute || "")
        .toString()
        .trim(),
      fieldOfStudy: (ed?.fieldOfStudy || (ed as any)?.field || (ed as any)?.area || "")
        .toString()
        .trim(),
      eqfLevel: (ed?.eqfLevel || (ed as any)?.eqf || (ed as any)?.levelEqf || "")
        .toString()
        .trim(),
      start: (ed?.start || "").toString().trim(),
      end: (ed?.end || "").toString().trim(),
      location: (ed?.location || "").toString().trim(),
    }))
    .filter((ed) => ed.degree || ed.school);

  const languages = (((c as any).languages || []) as any[])
    .map((l) => ({
      name: (l?.name || (l as any)?.language || "").toString().trim(),
      level: (l?.level || (l as any)?.proficiency || "")
        .toString()
        .trim(),
    }))
    .filter((l) => l.name);

  const skills = dedupe(
    (((c as any).skills || []) as any[])
      .map((s) =>
        (typeof s === "string" ? s : (s as any)?.name || "")
          .toString()
          .trim()
      )
      .filter(Boolean)
  );

  // Cast to PartialCV so TS doesn’t insist on required candidate.name here
  return {
    candidate: { ...c, experience, education, languages, skills },
  } as PartialCV;
}

// ──────────────────────────────────────────────────────────────
// Mergers
// ──────────────────────────────────────────────────────────────
function mergeExperience(a: any[], b: any[]) {
  const out: any[] = [];
  const used = new Set<number>();

  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    let match = -1;
    for (let j = 0; j < b.length; j++) {
      if (used.has(j)) continue;
      if (sameRole(ai, b[j])) {
        match = j;
        break;
      }
    }
    if (match >= 0) {
      const bj = b[match];
      used.add(match);
      out.push(mergeRole(ai, bj));
    } else {
      out.push(ai);
    }
  }

  for (let j = 0; j < b.length; j++) {
    if (!used.has(j)) out.push(b[j]);
  }

  // cleanup: date normalization and bullet dedupe
  return out.map(fixDates).map(dedupeBullets);
}

function sameRole(x: any, y: any) {
  const em =
    norm(x.employer) &&
    norm(y.employer) &&
    norm(x.employer) === norm(y.employer);
  const rl =
    norm(x.role) && norm(y.role) && norm(x.role) === norm(y.role);
  const window = overlapYear(x, y);
  return (em && (rl || window)) || (rl && window);
}

function mergeRole(a: any, b: any) {
  return {
    employer: pick(a.employer, b.employer),
    role: pick(a.role, b.role),
    start: pick(a.start, b.start),
    end: pick(a.end, b.end),
    location: pick(a.location, b.location),
    bullets: dedupe(
      [...(a.bullets || []), ...(b.bullets || [])].map(asBullet)
    ).slice(0, 25),
  };
}

function mergeEducation(a: any[], b: any[]) {
  const key = (e: any) => `${norm(e.school)}|${norm(e.degree)}`;
  const map = new Map<string, any>();
  [...a, ...b].forEach((e) => {
    const k = key(e);
    if (!map.has(k)) map.set(k, e);
    else map.set(k, mergeEdu(map.get(k), e));
  });
  return [...map.values()].map(fixDates);
}

function mergeEdu(a: any, b: any) {
  return {
    degree: pick(a.degree, b.degree),
    school: pick(a.school, b.school),
    start: pick(a.start, b.start),
    end: pick(a.end, b.end),
    location: pick(a.location, b.location),
  };
}

function mergeLanguages(a: any[], b: any[]) {
  const map = new Map<string, string>();
  for (const l of [...a, ...b]) {
    const name = capitalize((l?.name || "").toString());
    if (!name) continue;
    const level = (l?.level || "").toString().toUpperCase();
    // prefer CEFR levels or non-empty over empty
    const prev = map.get(name);
    if (!prev || (isCEFR(level) && !isCEFR(prev))) map.set(name, level);
    else if (!prev && level) map.set(name, level);
  }
  return [...map.entries()].map(([name, level]) => ({ name, level }));
}

// ──────────────────────────────────────────────────────────────
// Strengtheners & fixups
// ──────────────────────────────────────────────────────────────
function fixDates<T extends { start?: string; end?: string }>(e: T): T {
  const clean = (s?: string) =>
    (s || "")
      .replace(/\b(present|current|now)\b/i, "Present")
      .trim();
  const start = clean(e.start);
  const end = clean(e.end);
  return { ...e, start, end };
}

function dedupeBullets<T extends { bullets?: { text: string }[] }>(e: T): T {
  const texts = new Set<string>();
  const bullets = (e.bullets || []).filter((b) => {
    const t = (b?.text || "").replace(/\s+/g, " ").trim();
    if (!t || texts.has(t)) return false;
    texts.add(t);
    return true;
  });
  return { ...e, bullets };
}

function rankSkills(all: string[]) {
  const freq = new Map<string, number>();
  for (const s of all.map((x) => x.trim()).filter(Boolean)) {
    const key = s.toLowerCase();
    freq.set(key, (freq.get(key) || 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => titlecase(k))
    .slice(0, 80);
}

// ──────────────────────────────────────────────────────────────
// Utils
// ──────────────────────────────────────────────────────────────
function pick<T>(...vals: (T | undefined)[]): T | undefined {
  for (const v of vals) if (v != null && String(v).trim()) return v as T;
  return undefined as any;
}
function norm(s?: string) {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}
function asBullet(b: any) {
  return typeof b === "string"
    ? { text: b }
    : { text: (b?.text || "").toString() };
}
function overlapYear(a: any, b: any) {
  const ay = yearIn(a.start) || yearIn(a.end);
  const by = yearIn(b.start) || yearIn(b.end);
  return ay && by && Math.abs(ay - by) <= 1; // loose window
}
function yearIn(s?: string) {
  const m = (s || "").match(/(20\d{2}|19\d{2})/);
  return m ? +m[1] : 0;
}
function dedupe<T>(arr: T[]) {
  return Array.from(new Set(arr));
}
function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
}
function titlecase(s: string) {
  return s
    .split(/\s+/)
    .map(capitalize)
    .join(" ");
}
function isCEFR(s: string) {
  return /^(A1|A2|B1|B2|C1|C2|NATIVE|MOTHER)/i.test(s);
}
