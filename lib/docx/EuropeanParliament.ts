// lib/docx/EuropeanParliament.ts
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";

type Bullet = { text?: string };
type Experience = {
  title?: string;
  company?: string;
  start?: string;
  end?: string;
  location?: string;
  bullets?: Bullet[];
};
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
    photoBase64?: string;
  };
};

const H1 = (text: string) =>
  new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 150 },
  });

const H2 = (text: string) =>
  new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 100, after: 60 },
  });

const P = (text = "") => new Paragraph({ children: [new TextRun({ text })] });

const BulletP = (text = "") =>
  new Paragraph({
    children: [new TextRun({ text })],
    bullet: { level: 0 },
  });

export async function buildEPDocx(data: CvData): Promise<Buffer> {
  const c = data?.candidate ?? {};
  const children: any[] = [];

  const headerRow: TableRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 70, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        },
        children: [
          H1("European Parliament – Curriculum Vitae (Form 6)"),
          P(c.fullName || ""),
          c.title ? P(c.title) : P(),
        ],
      }),
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        },
        children: c.photoBase64
          ? [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new ImageRun({
                    data: Buffer.from(c.photoBase64, "base64"),
                    transformation: { width: 160, height: 160 },
                  } as any),
                ],
              }),
            ]
          : [new Paragraph({})],
      }),
    ],
  });

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow],
    })
  );

  children.push(
    H2("Personal Information"),
    P([c.location, c.email, c.phone].filter(Boolean).join(" · "))
  );

  if (c.summary) {
    children.push(H2("Summary"), P(c.summary));
  }

  if (Array.isArray(c.experiences) && c.experiences.length) {
    children.push(H2("Work Experience"));
    c.experiences.forEach((e) => {
      const line = `${e.title || "Role"}${
        e.company ? " — " + e.company : ""
      }${
        e.start || e.end
          ? ` (${e.start ?? "—"} – ${e.end ?? "Present"})`
          : ""
      }${e.location ? ` · ${e.location}` : ""}`;
      children.push(P(line));
      const bullets = Array.isArray(e.bullets)
        ? e.bullets
            .map((b) => (b?.text || "").trim())
            .filter(Boolean)
            .slice(0, 6)
        : [];
      bullets.forEach((t) => children.push(BulletP(t)));
    });
  }

  if (Array.isArray(c.education) && c.education.length) {
    children.push(H2("Education"));
    c.education.forEach((ed) => {
      const line = `${ed.degree || "Degree"}${
        ed.school ? " — " + ed.school : ""
      }${
        ed.start || ed.end
          ? ` (${ed.start ?? "—"} – ${ed.end ?? "—"})`
          : ""
      }`;
      children.push(P(line));
      if (ed.fieldOfStudy || ed.field || ed.studyField || ed.major || ed.specialization || ed.area) {
        children.push(P(`Field(s) of study: ${ed.fieldOfStudy || ed.field || ed.studyField || ed.major || ed.specialization || ed.area}`));
      }
      if (ed.eqfLevel || ed.eqf || ed.levelEqf) {
        children.push(P(`Level in EQF: ${ed.eqfLevel || ed.eqf || ed.levelEqf}`));
      }
    });
  }

  if (Array.isArray(c.skills) && c.skills.length) {
    children.push(H2("Skills"), P(c.skills.join(" · ")));
  }

  if (Array.isArray(c.languages) && c.languages.length) {
    children.push(
      H2("Languages"),
      P(
        c.languages
          .filter((l) => l?.language)
          .map((l) =>
            l.levelText ? `${l.language} (${l.levelText})` : l.language
          )
          .join(" · ")
      )
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
