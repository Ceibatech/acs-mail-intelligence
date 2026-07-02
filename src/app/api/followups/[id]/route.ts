import { NextRequest, NextResponse } from "next/server";
import { canCreateFollowups, getRequestUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { updateFollowup } from "@/lib/queries/followups";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = getRequestUser(request);
    if (!canCreateFollowups(user.role)) {
      return NextResponse.json(
        { error: "Droits insuffisants pour modifier une relance." },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    const body = await request.json();
    const result = await updateFollowup(id, body);

    await writeAuditLog({
      user,
      action: "followup_update",
      entityType: "followups",
      entityId: id,
      ipAddress: request.headers.get("x-forwarded-for"),
      metadata: body,
    });

    return NextResponse.json(result);
  } catch (error) {
    logError("PATCH /api/followups/[id]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Modification impossible." },
      { status: 500 },
    );
  }
}
