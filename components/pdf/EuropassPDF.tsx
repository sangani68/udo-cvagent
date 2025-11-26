// components/pdf/EuropassPDF.tsx
import * as React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { CvData } from "@/lib/cv-view";

const EURO_BLUE = "#0B3B94";
const SOFT_GRAY = "#F3F4F6";
const isSafeImg = (u?: string) => !!u && /^data:image\/(png|jpe?g);base64,/i.test(u);
const s = (v: any) => (v == null ? "" : String(v));

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10.5, fontFamily: "Helvetica" },
  headerBar: { backgroundColor: EURO_BLUE, height: 14, marginBottom: 8 },
  headRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  logo: { width: 80, height: 22 },
  title: { color: EURO_BLUE, fontSize: 16, marginLeft: 8, fontWeight: "bold" },
  grid: { flexDirection: "row" },
  colLeft: { width: 170 },
  spacer: { width: 14 },
  colRight: { flexGrow: 1 },
  card: { backgroundColor: SOFT_GRAY, borderRadius: 6, padding: 10, marginBottom: 8 },
  label: { color: EURO_BLUE, fontSize: 10.5, textTransform: "uppercase", marginBottom: 6, fontWeight: "bold" },
  photoWrap: { width: 170, backgroundColor: SOFT_GRAY, borderRadius: 6, padding: 6, marginBottom: 8, alignItems: "center" },
  photo: { width: 150, borderRadius: 4 },
  section: { marginBottom: 10 },
  h1: { color: EURO_BLUE, fontSize: 12, marginBottom: 6, textTransform: "uppercase", fontWeight: "bold" },
  row: { marginBottom: 6 },
  li: { marginLeft: 10, marginTop: 2 },
  muted: { color: "#4B5563" },
  breakable: {},
});

function getExperiences(c: any): any[] {
  const exps = Array.isArray(c?.experiences) && c.experiences.length ? c.experiences
            : Array.isArray(c?.experience)   && c.experience.length   ? c.experience
            : [];
  return exps || [];
}
function getEducation(c: any): any[] {
  const eds = Array.isArray(c?.education)  && c.education.length  ? c.education
            : Array.isArray(c?.educations) && c.educations.length ? c.educations
            : [];
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
  const c = (data?.candidate ?? {}) as CvData["candidate"];

  const exps = getExperiences(c);
  const edus = getEducation(c);

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.headerBar} />
        <View style={styles.headRow}>
          {isSafeImg((c as any).europassLogoUrl) ? <Image src={(c as any).europassLogoUrl!} style={styles.logo} /> : null}
          <Text style={styles.title}>Curriculum Vitae — Europass</Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.colLeft}>
            {isSafeImg(c.photoUrl) ? (
              <View style={styles.photoWrap}>
                <Image src={c.photoUrl!} style={styles.photo} />
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.label}>Personal Information</Text>
              <Text style={styles.breakable}>{s(c.fullName) || "—"}</Text>
              {c.title ? <Text style={[styles.muted, styles.breakable]}>{s(c.title)}</Text> : null}
              <Text style={[styles.muted, { marginTop: 6 }, styles.breakable]}>
                {[c.location, c.email, c.phone].filter(Boolean).map(s).join(" · ")}
              </Text>
            </View>

            {Array.isArray(c.skills) && c.skills.length ? (
              <View style={styles.card}>
                <Text style={styles.label}>Skills</Text>
                <Text style={styles.breakable}>{s(c.skills.join(" · "))}</Text>
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

          <View style={styles.spacer} />

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
                        {s(e?.title || e?.role) || "Role"}{e?.company || e?.employer ? " — " + s(e?.company || e?.employer) : ""}
                      </Text>
                      {(e?.start || e?.end || e?.location) ? (
                        <Text style={styles.breakable}>
                          {s(e?.start) || "—"} – {s(e?.end) || "Present"}{e?.location ? ` · ${s(e?.location)}` : ""}
                        </Text>
                      ) : null}
                      {lines.map((t, j) => (
                        <Text key={j} style={[styles.li, styles.breakable]}>• {t}</Text>
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
                      {s(ed?.degree) || "Degree"}{ed?.school ? " — " + s(ed?.school) : ""}
                    </Text>
                    {(ed?.start || ed?.end) ? (
                      <Text style={styles.breakable}>{s(ed?.start) || "—"} – {s(ed?.end) || "—"}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}
