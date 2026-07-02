import { NextRequest, NextResponse } from "next/server";
import { canViewRawPath, isAuthError, requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { getEmailDetail } from "@/lib/queries/emails";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const user = await requireRole(["manager", "analyst"], request);
    const email = await getEmailDetail(id, canViewRawPath(user.role));

    if (!email) {
      return NextResponse.json({ error: "Message introuvable." }, { status: 404 });
    }

    await writeAuditLog({
      user,
      action: "email_view",
      entityType: "email_messages",
      entityId: id,
      ipAddress: request.headers.get("x-forwarded-for"),
    });

    return NextResponse.json(email);
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    logError("GET /api/emails/[id]", error);
    return NextResponse.json(
      { error: "Impossible de charger le message." },
      { status: 500 },
    );
  }
}
