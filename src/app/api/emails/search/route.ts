import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { searchEmails } from "@/lib/queries/emails";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = {
      keyword: searchParams.get("keyword") || "",
      mailbox: searchParams.get("mailbox") || "",
      sender: searchParams.get("sender") || "",
      recipient: searchParams.get("recipient") || "",
      subject: searchParams.get("subject") || "",
      folder: searchParams.get("folder") || "",
      dateFrom: searchParams.get("dateFrom") || "",
      dateTo: searchParams.get("dateTo") || "",
      sizeMin: searchParams.get("sizeMin") || "",
      sizeMax: searchParams.get("sizeMax") || "",
      page: searchParams.get("page") || "1",
      pageSize: searchParams.get("pageSize") || "50",
    };

    const data = await searchEmails(filters);
    const user = getRequestUser(request);

    await writeAuditLog({
      user,
      action: "email_search",
      entityType: "email_messages",
      ipAddress: request.headers.get("x-forwarded-for"),
      metadata: {
        filters,
        total: data.total,
        page: data.page,
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    logError("GET /api/emails/search", error);
    return NextResponse.json(
      { error: "Impossible de rechercher les emails." },
      { status: 500 },
    );
  }
}
