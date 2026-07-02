import { NextResponse } from "next/server";
import { isAuthError, requireRole } from "@/lib/auth";
import { getInsuranceAnalytics } from "@/lib/queries/analytics";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireRole(["manager", "analyst", "viewer"], request);
    const data = await getInsuranceAnalytics();
    return NextResponse.json(data);
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    logError("GET /api/analytics/insurance", error);
    return NextResponse.json(
      { error: "Impossible de charger l'analyse courtier." },
      { status: 500 },
    );
  }
}
