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

export function startOfMonth(month: string) {
  return new Date(`${month}-01T00:00:00.000Z`);
}

export function endOfMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);

  return new Date(Date.UTC(year, monthIndex, 0, 23, 59, 59, 999));
}

export function normalizeMonth(input?: string) {
  if (input && /^\d{4}-\d{2}$/.test(input)) {
    return input;
  }

  const now = new Date();
  const month = `${now.getUTCMonth() + 1}`.padStart(2, "0");

  return `${now.getUTCFullYear()}-${month}`;
}
