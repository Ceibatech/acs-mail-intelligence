import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/users";
import { createAuthToken } from "@/lib/auth";
import { ensureAdminUser } from "@/lib/users-admin";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email et mot de passe requis." }, { status: 400 });
    }

    await ensureAdminUser();
    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
    }

    const valid = await compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Identifiants incorrects." }, { status: 401 });
    }

    const token = createAuthToken({ email: user.email, role: user.role });
    const response = NextResponse.json({ user: { email: user.email, role: user.role } });
    response.cookies.set({
      name: "acs_token",
      value: token,
      httpOnly: true,
      maxAge: 60 * 60 * 24,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    logError("POST /api/auth/login", error);
    return NextResponse.json({ error: "Impossible de se connecter." }, { status: 500 });
  }
}
