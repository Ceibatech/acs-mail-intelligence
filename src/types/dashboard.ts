export type DashboardSummary = {
  totalEmails: number;
  totalMailboxes: number;
  importedToday: number;
  importedLast7Days: number;
  importedLast30Days: number;
  lastEmailDate: string | null;
  latestImportedAt: string | null;
  latestEtlRun: Record<string, unknown> | null;
  etlErrorsCount: number;
  monthlyVolume: Array<{ month: string; total: number }>;
  yearlyVolume: Array<{ year: string; total: number }>;
  volumeByDay: Array<{ day: string; total: number }>;
  topMailboxes: Array<{ email_address: string; total: number }>;
  topSenders: Array<{ from_header: string; total: number }>;
  topRecipients: Array<{ to_header: string; total: number }>;
};
