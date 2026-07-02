import type { RowDataPacket } from "mysql2/promise";
import { queryOne, queryRows } from "@/lib/db";
import type { DashboardSummary } from "@/types/dashboard";

function toNumber(value: unknown) {
  return Number(value || 0);
}

let dashboardCache: DashboardSummary | null = null;
let dashboardCacheTimestamp = 0;
const DASHBOARD_CACHE_TTL = 10_000;

type DashboardKpisRow = RowDataPacket & {
  total_emails: number;
  total_mailboxes: number;
  imported_today: number;
  imported_last_7_days: number;
  imported_last_30_days: number;
  last_email_date: string | null;
  latest_imported_at: string | null;
  latest_etl_status: string | null;
  etl_errors_count: number;
  refreshed_at: string | null;
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  if (dashboardCache && Date.now() - dashboardCacheTimestamp < DASHBOARD_CACHE_TTL) {
    return dashboardCache;
  }

  const [
    kpis,
    dailyVolume,
    monthlyVolume,
    yearlyVolume,
    topMailboxes,
    topSenders,
    topRecipients,
    categories,
    latestRefreshRuns,
  ] = await Promise.all([
    queryOne<DashboardKpisRow>(
      `
      SELECT *
      FROM dashboard_kpis
      WHERE id = 1
      `,
    ),
    queryRows<RowDataPacket & { volume_day: string; total: number }>(
      `
      SELECT volume_day, total
      FROM dashboard_daily_volume
      ORDER BY volume_day DESC
      LIMIT 30
      `,
    ),
    queryRows<RowDataPacket & { volume_month: string; total: number }>(
      `
      SELECT volume_month, total
      FROM dashboard_monthly_volume
      ORDER BY volume_month DESC
      LIMIT 24
      `,
    ),
    queryRows<RowDataPacket & { volume_year: number; total: number }>(
      `
      SELECT volume_year, total
      FROM dashboard_yearly_volume
      ORDER BY volume_year DESC
      LIMIT 10
      `,
    ),
    queryRows<
      RowDataPacket & {
        email_address: string;
        total: number;
        imported_last_30_days: number;
        last_email_date: string | null;
      }
    >(
      `
      SELECT email_address, total, imported_last_30_days, last_email_date
      FROM dashboard_mailbox_volume
      ORDER BY total DESC
      LIMIT 10
      `,
    ),
    queryRows<RowDataPacket & { sender: string; total: number; last_email_date: string | null }>(
      `
      SELECT sender, total, last_email_date
      FROM dashboard_top_senders
      ORDER BY total DESC
      LIMIT 10
      `,
    ),
    queryRows<
      RowDataPacket & { recipient: string; total: number; last_email_date: string | null }
    >(
      `
      SELECT recipient, total, last_email_date
      FROM dashboard_top_recipients
      ORDER BY total DESC
      LIMIT 10
      `,
    ),
    queryRows<
      RowDataPacket & {
        category: string;
        label: string;
        total: number;
        last_7_days: number;
        last_30_days: number;
      }
    >(
      `
      SELECT category, label, total, last_7_days, last_30_days
      FROM dashboard_insurance_categories
      ORDER BY total DESC
      `,
    ),
    queryRows<RowDataPacket>(
      `
      SELECT id, status, started_at, finished_at, note, error_message
      FROM dashboard_refresh_runs
      ORDER BY id DESC
      LIMIT 5
      `,
    ),
  ]);

  const latestRefreshRun = latestRefreshRuns[0] || null;
  const result: DashboardSummary = {
    totalEmails: toNumber(kpis?.total_emails),
    totalMailboxes: toNumber(kpis?.total_mailboxes),
    importedToday: toNumber(kpis?.imported_today),
    importedLast7Days: toNumber(kpis?.imported_last_7_days),
    importedLast30Days: toNumber(kpis?.imported_last_30_days),
    lastEmailDate: kpis?.last_email_date ?? null,
    latestImportedAt: kpis?.latest_imported_at ?? null,
    latestEtlRun: latestRefreshRun
      ? {
          ...latestRefreshRun,
          status: latestRefreshRun.status || kpis?.latest_etl_status || null,
        }
      : kpis?.latest_etl_status
        ? { status: kpis.latest_etl_status }
        : null,
    etlErrorsCount: toNumber(kpis?.etl_errors_count),
    monthlyVolume: monthlyVolume
      .slice()
      .reverse()
      .map((row) => ({
        month: String(row.volume_month).slice(0, 7),
        total: toNumber(row.total),
      })),
    yearlyVolume: yearlyVolume
      .slice()
      .reverse()
      .map((row) => ({
        year: String(row.volume_year),
        total: toNumber(row.total),
      })),
    volumeByDay: dailyVolume
      .slice()
      .reverse()
      .map((row) => ({
        day: String(row.volume_day).slice(0, 10),
        total: toNumber(row.total),
      })),
    topMailboxes: topMailboxes.map((row) => ({
      email_address: row.email_address,
      total: toNumber(row.total),
    })),
    topSenders: topSenders.map((row) => ({
      from_header: row.sender,
      total: toNumber(row.total),
    })),
    topRecipients: topRecipients.map((row) => ({
      to_header: row.recipient,
      total: toNumber(row.total),
    })),
    kpis: kpis ? { ...kpis } : null,
    categories: categories.map((row) => ({
      category: row.category,
      label: row.label,
      total: toNumber(row.total),
      last_7_days: toNumber(row.last_7_days),
      last_30_days: toNumber(row.last_30_days),
    })),
    latestRefreshRuns: latestRefreshRuns.map((row) => ({ ...row })),
  };

  dashboardCache = result;
  dashboardCacheTimestamp = Date.now();
  return result;
}
