"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Copy, Eye, RefreshCw, Send, TimerReset } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
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
import { formatBytes, formatDateTime, formatNumber } from "@/lib/format";
import type { EmailSearchResponse, EmailSearchRow } from "@/types/email";

type FilterState = {
  keyword: string;
  mailbox: string;
  sender: string;
  recipient: string;
  subject: string;
  folder: string;
  dateFrom: string;
  dateTo: string;
  sizeMin: string;
  sizeMax: string;
  pageSize: string;
};

type ShareResponse = {
  saved?: boolean;
  reason?: string;
  message?: string;
  delivery?: {
    status?: "sent" | "manual";
    mailtoUrl?: string;
    reason?: string;
  };
};

const defaultFilters: FilterState = {
  keyword: "",
  mailbox: "",
  sender: "",
  recipient: "",
  subject: "",
  folder: "",
  dateFrom: "",
  dateTo: "",
  sizeMin: "",
  sizeMax: "",
  pageSize: "50",
};

function filtersFromParams(params: URLSearchParams): FilterState {
  return {
    keyword: params.get("keyword") || "",
    mailbox: params.get("mailbox") || "",
    sender: params.get("sender") || "",
    recipient: params.get("recipient") || "",
    subject: params.get("subject") || "",
    folder: params.get("folder") || "",
    dateFrom: params.get("dateFrom") || "",
    dateTo: params.get("dateTo") || "",
    sizeMin: params.get("sizeMin") || "",
    sizeMax: params.get("sizeMax") || "",
    pageSize: params.get("pageSize") || "50",
  };
}

export function EmailSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useMemo(
    () => new URLSearchParams(searchParams.toString()),
    [searchParams],
  );
  const paramsKey = params.toString();
  const [filters, setFilters] = useState<FilterState>(() => filtersFromParams(params));
  const [data, setData] = useState<EmailSearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [selectedFollowup, setSelectedFollowup] = useState<EmailSearchRow | null>(null);
  const [selectedShare, setSelectedShare] = useState<EmailSearchRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [followupForm, setFollowupForm] = useState({
    title: "",
    priority: "medium",
    due_date: "",
    assigned_to: "",
    description: "",
  });
  const [shareForm, setShareForm] = useState({
    shared_to: "",
    note: "",
  });

  const page = Number(params.get("page") || "1") || 1;

  async function loadData(urlParams = params) {
    setLoading(true);
    setError(null);
    setNote(null);
    try {
      const response = await fetch(`/api/emails/search?${urlParams.toString()}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Recherche impossible.");
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erreur inconnue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const nextFilters = filtersFromParams(params);
    setFilters(nextFilters);
    loadData(params);
  }, [paramsKey]);

  function updateFilter(key: keyof FilterState, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
      if (value) next.set(key, value);
    }

    next.set("page", "1");
    router.push(`/emails?${next.toString()}`);
  }

  function changePage(nextPage: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(Math.max(nextPage, 1)));
    router.push(`/emails?${next.toString()}`);
  }

  function resetFilters() {
    setFilters(defaultFilters);
    router.push("/emails?page=1&pageSize=50");
  }

  function openFollowup(row: EmailSearchRow) {
    setSelectedFollowup(row);
    setFollowupForm({
      title: row.subject || "Relance email",
      priority: "medium",
      due_date: "",
      assigned_to: "",
      description: "",
    });
  }

  function openShare(row: EmailSearchRow) {
    setSelectedShare(row);
    setShareForm({
      shared_to: "",
      note: `Message #${row.id} - ${row.subject || "Sans sujet"}`,
    });
  }

  async function copyMetadata(row: EmailSearchRow) {
    await navigator.clipboard.writeText(
      JSON.stringify(
        {
          id: row.id,
          subject: row.subject,
          from: row.from_header,
          to: row.to_header,
          mailbox: row.mailbox,
          date: row.email_date,
        },
        null,
        2,
      ),
    );
    setNote("Métadonnées copiées.");
  }

  async function submitFollowup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFollowup) return;

    setSubmitting(true);
    const response = await fetch("/api/followups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message_id: selectedFollowup.id,
        ...followupForm,
        status: "open",
      }),
    });
    const payload = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setNote(payload.error || "Création de relance impossible.");
      return;
    }

    setSelectedFollowup(null);
    setNote(`Relance créée (#${payload.id}).`);
  }

  async function submitShare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedShare) return;

    setSubmitting(true);
    const response = await fetch(`/api/messages/${selectedShare.id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(shareForm),
    });
    const payload = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setNote(payload.error || "Partage impossible.");
      return;
    }

    setSelectedShare(null);
    handleShareResult(payload);
  }

  function handleShareResult(payload: ShareResponse) {
    if (payload.delivery?.status === "sent") {
      setNote("Partage envoyé. L'utilisateur est en copie.");
      return;
    }

    if (payload.delivery?.mailtoUrl) {
      window.location.href = payload.delivery.mailtoUrl;
      setNote(
        "Brouillon email ouvert. Le message archivé et la copie interne sont prêts.",
      );
      return;
    }

    setNote(payload.reason || payload.message || "Partage préparé.");
  }

  return (
    <div>
      <PageHeader
        description="Recherche avancée avec pagination serveur et filtres partageables."
        title="Recherche emails"
      />

      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 lg:grid-cols-4" onSubmit={submit}>
            <Field label="Mot-clé">
              <Input
                onChange={(event) => updateFilter("keyword", event.target.value)}
                placeholder="devis, sinistre, client"
                value={filters.keyword}
              />
            </Field>
            <Field label="Boîte mail">
              <Input
                onChange={(event) => updateFilter("mailbox", event.target.value)}
                placeholder="contact@acs.ci"
                value={filters.mailbox}
              />
            </Field>
            <Field label="Expéditeur">
              <Input
                onChange={(event) => updateFilter("sender", event.target.value)}
                value={filters.sender}
              />
            </Field>
            <Field label="Destinataire">
              <Input
                onChange={(event) => updateFilter("recipient", event.target.value)}
                value={filters.recipient}
              />
            </Field>
            <Field label="Sujet">
              <Input
                onChange={(event) => updateFilter("subject", event.target.value)}
                value={filters.subject}
              />
            </Field>
            <Field label="Dossier">
              <Input
                onChange={(event) => updateFilter("folder", event.target.value)}
                placeholder="INBOX, Sent"
                value={filters.folder}
              />
            </Field>
            <Field label="Date début">
              <Input
                onChange={(event) => updateFilter("dateFrom", event.target.value)}
                type="date"
                value={filters.dateFrom}
              />
            </Field>
            <Field label="Date fin">
              <Input
                onChange={(event) => updateFilter("dateTo", event.target.value)}
                type="date"
                value={filters.dateTo}
              />
            </Field>
            <Field label="Taille min. octets">
              <Input
                min="0"
                onChange={(event) => updateFilter("sizeMin", event.target.value)}
                type="number"
                value={filters.sizeMin}
              />
            </Field>
            <Field label="Taille max. octets">
              <Input
                min="0"
                onChange={(event) => updateFilter("sizeMax", event.target.value)}
                type="number"
                value={filters.sizeMax}
              />
            </Field>
            <Field label="Taille page">
              <Select
                onChange={(event) => updateFilter("pageSize", event.target.value)}
                value={filters.pageSize}
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </Select>
            </Field>
            <div className="flex items-end gap-2">
              <Button type="submit">
                <RefreshCw className="h-4 w-4" />
                Rechercher
              </Button>
              <Button onClick={resetFilters} type="button" variant="outline">
                Réinitialiser
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {note ? (
        <div className="mt-4 rounded-md border bg-card px-4 py-3 text-sm">{note}</div>
      ) : null}

      <div className="mt-6">
        {loading ? <LoadingState label="Recherche en cours..." /> : null}
        {error ? <ErrorState message={error} /> : null}
        {!loading && !error && data ? (
          data.rows.length ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle>
                  {formatNumber(data.total)} résultat{data.total > 1 ? "s" : ""}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Page {data.page} / {data.totalPages}
                </p>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Boîte</TableHead>
                      <TableHead>Expéditeur</TableHead>
                      <TableHead>Destinataire</TableHead>
                      <TableHead>Sujet</TableHead>
                      <TableHead>Dossier</TableHead>
                      <TableHead>Taille</TableHead>
                      <TableHead>Import</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDateTime(row.email_date)}
                        </TableCell>
                        <TableCell className="max-w-48 truncate">{row.mailbox}</TableCell>
                        <TableCell className="max-w-56 truncate">
                          {row.from_header || "Non renseigné"}
                        </TableCell>
                        <TableCell className="max-w-56 truncate">
                          {row.to_header || "Non renseigné"}
                        </TableCell>
                        <TableCell className="max-w-80 truncate">
                          {row.subject || "Sans sujet"}
                        </TableCell>
                        <TableCell>{row.folder || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatBytes(row.size_bytes)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDateTime(row.imported_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Link
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
                              href={`/emails/${row.id}`}
                              title="Voir le détail"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                            <IconButton
                              label="Créer une relance"
                              onClick={() => openFollowup(row)}
                            >
                              <TimerReset className="h-4 w-4" />
                            </IconButton>
                            <IconButton label="Partager" onClick={() => openShare(row)}>
                              <Send className="h-4 w-4" />
                            </IconButton>
                            <IconButton
                              label="Copier les métadonnées"
                              onClick={() => copyMetadata(row)}
                            >
                              <Copy className="h-4 w-4" />
                            </IconButton>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="mt-4 flex items-center justify-between">
                  <Button
                    disabled={page <= 1}
                    onClick={() => changePage(page - 1)}
                    variant="outline"
                  >
                    Précédent
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    {formatNumber(data.rows.length)} lignes affichées
                  </p>
                  <Button
                    disabled={page >= data.totalPages}
                    onClick={() => changePage(page + 1)}
                    variant="outline"
                  >
                    Suivant
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              description="Aucun email ne correspond aux filtres actuels."
              title="Aucun résultat"
            />
          )
        ) : null}
      </div>

      <Modal
        description={selectedFollowup?.subject || "Message sans sujet"}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setSelectedFollowup(null)}
              type="button"
              variant="outline"
            >
              Annuler
            </Button>
            <Button disabled={submitting} form="email-followup-form" type="submit">
              Créer la relance
            </Button>
          </div>
        }
        onClose={() => setSelectedFollowup(null)}
        open={Boolean(selectedFollowup)}
        title="Créer une relance"
      >
        <form className="grid gap-4" id="email-followup-form" onSubmit={submitFollowup}>
          <Field label="Titre">
            <Input
              onChange={(event) =>
                setFollowupForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              required
              value={followupForm.title}
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Priorité">
              <Select
                onChange={(event) =>
                  setFollowupForm((current) => ({
                    ...current,
                    priority: event.target.value,
                  }))
                }
                value={followupForm.priority}
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
                  setFollowupForm((current) => ({
                    ...current,
                    due_date: event.target.value,
                  }))
                }
                type="date"
                value={followupForm.due_date}
              />
            </Field>
            <Field label="Assignée à">
              <Input
                onChange={(event) =>
                  setFollowupForm((current) => ({
                    ...current,
                    assigned_to: event.target.value,
                  }))
                }
                value={followupForm.assigned_to}
              />
            </Field>
          </div>
          <Field label="Description">
            <Textarea
              onChange={(event) =>
                setFollowupForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              value={followupForm.description}
            />
          </Field>
        </form>
      </Modal>

      <Modal
        description={selectedShare?.subject || "Message sans sujet"}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setSelectedShare(null)} type="button" variant="outline">
              Annuler
            </Button>
            <Button disabled={submitting} form="email-share-form" type="submit">
              Partager
            </Button>
          </div>
        }
        onClose={() => setSelectedShare(null)}
        open={Boolean(selectedShare)}
        title="Partager le message"
      >
        <form className="grid gap-4" id="email-share-form" onSubmit={submitShare}>
          <Field label="Destinataire">
            <Input
              onChange={(event) =>
                setShareForm((current) => ({
                  ...current,
                  shared_to: event.target.value,
                }))
              }
              required
              type="email"
              value={shareForm.shared_to}
            />
          </Field>
          <Field label="Note">
            <Textarea
              onChange={(event) =>
                setShareForm((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
              value={shareForm.note}
            />
          </Field>
        </form>
      </Modal>
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

function IconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button onClick={onClick} size="icon" title={label} type="button" variant="ghost">
      {children}
    </Button>
  );
}
