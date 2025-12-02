// app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const COOKIE_NAME = "cv-agent-auth";
// 👉 Change this to whatever password you want to use
const HARDCODED_PASSWORD = "KyndrylCV2025!";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const password = String(body?.password ?? "");

    console.log("[login] Incoming password length:", password.length);

    if (!password) {
      return NextResponse.json(
        { ok: false, error: "Password is required" },
        { status: 400 },
      );
    }

    if (password !== HARDCODED_PASSWORD) {
      console.warn("[login] Invalid password");
      return NextResponse.json(
        { ok: false, error: "Invalid password" },
        { status: 401 },
      );
    }

    // ✅ Correct password → set auth cookie
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return res;
  } catch (err) {
    console.error("[login] unexpected error", err);
    return NextResponse.json(
      { ok: false, error: "Login failed" },
      { status: 500 },
    );
  }
}
