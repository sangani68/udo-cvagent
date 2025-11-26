// app/api/upload-cv/route.ts
import { NextRequest, NextResponse } from "next/server";
import { uploadToCvkb } from "@/lib/azure";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Send multipart/form-data with a 'file' field" }, { status: 400 });
  }
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file missing" }, { status: 400 });

  const name = (file as any).name || "upload.bin";
  const arr = await file.arrayBuffer();
  const buf = Buffer.from(arr);

  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const safe = name.replace(/[^A-Za-z0-9._-]/g, "_");
  const path = `uploads/${stamp}_${safe}`;

  const { url, path: blobPath } = await uploadToCvkb(path, buf, file.type || undefined);
  return NextResponse.json({ ok: true, url, path: blobPath, name: safe });
}
