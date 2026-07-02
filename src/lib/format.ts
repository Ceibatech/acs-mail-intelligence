import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

export function formatNumber(value: unknown) {
  return Number(value || 0).toLocaleString("fr-FR");
}

export function formatBytes(value: unknown) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 o";

  const units = ["o", "Ko", "Mo", "Go"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const amount = bytes / 1024 ** index;

  return `${amount.toLocaleString("fr-FR", {
    maximumFractionDigits: index === 0 ? 0 : 1,
  })} ${units[index]}`;
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) return "Non renseigné";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (Number.isNaN(date.getTime())) return "Date invalide";

  return format(date, "dd/MM/yyyy HH:mm", { locale: fr });
}

export function formatDate(value?: string | Date | null) {
  if (!value) return "Non renseigné";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (Number.isNaN(date.getTime())) return "Date invalide";

  return format(date, "dd/MM/yyyy", { locale: fr });
}

export function relativeDate(value?: string | Date | null) {
  if (!value) return "Jamais";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (Number.isNaN(date.getTime())) return "Date invalide";

  return formatDistanceToNowStrict(date, { addSuffix: true, locale: fr });
}

export function formatDurationMs(milliseconds?: number | null) {
  if (!milliseconds || milliseconds < 0) return "Non calculé";
  const seconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes <= 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
}
