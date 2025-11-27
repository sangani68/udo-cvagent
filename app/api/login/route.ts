// app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type LoginBody = {
  password?: string;
};

export async function POST(req: NextRequest) {
  let body: LoginBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const submitted = (body.password || "").trim();

  // Accept several env names for compatibility
  const configuredPassword =
    process.env.LANDING_PASSWORD ||
    process.env.APP_PASSWORD ||
    process.env.NEXT_PUBLIC_LANDING_PASSWORD ||
    ""; // no default in prod to avoid accidental exposure

  if (!configuredPassword) {
    // Fail closed if nothing configured in env
    return NextResponse.json(
      {
        ok: false,
        error:
          "Server password not configured. Set LANDING_PASSWORD in App Settings.",
      },
      { status: 500 },
    );
  }

  if (!submitted || submitted !== configuredPassword) {
    return NextResponse.json(
      { ok: false, error: "Invalid password" },
      { status: 401 },
    );
  }

  const redirect =
    req.nextUrl.searchParams.get("redirect") || "/";

  const res = NextResponse.json({ ok: true, redirect });

  // Auth cookie used by middleware.ts
  res.cookies.set("cv_agent_auth", "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    // 8 hours
    maxAge: 60 * 60 * 8,
  });

  return res;
}
