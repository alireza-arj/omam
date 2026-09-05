import {
  addMonths,
  formatDayLabel,
  formatDayMonth,
  formatMonthLabel,
  monthKey,
  monthRange,
  type CalendarSystem,
} from "@omam/calendar";
import type { Currency } from "@omam/contracts";

/** `7h 30m` — the one duration format the API, the exports and the panel share. */
export function formatDuration(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));

  return `${Math.floor(safe / 60)}h ${String(safe % 60).padStart(2, "0")}m`;
}

export function formatHours(minutes: number) {
  return (Math.max(0, minutes) / 60).toFixed(1);
}

const CURRENCY_LABEL: Record<Currency, string> = {
  IRR: "IRR",
  USD: "$",
  EUR: "€",
};

/**
 * Rial amounts are large and have no meaningful minor unit, so they are shown
 * whole; USD and EUR keep two decimals.
 */
export function formatMoney(amount: number, currency: Currency) {
  const fractionDigits = currency === "IRR" ? 0 : 2;
  const value = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);

  return currency === "IRR" ? `${value} ${CURRENCY_LABEL.IRR}` : `${CURRENCY_LABEL[currency]}${value}`;
}

/** A clock time. `Intl` is fine here — it is a time, not a date. */
export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string, calendar: CalendarSystem) {
  return formatDayMonth(new Date(iso), calendar);
}

export function formatDayWithWeekday(iso: string, calendar: CalendarSystem) {
  return formatDayLabel(new Date(iso), calendar);
}

export function formatDateTime(iso: string, calendar: CalendarSystem) {
  return `${formatDate(iso, calendar)} · ${formatTime(iso)}`;
}

export function monthLabel(month: string, calendar: CalendarSystem) {
  return formatMonthLabel(monthRange(month, calendar).from, calendar);
}

/** Moves a `YYYY-MM` key by whole months inside its own calendar. */
export function shiftMonth(month: string, delta: number, calendar: CalendarSystem) {
  return monthKey(addMonths(monthRange(month, calendar).from, delta, calendar), calendar);
}

export function currentMonth(calendar: CalendarSystem) {
  return monthKey(new Date(), calendar);
}

/** Day key (`YYYY-MM-DD`) → a short axis label such as `12`. */
export function dayNumber(dayKey: string) {
  return dayKey.slice(8);
}

export function initials(name: string) {
  const trimmed = name.trim();

  if (!trimmed) {
    return "?";
  }

  const parts = trimmed.split(/\s+/);

  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : trimmed.slice(0, 2)).toUpperCase();
}

export function displayName(entry: { nickname: string | null; username: string }) {
  return entry.nickname?.trim() || entry.username;
}
