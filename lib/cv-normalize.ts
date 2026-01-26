// lib/cv-normalize-strong.ts
// Strengthen normalized CV so your EDITOR fields get populated correctly,
// without breaking the preview/export shape.
//
// Adds multiple aliases your editor might read:
//  - experience & experiences (and mirrors under candidate.experiences)
//  - fields: title/role, company/employer, start/end + from/to + startDate/endDate
//  - bullets as both bullets[{text}] and highlights[string[]]
//  - location plus city/country split
//  - similar treatment for education

const str = (v: any) => (v == null ? "" : String(v));

const toBulletObjs = (arr: any) =>
  Array.isArray(arr)
    ? arr.map((b: any) => (typeof b === "string" ? { text: b } : { text: str(b?.text) }))
        .filter((b: any) => b.text)
    : [];

const toBulletText = (arr: any) =>
  Array.isArray(arr) ? arr.map((b: any) => (typeof b === "string" ? b : str(b?.text))).filter(Boolean) : [];

function splitCityCountry(location: string) {
  const m = (location || "").match(/^\s*([^,]+)\s*,\s*(.+)\s*$/);
  if (!m) return { city: "", country: "" };
  return { city: m[1].trim(), country: m[2].trim() };
}

export function strengthenForEditor(cv: any) {
  const out = { ...(cv || {}) };

  out.identity ||= { full_name: "", email: "", phone: "", location: "", links: [], photo: "" };

  // -------- Experience
  const expSrc =
    (Array.isArray(out.experience) && out.experience) ||
    out.experiences ||
    out?.candidate?.experiences ||
    [];

  const experience = (expSrc || []).map((e: any) => {
    const title = str(e?.title || e?.role);
    const company = str(e?.company || e?.employer);
    const start = str(e?.start || e?.from || e?.startDate);
    const end = str(e?.end || e?.to || e?.endDate);
    const location = str(e?.location);
    const bullets = toBulletObjs(e?.bullets?.length ? e?.bullets : e?.highlights);

    const { city, country } = splitCityCountry(location);

    return {
      title,
      role: title,                 // alias
      company,
      employer: company,           // alias
      start, end,
      from: start, to: end,        // aliases
      startDate: start, endDate: end,
      location,
      city, country,               // split alias
      bullets,                     // [{ text }]
      highlights: toBulletText(bullets),
      summary: bullets[0]?.text || "", // some editors show a one-liner
      description: bullets.map((b: any) => b.text).join(" • "),
    };
  });

  out.experience = experience;
  out.experiences = experience;

  // -------- Education
  const eduSrc =
    (Array.isArray(out.education) && out.education) ||
    out.educations ||
    out?.candidate?.education ||
    [];

  const education = (eduSrc || []).map((e: any) => {
    const school = str(e?.school || e?.institution);
    const degree = str(e?.degree || e?.studyType);
    const fieldOfStudy = str(
      e?.fieldOfStudy || e?.field || e?.studyField || e?.major || e?.specialization || e?.area
    );
    const eqfLevel = str(e?.eqfLevel || e?.eqf || e?.levelEqf || e?.eqf_level || e?.level);
    const start = str(e?.start || e?.from || e?.startDate);
    const end = str(e?.end || e?.to || e?.endDate);
    const location = str(e?.location);
    const bullets = toBulletObjs(e?.bullets?.length ? e?.bullets : e?.highlights);

    const { city, country } = splitCityCountry(location);

    return {
      school,
      institution: school,         // alias
      degree,
      studyType: degree,           // alias
      fieldOfStudy,
      eqfLevel,
      start, end,
      from: start, to: end,        // aliases
      startDate: start, endDate: end,
      location, city, country,
      bullets,
      highlights: toBulletText(bullets),
      area: "",                    // optional common field
    };
  });

  out.education = education;
  out.educations = education;

  // -------- Skills → both objects and strings supported
  out.skills = Array.isArray(out.skills)
    ? out.skills.map((s: any) => (typeof s === "string" ? { name: s } : { name: str(s?.name) })).filter((s: any) => s.name)
    : [];

  // -------- Languages (name + level)
  out.languages = Array.isArray(out.languages)
    ? out.languages.map((l: any) => ({ name: str(l?.name || l?.language || l), level: str(l?.level || l?.levelText) }))
    : [];

  // -------- Certifications
  out.certifications = Array.isArray(out.certifications) ? out.certifications.map(str).filter(Boolean) : [];

  // -------- Mirror for candidate.* consumers (keeps preview/export happy)
  out.candidate = {
    ...(out.candidate || {}),
    fullName: str(out.identity.full_name),
    title: str(out.headline),
    location: str(out.identity.location),
    email: str(out.identity.email),
    phone: str(out.identity.phone),
    summary: str(out.summary),
    skills: out.skills.map((x: any) => x.name),
    experiences: experience.map((e: any) => ({
      title: e.title,
      company: e.company,
      start: e.start,
      end: e.end,
      location: e.location,
      bullets: e.highlights,
    })),
    education: education.map((e: any) => ({
      school: e.school, degree: e.degree, start: e.start, end: e.end, location: e.location, bullets: e.highlights,
    })),
    languages: out.languages.map((l: any) => ({ language: l.name, levelText: l.level })),
    certifications: out.certifications,
    photoUrl: str(out.identity.photo),
  };

  // -------- Meta defaults (unchanged)
  out.meta = {
    locale: out?.meta?.locale || "en",
    export_template: out?.meta?.export_template || "pdf-kyndryl",
    pii_masking: out?.meta?.pii_masking || { email: false, phone: true, location: false },
    ...(out.meta || {}),
  };

  return out;
}
