import type { SessionDto } from "@omam/contracts";
import { localDayKey, sessionMinutes } from "./format";

export type ReportPeriod = "DAY" | "WEEK" | "MONTH";

export type ReportRange = {
  from: Date;
  to: Date;
};

export type ReportBucket = {
  key: string;
  label: string;
  minutes: number;
};

export type ReportTotals = {
  totalMinutes: number;
  totalIncome: number;
  workedDays: number;
  sessionCount: number;
  categoryMinutes: {
    onsite: number;
    remote: number;
  };
  buckets: ReportBucket[];
};

const locale = "en-US";
const WEEK_START_DAY = 6;
const DAYS_PER_MONTH = 30;
const WEEKS_PER_MONTH = 30 / 7;

export const reportPeriods: { key: ReportPeriod; label: string }[] = [
  { key: "DAY", label: "Daily" },
  { key: "WEEK", label: "Weekly" },
  { key: "MONTH", label: "Monthly" },
];

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);

  return next;
}

function endOfRange(exclusiveEnd: Date) {
  return new Date(exclusiveEnd.getTime() - 1);
}

export function getPeriodRange(period: ReportPeriod, offset: number, reference = new Date()): ReportRange {
  const base = startOfDay(reference);

  if (period === "DAY") {
    const from = new Date(base);
    from.setDate(from.getDate() + offset);

    const exclusiveEnd = new Date(from);
    exclusiveEnd.setDate(exclusiveEnd.getDate() + 1);

    return { from, to: endOfRange(exclusiveEnd) };
  }

  if (period === "WEEK") {
    const diff = (base.getDay() - WEEK_START_DAY + 7) % 7;
    const from = new Date(base);
    from.setDate(from.getDate() - diff + offset * 7);

    const exclusiveEnd = new Date(from);
    exclusiveEnd.setDate(exclusiveEnd.getDate() + 7);

    return { from, to: endOfRange(exclusiveEnd) };
  }

  const from = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const exclusiveEnd = new Date(from.getFullYear(), from.getMonth() + 1, 1);

  return { from, to: endOfRange(exclusiveEnd) };
}

export function formatRangeLabel(period: ReportPeriod, range: ReportRange, offset: number) {
  if (period === "DAY") {
    if (offset === 0) return "Today";
    if (offset === -1) return "Yesterday";

    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      month: "short",
      day: "numeric",
    }).format(range.from);
  }

  if (period === "WEEK") {
    if (offset === 0) return "This week";

    const formatter = new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
    });

    return `${formatter.format(range.from)} - ${formatter.format(range.to)}`;
  }

  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(range.from);
}

export function getPeriodGoalHours(period: ReportPeriod, monthlyGoalHours: number) {
  if (period === "DAY") return monthlyGoalHours / DAYS_PER_MONTH;
  if (period === "WEEK") return monthlyGoalHours / WEEKS_PER_MONTH;

  return monthlyGoalHours;
}

function buildBuckets(period: ReportPeriod, range: ReportRange): ReportBucket[] {
  if (period === "DAY") {
    return Array.from({ length: 12 }, (_, index) => {
      const hour = index * 2;

      return {
        key: `${hour}`,
        label: `${`${hour}`.padStart(2, "0")}`,
        minutes: 0,
      };
    });
  }

  const buckets: ReportBucket[] = [];
  const cursor = new Date(range.from);
  const dayFormatter = new Intl.DateTimeFormat(locale, { weekday: "narrow" });

  while (cursor.getTime() <= range.to.getTime()) {
    buckets.push({
      key: localDayKey(cursor),
      label: period === "WEEK" ? dayFormatter.format(cursor) : `${cursor.getDate()}`,
      minutes: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return buckets;
}

export function summarizeSessions(
  sessions: SessionDto[],
  hourlyRate: number,
  period: ReportPeriod,
  range: ReportRange,
): ReportTotals {
  const buckets = buildBuckets(period, range);
  const bucketIndex = new Map(buckets.map((bucket, index) => [bucket.key, index]));
  const workedDays = new Set<string>();
  const categoryMinutes = { onsite: 0, remote: 0 };
  let totalMinutes = 0;

  for (const session of sessions) {
    const minutes = sessionMinutes(session);
    const startAt = new Date(session.startAt);

    workedDays.add(localDayKey(startAt));

    if (!minutes) {
      continue;
    }

    totalMinutes += minutes;

    if (session.category === "REMOTE") {
      categoryMinutes.remote += minutes;
    } else {
      categoryMinutes.onsite += minutes;
    }

    const key = period === "DAY" ? `${Math.floor(startAt.getHours() / 2) * 2}` : localDayKey(startAt);
    const index = bucketIndex.get(key);

    if (index !== undefined) {
      buckets[index].minutes += minutes;
    }
  }

  return {
    totalMinutes,
    totalIncome: Number(((totalMinutes / 60) * hourlyRate).toFixed(2)),
    workedDays: workedDays.size,
    sessionCount: sessions.length,
    categoryMinutes,
    buckets,
  };
}

export type SessionDay = {
  key: string;
  label: string;
  sessions: SessionDto[];
  totalMinutes: number;
};

function formatDayHeading(iso: string) {
  const day = startOfDay(new Date(iso));
  const today = startOfDay(new Date());
  const distance = Math.round((day.getTime() - today.getTime()) / 86_400_000);

  if (distance === 0) return "Today";
  if (distance === -1) return "Yesterday";

  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(day);
}

/**
 * One accordion section per day. A month of sessions reads as a handful of
 * dated rows instead of a wall of repeated dates.
 */
export function groupSessionsByDay(sessions: SessionDto[]): SessionDay[] {
  const groups = new Map<string, SessionDto[]>();

  for (const session of sessions) {
    const key = localDayKey(new Date(session.startAt));
    const bucket = groups.get(key);

    if (bucket) {
      bucket.push(session);
    } else {
      groups.set(key, [session]);
    }
  }

  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([key, daySessions]) => ({
      key,
      label: formatDayHeading(daySessions[0].startAt),
      sessions: daySessions,
      totalMinutes: daySessions.reduce((total, session) => total + sessionMinutes(session), 0),
    }));
}
