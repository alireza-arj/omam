import {
  addMonths,
  formatDayLabel,
  formatDayMonth,
  formatMonthLabel,
  monthKey,
  monthRange,
  type CalendarSystem,
} from "@omam/calendar";
import {
  formatDurationShort,
  formatNumber,
  type Language,
  type Translator,
} from "@omam/i18n";
import type { Currency } from "@omam/contracts";

/** `7h 30m` in English, `7:30` in Persian — the same as the app shows. */
export function formatDuration(minutes: number, language: Language) {
  return formatDurationShort(minutes, language);
}

export function formatHours(minutes: number) {
  return (Math.max(0, minutes) / 60).toFixed(1);
}

const SYMBOL: Record<Exclude<Currency, "IRR">, string> = {
  USD: "$",
  EUR: "€",
};

export function currencyLabel(currency: Currency, t: Translator) {
  return currency === "IRR" ? t("units.toman") : t(`admin.currency.${currency}`);
}

/**
 * Rial amounts are large and have no meaningful minor unit, so they are shown
 * whole; USD and EUR keep two decimals.
 */
export function formatMoney(amount: number, currency: Currency, t: Translator, withSign = false) {
  const sign = withSign && amount > 0 ? "+" : "";

  if (currency === "IRR") {
    return `\u2066${sign}${formatNumber(Math.round(amount))}\u2069 ${t("units.toman")}`;
  }

  return `\u2066${sign}${SYMBOL[currency]}${formatNumber(amount, 2)}\u2069`;
}

/** A clock time. `Intl` is fine here — it is a time, not a date. */
export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string, calendar: CalendarSystem, language: Language) {
  return formatDayMonth(new Date(iso), calendar, language);
}

export function formatDayWithWeekday(iso: string, calendar: CalendarSystem, language: Language) {
  return formatDayLabel(new Date(iso), calendar, language);
}

export function formatDateTime(iso: string, calendar: CalendarSystem, language: Language) {
  return `${formatDate(iso, calendar, language)} · ${formatTime(iso)}`;
}

export function monthLabel(month: string, calendar: CalendarSystem, language: Language) {
  return formatMonthLabel(monthRange(month, calendar).from, calendar, language);
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
