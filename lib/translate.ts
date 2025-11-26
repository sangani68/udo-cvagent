import type { CVJson } from "./cvSchema";
import { SupportedLocales, type Locale } from "./locales";

async function translateText(
  text: string,
  to: Locale,
  from?: Locale
): Promise<string> {
  const key = process.env.AZURE_TRANSLATOR_KEY!;
  const endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT!;
  const region = process.env.AZURE_TRANSLATOR_REGION!;
  const params = new URLSearchParams({ "api-version": "3.0", to });
  if (from && SupportedLocales.includes(from)) params.set("from", from);

  const res = await fetch(`${endpoint}/translate?${params.toString()}`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Ocp-Apim-Subscription-Region": region,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{ Text: text }]),
  });

  const data = await res.json().catch(() => null);
  return data?.[0]?.translations?.[0]?.text ?? text;
}

export async function translateCV(
  cv: CVJson,
  to: Locale,
  from?: Locale
): Promise<CVJson> {
  async function t(s?: string) {
    return s ? ((await translateText(s, to, from)) as string) : s;
  }

  // Work on a deep clone, but treat as `any` to support both legacy and new shapes
  const out: any = JSON.parse(JSON.stringify(cv || {}));

  // ── Legacy shape: identity / headline / summary / skills / experience / projects / education / certifications ──
  if (out.identity?.full_name) {
    out.identity.full_name = await t(out.identity.full_name);
  }

  if (out.headline) out.headline = await t(out.headline);
  if (out.summary) out.summary = await t(out.summary);

  if (Array.isArray(out.skills)) {
    out.skills = await Promise.all(
      out.skills.map(async (s: any) => ({
        ...s,
        name: await t(s?.name),
      }))
    );
  }

  if (Array.isArray(out.experience)) {
    out.experience = await Promise.all(
      out.experience.map(async (e: any) => ({
        ...e,
        title: await t(e?.title),
        company: await t(e?.company),
        location: await t(e?.location),
        bullets: Array.isArray(e?.bullets)
          ? await Promise.all(
              e.bullets.map(async (b: any) => ({
                ...b,
                text: await t(b?.text),
              }))
            )
          : [],
      }))
    );
  }

  if (Array.isArray(out.projects)) {
    out.projects = await Promise.all(
      out.projects.map(async (p: any) => ({
        ...p,
        name: await t(p?.name),
        role: await t(p?.role),
        bullets: Array.isArray(p?.bullets)
          ? await Promise.all(
              p.bullets.map(async (b: any) => ({
                ...b,
                text: await t(b?.text),
              }))
            )
          : [],
      }))
    );
  }

  if (Array.isArray(out.education)) {
    out.education = await Promise.all(
      out.education.map(async (ed: any) => ({
        ...ed,
        school: await t(ed?.school),
        degree: await t(ed?.degree),
      }))
    );
  }

  if (Array.isArray(out.certifications)) {
    out.certifications = await Promise.all(
      out.certifications.map(async (c: any) => ({
        ...c,
        name: await t(c?.name),
        issuer: await t(c?.issuer),
      }))
    );
  }

  // ── Newer shape: candidate.* (optional, best-effort translate) ──
  if (out.candidate) {
    const c = out.candidate;

    if (c.name) c.name = await t(c.name);
    if (c.fullName) c.fullName = await t(c.fullName);
    if (c.title) c.title = await t(c.title);
    if (c.summary) c.summary = await t(c.summary);
    if (c.location) c.location = await t(c.location);

    if (Array.isArray(c.skills)) {
      c.skills = await Promise.all(
        c.skills.map(async (s: any) =>
          typeof s === "string"
            ? await t(s)
            : { ...s, name: await t(s?.name) }
        )
      );
    }

    if (Array.isArray(c.experiences)) {
      c.experiences = await Promise.all(
        c.experiences.map(async (e: any) => ({
          ...e,
          title: await t(e?.title),
          role: await t(e?.role),
          company: await t(e?.company),
          employer: await t(e?.employer),
          location: await t(e?.location),
          bullets: Array.isArray(e?.bullets)
            ? await Promise.all(
                e.bullets.map(async (b: any) =>
                  typeof b === "string"
                    ? await t(b)
                    : { ...b, text: await t(b?.text) }
                )
              )
            : [],
        }))
      );
    }

    if (Array.isArray(c.education)) {
      c.education = await Promise.all(
        c.education.map(async (ed: any) => ({
          ...ed,
          school: await t(ed?.school),
          degree: await t(ed?.degree),
          location: await t(ed?.location),
        }))
      );
    }

    if (Array.isArray(c.languages)) {
      c.languages = await Promise.all(
        c.languages.map(async (l: any) => ({
          ...l,
          name: await t(l?.name ?? l?.language),
          level: await t(l?.level ?? l?.levelText),
          levelText: await t(l?.levelText ?? l?.level),
        }))
      );
    }
  }

  out.meta = { ...(out.meta || {}), locale: to };
  return out as CVJson;
}
