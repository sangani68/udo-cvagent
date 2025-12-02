// app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const COOKIE_NAME = "cv-agent-auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const password = String(body?.password ?? "");

    // 🔐 Single source of truth for the server password
    const envPassword = process.env.LANDING_PASSWORD ?? "";

    // If the server has no password configured at all,
    // fail loudly so you see it in the UI.
    if (!envPassword) {
      console.error("[login] LANDING_PASSWORD is NOT configured in environment");
      return NextResponse.json(
        {
          ok: false,
          error:
            "Server password is not configured. Please set LANDING_PASSWORD in app settings.",
        },
        { status: 500 },
      );
    }

    // Wrong or empty password → 401
    if (!password || password !== envPassword) {
      console.warn(
        `[login] Invalid password attempt. envPassword length=${envPassword.length}, provided length=${password.length}`,
      );
      return NextResponse.json(
        { ok: false, error: "Invalid password" },
        { status: 401 },
      );
    }

    // ✅ Correct password → set cookie that middleware checks
    const res = NextResponse.json({ ok: true });

    res.cookies.set(COOKIE_NAME, "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // true on Azure
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
