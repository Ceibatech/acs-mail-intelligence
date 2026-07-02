import { NextResponse } from "next/server";
import { getOptionalRequestUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = getOptionalRequestUser(request as Parameters<typeof getOptionalRequestUser>[0]);
  return NextResponse.json({ user });
}
