// lib/ep-docx.ts
import dayjs from "dayjs";
import type { CvData } from "./cv-view";

/** Keep it loose/tolerant, but aligned with CvData from toPreviewModel */
type AnyRec = Record<string, any>;

// ─────────────────────────────────────────────────────────────
// Small utilities
// ─────────────────────────────────────────────────────────────
const S = (v: any, fb = "") => (v == null ? fb : String(v).trim());
const A = (v: any) => (Array.isArray(v) ? v : v == null ? [] : [v]);

function fmtDate(d?: any) {
  if (!d) return "";
  const m = dayjs(d);
  return m.isValid() ? m.format("DD/MM/YYYY") : S(d);
}

function firstNonEmpty(...vals: any[]) {
  for (const v of vals) {
    const s = S(v);
    if (s) return s;
  }
  return "";
}

// ─────────────────────────────────────────────────────────────
// Name parsing: accept string ("John R. Doe") or object ({first,last})
// ─────────────────────────────────────────────────────────────
function normalizeName(name: any) {
  if (!name) return { first: "", last: "", full: "" };
  if (typeof name === "object") {
    const first = S(name.first);
    const last = S(name.last);
    const full = firstNonEmpty(name.full, `${first} ${last}`.trim());
    return { first, last, full: full || (first || last) };
  }
  const full = S(name);
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "", full: "" };
  if (parts.length === 1) return { first: parts[0], last: "", full };
  const last = parts.pop() as string;
  const first = parts.join(" ");
  return { first, last, full };
}

// ─────────────────────────────────────────────────────────────
// Languages
// ─────────────────────────────────────────────────────────────
function normalizeLanguages(langs: any): Array<AnyRec> {
  const list = Array.isArray(langs) ? langs : [];
  const norm = (x: any) => {
    if (typeof x === "string") return { language: S(x) };
    const name = firstNonEmpty(x?.name, x?.language);
    const levelObj = x?.level || {};
    const speaking = firstNonEmpty(x?.speaking, levelObj.speaking, x?.oral, x?.conversation);
    const listening = firstNonEmpty(x?.listening, levelObj.listening);
    const writing = firstNonEmpty(x?.writing, levelObj.writing);
    const reading = firstNonEmpty(x?.reading, levelObj.reading);
    const single = firstNonEmpty(x?.level, x?.proficiency);
    const fallback = (v: string) => (v ? v : single);
    return {
      language: S(name),
      speaking: S(fallback(speaking)),
      listening: S(fallback(listening)),
      writing: S(fallback(writing)),
      reading: S(fallback(reading)),
    };
  };
  return list.map(norm).filter((l) => S(l.language));
}

// ─────────────────────────────────────────────────────────────
// Trainings
// ─────────────────────────────────────────────────────────────
function normalizeTrainings(arr: any): Array<AnyRec> {
  const list = Array.isArray(arr) ? arr : [];
  return list
    .map((t) => ({
      title: firstNonEmpty(t?.title, t?.name, t?.course),
      provider: firstNonEmpty(t?.provider, t?.org, t?.company, t?.issuer),
      hours: S(t?.hours),
      certificate: firstNonEmpty(t?.certificate, t?.exam, t?.result),
      date: fmtDate(firstNonEmpty(t?.date, t?.when)),
    }))
    .filter((t) => S(t.title));
}

// ─────────────────────────────────────────────────────────────
// Software expertise
// ─────────────────────────────────────────────────────────────
function normalizeSoftware(arr: any): Array<AnyRec> {
  const list = Array.isArray(arr) ? arr : [];
  return list
    .map((x) => ({
      tool: firstNonEmpty(x?.tool, x?.name, x?.technology),
      years: S(firstNonEmpty(x?.years, x?.experienceYears, x?.exp)),
      description: S(x?.description),
    }))
    .filter((x) => S(x.tool));
}

// ─────────────────────────────────────────────────────────────
// Experience → EP Work blocks
// ─────────────────────────────────────────────────────────────
function normalizeWork(exp: any): Array<AnyRec> {
  const list = Array.isArray(exp) ? exp : [];
  return list
    .map((e) => {
      const title = firstNonEmpty(e?.project, e?.title, e?.role, e?.position);
      const employerCombined = [S(e?.employer), S(e?.company), S(e?.organization)]
        .filter(Boolean)
        .join(" / ");

      const start = fmtDate(e?.start ?? e?.from ?? e?.startDate ?? e?.dateFrom);
      const end = e?.current ? "Ongoing" : fmtDate(e?.end ?? e?.to ?? e?.endDate ?? e?.dateTo);
      const dates = [start || "..", end || "..."].filter(Boolean).join(" – ");

      const rolesRaw =
        (Array.isArray(e?.bullets) ? e?.bullets : e?.responsibilities) ?? [];
      const rolesList = A(rolesRaw)
        .map((r: any) => (typeof r === "string" ? r : r?.text))
        .filter(Boolean);

      const techs = A(e?.technologies ?? e?.tools)
        .map((t: any) => (typeof t === "string" ? t : t?.name))
        .filter(Boolean);

      return {
        project_name: S(title),
        employer: S(employerCombined),
        dates,
        man_days: S(e?.manDays ?? e?.effort),
        client: S(e?.client),
        project_size: S(e?.projectSize),
        project_description: S(e?.description ?? e?.summary),
        roles_responsibilities: rolesList,
        technologies: techs,
        last_update: fmtDate(e?.lastUpdated ?? e?.updatedAt),
      };
    })
    .filter(
      (w) =>
        S(w.project_name) ||
        S(w.employer) ||
        S(w.project_description)
    );
}

// ─────────────────────────────────────────────────────────────
// Main mapping
// ─────────────────────────────────────────────────────────────
export function toEpFormData(data: CvData) {
  const d = (data || {}) as AnyRec;
  const c = (d.candidate || {}) as AnyRec;

  // Name handling
  const nm = normalizeName(c?.fullName || c?.name || d?.name);

  // Identity & profile
  const employer = firstNonEmpty(c?.employer, c?.currentEmployer, d?.employer);
  const currentFunction = firstNonEmpty(c?.currentRole, c?.title, d?.title, d?.role);
  const profileLevel = firstNonEmpty(c?.profileLevel, c?.seniority);
  const scRef = S(c?.scReference);

  // Education
  const eduArr = Array.isArray(c?.education) ? c.education : [];
  const hq = c?.highestQualification || eduArr[0] || {};
  const highestLevel = firstNonEmpty(hq?.level, hq?.grade, eduArr[0]?.level);
  const degreeName = firstNonEmpty(hq?.name, hq?.degree, eduArr[0]?.degree);
  const institute = firstNonEmpty(
    hq?.institute,
    hq?.institution,
    eduArr[0]?.school,
    eduArr[0]?.institution
  );
  const degreeDate = firstNonEmpty(hq?.date, eduArr[0]?.date, eduArr[0]?.end);

  const itStart = firstNonEmpty(c?.itCareerStartDate, c?.careerStart, d?.careerStart);

  // Specialised expertise
  const specialised = firstNonEmpty(
    c?.specialisedExpertise,
    c?.summary,
    c?.about,
    d?.summary,
    d?.about
  );

  // Contact
  const addr = c?.address || {};
  const contacts = c?.contacts || {};
  const locationCity = firstNonEmpty(c?.location, addr?.city);

  // Tables / lists
  const languages = normalizeLanguages(c?.languages);

  const languages_summary = languages
    .map((l: AnyRec) => {
      const parts = [S(l.language)];
      const levels = [l.speaking, l.listening, l.writing, l.reading]
        .map((x: any) => S(x))
        .filter(Boolean);
      if (levels.length) parts.push(`(${levels.join("/")})`);
      return parts.join(" ");
    })
    .filter(Boolean)
    .join("; ");

  const trainings = normalizeTrainings(c?.trainings);
  const certs = Array.isArray(c?.certifications) ? c.certifications : [];
  const certTrainings = certs.map((x: AnyRec) => {
    const title = firstNonEmpty(x?.name, x?.title, x?.certification);
    const provider = firstNonEmpty(x?.issuer, x?.org, x?.company, x?.institute);
    const date = firstNonEmpty(
      x?.date,
      x?.validUntil,
      x?.expiry,
      [x?.start, x?.end].filter(Boolean).join(" – ")
    );
    return {
      title: S(title),
      provider: S(provider),
      certificate: S(x?.certificate || ""),
      date: S(date),
    };
  }).filter((t: AnyRec) => t.title || t.provider || t.date);
  trainings.push(...certTrainings);
  const software = normalizeSoftware(c?.software ?? c?.tools);

  const work = normalizeWork(
    c?.experiences ??
      d?.experience ??
      d?.experiences ??
      d?.candidate?.experiences
  );

  // Flatten lists into big text blocks for scalar placeholders
  const trainings_text = trainings
    .map((t) => {
      const bits = [
        S(t.title),
        S(t.provider),
        S(t.certificate),
        S(t.date),
      ].filter(Boolean);
      return bits.join(" – ");
    })
    .filter(Boolean)
    .join("\n");

  const software_text = software
    .map((s) => {
      const bits = [
        S(s.tool),
        S(s.years),
        S(s.description),
      ].filter(Boolean);
      return bits.join(" – ");
    })
    .filter(Boolean)
    .join("\n");

  const work_experience_text = work
    .map((w, idx) => {
      const header = `${idx + 1}. ${S(w.project_name) || S(w.employer)}`;
      const lines: string[] = [header];

      if (S(w.employer)) lines.push(`Employer: ${S(w.employer)}`);
      if (S(w.dates)) lines.push(`Dates: ${S(w.dates)}`);
      if (S(w.client)) lines.push(`Client: ${S(w.client)}`);
      if (S(w.project_size)) lines.push(`Project size: ${S(w.project_size)}`);
      if (S(w.project_description)) lines.push(`Description: ${S(w.project_description)}`);

      if (Array.isArray(w.roles_responsibilities) && w.roles_responsibilities.length) {
        lines.push("Roles & responsibilities:");
        for (const r of w.roles_responsibilities) {
          lines.push(`  • ${S(r)}`);
        }
      }

      if (Array.isArray(w.technologies) && w.technologies.length) {
        lines.push(`Technologies: ${w.technologies.map((t: any) => S(t)).filter(Boolean).join(", ")}`);
      }

      if (S(w.last_update)) {
        lines.push(`Last update: ${S(w.last_update)}`);
      }

      return lines.join("\n");
    })
    .filter(Boolean)
    .join("\n\n");

  return {
    surname: S(nm.last),
    name: S(nm.first),
    full_name: S(nm.full),

    date_of_birth: fmtDate(firstNonEmpty(c?.dob, c?.dateOfBirth, d?.dob)),
    gender: S(c?.gender),
    nationality: S(c?.nationality),

    employer: S(employer),
    date_of_recruitment: fmtDate(
      firstNonEmpty(c?.dateOfRecruitment, c?.startDateAtEmployer)
    ),

    current_function: S(currentFunction),
    profile_level: S(profileLevel),
    sc_reference: S(scRef),

    highest_qualification: S(highestLevel),
    degree_name: S(degreeName),
    institute: S(institute),
    degree_date: fmtDate(degreeDate),

    date_it_career_started: fmtDate(itStart),

    specialised_expertise: S(specialised),

    // Structured lists (in case we want loops again later)
    languages,
    trainings,
    software_expertise: software,
    work_experience_blocks: work,

    // Flattened strings for this simple template
    languages_summary,
    trainings_text,
    software_text,
    work_experience_text,

    address: S(addr?.line1 || addr?.street),
    city: S(locationCity),
    postal_code: S(addr?.postalCode || addr?.zip),
    country: S(addr?.country),
    phone: S(c?.phone ?? contacts?.phone),
    email: S(c?.email ?? contacts?.email),

    today: dayjs().format("DD/MM/YYYY"),
    locale: S(d?.meta?.locale || c?.locale || "en"),
  };
}
