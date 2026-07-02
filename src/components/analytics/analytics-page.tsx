"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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

  const recentRows = useMemo(
    () =>
      (data?.categories || []).map((category) => ({
        label: category.label,
        "7 jours": category.last7Days,
        "30 jours": category.last30Days,
      })),
    [data],
  );

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
        description="Indicateurs courtier lus depuis les tables cache pré-calculées."
        title="Analyse courtier"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          description="Catégorie la plus volumineuse"
          icon={BarChart3}
          title="Signal dominant"
          value={maxCategory?.label || "-"}
        />
        <StatCard
          description="Somme des catégories cache"
          icon={TrendingUp}
          title="30 derniers jours"
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
            <CardTitle>Activité récente</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={recentRows}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" interval={0} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(value) => formatNumber(value)} width={70} />
                <Tooltip />
                <Bar dataKey="7 jours" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="30 jours" fill="#b7791f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Catégories assurance</CardTitle>
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
