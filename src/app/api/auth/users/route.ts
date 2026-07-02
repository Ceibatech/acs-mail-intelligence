import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuthenticatedRequestUser } from "@/lib/auth";
import { createAdminUser, getUsersForAdmin } from "@/lib/users-admin";
import type { UserRole } from "@/types/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = getAuthenticatedRequestUser(request);
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }

    const users = await getUsersForAdmin();
    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: "Impossible de récupérer les comptes." }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthenticatedRequestUser(request);
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }

    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = String(body.role || "viewer") as UserRole;

    if (!email || !password || !role) {
      return NextResponse.json({ error: "Email, mot de passe et rôle requis." }, { status: 400 });
    }

    const created = await createAdminUser(email, password, role);
    return NextResponse.json({ user: created });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Impossible de créer le compte." }, { status: 500 });
  }
}
