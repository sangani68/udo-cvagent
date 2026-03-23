import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import type { CvData } from "@/lib/cv-view";
import { toEpFormData } from "@/lib/ep-docx";

type CertRow = { issuer?: string; name?: string; validityDate?: string };
type NonKeySection = {
  category: string;
  profileDescription: string;
  relevantExperience: string;
  requirementLink: string;
  relevantCertifications: CertRow[];
};

type EpWorkBlock = {
  project_name?: string;
  employer?: string;
  dates?: string;
  man_days?: string;
  client?: string;
  project_size?: string;
  project_description?: string;
  roles_responsibilities?: string[];
  technologies?: string[];
};

const NS_DECL =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

function S(v: any) {
  return String(v ?? "").trim();
}

function A<T = any>(v: any): T[] {
  return Array.isArray(v) ? v : [];
}

function firstNonEmpty(...vals: any[]) {
  for (const val of vals) {
    const next = S(val);
    if (next) return next;
  }
  return "";
}

function esc(text: string) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function blockRegex(tag: string) {
  return new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "g");
}

function getBlocks(xml: string | undefined, tag: string) {
  if (!xml) return [];
  return Array.from(xml.matchAll(blockRegex(tag))).map((m) => ({
    text: m[0],
    start: m.index || 0,
    end: (m.index || 0) + m[0].length,
  }));
}

function getDirectBlocks(xml: string | undefined, tag: string) {
  if (!xml) return [];
  const openRe = new RegExp(`<${tag}\\b[\\s\\S]*?>`, "g");
  const closeTag = `</${tag}>`;
  const blocks: Array<{ text: string; start: number; end: number }> = [];
  let pos = 0;
  let depth = 0;
  let start = -1;

  while (pos < xml.length) {
    openRe.lastIndex = pos;
    const open = openRe.exec(xml);
    const openIndex = open?.index ?? -1;
    const closeIndex = xml.indexOf(closeTag, pos);

    if (openIndex >= 0 && (closeIndex < 0 || openIndex < closeIndex)) {
      if (depth === 0) start = openIndex;
      depth += 1;
      pos = openRe.lastIndex;
      continue;
    }

    if (closeIndex >= 0) {
      if (depth > 0) depth -= 1;
      pos = closeIndex + closeTag.length;
      if (depth === 0 && start >= 0) {
        blocks.push({
          text: xml.slice(start, pos),
          start,
          end: pos,
        });
        start = -1;
      }
      continue;
    }

    break;
  }

  return blocks;
}

function getTopLevelTables(xml: string | undefined) {
  return getDirectBlocks(xml, "w:tbl");
}

function replaceDirectBlockAt(xml: string, tag: string, index: number, replacement: string) {
  const blocks = getDirectBlocks(xml, tag);
  const block = blocks[index];
  if (!block) return xml;
  return xml.slice(0, block.start) + replacement + xml.slice(block.end);
}

function makeParagraph(text: string) {
  return `<w:p><w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

function makeParagraphs(lines: string[]) {
  const safe = lines.length ? lines : [""];
  return safe.map((line) => makeParagraph(line)).join("");
}

function replaceCellContent(cellXml: string, lines: string[]) {
  const tcPrMatch = cellXml.match(/<w:tcPr\b[\s\S]*?<\/w:tcPr>/);
  const tcPr = tcPrMatch?.[0] || "";
  return `<w:tc ${NS_DECL}>${tcPr}${makeParagraphs(lines)}</w:tc>`;
}

function setCellLinesInTable(tableXml: string, rowIndex: number, cellIndex: number, lines: string[]) {
  const rows = getDirectBlocks(tableXml, "w:tr");
  const row = rows[rowIndex];
  if (!row) return tableXml;
  const cells = getDirectBlocks(row.text, "w:tc");
  const cell = cells[cellIndex];
  if (!cell) return tableXml;

  const nextRowText =
    row.text.slice(0, cell.start) +
    replaceCellContent(cell.text, lines) +
    row.text.slice(cell.end);

  return replaceDirectBlockAt(tableXml, "w:tr", rowIndex, nextRowText);
}

function setNestedTableRowsInTable(
  tableXml: string,
  rowIndex: number,
  dataRows: string[][],
  templateRowIndex: number
) {
  const rows = getDirectBlocks(tableXml, "w:tr");
  const row = rows[rowIndex];
  if (!row) return tableXml;

  const nestedTables = getDirectBlocks(row.text, "w:tbl");
  const nestedTable = nestedTables.find(
    (block) =>
      block.text.includes("Institute organizing the certification") ||
      block.text.includes("Validity Date")
  );
  if (!nestedTable) return tableXml;

  const replacedNestedTable = setRepeatingRows(nestedTable.text, dataRows, templateRowIndex);
  const nextRowText =
    row.text.slice(0, nestedTable.start) +
    replacedNestedTable +
    row.text.slice(nestedTable.end);

  return replaceDirectBlockAt(tableXml, "w:tr", rowIndex, nextRowText);
}

function setCellLinesInRow(rowXml: string, cellIndex: number, lines: string[]) {
  const cells = getDirectBlocks(rowXml, "w:tc");
  const cell = cells[cellIndex];
  if (!cell) return rowXml;
  return rowXml.slice(0, cell.start) + replaceCellContent(cell.text, lines) + rowXml.slice(cell.end);
}

function cloneRowWithValues(rowXml: string, values: string[]) {
  let next = sanitizeClonedWordXml(rowXml);
  values.forEach((value, index) => {
    next = setCellLinesInRow(next, index, [value]);
  });
  return next;
}

function setRepeatingRows(tableXml: string, dataRows: string[][], templateRowIndex: number) {
  const rows = getDirectBlocks(tableXml, "w:tr");
  const templateRow = rows[templateRowIndex];
  if (!templateRow) return tableXml;
  const builtRows = (dataRows.length ? dataRows : [["", "", ""]]).map((values) =>
    cloneRowWithValues(templateRow.text, values)
  );
  return (
    tableXml.slice(0, templateRow.start) +
    builtRows.join("") +
    tableXml.slice(templateRow.end)
  );
}

function loadTemplate(relPath: string) {
  return readFile(path.join(process.cwd(), relPath));
}

function topCertRows(data: CvData, limit = 2): CertRow[] {
  const c: any = data?.candidate || {};
  const certs = Array.isArray(c.certifications)
    ? c.certifications
    : Array.isArray(c.certificates)
    ? c.certificates
    : [];
  return certs.slice(0, limit).map((cert: any) => ({
    issuer: S(cert?.issuer || cert?.org || cert?.company),
    name: S(cert?.name || cert?.title || cert?.certification),
    validityDate: S(cert?.end || cert?.validUntil || cert?.date || cert?.start),
  }));
}

function getLanguages(data: CvData) {
  const c: any = data?.candidate || {};
  return Array.isArray(c.languages) ? c.languages : [];
}

function getAllCertRows(data: CvData, limit = 6): CertRow[] {
  const c: any = data?.candidate || {};
  const certs = Array.isArray(c.certifications)
    ? c.certifications
    : Array.isArray(c.certificates)
    ? c.certificates
    : [];
  return certs.slice(0, limit).map((cert: any) => ({
    issuer: S(cert?.issuer || cert?.org || cert?.company || cert?.institute),
    name: S(cert?.name || cert?.title || cert?.certification),
    validityDate: S(cert?.end || cert?.validUntil || cert?.date || cert?.start),
  }));
}

function getEducation(data: CvData) {
  const c: any = data?.candidate || {};
  return Array.isArray(c.education) ? c.education : [];
}

function buildCandidateFactSheet(data: CvData) {
  const c: any = data?.candidate || {};
  return {
    name: firstNonEmpty(c.fullName, c.name),
    title: S(c.title),
    summary: S(c.summary),
    contacts: {
      location: S(c.location),
      email: S(c.email),
      phone: S(c.phone),
      linkedin: S(c.linkedin),
    },
    skills: A(c.skills).map(S).filter(Boolean),
    languages: getLanguages(data).map((l: any) => ({
      name: S(l?.name || l?.language),
      level: S(l?.levelText || l?.level),
    })),
    education: getEducation(data).map((ed: any) => ({
      degree: S(ed?.degree),
      school: S(ed?.school),
      fieldOfStudy: firstNonEmpty(ed?.fieldOfStudy, ed?.field, ed?.studyField, ed?.major, ed?.specialization),
      eqfLevel: firstNonEmpty(ed?.eqfLevel, ed?.eqf, ed?.levelEqf),
      start: S(ed?.start),
      end: S(ed?.end),
      location: S(ed?.location),
    })),
    certifications: getAllCertRows(data, 12),
    experiences: A(c.experiences).map((exp: any) => ({
      title: firstNonEmpty(exp?.title, exp?.role),
      company: firstNonEmpty(exp?.company, exp?.employer),
      client: S(exp?.client),
      start: S(exp?.start),
      end: S(exp?.end),
      location: S(exp?.location),
      description: firstNonEmpty(exp?.description, exp?.summary),
      bullets: A(exp?.bullets).map((b: any) => S(typeof b === "string" ? b : b?.text)).filter(Boolean),
      technologies: A(exp?.technologies || exp?.tools).map((t: any) => S(typeof t === "string" ? t : t?.name)).filter(Boolean),
    })),
  };
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
    if (!content) return null;
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function buildEuropeanParliamentEnrichment(data: CvData, ep: any) {
  const parsed = await callAzureOpenAiJson(
    "Return strict JSON with { summary, specialised_expertise, current_function, profile_level, trainings: [{ title, provider, hours, certificate, date }], software_expertise: [{ tool, years, description }], work_experience_blocks: [{ project_name, employer, dates, man_days, client, project_size, project_description, roles_responsibilities, technologies }] }. Use only facts present in the supplied candidate data. Prefer complete, concise field values suitable for an official European Parliament CV form.",
    {
      existing_ep_fields: ep,
      candidate: buildCandidateFactSheet(data),
    }
  );
  return parsed && typeof parsed === "object" ? parsed : null;
}

function mergeEpData(ep: any, enriched: any, data: CvData) {
  const candidate = buildCandidateFactSheet(data);
  const merged: any = { ...ep };
  merged.summary = firstNonEmpty(enriched?.summary, ep?.summary, candidate.summary);
  merged.specialised_expertise = firstNonEmpty(
    enriched?.specialised_expertise,
    ep?.specialised_expertise,
    candidate.summary,
    candidate.skills.join(", ")
  );
  merged.current_function = firstNonEmpty(enriched?.current_function, ep?.current_function, candidate.title);
  merged.profile_level = firstNonEmpty(enriched?.profile_level, ep?.profile_level);

  const llmTrainings = A(enriched?.trainings).filter((x: any) => S(x?.title) || S(x?.provider));
  const detTrainings = A(ep?.trainings).filter((x: any) => S(x?.title) || S(x?.provider));
  const fallbackTrainings = candidate.certifications.map((cert) => ({
    title: S(cert.name),
    provider: S(cert.issuer),
    hours: "",
    certificate: "",
    date: S(cert.validityDate),
  }));
  merged.trainings = llmTrainings.length ? llmTrainings : detTrainings.length ? detTrainings : fallbackTrainings;

  const llmSoftware = A(enriched?.software_expertise).filter((x: any) => S(x?.tool));
  const detSoftware = A(ep?.software_expertise).filter((x: any) => S(x?.tool));
  const fallbackSoftware = candidate.skills.slice(0, 12).map((skill) => ({
    tool: skill,
    years: "",
    description: "",
  }));
  merged.software_expertise = llmSoftware.length ? llmSoftware : detSoftware.length ? detSoftware : fallbackSoftware;

  const llmWork = A(enriched?.work_experience_blocks).filter(
    (x: any) => S(x?.project_name) || S(x?.employer) || S(x?.project_description)
  );
  merged.work_experience_blocks = llmWork.length ? llmWork : A(ep?.work_experience_blocks);
  return merged;
}

function fillEpWorkTable(tableXml: string, work: EpWorkBlock) {
  const dates = S(work?.dates).split(" – ");
  let next = tableXml;
  next = setCellLinesInTable(next, 1, 1, [S(work?.project_name)]);
  next = setCellLinesInTable(next, 2, 1, [S(work?.employer)]);
  next = setCellLinesInTable(
    next,
    3,
    1,
    [`Start (dd/mm/yyyy): ${dates[0] || ""}   End: (dd/mm/yyyy): ${dates[1] || ""}   Effective number of man-days worked on the project: ${S(work?.man_days)}`]
  );
  next = setCellLinesInTable(next, 4, 1, [S(work?.client)]);
  next = setCellLinesInTable(next, 5, 1, [S(work?.project_size)]);
  next = setCellLinesInTable(next, 6, 0, ["Project description:", S(work?.project_description)]);
  next = setCellLinesInTable(
    next,
    7,
    0,
    ["Employee’s roles & responsibilities in the project:", ...A(work?.roles_responsibilities).map(S)]
  );
  next = setCellLinesInTable(
    next,
    8,
    0,
    ["Technologies and methodologies used by the employee in the project:", ...A(work?.technologies).map(S)]
  );
  return next;
}

function sanitizeClonedWordXml(xml: string) {
  return xml
    .replace(/\s+w14:paraId="[^"]*"/g, "")
    .replace(/\s+w14:textId="[^"]*"/g, "")
    .replace(/\s+w:rsidR="[^"]*"/g, "")
    .replace(/\s+w:rsidRPr="[^"]*"/g, "")
    .replace(/\s+w:rsidRDefault="[^"]*"/g, "")
    .replace(/\s+w:rsidP="[^"]*"/g, "")
    .replace(/\s+w:rsidTr="[^"]*"/g, "");
}

function sanitizeGeneratedWorkTableXml(xml: string) {
  return sanitizeClonedWordXml(xml)
    .replace(/<w:r\b[\s\S]*?<w:footnoteReference\b[\s\S]*?<\/w:r>/g, "")
    .replace(/<w:footnoteReference\b[^/]*\/>/g, "")
    .replace(/<w:proofErr\b[^/]*\/>/g, "")
    .replace(/<w:proofErr\b[\s\S]*?<\/w:proofErr>/g, "");
}

function sanitizeFinalDocumentXml(xml: string) {
  return xml
    .replace(/\s+w14:paraId="[^"]*"/g, "")
    .replace(/\s+w14:textId="[^"]*"/g, "")
    .replace(/\s+w:rsidR="[^"]*"/g, "")
    .replace(/\s+w:rsidRPr="[^"]*"/g, "")
    .replace(/\s+w:rsidRDefault="[^"]*"/g, "")
    .replace(/\s+w:rsidP="[^"]*"/g, "")
    .replace(/\s+w:rsidTr="[^"]*"/g, "")
    .replace(/<w:proofErr\b[^/]*\/>/g, "")
    .replace(/<w:proofErr\b[\s\S]*?<\/w:proofErr>/g, "");
}

async function buildNonKeySections(data: CvData): Promise<NonKeySection[]> {
  const categories = [
    "Enterprise Architecture",
    "Domain Specific Enterprise Architecture",
    "Project Management",
    "Project and Programme Strategy and Methods Design",
    "Business Analysis",
    "Communication",
    "Demand Management and IT Investment",
  ];

  const c: any = data?.candidate || {};
  const summary = S(c.summary || "");
  const skills = Array.isArray(c.skills) ? c.skills.map(S).filter(Boolean) : [];
  const exps = Array.isArray(c.experiences) ? c.experiences : [];
  const certs = getAllCertRows(data, 12);
  const education = getEducation(data);
  const languages = getLanguages(data);

  const parsed = await callAzureOpenAiJson(
    "Return strict JSON with { sections: [{ category, profileDescription, relevantExperience, requirementLink, relevantCertifications: [{ issuer, name, validityDate }] }] }. You are filling a formal non-key personnel capability matrix. Use only facts present in the supplied CV/editor data. For each requested category, infer the most relevant experience, skills, certifications, education, and languages. profileDescription should be concise but substantive. relevantExperience should mention concrete roles, employers, scope, dates, and notable responsibilities where available.",
    {
      categories,
      candidate: {
        ...buildCandidateFactSheet(data),
        title: c.title,
        summary,
        skills,
        experiences: exps,
        certifications: certs,
        education,
        languages,
      },
    }
  );
  const sections = Array.isArray(parsed?.sections) ? parsed.sections : [];
  if (sections.length === categories.length) {
    return sections.map((section: any, index: number) => ({
      category: categories[index],
      profileDescription: S(section?.profileDescription || summary),
      relevantExperience: S(section?.relevantExperience),
      requirementLink: S(section?.requirementLink),
      relevantCertifications: Array.isArray(section?.relevantCertifications)
        ? section.relevantCertifications.slice(0, 3).map((cert: any) => ({
            issuer: S(cert?.issuer),
            name: S(cert?.name),
            validityDate: S(cert?.validityDate),
          }))
        : [],
    }));
  }

  return categories.map((category, index) => {
    const keywordMap: Record<string, string[]> = {
      "Enterprise Architecture": ["architecture", "enterprise", "strategy", "transformation"],
      "Domain Specific Enterprise Architecture": ["domain", "solution", "application", "platform", "cloud", "data"],
      "Project Management": ["project", "delivery", "manager", "coordination", "stakeholder"],
      "Project and Programme Strategy and Methods Design": ["programme", "method", "governance", "planning", "strategy"],
      "Business Analysis": ["analysis", "business", "requirements", "process", "workshop"],
      "Communication": ["communication", "presentation", "stakeholder", "client", "reporting"],
      "Demand Management and IT Investment": ["demand", "portfolio", "investment", "roadmap", "budget"],
    };
    const keywords = keywordMap[category] || [];
    const scored: Array<{ exp: any; score: number }> = exps
      .map((exp: any) => {
        const text = [
          S(exp?.title || exp?.role),
          S(exp?.company || exp?.employer),
          S(exp?.description || exp?.summary),
          ...A(exp?.bullets).map((b: any) => S(typeof b === "string" ? b : b?.text)),
        ]
          .join(" ")
          .toLowerCase();
        const score = keywords.reduce((acc, kw) => acc + (text.includes(kw) ? 1 : 0), 0);
        return { exp, score };
      })
      .sort((a: { exp: any; score: number }, b: { exp: any; score: number }) => b.score - a.score);
    const chosen = scored.filter((x) => x.score > 0).slice(0, 2).map((x) => x.exp);
    const fallbackExp = chosen.length ? chosen : exps.slice(index, index + 2).length ? exps.slice(index, index + 2) : exps.slice(0, 2);
    const experienceLine = fallbackExp
      .map((exp: any) =>
        [
          S(exp?.title || exp?.role),
          S(exp?.company || exp?.employer),
          [S(exp?.start), S(exp?.end)].filter(Boolean).join(" – "),
          firstNonEmpty(exp?.description, exp?.summary),
        ]
          .filter(Boolean)
          .join(" | ")
      )
      .filter(Boolean)
      .join("\n");
    return {
      category,
      profileDescription:
        summary ||
        [S(c.title), skills.slice(0, 10).join(", "), languages.map((l: any) => S(l?.name || l?.language)).filter(Boolean).join(", ")]
          .filter(Boolean)
          .join(" – "),
      relevantExperience: experienceLine,
      requirementLink: "",
      relevantCertifications: certs.slice(0, 3),
    };
  });
}

export async function buildEuropeanParliamentTemplateDocx(data: CvData) {
  const bytes = await loadTemplate("components/docx/templates/custom/european-parliament-template.docx");
  const zip = await JSZip.loadAsync(bytes);
  let xml = await zip.file("word/document.xml")!.async("string");

  const baseEp = toEpFormData(data) as any;
  const ep = mergeEpData(baseEp, await buildEuropeanParliamentEnrichment(data, baseEp), data);
  const langs = getLanguages(data);
  const trainingRows = Array.isArray(ep.trainings) ? ep.trainings : [];
  const softwareRows = Array.isArray(ep.software_expertise)
    ? ep.software_expertise
    : [];
  const workBlocks = Array.isArray(ep.work_experience_blocks) && ep.work_experience_blocks.length
    ? ep.work_experience_blocks
    : [{}];

  let tables = getTopLevelTables(xml).map((b) => b.text);
  if (tables.length < 5) {
    throw new Error(`European Parliament template structure mismatch: expected 5 top-level tables, found ${tables.length}.`);
  }

  let t1 = tables[0];
  t1 = setCellLinesInTable(t1, 0, 1, [`${S(ep.surname)}, ${S(ep.name)}`.replace(/^,\s*/, "")]);
  t1 = setCellLinesInTable(t1, 1, 1, [S(ep.date_of_birth)]);
  t1 = setCellLinesInTable(t1, 2, 1, [S(ep.gender)]);
  t1 = setCellLinesInTable(t1, 3, 1, [S(ep.nationality)]);
  t1 = setCellLinesInTable(
    t1,
    4,
    1,
    [`Employer: ${S(ep.employer)}  Date of recruitment: ${S(ep.date_of_recruitment)}`.trim()]
  );
  t1 = setCellLinesInTable(t1, 5, 1, [S(ep.current_function)]);
  t1 = setCellLinesInTable(t1, 6, 1, [S(ep.profile_level)]);
  t1 = setCellLinesInTable(t1, 7, 1, [S(ep.sc_reference)]);
  t1 = setCellLinesInTable(t1, 8, 1, [S(ep.highest_qualification)]);
  t1 = setCellLinesInTable(t1, 8, 2, [S(ep.degree_name)]);
  t1 = setCellLinesInTable(t1, 8, 3, [`Institute: ${S(ep.institute)}  Date: ${S(ep.degree_date)}`.trim()]);
  t1 = setCellLinesInTable(t1, 9, 1, [
    `English: ${S(langs[0]?.name || "").toLowerCase().includes("english") ? langs[0]?.level || langs[0]?.levelText || "" : ""}`,
    `French: ${S(langs.find((l: any) => S(l?.name || l?.language).toLowerCase().includes("french"))?.level || "")}`,
    `Other(s): ${langs
      .filter((l: any) => {
        const nm = S(l?.name || l?.language).toLowerCase();
        return nm && !nm.includes("english") && !nm.includes("french");
      })
      .map((l: any) => `${S(l?.name || l?.language)} ${S(l?.level || l?.levelText)}`.trim())
      .join(", ")}`,
  ]);
  t1 = setCellLinesInTable(t1, 9, 2, [S(langs[0]?.level || langs[0]?.levelText)]);
  t1 = setCellLinesInTable(t1, 9, 3, [S(langs[0]?.level || langs[0]?.levelText)]);
  t1 = setCellLinesInTable(t1, 9, 4, [S(langs[0]?.level || langs[0]?.levelText)]);
  t1 = setCellLinesInTable(t1, 9, 5, [S(langs[0]?.level || langs[0]?.levelText)]);
  t1 = setCellLinesInTable(t1, 10, 1, [S(ep.date_it_career_started)]);
  t1 = setCellLinesInTable(t1, 11, 1, [S(ep.specialised_expertise)]);
  tables[0] = t1;

  let t2 = tables[1];
  t2 = setCellLinesInTable(t2, 0, 0, [
    "Summary (use this area to briefly indicate the major facts which should be known about this employee):",
    S(ep.summary || ep.specialised_expertise),
  ]);
  tables[1] = t2;

  let t3 = tables[2];
  t3 = setRepeatingRows(
    t3,
    trainingRows.map((t: any, index: number) => [
      `${index + 1}.`,
      S(t?.title),
      S(t?.provider),
      S(t?.hours),
      S(t?.certificate),
      S(t?.date),
    ]),
    2
  );
  tables[2] = t3;

  let t4 = tables[3];
  t4 = setRepeatingRows(
    t4,
    softwareRows.map((s: any, index: number) => [
      `${index + 1}.`,
      S(s?.tool),
      S(s?.years),
      S(s?.description),
    ]),
    2
  );
  tables[3] = t4;

  const workTableTemplate = tables[4];
  const workTablesXml = workBlocks
    .map((work: EpWorkBlock, index: number) => {
      const filled = sanitizeGeneratedWorkTableXml(fillEpWorkTable(workTableTemplate, work));
      return index === 0 ? filled : `<w:p><w:r/></w:p>${filled}`;
    })
    .join("");
  tables[4] = workTablesXml;

  let currentXml = xml;
  tables.forEach((table, index) => {
    currentXml = replaceDirectBlockAt(currentXml, "w:tbl", index, table);
  });
  zip.file("word/document.xml", sanitizeFinalDocumentXml(currentXml));
  return (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
}

export async function buildNonKeyPersonnelTemplateDocx(data: CvData) {
  const bytes = await loadTemplate("components/docx/templates/custom/non-key-personnel-template.docx");
  const zip = await JSZip.loadAsync(bytes);
  let xml = await zip.file("word/document.xml")!.async("string");

  const sections = await buildNonKeySections(data);
  const topTables = getTopLevelTables(xml);
  if (topTables.length < 1) {
    throw new Error(`Non-key Personnel template structure mismatch: expected 1 outer table, found ${topTables.length}.`);
  }

  let main = topTables[0].text;
  sections.forEach((section, index) => {
    const baseRow = index * 5;
    main = setCellLinesInTable(main, baseRow + 1, 1, [section.profileDescription]);
    main = setCellLinesInTable(main, baseRow + 3, 1, [section.relevantExperience]);
    main = setCellLinesInTable(main, baseRow + 4, 1, [section.requirementLink]);
  });

  let nextMain = main;
  for (let i = 0; i < 7; i++) {
    const certRows = sections[i]?.relevantCertifications?.slice(0, 3).map((cert) => [
      S(cert.issuer),
      S(cert.name),
      S(cert.validityDate),
    ]) || [["", "", ""]];
    nextMain = setNestedTableRowsInTable(nextMain, i * 5 + 2, certRows, 1);
  }

  const currentXml = replaceDirectBlockAt(xml, "w:tbl", 0, nextMain);
  zip.file("word/document.xml", currentXml);
  return (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
}
