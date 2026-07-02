import { NextRequest, NextResponse } from "next/server";
import { canCreateFollowups, getRequestUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { createFollowup, listFollowups } from "@/lib/queries/followups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await listFollowups({
      status: searchParams.get("status") || "",
      priority: searchParams.get("priority") || "",
      assignedTo: searchParams.get("assignedTo") || "",
      clientName: searchParams.get("clientName") || "",
      dueFrom: searchParams.get("dueFrom") || "",
      dueTo: searchParams.get("dueTo") || "",
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Impossible de charger les relances." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getRequestUser(request);
    if (!canCreateFollowups(user.role)) {
      return NextResponse.json(
        { error: "Droits insuffisants pour créer une relance." },
        { status: 403 },
      );
    }

    const body = await request.json();
    if (!body.title || typeof body.title !== "string") {
      return NextResponse.json(
        { error: "Le titre de la relance est obligatoire." },
        { status: 400 },
      );
    }

    const result = await createFollowup({
      message_id: body.message_id ? Number(body.message_id) : null,
      mailbox_id: body.mailbox_id ? Number(body.mailbox_id) : null,
      client_name: body.client_name || null,
      title: body.title,
      description: body.description || null,
      status: body.status || "open",
      priority: body.priority || "medium",
      due_date: body.due_date || null,
      assigned_to: body.assigned_to || null,
      created_by: user.email,
    });

    await writeAuditLog({
      user,
      action: "followup_create",
      entityType: "followups",
      entityId: result.id,
      ipAddress: request.headers.get("x-forwarded-for"),
      metadata: { message_id: body.message_id || null },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Création impossible." },
      { status: 500 },
    );
  }
}
