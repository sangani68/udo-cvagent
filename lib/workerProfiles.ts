import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import type { CVJson } from "@/lib/cvSchema";
import { upsertCvDoc } from "@/lib/search/upsert";
import type { KyndrylSMSlide } from "@/lib/kyndryl-sm";

type WorkerRow = Record<string, string>;

type WorkerProfile = {
  id: string;
  name: string;
  cv: CVJson;
  sourcePath: string;
};

type ExperienceItem = NonNullable<CVJson["experience"]>[number];

const NAME_PARTICLES = new Set(["de", "den", "der", "van", "von", "da", "dos", "del", "la", "le"]);

function colRef(ref = "") {
  return ref.replace(/\d+/g, "");
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeIdPart(value: string) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function toDisplayName(raw: string) {
  const input = cleanText(raw);
  if (!input) return "Candidate";
  if (/[a-z]/.test(input)) return input;
  return input
    .split(/\s+/)
    .map((part, index) => {
      const lower = part.toLowerCase();
      if (index > 0 && NAME_PARTICLES.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function excelDateToIso(raw: string) {
  const text = cleanText(raw);
  if (!text) return "";
  if (/^\d{4}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const num = Number(text);
  if (!Number.isFinite(num)) return text;
  const ms = Math.round((num - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return text;
  return d.toISOString().slice(0, 10);
}

function dedupeStrings(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSearchableSummary(cv: CVJson) {
  const c = cv.candidate;
  const lines: string[] = [];
  lines.push(`Name: ${c.name}`);
  if (c.title) lines.push(`Business Title: ${c.title}`);
  if (c.location) lines.push(`Country: ${c.location}`);
  if (c.summary) lines.push(`Summary: ${c.summary}`);
  if (c.skills?.length) lines.push(`Skills: ${c.skills.join(", ")}`);
  if (cv.experience?.length) {
    lines.push("Experience:");
    for (const item of cv.experience) {
      const head = [item.role, item.employer].filter(Boolean).join(", ");
      const dates = [item.start, item.end].filter(Boolean).join(" to ");
      lines.push(`- ${head}${dates ? ` (${dates})` : ""}`);
      for (const bullet of item.bullets || []) {
        if (bullet?.text) lines.push(`  • ${bullet.text}`);
      }
    }
  }
  if (cv.education?.length) {
    lines.push("Education:");
    for (const item of cv.education) {
      const head = [item.degree, item.school].filter(Boolean).join(", ");
      if (head) lines.push(`- ${head}`);
      if (item.fieldOfStudy) lines.push(`  • Field of Study: ${item.fieldOfStudy}`);
    }
  }
  if (cv.certificates?.length) {
    lines.push("Certifications:");
    for (const item of cv.certificates) {
      const label = [item.name, item.issuer].filter(Boolean).join(", ");
      if (label) lines.push(`- ${label}`);
    }
  }
  if (c.languages?.length) {
    lines.push(
      `Languages: ${c.languages.map((l) => [l.name, l.level].filter(Boolean).join(" - ")).join(", ")}`
    );
  }
  return lines.join("\n");
}

function decodeXml(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseRowsFromSheetXml(xml: string): WorkerRow[] {
  const rowMatches = Array.from(xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g));
  if (rowMatches.length < 3) return [];

  const parseCells = (rowXml: string) =>
    Array.from(rowXml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)).map((match) => {
      const attrs = match[1] || "";
      const body = match[2] || "";
      const ref = /r="([^"]+)"/.exec(attrs)?.[1] || "";
      const value =
        /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/.exec(body)?.[1] ||
        /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ||
        "";
      return { ref, value: cleanText(decodeXml(value)) };
    });

  const headerMap = new Map<string, string>();
  for (const cell of parseCells(rowMatches[1][1])) {
    headerMap.set(colRef(cell.ref), cell.value);
  }

  const rows: WorkerRow[] = [];
  for (const rowMatch of rowMatches.slice(2)) {
    const record: WorkerRow = {};
    for (const cell of parseCells(rowMatch[1])) {
      const header = headerMap.get(colRef(cell.ref));
      if (header) record[header] = cell.value;
    }
    if (cleanText(record["Worker"] || record["Legal Name"])) rows.push(record);
  }

  return rows;
}

function buildCvFromRows(name: string, rows: WorkerRow[]): CVJson {
  const first = rows[0] || {};
  const displayName = toDisplayName(first["Legal Name"] || first["Worker"] || name);

  const summary = dedupeStrings(
    rows.flatMap((row) => [row["Talent Statement Text"], row["Talent Statement Detail"]].map(cleanText))
  ).join("\n\n");

  const skills = dedupeStrings(
    rows.flatMap((row) =>
      Array.from({ length: 20 }, (_, i) => cleanText(row[`Skill ${i + 1}`]))
    )
  );

  const certifications = dedupeStrings(
    rows.flatMap((row) =>
      Array.from({ length: 20 }, (_, i) => cleanText(row[`Certification ${i + 1}`]))
    )
  ).map((name) => ({ name }));

  const awards = dedupeStrings(
    rows.flatMap((row) =>
      [0, 1, 2].flatMap((i) => {
        const suffix = i === 0 ? "" : ` ${i}`;
        const text = cleanText(row[`Achievements${suffix}`] || row[`Achievements ${i}`]);
        const type = cleanText(row[`Achievements${suffix} Type`] || row[`Achievements ${i} Type`]);
        const label = [text, type].filter(Boolean).join(" - ");
        return label ? [label] : [];
      })
    )
  ).map((name) => ({ name }));

  const experienceMap = new Map<string, ExperienceItem>();

  for (const row of rows) {
    const profileRole = cleanText(row["Job Profile"]);
    if (profileRole) {
      const start = excelDateToIso(row["Job Profile Start Date"]);
      const end = excelDateToIso(row["Job Profile End Date"]);
      const key = `${profileRole}|${start}|${end}`;
      if (!experienceMap.has(key)) {
        experienceMap.set(key, {
          employer: "Kyndryl",
          role: profileRole,
          start,
          end,
          location: cleanText(row["Country"]),
          bullets: [],
        });
      }
    }

    for (let i = 1; i <= 5; i++) {
      const role = cleanText(row[`Job History ${i} Job Title`]);
      const employer = cleanText(row[`Job History ${i} Company`]);
      const start = excelDateToIso(row[`Job History ${i} Start Date`]);
      const end = excelDateToIso(row[`Job History ${i} End Date`]);
      if (!role && !employer) continue;
      const key = `${role}|${employer}|${start}|${end}`;
      if (!experienceMap.has(key)) {
        experienceMap.set(key, {
          employer,
          role,
          start,
          end,
          location: cleanText(row["Country"]),
          bullets: [],
        });
      }
    }
  }

  const languageName = cleanText(first["Language"]);
  const languageLevel = cleanText(first["Ability"]);

  const education =
    cleanText(first["Education"]) || cleanText(first["Degree"]) || cleanText(first["Field of Study"])
      ? [
          {
            degree: cleanText(first["Degree"]) || cleanText(first["Education"]),
            school: cleanText(first["Education"]),
            fieldOfStudy: cleanText(first["Field of Study"]),
            location: cleanText(first["Country"]),
          },
        ]
      : undefined;

  const cv: CVJson = {
    meta: { locale: "en", source: "worker-profile-xlsx" },
    candidate: {
      name: displayName,
      title: cleanText(first["Business Title"]),
      summary: summary || undefined,
      location: cleanText(first["Country"]) || undefined,
      skills: skills.length ? skills : undefined,
      languages: languageName ? [{ name: languageName, level: languageLevel || undefined }] : undefined,
    },
    experience: Array.from(experienceMap.values()).length ? Array.from(experienceMap.values()) : undefined,
    education,
    certificates: certifications.length ? certifications : undefined,
    awards: awards.length ? awards : undefined,
  };

  return cv;
}

export async function parseWorkerProfilesXlsx(filePath: string): Promise<WorkerProfile[]> {
  const zip = await JSZip.loadAsync(await readFile(filePath));
  const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
  const worksheetXml = await zip.file("xl/worksheets/sheet1.xml")?.async("string");
  if (!workbookXml || !worksheetXml) {
    throw new Error("Invalid XLSX file: workbook or sheet XML missing.");
  }

  const rows = parseRowsFromSheetXml(worksheetXml);
  if (rows.length < 1) {
    throw new Error("XLSX does not contain enough rows to import worker profiles.");
  }

  const grouped = new Map<string, WorkerRow[]>();
  for (const record of rows) {
    const worker = cleanText(record["Worker"] || record["Legal Name"]);
    if (!worker) continue;
    if (!grouped.has(worker)) grouped.set(worker, []);
    grouped.get(worker)!.push(record);
  }

  return Array.from(grouped.entries()).map(([worker, workerRows]) => {
    const cv = buildCvFromRows(worker, workerRows);
    return {
      id: `worker-profile-${safeIdPart(worker)}`,
      name: cv.candidate.name,
      cv,
      sourcePath: filePath,
    };
  });
}

export async function importWorkerProfilesToKnowledgeBase(filePath: string) {
  const workers = await parseWorkerProfilesXlsx(filePath);
  for (const worker of workers) {
    const cv = JSON.parse(JSON.stringify(worker.cv)) as CVJson & {
      candidate: CVJson["candidate"] & { headline?: string };
      experience?: Array<ExperienceItem & { company?: string; title?: string }>;
    };

    cv.candidate.headline = cv.candidate.title;
    cv.experience = (cv.experience || []).map((item) => ({
      ...item,
      company: item.employer,
      title: item.role,
    }));

    const content = buildSearchableSummary(worker.cv);
    await upsertCvDoc({
      id: worker.id,
      url: `${filePath}#${encodeURIComponent(worker.name)}`,
      data: {
        ...cv,
        candidate: { ...cv.candidate, summary: content },
      },
      language: "en",
    });
  }

  return {
    count: workers.length,
    names: workers.map((worker) => worker.name),
  };
}

export function anonymizeKyndrylSMView(view: KyndrylSMSlide): KyndrylSMSlide {
  return {
    ...view,
    name: "Anonymous Profile",
    photoDataUrl: undefined,
  };
}
