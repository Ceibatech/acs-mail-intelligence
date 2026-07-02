import { NextResponse } from "next/server";
import { getEtlStatus } from "@/lib/queries/etl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getEtlStatus();
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Impossible de charger le monitoring ETL." },
      { status: 500 },
    );
  }
}
