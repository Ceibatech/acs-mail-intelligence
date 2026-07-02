"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Archive,
  CalendarDays,
  Database,
  Inbox,
  Mail,
  RefreshCw,
  Timer,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ErrorState, LoadingState } from "@/components/data-state";
import { formatDateTime, formatNumber, relativeDate } from "@/lib/format";
import type { DashboardSummary } from "@/types/dashboard";

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">{formatNumber(payload[0].value)} emails</p>
    </div>
  );
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/dashboard/summary", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Chargement impossible.");
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erreur inconnue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  if (loading) return <LoadingState label="Chargement du tableau de bord..." />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  return (
    <div>
      <PageHeader
        actions={
          <Button onClick={loadData} size="sm" variant="outline">
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </Button>
        }
        description="Vue stratégique courtage assurance : volumes email, activité des boîtes et qualité des données."
        title="Tableau de bord Direction"
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-2xl shadow-slate-900/20">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
                Direction Assurance
              </span>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                Données prêtes. Action rapide.
              </div>
            </div>

            <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
              Pilotage email courtage haut niveau
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Les tables sont déjà remplies : exploite directement le volume email pour suivre sinistres, devis, réclamations et conformité.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Vision</p>
                <p className="mt-3 text-2xl font-semibold text-white">{formatNumber(data.totalEmails)}</p>
                <p className="mt-1 text-sm text-slate-300">emails indexés</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Équipe</p>
                <p className="mt-3 text-2xl font-semibold text-white">{formatNumber(data.totalMailboxes)}</p>
                <p className="mt-1 text-sm text-slate-300">boîtes suivies</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Qualité</p>
                <p className="mt-3 text-2xl font-semibold text-white">{formatNumber(data.etlErrorsCount)}</p>
                <p className="mt-1 text-sm text-slate-300">erreurs ETL</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="border border-slate-200/10 bg-white/95 p-6 shadow-sm">
          <CardHeader>
            <CardTitle>Focus métier</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-700">
            <p>
              Cette vue est conçue pour le senior analytics et la direction courtage : indicateurs métier, détenteurs de boîtes et qualité du flux email.
            </p>
            <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-1">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Flux métiers</p>
                <p className="mt-2 text-sm text-slate-600">Suivre les volumes, la santé des imports et les boîtes les plus actives.</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Qualité des données</p>
                <p className="mt-2 text-sm text-slate-600">Gardez un œil sur le statut ETL et les erreurs pour sécuriser vos décisions.</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Action rapide</p>
                <p className="mt-2 text-sm text-slate-600">Pas besoin d’aller dans l’exécution technique pour comprendre l’essentiel.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          description="Emails archivés utiles au pilotage courtage"
          icon={Archive}
          title="Total emails"
          value={formatNumber(data.totalEmails)}
        />
        <StatCard
          description="Boîtes de courtage actives et suivies"
          icon={Inbox}
          title="Boîtes mail"
          value={formatNumber(data.totalMailboxes)}
        />
        <StatCard
          description="Importés depuis minuit"
          icon={CalendarDays}
          title="Importés aujourd'hui"
          value={formatNumber(data.importedToday)}
        />
        <StatCard
          description="Résultat sur 30 jours"
          icon={Mail}
          title="Volume 30j"
          value={formatNumber(data.importedLast30Days)}
        />
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          description="Activité bureau de courtage sur 7 jours"
          icon={Timer}
          title="7 derniers jours"
          value={formatNumber(data.importedLast7Days)}
        />
        <StatCard
          description={formatDateTime(data.lastEmailDate)}
          icon={Mail}
          title="Dernier email daté"
          value={relativeDate(data.lastEmailDate)}
        />
        <StatCard
          description="Santé du pipeline ETL"
          icon={Database}
          title="Statut ETL"
          value={
            <StatusBadge value={(data.latestEtlRun?.status as string | undefined) || null} />
          }
          tone={data.latestEtlRun?.status === "failed" ? "danger" : "success"}
        />
        <StatCard
          description="Incidents ETL détectés"
          icon={AlertTriangle}
          title="Erreurs ETL"
          value={formatNumber(data.etlErrorsCount)}
          tone={data.etlErrorsCount > 0 ? "warning" : "success"}
        />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Volume email par mois</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer height="100%" width="100%">
              <AreaChart data={data.monthlyVolume}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} />
                <YAxis tickFormatter={(value) => formatNumber(value)} width={70} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  dataKey="total"
                  fill="var(--color-primary)"
                  fillOpacity={0.18}
                  stroke="var(--color-primary)"
                  type="monotone"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Messages importés par jour</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={data.volumeByDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tickLine={false} />
                <YAxis tickFormatter={(value) => formatNumber(value)} width={70} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="total" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-3">
        <TopTable
          labelField="email_address"
          rows={data.topMailboxes}
          title="Top boîtes actives"
        />
        <TopTable labelField="from_header" rows={data.topSenders} title="Top expéditeurs" />
        <TopTable
          labelField="to_header"
          rows={data.topRecipients}
          title="Top destinataires"
        />
      </section>
    </div>
  );
}

function TopTable({
  title,
  rows,
  labelField,
}: {
  title: string;
  rows: Array<Record<string, string | number>>;
  labelField: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Libellé</TableHead>
              <TableHead className="text-right">Emails</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={`${row[labelField]}-${index}`}>
                <TableCell className="max-w-64 truncate">{row[labelField]}</TableCell>
                <TableCell className="metric-number text-right">
                  {formatNumber(row.total)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
