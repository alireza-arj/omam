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

export function formatShortMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
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
  const date = new Date(`${month}-01T00:00:00.000Z`);
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(date);
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
  const end = session.endAt ? formatClock(session.endAt) : "Running";
  return `${start} to ${end}`;
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
