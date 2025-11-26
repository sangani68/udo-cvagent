import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const password = (body?.password ?? "") as string;

    // ✅ Read password from either LANDING_PASSWORD or NEXT_PUBLIC_LANDING_PASSWORD
    const envPassword =
      process.env.LANDING_PASSWORD ||
      process.env.NEXT_PUBLIC_LANDING_PASSWORD ||
      "";

    // If no password configured at all, allow everything in local dev
    if (!envPassword) {
      console.warn(
        "⚠️ No LANDING_PASSWORD / NEXT_PUBLIC_LANDING_PASSWORD configured; allowing access by default.",
      );
      const res = NextResponse.json({ ok: true });
      res.cookies.set("cv_agent_auth", "1", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
      return res;
    }

    if (password !== envPassword) {
      return NextResponse.json(
        { ok: false, error: "Invalid password" },
        { status: 401 },
      );
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set("cv_agent_auth", "1", {
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
