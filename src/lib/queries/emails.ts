import type { RowDataPacket } from "mysql2/promise";
import { columnExists, getDb, queryOne, queryRows, tableExists } from "@/lib/db";
import {
  clampPage,
  clampPageSize,
  likeValue,
  normalizeDateInput,
  numberOrNull,
  type SqlValue,
} from "@/lib/sql";
import type {
  EmailDetail,
  EmailSearchResponse,
  EmailSearchRow,
  LinkedFollowup,
  MessageTag,
} from "@/types/email";

export type EmailSearchFilters = {
  keyword?: string;
  mailbox?: string;
  sender?: string;
  recipient?: string;
  subject?: string;
  folder?: string;
  dateFrom?: string;
  dateTo?: string;
  sizeMin?: string;
  sizeMax?: string;
  page?: string;
  pageSize?: string;
};

function pushLike(
  where: string[],
  values: SqlValue[],
  column: string,
  value?: string,
) {
  if (!value?.trim()) return;
  where.push(`${column} LIKE ? ESCAPE '\\\\'`);
  values.push(likeValue(value));
}

function buildSearchWhere(filters: EmailSearchFilters) {
  const where: string[] = [];
  const values: SqlValue[] = [];

  if (filters.keyword?.trim()) {
    const value = likeValue(filters.keyword);
    where.push(`(
      e.subject LIKE ? ESCAPE '\\\\'
      OR e.from_header LIKE ? ESCAPE '\\\\'
      OR e.to_header LIKE ? ESCAPE '\\\\'
      OR e.body_text LIKE ? ESCAPE '\\\\'
    )`);
    values.push(value, value, value, value);
  }

  if (filters.mailbox?.trim()) {
    where.push("m.email_address = ?");
    values.push(filters.mailbox.trim());
  }

  pushLike(where, values, "e.from_header", filters.sender);
  pushLike(where, values, "e.to_header", filters.recipient);
  pushLike(where, values, "e.subject", filters.subject);

  if (filters.folder?.trim()) {
    where.push("e.folder = ?");
    values.push(filters.folder.trim());
  }

  const dateFrom = normalizeDateInput(filters.dateFrom || null);
  const dateTo = normalizeDateInput(filters.dateTo || null);
  const sizeMin = numberOrNull(filters.sizeMin || null);
  const sizeMax = numberOrNull(filters.sizeMax || null);

  if (dateFrom) {
    where.push("DATE(COALESCE(e.email_date, e.imported_at)) >= ?");
    values.push(dateFrom);
  }

  if (dateTo) {
    where.push("DATE(COALESCE(e.email_date, e.imported_at)) <= ?");
    values.push(dateTo);
  }

  if (sizeMin !== null) {
    where.push("e.size_bytes >= ?");
    values.push(sizeMin);
  }

  if (sizeMax !== null) {
    where.push("e.size_bytes <= ?");
    values.push(sizeMax);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    values,
  };
}

export async function searchEmails(
  filters: EmailSearchFilters,
): Promise<EmailSearchResponse> {
  const page = clampPage(filters.page || null);
  const pageSize = clampPageSize(filters.pageSize || null);
  const offset = (page - 1) * pageSize;
  const { whereSql, values } = buildSearchWhere(filters);

  const rows = await queryRows<RowDataPacket & EmailSearchRow>(
    `
    SELECT
      e.id,
      m.email_address AS mailbox,
      e.folder,
      e.email_date,
      e.imported_at,
      e.from_header,
      e.to_header,
      e.subject,
      e.size_bytes
    FROM email_messages e
    JOIN mailboxes m ON m.id = e.mailbox_id
    ${whereSql}
    ORDER BY COALESCE(e.email_date, e.imported_at) DESC, e.id DESC
    LIMIT ? OFFSET ?
    `,
    [...values, pageSize, offset],
  );

  const countRow = await queryOne<RowDataPacket & { total: number }>(
    `
    SELECT COUNT(*) AS total
    FROM email_messages e
    JOIN mailboxes m ON m.id = e.mailbox_id
    ${whereSql}
    `,
    values,
  );

  const total = Number(countRow?.total || 0);

  return {
    rows: rows.map((row) => ({
      id: Number(row.id),
      mailbox: row.mailbox,
      folder: row.folder,
      email_date: row.email_date,
      imported_at: row.imported_at,
      from_header: row.from_header,
      to_header: row.to_header,
      subject: row.subject,
      size_bytes: row.size_bytes,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
  };
}

async function getBodyFromMessageDuplicate(
  messageId: string | null,
  currentMessageId: number,
) {
  if (!messageId?.trim()) return null;

  return queryOne<
    RowDataPacket &
      Pick<
        EmailDetail,
        | "body_text"
        | "body_html"
        | "body_preview"
        | "body_length"
        | "extraction_status"
        | "body_source_message_id"
      >
  >(
    `
    SELECT
      b.body_text,
      b.body_html,
      b.body_preview,
      b.body_length,
      b.extraction_status,
      b.message_id AS body_source_message_id
    FROM email_messages e
    JOIN email_message_bodies b ON b.message_id = e.id
    WHERE e.message_id = ?
      AND e.id <> ?
      AND (
        CHAR_LENGTH(TRIM(COALESCE(b.body_text, ''))) > 0
        OR CHAR_LENGTH(TRIM(COALESCE(b.body_html, ''))) > 0
        OR CHAR_LENGTH(TRIM(COALESCE(b.body_preview, ''))) > 0
      )
    ORDER BY b.body_length DESC, b.message_id ASC
    LIMIT 1
    `,
    [messageId, currentMessageId],
  );
}

export async function getEmailDetail(id: string, includeRawPath: boolean) {
  const rows = await queryRows<RowDataPacket & EmailDetail>(
    `
    SELECT
      e.id,
      e.subject,
      e.from_header,
      e.to_header,
      e.cc_header,
      e.bcc_header,
      e.email_date,
      e.imported_at,
      e.folder,
      e.size_bytes,
      e.message_id,
      m.email_address AS mailbox,
      b.body_text,
      b.body_html,
      b.body_preview,
      b.body_length,
      b.extraction_status,
      b.message_id AS body_source_message_id,
      e.body_text AS legacy_body_text,
      e.has_body,
      e.raw_path
    FROM email_messages e
    JOIN mailboxes m ON m.id = e.mailbox_id
    LEFT JOIN email_message_bodies b ON b.message_id = e.id
    WHERE e.id = ?
    LIMIT 1
    `,
    [id],
  );

  if (!rows.length) return null;
  const row = rows[0];
  const fallbackBody =
    row.body_text?.trim() || row.body_html?.trim() || row.body_preview?.trim()
      ? null
      : await getBodyFromMessageDuplicate(row.message_id, Number(row.id));
  const legacyBodyText = (row as typeof row & { legacy_body_text?: string | null })
    .legacy_body_text;
  const legacyBody = legacyBodyText?.trim()
    ? {
        body_text: legacyBodyText,
        body_html: null,
        body_preview: legacyBodyText.replace(/\s+/g, " ").trim().slice(0, 500),
        body_length: legacyBodyText.length,
        extraction_status: "legacy_email_messages",
        body_source_message_id: Number(row.id),
      }
    : null;
  const rowHasBody = Boolean(
    row.body_text?.trim() || row.body_html?.trim() || row.body_preview?.trim(),
  );
  const body = fallbackBody || (rowHasBody ? row : legacyBody) || row;
  const hasBody =
    row.has_body ||
    Boolean(body.body_text?.trim() || body.body_html?.trim() || body.body_preview?.trim());

  const email: EmailDetail = {
    id: Number(row.id),
    mailbox: row.mailbox,
    folder: row.folder,
    message_id: row.message_id,
    subject: row.subject,
    from_header: row.from_header,
    to_header: row.to_header,
    cc_header: row.cc_header,
    bcc_header: row.bcc_header,
    email_date: row.email_date,
    imported_at: row.imported_at,
    size_bytes: row.size_bytes,
    body_text: body.body_text,
    body_html: body.body_html,
    body_preview: body.body_preview,
    body_length: body.body_length,
    extraction_status: body.extraction_status,
    body_source_message_id: body.body_source_message_id
      ? Number(body.body_source_message_id)
      : null,
    has_body: hasBody,
    raw_path: includeRawPath ? row.raw_path : undefined,
    tags: [],
    followups: [],
  };

  if (await tableExists("email_tags")) {
    const tagSourceSelect = (await columnExists("email_tags", "tag_source"))
      ? "tag_source"
      : "NULL AS tag_source";

    email.tags = await queryRows<RowDataPacket & MessageTag>(
      `
      SELECT id, tag, category, confidence, ${tagSourceSelect}, created_at
      FROM email_tags
      WHERE message_id = ?
      ORDER BY created_at DESC
      `,
      [id],
    );
  }

  if (await tableExists("followups")) {
    const titleSelect = (await columnExists("followups", "title"))
      ? "title"
      : "subject AS title";

    email.followups = await queryRows<RowDataPacket & LinkedFollowup>(
      `
      SELECT
        id,
        ${titleSelect},
        client_name,
        status,
        priority,
        due_date,
        assigned_to,
        created_at
      FROM followups
      WHERE message_id = ?
      ORDER BY created_at DESC
      `,
      [id],
    );
  }

  return email;
}

export async function createMessageTag({
  messageId,
  tag,
  category,
  source,
}: {
  messageId: string;
  tag: string;
  category?: string | null;
  source: string;
}) {
  if (!(await tableExists("email_tags"))) {
    return { saved: false, reason: "La table email_tags n'existe pas." };
  }

  const columns = ["message_id", "tag", "category"];
  const placeholders = ["?", "?", "?"];
  const values: SqlValue[] = [messageId, tag, category || tag];

  if (await columnExists("email_tags", "confidence")) {
    columns.push("confidence");
    placeholders.push("?");
    values.push(1);
  }

  if (await columnExists("email_tags", "tag_source")) {
    columns.push("tag_source");
    placeholders.push("?");
    values.push(source);
  }

  if (await columnExists("email_tags", "created_at")) {
    columns.push("created_at");
    placeholders.push("NOW()");
  }

  const [result] = await getDb().execute(
    `
    INSERT INTO email_tags
      (${columns.join(", ")})
    VALUES (${placeholders.join(", ")})
    `,
    values,
  );

  return { saved: true, result };
}

export async function shareMessageMetadata({
  messageId,
  sharedBy,
  sharedTo,
  shareChannel,
  status,
  note,
}: {
  messageId: string;
  sharedBy: string;
  sharedTo: string;
  shareChannel: string;
  status?: string;
  note?: string | null;
}) {
  if (!(await tableExists("message_share_logs"))) {
    return { saved: false, reason: "La table message_share_logs n'existe pas." };
  }

  const [result] = await getDb().execute(
    `
    INSERT INTO message_share_logs
      (message_id, shared_by, shared_to, share_channel, status, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, NOW())
    `,
    [messageId, sharedBy, sharedTo, shareChannel, status || "prepared", note || null],
  );

  return { saved: true, result };
}
