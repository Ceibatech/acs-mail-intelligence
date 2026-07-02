import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { getEmailDetail, shareMessageMetadata } from "@/lib/queries/emails";
import { deliverMessageShare } from "@/lib/share-delivery";
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
    const sharedTo = String(body.shared_to || body.email || "").trim();

    if (!sharedTo) {
      return NextResponse.json(
        { error: "Le destinataire du partage est obligatoire." },
        { status: 400 },
      );
    }

    const email = await getEmailDetail(id, false);
    if (!email) {
      return NextResponse.json({ error: "Message introuvable." }, { status: 404 });
    }

    const delivery = await deliverMessageShare({
      email,
      sharedBy: user.email,
      sharedTo,
      note: body.note || null,
      detailUrl: new URL(`/emails/${id}`, request.url).toString(),
    });

    const result = await shareMessageMetadata({
      messageId: id,
      sharedBy: user.email,
      sharedTo,
      shareChannel: delivery.provider,
      status: delivery.status === "sent" ? "sent" : "prepared",
      note: body.note || null,
    });

    await writeAuditLog({
      user,
      action: "message_share_prepare",
      entityType: "email_messages",
      entityId: id,
      ipAddress: request.headers.get("x-forwarded-for"),
      metadata: {
        sharedTo,
        saved: result.saved,
        deliveryStatus: delivery.status,
        provider: delivery.provider,
        from: delivery.from,
      },
    });

    return NextResponse.json(
      {
        ...result,
        delivery,
        message:
          delivery.status === "sent"
            ? "Partage envoye."
            : "Brouillon email prepare.",
      },
      { status: delivery.status === "sent" ? 201 : 202 },
    );
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
