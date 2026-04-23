const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const compactNumberFormatter = new Intl.NumberFormat("it-IT", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const shortDateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
});

const fullDateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatCurrency(value?: number | null) {
  return currencyFormatter.format(Number(value ?? 0));
}

export function formatCompactNumber(value?: number | null) {
  return compactNumberFormatter.format(Number(value ?? 0));
}

export function formatShortDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return shortDateFormatter.format(date);
}

export function formatFullDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return fullDateFormatter.format(date);
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return dateTimeFormatter.format(date);
}

export function formatRelativeDate(value?: string | null) {
  if (!value) return "Nessuna attivita recente";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data non valida";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 1) return "Pochi secondi fa";
  if (diffMinutes < 60) return `${diffMinutes} min fa`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} h fa`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays <= 30) return `${diffDays} g fa`;

  return fullDateFormatter.format(date);
}

export function formatPercent(value?: number | null, digits = 0) {
  const current = Number(value ?? 0);
  return `${current.toFixed(digits)}%`;
}

export function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}