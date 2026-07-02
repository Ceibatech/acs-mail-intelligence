import type { EmailDetail } from "@/types/email";

type ShareDeliveryInput = {
  email: EmailDetail;
  sharedBy: string;
  sharedTo: string;
  note?: string | null;
  detailUrl: string;
};

export type ShareDeliveryResult = {
  status: "sent" | "manual";
  provider: "resend" | "mailto";
  to: string[];
  cc: string[];
  from?: string;
  subject: string;
  mailtoUrl: string;
  reason?: string;
  providerMessageId?: string;
};

function splitEmails(value?: string | null) {
  return String(value || "")
    .split(/[;,]/)
    .map((email) => email.trim())
    .filter(Boolean);
}

function uniqueEmails(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function escapeHtml(value?: string | number | null) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function truncate(value?: string | null, limit = 1800) {
  const text = String(value || "").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trim()}...`;
}

function formatDate(value?: string | null) {
  if (!value) return "Non renseigne";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function buildCc(sharedBy: string, sharedTo: string) {
  const adminCopy = process.env.SHARE_ADMIN_EMAIL || "";
  const recipients = splitEmails(sharedTo).map((email) => email.toLowerCase());
  return uniqueEmails([sharedBy, ...splitEmails(adminCopy)]).filter(
    (email) => !recipients.includes(email.toLowerCase()),
  );
}

function emailDomain(email: string) {
  return email.split("@")[1]?.trim().toLowerCase() || "";
}

function allowedFromDomains() {
  return String(
    process.env.SHARE_ALLOWED_FROM_DOMAIN ||
      process.env.SHARE_ALLOWED_FROM_DOMAINS ||
      "",
  )
    .split(/[;,]/)
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

function canUseUserAsFrom(email: string) {
  const mode = String(process.env.SHARE_FROM_MODE || "default").toLowerCase();
  if (mode !== "user") return false;

  const domain = emailDomain(email);
  if (!domain) return false;

  const allowed = allowedFromDomains();
  if (allowed.length) return allowed.includes(domain);

  const fallbackFrom =
    process.env.SHARE_FROM_EMAIL ||
    process.env.EMAIL_FROM ||
    process.env.RESEND_FROM_EMAIL ||
    "";
  return domain === emailDomain(fallbackFrom);
}

function resolveShareFrom(sharedBy: string) {
  if (canUseUserAsFrom(sharedBy)) return sharedBy;

  return (
    process.env.SHARE_FROM_EMAIL ||
    process.env.EMAIL_FROM ||
    process.env.RESEND_FROM_EMAIL ||
    ""
  );
}

function buildShareContent(input: ShareDeliveryInput) {
  const subject = `[ACS Mail] ${input.email.subject || "Message archive"}`;
  const excerpt = truncate(input.email.body_text, 1600);
  const note = input.note?.trim();

  const lines = [
    "Bonjour,",
    `${input.sharedBy} partage avec vous un message archive ACS Mail Intelligence.`,
    `Sujet : ${input.email.subject || "Sans sujet"}`,
    `Expediteur : ${input.email.from_header || "Non renseigne"}`,
    `Destinataire original : ${input.email.to_header || "Non renseigne"}`,
    `Boite archive : ${input.email.mailbox || "Non renseignee"}`,
    `Date email : ${formatDate(input.email.email_date || input.email.imported_at)}`,
    note ? `Note : ${note}` : null,
    `Lien interne : ${input.detailUrl}`,
    excerpt ? `Extrait du message :\n${excerpt}` : null,
  ].filter(Boolean);

  const text = lines.join("\n\n");
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.55;color:#0f172a">
      <p>Bonjour,</p>
      <p><strong>${escapeHtml(input.sharedBy)}</strong> partage avec vous un message archive ACS Mail Intelligence.</p>
      <table style="border-collapse:collapse;margin:16px 0;width:100%">
        <tbody>
          <tr><td style="padding:6px 8px;border:1px solid #e2e8f0"><strong>Sujet</strong></td><td style="padding:6px 8px;border:1px solid #e2e8f0">${escapeHtml(input.email.subject || "Sans sujet")}</td></tr>
          <tr><td style="padding:6px 8px;border:1px solid #e2e8f0"><strong>Expediteur</strong></td><td style="padding:6px 8px;border:1px solid #e2e8f0">${escapeHtml(input.email.from_header || "Non renseigne")}</td></tr>
          <tr><td style="padding:6px 8px;border:1px solid #e2e8f0"><strong>Destinataire original</strong></td><td style="padding:6px 8px;border:1px solid #e2e8f0">${escapeHtml(input.email.to_header || "Non renseigne")}</td></tr>
          <tr><td style="padding:6px 8px;border:1px solid #e2e8f0"><strong>Boite archive</strong></td><td style="padding:6px 8px;border:1px solid #e2e8f0">${escapeHtml(input.email.mailbox || "Non renseignee")}</td></tr>
          <tr><td style="padding:6px 8px;border:1px solid #e2e8f0"><strong>Date email</strong></td><td style="padding:6px 8px;border:1px solid #e2e8f0">${escapeHtml(formatDate(input.email.email_date || input.email.imported_at))}</td></tr>
        </tbody>
      </table>
      ${note ? `<p><strong>Note :</strong> ${escapeHtml(note)}</p>` : ""}
      <p><a href="${escapeHtml(input.detailUrl)}">Ouvrir le message archive</a></p>
      ${excerpt ? `<pre style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;padding:12px">${escapeHtml(excerpt)}</pre>` : ""}
    </div>
  `;

  return { subject, text, html };
}

function buildMailtoUrl(to: string[], cc: string[], subject: string, text: string) {
  const params = new URLSearchParams();
  params.set("subject", subject);
  params.set("body", truncate(text, 1800));
  if (cc.length) params.set("cc", cc.join(","));
  return `mailto:${to.map(encodeURIComponent).join(",")}?${params.toString()}`;
}

export async function deliverMessageShare(
  input: ShareDeliveryInput,
): Promise<ShareDeliveryResult> {
  const to = splitEmails(input.sharedTo);
  const cc = buildCc(input.sharedBy, input.sharedTo);
  const { subject, text, html } = buildShareContent(input);
  const mailtoUrl = buildMailtoUrl(to, cc, subject, text);
  const apiKey = process.env.RESEND_API_KEY;
  const from = resolveShareFrom(input.sharedBy);

  if (!apiKey || !from) {
    return {
      status: "manual",
      provider: "mailto",
      to,
      cc,
      from: input.sharedBy,
      subject,
      mailtoUrl,
      reason: "Aucun service d'envoi serveur n'est configure.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        cc,
        subject,
        text,
        html,
        reply_to: input.sharedBy,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { id?: string; message?: string }
      | null;

    if (!response.ok) {
      return {
        status: "manual",
        provider: "mailto",
        to,
        cc,
        from,
        subject,
        mailtoUrl,
        reason:
          payload?.message ||
          `Envoi serveur indisponible (${response.status}). Brouillon email prepare.`,
      };
    }

    return {
      status: "sent",
      provider: "resend",
      to,
      cc,
      from,
      subject,
      mailtoUrl,
      providerMessageId: payload?.id,
    };
  } catch (error) {
    return {
      status: "manual",
      provider: "mailto",
      to,
      cc,
      from,
      subject,
      mailtoUrl,
      reason:
        error instanceof Error
          ? error.message
          : "Envoi serveur indisponible. Brouillon email prepare.",
    };
  }
}
