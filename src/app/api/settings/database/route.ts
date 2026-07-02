import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { databaseHealth, formatDbError } from "@/lib/db";
import { isAuthError, requireRole } from "@/lib/auth";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireRole(["admin"], request);
    const data = await databaseHealth();
    return NextResponse.json({
      ...data,
      currentUser,
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    logError("GET /api/settings/database", error);
    return NextResponse.json(
      {
        ok: false,
        currentUser: null,
        error: formatDbError(error),
      },
      { status: 500 },
    );
  }
}
