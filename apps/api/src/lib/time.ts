import {
  DEFAULT_CALENDAR,
  dayKey,
  monthKey,
  monthRange,
  normalizeMonthKey,
  type CalendarSystem,
} from "@omam/calendar";
import type { WorkSession } from "@prisma/client";

export { DEFAULT_CALENDAR, type CalendarSystem };

export function minutesBetween(startAt: Date, endAt: Date) {
  return Math.max(0, Math.round((endAt.getTime() - startAt.getTime()) / 60000));
}

export function calculateSessionMinutes(session: Pick<WorkSession, "startAt" | "endAt">) {
  if (!session.endAt) {
    return 0;
  }

  return minutesBetween(session.startAt, session.endAt);
}

/**
 * Month bounds in the host's local timezone and the caller's calendar.
 *
 * Sessions are stamped in local time, so UTC bounds silently drop the tail of
 * every month and pull in the head of the next — 3.5 hours per month for
 * Iran (UTC+03:30). Run the API with `TZ` set to the team's zone; a per-user
 * zone would have to be stored on the account.
 *
 * Under Jalali a `YYYY-MM` key names a Shamsi month, so `1405-06` runs from
 * 23 August to 22 September 2026 rather than across a Gregorian month.
 */
export function startOfMonth(month: string, calendar: CalendarSystem = DEFAULT_CALENDAR) {
  return monthRange(month, calendar).from;
}

export function endOfMonth(month: string, calendar: CalendarSystem = DEFAULT_CALENDAR) {
  return monthRange(month, calendar).to;
}

export function normalizeMonth(input?: string, calendar: CalendarSystem = DEFAULT_CALENDAR) {
  return normalizeMonthKey(input, calendar);
}

/** The month key plus its absolute bounds — what every report starts from. */
export function monthWindow(input: string | undefined, calendar: CalendarSystem) {
  const month = normalizeMonth(input, calendar);
  const { from, to } = monthRange(month, calendar);

  return { month, calendar, from, to };
}

/** `YYYY-MM-DD` in the host's local timezone, matching `startOfMonth`. */
export function localDayKey(date: Date, calendar: CalendarSystem = DEFAULT_CALENDAR) {
  return dayKey(date, calendar);
}

/** `YYYY-MM` in the host's local timezone and the given calendar. */
export function localMonthKey(date: Date, calendar: CalendarSystem = DEFAULT_CALENDAR) {
  return monthKey(date, calendar);
}

export function hoursFromMinutes(minutes: number) {
  return Number((minutes / 60).toFixed(2));
}

/** `7h 30m`, the one duration format the exports and the panel share. */
export function formatDuration(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));

  return `${Math.floor(safe / 60)}h ${String(safe % 60).padStart(2, "0")}m`;
}
