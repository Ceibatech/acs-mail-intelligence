import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { shareMessageMetadata } from "@/lib/queries/emails";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const user = await requireRole(["manager", "analyst"], request);
    const body = await request.json();
    const sharedTo = body.shared_to || body.email;

    if (!sharedTo) {
      return NextResponse.json(
        { error: "Le destinataire du partage est obligatoire." },
        { status: 400 },
      );
    }

    const result = await shareMessageMetadata({
      messageId: id,
      sharedBy: user.email,
      sharedTo,
      shareChannel: body.share_channel || "email",
      note: body.note || null,
    });

    await writeAuditLog({
      user,
      action: "message_share_prepare",
      entityType: "email_messages",
      entityId: id,
      ipAddress: request.headers.get("x-forwarded-for"),
      metadata: { sharedTo, saved: result.saved },
    });

    return NextResponse.json(result, { status: result.saved ? 201 : 202 });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    logError("POST /api/messages/[id]/share", error);
    return NextResponse.json(
      { error: "Impossible de préparer le partage." },
      { status: 500 },
    );
  }
}
