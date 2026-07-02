import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getDb, queryOne, queryRows, tableExists } from "@/lib/db";
import { likeValue, normalizeDateInput, type SqlValue } from "@/lib/sql";
import type { FollowupRow, FollowupSummary } from "@/types/followup";

export type FollowupFilters = {
  status?: string;
  priority?: string;
  assignedTo?: string;
  clientName?: string;
  dueFrom?: string;
  dueTo?: string;
};

export type FollowupCreateInput = {
  message_id?: number | null;
  mailbox_id?: number | null;
  client_name?: string | null;
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  due_date?: string | null;
  assigned_to?: string | null;
  created_by: string;
};

function buildWhere(filters: FollowupFilters) {
  const where: string[] = [];
  const values: SqlValue[] = [];

  if (filters.status?.trim()) {
    where.push("f.status = ?");
    values.push(filters.status.trim());
  }

  if (filters.priority?.trim()) {
    where.push("f.priority = ?");
    values.push(filters.priority.trim());
  }

  if (filters.assignedTo?.trim()) {
    where.push("f.assigned_to LIKE ? ESCAPE '\\\\'");
    values.push(likeValue(filters.assignedTo));
  }

  if (filters.clientName?.trim()) {
    where.push("f.client_name LIKE ? ESCAPE '\\\\'");
    values.push(likeValue(filters.clientName));
  }

  const dueFrom = normalizeDateInput(filters.dueFrom || null);
  const dueTo = normalizeDateInput(filters.dueTo || null);

  if (dueFrom) {
    where.push("DATE(f.due_date) >= ?");
    values.push(dueFrom);
  }

  if (dueTo) {
    where.push("DATE(f.due_date) <= ?");
    values.push(dueTo);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    values,
  };
}

export async function listFollowups(filters: FollowupFilters) {
  if (!(await tableExists("followups"))) {
    return {
      tableAvailable: false,
      summary: {
        open: 0,
        overdue: 0,
        dueToday: 0,
        closed: 0,
        highPriority: 0,
      } satisfies FollowupSummary,
      rows: [] as FollowupRow[],
    };
  }

  const { whereSql, values } = buildWhere(filters);

  const [summary, rows] = await Promise.all([
    queryOne<RowDataPacket & FollowupSummary>(
      `
      SELECT
        SUM(CASE WHEN status <> 'closed' THEN 1 ELSE 0 END) AS open,
        SUM(CASE WHEN status <> 'closed' AND due_date < CURDATE() THEN 1 ELSE 0 END) AS overdue,
        SUM(CASE WHEN status <> 'closed' AND DATE(due_date) = CURDATE() THEN 1 ELSE 0 END) AS dueToday,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed,
        SUM(CASE WHEN status <> 'closed' AND priority IN ('high', 'urgent') THEN 1 ELSE 0 END) AS highPriority
      FROM followups
      `,
    ),
    queryRows<RowDataPacket & FollowupRow>(
      `
      SELECT
        f.id,
        f.message_id,
        f.mailbox_id,
        f.client_name,
        f.title,
        f.description,
        f.status,
        f.priority,
        f.due_date,
        f.assigned_to,
        f.created_by,
        f.created_at,
        f.updated_at,
        f.closed_at,
        e.subject AS linked_subject
      FROM followups f
      LEFT JOIN email_messages e ON e.id = f.message_id
      ${whereSql}
      ORDER BY
        CASE f.priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        f.due_date IS NULL,
        f.due_date ASC,
        f.created_at DESC
      LIMIT 200
      `,
      values,
    ),
  ]);

  return {
    tableAvailable: true,
    summary: {
      open: Number(summary?.open || 0),
      overdue: Number(summary?.overdue || 0),
      dueToday: Number(summary?.dueToday || 0),
      closed: Number(summary?.closed || 0),
      highPriority: Number(summary?.highPriority || 0),
    },
    rows,
  };
}

async function mailboxFromMessage(messageId?: number | null) {
  if (!messageId) return null;

  const row = await queryOne<RowDataPacket & { mailbox_id: number }>(
    "SELECT mailbox_id FROM email_messages WHERE id = ? LIMIT 1",
    [messageId],
  );

  return row?.mailbox_id ?? null;
}

export async function createFollowup(input: FollowupCreateInput) {
  if (!(await tableExists("followups"))) {
    throw new Error("La table followups n'existe pas dans la base.");
  }

  const mailboxId = input.mailbox_id ?? (await mailboxFromMessage(input.message_id));
  const [result] = await getDb().execute<ResultSetHeader>(
    `
    INSERT INTO followups
      (
        message_id,
        mailbox_id,
        client_name,
        title,
        description,
        status,
        priority,
        due_date,
        assigned_to,
        created_by,
        created_at,
        updated_at
      )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `,
    [
      input.message_id || null,
      mailboxId,
      input.client_name || null,
      input.title,
      input.description || null,
      input.status || "open",
      input.priority || "medium",
      input.due_date || null,
      input.assigned_to || null,
      input.created_by,
    ],
  );

  return { id: result.insertId };
}

export async function updateFollowup(id: string, updates: Record<string, unknown>) {
  if (!(await tableExists("followups"))) {
    throw new Error("La table followups n'existe pas dans la base.");
  }

  const allowed = [
    "client_name",
    "title",
    "description",
    "status",
    "priority",
    "due_date",
    "assigned_to",
  ];

  const assignments: string[] = [];
  const values: SqlValue[] = [];

  for (const field of allowed) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      assignments.push(`${field} = ?`);
      values.push((updates[field] as SqlValue) ?? null);
    }
  }

  if (updates.status === "closed") {
    assignments.push("closed_at = COALESCE(closed_at, NOW())");
  } else if (updates.status && updates.status !== "closed") {
    assignments.push("closed_at = NULL");
  }

  if (!assignments.length) return { updated: false };

  values.push(id);

  await getDb().execute(
    `
    UPDATE followups
    SET ${assignments.join(", ")}, updated_at = NOW()
    WHERE id = ?
    LIMIT 1
    `,
    values,
  );

  return { updated: true };
}
