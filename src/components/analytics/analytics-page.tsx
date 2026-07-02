"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, BarChart3, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
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
import { formatDateTime, formatNumber } from "@/lib/format";

type Category = {
  key: string;
  label: string;
  total: number;
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

const colors = [
  "var(--color-primary)",
  "#b7791f",
  "#2563eb",
  "#7c3aed",
  "#dc2626",
  "#0891b2",
  "#16a34a",
];

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/analytics/insurance", { cache: "no-store" });
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

  const trendRows = useMemo(() => {
    if (!data) return [];
    const byMonth = new Map<string, Record<string, string | number>>();
    for (const category of data.categories) {
      for (const point of category.trend) {
        const row = byMonth.get(point.month) || { month: point.month };
        row[category.key] = point.total;
        byMonth.set(point.month, row);
      }
    }

    return Array.from(byMonth.values()).sort((a, b) =>
      String(a.month).localeCompare(String(b.month)),
    );
  }, [data]);

  if (loading) return <LoadingState label="Chargement de l'analyse courtier..." />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const maxCategory = data.categories.reduce(
    (current, category) => (category.total > current.total ? category : current),
    data.categories[0],
  );

  return (
    <div>
      <PageHeader
        actions={
          <Button onClick={loadData} size="sm" variant="outline">
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </Button>
        }
        description="Analyse métier du flux email courtage : sinistres, devis, réclamations et priorités urgentes."
        title="Analyse courtier"
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="rounded-3xl border border-slate-200/10 bg-gradient-to-br from-cyan-950 via-slate-950 to-slate-900 text-white shadow-2xl shadow-slate-900/20">
          <div className="p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">Signal courtage</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Priorités action et opportunités email
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-cyan-100 sm:text-base">
              Cette page met en lumière les thèmes qui impactent les agents et les clients, sans perdre en lisibilité ni performance.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl bg-white/10 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-100">Top signal</p>
                <p className="mt-3 text-2xl font-semibold text-white">{data.categories[0]?.label || "-"}</p>
                <p className="mt-1 text-sm text-cyan-200">Catégorie la plus détectée</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-100">Urgence</p>
                <p className="mt-3 text-2xl font-semibold text-white">{formatNumber(data.urgentEmails.length)}</p>
                <p className="mt-1 text-sm text-cyan-200">emails urgents détectés</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="border border-slate-200/10 bg-white/95 p-6 shadow-sm">
          <CardHeader>
            <CardTitle>Résumé métier</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-700">
            <p>
              Des indicateurs créés pour le pilotage courtage : sinistres, réclamations et demandes prioritaires.
            </p>
            <ul className="space-y-3">
              <li className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3">
                <strong>Signal opérationnel</strong> : quelle catégorie guide l’action aujourd’hui.
              </li>
              <li className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3">
                <strong>Urgence</strong> : liste prioritaire d’emails à traiter immédiatement.
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.categories.slice(0, 4).map((category) => (
          <StatCard
            description="Détection par mots-clés"
            icon={BarChart3}
            key={category.key}
            title={category.label}
            value={formatNumber(category.total)}
          />
        ))}
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.categories.slice(4).map((category) => (
          <StatCard
            description="Détection par mots-clés"
            icon={BarChart3}
            key={category.key}
            title={category.label}
            value={formatNumber(category.total)}
          />
        ))}
        <StatCard
          description="Catégorie la plus fréquente"
          icon={AlertTriangle}
          title="Signal dominant"
          value={maxCategory?.label || "-"}
          tone="warning"
        />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Emails par catégorie</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={data.categories}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" interval={0} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(value) => formatNumber(value)} width={70} />
                <Tooltip />
                <Bar dataKey="total" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tendance mensuelle par catégorie</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer height="100%" width="100%">
              <LineChart data={trendRows}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(value) => formatNumber(value)} width={70} />
                <Tooltip />
                {data.categories.map((category, index) => (
                  <Line
                    dataKey={category.key}
                    dot={false}
                    key={category.key}
                    name={category.label}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    type="monotone"
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <SimpleTable
          columns={[
            { key: "email_address", label: "Boîte" },
            { key: "total", label: "Sinistres", align: "right" },
          ]}
          rows={data.topMailboxesForSinistres}
          title="Top boîtes pour sinistres"
        />
        <SimpleTable
          columns={[
            { key: "from_header", label: "Expéditeur" },
            { key: "total", label: "Réclamations", align: "right" },
          ]}
          rows={data.topSendersForReclamations}
          title="Top expéditeurs pour réclamations"
        />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Emails urgents détectés</CardTitle>
          </CardHeader>
          <CardContent>
            {data.urgentEmails.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sujet</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.urgentEmails.map((email) => (
                    <TableRow key={String(email.id)}>
                      <TableCell className="max-w-72 truncate">
                        <Link className="underline" href={`/emails/${email.id}`}>
                          {email.subject || "Sans sujet"}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDateTime(String(email.email_date || email.imported_at || ""))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="Aucune urgence détectée" />
            )}
          </CardContent>
        </Card>

        <SimpleTable
          columns={[
            { key: "email_address", label: "Boîte" },
            { key: "last_activity", label: "Dernière activité" },
          ]}
          rows={data.inactiveMailboxes}
          title="Boîtes inactives"
        />
        <SimpleTable
          columns={[
            { key: "from_header", label: "Expéditeur" },
            { key: "total", label: "Emails", align: "right" },
          ]}
          rows={data.highVolumeSenders}
          title="Expéditeurs à fort volume"
        />
      </section>
    </div>
  );
}

function SimpleTable({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: Array<Record<string, string | number | null>>;
  columns: Array<{ key: string; label: string; align?: "right" }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead
                    className={column.align === "right" ? "text-right" : undefined}
                    key={column.key}
                  >
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  {columns.map((column) => (
                    <TableCell
                      className={
                        column.align === "right"
                          ? "metric-number text-right"
                          : "max-w-72 truncate"
                      }
                      key={column.key}
                    >
                      {column.align === "right"
                        ? formatNumber(row[column.key])
                        : String(row[column.key] || "-")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState title="Aucune donnée" />
        )}
      </CardContent>
    </Card>
  );
}
