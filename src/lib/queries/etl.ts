import type { RowDataPacket } from "mysql2/promise";
import { queryOne, queryRows, tableExists } from "@/lib/db";

function numberValue(value: unknown) {
  return Number(value || 0);
}

export async function getEtlStatus() {
  const [hasRuns, hasErrors, hasRefreshRuns, hasDashboardKpis] = await Promise.all([
    tableExists("etl_runs"),
    tableExists("etl_errors"),
    tableExists("dashboard_refresh_runs"),
    tableExists("dashboard_kpis"),
  ]);

  const kpis = hasDashboardKpis
    ? await queryOne<
        RowDataPacket & {
          imported_today: number;
          latest_imported_at: string | null;
          latest_etl_status: string | null;
          etl_errors_count: number;
        }
      >(
        `
        SELECT imported_today, latest_imported_at, latest_etl_status, etl_errors_count
        FROM dashboard_kpis
        WHERE id = 1
        `,
      )
    : null;

  const latestRefreshRun = hasRefreshRuns
    ? await queryOne<RowDataPacket>(
        `
        SELECT id, status, started_at, finished_at, note, error_message
        FROM dashboard_refresh_runs
        ORDER BY id DESC
        LIMIT 1
        `,
      )
    : null;

  const refreshHistory = hasRefreshRuns
    ? await queryRows<RowDataPacket>(
        `
        SELECT id, status, started_at, finished_at, note, error_message
        FROM dashboard_refresh_runs
        ORDER BY id DESC
        LIMIT 25
        `,
      )
    : [];

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
      dashboard_kpis: hasDashboardKpis,
      dashboard_refresh_runs: hasRefreshRuns,
      etl_runs: hasRuns,
      etl_errors: hasErrors,
    },
    latestRun,
    latestIncrementalRun,
    latestRefreshRun,
    refreshHistory,
    lastImportedAt: kpis?.latest_imported_at ?? null,
    importedToday: numberValue(kpis?.imported_today),
    latestEtlStatus: kpis?.latest_etl_status ?? latestRefreshRun?.status ?? null,
    etlErrorsCount: numberValue(kpis?.etl_errors_count),
    errorsByType: errorsByType.map((row) => ({
      error_type: row.error_type,
      total: numberValue(row.total),
    })),
    latestErrors,
    runHistory,
  };
}
