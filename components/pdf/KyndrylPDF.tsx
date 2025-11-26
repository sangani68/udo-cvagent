// components/pdf/KyndrylPDF.tsx
import * as React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { CvData } from "@/lib/cv-view";

const BRAND = "#FF462D";
const isSafeImg = (u?: string) => !!u && /^data:image\/(png|jpe?g);base64,/i.test(u);
const s = (v: any) => (v == null ? "" : String(v));

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10.5, fontFamily: "Helvetica" },
  bar: { height: 12, backgroundColor: BRAND, marginBottom: 10 },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  leftHead: { flexGrow: 1, paddingRight: 12 },
  name: { fontSize: 20, fontWeight: "bold" },
  role: { fontSize: 11.5, color: BRAND, marginTop: 3 },
  contact: { fontSize: 9.5, color: "#555", marginTop: 4 },
  photoWrap: { width: 96, alignItems: "flex-end" },
  photo: { width: 92, borderRadius: 6 },
  section: { marginTop: 12 },
  h1: { fontSize: 12, fontWeight: "bold", color: BRAND, marginBottom: 6 },
  row: { marginBottom: 6 },
  li: { marginLeft: 10, marginTop: 2 },
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

export default function KyndrylPDF({ data }: { data: CvData }) {
  const c = (data?.candidate ?? {}) as CvData["candidate"];
  const contacts = [c.location, c.email, c.phone].filter(Boolean).join(" · ");

  const exps = getExperiences(c);
  const edus = getEducation(c);

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.bar} />
        <View style={styles.headRow}>
          <View style={styles.leftHead}>
            <Text style={[styles.name, styles.breakable]}>{s(c.fullName) || "Candidate"}</Text>
            {c.title ? <Text style={[styles.role, styles.breakable]}>{s(c.title)}</Text> : null}
            {contacts ? <Text style={[styles.contact, styles.breakable]}>{s(contacts)}</Text> : null}
          </View>
          {isSafeImg(c.photoUrl) ? (
            <View style={styles.photoWrap}>
              <Image src={c.photoUrl!} style={styles.photo} />
            </View>
          ) : null}
        </View>

        {c.summary ? (
          <View style={styles.section}>
            <Text style={styles.h1}>Summary</Text>
            <Text style={styles.breakable}>{s(c.summary)}</Text>
          </View>
        ) : null}

        {exps.length ? (
          <View style={styles.section}>
            <Text style={styles.h1}>Experience</Text>
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

        {Array.isArray(c.skills) && c.skills.length ? (
          <View style={styles.section}>
            <Text style={styles.h1}>Skills</Text>
            <Text style={styles.breakable}>{s(c.skills.join(" · "))}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
