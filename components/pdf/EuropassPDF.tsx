// components/pdf/EuropassPDF.tsx
//
// Europass PDF template (v1, two-column)
// - Header: EU logo from /public/eu-logo.png or candidate.euLogoUrl (no "europass" text)
// - Left column: photo + personal info + skills + languages
// - Right column: profile + work experience + education
//
// Uses fixed widths to avoid overflow and "Helvetica" everywhere.

import * as React from "react";
import fs from "fs";
import path from "path";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { CvData } from "@/lib/cv-view";

const EURO_BLUE = "#003399";
const TEXT_PRIMARY = "#111111";
const TEXT_MUTED = "#555555";
const SOFT_GRAY = "#F5F7FA";

const s = (v: any) => (v == null ? "" : String(v));
const isSafeImg = (u?: string) =>
  !!u && /^data:image\/(png|jpe?g);base64,/i.test(u);

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

// A4: width ≈ 595pt; we stay comfortably inside
const LEFT_COL_WIDTH = 160;
const RIGHT_COL_WIDTH = 340;

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 28,
    paddingHorizontal: 32,
    fontSize: 10.5,
    fontFamily: "Helvetica",
    color: TEXT_PRIMARY,
  },

  // Header
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
    marginBottom: 10,
    height: 2,
    backgroundColor: EURO_BLUE,
  },

  body: {
    flexDirection: "row",
    width: "100%",
  },

  colLeft: {
    width: LEFT_COL_WIDTH,
    marginRight: 14,
  },

  colRight: {
    width: RIGHT_COL_WIDTH,
  },

  card: {
    backgroundColor: SOFT_GRAY,
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  label: {
    color: EURO_BLUE,
    fontSize: 10.5,
    textTransform: "uppercase",
    marginBottom: 6,
    fontWeight: "bold",
  },

  photoWrap: {
    width: LEFT_COL_WIDTH,
    alignSelf: "center",
    backgroundColor: SOFT_GRAY,
    borderRadius: 6,
    padding: 6,
    marginBottom: 8,
    alignItems: "center",
  },
  photo: { width: LEFT_COL_WIDTH - 20, height: 140, borderRadius: 4 },

  section: { marginBottom: 10 },
  h1: {
    color: EURO_BLUE,
    fontSize: 12,
    marginBottom: 6,
    textTransform: "uppercase",
    fontWeight: "bold",
  },
  row: { marginBottom: 6 },
  li: { marginLeft: 10, marginTop: 2 },
  muted: { color: TEXT_MUTED },
  breakable: {},
});

function getExperiences(c: any): any[] {
  const exps =
    (Array.isArray(c?.experiences) && c.experiences.length && c.experiences) ||
    (Array.isArray(c?.experience) && c.experience.length && c.experience) ||
    [];
  return exps || [];
}

function getEducation(c: any): any[] {
  const eds =
    (Array.isArray(c?.education) && c.education.length && c.education) ||
    (Array.isArray(c?.educations) && c.educations.length && c.educations) ||
    [];
  return eds || [];
}

function normalizeLines(bullets: any[]): string[] {
  const arr = Array.isArray(bullets) ? bullets : [];
  return arr
    .map((b: any) => (typeof b === "string" ? b : b?.text ?? ""))
    .map((t: any) => s(t))
    .filter(Boolean)
    .slice(0, 6);
}

export default function EuropassPDF({ data }: { data: CvData }) {
  const c = (data?.candidate ?? {}) as any;

  const exps = getExperiences(c);
  const edus = getEducation(c);

  const contacts = [c.location, c.email, c.phone, c.website, c.linkedin]
    .filter(Boolean)
    .map(s)
    .join(" · ");

  // EU logo: candidate.euLogoUrl (data URL) overrides static file if present
  const euLogoSrc =
    c.euLogoUrl && isSafeImg(c.euLogoUrl) ? c.euLogoUrl : EU_LOGO_DATA_URL;

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* Header with logo only (top right) */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft} />
          <View style={styles.headerRight}>
            {euLogoSrc && <Image src={euLogoSrc} style={styles.euLogo} />}
          </View>
        </View>
        <View style={styles.headerLine} />

        {/* Two-column body */}
        <View style={styles.body}>
          {/* LEFT COLUMN */}
          <View style={styles.colLeft}>
            {typeof c.photoUrl === "string" && c.photoUrl ? (
              <View style={styles.photoWrap}>
                <Image src={c.photoUrl} style={styles.photo} />
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.label}>Personal Information</Text>
              <Text style={styles.breakable}>
                {s(c.fullName || c.name) || "—"}
              </Text>
              {c.title ? (
                <Text style={[styles.muted, styles.breakable]}>
                  {s(c.title)}
                </Text>
              ) : null}
              {contacts ? (
                <Text
                  style={[styles.muted, { marginTop: 6 }, styles.breakable]}
                >
                  {contacts}
                </Text>
              ) : null}
            </View>

            {Array.isArray(c.skills) && c.skills.length ? (
              <View style={styles.card}>
                <Text style={styles.label}>Skills</Text>
                <Text style={styles.breakable}>
                  {s(c.skills.join(" · "))}
                </Text>
              </View>
            ) : null}

            {Array.isArray(c.languages) && c.languages.length ? (
              <View style={styles.card}>
                <Text style={styles.label}>Languages</Text>
                <Text style={styles.breakable}>
                  {c.languages
                    ?.filter((l: any) => l?.language || l?.name)
                    .map((l: any) => {
                      const nm = s(l.language ?? l.name);
                      const lvl = s(l.levelText ?? l.level);
                      return lvl ? `${nm} (${lvl})` : nm;
                    })
                    .join(" · ")}
                </Text>
              </View>
            ) : null}

          </View>

          {/* RIGHT COLUMN */}
          <View style={styles.colRight}>
            {c.summary ? (
              <View style={styles.section}>
                <Text style={styles.h1}>Profile</Text>
                <Text style={styles.breakable}>{s(c.summary)}</Text>
              </View>
            ) : null}

            {exps.length ? (
              <View style={styles.section}>
                <Text style={styles.h1}>Work Experience</Text>
                {exps.map((e: any, i: number) => {
                  const lines = normalizeLines(e?.bullets);
                  return (
                    <View key={i} style={styles.row} wrap>
                      <Text style={styles.breakable}>
                        {s(e?.title || e?.role) || "Role"}
                        {e?.company || e?.employer
                          ? " — " + s(e?.company || e?.employer)
                          : ""}
                      </Text>
                      {e?.start || e?.end || e?.location ? (
                        <Text style={styles.breakable}>
                          {s(e?.start) || "—"} – {s(e?.end) || "Present"}
                          {e?.location ? ` · ${s(e?.location)}` : ""}
                        </Text>
                      ) : null}
                      {lines.map((t, j) => (
                        <Text key={j} style={[styles.li, styles.breakable]}>
                          • {t}
                        </Text>
                      ))}
                    </View>
                  );
                })}
              </View>
            ) : null}

            {edus.length ? (
              <View style={styles.section}>
                <Text style={styles.h1}>Education</Text>
                {edus.map((ed: any, i: number) => (
                  <View key={i} style={styles.row}>
                    <Text style={styles.breakable}>
                      {s(ed?.degree) || "Degree"}
                      {ed?.school ? " — " + s(ed?.school) : ""}
                    </Text>
                    {ed?.start || ed?.end ? (
                      <Text style={styles.breakable}>
                        {s(ed?.start) || "—"} – {s(ed?.end) || "—"}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            {Array.isArray(c.certifications || c.certificates) &&
            (c.certifications || c.certificates).length ? (
              <View style={styles.section}>
                <Text style={styles.h1}>Certifications/Trainings</Text>
                {(c.certifications || c.certificates).map((cert: any, i: number) => {
                  const name = s(cert.name || cert.title || "");
                  const issuer = s(cert.issuer || cert.org || cert.company || "");
                  const start = s(cert.start || "");
                  const end = s(cert.end || cert.validUntil || "");
                  const date =
                    s(cert.date || "") ||
                    (start && end ? `${start} – ${end}` : start || end);
                  const line = [name || "Certification", issuer, date]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <Text key={i} style={styles.breakable}>
                      {line}
                    </Text>
                  );
                })}
              </View>
            ) : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}
