import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import dayjs from "dayjs";
import type { CvData } from "@/lib/cv-view";

type SkillCategory = { label: string; value: string };
type LanguageItem = { name: string; level: string; score: number };
type ExperienceItem = { headline: string; meta: string };
type PptCvTemplateView = {
  name: string;
  title: string;
  profile: string;
  keySkillsNarrative: string;
  educationSummary: string;
  skillCategories: SkillCategory[];
  languages: LanguageItem[];
  certifications: string[];
  workExperience: ExperienceItem[];
  projectExperienceTitle: string;
  projectExperienceIntro: string;
  projectExperienceBullets: string[];
};

const TEMPLATE_PATH = "components/pptx/templates/custom/ppt-cv-reference-template.pptx";

function S(v: any): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return String(v).trim();
  }
  if (Array.isArray(v)) {
    return v.map(S).filter(Boolean).join(", ").trim();
  }
  if (typeof v === "object") {
    const preferred = [
      v.text,
      v.summary,
      v.description,
      v.value,
      v.label,
      v.name,
      v.title,
      v.content,
    ]
      .map((x) => String(x ?? "").trim())
      .find(Boolean);
    if (preferred) return preferred;
    return Object.values(v).map(S).filter(Boolean).join(" | ").trim();
  }
  return String(v).trim();
}

function A<T = any>(v: any): T[] {
  return Array.isArray(v) ? v : [];
}

function escXml(text: string): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function trimTo(text: string, max: number): string {
  const clean = S(text).replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trimEnd() + "…";
}

function stripTemplateWords(text: string): string {
  return S(text)
    .replace(/\bppt\s*cv\s*template\b/gi, "")
    .replace(/\bpptcvtemplate\b/gi, "")
    .replace(/\btemplate\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function formatDate(value: any): string {
  const raw = S(value);
  if (!raw) return "";
  const m = dayjs(raw);
  if (m.isValid()) return m.format("MMM YYYY");
  const normalized = raw.toLowerCase();
  if (normalized === "present" || normalized === "current" || normalized === "ongoing") return "Present";
  return raw;
}

function dataUrlToBuffer(dataUrl?: string) {
  if (!dataUrl || !/^data:image\/(png|jpe?g);base64,/i.test(dataUrl)) return null;
  const b64 = dataUrl.split(",", 2)[1] || "";
  return Buffer.from(b64, "base64");
}

function proficiencyScore(level: string): number {
  const lc = S(level).toLowerCase();
  if (!lc) return 2;
  if (lc.includes("native")) return 5;
  if (lc.includes("fluent") || lc.includes("c2")) return 4;
  if (lc.includes("advanced") || lc.includes("c1")) return 4;
  if (lc.includes("upper") || lc.includes("b2")) return 3;
  if (lc.includes("intermediate") || lc.includes("b1")) return 3;
  if (lc.includes("elementary") || lc.includes("a2")) return 2;
  return 1;
}

async function callAzureOpenAiJson(system: string, payload: any) {
  const endpoint = (process.env.AZURE_OPENAI_ENDPOINT || "").replace(/\/+$/, "");
  const apiKey = (process.env.AZURE_OPENAI_API_KEY || process.env.AZURE_OPENAI_KEY || "").trim();
  const deployment =
    (process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT || "").trim();
  const apiVersion = (process.env.AZURE_OPENAI_CHAT_API_VERSION || "2024-10-01-preview").trim();

  if (!endpoint || !apiKey || !deployment) return null;

  try {
    const res = await fetch(
      `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": apiKey },
        body: JSON.stringify({
          response_format: { type: "json_object" },
          temperature: 0.2,
          messages: [
            { role: "system", content: system },
            { role: "user", content: JSON.stringify(payload) },
          ],
        }),
      }
    );
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    const content = json?.choices?.[0]?.message?.content;
    return content ? JSON.parse(content) : null;
  } catch {
    return null;
  }
}

function replaceTextNodes(shapeXml: string, values: string[]) {
  let index = 0;
  return shapeXml.replace(/<a:t>([\s\S]*?)<\/a:t>/g, () => `<a:t>${escXml(values[index++] || "")}</a:t>`);
}

function replaceShapeByIndex(slideXml: string, shapeIndex: number, values: string[]) {
  const shapes = [...slideXml.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/g)];
  const target = shapes[shapeIndex];
  if (!target) return slideXml;
  const next = replaceTextNodes(target[0], values);
  return slideXml.slice(0, target.index || 0) + next + slideXml.slice((target.index || 0) + target[0].length);
}

function transformShapeByIndex(slideXml: string, shapeIndex: number, transform: (shapeXml: string) => string) {
  const shapes = [...slideXml.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/g)];
  const target = shapes[shapeIndex];
  if (!target) return slideXml;
  const next = transform(target[0]);
  return slideXml.slice(0, target.index || 0) + next + slideXml.slice((target.index || 0) + target[0].length);
}

function replaceParagraphs(shapeXml: string, paragraphXmls: string[]) {
  const txBodyMatch = shapeXml.match(/<p:txBody>([\s\S]*?)<\/p:txBody>/);
  if (!txBodyMatch) return shapeXml;
  const txBody = txBodyMatch[1];
  const paragraphs = [...txBody.matchAll(/<a:p\b[\s\S]*?<\/a:p>/g)];
  if (!paragraphs.length) return shapeXml;
  const prefix = txBody.slice(0, paragraphs[0].index || 0);
  const suffix = txBody.slice((paragraphs.at(-1)?.index || 0) + (paragraphs.at(-1)?.[0].length || 0));
  const nextTxBody = `<p:txBody>${prefix}${paragraphXmls.join("")}${suffix}</p:txBody>`;
  return shapeXml.replace(/<p:txBody>[\s\S]*?<\/p:txBody>/, nextTxBody);
}

function replaceShapeParagraphsByIndex(slideXml: string, shapeIndex: number, paragraphXmls: string[]) {
  const shapes = [...slideXml.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/g)];
  const target = shapes[shapeIndex];
  if (!target) return slideXml;
  const next = replaceParagraphs(target[0], paragraphXmls);
  return slideXml.slice(0, target.index || 0) + next + slideXml.slice((target.index || 0) + target[0].length);
}

function makeParagraphFromTemplate(paragraphXml: string, values: string[]) {
  return replaceTextNodes(paragraphXml, values);
}

function buildSkillCategoryTokens(categories: SkillCategory[]) {
  const rows = categories.slice(0, 9);
  const tokens: string[] = [];
  rows.forEach((row) => {
    tokens.push(trimTo(row.label, 28));
    tokens.push(trimTo(row.value, 72));
  });
  while (tokens.length < 18) tokens.push("");
  return tokens.slice(0, 18);
}

function buildLanguageTokens(languages: LanguageItem[]) {
  const items = languages.slice(0, 2);
  const tokens: string[] = [];
  items.forEach((lang) => {
    tokens.push(trimTo(lang.name, 16));
    tokens.push(trimTo(lang.level, 12));
  });
  while (tokens.length < 4) tokens.push("");
  return tokens;
}

function buildCertificationTokens(certs: string[]) {
  const items = certs.slice(0, 3);
  const tokens: string[] = [];
  items.forEach((cert, idx) => {
    tokens.push(trimTo(cert, 40));
    if (idx < items.length - 1) {
      tokens.push(idx === 1 ? "-------------------------------------------------------" : "--------------------------------------------------------------------------");
    }
  });
  while (tokens.length < 7) tokens.push("");
  return tokens.slice(0, 7);
}

function buildFactPayload(data: CvData) {
  const c: any = data?.candidate || {};
  return {
    name: stripTemplateWords(S(c.fullName || c.name)),
    title: stripTemplateWords(S(c.title)),
    summary: S(c.summary),
    skills: A(c.skills).map(S).filter(Boolean),
    experiences: A(c.experiences).map((exp: any) => ({
      title: S(exp?.title || exp?.role),
      company: S(exp?.company || exp?.employer),
      start: formatDate(exp?.start),
      end: formatDate(exp?.end || (exp?.current ? "Present" : "")),
      location: S(exp?.location),
      description: S(exp?.description || exp?.summary),
      bullets: A(exp?.bullets).map((b: any) => S(typeof b === "string" ? b : b?.text)).filter(Boolean),
      technologies: A(exp?.technologies || exp?.tools).map((t: any) => S(typeof t === "string" ? t : t?.name)).filter(Boolean),
    })),
    education: A(c.education).map((ed: any) => ({
      degree: S(ed?.degree),
      school: S(ed?.school),
      field: S(ed?.fieldOfStudy || ed?.field || ed?.studyField || ed?.major),
      start: S(ed?.start),
      end: S(ed?.end),
      location: S(ed?.location),
    })),
    certifications: A(c.certifications).map((cert: any) => ({
      name: S(cert?.name || cert?.title || cert?.certification),
      issuer: S(cert?.issuer || cert?.org || cert?.company),
      date: S(cert?.date || cert?.validUntil || cert?.end || cert?.start),
    })),
    languages: A(c.languages).map((lang: any) => ({
      name: S(lang?.name || lang?.language),
      level: S(lang?.levelText || lang?.level),
    })),
  };
}

async function buildView(data: CvData): Promise<PptCvTemplateView> {
  const c: any = data?.candidate || {};
  const facts = buildFactPayload(data);
  const mostRecent = A(c.experiences)[0] || {};
  const fallback: PptCvTemplateView = {
    name: stripTemplateWords(S(c.fullName || c.name || "Candidate")),
    title: trimTo(stripTemplateWords(S(c.title)), 32),
    profile: trimTo(S(c.summary), 700),
    keySkillsNarrative: trimTo(A(c.skills).map(S).filter(Boolean).slice(0, 24).join(", "), 1400),
    educationSummary: trimTo(
      [S(A(c.education)[0]?.degree), S(A(c.education)[0]?.fieldOfStudy), S(A(c.education)[0]?.school)]
        .filter(Boolean)
        .join(" from "),
      150
    ),
    skillCategories: [],
    languages: A(c.languages)
      .slice(0, 2)
      .map((lang: any) => ({
        name: S(lang?.name || lang?.language),
        level: S(lang?.levelText || lang?.level),
        score: proficiencyScore(S(lang?.levelText || lang?.level)),
      })),
    certifications: A(c.certifications)
      .slice(0, 3)
      .map((cert: any) => trimTo(S(cert?.name || cert?.title || cert?.certification), 40)),
    workExperience: A(c.experiences)
      .slice(0, 4)
      .map((exp: any) => ({
        headline: trimTo(`• ${[S(exp?.title || exp?.role), S(exp?.company || exp?.employer)].filter(Boolean).join(" at ")}`, 54),
        meta: trimTo(
          [S(exp?.location) ? `(${S(exp?.location)})` : "", [formatDate(exp?.start), formatDate(exp?.end || (exp?.current ? "Present" : ""))].filter(Boolean).join(" - ")]
            .filter(Boolean)
            .join(" ▪ "),
          48
        ),
      })),
    projectExperienceTitle: trimTo([S(mostRecent?.title || mostRecent?.role), S(mostRecent?.company || mostRecent?.employer)].filter(Boolean).join(" | "), 52),
    projectExperienceIntro: trimTo(firstNonEmpty(S(mostRecent?.description || mostRecent?.summary), A(mostRecent?.bullets).map((b: any) => S(typeof b === "string" ? b : b?.text)).filter(Boolean).join(" ")), 130),
    projectExperienceBullets: A(mostRecent?.bullets)
      .map((b: any) => S(typeof b === "string" ? b : b?.text))
      .filter(Boolean)
      .slice(0, 5)
      .map((t: string) => trimTo(t, 120)),
  };

  const llm = await callAzureOpenAiJson(
    "Return strict JSON with { profile, keySkillsNarrative, educationSummary, skillCategories:[{label,value}], languages:[{name,level,score}], certifications:[string], workExperience:[{headline,meta}], projectExperienceTitle, projectExperienceIntro, projectExperienceBullets:[string] }. Use only the supplied CV/editor data. Optimize for slide 1 of a fixed-layout executive CV deck. Fill available space well without sounding repetitive. Constraints: profile should aim for 520-700 chars and use the available box fully with a polished executive summary. keySkillsNarrative should aim for 900-1400 chars and read like a dense capability overview rather than a comma list. skillCategories max 8, each label <= 24 chars, each value <= 64 chars. languages max 2. certifications max 3, each <= 40 chars. workExperience max 4, each headline <= 50 chars, each meta <= 44 chars and should include formatted dates like 'Mar 2021 - Present'. The projectExperience* fields must be based only on the most recent employment entry and should clearly mention the current company role. projectExperienceTitle <= 48 chars. projectExperienceIntro <= 130 chars. projectExperienceBullets max 5, each <= 120 chars. Remove any template words from names/titles. Do not invent facts.",
    { candidate: facts, most_recent_experience: facts.experiences[0] || null }
  );

  return {
    ...fallback,
    name: trimTo(stripTemplateWords(S(llm?.name || fallback.name)), 28),
    title: trimTo(stripTemplateWords(S(llm?.title || fallback.title)), 32),
    profile: trimTo(S(llm?.profile || fallback.profile), 700),
    keySkillsNarrative: trimTo(S(llm?.keySkillsNarrative || fallback.keySkillsNarrative), 1400),
    educationSummary: trimTo(S(llm?.educationSummary || fallback.educationSummary), 150),
    skillCategories: A(llm?.skillCategories).length
      ? A(llm?.skillCategories).slice(0, 8).map((x: any) => ({ label: trimTo(S(x?.label), 24), value: trimTo(S(x?.value), 64) }))
      : fallback.skillCategories.length
      ? fallback.skillCategories
      : [
          { label: "Core Skills", value: trimTo(A(c.skills).map(S).filter(Boolean).slice(0, 8).join(", "), 72) },
        ],
    languages: A(llm?.languages).length
      ? A(llm?.languages).slice(0, 2).map((x: any) => ({ name: trimTo(S(x?.name), 16), level: trimTo(S(x?.level), 12), score: Math.max(1, Math.min(5, Number(x?.score) || proficiencyScore(S(x?.level)))) }))
      : fallback.languages,
    certifications: A(llm?.certifications).length
      ? A(llm?.certifications).slice(0, 3).map((x: any) => trimTo(S(x), 40))
      : fallback.certifications,
    workExperience: A(llm?.workExperience).length
      ? A(llm?.workExperience).slice(0, 4).map((x: any) => ({ headline: trimTo(S(x?.headline), 50), meta: trimTo(S(x?.meta), 44) }))
      : fallback.workExperience,
    projectExperienceTitle: trimTo(S(llm?.projectExperienceTitle || fallback.projectExperienceTitle), 48),
    projectExperienceIntro: trimTo(S(llm?.projectExperienceIntro || fallback.projectExperienceIntro), 130),
    projectExperienceBullets: A(llm?.projectExperienceBullets).length
      ? A(llm?.projectExperienceBullets).slice(0, 5).map((x: any) => trimTo(S(x), 120))
      : fallback.projectExperienceBullets,
  };
}

function firstNonEmpty(...vals: string[]) {
  return vals.map(S).find(Boolean) || "";
}

function buildWorkExperienceParagraphs(shapeXml: string, items: ExperienceItem[]) {
  const paragraphs = [...shapeXml.matchAll(/<a:p\b[\s\S]*?<\/a:p>/g)].map((m) => m[0]);
  const headlineTemplate = paragraphs[0] || "";
  const middleTemplate = paragraphs[1] || headlineTemplate;
  const nextParagraphs = items.length
    ? items.map((item) => {
        let para = makeParagraphFromTemplate(headlineTemplate, [item.headline, item.meta]);
        if ((para.match(/<a:t>/g) || []).length === 1) {
          para = makeParagraphFromTemplate(headlineTemplate, [`${item.headline}${item.meta ? ` ${item.meta}` : ""}`]);
        }
        return para;
      })
    : [makeParagraphFromTemplate(middleTemplate, [""])];
  return replaceParagraphs(shapeXml, nextParagraphs);
}

function buildProjectExperienceParagraphs(shapeXml: string, view: PptCvTemplateView) {
  const paragraphs = [...shapeXml.matchAll(/<a:p\b[\s\S]*?<\/a:p>/g)].map((m) => m[0]);
  const titleTemplate = paragraphs[0] || "";
  const introTemplate = paragraphs[1] || titleTemplate;
  const bulletTemplate = paragraphs[2] || introTemplate;
  const nextParagraphs = [
    makeParagraphFromTemplate(titleTemplate, [view.projectExperienceTitle]),
    makeParagraphFromTemplate(introTemplate, [view.projectExperienceIntro]),
    ...view.projectExperienceBullets.map((bullet) => makeParagraphFromTemplate(bulletTemplate, [bullet])),
  ];
  return replaceParagraphs(shapeXml, nextParagraphs);
}

function buildLanguageDotsShape(shapeXml: string, languages: LanguageItem[]) {
  const paragraphs = [...shapeXml.matchAll(/<a:p\b[\s\S]*?<\/a:p>/g)];
  let nextShape = shapeXml;
  paragraphs.forEach((match, idx) => {
    const score = languages[idx]?.score || 0;
    const red = score ? "●".repeat(score) : "";
    const black = score ? "●".repeat(Math.max(0, 5 - score)) : "";
    const texts = [...match[0].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)];
    let nextPara = match[0];
    if (texts.length >= 2) {
      nextPara = replaceTextNodes(match[0], [red, black]);
    } else {
      nextPara = replaceTextNodes(match[0], [red || black]);
    }
    nextShape = nextShape.replace(match[0], nextPara);
  });
  return nextShape;
}

export async function makePptCvTemplate(data: CvData): Promise<Buffer> {
  const bytes = await readFile(path.join(process.cwd(), TEMPLATE_PATH));
  const zip = await JSZip.loadAsync(bytes);
  const view = await buildView(data);
  let slideXml = await zip.file("ppt/slides/slide1.xml")!.async("string");

  slideXml = replaceShapeByIndex(slideXml, 0, [view.name]);
  slideXml = replaceShapeByIndex(slideXml, 1, [view.title]);
  slideXml = replaceShapeByIndex(slideXml, 3, [view.profile]);
  slideXml = replaceShapeByIndex(slideXml, 5, [view.keySkillsNarrative]);
  slideXml = replaceShapeByIndex(slideXml, 8, [view.educationSummary]);
  slideXml = replaceShapeByIndex(slideXml, 9, buildSkillCategoryTokens(view.skillCategories));
  slideXml = replaceShapeByIndex(slideXml, 11, buildLanguageTokens(view.languages));
  slideXml = transformShapeByIndex(slideXml, 12, (shapeXml) => buildLanguageDotsShape(shapeXml, view.languages));
  slideXml = transformShapeByIndex(slideXml, 13, (shapeXml) => replaceTextNodes(shapeXml, buildCertificationTokens(view.certifications)));
  slideXml = transformShapeByIndex(slideXml, 16, (shapeXml) => buildWorkExperienceParagraphs(shapeXml, view.workExperience));
  slideXml = transformShapeByIndex(slideXml, 18, (shapeXml) => buildProjectExperienceParagraphs(shapeXml, view));

  zip.file("ppt/slides/slide1.xml", slideXml);

  const photo = dataUrlToBuffer((data?.candidate as any)?.photoUrl);
  if (photo) {
    zip.file("ppt/media/image1.png", photo);
  }

  return (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
}
