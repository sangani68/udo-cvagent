// lib/cvSchema.ts

/* ------------ Types (stable across the app) ------------ */
export type Bullet = { text: string };

export type ExperienceItem = {
  employer?: string;
  role?: string; // aka title
  start?: string;
  end?: string;
  location?: string;
  bullets: Bullet[];
};

export type EducationItem = {
  degree?: string;
  school?: string;
  fieldOfStudy?: string;
  eqfLevel?: string;
  start?: string;
  end?: string;
  location?: string;
};

export type ProjectItem = {
  name?: string;
  role?: string;
  start?: string;
  end?: string;
  summary?: string;
  bullets?: Bullet[];
};

export type SimpleItem = {
  name?: string;
  issuer?: string;
  start?: string;
  end?: string;
  date?: string;
  url?: string;
};

export type CVJson = {
  meta?: { locale?: string; source?: string };
  candidate: {
    name: string;
    title?: string;
    summary?: string;
    location?: string;
    contacts?: { email?: string; phone?: string; linkedin?: string; website?: string };
    skills?: string[];
    languages?: { name: string; level?: string }[]; // keep languages section last in templates
    links?: { label?: string; url: string }[];
    photoDataUrl?: string; // data URL
  };
  experience?: ExperienceItem[];
  education?: EducationItem[];
  projects?: ProjectItem[];
  certificates?: SimpleItem[];
  awards?: SimpleItem[];
  publications?: SimpleItem[];
};

/* ------------------ Helpers ------------------ */
const asStr = (v: any) => (typeof v === "string" ? v.trim() : String(v ?? "").trim());

const asArray = <T = any>(v: any): T[] => (Array.isArray(v) ? v : v ? [v] : []);

const bulletize = (v: any): Bullet[] =>
  asArray(v)
    .map((b) => {
      if (typeof b === "string") return { text: b.trim() };
      const t = asStr(b?.text);
      return t ? { text: t } : null;
    })
    .filter(Boolean) as Bullet[];

const normalizeSkills = (v: any): string[] =>
  asArray(v)
    .map((s) => (typeof s === "string" ? s.trim() : asStr(s?.name)))
    .map((s) => s.replace(/^[-•·–—]\s*/, "")) // drop bullet glyphs
    .filter((s) => !!s && s.length <= 60);

/* ----------------- The migrator ----------------- */
/**
 * Accepts anything roughly CV-shaped and returns a strict CVJson.
 * This ensures bullets are objects, skills are string[], dates are strings, etc.
 */
export function migrateCvShape(input: any): CVJson {
  const candIn =
    input?.candidate ??
    input?.data?.candidate ??
    input?.result?.candidate ??
    {};

  const name = asStr(candIn?.name || input?.candidateName || "Candidate");

  const contacts = {
    email: asStr(candIn?.contacts?.email || candIn?.email || ""),
    phone: asStr(candIn?.contacts?.phone || candIn?.phone || ""),
    linkedin: asStr(candIn?.contacts?.linkedin || candIn?.linkedin || ""),
    website: asStr(candIn?.contacts?.website || candIn?.website || ""),
  };
  // drop empty contact fields
  Object.keys(contacts).forEach((k) => {
    if (!(contacts as any)[k]) delete (contacts as any)[k];
  });

  const skills = normalizeSkills(candIn?.skills ?? input?.skills ?? []);
  const languages = asArray(candIn?.languages).map((l) => ({
    name: asStr(l?.name || l?.language),
    level: asStr(l?.level || l?.proficiency),
  })).filter((l) => l.name);

  const experienceIn =
    input?.experience ??
    candIn?.experience ??
    input?.candidate?.experience ??
    [];
  const experience: ExperienceItem[] = asArray(experienceIn).map((e) => ({
    employer: asStr(e?.employer),
    role: asStr(e?.role || e?.title),
    start: asStr(e?.start),
    end: asStr(e?.end),
    location: asStr(e?.location),
    bullets: bulletize(e?.bullets || e?.items || e?.points),
  }));

  const educationIn = input?.education ?? candIn?.education ?? [];
  const education: EducationItem[] = asArray(educationIn).map((ed) => ({
    degree: asStr(ed?.degree),
    school: asStr(ed?.school || ed?.institute),
    fieldOfStudy: asStr(
      ed?.fieldOfStudy ||
        ed?.field ||
        ed?.studyField ||
        ed?.major ||
        ed?.specialization ||
        ed?.area
    ),
    eqfLevel: asStr(ed?.eqfLevel || ed?.eqf || ed?.levelEqf || ed?.level),
    start: asStr(ed?.start),
    end: asStr(ed?.end),
    location: asStr(ed?.location),
  }));

  const projectsIn = input?.projects ?? [];
  const projects: ProjectItem[] = asArray(projectsIn).map((p) => ({
    name: asStr(p?.name || p?.title),
    role: asStr(p?.role),
    start: asStr(p?.start),
    end: asStr(p?.end),
    summary: asStr(p?.summary),
    bullets: bulletize(p?.bullets),
  }));

  const meta = {
    locale: asStr(input?.meta?.locale || "en"),
    source: asStr(input?.meta?.source || ""),
  };
  if (!meta.source) delete (meta as any).source;

  const cv: CVJson = {
    meta,
    candidate: {
      name,
      title: asStr(candIn?.title),
      summary: asStr(candIn?.summary),
      location: asStr(candIn?.location),
      contacts: Object.keys(contacts).length ? contacts : undefined,
      skills,
      languages,
      links: asArray(candIn?.links)
        .map((l) => {
          const url = asStr(l?.url);
          const label = asStr(l?.label);
          if (!url) return null;
          return { url, label: label || undefined };
        })
        .filter(Boolean) as { label?: string; url: string }[],
      photoDataUrl: asStr(candIn?.photoDataUrl),
    },
    experience,
    education,
    projects,
    certificates: asArray(
      input?.certificates ||
        input?.candidate?.certificates ||
        input?.candidate?.certifications ||
        input?.candidate?.certs
    ),
    awards: asArray(input?.awards),
    publications: asArray(input?.publications),
  };

  // Clean empty arrays/strings
  if (!cv.candidate.skills?.length) delete cv.candidate.skills;
  if (!cv.candidate.languages?.length) delete cv.candidate.languages;
  if (!cv.experience?.length) delete cv.experience;
  if (!cv.education?.length) delete cv.education;
  if (!cv.projects?.length) delete cv.projects;
  if (!cv.certificates?.length) delete cv.certificates;
  if (!cv.awards?.length) delete cv.awards;
  if (!cv.publications?.length) delete cv.publications;
  if (!cv.candidate.photoDataUrl) delete cv.candidate.photoDataUrl;
  if (!cv.candidate.summary) delete cv.candidate.summary;
  if (!cv.candidate.title) delete cv.candidate.title;
  if (!cv.candidate.location) delete cv.candidate.location;
  if (!cv.candidate.contacts) delete cv.candidate.contacts;

  return cv;
}

/* Optional: a tiny runtime guard */
export function isCVJson(v: any): v is CVJson {
  return !!v && typeof v === "object" && !!v.candidate && typeof v.candidate.name === "string";
}
