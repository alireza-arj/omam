import {
  dayKey,
  formatDayLabel as formatCalendarDayLabel,
  formatMonthLabel,
  parseDayKey,
  toDate,
  type CalendarSystem,
} from "@omam/calendar";
import { formatDurationShort, type Language, type Translator } from "@omam/i18n";
import type { Currency, SessionDto } from "@omam/contracts";

const locale = "en-US";

function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatCurrency(value: number, currency: Currency, t: Translator) {
  if (currency === "IRR") {
    return `${formatNumber(Math.round(value))} ${t("units.toman")}`;
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Runtime as `1h 56m` in English and `1:56` in Persian. */
export function formatShortMinutes(totalMinutes: number, language: Language) {
  return formatDurationShort(totalMinutes, language);
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
export function formatMonth(month: string, calendar: CalendarSystem, language: Language) {
  return formatMonthLabel(month, calendar, language);
}

/** `Seshanbe, 10 Shahrivar` */
export function formatDayLabel(iso: string, calendar: CalendarSystem, language: Language) {
  return formatCalendarDayLabel(new Date(iso), calendar, language);
}

export function formatClock(iso: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatSessionRange(session: SessionDto, t: Translator) {
  const start = formatClock(session.startAt);

  return session.endAt
    ? `${start} \u2013 ${formatClock(session.endAt)}`
    : `${start} \u2013 ${t("units.now")}`;
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
