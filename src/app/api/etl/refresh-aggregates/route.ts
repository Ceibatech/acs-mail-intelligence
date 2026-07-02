import { NextResponse } from "next/server";
import { getInsuranceAnalytics } from "@/lib/queries/analytics";
import { getDashboardSummary } from "@/lib/queries/dashboard";
import { upsertAggregate } from "@/lib/queries/aggregates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REFRESH_HEADER = "x-acs-refresh-secret";

export async function POST(request: Request) {
  const secret = process.env.ETL_REFRESH_SECRET || process.env.AUTH_SECRET;
  const provided = request.headers.get(REFRESH_HEADER) || "";
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [analytics, dashboard] = await Promise.all([
      getInsuranceAnalytics(),
      getDashboardSummary(),
    ]);

    await Promise.all([
      upsertAggregate("insurance_analytics", analytics),
      upsertAggregate("dashboard_summary", dashboard),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}
