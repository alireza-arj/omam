import {
  dayKey,
  formatDayLabel as formatCalendarDayLabel,
  formatMonthLabel,
  parseDayKey,
  toDate,
  type CalendarSystem,
} from "@omam/calendar";
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
      notation: "compact",
    }).format(value);
  }

  const abs = Math.abs(Math.round(value));

  if (abs >= 1_000_000) {
    const compact = Math.round((value / 1_000_000) * 10) / 10;
    return `${formatNumber(compact)}M`;
  }

  if (abs >= 1_000) {
    const compact = Math.round((value / 1_000) * 10) / 10;
    return `${formatNumber(compact)}K`;
  }

  return `${formatNumber(Math.round(value))}`;
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

/** `Shahrivar 1405` from a `YYYY-MM` key in the active calendar. */
export function formatMonth(month: string, calendar: CalendarSystem) {
  return formatMonthLabel(month, calendar);
}

/** `Seshanbe, 10 Shahrivar` */
export function formatDayLabel(iso: string, calendar: CalendarSystem) {
  return formatCalendarDayLabel(new Date(iso), calendar);
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

/** `YYYY-MM-DD` for a text field, in the active calendar and local time. */
export function toDateInput(iso: string, calendar: CalendarSystem) {
  return dayKey(new Date(iso), calendar);
}

/** `HH:MM` for a text field, in local time. */
export function toTimeInput(iso: string) {
  const date = new Date(iso);
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${hours}:${minutes}`;
}

const TIME_INPUT_PATTERN = /^(\d{1,2}):(\d{2})$/;

/**
 * Builds a local-time `Date` from a `YYYY-MM-DD` field read in `calendar` and
 * an `HH:MM` field. Returns null when either is malformed or names a day that
 * does not exist — 31 Esfand in a common year, 31 April — so the caller can
 * surface the error instead of storing a silently rolled-over date.
 */
export function parseLocalDateTime(
  dateText: string,
  timeText: string,
  calendar: CalendarSystem,
): Date | null {
  const parts = parseDayKey(dateText, calendar);
  const timeMatch = TIME_INPUT_PATTERN.exec(timeText.trim());

  if (!parts || !timeMatch) {
    return null;
  }

  const [, hours, minutes] = timeMatch.map(Number);

  if (hours > 23 || minutes > 59) {
    return null;
  }

  return toDate(parts, calendar, hours, minutes);
}
