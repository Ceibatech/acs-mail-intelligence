import { NextRequest, NextResponse } from "next/server";
import { publicAppUrl } from "@/lib/public-url";

const SESSION_COOKIE_NAME = "acs_session";

const protectedPrefixes = [
  "/dashboard",
  "/emails",
  "/followups",
  "/analytics",
  "/etl",
  "/settings",
];

function getSafeNextPath(next?: string | null) {
  if (!next?.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const isProtected = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(publicAppUrl(hasSession ? "/dashboard" : "/login")),
    );
  }

  if (isProtected && !hasSession) {
    const loginUrl = new URL(publicAppUrl("/login"));
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && hasSession) {
    const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(publicAppUrl(nextPath)));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dashboard/:path*",
    "/emails/:path*",
    "/followups/:path*",
    "/analytics/:path*",
    "/etl/:path*",
    "/settings/:path*",
  ],
};
