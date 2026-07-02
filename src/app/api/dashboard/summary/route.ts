import { NextResponse } from "next/server";
import { isAuthError, requireRole } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/queries/dashboard";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireRole(["manager", "analyst", "viewer"], request);
    const data = await getDashboardSummary();
    return NextResponse.json(data);
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    logError("GET /api/dashboard/summary", error);
    return NextResponse.json(
      { error: "Impossible de charger le tableau de bord." },
      { status: 500 },
    );
  }
}
