// app/api/photo-upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { uploadToCvkb } from "@/lib/azure";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Send multipart/form-data with a 'file' field" }, { status: 400 });
    }
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "file missing" }, { status: 400 });

    const mime = (file as any).type || "application/octet-stream";
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(mime)) {
      return NextResponse.json({ error: "Only PNG/JPEG/WEBP images are supported" }, { status: 400 });
    }

    const name = (file as any).name || "photo.png";
    const arr = await file.arrayBuffer();
    const buf = Buffer.from(arr);

    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const safe = name.replace(/[^A-Za-z0-9._-]/g, "_");
    const path = `images/${stamp}_${safe}`;

    const { url, path: blobPath } = await uploadToCvkb(path, buf, mime);

    // Build a data URL for stable preview/export (React-PDF friendly)
    const b64 = buf.toString("base64");
    const dataUrl = `data:${mime};base64,${b64}`;

    return NextResponse.json({
      ok: true,
      path: blobPath,
      url,
      dataUrl,
    });
  } catch (e: any) {
    console.error("[photo-upload]", e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 400 });
  }
}
