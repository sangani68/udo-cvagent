// lib/preview-pipeline.ts
import type { CVJson } from "./cvSchema";
import { migrateCvShape } from "./cvSchema";
import { toPreviewModel, type CvData } from "./cv-view";
import type { MaskPolicy } from "./mask";

/* ─────────────────────────────
   Mask PII (keep your policy)
   ───────────────────────────── */
const EMPTY_POLICY: MaskPolicy = { email: false, phone: false, location: false };

export function maskCv(cv: CVJson, policy: MaskPolicy = EMPTY_POLICY): CVJson {
  const out: any = JSON.parse(JSON.stringify(cv || {}));
  const c = out.candidate || (out.candidate = {});

  if (policy.email) c.email = "";
  if (policy.phone) c.phone = "";
  if (policy.location) c.location = "";
  if (c.contacts) {
    if (policy.email) c.contacts.email = "";
    if (policy.phone) c.contacts.phone = "";
    if (policy.location) c.contacts.location = "";
  }
  if (policy.location) {
    if (typeof c.address === "string") c.address = "";
    if (c.address && typeof c.address === "object") {
      c.address.line1 = "";
      c.address.line2 = "";
      c.address.city = "";
      c.address.region = "";
      c.address.postalCode = "";
      c.address.country = "";
    }
    c.city = "";
    c.country = "";
  }
  return out;
}

/* ─────────────────────────────
   Deep translate on CvData
   (works after normalization)
   ───────────────────────────── */
type Lang = "en" | "fr" | "de" | "nl" | string;

export async function localizeCvData(data: CvData, to: Lang): Promise<CvData> {
  const lang = (to || "en").toLowerCase();
  if (lang === "en") return data;

  const endpoint = (process.env.AZURE_TRANSLATOR_ENDPOINT || "").replace(/\/+$/, "");
  const key = (process.env.AZURE_TRANSLATOR_KEY || "").trim();
  const region = (process.env.AZURE_TRANSLATOR_REGION || "").trim() || undefined;

  if (!endpoint || !key) return data;

  // use `any` internally to avoid complaining about partial candidate shapes
  const out: any = JSON.parse(JSON.stringify(data || {}));
  const c: any = out.candidate || (out.candidate = {});

  const bag: string[] = [];
  type Setter = (txt: string) => void;
  const setters: Setter[] = [];
  const pushStr = (val?: string, set?: Setter) => {
    const s = (val ?? "").toString().trim();
    if (!s) return;
    bag.push(s);
    if (set) setters.push(set);
  };

  // header fields
  pushStr((c as any).title, (t) => ((c as any).title = t));
  pushStr((c as any).summary, (t) => ((c as any).summary = t));
  pushStr((c as any).location, (t) => ((c as any).location = t));

  // skills (array of strings)
  if (Array.isArray((c as any).skills)) {
    (c as any).skills.forEach((v: any, i: number) => {
      const s = typeof v === "string" ? v : (v?.name ?? v?.text ?? "");
      pushStr(String(s || ""), (t) => ((c as any).skills[i] = t));
    });
  }

  // experiences
  const exps: any[] = Array.isArray((c as any).experiences) ? (c as any).experiences : [];
  exps.forEach((e: any, i: number) => {
    pushStr(e.title, (t) => (e.title = t));
    pushStr(e.role, (t) => (e.role = t));
    pushStr(e.company, (t) => (e.company = t));
    pushStr(e.employer, (t) => (e.employer = t));
    pushStr(e.location, (t) => (e.location = t));
    pushStr(e.summary, (t) => (e.summary = t));
    pushStr(e.description, (t) => (e.description = t));

    const bullets = Array.isArray(e.bullets) ? e.bullets : [];
    bullets.forEach((b: any, j: number) => {
      if (typeof b === "string") {
        pushStr(b, (t) => (e.bullets[j] = t));
      } else if (b && typeof b === "object") {
        pushStr(String(b.text ?? b.summary ?? b.value ?? b.detail ?? ""), (t) => {
          if (!e.bullets[j]) e.bullets[j] = { text: "" };
          e.bullets[j].text = t;
        });
      }
    });
  });

  // education
  const edus: any[] = Array.isArray((c as any).education) ? (c as any).education : [];
  edus.forEach((ed: any) => {
    pushStr(ed.degree, (t) => (ed.degree = t));
    pushStr(ed.school, (t) => (ed.school = t));
    pushStr(ed.location, (t) => (ed.location = t));
  });

  // languages (level text only)
  const langs: any[] = Array.isArray((c as any).languages) ? (c as any).languages : [];
  langs.forEach((l) => {
    const val = String(l.levelText ?? l.level ?? "");
    pushStr(val, (t) => {
      l.levelText = t;
      l.level = t;
    });
  });

  if (bag.length === 0) return out as CvData;

  const translated = await translateMany(bag, lang, { endpoint, key, region });

  let k = 0;
  for (const set of setters) {
    set(translated[k] ?? bag[k] ?? "");
    k++;
  }

  return out as CvData;
}

// Legacy helper kept for compatibility (now translates on normalized CvData)
export async function localizeCvText(cv: CVJson, to: Lang): Promise<CVJson> {
  const normalized = toPreviewModel(migrateCvShape(cv));
  const translated = await localizeCvData(normalized, to);
  // fold back into CVJson minimally: just update candidate text fields
  const merged: any = JSON.parse(JSON.stringify(cv || {}));
  merged.candidate = {
    ...(merged.candidate || {}),
    title: translated.candidate.title,
    summary: translated.candidate.summary,
    location: translated.candidate.location,
    skills: (translated as any).candidate?.skills,
    experiences: (translated as any).candidate?.experiences,
    education: (translated as any).candidate?.education,
    languages: (translated as any).candidate?.languages,
  };
  return merged;
}

/* ─────────────────────────────
   Safe-name helper (prevents crashes)
   ───────────────────────────── */
function safeName(src: { candidate?: any } | undefined, fallbackCv?: any): string {
  const c = src?.candidate ?? {};
  const fromData =
    c.name || c.fullName || [c.firstName, c.lastName].filter(Boolean).join(" ").trim();

  const fromCv =
    fallbackCv?.candidate?.name ||
    fallbackCv?.candidate?.fullName ||
    [fallbackCv?.candidate?.firstName, fallbackCv?.candidate?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    fallbackCv?.name;

  const name = (fromData || fromCv || "").toString().trim();
  // return a single space if truly empty so templates that render a <Text> won’t explode
  return name || " ";
}

/* ─────────────────────────────
   Shared builder used by preview/export
   (mask → normalize → translate → guard)
   ───────────────────────────── */
export async function buildViewData(opts: {
  data?: any;
  cv?: any;
  template?: string;
  templateId?: string;
  locale?: string;
  maskPersonal?: boolean;
  maskPolicy?: MaskPolicy;
}): Promise<{
  data: CvData;
  cv: CVJson;
  template: string;
  locale: string;
  mask: boolean;
  maskPolicy: MaskPolicy;
}> {
  const template = (opts.templateId || opts.template || "pdf-kyndryl") as string;
  const locale = (opts.locale || "en").toLowerCase();
  const maskPolicy =
    opts.maskPolicy ??
    (opts.maskPersonal
      ? { email: true, phone: true, location: true }
      : { email: false, phone: false, location: false });
  const mask = !!(maskPolicy.email || maskPolicy.phone || maskPolicy.location);

  // 1) canonicalize
  let cv = migrateCvShape((opts.data ?? opts.cv ?? opts) as any);

  // 2) mask first (your requirement)
  if (mask) cv = maskCv(cv, maskPolicy);

  // 3) normalize to tolerant view model
  const base = toPreviewModel(cv);

  // 4) deep translate on the normalized view model
  const translated = await localizeCvData(base, locale);

  // 5) final guards so templates never crash on candidate / name / arrays
  const data: CvData = {
    ...(translated as any),
    candidate: {
      ...(translated?.candidate ?? {}),
      name: safeName(translated, cv),
    },
    // keep these top-level arrays tolerant; templates mostly use candidate.*
    experience: Array.isArray((translated as any).experience)
      ? (translated as any).experience
      : [],
    education: Array.isArray((translated as any).education)
      ? (translated as any).education
      : [],
    skills: Array.isArray((translated as any).skills) ? (translated as any).skills : [],
    languages: Array.isArray((translated as any).languages)
      ? (translated as any).languages
      : [],
  } as any;

  return { data, cv, template, locale, mask, maskPolicy };
}

/* ─────────────────────────────
   Azure Translator batcher
   ───────────────────────────── */
async function translateMany(
  texts: string[],
  to: string,
  cfg: { endpoint: string; key: string; region?: string }
): Promise<string[]> {
  const MAX_ITEMS = 90;
  const MAX_CHARS = 45000;

  const out: string[] = [];
  let i = 0;

  while (i < texts.length) {
    let size = 0;
    const chunk: string[] = [];
    for (; i < texts.length && chunk.length < MAX_ITEMS; i++) {
      const t = texts[i] || "";
      const len = t.length + 20;
      if (chunk.length > 0 && size + len > MAX_CHARS) break;
      chunk.push(t);
      size += len;
    }

    const body = chunk.map((Text) => ({ Text }));
    const url = `${cfg.endpoint}/translate?api-version=3.0&to=${encodeURIComponent(to)}`;
    const headers: any = {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": cfg.key,
    };
    if (cfg.region) headers["Ocp-Apim-Subscription-Region"] = cfg.region;

    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) {
      out.push(...chunk);
      continue;
    }

    const data = await res.json();
    const chunkOut = (Array.isArray(data) ? data : []).map((item: any, idx: number) =>
      item?.translations?.[0]?.text ?? chunk[idx] ?? ""
    );
    out.push(...chunkOut);
  }
  return out;
}
