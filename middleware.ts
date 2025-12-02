// middleware.ts
import { NextRequest, NextResponse } from "next/server";

// No auth enforcement for now – everything just passes through
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

// Empty matcher so this never actually runs
export const config = {
  matcher: [],
};
