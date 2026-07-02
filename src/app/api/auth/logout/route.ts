import { NextResponse } from "next/server";
import {
  LEGACY_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  destroySession,
  getClientIp,
} from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await destroySession(request);
    if (user) {
      await writeAuditLog({
        user,
        action: "logout",
        entityType: "app_sessions",
        ipAddress: getClientIp(request),
      });
    }

    const response = NextResponse.json({ ok: true });
    for (const name of [SESSION_COOKIE_NAME, LEGACY_COOKIE_NAME]) {
      response.cookies.set({
        name,
        value: "",
        maxAge: 0,
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }
    return response;
  } catch (error) {
    logError("POST /api/auth/logout", error);
    return NextResponse.json({ error: "Deconnexion impossible." }, { status: 500 });
  }
}
