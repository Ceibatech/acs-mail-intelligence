"use client";

import { useEffect, useState } from "react";
import { Database, RefreshCw, ShieldCheck, Table2, UserCog } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ErrorState, LoadingState } from "@/components/data-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import type { CurrentUser } from "@/types/auth";
import { UserManagement } from "@/components/settings/user-management";

type TableStatus = {
  name: string;
  exists: boolean;
  count: number | null;
};

type DbStatus = {
  ok: boolean;
  appName?: string;
  latencyMs?: number;
  database?: string | null;
  hostConfigured?: boolean;
  hostOverrideConfigured?: boolean;
  userConfigured?: boolean;
  passwordConfigured?: boolean;
  tables?: TableStatus[];
  currentUser?: CurrentUser;
  error?: string;
};

export function SettingsPage() {
  const [data, setData] = useState<DbStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/settings/database", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Connexion impossible.");
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

  const presentTables = data?.tables?.filter((table) => table.exists).length || 0;
  const totalTables = data?.tables?.length || 0;

  return (
    <div>
      <PageHeader
        actions={
          <Button onClick={loadData} size="sm" variant="outline">
            <RefreshCw className="h-4 w-4" />
            Tester
          </Button>
        }
        description="Etat technique de l'application, connexion base, droits applicatifs et tables disponibles."
        title="Paramètres"
      />

      {loading ? <LoadingState label="Test de connexion..." /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!loading && !error ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              description={data?.database || "Base non configurée"}
              icon={Database}
              title="Connexion MySQL"
              tone={data?.ok ? "success" : "danger"}
              value={data?.ok ? "Connectée" : "Indisponible"}
            />
            <StatCard
              description={data?.currentUser?.email || "Utilisateur système"}
              icon={UserCog}
              title="Rôle applicatif"
              value={data?.currentUser?.role || "viewer"}
            />
            <StatCard
              description="Routes API Next.js côté serveur"
              icon={ShieldCheck}
              title="Accès données"
              tone="success"
              value="Protégé"
            />
            <StatCard
              description={`${presentTables}/${totalTables} tables attendues`}
              icon={Table2}
              title="Schéma"
              tone={presentTables >= 2 ? "success" : "warning"}
              value={`${presentTables}/${totalTables}`}
            />
          </section>

          <section className="mt-6 grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Configuration serveur</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Row label="Application">{data?.appName || "ACS Mail Intelligence"}</Row>
                <Row label="Statut">
                  <Badge variant={data?.ok ? "success" : "destructive"}>
                    {data?.ok ? "OK" : "Erreur"}
                  </Badge>
                </Row>
                <Row label="Latence">{data?.latencyMs ? `${data.latencyMs} ms` : "-"}</Row>
                <Row label="DB_HOST">{data?.hostConfigured ? "Configuré" : "Manquant"}</Row>
                <Row label="DB_HOST_IPV4">
                  {data?.hostOverrideConfigured ? "Actif" : "Non utilisé"}
                </Row>
                <Row label="DB_USER">{data?.userConfigured ? "Configuré" : "Manquant"}</Row>
                <Row label="DB_PASSWORD">
                  {data?.passwordConfigured ? "Configuré" : "Manquant"}
                </Row>
                <Separator />
                <p className="text-sm text-muted-foreground">
                  Les credentials MySQL restent côté serveur. Le navigateur ne reçoit que
                  des réponses JSON préparées par les routes API.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tables détectées</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Lignes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.tables || []).map((table) => (
                      <TableRow key={table.name}>
                        <TableCell className="font-mono text-xs">{table.name}</TableCell>
                        <TableCell>
                          <Badge variant={table.exists ? "success" : "warning"}>
                            {table.exists ? "Disponible" : "Absente"}
                          </Badge>
                        </TableCell>
                        <TableCell className="metric-number text-right">
                          {table.count === null ? "-" : formatNumber(table.count)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Règles de sécurité appliquées</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
              <p>Les requêtes SQL utilisent des paramètres, pas de concaténation utilisateur.</p>
              <p>`raw_path` reste réservé au rôle `admin` dans l'API détail message.</p>
              <p>Les recherches et consultations alimentent `audit_logs` quand la table existe.</p>
            </CardContent>
          </Card>

          {data?.currentUser?.role === "admin" ? (
            <section className="mt-6">
              <UserManagement />
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{children}</span>
    </div>
  );
}
