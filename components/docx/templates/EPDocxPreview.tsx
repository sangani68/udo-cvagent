// components/docx/EPDocxPreview.tsx
"use client";

import React from "react";
import type { CvData } from "@/types/cv";
import { toEpFormData } from "@/lib/ep-docx";

export default function EPDocxPreview({ data }: { data: CvData }) {
  const d = toEpFormData(data);

  return (
    <div className="prose max-w-none p-6 text-sm">
      <h1 className="text-2xl font-bold">CV — Form 6</h1>

      <section className="mt-4">
        <h2 className="text-lg font-semibold">Identity</h2>
        <p><strong>SURNAME:</strong> {d.surname}</p>
        <p><strong>Name:</strong> {d.name}</p>
        <p><strong>Date of birth:</strong> {d.date_of_birth}</p>
        <p><strong>Gender:</strong> {d.gender}</p>
        <p><strong>Nationality:</strong> {d.nationality}</p>
        <p><strong>Employer:</strong> {d.employer}</p>
        <p><strong>Date of recruitment:</strong> {d.date_of_recruitment}</p>
        <p><strong>Current function:</strong> {d.current_function}</p>
        <p><strong>Profile Level:</strong> {d.profile_level}</p>
        <p><strong>SC reference:</strong> {d.sc_reference}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Highest educational qualification</h2>
        <p><strong>Level:</strong> {d.highest_qualification}</p>
        <p><strong>Certificate/Diploma:</strong> {d.degree_name}</p>
        <p><strong>Institute:</strong> {d.institute}</p>
        <p><strong>Date:</strong> {d.degree_date}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Specialised expertise</h2>
        <p className="whitespace-pre-line">{d.specialised_expertise}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Languages</h2>
        <table className="table-auto border-collapse w-full">
          <thead>
            <tr>
              <th className="border px-2 py-1 text-left">Language</th>
              <th className="border px-2 py-1">Speaking</th>
              <th className="border px-2 py-1">Listening</th>
              <th className="border px-2 py-1">Writing</th>
              <th className="border px-2 py-1">Reading</th>
            </tr>
          </thead>
          <tbody>
            {d.languages?.map((l, i) => (
              <tr key={i}>
                <td className="border px-2 py-1">{l.language}</td>
                <td className="border px-2 py-1 text-center">{l.speaking}</td>
                <td className="border px-2 py-1 text-center">{l.listening}</td>
                <td className="border px-2 py-1 text-center">{l.writing}</td>
                <td className="border px-2 py-1 text-center">{l.reading}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {!!(d.trainings?.length) && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Trainings</h2>
          <table className="table-auto border-collapse w-full">
            <thead>
              <tr>
                <th className="border px-2 py-1 text-left">Training</th>
                <th className="border px-2 py-1 text-left">Provider</th>
                <th className="border px-2 py-1">Hours</th>
                <th className="border px-2 py-1 text-left">Certificate</th>
                <th className="border px-2 py-1">Date</th>
              </tr>
            </thead>
            <tbody>
              {d.trainings.map((t, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1">{t.title}</td>
                  <td className="border px-2 py-1">{t.provider}</td>
                  <td className="border px-2 py-1 text-center">{t.hours}</td>
                  <td className="border px-2 py-1">{t.certificate}</td>
                  <td className="border px-2 py-1 text-center">{t.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {!!(d.software_expertise?.length) && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Software expertise</h2>
          <table className="table-auto border-collapse w-full">
            <thead>
              <tr>
                <th className="border px-2 py-1 text-left">Tool</th>
                <th className="border px-2 py-1">Years</th>
                <th className="border px-2 py-1 text-left">Description</th>
              </tr>
            </thead>
            <tbody>
              {d.software_expertise.map((t, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1">{t.tool}</td>
                  <td className="border px-2 py-1 text-center">{t.years}</td>
                  <td className="border px-2 py-1">{t.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {!!(d.work_experience_blocks?.length) && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Work Experience</h2>
          {d.work_experience_blocks.map((w, i) => (
            <div key={i} className="mt-4 border rounded p-3">
              <p><strong>Project name:</strong> {w.project_name}</p>
              <p><strong>Employer:</strong> {w.employer}</p>
              <p><strong>Dates:</strong> {w.dates}</p>
              <p><strong>Client:</strong> {w.client}</p>
              {w.project_size && <p><strong>Project size:</strong> {w.project_size}</p>}
              {w.man_days && <p><strong>Man-days:</strong> {w.man_days}</p>}
              <p className="whitespace-pre-line"><strong>Project description:</strong> {w.project_description}</p>
              {!!(w.roles_responsibilities?.length) && (
                <>
                  <p className="mt-2 font-semibold">Employee’s roles & responsibilities:</p>
                  <ul className="list-disc pl-6">
                    {w.roles_responsibilities.map((r: string, j: number) => <li key={j}>{r}</li>)}
                  </ul>
                </>
              )}
              {!!(w.technologies?.length) && (
                <p className="mt-2"><strong>Technologies & methodologies:</strong> {w.technologies.join(", ")}</p>
              )}
              {w.last_update && <p className="text-xs mt-2 opacity-70">Date of last update: {w.last_update}</p>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
