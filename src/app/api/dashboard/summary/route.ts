import { NextResponse } from "next/server";
import { getDashboardSummary } from "@/lib/queries/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getDashboardSummary();
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Impossible de charger le tableau de bord." },
      { status: 500 },
    );
  }
}
