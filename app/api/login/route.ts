// app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const password = body.password;
  const expected = process.env.APP_PASSWORD;

  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "APP_PASSWORD is not configured on the server." },
      { status: 500 }
    );
  }

  if (!password || password !== expected) {
    return NextResponse.json(
      { ok: false, error: "Invalid password" },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ ok: true });

  const isProd = process.env.NODE_ENV === "production";

  // In dev (http://localhost) we must NOT set secure: true
  res.cookies.set("cvagent_auth", "true", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours
  });

  return res;
}
