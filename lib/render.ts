// lib/render.ts

// Use require so we don't need TypeScript type declarations for nunjucks
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nunjucks: any = require("nunjucks");

import path from "path";
import fs from "fs";
import { normalizeDate, type Locale } from "./locales";
import { labels } from "./i18nLabels";
import type { CVJson } from "./cvSchema";

export function toViewModel(cv: CVJson) {
  const locale = (cv.meta?.locale || "en") as Locale;
  const vm: any = JSON.parse(JSON.stringify(cv));
  vm.locale = locale;
  vm.i18n = labels[locale];

  vm.experience?.forEach((e: any) => {
    e.start_fmt = normalizeDate(e.start, locale);
    e.end_fmt = normalizeDate(e.end || "present", locale) || "—";
  });

  vm.education?.forEach((ed: any) => {
    ed.start_fmt = normalizeDate(ed.start, locale);
    ed.end_fmt = normalizeDate(ed.end, locale);
  });

  return vm;
}

export function renderHTML(templateName: string, vm: any) {
  const templatesDir = path.join(process.cwd(), "templates", "html");
  const cssPath = path.join(
    process.cwd(),
    "templates",
    "partials",
    "styles.css"
  );
  const styles = fs.existsSync(cssPath)
    ? fs.readFileSync(cssPath, "utf8")
    : "";

  const env = nunjucks.configure(templatesDir, {
    autoescape: true,
    noCache: true,
  });

  // Pass styles into the template so we can inline it
  return env.render(`${templateName}.html`, { ...vm, styles });
}
