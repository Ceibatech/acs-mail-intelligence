import { NextResponse } from "next/server";
import { getDashboardSummary } from "@/lib/queries/dashboard";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getDashboardSummary();
    return NextResponse.json(data);
  } catch (error) {
    logError("GET /api/dashboard/summary", error);
    return NextResponse.json(
      { error: "Impossible de charger le tableau de bord." },
      { status: 500 },
    );
  }
}
