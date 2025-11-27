// app/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/landing",
  "/api/login",
  "/favicon.ico",
  "/kyndryl.svg",
];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/public/")) return true;
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const hasAuth = req.cookies.get("cv_agent_auth")?.value === "1";

  if (!hasAuth) {
    const url = req.nextUrl.clone();
    url.pathname = "/landing";
    url.searchParams.set("redirect", pathname || "/");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|kyndryl.svg).*)",
  ],
};
