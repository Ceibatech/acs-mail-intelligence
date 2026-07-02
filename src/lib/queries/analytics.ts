import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/lib/db";

function numberValue(value: unknown) {
  return Number(value || 0);
}

let analyticsCache: AnalyticsResponse | null = null;
let analyticsCacheTimestamp = 0;
const ANALYTICS_CACHE_TTL = 15_000;

type Category = {
  key: string;
  category: string;
  label: string;
  total: number;
  last7Days: number;
  last30Days: number;
  trend: Array<{ month: string; total: number }>;
};

type AnalyticsResponse = {
  categories: Category[];
  topMailboxesForSinistres: Array<{ email_address: string; total: number }>;
  topSendersForReclamations: Array<{ from_header: string; total: number }>;
  pendingFollowups: Array<Record<string, string | number>>;
  urgentEmails: Array<Record<string, string | number | null>>;
  inactiveMailboxes: Array<Record<string, string | number | null>>;
  highVolumeSenders: Array<Record<string, string | number | null>>;
};

export async function getInsuranceAnalytics(): Promise<AnalyticsResponse> {
  if (analyticsCache && Date.now() - analyticsCacheTimestamp < ANALYTICS_CACHE_TTL) {
    return analyticsCache;
  }

  const rows = await queryRows<
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
  );

  const result: AnalyticsResponse = {
    categories: rows.map((row) => ({
      key: row.category,
      category: row.category,
      label: row.label,
      total: numberValue(row.total),
      last7Days: numberValue(row.last_7_days),
      last30Days: numberValue(row.last_30_days),
      trend: [],
    })),
    topMailboxesForSinistres: [],
    topSendersForReclamations: [],
    pendingFollowups: [],
    urgentEmails: [],
    inactiveMailboxes: [],
    highVolumeSenders: [],
  };

  analyticsCache = result;
  analyticsCacheTimestamp = Date.now();
  return result;
}
