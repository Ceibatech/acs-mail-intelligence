import type { RowDataPacket } from "mysql2/promise";
import { queryOne, queryRows, tableExists } from "@/lib/db";
import type { DashboardSummary } from "@/types/dashboard";

type CountRow = RowDataPacket & { total: number };

function toNumber(value: unknown) {
  return Number(value || 0);
}

let dashboardCache: DashboardSummary | null = null;
let dashboardCacheTimestamp = 0;
const DASHBOARD_CACHE_TTL = 10_000;

export async function getDashboardSummary(): Promise<DashboardSummary> {
  if (dashboardCache && Date.now() - dashboardCacheTimestamp < DASHBOARD_CACHE_TTL) {
    return dashboardCache;
  }

  const [
    totalEmails,
    totalMailboxes,
    importedToday,
    importedLast7Days,
    importedLast30Days,
    lastDates,
    monthlyVolume,
    yearlyVolume,
    volumeByDay,
    topMailboxes,
    topSenders,
    topRecipients,
  ] = await Promise.all([
    queryOne<CountRow>("SELECT COUNT(*) AS total FROM email_messages"),
    queryOne<CountRow>("SELECT COUNT(*) AS total FROM mailboxes"),
    queryOne<CountRow>(
      `
      SELECT COUNT(*) AS total
      FROM email_messages
      WHERE DATE(imported_at) = CURDATE()
      `,
    ),
    queryOne<CountRow>(
      `
      SELECT COUNT(*) AS total
      FROM email_messages
      WHERE imported_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      `,
    ),
    queryOne<CountRow>(
      `
      SELECT COUNT(*) AS total
      FROM email_messages
      WHERE imported_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `,
    ),
    queryOne<RowDataPacket & { lastEmailDate: string | null; latestImportedAt: string | null }>(
      `
      SELECT
        MAX(email_date) AS lastEmailDate,
        MAX(imported_at) AS latestImportedAt
      FROM email_messages
      `,
    ),
    queryRows<RowDataPacket & { month: string; total: number }>(
      `
      SELECT
        DATE_FORMAT(COALESCE(email_date, imported_at), '%Y-%m') AS month,
        COUNT(*) AS total
      FROM email_messages
      GROUP BY month
      ORDER BY month DESC
      LIMIT 24
      `,
    ),
    queryRows<RowDataPacket & { year: string; total: number }>(
      `
      SELECT
        DATE_FORMAT(COALESCE(email_date, imported_at), '%Y') AS year,
        COUNT(*) AS total
      FROM email_messages
      GROUP BY year
      ORDER BY year DESC
      LIMIT 10
      `,
    ),
    queryRows<RowDataPacket & { day: string; total: number }>(
      `
      SELECT
        DATE_FORMAT(imported_at, '%Y-%m-%d') AS day,
        COUNT(*) AS total
      FROM email_messages
      WHERE imported_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY day
      ORDER BY day ASC
      `,
    ),
    queryRows<RowDataPacket & { email_address: string; total: number }>(
      `
      SELECT
        m.email_address,
        COUNT(e.id) AS total
      FROM mailboxes m
      JOIN email_messages e ON e.mailbox_id = m.id
      GROUP BY m.email_address
      ORDER BY total DESC
      LIMIT 10
      `,
    ),
    queryRows<RowDataPacket & { from_header: string; total: number }>(
      `
      SELECT
        from_header,
        COUNT(*) AS total
      FROM email_messages
      WHERE from_header IS NOT NULL AND from_header <> ''
      GROUP BY from_header
      ORDER BY total DESC
      LIMIT 10
      `,
    ),
    queryRows<RowDataPacket & { to_header: string; total: number }>(
      `
      SELECT
        to_header,
        COUNT(*) AS total
      FROM email_messages
      WHERE to_header IS NOT NULL AND to_header <> ''
      GROUP BY to_header
      ORDER BY total DESC
      LIMIT 10
      `,
    ),
  ]);

  const hasEtlRuns = await tableExists("etl_runs");
  const hasEtlErrors = await tableExists("etl_errors");

  const latestEtlRun = hasEtlRuns
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
          log_path
        FROM etl_runs
        ORDER BY started_at DESC
        LIMIT 1
        `,
      )
    : null;

  const etlErrorsCount = hasEtlErrors
    ? await queryOne<CountRow>("SELECT COUNT(*) AS total FROM etl_errors")
    : null;

  const result: DashboardSummary = {
    totalEmails: toNumber(totalEmails?.total),
    totalMailboxes: toNumber(totalMailboxes?.total),
    importedToday: toNumber(importedToday?.total),
    importedLast7Days: toNumber(importedLast7Days?.total),
    importedLast30Days: toNumber(importedLast30Days?.total),
    lastEmailDate: lastDates?.lastEmailDate ?? null,
    latestImportedAt: lastDates?.latestImportedAt ?? null,
    latestEtlRun: latestEtlRun ? { ...latestEtlRun } : null,
    etlErrorsCount: toNumber(etlErrorsCount?.total),
    monthlyVolume: monthlyVolume.reverse().map((row) => ({
      month: row.month,
      total: toNumber(row.total),
    })),
    yearlyVolume: yearlyVolume.reverse().map((row) => ({
      year: row.year,
      total: toNumber(row.total),
    })),
    volumeByDay: volumeByDay.map((row) => ({
      day: row.day,
      total: toNumber(row.total),
    })),
    topMailboxes: topMailboxes.map((row) => ({
      email_address: row.email_address,
      total: toNumber(row.total),
    })),
    topSenders: topSenders.map((row) => ({
      from_header: row.from_header,
      total: toNumber(row.total),
    })),
    topRecipients: topRecipients.map((row) => ({
      to_header: row.to_header,
      total: toNumber(row.total),
    })),
  };

  dashboardCache = result;
  dashboardCacheTimestamp = Date.now();
  return result;
}
