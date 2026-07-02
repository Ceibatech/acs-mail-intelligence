import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { columnExists, getDb, queryOne, queryRows, tableExists } from "@/lib/db";
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

type FollowupsSchema = {
  titleColumn: "title" | "subject";
  descriptionColumn: "description" | "notes" | null;
  hasCreatedBy: boolean;
  hasCreatedAt: boolean;
  hasUpdatedAt: boolean;
  hasClosedAt: boolean;
};

let followupsSchema: Promise<FollowupsSchema> | null = null;

async function getFollowupsSchema() {
  followupsSchema ??= Promise.all([
    columnExists("followups", "title"),
    columnExists("followups", "description"),
    columnExists("followups", "notes"),
    columnExists("followups", "created_by"),
    columnExists("followups", "created_at"),
    columnExists("followups", "updated_at"),
    columnExists("followups", "closed_at"),
  ]).then(
    ([
      hasTitle,
      hasDescription,
      hasNotes,
      hasCreatedBy,
      hasCreatedAt,
      hasUpdatedAt,
      hasClosedAt,
    ]) => ({
      titleColumn: hasTitle ? "title" : "subject",
      descriptionColumn: hasDescription ? "description" : hasNotes ? "notes" : null,
      hasCreatedBy,
      hasCreatedAt,
      hasUpdatedAt,
      hasClosedAt,
    }),
  );

  return followupsSchema;
}

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
  const schema = await getFollowupsSchema();
  const titleSelect =
    schema.titleColumn === "title" ? "f.title" : "f.subject";
  const descriptionSelect = schema.descriptionColumn
    ? `f.${schema.descriptionColumn}`
    : "NULL";
  const createdBySelect = schema.hasCreatedBy ? "f.created_by" : "NULL";
  const updatedAtSelect = schema.hasUpdatedAt ? "f.updated_at" : "NULL";
  const closedAtSelect = schema.hasClosedAt ? "f.closed_at" : "NULL";

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
        ${titleSelect} AS title,
        ${descriptionSelect} AS description,
        f.status,
        f.priority,
        f.due_date,
        f.assigned_to,
        ${createdBySelect} AS created_by,
        f.created_at,
        ${updatedAtSelect} AS updated_at,
        ${closedAtSelect} AS closed_at,
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
  const schema = await getFollowupsSchema();
  const columns = [
    "message_id",
    "mailbox_id",
    "client_name",
    schema.titleColumn,
    "status",
    "priority",
    "due_date",
    "assigned_to",
  ];
  const placeholders = ["?", "?", "?", "?", "?", "?", "?", "?"];
  const values: SqlValue[] = [
    input.message_id || null,
    mailboxId,
    input.client_name || null,
    input.title,
    input.status || "open",
    input.priority || "medium",
    input.due_date || null,
    input.assigned_to || null,
  ];

  if (schema.descriptionColumn) {
    columns.push(schema.descriptionColumn);
    placeholders.push("?");
    values.push(input.description || null);
  }

  if (schema.hasCreatedBy) {
    columns.push("created_by");
    placeholders.push("?");
    values.push(input.created_by);
  }

  if (schema.hasCreatedAt) {
    columns.push("created_at");
    placeholders.push("NOW()");
  }

  if (schema.hasUpdatedAt) {
    columns.push("updated_at");
    placeholders.push("NOW()");
  }

  const [result] = await getDb().execute<ResultSetHeader>(
    `
    INSERT INTO followups
      (${columns.join(", ")})
    VALUES (${placeholders.join(", ")})
    `,
    values,
  );

  return { id: result.insertId };
}

export async function updateFollowup(id: string, updates: Record<string, unknown>) {
  if (!(await tableExists("followups"))) {
    throw new Error("La table followups n'existe pas dans la base.");
  }

  const schema = await getFollowupsSchema();
  const fieldMap: Record<string, string | null> = {
    client_name: "client_name",
    title: schema.titleColumn,
    description: schema.descriptionColumn,
    status: "status",
    priority: "priority",
    due_date: "due_date",
    assigned_to: "assigned_to",
  };

  const assignments: string[] = [];
  const values: SqlValue[] = [];

  for (const field of Object.keys(fieldMap)) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      const column = fieldMap[field];
      if (!column) continue;
      assignments.push(`${column} = ?`);
      values.push((updates[field] as SqlValue) ?? null);
    }
  }

  if (schema.hasClosedAt && updates.status === "closed") {
    assignments.push("closed_at = COALESCE(closed_at, NOW())");
  } else if (schema.hasClosedAt && updates.status && updates.status !== "closed") {
    assignments.push("closed_at = NULL");
  }

  if (!assignments.length) return { updated: false };

  if (schema.hasUpdatedAt) {
    assignments.push("updated_at = NOW()");
  }

  values.push(id);

  await getDb().execute(
    `
    UPDATE followups
    SET ${assignments.join(", ")}
    WHERE id = ?
    LIMIT 1
    `,
    values,
  );

  return { updated: true };
}
