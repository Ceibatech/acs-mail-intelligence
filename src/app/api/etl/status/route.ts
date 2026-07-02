import { NextResponse } from "next/server";
import { isAuthError, requireRole } from "@/lib/auth";
import { getEtlStatus } from "@/lib/queries/etl";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireRole(["manager", "analyst"], request);
    const data = await getEtlStatus();
    return NextResponse.json(data);
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    logError("GET /api/etl/status", error);
    return NextResponse.json(
      { error: "Impossible de charger le monitoring ETL." },
      { status: 500 },
    );
  }
}
