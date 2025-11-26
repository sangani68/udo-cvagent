// app/api/translate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { chatJson } from "@/lib/azure";
import { toPreviewModel } from "@/lib/cv-view";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const cv = body?.cv || {};
    const to = String(body?.to || "en");
    const from = String(body?.from || cv?.meta?.locale || "en");

    const prompt = `
You are given a CV JSON. Translate ONLY user-facing strings from "${from}" to "${to}".
Keep the exact JSON shape and keys. Do not add or remove fields. Preserve arrays and objects.
Return ONLY JSON.

CV:
${JSON.stringify(cv, null, 2)}
`;
    const jsonText = await chatJson(prompt, "Always return valid JSON with the same keys.");
    let out: any = {};
    try {
      out = JSON.parse(jsonText || "{}");
    } catch {
      out = cv; // fall back
    }
    // Return translated cv and a compatible preview "data" model
    return NextResponse.json({ cv: out, data: toPreviewModel(out) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 400 });
  }
}
