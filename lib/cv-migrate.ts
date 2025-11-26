// lib/cv-migrate.ts
type AnyObj = Record<string, any>;
const asArray = (v: any) => (Array.isArray(v) ? v : v ? [v] : []);
const clean = (s: any) => (typeof s === "string" ? s.trim() : s ?? "");
const toLines = (v: any) =>
  asArray(v)
    .map((x) => (typeof x === "string" ? x : x?.text || x?.value || ""))
    .join("\n");

/** Main migrator used by the editor + templates */
export function migrateCvShape(input: AnyObj = {}): AnyObj {
  const cv = { ...(input || {}) };
  const candidate = cv.candidate || {};
  const identity = cv.identity || {};
  const contact = cv.contact || {};
  const meta = cv.meta || {};
  const sourceText: string = typeof meta?.sourceText === "string" ? meta.sourceText : "";

  /* ---------- Identity ---------- */
  const name =
    clean(identity.name) ||
    clean(identity.fullName) ||
    clean(candidate.fullName) ||
    clean(candidate.name) ||
    clean(cv.name);
  const title =
    clean(identity.title) ||
    clean(candidate.title) ||
    clean(cv.title);
  const email =
    clean(identity.email) ||
    clean(contact.email) ||
    clean(candidate.email) ||
    clean(cv.email);
  const phone =
    clean(identity.phone) ||
    clean(contact.phone) ||
    clean(candidate.phone) ||
    clean(cv.phone);
  const location =
    clean(identity.location) ||
    clean(contact.location) ||
    clean(candidate.location) ||
    clean(cv.location);
  const photoUrl =
    clean(identity.photoUrl) ||
    clean(candidate.photoUrl) ||
    clean(cv.photoUrl);

  /* ---------- Summary ---------- */
  const summary =
    clean(cv.summary) ||
    clean(cv.profile) ||
    clean(candidate.summary) ||
    clean(cv.about) ||
    (sourceText ? takeFirstParagraph(stripNoise(sourceText)) : "");

  /* ---------- Skills ---------- */
  let skills: string[] = [];
  const skillsSrc =
    cv.skills ?? candidate.skills ?? cv.skill ?? candidate.skill ?? cv.coreSkills ?? cv.technicalSkills;
  if (Array.isArray(skillsSrc)) {
    skills = skillsSrc
      .map((s: any) => (typeof s === "string" ? s : s?.name || s?.text || ""))
      .map((s: string) => s.trim())
      .filter(Boolean);
  } else if (typeof skillsSrc === "string") {
    skills = skillsSrc.split(/[,\n;•\-–]+/).map((s) => s.trim()).filter(Boolean);
  } else if (!skills.length && sourceText) {
    skills = extractSkillsHeuristic(sourceText);
  }

  /* ---------- Experience ---------- */
  const expSrc: any[] = [
    ...asArray(cv.experience),
    ...asArray(cv.experiences),
    ...asArray(candidate.experience),
    ...asArray(candidate.experiences),
    ...asArray(cv.work),
    ...asArray(cv.workExperience),
    ...asArray(cv.employment),
    ...asArray(cv.employmentHistory),
    ...asArray(cv.professionalExperience),
    ...asArray(cv.positions),
    ...asArray(cv.roles),
  ];
  let experience = expSrc.map(normalizeExperienceItem).filter(hasAnyExperience);
  if ((!experience || experience.length === 0) && sourceText) {
    experience = parseExperienceFromText(sourceText);
  }

  /* ---------- Education ---------- */
  const eduSrc: any[] = [
    ...asArray(cv.education),
    ...asArray(candidate.education),
    ...asArray(cv.educationHistory),
    ...asArray(cv.studies),
    ...asArray(cv.academic),
    ...asArray(cv.academics),
  ];
  let education = eduSrc.map(normalizeEducationItem).filter(hasAnyEducation);
  if ((!education || education.length === 0) && sourceText) {
    education = parseEducationFromText(sourceText);
  }

  /* ---------- Languages ---------- */
  const langSrc: any[] = [...asArray(cv.languages), ...asArray(candidate.languages)];
  const languages = langSrc
    .map((l: any) => ({ name: clean(l?.name || l?.language), level: clean(l?.level || l?.proficiency) }))
    .filter((l) => l.name);

  /* ---------- Certifications ---------- */
  const certSrc: any[] = [
    ...asArray(cv.certifications),
    ...asArray(candidate.certifications),
    ...asArray(cv.certs),
    ...asArray(cv.licenses),
    ...asArray(cv.licensesCertifications),
    ...asArray(cv.certificates),
    ...asArray(cv.trainings),
    ...asArray(cv.awards),
    ...asArray(cv.courses),
    ...asArray(cv.accomplishments),
    ...asArray(cv.other),
  ];
  let certifications = certSrc
    .map((c: any) => {
      const name = clean(c?.name || c?.title || c?.certificate || c?.course || c?.credential || c?.license || c?.award);
      const issuer = clean(c?.issuer || c?.organization || c?.authority || c?.provider);
      const date = clean(c?.date || c?.issued || c?.year || c?.obtained || c?.completed || c?.expiry);
      return name ? { name: issuer ? `${name} (${issuer})` : name, date } : null;
    })
    .filter(Boolean) as Array<{ name: string; date?: string }>;

  if ((!certifications || certifications.length === 0) && sourceText) {
    certifications = extractCertsFromText(sourceText);
  }

  return {
    identity: { name, title, email, phone, location, photoUrl },
    summary,
    skills,
    experience,
    education,
    languages,
    certifications,
    meta: { ...meta, locale: meta?.locale || "en" },
  };
}

/* ───────── Normalizers ───────── */

function normalizeExperienceItem(e: any) {
  const bulletsRaw =
    e?.bullets ??
    e?.highlights ??
    e?.responsibilities ??
    e?.achievements ??
    e?.points ??
    e?.tasks ??
    (e?.description ? e.description.split(/\n+/) : []) ??
    [];
  const bullets = asArray(bulletsRaw)
    .map((b: any) => (typeof b === "string" ? b : b?.text || b?.value || ""))
    .map((s: string) => s.trim())
    .filter(Boolean);

  const start = clean(e?.start || e?.from || e?.startDate || e?.period?.from || e?.period?.start);
  const end = clean(e?.end || e?.to || e?.endDate || e?.period?.to || e?.period?.end);

  return {
    title: clean(e?.title || e?.role || e?.position),
    company: clean(e?.company || e?.employer || e?.organization || e?.org || e?.companyName),
    start,
    end,
    location: clean(e?.location),
    bullets: bullets.map((t) => ({ text: t })),
  };
}
const hasAnyExperience = (x: any) => !!(x?.title || x?.company || (x?.bullets && x.bullets.length));

function normalizeEducationItem(ed: any) {
  const details =
    clean(ed?.details) ||
    clean(ed?.summary) ||
    clean(ed?.specialization) ||
    toLines(ed?.notes);
  return {
    title: clean(ed?.title || ed?.degree || ed?.qualification || ed?.program || ed?.field),
    org: clean(ed?.org || ed?.institution || ed?.school || ed?.university || ed?.college),
    start: clean(ed?.start || ed?.from || ed?.startDate || ed?.period?.from || ed?.period?.start),
    end: clean(ed?.end || ed?.to || ed?.endDate || ed?.period?.to || ed?.period?.end),
    location: clean(ed?.location),
    details,
  };
}
const hasAnyEducation = (x: any) => !!(x?.title || x?.org || x?.details);

/* ───────── Text heuristics (for PPTX/text-only cases) ───────── */

function stripNoise(t: string) {
  return t
    .replace(/\r/g, "")
    .replace(/[•●▪◦◆■]/g, "•")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\{[0-9A-Fa-f\-]{8,}\}/g, "")
    .replace(/\b(?:Arial|Calibri|Webdings|Wingdings)\b[^ \n]{0,40}/g, "")
    .replace(/^\d{3,}(?:\s+\d{3,}){2,}$/gm, "")
    .replace(/^\d{4,}$/gm, "")
    .replace(/^(?:rect|auto|base|line|body|group)\b.*$/gmi, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function takeFirstParagraph(t: string) {
  const clean = stripNoise(t);
  const para = clean.split(/\n\s*\n/)[0] || clean.split("\n").slice(0, 6).join(" ");
  return (para || "").slice(0, 900);
}

function extractSkillsHeuristic(t: string) {
  const clean = stripNoise(t);
  const m = clean.match(/(?:^|\n)\s*(?:Key\s+Skills?|Skills?|Technical\s+Skills?)\s*:?\s*\n([\s\S]+?)(?:\n[A-Z][^\n]{2,}\n|$)/i);
  const block = m?.[1] || "";
  return block
    .split(/[,\n;•\-–]+/)
    .map((s) => s.trim())
    .filter((s) => s && s.length <= 60)
    .slice(0, 50);
}

function parseExperienceFromText(t: string) {
  const lines = stripNoise(t)
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  // Narrow to EXPERIENCE section if present
  let start = lines.findIndex((l) => /^experience\b/i.test(l));
  let end = -1;
  if (start >= 0) {
    end = lines.slice(start + 1).findIndex((l) => /^[A-Z][A-Za-z ]{2,}$/.test(l));
    if (end >= 0) end = start + 1 + end;
    else end = lines.length;
    // keep a generous window
    lines.splice(0, start + 1);
    lines.splice(end - (start + 1));
  }

  const isRoleLine = (ln: string) =>
    // "Senior Managing Consultant | Kyndryl India/Luxembourg | Mar 2021 - Today"
    /.+\|\s*.+/.test(ln) ||
    // "SE II | Winjit Technologies"
    /^[A-Za-z].{2,}\s\|\s*[A-Za-z].{1,}$/.test(ln);

  const roles: {
    title: string;
    company: string;
    location?: string;
    start?: string;
    end?: string;
    bullets: string[];
  }[] = [];

  let i = 0;
  while (i < lines.length) {
    const ln = lines[i];

    if (isRoleLine(ln)) {
      const segs = ln.split("|").map((s) => s.trim());
      const title = (segs[0] || "").trim();
      const companyPlus = (segs[1] || "").trim();
      const datesSeg = (segs[2] || "").trim();

      // Try to split company/location from "Company City/Country"
      let company = companyPlus;
      let location = "";
      if (/,|\/|\s\|\s/.test(companyPlus) || /\b[A-Za-z]+\/[A-Za-z]+\b/.test(companyPlus)) {
        // detect things like "Kyndryl India/Luxembourg"
        const m = companyPlus.match(/^(.+?)\s+([A-Za-z][A-Za-z/ ,]+)$/);
        if (m) {
          company = m[1].trim();
          location = m[2].trim();
        }
      }

      let start = "";
      let end = "";

      const parseDates = (s: string) => {
        if (!s) return { start: "", end: "" };
        const norm = s.replace(/\s*-\s*/g, " ").replace(/\|\s*/g, " ").replace(/\s{2,}/g, " ").trim();
        // Try "Mar 2016 Feb 2017" / "March 2021 today"
        const months = "(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*";
        const re = new RegExp(`(${months}\\s+\\d{4})\\s+(to|–|-|—)?\\s*(Today|Present|${months}\\s+\\d{4})?`, "i");
        const m = norm.match(re);
        if (m) {
          start = (m[1] || "").trim();
          end = (m[3] || "").trim();
        } else {
          // Maybe pure years "2012 2014"
          const y = norm.match(/\b(19|20)\d{2}\b/g);
          if (y && y.length >= 1) {
            start = y[0];
            end = y[1] || "";
          }
        }
        return { start, end };
      };

      ({ start, end } = parseDates(datesSeg || companyPlus));

      // Collect bullets until next role/header
      const bullets: string[] = [];
      i++;
      while (i < lines.length && !isRoleLine(lines[i]) && !/^[A-Z][A-Z ]{3,}$/.test(lines[i])) {
        let b = lines[i].replace(/^•\s*/, "").trim();
        if (b && !looksLikeNoise(b)) bullets.push(b);
        i++;
      }

      // de-duplicate bullets (PPTX often repeats)
      const unique = Array.from(new Set(bullets));

      roles.push({
        title,
        company,
        location,
        start,
        end,
        bullets: unique,
      });
      continue;
    }

    i++;
  }

  return roles
    .filter((r) => r.title || r.company || r.bullets.length)
    .map((r) => ({
      title: r.title,
      company: r.company,
      location: r.location,
      start: r.start,
      end: r.end,
      bullets: r.bullets.map((t) => ({ text: t })),
    }));
}

function parseEducationFromText(t: string) {
  const lines = stripNoise(t)
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  // Find EDUCATION block if present
  let start = lines.findIndex((l) => /^education\b/i.test(l));
  if (start < 0) return [];
  let end = lines.slice(start + 1).findIndex((l) => /^[A-Z][A-Za-z ]{2,}$/.test(l));
  if (end >= 0) end = start + 1 + end;
  else end = lines.length;

  const block = lines.slice(start + 1, end);
  const out: any[] = [];

  // Simple: treat each non-empty line as one entry (PPTX usually a sentence per degree)
  for (const ln of block) {
    if (looksLikeNoise(ln)) continue;
    const degree = ln; // keep whole sentence
    out.push({
      title: degree,
      org: "",
      start: "",
      end: "",
      location: "",
      details: "",
    });
  }
  return out;
}

function extractCertsFromText(text: string) {
  const clean = stripNoise(text);
  const lines = clean
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  // Prefer a Certifications/Trainings section, otherwise scan whole text
  const sectionMatch = clean.match(
    /(?:^|\n)\s*(TRAININGS?\s*&\s*CERTIFICATIONS?|CERTIFICATIONS?|LICENSES?)\s*:?\s*\n([\s\S]+?)(?:\n[A-Z][^\n]{2,}\n|$)/i
  );
  const candidate = (sectionMatch?.[2] || clean)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const vendorHints = /(aws|azure|microsoft|google|gcp|oracle|cisco|pmp|itil|scrum|salesforce|sap|red hat|comptia)/i;
  const codeHints = /\b(AZ|AI|DP|SC|MB|PL|MS|MD|DA|SY|CKA|CKAD|CCNA|CCNP|CCIE|PMP|ITIL|PRINCE2|GCP|OCI)[\s-]?\d{0,3}\b/i;

  const dropNoise = (s: string) =>
    s.length < 2 ||
    looksLikeNoise(s) ||
    /^●+$/.test(s) ||
    /^[-–—]+$/.test(s) ||
    /^Languages?$/i.test(s) ||
    /^Issue Based Consulting$/i.test(s);

  // Known phrasing to capture (your sample contains these)
  const knownCertPhrases = [
    /Microsoft\s+Azure\s+Solutions\s+Architect\s+Expert/i,
    /Google\s+Cloud\s+Professional\s+Architect/i,
    /Agile\s+Explorer/i,
  ];

  const out: Array<{ name: string; date?: string }> = [];

  for (const ln of candidate) {
    if (dropNoise(ln)) continue;

    // bullets or plain lines
    const name = ln.replace(/^•\s*/, "").trim();

    // Match known phrases immediately
    if (knownCertPhrases.some((re) => re.test(name))) {
      pushUnique(out, { name });
      continue;
    }

    // Otherwise require a weak signal (vendor/keyword/code)
    if (vendorHints.test(name) || codeHints.test(name) || /certifi(ed|cation|cate)/i.test(name)) {
      // Avoid obvious non-certs like "Issue Based Consulting"
      if (/consulting|governance|methodology/i.test(name) && !/cert/i.test(name)) continue;
      pushUnique(out, { name });
    }
  }

  // Limit & return
  return out.slice(0, 25);
}

function looksLikeNoise(s: string) {
  if (!s) return true;
  if (/^http/i.test(s)) return true;
  if (/\{[0-9A-Fa-f\-]{8,}\}/.test(s)) return true;
  if (/^[0-9 ]{6,}$/.test(s)) return true;
  if (/^(rect|auto|base|line|body|group)\b/i.test(s)) return true;
  if (/^(Arial|Calibri|Webdings|Wingdings)\b/i.test(s)) return true;
  if (/^●+$/.test(s)) return true;
  return false;
}

/* ───────── small utils ───────── */

function pushUnique(arr: Array<{ name: string; date?: string }>, item: { name: string; date?: string }) {
  const exists = arr.some((x) => x.name.toLowerCase() === item.name.toLowerCase());
  if (!exists) arr.push(item);
}
