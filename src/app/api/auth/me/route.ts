import { NextResponse } from "next/server";
import { getAuthenticatedRequestUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = getAuthenticatedRequestUser(request as unknown as Parameters<typeof getAuthenticatedRequestUser>[0]);
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
}
