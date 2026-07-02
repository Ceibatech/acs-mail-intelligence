export type SqlValue = string | number | boolean | Date | null;

export function clampPage(value: string | null, fallback = 1) {
  return Math.max(Number(value || fallback) || fallback, 1);
}

export function clampPageSize(value: string | null, fallback = 50) {
  const size = Number(value || fallback) || fallback;
  if (size <= 25) return 25;
  if (size <= 50) return 50;
  return Math.min(size, 100);
}

export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export function likeValue(value: string) {
  return `%${escapeLike(value.trim())}%`;
}

export function numberOrNull(value: string | null) {
  if (!value) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function normalizeDateInput(value: string | null) {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
