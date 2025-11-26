// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow these paths without auth
  if (
    pathname.startsWith("/landing") ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  const auth = req.cookies.get("cvagent_auth");

  if (auth?.value === "true") {
    // Already authenticated
    return NextResponse.next();
  }

  // Not authenticated → redirect to /landing and keep the original destination
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/landing";
  loginUrl.searchParams.set("redirect", pathname || "/");
  return NextResponse.redirect(loginUrl);
}

// Apply to everything except Next.js internals and static assets
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
