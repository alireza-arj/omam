import type { Currency, SessionDto } from "@omam/contracts";
import type { AppLanguage } from "../i18n/translations";

function localeOf(language: AppLanguage) {
  return language === "fa" ? "fa-IR" : "en-US";
}

function formatNumber(value: number, language: AppLanguage, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(localeOf(language), options).format(value);
}

export function formatCurrency(value: number, currency: Currency, language: AppLanguage = "fa") {
  if (currency === "USD") {
    return new Intl.NumberFormat(localeOf(language), {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }
  const label = language === "fa" ? "تومان" : "Toman";
  return `${formatNumber(Math.round(value), language)} ${label}`;
}

export function formatMinutes(totalMinutes: number, language: AppLanguage = "fa") {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (language === "en") {
    if (!hours) {
      return `${formatNumber(minutes, language)} min`;
    }
    if (!minutes) {
      return `${formatNumber(hours, language)} hr`;
    }
    return `${formatNumber(hours, language)} hr ${formatNumber(minutes, language)} min`;
  }
  if (!hours) {
    return `${formatNumber(minutes, language)} دقیقه`;
  }
  if (!minutes) {
    return `${formatNumber(hours, language)} ساعت`;
  }
  return `${formatNumber(hours, language)} ساعت و ${formatNumber(minutes, language)} دقیقه`;
}

export function formatShortMinutes(totalMinutes: number, language: AppLanguage = "fa") {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (language === "en") {
    return `${formatNumber(hours, language)}h ${formatNumber(minutes, language)}m`;
  }
  return `${formatNumber(hours, language)}س ${formatNumber(minutes, language)}د`;
}

export function formatDurationHms(totalSeconds: number, language: AppLanguage = "fa") {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const formatter = new Intl.NumberFormat(localeOf(language), {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });
  return `${formatter.format(hours)}:${formatter.format(minutes)}:${formatter.format(seconds)}`;
}

export function formatMonth(month: string, language: AppLanguage = "fa") {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  return new Intl.DateTimeFormat(localeOf(language), {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDayLabel(iso: string, language: AppLanguage = "fa") {
  return new Intl.DateTimeFormat(localeOf(language), {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function formatClock(iso: string, language: AppLanguage = "fa") {
  return new Intl.DateTimeFormat(localeOf(language), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatSessionRange(session: SessionDto, language: AppLanguage = "fa") {
  const start = formatClock(session.startAt, language);
  const end = session.endAt ? formatClock(session.endAt, language) : language === "fa" ? "در حال اجرا" : "Running";
  const joiner = language === "fa" ? "تا" : "to";
  return `${start} ${joiner} ${end}`;
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

export function currentMonthKey() {
  const now = new Date();
  const month = `${now.getUTCMonth() + 1}`.padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}
