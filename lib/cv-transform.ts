// lib/cv-transform.ts
import type { CVJson } from "./cvSchema";

type Opts = { locale?: string; maskPersonal?: boolean };

function mask(cv: CVJson): CVJson {
  const out: CVJson = JSON.parse(JSON.stringify(cv));
  if (out.candidate) {
    out.candidate.name = "Candidate";
    if (out.candidate.contacts) {
      out.candidate.contacts.email = "";
      out.candidate.contacts.phone = "";
      out.candidate.contacts.linkedin = "";
      (out.candidate as any).contacts.website = "";
    }
  }
  const scrub = (s?: string) =>
    (s || "")
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "●●●@masked")
      .replace(/\+?\d[\d ()-]{7,}\d/g, "●●●-masked")
      .replace(/https?:\/\/\S+/g, "masked.link");

  if (out.candidate.summary) out.candidate.summary = scrub(out.candidate.summary);
  for (const e of out.experience || []) {
    e.location = scrub(e.location);
    if (Array.isArray(e.bullets)) {
      for (const b of e.bullets as any[]) {
        if (typeof b === "string") continue;
        b.text = scrub(b.text);
      }
    }
  }
  for (const ed of out.education || []) ed.location = scrub(ed.location);
  return out;
}

async function translateAll(cv: CVJson, to: string): Promise<CVJson> {
  const endpoint = (process.env.AZURE_TRANSLATOR_ENDPOINT || "").replace(/\/+$/, "");
  const key = process.env.AZURE_TRANSLATOR_KEY || "";
  const region = process.env.AZURE_TRANSLATOR_REGION || "";

  const clone: CVJson = JSON.parse(JSON.stringify(cv));
  const items: { set: (t: string) => void; text: string }[] = [];

  const push = (getter: () => string | undefined, setter: (t: string) => void) => {
    const t = getter() || "";
    if (t.trim()) items.push({ set: setter, text: t });
  };

  push(() => clone.candidate.title, (t) => (clone.candidate.title = t));
  push(() => clone.candidate.summary, (t) => (clone.candidate.summary = t));
  (clone.candidate.skills || []).forEach((s, i) => push(() => s, (t) => (clone.candidate.skills![i] = t)));
  (clone.experience || []).forEach((e, i) =>
    (e.bullets || []).forEach((b: any, j: number) => {
      const get = () => (typeof b === "string" ? b : b.text);
      const set = (t: string) => {
        if (typeof b === "string") (clone.experience![i].bullets![j] as any) = t;
        else (clone.experience![i].bullets![j] as any).text = t;
      };
      push(get, set);
    })
  );
  (clone.education || []).forEach((ed, i) => push(() => ed.degree, (t) => (clone.education![i].degree = t)));

  if (!to || to === "en" || items.length === 0) return clone;

  // Dev marker if no Translator keys
  if (!endpoint || !key) {
    const tag = `⟪${to}⟫ `;
    if (clone.candidate.title) clone.candidate.title = tag + clone.candidate.title;
    if (clone.candidate.summary) clone.candidate.summary = tag + clone.candidate.summary;
    clone.candidate.skills = (clone.candidate.skills || []).map((s) => tag + s);
    (clone.experience || []).forEach((e) =>
      (e.bullets || []).forEach((b: any, j: number) => {
        const text = typeof b === "string" ? b : b.text;
        const v = text ? tag + text : text;
        if (typeof b === "string") (e.bullets![j] as any) = v;
        else (e.bullets![j] as any).text = v;
      })
    );
    (clone.education || []).forEach((ed, i) => {
      if (ed.degree) clone.education![i].degree = tag + ed.degree;
    });
    return clone;
  }

  // Real call
  try {
    const url = `${endpoint}/translate?api-version=3.0&to=${encodeURIComponent(to)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": key,
        ...(region ? { "Ocp-Apim-Subscription-Region": region } : {}),
      },
      body: JSON.stringify(items.map((x) => ({ Text: x.text }))),
    });
    if (!res.ok) throw new Error(`Translator ${res.status}: ${await res.text()}`);
    const data = await res.json();

    let k = 0;
    for (const it of items) {
      const t = data[k++]?.[0]?.translations?.[0]?.text;
      if (t) it.set(t);
    }
  } catch {
    // swallow, keep originals
  }
  return clone;
}

export async function applyTransforms(cv: CVJson, opts: Opts): Promise<CVJson> {
  let out = cv;
  if (opts.maskPersonal) out = mask(out);
  if (opts.locale && opts.locale !== "en") out = await translateAll(out, opts.locale);
  return out;
}
