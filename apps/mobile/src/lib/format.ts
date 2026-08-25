import type { Currency, SessionDto } from "@omam/contracts";

const locale = "en-US";

function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatCurrency(value: number, currency: Currency) {
  if (currency === "USD") {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }
  return `${formatNumber(Math.round(value))} Toman`;
}

export function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) {
    return `${formatNumber(minutes)} min`;
  }
  if (!minutes) {
    return `${formatNumber(hours)} hr`;
  }
  return `${formatNumber(hours)} hr ${formatNumber(minutes)} min`;
}

/** Runtime as `1h 56m`, per the design system's number rules. */
export function formatShortMinutes(totalMinutes: number) {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;

  if (!hours) {
    return `${formatNumber(minutes)}m`;
  }

  if (!minutes) {
    return `${formatNumber(hours)}h`;
  }

  return `${formatNumber(hours)}h ${formatNumber(minutes)}m`;
}

export function formatDurationHms(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const formatter = new Intl.NumberFormat(locale, {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });
  return `${formatter.format(hours)}:${formatter.format(minutes)}:${formatter.format(seconds)}`;
}

export function formatMonth(month: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(localMonthRange(month).from);
}

export function formatDayLabel(iso: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function formatClock(iso: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatSessionRange(session: SessionDto) {
  const start = formatClock(session.startAt);

  return session.endAt ? `${start} \u2013 ${formatClock(session.endAt)}` : `${start} \u2013 now`;
}

/** Metadata joined with a thin middot: `Monday · On-site · 7h 30m`. */
export function joinMeta(...parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(" \u00b7 ");
}

export function sessionMinutes(session: SessionDto) {
  if (!session.endAt) {
    return 0;
  }
  if (typeof session.durationMinutes === "number") {
    return Math.max(0, session.durationMinutes);
  }
  return Math.max(0, Math.round((new Date(session.endAt).getTime() - new Date(session.startAt).getTime()) / 60000));
}

/* ── editable date and time ──────────────────────────────────────────────── */

/** `YYYY-MM-DD` for a text field, in local time. */
export function toDateInput(iso: string) {
  return localDayKey(new Date(iso));
}

/** `HH:MM` for a text field, in local time. */
export function toTimeInput(iso: string) {
  const date = new Date(iso);
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${hours}:${minutes}`;
}

const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_INPUT_PATTERN = /^(\d{1,2}):(\d{2})$/;

/**
 * Builds a local-time `Date` from a `YYYY-MM-DD` and an `HH:MM` field. Returns
 * null when either is malformed or names a day that does not exist, so the
 * caller can surface the error instead of storing a silent `Invalid Date`.
 */
export function parseLocalDateTime(dateText: string, timeText: string): Date | null {
  const dateMatch = DATE_INPUT_PATTERN.exec(dateText.trim());
  const timeMatch = TIME_INPUT_PATTERN.exec(timeText.trim());

  if (!dateMatch || !timeMatch) {
    return null;
  }

  const [, year, month, day] = dateMatch.map(Number);
  const [, hours, minutes] = timeMatch.map(Number);

  if (hours > 23 || minutes > 59) {
    return null;
  }

  const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0);

  // Rejects 2026-02-31, which `Date` would silently roll into March.
  if (parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    return null;
  }

  return parsed;
}

export function currentMonthKey() {
  return localDayKey(new Date()).slice(0, 7);
}

/**
 * `YYYY-MM-DD` in the device's timezone.
 *
 * Sessions are stamped in local time, so an ISO-UTC date prefix buckets the
 * wrong day for every zone with a non-zero offset — in Iran (UTC+03:30) a
 * session starting at 00:30 belongs to the previous UTC day.
 */
export function localDayKey(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Local-time bounds of a `YYYY-MM` key, `to` inclusive of the final
 * millisecond. UTC bounds would drop the last hours of every month and pull in
 * the first hours of the next one.
 */
export function localMonthRange(month: string): { from: Date; to: Date } {
  const [yearValue, monthValue] = month.split("-").map(Number);
  const reference = new Date();
  const year = Number.isFinite(yearValue) ? yearValue : reference.getFullYear();
  const monthIndex = Number.isFinite(monthValue) ? monthValue - 1 : reference.getMonth();

  const from = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const to = new Date(new Date(year, monthIndex + 1, 1, 0, 0, 0, 0).getTime() - 1);

  return { from, to };
}
