// components/pdf/EuropassPDF.tsx
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

// We read everything from CvData, but allow assets to override logos etc.
type Bullet = { text?: string };
type Experience = { title?: string; company?: string; start?: string; end?: string; location?: string; bullets?: Bullet[] };
type Education = { school?: string; degree?: string; start?: string; end?: string };
type Language = { language?: string; levelText?: string };
type CvData = {
  candidate?: {
    fullName?: string;
    title?: string;
    location?: string;
    email?: string;
    phone?: string;
    summary?: string;
    skills?: string[];
    experiences?: Experience[];
    education?: Education[];
    languages?: Language[];
    photoUrl?: string;             // dataURL or https
    europassLogoUrl?: string;      // optional: can also come via props.assets
  };
};

const EURO_BLUE = "#0B3B94";      // Europass deep blue (close to the official)
const SOFT_GRAY = "#F3F4F6";
const DARK = "#111827";

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 11, fontFamily: "Helvetica" },
  headerBar: { backgroundColor: EURO_BLUE, height: 16, marginBottom: 10 },
  headRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  logo: { width: 80, height: 22, objectFit: "contain" },
  title: { color: EURO_BLUE, fontSize: 18, marginLeft: 8, fontWeight: 700 },
  grid: { flexDirection: "row", gap: 16 },
  colLeft: { width: "28%" },
  colRight: { width: "72%" },
  photoWrap: { width: "100%", backgroundColor: SOFT_GRAY, borderRadius: 6, padding: 6, marginBottom: 8 },
  photo: { width: "100%", height: 140, objectFit: "cover", borderRadius: 4 },
  card: { backgroundColor: SOFT_GRAY, borderRadius: 6, padding: 10, marginBottom: 10 },
  label: { color: EURO_BLUE, fontSize: 11, textTransform: "uppercase", marginBottom: 6, fontWeight: 700 },
  li: { marginLeft: 10 },
  section: { marginBottom: 12 },
  h1: { color: EURO_BLUE, fontSize: 14, marginBottom: 6, textTransform: "uppercase" },
  row: { marginBottom: 6 },
  muted: { color: "#4B5563" },
});

export default function EuropassPDF({ data, assets }: { data: CvData; assets?: { europassLogoUrl?: string } }) {
  const c = data?.candidate ?? {};
  const logo = assets?.europassLogoUrl || c.europassLogoUrl;
  const photo = c.photoUrl;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar} />
        <View style={styles.headRow}>
          {logo ? <Image src={logo} style={styles.logo} /> : null}
          <Text style={styles.title}>Curriculum Vitae — Europass</Text>
        </View>

        <View style={styles.grid}>
          {/* LEFT COLUMN */}
          <View style={styles.colLeft}>
            {/* Photo */}
            {photo ? (
              <View style={styles.photoWrap}>
                <Image src={photo} style={styles.photo} />
              </View>
            ) : null}

            {/* Contacts */}
            <View style={styles.card}>
              <Text style={styles.label}>Personal Information</Text>
              <Text>{c.fullName || "—"}</Text>
              {c.title ? <Text style={styles.muted}>{c.title}</Text> : null}
              <Text style={[styles.muted, { marginTop: 6 }]}>
                {[c.location, c.email, c.phone].filter(Boolean).join(" · ")}
              </Text>
            </View>

            {/* Skills */}
            {Array.isArray(c.skills) && c.skills.length ? (
              <View style={styles.card}>
                <Text style={styles.label}>Skills</Text>
                <Text>{c.skills.join(" · ")}</Text>
              </View>
            ) : null}

            {/* Languages */}
            {Array.isArray(c.languages) && c.languages.length ? (
              <View style={styles.card}>
                <Text style={styles.label}>Languages</Text>
                <Text>
                  {c.languages
                    .filter((l) => l?.language)
                    .map((l) => (l.levelText ? `${l.language} (${l.levelText})` : l.language))
                    .join(" · ")}
                </Text>
              </View>
            ) : null}
          </View>

          {/* RIGHT COLUMN */}
          <View style={styles.colRight}>
            {/* Summary */}
            {c.summary ? (
              <View style={styles.section}>
                <Text style={styles.h1}>Profile</Text>
                <Text>{c.summary}</Text>
              </View>
            ) : null}

            {/* Experience */}
            {Array.isArray(c.experiences) && c.experiences.length ? (
              <View style={styles.section}>
                <Text style={styles.h1}>Work Experience</Text>
                {c.experiences.map((e, i) => (
                  <View key={i} style={styles.row}>
                    <Text>
                      {(e.title || "Role")}
                      {e.company ? ` — ${e.company}` : ""}
                      {e.start || e.end ? ` (${e.start ?? "—"} – ${e.end ?? "Present"})` : ""}
                      {e.location ? ` · ${e.location}` : ""}
                    </Text>
                    {Array.isArray(e.bullets) && e.bullets.length
                      ? e.bullets.slice(0, 6).map((b, j) => (
                          <Text key={j} style={styles.li}>
                            • {b?.text}
                          </Text>
                        ))
                      : null}
                  </View>
                ))}
              </View>
            ) : null}

            {/* Education */}
            {Array.isArray(c.education) && c.education.length ? (
              <View style={styles.section}>
                <Text style={styles.h1}>Education</Text>
                {c.education.map((ed, i) => (
                  <Text key={i} style={styles.row}>
                    {(ed.degree || "Degree")}
                    {ed.school ? ` — ${ed.school}` : ""}
                    {ed.start || ed.end ? ` (${ed.start ?? "—"} – ${ed.end ?? "—"})` : ""}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}
