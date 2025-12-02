// middleware.ts
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_FILE = /\.(.*)$/;
const COOKIE_NAME = "cv-agent-auth";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public assets, landing page, APIs, and Next internals
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/landing") ||
    pathname === "/favicon.ico" ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Check the auth cookie set by /api/login
  const authCookie = req.cookies.get(COOKIE_NAME);
  if (authCookie?.value === "1") {
    return NextResponse.next();
  }

  // Not authenticated → send to landing
  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = "/landing";
  redirectUrl.searchParams.set("redirect", pathname || "/");

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
