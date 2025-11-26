import type { CVJson } from './cvSchema';
import { SupportedLocales, type Locale } from './locales';

async function translateText(text: string, to: Locale, from?: Locale): Promise<string> {
  const key = process.env.AZURE_TRANSLATOR_KEY!;
  const endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT!;
  const region = process.env.AZURE_TRANSLATOR_REGION!;
  const params = new URLSearchParams({ 'api-version': '3.0', to });
  if (from && SupportedLocales.includes(from)) params.set('from', from);
  const res = await fetch(`${endpoint}/translate?${params.toString()}`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Ocp-Apim-Subscription-Region': region,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([{ Text: text }])
  });
  const data = await res.json();
  return data?.[0]?.translations?.[0]?.text ?? text;
}

export async function translateCV(cv: CVJson, to: Locale, from?: Locale): Promise<CVJson> {
  async function t(s?: string){ return s? await translateText(s, to, from): s; }
  const out: CVJson = JSON.parse(JSON.stringify(cv));
  out.identity.full_name = await t(cv.identity.full_name) as string;
  if (out.headline) out.headline = await t(out.headline);
  if (out.summary) out.summary = await t(out.summary);
  if (out.skills) out.skills = await Promise.all(out.skills.map(async s=>({ ...s, name: await t(s.name) as string })));
  if (out.experience) out.experience = await Promise.all(out.experience.map(async e=>({
    ...e,
    title: await t(e.title) as string,
    company: await t(e.company) as string,
    location: await t(e.location),
    bullets: e.bullets ? await Promise.all(e.bullets.map(async b=>({ ...b, text: await t(b.text) as string }))) : []
  })));

  if (out.projects) out.projects = await Promise.all(out.projects.map(async p=>({ ...p,
    name: await t(p.name) as string, role: await t(p.role),
    bullets: p.bullets? await Promise.all(p.bullets.map(async b=>({ ...b, text: await t(b.text) as string }))):[]
  })));

  if (out.education) out.education = await Promise.all(out.education.map(async ed=>({ ...ed,
    school: await t(ed.school) as string, degree: await t(ed.degree)
  })));

  if (out.certifications) out.certifications = await Promise.all(out.certifications.map(async c=>({ ...c,
    name: await t(c.name) as string, issuer: await t(c.issuer)
  })));

  out.meta = { ...(out.meta||{}), locale: to };
  return out;
}
