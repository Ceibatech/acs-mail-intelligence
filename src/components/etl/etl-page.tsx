"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, DatabaseZap, RefreshCw, Timer } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
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
import { formatDateTime, formatDurationMs, formatNumber, relativeDate } from "@/lib/format";

type EtlRun = {
  id: number;
  run_type: string | null;
  status: string | null;
  started_at: string | null;
  finished_at: string | null;
  processed_count: number | null;
  inserted_count: number | null;
  skipped_count: number | null;
  failed_count: number | null;
  note: string | null;
  duration_seconds: number | null;
};

type EtlStatus = {
  tables: { etl_runs: boolean; etl_errors: boolean };
  latestRun: EtlRun | null;
  latestIncrementalRun: EtlRun | null;
  lastImportedAt: string | null;
  importedToday: number;
  errorsByType: Array<{ error_type: string; total: number }>;
  latestErrors: Array<Record<string, string | number | null>>;
  runHistory: EtlRun[];
};

export function EtlPage() {
  const [data, setData] = useState<EtlStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/etl/status", { cache: "no-store" });
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

  if (loading) return <LoadingState label="Chargement du monitoring ETL..." />;
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
        description="Tableau de bord opérationnel pour l'administration : supervision des runs ETL, import et erreurs."
        title="Suivi ETL"
      />

      {!data.tables.etl_runs || !data.tables.etl_errors ? (
        <div className="mb-4">
          <EmptyState
            description="Certaines tables ETL optionnelles sont absentes. Les cartes basées sur email_messages restent disponibles."
            title="Tables ETL partielles"
          />
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          description="Dernier run connu"
          icon={DatabaseZap}
          title="Statut ETL"
          value={<StatusBadge value={data.latestRun?.status || null} />}
        />
        <StatCard
          description="Messages importés aujourd'hui"
          icon={DatabaseZap}
          title="Imports du jour"
          value={formatNumber(data.importedToday)}
        />
        <StatCard
          description={formatDateTime(data.lastImportedAt)}
          icon={Timer}
          title="Dernier import"
          value={relativeDate(data.lastImportedAt)}
        />
        <StatCard
          description="Types d'erreurs distincts"
          icon={AlertTriangle}
          title="Erreurs ETL"
          tone={data.errorsByType.length ? "warning" : "success"}
          value={formatNumber(
            data.errorsByType.reduce((total, item) => total + Number(item.total || 0), 0),
          )}
        />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <RunCard run={data.latestRun} title="Dernier run" />
        <RunCard run={data.latestIncrementalRun} title="Dernier run incrémental" />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Erreurs par type</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {data.errorsByType.length ? (
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={data.errorsByType}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="error_type" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(value) => formatNumber(value)} width={60} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#b7791f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="Aucune erreur historisée" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historique des runs</CardTitle>
          </CardHeader>
          <CardContent>
            {data.runHistory.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Début</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead className="text-right">Traités</TableHead>
                    <TableHead className="text-right">Insérés</TableHead>
                    <TableHead className="text-right">Échecs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.runHistory.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>{run.run_type || "-"}</TableCell>
                      <TableCell>
                        <StatusBadge value={run.status} />
                      </TableCell>
                      <TableCell>{formatDateTime(run.started_at)}</TableCell>
                      <TableCell>
                        {formatDurationMs(Number(run.duration_seconds || 0) * 1000)}
                      </TableCell>
                      <TableCell className="metric-number text-right">
                        {formatNumber(run.processed_count)}
                      </TableCell>
                      <TableCell className="metric-number text-right">
                        {formatNumber(run.inserted_count)}
                      </TableCell>
                      <TableCell className="metric-number text-right">
                        {formatNumber(run.failed_count)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="Aucun run ETL disponible" />
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Dernières erreurs</CardTitle>
        </CardHeader>
        <CardContent>
          {data.latestErrors.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Chemin</TableHead>
                  <TableHead>Créée le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.latestErrors.map((row) => (
                  <TableRow key={String(row.id)}>
                    <TableCell>{String(row.error_type || "-")}</TableCell>
                    <TableCell className="max-w-96 truncate">
                      {String(row.error_message || "-")}
                    </TableCell>
                    <TableCell className="max-w-96 truncate">
                      {String(row.raw_path || "-")}
                    </TableCell>
                    <TableCell>{formatDateTime(String(row.created_at || ""))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title="Aucune erreur récente" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RunCard({ title, run }: { title: string; run: EtlRun | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {run ? (
          <dl className="grid gap-4 md:grid-cols-2">
            <Meta label="Type" value={run.run_type} />
            <Meta label="Statut" value={<StatusBadge value={run.status} />} />
            <Meta label="Début" value={formatDateTime(run.started_at)} />
            <Meta label="Fin" value={formatDateTime(run.finished_at)} />
            <Meta
              label="Durée"
              value={formatDurationMs(Number(run.duration_seconds || 0) * 1000)}
            />
            <Meta label="Traités" value={formatNumber(run.processed_count)} />
            <Meta label="Insérés" value={formatNumber(run.inserted_count)} />
            <Meta label="Échecs" value={formatNumber(run.failed_count)} />
          </dl>
        ) : (
          <EmptyState title="Aucune donnée" />
        )}
      </CardContent>
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{value || "Non renseigné"}</dd>
    </div>
  );
}
