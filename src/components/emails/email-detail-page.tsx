"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Copy, Send, Tag, TimerReset } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
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
import { formatBytes, formatDateTime } from "@/lib/format";
import type { EmailDetail } from "@/types/email";

const classifications = [
  "sinistre",
  "devis",
  "relance",
  "renouvellement",
  "réclamation",
  "attestation",
  "contrat",
];

export function EmailDetailPage({ id }: { id: string }) {
  const [email, setEmail] = useState<EmailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [followupOpen, setFollowupOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
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

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/emails/${id}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Chargement impossible.");
      setEmail(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erreur inconnue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [id]);

  function openFollowup() {
    if (!email) return;
    setFollowupForm({
      title: email.subject || "Relance email",
      priority: "medium",
      due_date: "",
      assigned_to: "",
      description: "",
    });
    setFollowupOpen(true);
  }

  function openShare() {
    if (!email) return;
    setShareForm({
      shared_to: "",
      note: `Message #${email.id} - ${email.subject || "Sans sujet"}`,
    });
    setShareOpen(true);
  }

  async function copyMetadata() {
    if (!email) return;
    await navigator.clipboard.writeText(
      JSON.stringify(
        {
          id: email.id,
          subject: email.subject,
          message_id: email.message_id,
          from: email.from_header,
          to: email.to_header,
          cc: email.cc_header,
          bcc: email.bcc_header,
          mailbox: email.mailbox,
          folder: email.folder,
          email_date: email.email_date,
          imported_at: email.imported_at,
        },
        null,
        2,
      ),
    );
    setNote("Métadonnées copiées.");
  }

  async function submitFollowup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) return;

    setSubmitting(true);
    const response = await fetch("/api/followups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message_id: email.id,
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

    setFollowupOpen(false);
    setNote(`Relance créée (#${payload.id}).`);
    loadData();
  }

  async function submitShare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) return;

    setSubmitting(true);
    const response = await fetch(`/api/messages/${email.id}/share`, {
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

    setShareOpen(false);
    setNote(
      payload.saved
        ? "Demande de partage enregistrée."
        : payload.reason || "Partage préparé.",
    );
  }

  async function addTag(tag: string) {
    if (!email) return;
    const response = await fetch(`/api/messages/${email.id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag, category: tag }),
    });
    const payload = await response.json();
    setNote(
      response.ok
        ? payload.saved
          ? `Tag "${tag}" ajouté.`
          : payload.reason || "Tag préparé."
        : payload.error || "Tag impossible.",
    );
    if (response.ok && payload.saved) loadData();
  }

  if (loading) return <LoadingState label="Chargement du message..." />;
  if (error) return <ErrorState message={error} />;
  if (!email) {
    return (
      <EmptyState
        description="Le message demandé n'a pas été trouvé dans l'archive."
        title="Message introuvable"
      />
    );
  }

  return (
    <div>
      <PageHeader
        actions={
          <>
            <Link
              className="inline-flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm hover:bg-muted"
              href="/emails"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Link>
            <Button onClick={copyMetadata} size="sm" variant="outline">
              <Copy className="h-4 w-4" />
              Copier
            </Button>
            <Button onClick={openFollowup} size="sm" variant="outline">
              <TimerReset className="h-4 w-4" />
              Relance
            </Button>
            <Button onClick={openShare} size="sm">
              <Send className="h-4 w-4" />
              Partager
            </Button>
          </>
        }
        description={`${email.mailbox} - ${formatDateTime(email.email_date)}`}
        title={email.subject || "Message sans sujet"}
      />

      {note ? (
        <div className="mb-4 rounded-md border bg-card px-4 py-3 text-sm">{note}</div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Métadonnées</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 md:grid-cols-2">
                <Meta label="Expéditeur" value={email.from_header} />
                <Meta label="Destinataire" value={email.to_header} />
                <Meta label="Copie" value={email.cc_header} />
                <Meta label="Copie cachée" value={email.bcc_header} />
                <Meta label="Boîte" value={email.mailbox} />
                <Meta label="Dossier" value={email.folder} />
                <Meta label="Message-ID" value={email.message_id} mono />
                <Meta label="Taille" value={formatBytes(email.size_bytes)} />
                <Meta label="Date email" value={formatDateTime(email.email_date)} />
                <Meta label="Importé le" value={formatDateTime(email.imported_at)} />
                {email.raw_path ? (
                  <Meta label="Chemin brut admin" value={email.raw_path} mono />
                ) : null}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Corps du message</CardTitle>
            </CardHeader>
            <CardContent>
              {email.body_text ? (
                <Textarea
                  className="min-h-[420px] font-mono text-xs leading-relaxed"
                  readOnly
                  value={email.body_text}
                />
              ) : (
                <EmptyState
                  description="Aucun contenu texte n'est disponible pour ce message."
                  title="Corps indisponible"
                />
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Classification</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {classifications.map((classification) => (
                <Button
                  key={classification}
                  onClick={() => addTag(classification)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Tag className="h-4 w-4" />
                  {classification}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {email.tags.length ? (
                email.tags.map((tag) => (
                  <Badge key={tag.id} variant="secondary">
                    {tag.tag}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Aucun tag.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Relances liées</CardTitle>
            </CardHeader>
            <CardContent>
              {email.followups.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titre</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {email.followups.map((followup) => (
                      <TableRow key={followup.id}>
                        <TableCell className="max-w-48 truncate">
                          {followup.title}
                        </TableCell>
                        <TableCell>
                          <StatusBadge value={followup.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">Aucune relance liée.</p>
              )}
            </CardContent>
          </Card>
        </aside>
      </section>

      <Modal
        description={email.subject || "Message sans sujet"}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setFollowupOpen(false)} type="button" variant="outline">
              Annuler
            </Button>
            <Button disabled={submitting} form="detail-followup-form" type="submit">
              Créer la relance
            </Button>
          </div>
        }
        onClose={() => setFollowupOpen(false)}
        open={followupOpen}
        title="Créer une relance"
      >
        <form className="grid gap-4" id="detail-followup-form" onSubmit={submitFollowup}>
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
        description={email.subject || "Message sans sujet"}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setShareOpen(false)} type="button" variant="outline">
              Annuler
            </Button>
            <Button disabled={submitting} form="detail-share-form" type="submit">
              Enregistrer le partage
            </Button>
          </div>
        }
        onClose={() => setShareOpen(false)}
        open={shareOpen}
        title="Partager les métadonnées"
      >
        <form className="grid gap-4" id="detail-share-form" onSubmit={submitShare}>
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

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | number | null;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={`mt-1 truncate text-sm ${mono ? "font-mono text-xs" : ""}`}
        title={value ? String(value) : undefined}
      >
        {value || "Non renseigné"}
      </dd>
    </div>
  );
}
