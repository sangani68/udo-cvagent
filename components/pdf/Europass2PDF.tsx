// components/pdf/Europass2PDF.tsx
//
// Europass2 PDF template (single-column, A4)
// - Header: EU logo from /public/eu-logo.png or candidate.euLogoUrl
//           + "europass" text
// - Top band: name + personal info grouped horizontally (ID / DOB / POB, etc.)
// - Sections:
//   WORK EXPERIENCE
//   EDUCATION AND TRAINING
//   LANGUAGE SKILLS (CEFR-style table)
//   SKILLS
//   DRIVING LICENCE
//
// Uses only "Helvetica" for font so preview & export render the same React-PDF font.

import * as React from "react";
import fs from "fs";
import path from "path";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { CvData } from "@/lib/cv-view";

// Colour palette tuned close to the Europass sample
const EURO_BLUE = "#003399";       // Europass blue
const TEXT_PRIMARY = "#111111";    // near-black
const TEXT_MUTED = "#555555";      // muted body text
const BORDER = "#D0D7E5";          // light border
const ROW_ALT = "#F5F7FA";         // alternate row background

const s = (v: any) => (v == null ? "" : String(v));
const isSafeImg = (u?: string) =>
  !!u && /^data:image\/(png|jpe?g);base64,/i.test(u);

const PAGE_PADDING_H = 28; // left/right padding

// Try to load a static EU logo PNG from /public/eu-logo.png at build/runtime.
const EU_LOGO_DATA_URL: string | null = (() => {
  try {
    const filePath = path.join(process.cwd(), "public", "eu-logo.png");
    const buf = fs.readFileSync(filePath);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
})();

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: PAGE_PADDING_H,
    fontSize: 10.5,
    fontFamily: "Helvetica",
    color: TEXT_PRIMARY,
  },

  // ───────────────── HEADER (logo) ─────────────────
  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  euLogo: {
    width: 140,
    height: 38,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  headerLine: {
    marginTop: 4,
    marginBottom: 12,
    height: 2,
    backgroundColor: EURO_BLUE,
  },

  // ───────────────── NAME & PERSONAL DETAILS BAND ─────────────────
  nameBand: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 10,
  },
  name: {
    fontSize: 17,
    fontWeight: "bold",
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  infoRow: {
    fontSize: 10,
    marginBottom: 1,
    color: TEXT_MUTED,
  },

  // ───────────────── SECTIONS ─────────────────
  section: {
    marginTop: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: "bold",
    color: EURO_BLUE,
    textTransform: "uppercase",
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 2,
  },
  block: {
    marginBottom: 8,
  },
  breakable: {},

  muted: {
    fontSize: 10,
    color: TEXT_MUTED,
  },
  bullet: {
    marginLeft: 10,
    marginTop: 2,
  },

  // ───────────────── LANGUAGE TABLE ─────────────────
  langTable: {
    width: "100%",
    borderWidth: 0.5,
    borderColor: BORDER,
    marginTop: 4,
  },
  langRow: {
    flexDirection: "row",
  },
  langHeaderCell: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: EURO_BLUE,
    borderRightWidth: 0.5,
    borderRightColor: BORDER,
    justifyContent: "center",
    alignItems: "center",
  },
  langGroupHeaderCell: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: "transparent",
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    justifyContent: "center",
    alignItems: "center",
  },
  langHeaderText: {
    fontSize: 9,
    color: "#FFFFFF",
    fontWeight: "bold",
    textAlign: "center",
  },
  langGroupHeaderText: {
    fontSize: 9.5,
    color: TEXT_PRIMARY,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  langCell: {
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    borderRightWidth: 0.5,
    borderRightColor: BORDER,
    justifyContent: "center",
  },
  langCellAlt: {
    backgroundColor: ROW_ALT,
  },
  langCellText: {
    fontSize: 9,
    textAlign: "center",
    color: TEXT_PRIMARY,
  },
  langCellTextLeft: {
    fontSize: 9,
    color: TEXT_PRIMARY,
  },
  langCellTextBold: {
    fontSize: 9,
    color: TEXT_PRIMARY,
    fontWeight: "bold",
  },
  langColLanguage: {
    flexGrow: 2,
    flexShrink: 0,
  },
  langColSkill: {
    flexGrow: 1,
    flexShrink: 0,
  },
  langColGroup2: {
    flexGrow: 2,
    flexShrink: 0,
  },
  langColGroup1: {
    flexGrow: 1,
    flexShrink: 0,
  },
  footnote: {
    marginTop: 6,
    fontSize: 9,
    fontStyle: "italic",
    color: TEXT_MUTED,
  },
});

// Helpers
function getExperiences(c: any, data?: any): any[] {
  const exps =
    (Array.isArray(c?.experiences) && c.experiences.length && c.experiences) ||
    (Array.isArray(c?.experience) && c.experience.length && c.experience) ||
    (Array.isArray(data?.experience) && data.experience.length && data.experience) ||
    (Array.isArray(data?.experiences) && data.experiences.length && data.experiences) ||
    (Array.isArray(data?.cv?.experience) && data.cv.experience.length && data.cv.experience) ||
    (Array.isArray(data?.cv?.experiences) && data.cv.experiences.length && data.cv.experiences) ||
    (Array.isArray(data?.cv?.candidate?.experience) && data.cv.candidate.experience.length && data.cv.candidate.experience) ||
    (Array.isArray(data?.cv?.candidate?.experiences) && data.cv.candidate.experiences.length && data.cv.candidate.experiences) ||
    [];
  return exps || [];
}

function getEducation(c: any, data?: any): any[] {
  const eds =
    (Array.isArray(c?.education) && c.education.length && c.education) ||
    (Array.isArray(c?.educations) && c.educations.length && c.educations) ||
    (Array.isArray(data?.education) && data.education.length && data.education) ||
    (Array.isArray(data?.educations) && data.educations.length && data.educations) ||
    (Array.isArray(data?.cv?.education) && data.cv.education.length && data.cv.education) ||
    (Array.isArray(data?.cv?.educations) && data.cv.educations.length && data.cv.educations) ||
    (Array.isArray(data?.cv?.candidate?.education) && data.cv.candidate.education.length && data.cv.candidate.education) ||
    (Array.isArray(data?.cv?.candidate?.educations) && data.cv.candidate.educations.length && data.cv.candidate.educations) ||
    [];
  return eds || [];
}

function normalizeLines(bullets: any[]): string[] {
  const arr = Array.isArray(bullets) ? bullets : [];
  return arr
    .map((b: any) => (typeof b === "string" ? b : b?.text ?? ""))
    .map((t: any) => s(t))
    .filter(Boolean);
}

// Extract per-skill CEFR levels from a language entry, with fallbacks
function getLangSkillLevels(lang: any) {
  const base =
    s(lang.levelText || lang.level || lang.cefr || "").toUpperCase().trim() || "";

  const pick = (...keys: string[]) => {
    for (const k of keys) {
      if (lang && lang[k]) return s(lang[k]).toUpperCase().trim();
    }
    return "";
  };

  const listening =
    pick("listening", "listeningLevel", "listeningCEFR") || base;
  const reading = pick("reading", "readingLevel", "readingCEFR") || base;
  const spokenInteraction =
    pick("spokenInteraction", "spoken_interaction", "interaction", "spokenInteractionLevel") ||
    base;
  const spokenProduction =
    pick("spokenProduction", "spoken_production", "production", "spokenProductionLevel") ||
    base;
  const writing = pick("writing", "writingLevel", "writingCEFR") || base;

  return {
    listening,
    reading,
    spokenInteraction,
    spokenProduction,
    writing,
  };
}

export default function Europass2PDF({ data }: { data: CvData }) {
  const c = (data?.candidate ?? {}) as any;

  const exps = getExperiences(c, data);
  const edus = getEducation(c, data);

  // ── Personal details for the band ──
  const idVal = c.id ? `ID: ${s(c.id)}` : "";
  const dobVal = s(c.dateOfBirth || c.dob || "");
  const pobVal = s(c.placeOfBirth || "");
  const nationality =
    c.nationality ||
    (Array.isArray(c.nationalities) && c.nationalities.join(", "));
  const phones: string[] = [];
  if (c.phone) phones.push(s(c.phone));
  if (Array.isArray(c.phones)) phones.push(...c.phones.map(s));
  const email = s(c.email || "");
  const address =
    s(c.address || c.location || c.city || c.country || "");

  // WEBSITE + LINKEDIN – multiple possible sources
  let website =
    s(
      c.website ||
        c.web ||
        c.url ||
        c.personalWebsite ||
        c.portfolioUrl ||
        ""
    );
  let linkedin =
    s(
      c.linkedin ||
        c.linkedIn ||
        c.linkedinUrl ||
        c.linkedInUrl ||
        c.linkedinProfile ||
        ""
    );

  // If not explicitly mapped, try generic links array
  if ((!website || !linkedin) && Array.isArray(c.links)) {
    const links = c.links.map((v: any) => s(v)).filter(Boolean);
    const linkedInUrl = links.find((x: string) =>
      x.toLowerCase().includes("linkedin.com")
    );
    if (!linkedin && linkedInUrl) linkedin = linkedInUrl;
    const webUrl = links.find(
      (x: string) =>
        !x.toLowerCase().includes("linkedin.com") &&
        (x.startsWith("http://") || x.startsWith("https://"))
    );
    if (!website && webUrl) website = webUrl;
  }

  // Horizontal personal info rows (· separators)
  const row1Parts: string[] = [];
  if (idVal) row1Parts.push(idVal);
  if (dobVal) row1Parts.push(`Date of birth: ${dobVal}`);
  if (pobVal) row1Parts.push(`Place of birth: ${pobVal}`);

  const row2Parts: string[] = [];
  if (nationality) row2Parts.push(`Nationality: ${s(nationality)}`);
  if (address) row2Parts.push(`Address: ${address}`);

  const row3Parts: string[] = [];
  if (phones.length) row3Parts.push(`Phone: ${phones.join(" / ")}`);
  if (email) row3Parts.push(`Email: ${email}`);

  const row4Parts: string[] = [];
  if (website) row4Parts.push(`Website: ${website}`);
  if (linkedin) row4Parts.push(`LinkedIn: ${linkedin}`);

  // Language-related
  const languages: any[] = Array.isArray(c.languages) ? c.languages : [];
  const addUnique = (arr: string[], v: string) => {
    const key = s(v).trim();
    if (!key) return;
    const exists = arr.some((x) => x.toUpperCase().trim() === key.toUpperCase().trim());
    if (!exists) arr.push(key);
  };
  const motherTongues: string[] = Array.isArray(c.motherTongues)
    ? c.motherTongues.map(s).filter(Boolean)
    : [];
  const isNative = (l: any) => {
    const lvl = s(l.levelText || l.level || l.cefr || l.proficiency || "").toLowerCase();
    return /native|mother\s*tongue/.test(lvl);
  };
  languages.forEach((l) => {
    if (isNative(l)) addUnique(motherTongues, s(l.language || l.name || ""));
  });
  const motherTongueSet = motherTongues.map((mt) => mt.toUpperCase().trim());
  const otherLanguages = languages.filter((l) => {
    const nm = s(l.language || l.name || "").toUpperCase().trim();
    return nm && !motherTongueSet.includes(nm) && !isNative(l);
  });

  const skills: string[] = Array.isArray(c.skills)
    ? c.skills.map(s)
    : [];

  const driving: string[] = [];
  if (Array.isArray(c.drivingLicences)) driving.push(...c.drivingLicences.map(s));
  else if (Array.isArray(c.drivingLicenses)) driving.push(...c.drivingLicenses.map(s));
  else if (c.drivingLicence || c.drivingLicense)
    driving.push(s(c.drivingLicence || c.drivingLicense));

  // EU logo: candidate.euLogoUrl (data URL) overrides static file if present
  const euLogoSrc =
    c.euLogoUrl && isSafeImg(c.euLogoUrl) ? c.euLogoUrl : EU_LOGO_DATA_URL;

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* ───────── HEADER: EU logo (top right) ───────── */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft} />
          <View style={styles.headerRight}>
            {euLogoSrc && <Image src={euLogoSrc} style={styles.euLogo} />}
          </View>
        </View>
        <View style={styles.headerLine} />

        {/* ───────── NAME & PERSONAL DETAILS BAND ───────── */}
        <View style={styles.nameBand}>
          <Text style={[styles.name, styles.breakable]}>
            {s(c.fullName || c.name) || "Candidate"}
          </Text>

          {row1Parts.length ? (
            <Text style={[styles.infoRow, styles.breakable]}>
              {row1Parts.join("   ·   ")}
            </Text>
          ) : null}

          {row2Parts.length ? (
            <Text style={[styles.infoRow, styles.breakable]}>
              {row2Parts.join("   ·   ")}
            </Text>
          ) : null}

          {row3Parts.length ? (
            <Text style={[styles.infoRow, styles.breakable]}>
              {row3Parts.join("   ·   ")}
            </Text>
          ) : null}

          {row4Parts.length ? (
            <Text style={[styles.infoRow, styles.breakable]}>
              {row4Parts.join("   ·   ")}
            </Text>
          ) : null}
        </View>

        {/* ───────── ABOUT ME ───────── */}
        {s(c.summary || c.about || "").trim() ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About Me</Text>
            <View style={styles.block}>
              <Text style={styles.breakable}>{s(c.summary || c.about)}</Text>
            </View>
          </View>
        ) : null}

        {/* ───────── EDUCATION AND TRAINING ───────── */}
        {edus.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Education and Training</Text>
            {edus.map((ed: any, i: number) => {
              const degree = s(ed.degree || ed.title || "");
              const school = s(ed.school || ed.institution || "");
              const start = s(ed.start || "");
              const end = s(ed.end || "");
              const location = s(ed.location || "");
              const headerParts = [
                degree || "Qualification",
                school,
                start && end ? `${start} – ${end}` : start || end,
                location,
              ].filter(Boolean);

              const website = s(ed.website || ed.url || "");
              const details = s(ed.details || ed.description || "");

              return (
                <View key={i} style={styles.block} wrap>
                  <Text
                    style={[
                      styles.breakable,
                      { fontWeight: "bold", color: TEXT_PRIMARY },
                    ]}
                  >
                    {headerParts.join(" – ")}
                  </Text>
                  {website ? (
                    <Text style={[styles.muted, styles.breakable]}>
                      Website {website}
                    </Text>
                  ) : null}
                  {details ? (
                    <Text style={[styles.breakable, { marginTop: 2 }]}>
                      {details}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {/* ───────── LANGUAGE SKILLS ───────── */}
        {(motherTongues.length || languages.length) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Language Skills</Text>

            {motherTongues.length ? (
              <Text style={[styles.infoRow, styles.breakable]}>
                <Text style={{ fontWeight: "bold" }}>Mother tongue(s): </Text>
                {motherTongues.join(", ")}
              </Text>
            ) : null}

            {otherLanguages.length ? (
              <View style={{ marginTop: 6 }}>
                <Text style={[styles.infoRow, styles.breakable]}>
                  <Text style={{ fontWeight: "bold" }}>Other language(s):</Text>
                </Text>

                {/* CEFR-style table (grouped headers) */}
                <View style={styles.langTable}>
                  {/* Group header row */}
                  <View style={styles.langRow}>
                    <View
                      style={[
                        styles.langGroupHeaderCell,
                        styles.langColLanguage,
                      ]}
                    />
                    <View
                      style={[
                        styles.langGroupHeaderCell,
                        styles.langColGroup2,
                      ]}
                    >
                      <Text style={styles.langGroupHeaderText}>
                        Understanding
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.langGroupHeaderCell,
                        styles.langColGroup2,
                      ]}
                    >
                      <Text style={styles.langGroupHeaderText}>Speaking</Text>
                    </View>
                    <View
                      style={[
                        styles.langGroupHeaderCell,
                        styles.langColGroup1,
                      ]}
                    >
                      <Text style={styles.langGroupHeaderText}>Writing</Text>
                    </View>
                  </View>

                  {/* Subheader row */}
                  <View style={styles.langRow}>
                    <View
                      style={[
                        styles.langHeaderCell,
                        styles.langColLanguage,
                      ]}
                    >
                      <Text style={styles.langHeaderText}>Language</Text>
                    </View>
                    <View
                      style={[
                        styles.langHeaderCell,
                        styles.langColSkill,
                      ]}
                    >
                      <Text style={styles.langHeaderText}>Listening</Text>
                    </View>
                    <View
                      style={[
                        styles.langHeaderCell,
                        styles.langColSkill,
                      ]}
                    >
                      <Text style={styles.langHeaderText}>Reading</Text>
                    </View>
                    <View
                      style={[
                        styles.langHeaderCell,
                        styles.langColSkill,
                      ]}
                    >
                      <Text style={styles.langHeaderText}>
                        Spoken production
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.langHeaderCell,
                        styles.langColSkill,
                      ]}
                    >
                      <Text style={styles.langHeaderText}>
                        Spoken interaction
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.langHeaderCell,
                        styles.langColSkill,
                      ]}
                    >
                      <Text style={styles.langHeaderText}>Writing</Text>
                    </View>
                  </View>

                  {/* Data rows */}
                  {otherLanguages.map((l, idx) => {
                    const nm = s(l.language || l.name || "");
                    const levels = getLangSkillLevels(l);
                    const alt = idx % 2 === 1;
                    const rowBase = alt
                      ? [styles.langCell, styles.langCellAlt]
                      : [styles.langCell];

                    return (
                      <View key={idx} style={styles.langRow}>
                        <View
                          style={[
                            ...rowBase,
                            styles.langColLanguage,
                          ]}
                        >
                          <Text style={[styles.langCellTextBold, styles.breakable]}>
                            {(nm || "—").toUpperCase()}
                          </Text>
                        </View>
                        <View
                          style={[...rowBase, styles.langColSkill]}
                        >
                          <Text style={styles.langCellText}>
                            {levels.listening || "—"}
                          </Text>
                        </View>
                        <View
                          style={[...rowBase, styles.langColSkill]}
                        >
                          <Text style={styles.langCellText}>
                            {levels.reading || "—"}
                          </Text>
                        </View>
                        <View
                          style={[...rowBase, styles.langColSkill]}
                        >
                          <Text style={styles.langCellText}>
                            {levels.spokenInteraction || "—"}
                          </Text>
                        </View>
                        <View
                          style={[...rowBase, styles.langColSkill]}
                        >
                          <Text style={styles.langCellText}>
                            {levels.spokenProduction || "—"}
                          </Text>
                        </View>
                        <View
                          style={[...rowBase, styles.langColSkill]}
                        >
                          <Text style={styles.langCellText}>
                            {levels.writing || "—"}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.footnote}>
                  Levels: A1 and A2: Basic user; B1 and B2: Independent user; C1 and C2: Proficient user
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* ───────── SKILLS ───────── */}
        {skills.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.block}>
              {skills.map((skill, i) => (
                <Text
                  key={i}
                  style={[styles.breakable, { marginBottom: 2 }]}
                >
                  {skill}
                </Text>
              ))}
            </View>
          </View>
        ) : null}

        {/* ───────── DRIVING LICENCE ───────── */}
        {driving.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Driving Licence</Text>
            {driving.map((d, i) => (
              <Text
                key={i}
                style={[styles.breakable, { marginBottom: 2 }]}
              >
                {d}
              </Text>
            ))}
          </View>
        ) : null}

        {/* ───────── WORK EXPERIENCE ───────── */}
        {exps.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Work Experience</Text>
            {exps.map((e: any, i: number) => {
              const title = s(e.title || e.role || "");
              const company = s(e.company || e.employer || "");
              const start = s(e.start || "");
              const end = s(e.end || "Present");
              const location = s(e.location || "");
              const headerParts = [
                title || "Role",
                company,
                start && end ? `${start} – ${end}` : start || end,
                location,
              ].filter(Boolean);

              const lines = normalizeLines(e.bullets || []);
              if (!lines.length && (e.summary || e.description)) {
                lines.push(s(e.summary || e.description));
              }

              return (
                <View key={i} style={styles.block} wrap>
                  <Text
                    style={[
                      styles.breakable,
                      { fontWeight: "bold", color: TEXT_PRIMARY },
                    ]}
                  >
                    {headerParts.join(" – ")}
                  </Text>
                  {lines.map((t, j) => (
                    <Text key={j} style={[styles.bullet, styles.breakable]}>
                      • {t}
                    </Text>
                  ))}
                </View>
              );
            })}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
