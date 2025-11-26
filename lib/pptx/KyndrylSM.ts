// lib/pptx/KyndrylSM.ts
import PptxGenJS from "pptxgenjs";

export type CvData = {
  candidate?: {
    fullName?: string;
    title?: string;
    location?: string;
    email?: string;
    phone?: string;
    summary?: string;
    skills?: string[];
    experiences?: Array<{
      title?: string;
      company?: string;
      start?: string;
      end?: string;
      location?: string;
      bullets?: Array<{ text?: string }>;
    }>;
    education?: Array<{
      school?: string;
      degree?: string;
      start?: string;
      end?: string;
    }>;
    languages?: Array<{ language?: string; levelText?: string }>;
    photoDataUrl?: string;
  };
};

const BRAND = "#FF462D";
const DARK = "000000";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function makeKyndrylSM(data: CvData): Promise<Buffer> {
  const c = data?.candidate ?? {};
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";

  pptx.defineSlideMaster({
    title: "KYNDRYL",
    background: { color: "FFFFFF" },
    objects: [
      {
        rect: {
          x: 0,
          y: 0,
          w: 13.33,
          h: 0.5,
          fill: { color: BRAND },
        },
      },
    ],
    slideNumber: { x: 12.4, y: 7.0, color: "7A7A7A", fontSize: 10 },
  });

  {
    const s = pptx.addSlide({ masterName: "KYNDRYL" });
    s.addText(c.fullName || "Candidate", {
      x: 0.6,
      y: 1.0,
      w: 9.5,
      h: 1,
      fontSize: 44,
      bold: true,
      color: DARK,
    });
    if (c.title)
      s.addText(c.title, {
        x: 0.6,
        y: 1.8,
        w: 9.5,
        h: 0.6,
        fontSize: 20,
        color: BRAND,
      });
    const contacts = [c.location, c.email, c.phone]
      .filter(Boolean)
      .join(" · ");
    if (contacts)
      s.addText(contacts, {
        x: 0.6,
        y: 2.5,
        w: 9.5,
        h: 0.5,
        fontSize: 12,
        color: "444444",
      });
    if (c.summary)
      s.addText(c.summary, {
        x: 0.6,
        y: 3.2,
        w: 9.5,
        h: 2.2,
        fontSize: 14,
        color: "222222",
      });
    if (c.photoDataUrl)
      s.addImage({
        data: c.photoDataUrl,
        x: 10.5,
        y: 1.2,
        w: 2.5,
        h: 2.5,
        // rounding removed: TS expects boolean here in this version
      });
  }

  const exps = Array.isArray(c.experiences)
    ? c.experiences.filter((e) => e?.title || e?.company)
    : [];
  if (exps.length) {
    const groups = chunk(exps, 5);
    groups.forEach((group) => {
      const s = pptx.addSlide({ masterName: "KYNDRYL" });
      s.addText("Experience", {
        x: 0.6,
        y: 0.7,
        w: 12,
        h: 0.6,
        fontSize: 24,
        color: BRAND,
        bold: true,
      });
      let y = 1.3;
      group.forEach((e) => {
        const header = `${e.title || "Role"}${
          e.company ? " — " + e.company : ""
        }${
          e.start || e.end
            ? ` (${e.start ?? "—"} – ${e.end ?? "Present"})`
            : ""
        }${e.location ? ` · ${e.location}` : ""}`;
        s.addText(header, {
          x: 0.6,
          y,
          w: 12,
          h: 0.4,
          fontSize: 16,
          bold: true,
          color: DARK,
        });
        y += 0.45;
        const bullets = Array.isArray(e.bullets)
          ? e.bullets
              .map((b) => b?.text)
              .filter(Boolean)
              .slice(0, 3)
          : [];
        if (bullets.length) {
          s.addText(
            bullets.map((t) => ({
              text: t as string,
              options: { bullet: true, fontSize: 12 },
            })),
            { x: 0.8, y, w: 11.2, h: 1.0 }
          );
          y += 0.9;
        } else {
          y += 0.25;
        }
        y += 0.15;
      });
    });
  }

  const edus = Array.isArray(c.education)
    ? c.education.filter((e) => e?.school || e?.degree)
    : [];
  if (edus.length) {
    const s = pptx.addSlide({ masterName: "KYNDRYL" });
    s.addText("Education", {
      x: 0.6,
      y: 0.7,
      w: 12,
      h: 0.6,
      fontSize: 24,
      color: BRAND,
      bold: true,
    });
    let y = 1.4;
    edus.forEach((ed) => {
      const line = `${ed.degree || "Degree"}${
        ed.school ? " — " + ed.school : ""
      }${
        ed.start || ed.end
          ? ` (${ed.start ?? "—"} – ${ed.end ?? "—"})`
          : ""
      }`;
      s.addText(line, {
        x: 0.6,
        y,
        w: 12,
        h: 0.4,
        fontSize: 16,
        color: DARK,
      });
      y += 0.5;
    });
  }

  const skills = Array.isArray(c.skills) ? c.skills.filter(Boolean) : [];
  if (skills.length) {
    const s = pptx.addSlide({ masterName: "KYNDRYL" });
    s.addText("Skills", {
      x: 0.6,
      y: 0.7,
      w: 12,
      h: 0.6,
      fontSize: 24,
      color: BRAND,
      bold: true,
    });
    const cols = 3;
    const perCol = Math.ceil(skills.length / cols);
    const columns = chunk(skills, perCol).slice(0, cols);
    columns.forEach((col, i) => {
      s.addText(col.join("\n"), {
        x: 0.6 + i * 4.0,
        y: 1.4,
        w: 3.8,
        h: 5,
        fontSize: 14,
        color: DARK,
      });
    });
  }

  const langs = Array.isArray(c.languages)
    ? c.languages.filter((l) => l?.language)
    : [];
  if (langs.length) {
    const s = pptx.addSlide({ masterName: "KYNDRYL" });
    s.addText("Languages", {
      x: 0.6,
      y: 0.7,
      w: 12,
      h: 0.6,
      fontSize: 24,
      color: BRAND,
      bold: true,
    });
    s.addText(
      langs
        .map((l) =>
          l.levelText ? `${l.language} (${l.levelText})` : l.language
        )
        .join(" · "),
      {
        x: 0.6,
        y: 1.4,
        w: 12,
        h: 1,
        fontSize: 16,
        color: DARK,
      }
    );
  }

  // @ts-ignore pptxgenjs node export
  return pptx.write("nodebuffer");
}
