"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Code2, Copy, ExternalLink, FileText, ImageIcon, Send, Tag, TimerReset } from "lucide-react";
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
import { formatBytes, formatDateTime, formatNumber } from "@/lib/format";
import type { EmailDetail } from "@/types/email";

const classifications = [
  "sinistre",
  "devis",
  "relance",
  "renouvellement",
  "rÃ©clamation",
  "attestation",
  "contrat",
];

type BodyView = "text" | "html";

type MessageImage = {
  alt: string;
  index: number;
  src: string;
  viewable: boolean;
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

export function EmailDetailPage({ id }: { id: string }) {
  const [email, setEmail] = useState<EmailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [followupOpen, setFollowupOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bodyView, setBodyView] = useState<BodyView>("text");
  const [selectedImage, setSelectedImage] = useState<MessageImage | null>(null);
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
      note: buildShareNote(getReadableBody(email)),
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
    setNote("MÃ©tadonnÃ©es copiÃ©es.");
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
      setNote(payload.error || "CrÃ©ation de relance impossible.");
      return;
    }

    setFollowupOpen(false);
    setNote(`Relance crÃ©Ã©e (#${payload.id}).`);
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
    handleShareResult(payload);
  }

  function handleShareResult(payload: ShareResponse) {
    if (payload.delivery?.status === "sent") {
      setNote("Partage envoyÃ©. L'utilisateur est en copie.");
      return;
    }

    if (payload.delivery?.mailtoUrl) {
      window.location.href = payload.delivery.mailtoUrl;
      setNote(
        "Brouillon email ouvert. Le message archivÃ© et la copie interne sont prÃªts.",
      );
      return;
    }

    setNote(payload.reason || payload.message || "Partage prÃ©parÃ©.");
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
          ? `Tag "${tag}" ajoutÃ©.`
          : payload.reason || "Tag prÃ©parÃ©."
        : payload.error || "Tag impossible.",
    );
    if (response.ok && payload.saved) loadData();
  }

  if (loading) return <LoadingState label="Chargement du message..." />;
  if (error) return <ErrorState message={error} />;
  if (!email) {
    return (
      <EmptyState
        description="Le message demandÃ© n'a pas Ã©tÃ© trouvÃ© dans l'archive."
        title="Message introuvable"
      />
    );
  }

  const readableBody = getReadableBody(email);
  const bodySource = email.body_text?.trim()
    ? "Texte extrait"
    : email.body_html?.trim()
      ? "HTML converti en texte"
      : email.body_preview?.trim()
        ? "AperÃ§u extrait"
        : null;
  const bodyPreview = email.body_preview?.trim() || "";
  const showBodyPreview = bodyPreview.length > 0 && bodyPreview !== readableBody;
  const htmlPreview = getSafeHtmlPreview(email.body_html);
  const messageImages = extractHtmlImages(email.body_html);

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
              <CardTitle>MÃ©tadonnÃ©es</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 md:grid-cols-2">
                <Meta label="ExpÃ©diteur" value={email.from_header} />
                <Meta label="Destinataire" value={email.to_header} />
                <Meta label="Copie" value={email.cc_header} />
                <Meta label="Copie cachÃ©e" value={email.bcc_header} />
                <Meta label="BoÃ®te" value={email.mailbox} />
                <Meta label="Dossier" value={email.folder} />
                <Meta label="Message-ID" value={email.message_id} mono />
                <Meta label="Taille" value={formatBytes(email.size_bytes)} />
                <Meta label="Date email" value={formatDateTime(email.email_date)} />
                <Meta label="ImportÃ© le" value={formatDateTime(email.imported_at)} />
                <Meta
                  label="Statut extraction"
                  value={email.extraction_status || (email.has_body ? "Disponible" : null)}
                />
                <Meta
                  label="Longueur corps"
                  value={
                    email.body_length
                      ? `${formatNumber(email.body_length)} caractÃ¨res`
                      : null
                  }
                />
                <Meta
                  label="Source corps"
                  value={
                    email.body_source_message_id &&
                    email.body_source_message_id !== email.id
                      ? `Copie #${email.body_source_message_id}`
                      : email.body_source_message_id
                        ? "Message courant"
                        : null
                  }
                />
                {email.raw_path ? (
                  <Meta label="Chemin brut admin" value={email.raw_path} mono />
                ) : null}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle>Corps du message</CardTitle>
                  {bodySource ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {bodySource}
                      {email.body_length
                        ? ` - ${formatNumber(email.body_length)} caractères`
                        : ""}
                    </p>
                  ) : null}
                </div>
                {readableBody || htmlPreview ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={!readableBody}
                      onClick={() => setBodyView("text")}
                      size="sm"
                      type="button"
                      variant={bodyView === "text" ? "default" : "outline"}
                    >
                      <FileText className="h-4 w-4" />
                      Texte
                    </Button>
                    <Button
                      disabled={!htmlPreview}
                      onClick={() => setBodyView("html")}
                      size="sm"
                      type="button"
                      variant={bodyView === "html" ? "default" : "outline"}
                    >
                      <Code2 className="h-4 w-4" />
                      Email
                    </Button>
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showBodyPreview ? (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm leading-relaxed text-muted-foreground">
                  {bodyPreview}
                </div>
              ) : null}

              {messageImages.length ? (
                <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ImageIcon className="h-4 w-4" />
                    Images du message
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {messageImages.map((image) => (
                      <button
                        className="group min-w-0 rounded-md border bg-background p-2 text-left text-sm transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-70"
                        disabled={!image.viewable}
                        key={`${image.index}-${image.src}`}
                        onClick={() => setSelectedImage(image)}
                        type="button"
                      >
                        {image.viewable ? (
                          <img
                            alt={image.alt}
                            className="mb-2 aspect-video w-full rounded border object-contain"
                            src={image.src}
                          />
                        ) : (
                          <div className="mb-2 flex aspect-video items-center justify-center rounded border bg-muted text-xs text-muted-foreground">
                            Image embarquée non disponible
                          </div>
                        )}
                        <span className="block truncate font-medium">
                          {image.alt || `Image ${image.index}`}
                        </span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {image.viewable ? "Cliquer pour voir" : image.src}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {readableBody || htmlPreview ? (
                bodyView === "html" && htmlPreview ? (
                  <div className="overflow-hidden rounded-md border bg-white">
                    <iframe
                      className="h-[620px] w-full bg-white"
                      sandbox="allow-popups allow-popups-to-escape-sandbox"
                      srcDoc={htmlPreview}
                      title="Aperçu HTML du message"
                    />
                  </div>
                ) : (
                  <article className="max-h-[720px] overflow-auto whitespace-pre-wrap rounded-md border bg-background p-5 text-sm leading-7 text-foreground">
                    {readableBody}
                  </article>
                )
              ) : (
                <EmptyState
                  description={`Statut extraction : ${
                    email.extraction_status || "non renseigné"
                  }. Le corps n'est pas encore présent dans email_message_bodies.`}
                  title="Corps non disponible"
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
              <CardTitle>Relances liÃ©es</CardTitle>
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
                <p className="text-sm text-muted-foreground">Aucune relance liÃ©e.</p>
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
              CrÃ©er la relance
            </Button>
          </div>
        }
        onClose={() => setFollowupOpen(false)}
        open={followupOpen}
        title="CrÃ©er une relance"
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
            <Field label="PrioritÃ©">
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
            <Field label="Ã‰chÃ©ance">
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
            <Field label="AssignÃ©e Ã ">
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
              Partager
            </Button>
          </div>
        }
        onClose={() => setShareOpen(false)}
        open={shareOpen}
        title="Partager le message"
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
          <Field label="Note / corps transmis">
            <Textarea
              onChange={(event) =>
                setShareForm((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
              className="min-h-40"
              value={shareForm.note}
            />
          </Field>
        </form>
      </Modal>
      <Modal
        description={selectedImage?.src || "Image extraite du HTML du message"}
        footer={
          <div className="flex justify-end gap-2">
            {selectedImage?.viewable ? (
              <Button
                onClick={() => window.open(selectedImage.src, "_blank", "noopener,noreferrer")}
                type="button"
                variant="outline"
              >
                <ExternalLink className="h-4 w-4" />
                Ouvrir
              </Button>
            ) : null}
            <Button onClick={() => setSelectedImage(null)} type="button">
              Fermer
            </Button>
          </div>
        }
        onClose={() => setSelectedImage(null)}
        open={Boolean(selectedImage)}
        title={selectedImage?.alt || "Image du message"}
      >
        {selectedImage?.viewable ? (
          <div className="max-h-[72vh] overflow-auto rounded-md border bg-muted/20 p-3">
            <img
              alt={selectedImage.alt}
              className="mx-auto max-h-[68vh] max-w-full rounded bg-white object-contain"
              src={selectedImage.src}
            />
          </div>
        ) : (
          <EmptyState
            description="Cette image est referencee dans le HTML, mais son contenu n'est pas stocke dans les tables disponibles."
            title="Image non disponible"
          />
        )}
      </Modal>
    </div>
  );
}

function getReadableBody(email: EmailDetail) {
  const text = email.body_text?.trim();
  if (text) return text;

  const htmlText = htmlToText(email.body_html);
  if (htmlText) return htmlText;

  return email.body_preview?.trim() || "";
}

function buildShareNote(readableBody: string) {
  const body = readableBody.trim();
  if (!body) return "";
  return truncateText(body, 2800);
}

function truncateText(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit).trim()}...`;
}

function getSafeHtmlPreview(value?: string | null) {
  if (!value?.trim()) return "";
  const sanitized = value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
    .replace(/<object[\s\S]*?<\/object>/gi, " ")
    .replace(/<embed[\s\S]*?<\/embed>/gi, " ")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<base target="_blank" />
<style>
  body { color: #0f172a; font: 14px/1.55 Arial, sans-serif; margin: 0; padding: 20px; }
  img { cursor: zoom-in; height: auto; max-width: 100%; }
  table { max-width: 100%; }
  a { color: #0369a1; }
</style>
</head>
<body>${sanitized}</body>
</html>`;
}

function extractHtmlImages(value?: string | null): MessageImage[] {
  if (!value?.trim()) return [];
  return Array.from(value.matchAll(/<img\b[^>]*>/gi))
    .map((match, index) => {
      const tag = match[0];
      const src = normalizeImageSource(readHtmlAttribute(tag, "src"));
      return {
        alt: readHtmlAttribute(tag, "alt") || `Image ${index + 1}`,
        index: index + 1,
        src,
        viewable: isViewableImageSource(src),
      };
    })
    .filter((image) => image.src);
}

function readHtmlAttribute(tag: string, name: string) {
  const pattern = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = tag.match(pattern);
  return decodeHtmlEntities(match?.[2] || match?.[3] || match?.[4] || "").trim();
}

function normalizeImageSource(src: string) {
  if (src.startsWith("//")) return `https:${src}`;
  return src;
}

function isViewableImageSource(src: string) {
  return /^(https?:\/\/|data:image\/)/i.test(src);
}
function htmlToText(value?: string | null) {
  if (!value?.trim()) return "";

  return decodeHtmlEntities(
    value
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (match, code: string) => {
      const point = Number(code);
      return Number.isFinite(point) ? String.fromCodePoint(point) : match;
    })
    .replace(/&#x([0-9a-f]+);/gi, (match, code: string) => {
      const point = Number.parseInt(code, 16);
      return Number.isFinite(point) ? String.fromCodePoint(point) : match;
    });
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
        {value || "Non renseignÃ©"}
      </dd>
    </div>
  );
}
