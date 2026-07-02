import { NextResponse } from "next/server";
import { getInsuranceAnalytics } from "@/lib/queries/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getInsuranceAnalytics();
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Impossible de charger l'analyse courtier." },
      { status: 500 },
    );
  }
}
