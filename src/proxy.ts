import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "acs_session";

const protectedPrefixes = [
  "/dashboard",
  "/emails",
  "/followups",
  "/analytics",
  "/etl",
  "/settings",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const isProtected = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/emails/:path*",
    "/followups/:path*",
    "/analytics/:path*",
    "/etl/:path*",
    "/settings/:path*",
  ],
};
