import React from "react";
import { Document, Page, Text, View, StyleSheet, Link } from "@react-pdf/renderer";
import type { CvData } from "@/types/cv";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: "#111" },
  headerBar: { height: 6, backgroundColor: "#FF462D", marginBottom: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  name: { fontSize: 20, fontWeight: 700 },
  title: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  contact: { alignItems: "flex-end" },
  section: { marginTop: 12 },
  h2: { fontSize: 12, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 },
  pillRow: { flexDirection: "row", flexWrap: "wrap" },
  pill: { borderRadius: 3, paddingVertical: 2, paddingHorizontal: 6, marginRight: 4, marginBottom: 4, border: "1 solid #FF462D" },
  xpItem: { marginBottom: 10 },
  xpHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  xpTitle: { fontWeight: 700 },
  bullet: { flexDirection: "row", marginBottom: 2 },
  dot: { width: 6, fontWeight: 900, marginRight: 6 },
  footLang: { marginTop: 10, borderTop: "1 solid #FF462D", paddingTop: 8 },
});

export default function KyndrylPDF({ data }: { data: CvData }) {
  const c = data?.candidate ?? ({} as any);
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar} />
        <View style={styles.header}>
          <View>
            <Text style={styles.name}>{c.fullName || ""}</Text>
            {c.title ? <Text style={styles.title}>{c.title}</Text> : null}
          </View>
          <View style={styles.contact}>
            {c.location && <Text>{c.location}</Text>}
            {c.email && <Link src={`mailto:${c.email}`}>{c.email}</Link>}
            {c.phone && <Text>{c.phone}</Text>}
            {Array.isArray(c.links) && c.links.map((l:any) => <Link key={l.url} src={l.url}>{l.label || l.url}</Link>)}
          </View>
        </View>

        {c.about && (
          <View style={styles.section}>
            <Text style={styles.h2}>Summary</Text>
            <Text>{c.about}</Text>
          </View>
        )}

        {Array.isArray(c.skills) && c.skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.h2}>Skills</Text>
            <View style={styles.pillRow}>
              {c.skills.map((s:string, i:number) => <Text key={i} style={styles.pill}>{s}</Text>)}
            </View>
          </View>
        )}

        {Array.isArray(c.experiences) && c.experiences.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.h2}>Experience</Text>
            {c.experiences.map((xp:any, i:number) => {
              const bullets = (xp.bullets ?? []).map((b:any) => (typeof b === "string" ? { text: b } : b));
              return (
                <View key={i} style={styles.xpItem}>
                  <View style={styles.xpHead}>
                    <Text style={styles.xpTitle}>{[xp.title, xp.company].filter(Boolean).join(" • ")}</Text>
                    <Text>{[xp.location, xp.startDate, xp.endDate].filter(Boolean).join("  |  ")}</Text>
                  </View>
                  {bullets.map((b:any, j:number) => (
                    <View key={j} style={styles.bullet}>
                      <Text style={styles.dot}>•</Text>
                      <Text>{b?.text}</Text>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {Array.isArray(c.education) && c.education.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.h2}>Education</Text>
            {c.education.map((e:any, i:number) => (
              <Text key={i}>
                {e.degree} — {e.institution} {e.endDate ? `(${e.endDate})` : ""}
              </Text>
            ))}
          </View>
        )}

        {Array.isArray(c.certifications || (c as any).certificates) &&
        (c.certifications || (c as any).certificates).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.h2}>Certifications/Trainings</Text>
            {(c.certifications || (c as any).certificates).map((cert:any, i:number) => (
              <Text key={i}>
                {cert.name}
                {cert.issuer || cert.org ? ` — ${cert.issuer || cert.org}` : ""}
                {cert.start || cert.end || cert.date
                  ? ` (${[cert.start, cert.end].filter(Boolean).join(" – ") || cert.date})`
                  : ""}
              </Text>
            ))}
          </View>
        )}

        {Array.isArray(c.languages) && c.languages.length > 0 && (
          <View style={styles.footLang}>
            <Text style={styles.h2}>Languages</Text>
            {c.languages.map((l:any, i:number) => (
              <Text key={i}>
                {l.language}: {l.levelText ??
                  [l.listening, l.reading, l.spokenInteraction, l.spokenProduction, l.writing].filter(Boolean).join("/")}
              </Text>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
