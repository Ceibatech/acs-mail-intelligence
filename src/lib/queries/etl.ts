import type { RowDataPacket } from "mysql2/promise";
import { queryOne, queryRows, tableExists } from "@/lib/db";

function numberValue(value: unknown) {
  return Number(value || 0);
}

export async function getEtlStatus() {
  const hasRuns = await tableExists("etl_runs");
  const hasErrors = await tableExists("etl_errors");

  const [latestImported, importedToday] = await Promise.all([
    queryOne<RowDataPacket & { latestImportedAt: string | null }>(
      "SELECT MAX(imported_at) AS latestImportedAt FROM email_messages",
    ),
    queryOne<RowDataPacket & { total: number }>(
      `
      SELECT COUNT(*) AS total
      FROM email_messages
      WHERE DATE(imported_at) = CURDATE()
      `,
    ),
  ]);

  const latestRun = hasRuns
    ? await queryOne<RowDataPacket>(
        `
        SELECT
          id,
          run_type,
          status,
          started_at,
          finished_at,
          processed_count,
          inserted_count,
          skipped_count,
          failed_count,
          note,
          log_path,
          TIMESTAMPDIFF(SECOND, started_at, COALESCE(finished_at, NOW())) AS duration_seconds
        FROM etl_runs
        ORDER BY started_at DESC
        LIMIT 1
        `,
      )
    : null;

  const latestIncrementalRun = hasRuns
    ? await queryOne<RowDataPacket>(
        `
        SELECT
          id,
          run_type,
          status,
          started_at,
          finished_at,
          processed_count,
          inserted_count,
          skipped_count,
          failed_count,
          note,
          TIMESTAMPDIFF(SECOND, started_at, COALESCE(finished_at, NOW())) AS duration_seconds
        FROM etl_runs
        WHERE run_type = 'incremental'
        ORDER BY started_at DESC
        LIMIT 1
        `,
      )
    : null;

  const runHistory = hasRuns
    ? await queryRows<RowDataPacket>(
        `
        SELECT
          id,
          run_type,
          status,
          started_at,
          finished_at,
          processed_count,
          inserted_count,
          skipped_count,
          failed_count,
          note,
          TIMESTAMPDIFF(SECOND, started_at, COALESCE(finished_at, NOW())) AS duration_seconds
        FROM etl_runs
        ORDER BY started_at DESC
        LIMIT 25
        `,
      )
    : [];

  const errorsByType = hasErrors
    ? await queryRows<RowDataPacket & { error_type: string; total: number }>(
        `
        SELECT error_type, COUNT(*) AS total
        FROM etl_errors
        GROUP BY error_type
        ORDER BY total DESC
        LIMIT 10
        `,
      )
    : [];

  const latestErrors = hasErrors
    ? await queryRows<RowDataPacket>(
        `
        SELECT id, etl_run_id, raw_path, error_type, error_message, created_at
        FROM etl_errors
        ORDER BY created_at DESC
        LIMIT 25
        `,
      )
    : [];

  return {
    tables: {
      etl_runs: hasRuns,
      etl_errors: hasErrors,
    },
    latestRun,
    latestIncrementalRun,
    lastImportedAt: latestImported?.latestImportedAt ?? null,
    importedToday: numberValue(importedToday?.total),
    errorsByType: errorsByType.map((row) => ({
      error_type: row.error_type,
      total: numberValue(row.total),
    })),
    latestErrors,
    runHistory,
  };
}
