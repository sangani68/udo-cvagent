// app/lib/ingest.ts
// Call the working route (/api/convert-to-cvjson) and normalize to your UI shape.

export async function ingestFileToCv(file: File): Promise<any> {
  const res = await fetch("/api/convert-to-cvjson", {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "x-filename": file.name || "upload",
    },
    body: file,
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  const cv = data?.cv;
  if (!cv) throw new Error("No CV in response");
  return normalizeForEditor(cv);
}

export async function ingestRawTextToCv(rawText: string): Promise<any> {
  const res = await fetch("/api/convert-to-cvjson", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawText }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  const cv = data?.cv;
  if (!cv) throw new Error("No CV in response");
  return normalizeForEditor(cv);
}

/* ---------- client-side normalizer to match your editor ---------- */
function normalizeForEditor(cv: any) {
  const C = cv?.candidate || cv || {};
  const candidate = {
    name: s(C.name),
    title: s(C.title),
    summary: s(C.summary),
    location: s(C.location),
    contacts: {
      email: s(C?.contacts?.email),
      phone: s(C?.contacts?.phone),
      linkedin: s(C?.contacts?.linkedin),
    },
    skills: arr(C.skills).slice(0, 60),
    experience: arr(C.experience).map(fixRole),
    education: arr(C.education),
    languages: arr(C.languages),
  };
  return { candidate };
}

function fixRole(e: any) {
  const employer = s(e.employer) || s(e.company);
  const role = s(e.role) || s(e.title);
  const start = fixDate(e.start);
  const end = fixDate(e.end);
  const location = s(e.location);
  const bullets = arr(e.bullets).map(b => (typeof b === "string" ? { text: b } : { text: s(b?.text) })).filter(b => b.text);
  return {
    employer, role, start, end, location, bullets,
    // include both shapes so either editor/preview variant is happy
    company: employer, title: role,
  };
}

function fixDate(v: any) { return s(v).replace(/\b(today|present|current|now)\b/i, "Present"); }
function arr(x: any) { return Array.isArray(x) ? x : x ? [x] : []; }
function s(v: any) { return (v ?? "").toString().replace(/\u00A0/g, " ").trim(); }
async function safeJson(r: Response) { try { return await r.json(); } catch { return {}; } }
