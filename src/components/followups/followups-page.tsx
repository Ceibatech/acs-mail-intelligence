"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, RotateCcw, TimerReset } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import type { FollowupRow, FollowupSummary } from "@/types/followup";

type FollowupsResponse = {
  tableAvailable: boolean;
  summary: FollowupSummary;
  rows: FollowupRow[];
};

const emptySummary: FollowupSummary = {
  open: 0,
  overdue: 0,
  dueToday: 0,
  closed: 0,
  highPriority: 0,
};

export function FollowupsPage() {
  const [data, setData] = useState<FollowupsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: "",
    priority: "",
    assignedTo: "",
    clientName: "",
    dueFrom: "",
    dueTo: "",
  });
  const [form, setForm] = useState({
    title: "",
    client_name: "",
    description: "",
    priority: "medium",
    due_date: "",
    assigned_to: "",
  });

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, value);
      }

      const response = await fetch(`/api/followups?${params.toString()}`, {
        cache: "no-store",
      });
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

  async function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadData();
  }

  async function createFollowup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNote(null);

    const response = await fetch("/api/followups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await response.json();

    if (!response.ok) {
      setNote(payload.error || "Création impossible.");
      return;
    }

    setNote(`Relance créée (#${payload.id}).`);
    setForm({
      title: "",
      client_name: "",
      description: "",
      priority: "medium",
      due_date: "",
      assigned_to: "",
    });
    await loadData();
  }

  async function updateStatus(row: FollowupRow, status: string) {
    const response = await fetch(`/api/followups/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const payload = await response.json();
    setNote(
      response.ok
        ? status === "closed"
          ? "Relance clôturée."
          : "Relance réouverte."
        : payload.error || "Modification impossible.",
    );
    if (response.ok) loadData();
  }

  const summary = data?.summary || emptySummary;

  return (
    <div>
      <PageHeader
        actions={
          <Button onClick={loadData} size="sm" variant="outline">
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </Button>
        }
        description="Suivi des actions issues des emails, avec priorités et échéances."
        title="Relances"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={TimerReset} title="Ouvertes" value={formatNumber(summary.open)} />
        <StatCard
          icon={TimerReset}
          title="En retard"
          tone="danger"
          value={formatNumber(summary.overdue)}
        />
        <StatCard
          icon={TimerReset}
          title="À faire aujourd'hui"
          tone="warning"
          value={formatNumber(summary.dueToday)}
        />
        <StatCard
          icon={CheckCircle2}
          title="Clôturées"
          tone="success"
          value={formatNumber(summary.closed)}
        />
        <StatCard
          icon={TimerReset}
          title="Haute priorité"
          tone="warning"
          value={formatNumber(summary.highPriority)}
        />
      </section>

      {note ? (
        <div className="mt-4 rounded-md border bg-card px-4 py-3 text-sm">{note}</div>
      ) : null}

      <section className="mt-6 grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Créer une relance</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={createFollowup}>
                <Field label="Titre">
                  <Input
                    onChange={(event) =>
                      setForm((current) => ({ ...current, title: event.target.value }))
                    }
                    required
                    value={form.title}
                  />
                </Field>
                <Field label="Client">
                  <Input
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        client_name: event.target.value,
                      }))
                    }
                    value={form.client_name}
                  />
                </Field>
                <Field label="Priorité">
                  <Select
                    onChange={(event) =>
                      setForm((current) => ({ ...current, priority: event.target.value }))
                    }
                    value={form.priority}
                  >
                    <option value="low">Basse</option>
                    <option value="medium">Moyenne</option>
                    <option value="high">Haute</option>
                    <option value="urgent">Urgente</option>
                  </Select>
                </Field>
                <Field label="Échéance">
                  <Input
                    onChange={(event) =>
                      setForm((current) => ({ ...current, due_date: event.target.value }))
                    }
                    type="date"
                    value={form.due_date}
                  />
                </Field>
                <Field label="Assignée à">
                  <Input
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        assigned_to: event.target.value,
                      }))
                    }
                    value={form.assigned_to}
                  />
                </Field>
                <Field label="Description">
                  <Textarea
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    value={form.description}
                  />
                </Field>
                <Button className="w-full" type="submit">
                  Créer
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Filtres</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={submitFilters}>
                <Field label="Statut">
                  <Select
                    onChange={(event) =>
                      setFilters((current) => ({ ...current, status: event.target.value }))
                    }
                    value={filters.status}
                  >
                    <option value="">Tous</option>
                    <option value="open">Ouverte</option>
                    <option value="in_progress">En cours</option>
                    <option value="closed">Clôturée</option>
                  </Select>
                </Field>
                <Field label="Priorité">
                  <Select
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        priority: event.target.value,
                      }))
                    }
                    value={filters.priority}
                  >
                    <option value="">Toutes</option>
                    <option value="low">Basse</option>
                    <option value="medium">Moyenne</option>
                    <option value="high">Haute</option>
                    <option value="urgent">Urgente</option>
                  </Select>
                </Field>
                <Field label="Assignée à">
                  <Input
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        assignedTo: event.target.value,
                      }))
                    }
                    value={filters.assignedTo}
                  />
                </Field>
                <Field label="Client">
                  <Input
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        clientName: event.target.value,
                      }))
                    }
                    value={filters.clientName}
                  />
                </Field>
                <Button type="submit" variant="outline">
                  Appliquer
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Relances à traiter</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <LoadingState label="Chargement des relances..." /> : null}
            {error ? <ErrorState message={error} /> : null}
            {!loading && !error && data ? (
              data.tableAvailable ? (
                data.rows.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Titre</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Priorité</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Échéance</TableHead>
                        <TableHead>Assignée à</TableHead>
                        <TableHead>Email lié</TableHead>
                        <TableHead>Créée le</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="max-w-56 truncate">{row.title}</TableCell>
                          <TableCell>{row.client_name || "-"}</TableCell>
                          <TableCell>
                            <StatusBadge value={row.priority} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge value={row.status} />
                          </TableCell>
                          <TableCell>{formatDate(row.due_date)}</TableCell>
                          <TableCell>{row.assigned_to || "-"}</TableCell>
                          <TableCell className="max-w-64 truncate">
                            {row.message_id ? (
                              <Link className="underline" href={`/emails/${row.message_id}`}>
                                {row.linked_subject || `Message #${row.message_id}`}
                              </Link>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>{formatDateTime(row.created_at)}</TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              {row.status === "closed" ? (
                                <Button
                                  onClick={() => updateStatus(row, "open")}
                                  size="icon"
                                  title="Réouvrir"
                                  type="button"
                                  variant="ghost"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  onClick={() => updateStatus(row, "closed")}
                                  size="icon"
                                  title="Clôturer"
                                  type="button"
                                  variant="ghost"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <EmptyState
                    description="Aucune relance ne correspond aux filtres."
                    title="Aucune relance"
                  />
                )
              ) : (
                <EmptyState
                  description="Ajoute la table followups pour activer la gestion persistante des relances."
                  title="Table followups absente"
                />
              )
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
