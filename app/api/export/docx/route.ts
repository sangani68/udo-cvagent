// app/api/export/docx/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import dayjs from "dayjs";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  DeletedTextRun,
  BorderStyle,
} from "docx";

import { buildViewData } from "@/lib/preview-pipeline";
import { toEpFormData } from "@/lib/ep-docx";
import { uploadToCvkb } from "@/lib/azure";
import { buildExportFilename } from "@/lib/export-utils";

type Body = {
  data?: any;
  cv?: any;
  locale?: string;
  maskPersonal?: boolean;
  template?: string; // "docx-ep"
  templateId?: string; // "docx-ep"
};

const S = (v: any, fb = "") => (v == null ? fb : String(v).trim() || fb);

function fileResponse(buffer: Buffer, filename: string) {
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/**
 * Call the LLM-based proofread endpoint to smart-rewrite the CV.
 * If anything goes wrong or returns junk, we fall back to the original CV.
 */
async function proofreadCv(
  original: any,
  targetLocale: string,
  origin: string
): Promise<any> {
  if (!original) return original;

  try {
    const res = await fetch(`${origin}/api/proofread`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cv: original,
        locale: targetLocale,
        mode: "ep-docx",
      }),
    });

    if (!res.ok) {
      console.warn("EP DOCX proofread failed:", res.status, await res.text());
      return original;
    }

    const json = (await res.json().catch(() => null)) as any;
    const maybe = json?.cv ?? json?.data ?? json?.result ?? json;
    const cleaned = maybe?.cv ?? maybe;

    // Guard: if there's no candidate name after proofreading, stick to original
    if (!cleaned || typeof cleaned !== "object" || !cleaned.candidate?.name) {
      console.warn(
        "EP DOCX proofread produced no candidate.name, using original CV"
      );
      return original;
    }

    return cleaned;
  } catch (err) {
    console.warn("EP DOCX proofread error:", err);
    return original;
  }
}

/** Simple label/value row (EP identity style) */
function infoRow(label: string, value: string) {
  return new TableRow({
    children: [
      new TableCell({
        children: [
          new Paragraph({
            children: [new TextRun({ text: label, bold: true })],
          }),
        ],
        width: { size: 40, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ text: value ?? "" })],
        width: { size: 60, type: WidthType.PERCENTAGE },
      }),
    ],
  });
}

/** Multi-line paragraph from "\n" separated text */
function multilineParagraph(text: string | undefined | null) {
  const t = text ?? "";
  if (!t) return new Paragraph("");
  const lines = t.split(/\r?\n/);
  return new Paragraph({
    children: lines
      .flatMap((line, idx) => [
        idx > 0 ? new TextRun({ text: "\n" }) : undefined,
        new TextRun({ text: line }),
      ])
      .filter(Boolean) as TextRun[],
  });
}

/** EP Form-6 style work experience block using ep.work_experience_blocks item */
function experienceTable(epBlock: any, index: number) {
  const projectName = S(epBlock.project_name);
  const employer = S(epBlock.employer);
  const dates = S(epBlock.dates);
  const manDays = S(epBlock.man_days);
  const client = S(epBlock.client);
  const projectSize = S(epBlock.project_size);
  const projectDescription = S(epBlock.project_description);
  const roles: string[] = Array.isArray(epBlock.roles_responsibilities)
    ? epBlock.roles_responsibilities.map((r: any) => S(r)).filter(Boolean)
    : [];
  const technologies: string[] = Array.isArray(epBlock.technologies)
    ? epBlock.technologies.map((t: any) => S(t)).filter(Boolean)
    : [];
  const lastUpdate = S(epBlock.last_update);

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      insideHorizontal: {
        style: BorderStyle.SINGLE,
        size: 2,
        color: "CCCCCC",
      },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `WORK EXPERIENCE ${index + 1}`,
                    bold: true,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      infoRow(
        "Project / Role",
        [projectName, employer].filter(Boolean).join(" @ ")
      ),
      infoRow(
        "Dates / Effort",
        [dates, manDays && `Man-days: ${manDays}`]
          .filter(Boolean)
          .join(" | ")
      ),
      infoRow("Client", client),
      infoRow("Project size", projectSize),
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Project description",
                    bold: true,
                  }),
                ],
              }),
            ],
            width: { size: 40, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: [multilineParagraph(projectDescription)],
            width: { size: 60, type: WidthType.PERCENTAGE },
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Roles & responsibilities",
                    bold: true,
                  }),
                ],
              }),
            ],
            width: { size: 40, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: roles.length
              ? roles.map(
                  (r) =>
                    new Paragraph({
                      children: [new TextRun({ text: `• ${r}` })],
                    })
                )
              : [new Paragraph({ text: "" })],
            width: { size: 60, type: WidthType.PERCENTAGE },
          }),
        ],
      }),
      infoRow("Technologies / methodologies", technologies.join(", ")),
      infoRow("Date of last update", lastUpdate),
    ],
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;

    const templateId = (body.templateId || body.template || "docx-ep") as string;
    if (templateId !== "docx-ep") {
      return NextResponse.json(
        { error: `Unsupported DOCX template: ${templateId}` },
        { status: 400 }
      );
    }

    // 1) original CV from editor (single source of truth)
    const original = body.cv ?? body.data;
    if (!original) {
      return NextResponse.json(
        { error: "No CV data to export." },
        { status: 400 }
      );
    }

    const targetLocale = (body.locale || original?.meta?.locale || "en")
      .toLowerCase();
    const origin = new URL(req.url).origin;

    // 2) LLM proofread / smart rewrite (with safe fallback)
    const proofread = await proofreadCv(original, targetLocale, origin);

    // 3) Use EXACTLY the same pipeline as preview (so we see edited data)
    const viewBody = {
      ...body,
      data: proofread,
      cv: proofread,
      template: templateId,
      templateId,
      locale: targetLocale,
    };

    const { data, locale } = await buildViewData(viewBody);
    // CvData -> EP-shaped data
    const ep: any = toEpFormData(data);
    const c: any = (data as any).candidate || {};

    // ─────────────────────────────────────────────────────
    // EP skeleton fields (with fallbacks from CvData)
    // ─────────────────────────────────────────────────────
    const fullName =
      ep.full_name ||
      c.fullName ||
      c.name ||
      [c.firstName, c.lastName].filter(Boolean).join(" ");

    const dateOfBirth = S(ep.date_of_birth || c.dob || c.dateOfBirth);
    const gender = S(ep.gender || c.gender);
    const nationality = S(ep.nationality || c.nationality);

    const employer = S(ep.employer || c.employer || c.currentEmployer);
    const dateOfRecruitment = S(
      ep.date_of_recruitment || c.dateOfRecruitment || c.startDateAtEmployer
    );

    const currentFunction = S(ep.current_function || c.currentRole || c.title);
    const profileLevel = S(ep.profile_level || c.profileLevel || c.seniority);
    const scReference = S(ep.sc_reference || c.scReference);

    const highestQualification = S(ep.highest_qualification);
    const degreeName = S(ep.degree_name);
    const institute = S(ep.institute);
    const degreeDate = S(ep.degree_date);

    const itCareerStart = S(
      ep.date_it_career_started ||
        c.itCareerStartDate ||
        c.careerStart ||
        (data as any).careerStart
    );

    const specialisedExpertise = S(
      ep.specialised_expertise ||
        c.specialisedExpertise ||
        c.summary ||
        c.about
    );

    const addressLine = S(ep.address || c.address?.line1 || c.address?.street);
    const city = S(ep.city || c.address?.city || c.location);
    const postalCode = S(
      ep.postal_code || c.address?.postalCode || c.address?.zip
    );
    const country = S(ep.country || c.address?.country);

    const contacts = c.contacts || {};
    const phone = S(ep.phone || contacts.phone || c.phone);
    const email = S(ep.email || contacts.email || c.email);

    const contactDetails = [
      addressLine && `${addressLine}`,
      [postalCode, city].filter(Boolean).join(" "),
      country,
      phone && `Phone: ${phone}`,
      email && `Email: ${email}`,
    ]
      .filter(Boolean)
      .join(" | ");

    const languages = Array.isArray(ep.languages) ? ep.languages : [];
    const languagesSummary = S(ep.languages_summary);

    const trainings = Array.isArray(ep.trainings) ? ep.trainings : [];
    const software = Array.isArray(ep.software_expertise)
      ? ep.software_expertise
      : [];

    const workBlocks = Array.isArray(ep.work_experience_blocks)
      ? ep.work_experience_blocks
      : [];

    // ─────────────────────────────────────────────────────
    // Skeleton sections
    // ─────────────────────────────────────────────────────

    // 1. IDENTITY (EP Form 6 style)
    const identityTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        infoRow("SURNAME, Name", fullName),
        infoRow("Date of birth (dd/mm/yyyy)", dateOfBirth),
        infoRow("Gender", gender),
        infoRow("Nationality", nationality),
        infoRow("Contracting authority / Employer", employer),
        infoRow("Date of recruitment", dateOfRecruitment),
        infoRow("Current function", currentFunction),
        infoRow(
          "Profile for which employee is offered",
          profileLevel
        ),
        infoRow("SC reference", scReference),
        infoRow("Highest educational qualification", highestQualification),
        infoRow("Degree / diploma", degreeName),
        infoRow("Institute", institute),
        infoRow("Degree date", degreeDate),
        infoRow("Date relevant IT career started", itCareerStart),
        infoRow("Contact details", contactDetails),
      ],
    });

    // 2. SPECIALISED EXPERTISE / PROFILE
    const specialisedParagraph = multilineParagraph(specialisedExpertise);

    // 3. TRAININGS AND CERTIFICATIONS – fixed skeleton table
    const minTrainingRows = 5; // always show at least 5 rows
    const trainingRowsCount = Math.max(trainings.length, minTrainingRows);

    const trainingsTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        // Header row
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Training / Course",
                      bold: true,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Provider",
                      bold: true,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Hours",
                      bold: true,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Certificate",
                      bold: true,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Date",
                      bold: true,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        // Data rows (fixed skeleton)
        ...Array.from({ length: trainingRowsCount }, (_, i) => {
          const t = trainings[i] || {};
          const title = S(t.title);
          const provider = S(t.provider);
          const hours = S(t.hours);
          const cert = S(t.certificate);
          const date = S(t.date);

          return new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ text: title })] }),
              new TableCell({ children: [new Paragraph({ text: provider })] }),
              new TableCell({ children: [new Paragraph({ text: hours })] }),
              new TableCell({ children: [new Paragraph({ text: cert })] }),
              new TableCell({ children: [new Paragraph({ text: date })] }),
            ],
          });
        }),
      ],
    });

    // 4. SOFTWARE / TOOLS EXPERTISE – fixed skeleton table
    const minSoftwareRows = 8; // always show at least 8 rows
    const softwareRowsCount = Math.max(software.length, minSoftwareRows);

    const softwareTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        // Header row
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Tool / Technology",
                      bold: true,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Years",
                      bold: true,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Description",
                      bold: true,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        // Data rows (fixed skeleton)
        ...Array.from({ length: softwareRowsCount }, (_, i) => {
          const s = software[i] || {};
          const tool = S(s.tool);
          const years = S(s.years);
          const desc = S(s.description);

          return new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ text: tool })] }),
              new TableCell({ children: [new Paragraph({ text: years })] }),
              new TableCell({ children: [new Paragraph({ text: desc })] }),
            ],
          });
        }),
      ],
    });

    // 5. WORK EXPERIENCE – EP-style repeated blocks
    const experienceBlocks =
      workBlocks.length > 0
        ? workBlocks.map((b: any, idx: number) => experienceTable(b, idx))
        : [
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [infoRow("Work experience", "N/A")],
            }),
          ];

    // 6. LANGUAGES – EP-like table, last
    const languagesTable =
      languages.length > 0
        ? new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "Language",
                            bold: true,
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "Speaking",
                            bold: true,
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "Listening",
                            bold: true,
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "Reading",
                            bold: true,
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "Writing",
                            bold: true,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              ...languages.map((l: any) => {
                const name = S(l.language || l.name);
                const speaking = S(l.speaking);
                const listening = S(l.listening);
                const reading = S(l.reading);
                const writing = S(l.writing);
                return new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ text: name })],
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: speaking })],
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: listening })],
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: reading })],
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: writing })],
                    }),
                  ],
                });
              }),
            ],
          })
        : new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [infoRow("Languages", languagesSummary || "N/A")],
          });

    // ─────────────────────────────────────────────────────
    // Assemble EP-style skeleton document
    // ─────────────────────────────────────────────────────
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            // Top header similar to Form 6
            new Paragraph({
              children: [
                new TextRun({
                  text: "EUROPEAN PARLIAMENT – CURRICULUM VITAE (Form 6)",
                  bold: true,
                  size: 28,
                }),
              ],
              heading: HeadingLevel.TITLE,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({ text: "" }),

            // 1. Identity
            new Paragraph({
              text: "1. IDENTITY",
              heading: HeadingLevel.HEADING_1,
            }),
            identityTable,
            new Paragraph({ text: "" }),

            // 2. Specialised expertise / profile
            new Paragraph({
              text: "2. SPECIALISED EXPERTISE / PROFILE",
              heading: HeadingLevel.HEADING_1,
            }),
            specialisedParagraph,
            new Paragraph({ text: "" }),

            // 3. Trainings and certifications
            new Paragraph({
              text: "3. TRAININGS AND CERTIFICATIONS",
              heading: HeadingLevel.HEADING_1,
            }),
            trainingsTable,
            new Paragraph({ text: "" }),

            // 4. Software / tools expertise
            new Paragraph({
              text: "4. SOFTWARE / TOOLS EXPERTISE",
              heading: HeadingLevel.HEADING_1,
            }),
            softwareTable,
            new Paragraph({ text: "" }),

            // 5. Work experience
            new Paragraph({
              text: "5. WORK EXPERIENCE",
              heading: HeadingLevel.HEADING_1,
            }),
            ...experienceBlocks.flatMap((tbl: any) => [
              tbl,
              new Paragraph({ text: "" }),
            ]),

            // 6. Languages (always last)
            new Paragraph({
              text: "6. LANGUAGES",
              heading: HeadingLevel.HEADING_1,
            }),
            languagesTable,
            new Paragraph({ text: "" }),

            // Footer
            new Paragraph({
              children: [
                new TextRun({
                  text: `Generated ${dayjs().format(
                    "DD/MM/YYYY"
                  )} – EP-style CV from current editor data (LLM-proofread).`,
                  italics: true,
                  size: 20,
                }),
              ],
              alignment: AlignmentType.LEFT,
            }),
          ],
        },
      ],
    });

    const buffer = (await Packer.toBuffer(doc)) as Buffer;

    const filename = buildExportFilename(
      "EuropeanParliament",
      fullName || "Candidate",
      "docx"
    );

    // Best-effort: upload to blob + sync into search
    try {
      await uploadToCvkb(`exports/${filename}`, buffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      const origin = new URL(req.url).origin;
      await fetch(`${origin}/api/blob/run-and-wait?timeout=120&interval=3000`, {
        method: "POST",
      });
      await fetch(`${origin}/api/hydrate-hybrid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          since: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          top: 1000,
        }),
      });
    } catch (e) {
      console.error("[export/docx] post-export sync failed:", e);
    }

    return fileResponse(buffer, filename);
  } catch (err: any) {
    console.error("EP DOCX export error:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
