// lib/pptx/KyndrylSM.ts
import PptxGenJS from "pptxgenjs";
import type { KyndrylSMSlide } from "@/lib/kyndryl-sm";

const BRAND = "#FF462D";
const DARK = "000000";
const LIGHT = "FFFFFF";

function listText(arr: string[]) {
  return arr.map((t) => `– ${t}`).join("\n");
}

export async function makeKyndrylSM(view: KyndrylSMSlide): Promise<Buffer> {
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

  const s = pptx.addSlide({ masterName: "KYNDRYL" });
  const leftW = 4.0;

  s.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: leftW,
    h: 7.5,
    fill: { color: BRAND },
    line: { color: BRAND },
  });

  if (view.photoDataUrl) {
    s.addShape(pptx.ShapeType.rect, {
      x: 0.6,
      y: 0.6,
      w: 1.55,
      h: 1.55,
      fill: { color: LIGHT },
      line: { color: LIGHT },
    });
    s.addImage({
      data: view.photoDataUrl,
      x: 0.66,
      y: 0.66,
      w: 1.43,
      h: 1.43,
    });
  }

  s.addText(view.name || "Candidate", {
    x: 0.6,
    y: 2.35,
    w: leftW - 1.0,
    h: 0.4,
    fontSize: 18,
    bold: true,
    color: LIGHT,
  });
  if (view.title) {
    s.addText(view.title, {
      x: 0.6,
      y: 2.82,
      w: leftW - 1.0,
      h: 0.3,
      fontSize: 12,
      color: LIGHT,
    });
  }
  if (view.location) {
    s.addText(view.location, {
      x: 0.6,
      y: 3.16,
      w: leftW - 1.0,
      h: 0.3,
      fontSize: 10.5,
      color: LIGHT,
    });
  }

  s.addText("PREVIOUS ROLES", {
    x: 0.6,
    y: 3.85,
    w: leftW - 1.0,
    h: 0.3,
    fontSize: 10.5,
    bold: true,
    color: LIGHT,
  });

  if (view.previousRoles.length) {
    s.addText(listText(view.previousRoles), {
      x: 0.75,
      y: 4.18,
      w: leftW - 1.1,
      h: 2.2,
      color: LIGHT,
      fontSize: 10.5,
    });
  }

  s.addText("kyndryl", {
    x: 0.6,
    y: 6.95,
    w: leftW - 1.0,
    h: 0.3,
    fontSize: 12,
    color: LIGHT,
    bold: true,
  });

  const rightX = leftW + 0.35;
  const colW = 2.7;

  s.addText("KEY SKILLS", {
    x: rightX,
    y: 0.6,
    w: colW,
    h: 0.3,
    fontSize: 10.5,
    bold: true,
    color: BRAND,
  });
  if (view.keySkills.length) {
    s.addText(listText(view.keySkills), {
      x: rightX,
      y: 0.95,
      w: colW,
      h: 2.0,
      color: DARK,
      fontSize: 10.5,
    });
  }

  s.addText("INDUSTRY/DOMAIN EXPERTISE", {
    x: rightX + colW + 0.4,
    y: 0.6,
    w: colW,
    h: 0.3,
    fontSize: 10.5,
    bold: true,
    color: BRAND,
  });
  if (view.industryExpertise.length) {
    s.addText(listText(view.industryExpertise), {
      x: rightX + colW + 0.4,
      y: 0.95,
      w: colW,
      h: 2.0,
      color: DARK,
      fontSize: 10.5,
    });
  }

  s.addText("CERTIFICATIONS", {
    x: rightX + (colW + 0.4) * 2,
    y: 0.6,
    w: colW,
    h: 0.3,
    fontSize: 10.5,
    bold: true,
    color: BRAND,
  });
  if (view.certifications.length) {
    s.addText(listText(view.certifications), {
      x: rightX + (colW + 0.4) * 2,
      y: 0.95,
      w: colW,
      h: 2.0,
      color: DARK,
      fontSize: 10.5,
    });
  }

  s.addShape(pptx.ShapeType.line, {
    x: rightX,
    y: 3.25,
    w: 8.5,
    h: 0,
    line: { color: "B59A86", width: 1 },
  });

  s.addText("BIO-SYNOPSIS AND EXPERIENCE SUMMARY", {
    x: rightX,
    y: 3.4,
    w: 8.5,
    h: 0.3,
    fontSize: 10.5,
    bold: true,
    color: BRAND,
  });

  if (view.bioSummary.length) {
    s.addText(listText(view.bioSummary), {
      x: rightX,
      y: 3.8,
      w: 8.5,
      h: 3.0,
      color: DARK,
      fontSize: 10.5,
    });
  }

  // @ts-ignore pptxgenjs node export
  return pptx.write("nodebuffer");
}
