import { NextResponse } from "next/server";
import {
  LEGACY_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_TTL_DAYS,
  createSession,
  getClientIp,
  logLoginAttempt,
  verifyPassword,
} from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { logError } from "@/lib/logger";
import { ensureAdminUser } from "@/lib/users-admin";
import { getUserByEmail, updateLastLogin } from "@/lib/users";
import type { UserRole } from "@/types/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const invalidCredentials = "Identifiants incorrects.";

function publicUser(user: {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
}) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
  };
}

export async function POST(request: Request) {
  let email = "";

  try {
    const body = await request.json();
    email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      await logLoginAttempt({
        email,
        success: false,
        request,
        errorMessage: "Email ou mot de passe manquant.",
      });
      return NextResponse.json(
        { error: "Email et mot de passe requis." },
        { status: 400 },
      );
    }

    if (process.env.ADMIN_EMAIL?.trim().toLowerCase() === email) {
      await ensureAdminUser();
    }

    const user = await getUserByEmail(email);
    const valid = user?.is_active
      ? await verifyPassword(password, user.password_hash)
      : false;

    if (!user || !valid) {
      await logLoginAttempt({
        email,
        success: false,
        request,
        errorMessage: invalidCredentials,
      });
      return NextResponse.json({ error: invalidCredentials }, { status: 401 });
    }

    const session = await createSession(user.id, request);
    await updateLastLogin(user.id);
    await logLoginAttempt({ email, success: true, request });

    await writeAuditLog({
      user: publicUser(user),
      action: "login",
      entityType: "app_users",
      entityId: user.id,
      ipAddress: getClientIp(request),
      metadata: { role: user.role },
    });

    const response = NextResponse.json({ user: publicUser(user) });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: session.token,
      httpOnly: true,
      expires: session.expiresAt,
      maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    response.cookies.set({
      name: LEGACY_COOKIE_NAME,
      value: "",
      maxAge: 0,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    try {
      await logLoginAttempt({
        email,
        success: false,
        request,
        errorMessage: "Erreur serveur pendant la connexion.",
      });
    } catch {
      // Ignore secondary logging failures.
    }

    logError("POST /api/auth/login", error);
    return NextResponse.json(
      { error: "Impossible de se connecter." },
      { status: 500 },
    );
  }
}
