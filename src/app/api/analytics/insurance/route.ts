import { NextResponse } from "next/server";
import { getInsuranceAnalytics } from "@/lib/queries/analytics";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getInsuranceAnalytics();
    return NextResponse.json(data);
  } catch (error) {
    logError("GET /api/analytics/insurance", error);
    return NextResponse.json(
      { error: "Impossible de charger l'analyse courtier." },
      { status: 500 },
    );
  }
}
