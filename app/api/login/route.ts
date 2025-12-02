// app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const COOKIE_NAME = "cv-agent-auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const password = String(body?.password ?? "");

    // Prefer LANDING_PASSWORD but tolerate NEXT_PUBLIC_LANDING_PASSWORD too
    const envPassword =
      process.env.LANDING_PASSWORD ||
      process.env.NEXT_PUBLIC_LANDING_PASSWORD ||
      "";

    // Debug logging (won't be visible to users, but in server logs)
    console.log("[login] Incoming password length:", password.length);
    console.log(
      "[login] Env password configured:",
      envPassword ? `yes (length=${envPassword.length})` : "no",
    );

    // If *no* password configured at all in the environment
    if (!envPassword) {
      console.warn(
        "[login] No LANDING_PASSWORD / NEXT_PUBLIC_LANDING_PASSWORD set. Allowing any non-empty password.",
      );

      if (!password) {
        return NextResponse.json(
          { ok: false, error: "Password is required" },
          { status: 400 },
        );
      }

      // Allow any non-empty password in this fallback mode
      const res = NextResponse.json({ ok: true, mode: "fallback" });
      res.cookies.set(COOKIE_NAME, "1", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
      return res;
    }

    // Normal mode: env password is set → enforce it
    if (!password || password !== envPassword) {
      console.warn(
        "[login] Invalid password attempt. Provided length:",
        password.length,
      );
      return NextResponse.json(
        { ok: false, error: "Invalid password" },
        { status: 401 },
      );
    }

    // Correct password → set auth cookie
    const res = NextResponse.json({ ok: true, mode: "strict" });
    res.cookies.set(COOKIE_NAME, "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("[login] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: "Login failed" },
      { status: 500 },
    );
  }
}
