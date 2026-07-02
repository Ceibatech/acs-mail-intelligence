"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCw, TrendingUp } from "lucide-react";
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
import { formatNumber } from "@/lib/format";

type Category = {
  key: string;
  category: string;
  label: string;
  total: number;
  last7Days: number;
  last30Days: number;
};

type AnalyticsResponse = {
  categories: Category[];
};

const TOP_CHART_LIMIT = 6;

function compactLabel(label: string) {
  return label.length > 28 ? `${label.slice(0, 25)}...` : label;
}

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

  const topCategoryRows = useMemo(
    () =>
      (data?.categories || [])
        .slice()
        .sort((a, b) => b.total - a.total)
        .slice(0, TOP_CHART_LIMIT)
        .map((category) => ({
          label: category.label,
          total: category.total,
        })),
    [data],
  );

  const topRecentRows = useMemo(() => {
    const categories = data?.categories || [];
    const hasRecentActivity = categories.some(
      (category) => category.last7Days > 0 || category.last30Days > 0,
    );

    return categories
      .slice()
      .sort((a, b) => {
        if (!hasRecentActivity) return b.total - a.total;
        return b.last30Days + b.last7Days - (a.last30Days + a.last7Days);
      })
      .slice(0, TOP_CHART_LIMIT)
      .map((category) => ({
        label: category.label,
        "7 jours": category.last7Days,
        "30 jours": category.last30Days,
        total: hasRecentActivity ? category.last30Days : category.total,
      }));
  }, [data]);

  if (loading) return <LoadingState label="Chargement de l'analyse courtier..." />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const maxCategory = data.categories.reduce<Category | null>(
    (current, category) =>
      !current || category.total > current.total ? category : current,
    null,
  );

  const recentTotal = data.categories.reduce(
    (total, category) => total + category.last30Days,
    0,
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
        description="Lecture métier des demandes assurance : sinistres, devis, attestations, réclamations et conformité."
        title="Priorités courtage"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          description="Catégorie la plus volumineuse"
          icon={BarChart3}
          title="Priorité dominante"
          value={maxCategory?.label || "-"}
        />
        <StatCard
          description="Volume qualifié par catégorie"
          icon={TrendingUp}
          title="Activité récente"
          value={formatNumber(recentTotal)}
        />
        {data.categories.slice(0, 2).map((category) => (
          <StatCard
            description={`${formatNumber(category.last30Days)} sur 30 jours`}
            icon={BarChart3}
            key={category.key}
            title={category.label}
            value={formatNumber(category.total)}
          />
        ))}
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top {TOP_CHART_LIMIT} priorités courtage</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedBarList
              rows={topCategoryRows.map((row) => ({
                label: row.label,
                value: row.total,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top {TOP_CHART_LIMIT} signaux récents</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedBarList
              rows={topRecentRows.map((row) => ({
                label: row.label,
                value: row.total,
              }))}
              tone="gold"
            />
          </CardContent>
        </Card>
      </section>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Lecture détaillée des priorités</CardTitle>
        </CardHeader>
        <CardContent>
          {data.categories.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">7 jours</TableHead>
                  <TableHead className="text-right">30 jours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.categories.map((category) => (
                  <TableRow key={category.key}>
                    <TableCell>{category.label}</TableCell>
                    <TableCell className="metric-number text-right">
                      {formatNumber(category.total)}
                    </TableCell>
                    <TableCell className="metric-number text-right">
                      {formatNumber(category.last7Days)}
                    </TableCell>
                    <TableCell className="metric-number text-right">
                      {formatNumber(category.last30Days)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              description="La table dashboard_insurance_categories ne contient pas encore de lignes."
              title="Aucune catégorie disponible"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RankedBarList({
  rows,
  tone = "green",
}: {
  rows: Array<{ label: string; value: number }>;
  tone?: "green" | "gold";
}) {
  const maxValue = Math.max(...rows.map((row) => row.value), 1);
  const barClass = tone === "gold" ? "bg-amber-600" : "bg-primary";

  return (
    <div className="space-y-4">
      {rows.map((row, index) => {
        const width = `${Math.max(8, Math.round((row.value / maxValue) * 100))}%`;

        return (
          <div key={`${row.label}-${index}`} className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-700">
                  {index + 1}
                </span>
                <span className="truncate text-sm font-medium text-slate-800">
                  {compactLabel(row.label)}
                </span>
              </div>
              <span className="metric-number shrink-0 text-sm font-semibold text-slate-900">
                {formatNumber(row.value)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${barClass}`} style={{ width }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
