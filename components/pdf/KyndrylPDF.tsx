// components/pdf/KyndrylPDF.tsx
import * as React from "react";
import fs from "fs";
import path from "path";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { CvData } from "@/lib/cv-view";

const BRAND = "#FF462D";
const isSafeImg = (u?: string) => !!u && /^data:image\/(png|jpe?g);base64,/i.test(u);
const s = (v: any) => (v == null ? "" : String(v));

/**
 * React-PDF Image is safest with PNG/JPG. We load a local PNG from /public
 * and embed as a data URL so it works in server-side PDF rendering.
 */
const KYNDYRL_LOGO_DATA_URL: string | null = (() => {
  try {
    const p = path.join(process.cwd(), "public", "kyndryl-logo.png");
    const b64 = fs.readFileSync(p).toString("base64");
    return `data:image/png;base64,${b64}`;
  } catch {
    return null;
  }
})();

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10.5, fontFamily: "Helvetica" },

  bar: { height: 12, backgroundColor: BRAND, marginBottom: 10 },

  headRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  leftHead: { flexGrow: 1, paddingRight: 12 },
  name: { fontSize: 20, fontWeight: "bold" },
  role: { fontSize: 11.5, color: BRAND, marginTop: 3 },
  contact: { fontSize: 9.5, color: "#555", marginTop: 4 },

  // Right column (logo top-right, photo beneath if available)
 rightHead: { width: 190, alignItems: "flex-end" },
 logo: { width: 170, height: 34, objectFit: "contain", marginBottom: 10 },
 photo: { width: 92, borderRadius: 6 },

  section: { marginTop: 12 },
  h1: { fontSize: 12, fontWeight: "bold", color: BRAND, marginBottom: 6 },
  row: { marginBottom: 6 },
  li: { marginLeft: 10, marginTop: 2 },
  breakable: {},

  // Certifications table
  certTable: {
    width: "100%",
    borderWidth: 0.5,
    borderColor: BRAND,
    marginTop: 4,
  },
  certRow: {
    flexDirection: "row",
  },
  certHeaderCell: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: BRAND,
    borderRightWidth: 0.5,
    borderRightColor: BRAND,
    justifyContent: "center",
  },
  certHeaderText: {
    fontSize: 9,
    color: "#FFFFFF",
    fontWeight: "bold",
    textAlign: "center",
  },
  certCell: {
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderTopWidth: 0.5,
    borderTopColor: BRAND,
    borderRightWidth: 0.5,
    borderRightColor: BRAND,
    justifyContent: "center",
  },
  certCellText: {
    fontSize: 9,
    color: "#111111",
  },
  certColName: { width: "38%" },
  certColIssuer: { width: "32%" },
  certColStart: { width: "15%" },
  certColEnd: { width: "15%" },
});

function getExperiences(c: any): any[] {
  const exps =
    (Array.isArray(c?.experiences) && c.experiences.length ? c.experiences : null) ||
    (Array.isArray(c?.experience) && c.experience.length ? c.experience : null) ||
    [];
  return exps || [];
}
function getEducation(c: any): any[] {
  const eds =
    (Array.isArray(c?.education) && c.education.length ? c.education : null) ||
    (Array.isArray(c?.educations) && c.educations.length ? c.educations : null) ||
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

export default function KyndrylPDF({ data }: { data: CvData }) {
  const c = (data?.candidate ?? {}) as CvData["candidate"] & {
    website?: string;
  };
  const contacts = [c.location, c.email, c.phone, c.website, c.linkedin]
    .filter(Boolean)
    .join(" · ");

  const exps = getExperiences(c);
  const edus = getEducation(c);
  const certs: any[] = Array.isArray(c.certifications)
    ? c.certifications
    : Array.isArray((c as any).certificates)
    ? (c as any).certificates
    : [];
  const certRows = certs.length ? certs : [{}];

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

          <View style={styles.rightHead}>
            {KYNDYRL_LOGO_DATA_URL ? <Image src={KYNDYRL_LOGO_DATA_URL} style={styles.logo} /> : null}
            {isSafeImg(c.photoUrl) ? <Image src={c.photoUrl!} style={styles.photo} /> : null}
          </View>
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
                    {s(e?.title || e?.role) || "Role"}
                    {e?.company || e?.employer ? " — " + s(e?.company || e?.employer) : ""}
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
                {ed?.fieldOfStudy || ed?.field || ed?.studyField || ed?.major || ed?.specialization || ed?.area ? (
                  <Text style={styles.breakable}>
                    Field(s) of study: {s(ed?.fieldOfStudy || ed?.field || ed?.studyField || ed?.major || ed?.specialization || ed?.area)}
                  </Text>
                ) : null}
                {ed?.eqfLevel || ed?.eqf || ed?.levelEqf ? (
                  <Text style={styles.breakable}>
                    Level in EQF: {s(ed?.eqfLevel || ed?.eqf || ed?.levelEqf)}
                  </Text>
                ) : null}
                {ed?.start || ed?.end ? (
                  <Text style={styles.breakable}>
                    {s(ed?.start) || "—"} – {s(ed?.end) || "—"}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.h1}>Certifications/Trainings</Text>
          <View style={styles.certTable}>
            <View style={styles.certRow}>
              <View style={[styles.certHeaderCell, styles.certColName]}>
                <Text style={styles.certHeaderText}>Certification Name</Text>
              </View>
              <View style={[styles.certHeaderCell, styles.certColIssuer]}>
                <Text style={styles.certHeaderText}>Company/Institute</Text>
              </View>
              <View style={[styles.certHeaderCell, styles.certColStart]}>
                <Text style={styles.certHeaderText}>Start Date</Text>
              </View>
              <View style={[styles.certHeaderCell, styles.certColEnd]}>
                <Text style={styles.certHeaderText}>Valid Until</Text>
              </View>
            </View>

            {certRows.map((cert: any, i: number) => (
              <View key={i} style={styles.certRow}>
                <View style={[styles.certCell, styles.certColName]}>
                  <Text style={styles.certCellText}>
                    {s(cert.name || cert.title || "") || " "}
                  </Text>
                </View>
                <View style={[styles.certCell, styles.certColIssuer]}>
                  <Text style={styles.certCellText}>
                    {s(cert.issuer || cert.org || cert.company || "") || " "}
                  </Text>
                </View>
                <View style={[styles.certCell, styles.certColStart]}>
                  <Text style={styles.certCellText}>
                    {s(cert.start || "") || " "}
                  </Text>
                </View>
                <View style={[styles.certCell, styles.certColEnd]}>
                  <Text style={styles.certCellText}>
                    {s(cert.end || cert.validUntil || "") || " "}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

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
