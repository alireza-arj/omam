import type { WorkSession } from "@prisma/client";

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
 * Month bounds in the host's local timezone.
 *
 * Sessions are stamped in local time, so UTC bounds silently drop the tail of
 * every month and pull in the head of the next — 3.5 hours per month for
 * Iran (UTC+03:30). Run the API in the same timezone as its users; a
 * per-user zone would have to be stored on the account.
 */
export function startOfMonth(month: string) {
  const [year, monthValue] = month.split("-").map(Number);

  return new Date(year, monthValue - 1, 1, 0, 0, 0, 0);
}

export function endOfMonth(month: string) {
  const [year, monthValue] = month.split("-").map(Number);

  return new Date(new Date(year, monthValue, 1, 0, 0, 0, 0).getTime() - 1);
}

export function normalizeMonth(input?: string) {
  if (input && /^\d{4}-\d{2}$/.test(input)) {
    return input;
  }

  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");

  return `${now.getFullYear()}-${month}`;
}

/** `YYYY-MM-DD` in the host's local timezone, matching `startOfMonth`. */
export function localDayKey(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}
