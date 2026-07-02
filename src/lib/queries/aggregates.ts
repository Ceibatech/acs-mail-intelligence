import type { RowDataPacket } from "mysql2/promise";
import { getDb } from "@/lib/db";

export async function ensureAggregatesTable() {
  await getDb().query(
    `
    CREATE TABLE IF NOT EXISTS analytics_aggregates (
      name VARCHAR(128) PRIMARY KEY,
      payload JSON NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
  );
}

export async function upsertAggregate(name: string, payload: unknown) {
  await ensureAggregatesTable();
  const payloadText = JSON.stringify(payload);
  await getDb().query(
    `INSERT INTO analytics_aggregates (name, payload) VALUES (?, CAST(? AS JSON)) ON DUPLICATE KEY UPDATE payload = CAST(? AS JSON), updated_at = NOW()`,
    [name, payloadText, payloadText],
  );
}

export async function getAggregate(
  name: string,
): Promise<{ payload: unknown; updated_at: string } | null> {
  await ensureAggregatesTable();
  const [rows] = await getDb().query<RowDataPacket[]>(
    `SELECT payload, updated_at FROM analytics_aggregates WHERE name = ? LIMIT 1`,
    [name],
  );
  const row = rows[0];
  if (!row) return null;
  return { payload: row.payload, updated_at: String(row.updated_at) };
}
