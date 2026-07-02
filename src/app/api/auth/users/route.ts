import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isAuthError, requireRole } from "@/lib/auth";
import { createAdminUser, getUsersForAdmin } from "@/lib/users-admin";
import { logError } from "@/lib/logger";
import type { UserRole } from "@/types/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const roles: UserRole[] = ["admin", "manager", "analyst", "viewer"];

export async function GET(request: NextRequest) {
  try {
    await requireRole(["admin"], request);
    const users = await getUsersForAdmin();
    return NextResponse.json({ users });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    logError("GET /api/auth/users", error);
    return NextResponse.json(
      { error: "Impossible de recuperer les comptes." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(["admin"], request);

    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = String(body.role || "viewer") as UserRole;
    const fullName = String(body.fullName || body.full_name || "").trim();

    if (!email || !password || !role) {
      return NextResponse.json(
        { error: "Email, mot de passe et role requis." },
        { status: 400 },
      );
    }

    if (!roles.includes(role)) {
      return NextResponse.json({ error: "Role invalide." }, { status: 400 });
    }

    const created = await createAdminUser(email, password, role, fullName);
    return NextResponse.json({ user: created });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    logError("POST /api/auth/users", error);
    return NextResponse.json(
      { error: "Impossible de creer le compte." },
      { status: 500 },
    );
  }
}
