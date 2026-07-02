import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { databaseHealth, formatDbError } from "@/lib/db";
import { getRequestUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const data = await databaseHealth();
    return NextResponse.json({
      ...data,
      currentUser: getRequestUser(request),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        ok: false,
        currentUser: getRequestUser(request),
        error: formatDbError(error),
      },
      { status: 500 },
    );
  }
}
