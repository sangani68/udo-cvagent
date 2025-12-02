import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const COOKIE_NAME = "cv-agent-auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const password = (body?.password ?? "") as string;

    // Read password from either LANDING_PASSWORD or NEXT_PUBLIC_LANDING_PASSWORD
    const envPassword =
      process.env.LANDING_PASSWORD ||
      process.env.NEXT_PUBLIC_LANDING_PASSWORD ||
      "";

    // If no password configured at all, allow everything (useful for local dev)
    if (!envPassword) {
      console.warn(
        "⚠️ No LANDING_PASSWORD / NEXT_PUBLIC_LANDING_PASSWORD configured; allowing access by default.",
      );
      const res = NextResponse.json({ ok: true });
      res.cookies.set(COOKIE_NAME, "1", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
      return res;
    }

    // Password required and incorrect
    if (!password || password !== envPassword) {
      return NextResponse.json(
        { ok: false, error: "Invalid password" },
        { status: 401 },
      );
    }

    // OK → set auth cookie
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("Login error", err);
    return NextResponse.json(
      { ok: false, error: "Login failed" },
      { status: 500 },
    );
  }
}
