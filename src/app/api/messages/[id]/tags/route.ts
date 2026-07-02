import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { createMessageTag } from "@/lib/queries/emails";
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

    if (!body.tag || typeof body.tag !== "string") {
      return NextResponse.json({ error: "Tag obligatoire." }, { status: 400 });
    }

    const result = await createMessageTag({
      messageId: id,
      tag: body.tag,
      category: body.category || body.tag,
      source: user.email,
    });

    await writeAuditLog({
      user,
      action: "message_tag_create",
      entityType: "email_messages",
      entityId: id,
      ipAddress: request.headers.get("x-forwarded-for"),
      metadata: { tag: body.tag, saved: result.saved },
    });

    return NextResponse.json(result, { status: result.saved ? 201 : 202 });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    logError("POST /api/messages/[id]/tags", error);
    return NextResponse.json(
      { error: "Impossible d'ajouter le tag." },
      { status: 500 },
    );
  }
}
