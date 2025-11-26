// lib/htmlPreview.ts
import type { CvData } from "./cv-view";
import { toEpFormData } from "@/lib/ep-docx";

const COLORS: Record<string, { accent: string }> = {
  "pdf-kyndryl": { accent: "#FF462D" },
  "pdf-europass": { accent: "#0A66CC" },
  "docx-ep": { accent: "#0054A6" },
  "pptx-kyndryl-sm": { accent: "#FF462D" },
};

const esc = (s: any) =>
  String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function hIf(test: any, html: string) {
  return test ? html : "";
}

/* ─────────────────────────────────────────────────────────────
   EP DOCX (Form 6) HTML preview
   ───────────────────────────────────────────────────────────── */
function epDocxHtml(raw: CvData, accent: string) {
  // toEpFormData already guards inside, but keep it extra safe
  const data = raw || ({} as CvData);
  const d = toEpFormData(data);

  const css = `
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#111; margin:0; padding:24px; }
    h1 { font-size: 22px; font-weight: 800; margin: 0 0 10px 0; border-bottom: 4px solid ${accent}; padding-bottom: 6px; }
    h2 { font-size: 15px; text-transform: uppercase; letter-spacing:.06em; color:${accent}; margin: 18px 0 8px; }
    section { margin-top: 12px; }
    table { width:100%; border-collapse: collapse; }
    th, td { border:1px solid #e5e7eb; padding:6px 8px; font-size: 13px; vertical-align: top; }
    th { background:#f8fafc; text-align:left; }
    .muted { color:#666; }
    .card { border:1px solid #e5e7eb; border-radius:8px; padding:10px 12px; margin:10px 0; }
    .small { font-size:12px; }
    .nowrap { white-space:nowrap; }
  `;

  const identity = `
    <section>
      <h2>Identity</h2>
      <p><strong>SURNAME:</strong> ${esc(d.surname)}</p>
      <p><strong>Name:</strong> ${esc(d.name)}</p>
      ${hIf(d.date_of_birth, `<p><strong>Date of birth:</strong> ${esc(d.date_of_birth)}</p>`)}
      ${hIf(d.gender, `<p><strong>Gender:</strong> ${esc(d.gender)}</p>`)}
      ${hIf(d.nationality, `<p><strong>Nationality:</strong> ${esc(d.nationality)}</p>`)}
      ${hIf(d.employer, `<p><strong>Employer:</strong> ${esc(d.employer)}</p>`)}
      ${hIf(d.date_of_recruitment, `<p><strong>Date of recruitment:</strong> ${esc(d.date_of_recruitment)}</p>`)}
      ${hIf(d.current_function, `<p><strong>Current function:</strong> ${esc(d.current_function)}</p>`)}
      ${hIf(d.profile_level, `<p><strong>Profile level:</strong> ${esc(d.profile_level)}</p>`)}
      ${hIf(d.sc_reference, `<p><strong>SC reference:</strong> ${esc(d.sc_reference)}</p>`)}
    </section>`;

  const education = `
    <section>
      <h2>Highest educational qualification</h2>
      ${hIf(d.highest_qualification, `<p><strong>Level:</strong> ${esc(d.highest_qualification)}</p>`)}
      ${hIf(d.degree_name, `<p><strong>Certificate/Diploma:</strong> ${esc(d.degree_name)}</p>`)}
      ${hIf(d.institute, `<p><strong>Institute:</strong> ${esc(d.institute)}</p>`)}
      ${hIf(d.degree_date, `<p><strong>Date:</strong> ${esc(d.degree_date)}</p>`)}
    </section>`;

  const specialised = hIf(
    d.specialised_expertise,
    `<section><h2>Specialised expertise</h2><p>${esc(d.specialised_expertise)}</p></section>`
  );

  const languages = (d.languages?.length
    ? `<section>
        <h2>Languages</h2>
        <table>
          <thead>
            <tr>
              <th>Language</th>
              <th class="nowrap">Speaking</th>
              <th class="nowrap">Listening</th>
              <th class="nowrap">Writing</th>
              <th class="nowrap">Reading</th>
            </tr>
          </thead>
          <tbody>
            ${d.languages.map((l: any) => `
              <tr>
                <td>${esc(l.language)}</td>
                <td class="small">${esc(l.speaking)}</td>
                <td class="small">${esc(l.listening)}</td>
                <td class="small">${esc(l.writing)}</td>
                <td class="small">${esc(l.reading)}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </section>`
    : "");

  const trainings = (d.trainings?.length
    ? `<section>
        <h2>Trainings</h2>
        <table>
          <thead>
            <tr><th>Training</th><th>Provider</th><th class="nowrap">Hours</th><th>Certificate</th><th class="nowrap">Date</th></tr>
          </thead>
          <tbody>
            ${d.trainings.map((t: any) => `
              <tr>
                <td>${esc(t.title)}</td>
                <td>${esc(t.provider)}</td>
                <td class="small">${esc(t.hours)}</td>
                <td>${esc(t.certificate)}</td>
                <td class="small">${esc(t.date)}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </section>`
    : "");

  const software = (d.software_expertise?.length
    ? `<section>
        <h2>Software expertise</h2>
        <table>
          <thead><tr><th>Tool</th><th class="nowrap">Years</th><th>Description</th></tr></thead>
          <tbody>
            ${d.software_expertise.map((t: any) => `
              <tr>
                <td>${esc(t.tool)}</td>
                <td class="small">${esc(t.years)}</td>
                <td>${esc(t.description)}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </section>`
    : "");

  const work = (d.work_experience_blocks?.length
    ? `<section>
        <h2>Work experience</h2>
        ${d.work_experience_blocks.map((w: any) => `
          <div class="card">
            ${hIf(w.project_name, `<p><strong>Project name:</strong> ${esc(w.project_name)}</p>`)}
            ${hIf(w.employer, `<p><strong>Employer:</strong> ${esc(w.employer)}</p>`)}
            ${hIf(w.dates, `<p><strong>Dates:</strong> ${esc(w.dates)}</p>`)}
            ${hIf(w.client, `<p><strong>Client:</strong> ${esc(w.client)}</p>`)}
            ${hIf(w.project_size, `<p><strong>Project size:</strong> ${esc(w.project_size)}</p>`)}
            ${hIf(w.man_days, `<p><strong>Man-days:</strong> ${esc(w.man_days)}</p>`)}
            ${hIf(w.project_description, `<p><strong>Project description:</strong> ${esc(w.project_description)}</p>`)}
            ${w.roles_responsibilities?.length
              ? `<p class="small" style="margin-top:6px"><strong>Employee’s roles & responsibilities:</strong></p>
                 <ul style="margin:6px 0 0 18px">${w.roles_responsibilities.map((r: string) => `<li>${esc(r)}</li>`).join("")}</ul>`
              : ""}
            ${w.technologies?.length ? `<p style="margin-top:6px"><strong>Technologies & methodologies:</strong> ${esc(w.technologies.join(", "))}</p>` : ""}
            ${hIf(w.last_update, `<p class="small muted" style="margin-top:6px">Date of last update: ${esc(w.last_update)}</p>`)}
          </div>`).join("")}
      </section>`
    : "");

  const footer = `<section class="small muted" style="margin-top:16px">
      <p>Preview of European Parliament – CV (Form 6)</p>
    </section>`;

  return `<!doctype html>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>${css}</style>
  <body>
    <h1>CV — Form 6</h1>
    ${identity}${education}${specialised}${languages}${trainings}${software}${work}${footer}
  </body>`;
}

/* ─────────────────────────────────────────────────────────────
   Default (PDF/PPTX) preview (hardened)
   ───────────────────────────────────────────────────────────── */
function defaultHtml(raw: CvData, accent: string) {
  const data = raw || ({} as CvData);
  const c: any = (data as any).candidate ?? {};
  const contacts: any = c.contacts ?? {};

  const header = `
    <header>
      <div class="name">${esc(c.name ?? "Candidate")}</div>
      ${hIf(c.title, `<div class="title">${esc(c.title)}</div>`)}
      ${hIf(c.location, `<div class="loc">${esc(c.location)}</div>`)}
      <div class="contacts">
        ${contacts.email ? `<span>${esc(contacts.email)}</span>` : ""}
        ${contacts.phone ? `<span>${esc(contacts.phone)}</span>` : ""}
        ${contacts.linkedin ? `<span>${esc(contacts.linkedin)}</span>` : ""}
        ${contacts.website ? `<span>${esc(contacts.website)}</span>` : ""}
      </div>
    </header>`;

  const summary = hIf(c.summary, `<section><h2>Summary</h2><p>${esc(c.summary)}</p></section>`);

  const skills =
    Array.isArray(c.skills) && c.skills.length
      ? `<section><h2>Skills</h2><ul class="tags">${c.skills
          .map((s: any) => `<li>${esc(s)}</li>`)
          .join("")}</ul></section>`
      : "";

  const experience =
    Array.isArray((data as any).experience) && (data as any).experience.length
      ? `<section><h2>Experience</h2>
          ${(data as any).experience
            .map((e: any) => {
              const dates = [e.start, e.end].filter(Boolean).join(" – ");
              return `<div class="role">
                <div class="line1">
                  ${e.role ? `<span class="role-title">${esc(e.role)}</span>` : ""}
                  ${e.employer ? `<span class="employer"> @ ${esc(e.employer)}</span>` : ""}
                </div>
                ${e.location ? `<div class="muted">${esc(e.location)}</div>` : ""}
                ${dates ? `<div class="muted">${esc(dates)}</div>` : ""}
                ${
                  Array.isArray(e.bullets) && e.bullets.length
                    ? `<ul class="bullets">${e.bullets
                        .map((b: any) => `<li>${esc(b)}</li>`)
                        .join("")}</ul>`
                    : ""
                }
              </div>`;
            })
            .join("")}
        </section>`
      : "";

  const education =
    Array.isArray((data as any).education) && (data as any).education.length
      ? `<section><h2>Education</h2>
          ${(data as any).education
            .map((ed: any) => {
              const dates = [ed.start, ed.end].filter(Boolean).join(" – ");
              return `<div class="edu">
                <div class="line1">
                  ${ed.degree ? `<span class="degree">${esc(ed.degree)}</span>` : ""}
                  ${ed.school ? `<span class="school"> — ${esc(ed.school)}</span>` : ""}
                </div>
                ${ed.location ? `<div class="muted">${esc(ed.location)}</div>` : ""}
                ${dates ? `<div class="muted">${esc(dates)}</div>` : ""}
              </div>`;
            })
            .join("")}
        </section>`
      : "";

  // Languages last
  const languages =
    Array.isArray(c.languages) && c.languages.length
      ? `<section><h2>Languages</h2>
          <ul class="langs">
            ${c.languages.map((l: any) => `<li>${esc(l?.name ?? "")}${l?.level ? ` — ${esc(l.level)}` : ""}</li>`).join("")}
          </ul>
        </section>`
      : "";

  const css = `
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#111; margin:0; padding:24px; }
    header { border-bottom: 3px solid ${accent}; padding-bottom: 8px; margin-bottom: 16px; }
    .name { font-size: 28px; font-weight: 700; }
    .title { font-size: 16px; color:#444; margin-top: 2px; }
    .loc { font-size: 13px; color:#666; margin-top: 4px; }
    .contacts { display:flex; gap:12px; flex-wrap:wrap; font-size:12px; color:#555; margin-top:6px; }
    h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .08em; color:${accent}; margin: 18px 0 8px; }
    p { line-height: 1.4; }
    .tags { display:flex; gap:6px; flex-wrap:wrap; padding:0; list-style:none; }
    .tags li { background:#f3f4f6; border:1px solid #e5e7eb; padding:4px 8px; border-radius:6px; font-size:12px; }
    .role, .edu { padding:8px 0; border-bottom:1px solid #eee; }
    .role:last-child, .edu:last-child { border-bottom:none; }
    .line1 { font-weight:600; }
    .employer { color:#333; }
    .muted { color:#666; font-size:12px; margin-top:2px; }
    .bullets { margin:8px 0 0 18px; }
    .bullets li { margin:2px 0; }
    .langs { margin:0 0 0 18px; }
  `;

  return `<!doctype html>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>${css}</style>
  <body>
    ${header}${summary}${skills}${experience}${education}${languages}
  </body>`;
}

/* ─────────────────────────────────────────────────────────────
   Entry point
   ───────────────────────────────────────────────────────────── */
export async function buildHtmlPreview(
  data: CvData,
  template = "pdf-kyndryl"
): Promise<string> {
  const { accent } = COLORS[template] || COLORS["pdf-kyndryl"];
  if (template === "docx-ep") return epDocxHtml(data, accent);
  return defaultHtml(data, accent);
}
