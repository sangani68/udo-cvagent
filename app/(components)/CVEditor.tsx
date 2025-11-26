// app/(components)/CVEditor.tsx
"use client";

import * as React from "react";
import type { CVJson } from "../lib/cvSchema";

type Props = {
  value: CVJson | null;
  onChange: (cv: CVJson) => void;
};

// --- helpers ----------------------------------------------------
function ensure(cv: CVJson | null): CVJson {
  const base: CVJson = {
    meta: { locale: cv?.meta?.locale || "en", source: cv?.meta?.source || undefined },
    candidate: {
      name: cv?.candidate?.name || "",
      title: cv?.candidate?.title || "",
      summary: cv?.candidate?.summary || "",
      location: cv?.candidate?.location || "",
      contacts: {
        email: cv?.candidate?.contacts?.email || "",
        phone: cv?.candidate?.contacts?.phone || "",
        linkedin: cv?.candidate?.contacts?.linkedin || "",
        website: cv?.candidate?.contacts?.website || "",
      },
      skills: [...(cv?.candidate?.skills || [])],
      languages: [...(cv?.candidate?.languages || [])],
      links: [...(cv?.candidate?.links || [])],
      photoDataUrl: cv?.candidate?.photoDataUrl || undefined,
    },
    experience: [...(cv?.experience || [])],
    education: [...(cv?.education || [])],
    projects: [...(cv?.projects || [])],
    certificates: [...(cv?.certificates || [])],
    awards: [...(cv?.awards || [])],
    publications: [...(cv?.publications || [])],
  };

  // Strip empty contacts later on save; keep fields visible while editing.
  return base;
}

function splitSkills(s: string): string[] {
  return (s || "")
    .replace(/[•·–—-]/g, ",")
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 60);
}

function joinSkills(a?: string[]): string {
  return (a || []).join(", ");
}

// --- component --------------------------------------------------
export function CVEditor({ value, onChange }: Props) {
  const [form, setForm] = React.useState<CVJson>(() => ensure(value));

  // Keep local form in sync when parent value changes
  React.useEffect(() => {
    setForm(ensure(value));
  }, [value?.candidate?.name]); // key off name since it changes on “Use this CV”

  function update(updater: (draft: CVJson) => void) {
    setForm((prev) => {
      const next = ensure(prev);
      updater(next);
      // Clean up empty strings for contacts to avoid noisy preview
      if (next.candidate.contacts) {
        const c = next.candidate.contacts as any;
        for (const k of ["email", "phone", "linkedin", "website"]) {
          if (typeof c[k] === "string" && !c[k].trim()) delete c[k];
        }
        if (Object.keys(next.candidate.contacts).length === 0) delete (next.candidate as any).contacts;
      }
      onChange(next);
      return next;
    });
  }

  const c = form.candidate;

  return (
    <div className="space-y-4">
      {/* Candidate core */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-xs text-gray-600">
          Name
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            value={c.name}
            onChange={(e) => update((d) => (d.candidate.name = e.target.value))}
          />
        </label>
        <label className="text-xs text-gray-600">
          Title
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            value={c.title || ""}
            onChange={(e) => update((d) => (d.candidate.title = e.target.value))}
          />
        </label>
        <label className="text-xs text-gray-600 md:col-span-2">
          Summary
          <textarea
            className="mt-1 w-full rounded border px-2 py-1"
            rows={3}
            value={c.summary || ""}
            onChange={(e) => update((d) => (d.candidate.summary = e.target.value))}
          />
        </label>
        <label className="text-xs text-gray-600">
          Location
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            value={c.location || ""}
            onChange={(e) => update((d) => (d.candidate.location = e.target.value))}
          />
        </label>
      </div>

      {/* Contacts */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-xs text-gray-600">
          Email
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            value={c.contacts?.email || ""}
            onChange={(e) =>
              update((d) => {
                d.candidate.contacts = d.candidate.contacts || {};
                d.candidate.contacts.email = e.target.value;
              })
            }
          />
        </label>
        <label className="text-xs text-gray-600">
          Phone
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            value={c.contacts?.phone || ""}
            onChange={(e) =>
              update((d) => {
                d.candidate.contacts = d.candidate.contacts || {};
                d.candidate.contacts.phone = e.target.value;
              })
            }
          />
        </label>
        <label className="text-xs text-gray-600">
          LinkedIn
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            value={c.contacts?.linkedin || ""}
            onChange={(e) =>
              update((d) => {
                d.candidate.contacts = d.candidate.contacts || {};
                d.candidate.contacts.linkedin = e.target.value;
              })
            }
          />
        </label>
        <label className="text-xs text-gray-600">
          Website
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            value={c.contacts?.website || ""}
            onChange={(e) =>
              update((d) => {
                d.candidate.contacts = d.candidate.contacts || {};
                d.candidate.contacts.website = e.target.value;
              })
            }
          />
        </label>
      </div>

      {/* Skills */}
      <div>
        <div className="mb-1 text-xs text-gray-600">Skills (comma or new line)</div>
        <textarea
          className="w-full rounded border px-2 py-1"
          rows={3}
          value={joinSkills(c.skills)}
          onChange={(e) => update((d) => (d.candidate.skills = splitSkills(e.target.value)))}
        />
      </div>

      {/* Languages (at end, per your requirement) */}
      <div>
        <div className="mb-2 text-xs text-gray-600">Languages</div>
        {(c.languages || []).map((l, i) => (
          <div key={i} className="mb-2 grid grid-cols-5 gap-2">
            <input
              className="col-span-3 rounded border px-2 py-1 text-sm"
              placeholder="Language"
              value={l.name || ""}
              onChange={(e) => update((d) => { (d.candidate.languages = d.candidate.languages || [])[i].name = e.target.value; })}
            />
            <input
              className="col-span-2 rounded border px-2 py-1 text-sm"
              placeholder="Level (e.g., Native)"
              value={l.level || ""}
              onChange={(e) => update((d) => { (d.candidate.languages = d.candidate.languages || [])[i].level = e.target.value; })}
            />
          </div>
        ))}
        <div className="flex gap-2">
          <button
            className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
            onClick={() => update((d) => (d.candidate.languages = [...(d.candidate.languages || []), { name: "", level: "" }]))}
          >
            + Add language
          </button>
          {c.languages?.length ? (
            <button
              className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
              onClick={() => update((d) => (d.candidate.languages = (d.candidate.languages || []).slice(0, -1)))}
            >
              − Remove last
            </button>
          ) : null}
        </div>
      </div>

      {/* Experience (compact editor) */}
      <div>
        <div className="mb-2 text-sm font-medium">Experience</div>
        {(form.experience || []).map((e, i) => (
          <div key={i} className="mb-3 rounded border p-2">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input
                className="rounded border px-2 py-1 text-sm"
                placeholder="Employer"
                value={e.employer || ""}
                onChange={(ev) => update((d) => ((d.experience = d.experience || [])[i].employer = ev.target.value))}
              />
              <input
                className="rounded border px-2 py-1 text-sm"
                placeholder="Role / Title"
                value={e.role || ""}
                onChange={(ev) => update((d) => ((d.experience = d.experience || [])[i].role = ev.target.value))}
              />
              <input
                className="rounded border px-2 py-1 text-sm"
                placeholder="Start"
                value={e.start || ""}
                onChange={(ev) => update((d) => ((d.experience = d.experience || [])[i].start = ev.target.value))}
              />
              <input
                className="rounded border px-2 py-1 text-sm"
                placeholder="End"
                value={e.end || ""}
                onChange={(ev) => update((d) => ((d.experience = d.experience || [])[i].end = ev.target.value))}
              />
              <input
                className="rounded border px-2 py-1 text-sm md:col-span-2"
                placeholder="Location"
                value={e.location || ""}
                onChange={(ev) => update((d) => ((d.experience = d.experience || [])[i].location = ev.target.value))}
              />
              <textarea
                className="rounded border px-2 py-1 text-sm md:col-span-2"
                rows={2}
                placeholder="Bullets (one per line)"
                value={(e.bullets || []).map((b) => b.text).join("\n")}
                onChange={(ev) =>
                  update((d) => {
                    (d.experience = d.experience || [])[i].bullets = (ev.target.value || "")
                      .split("\n")
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .map((t) => ({ text: t }));
                  })
                }
              />
            </div>
          </div>
        ))}
        <div className="flex gap-2">
          <button
            className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
            onClick={() =>
              update((d) =>
                (d.experience = [
                  ...(d.experience || []),
                  { employer: "", role: "", start: "", end: "", location: "", bullets: [] },
                ])
              )
            }
          >
            + Add role
          </button>
          {form.experience?.length ? (
            <button
              className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
              onClick={() => update((d) => (d.experience = (d.experience || []).slice(0, -1)))}
            >
              − Remove last role
            </button>
          ) : null}
        </div>
      </div>

      {/* Education (compact) */}
      <div>
        <div className="mb-2 text-sm font-medium">Education</div>
        {(form.education || []).map((ed, i) => (
          <div key={i} className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <input
              className="rounded border px-2 py-1 text-sm"
              placeholder="Degree"
              value={ed.degree || ""}
              onChange={(ev) => update((d) => ((d.education = d.education || [])[i].degree = ev.target.value))}
            />
            <input
              className="rounded border px-2 py-1 text-sm"
              placeholder="School"
              value={ed.school || ""}
              onChange={(ev) => update((d) => ((d.education = d.education || [])[i].school = ev.target.value))}
            />
            <input
              className="rounded border px-2 py-1 text-sm"
              placeholder="Start"
              value={ed.start || ""}
              onChange={(ev) => update((d) => ((d.education = d.education || [])[i].start = ev.target.value))}
            />
            <input
              className="rounded border px-2 py-1 text-sm"
              placeholder="End"
              value={ed.end || ""}
              onChange={(ev) => update((d) => ((d.education = d.education || [])[i].end = ev.target.value))}
            />
            <input
              className="md:col-span-2 rounded border px-2 py-1 text-sm"
              placeholder="Location"
              value={ed.location || ""}
              onChange={(ev) => update((d) => ((d.education = d.education || [])[i].location = ev.target.value))}
            />
          </div>
        ))}
        <div className="flex gap-2">
          <button
            className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
            onClick={() => update((d) => (d.education = [...(d.education || []), { degree: "", school: "" }]))}
          >
            + Add education
          </button>
          {form.education?.length ? (
            <button
              className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
              onClick={() => update((d) => (d.education = (d.education || []).slice(0, -1)))}
            >
              − Remove last
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default CVEditor;
