import {
  addDays,
  addMonths,
  dayKey,
  formatDayLabel,
  formatMonthLabel,
  formatShortDayMonth,
  shortWeekdayNames,
  startOfDay,
  startOfWeek,
  toParts,
  type CalendarSystem,
} from "@omam/calendar";
import type { Language, Translator } from "@omam/i18n";
import type { SessionDto } from "@omam/contracts";
import { sessionMinutes } from "./format";

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

const DAYS_PER_MONTH = 30;
const WEEKS_PER_MONTH = 30 / 7;

/** The screen pairs each key with its translated label. */
export const reportPeriods: ReportPeriod[] = ["DAY", "WEEK", "MONTH"];

function endOfRange(exclusiveEnd: Date) {
  return new Date(exclusiveEnd.getTime() - 1);
}

/**
 * The window a report covers, `offset` periods back from today.
 *
 * Days are the same in either calendar — both break at local midnight — but
 * weeks and months are not: a Jalali week starts on Shanbe and a Jalali month
 * on the 1st of Farvardin, Ordibehesht and so on.
 */
export function getPeriodRange(
  period: ReportPeriod,
  offset: number,
  calendar: CalendarSystem,
  reference = new Date(),
): ReportRange {
  const base = startOfDay(reference);

  if (period === "DAY") {
    const from = addDays(base, offset);

    return { from, to: endOfRange(addDays(from, 1)) };
  }

  if (period === "WEEK") {
    const from = addDays(startOfWeek(base, calendar), offset * 7);

    return { from, to: endOfRange(addDays(from, 7)) };
  }

  const from = addMonths(base, offset, calendar);

  return { from, to: endOfRange(addMonths(from, 1, calendar)) };
}

export function formatRangeLabel(
  period: ReportPeriod,
  range: ReportRange,
  offset: number,
  calendar: CalendarSystem,
  language: Language,
  t: Translator,
) {
  if (period === "DAY") {
    if (offset === 0) return t("report.today");
    if (offset === -1) return t("report.yesterday");

    return formatDayLabel(range.from, calendar, language);
  }

  if (period === "WEEK") {
    if (offset === 0) return t("report.thisWeek");

    return `${formatShortDayMonth(range.from, calendar, language)} - ${formatShortDayMonth(range.to, calendar, language)}`;
  }

  return formatMonthLabel(range.from, calendar, language);
}

export function getPeriodGoalHours(period: ReportPeriod, monthlyGoalHours: number) {
  if (period === "DAY") return monthlyGoalHours / DAYS_PER_MONTH;
  if (period === "WEEK") return monthlyGoalHours / WEEKS_PER_MONTH;

  return monthlyGoalHours;
}

function buildBuckets(
  period: ReportPeriod,
  range: ReportRange,
  calendar: CalendarSystem,
  language: Language,
): ReportBucket[] {
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
  const weekdays = shortWeekdayNames(calendar, language);
  const cursor = new Date(range.from);

  while (cursor.getTime() <= range.to.getTime()) {
    buckets.push({
      key: dayKey(cursor, calendar),
      label: period === "WEEK" ? weekdays[cursor.getDay()] : `${toParts(cursor, calendar).day}`,
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
  calendar: CalendarSystem,
  language: Language,
): ReportTotals {
  const buckets = buildBuckets(period, range, calendar, language);
  const bucketIndex = new Map(buckets.map((bucket, index) => [bucket.key, index]));
  const workedDays = new Set<string>();
  const categoryMinutes = { onsite: 0, remote: 0 };
  let totalMinutes = 0;

  for (const session of sessions) {
    const minutes = sessionMinutes(session);
    const startAt = new Date(session.startAt);

    workedDays.add(dayKey(startAt, calendar));

    if (!minutes) {
      continue;
    }

    totalMinutes += minutes;

    if (session.category === "REMOTE") {
      categoryMinutes.remote += minutes;
    } else {
      categoryMinutes.onsite += minutes;
    }

    const key =
      period === "DAY" ? `${Math.floor(startAt.getHours() / 2) * 2}` : dayKey(startAt, calendar);
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

function formatDayHeading(
  iso: string,
  calendar: CalendarSystem,
  language: Language,
  t: Translator,
) {
  const day = startOfDay(new Date(iso));
  const today = startOfDay(new Date());
  const distance = Math.round((day.getTime() - today.getTime()) / 86_400_000);

  if (distance === 0) return t("report.today");
  if (distance === -1) return t("report.yesterday");

  return formatDayLabel(day, calendar, language);
}

/**
 * One accordion section per day. A month of sessions reads as a handful of
 * dated rows instead of a wall of repeated dates.
 */
export function groupSessionsByDay(
  sessions: SessionDto[],
  calendar: CalendarSystem,
  language: Language,
  t: Translator,
): SessionDay[] {
  const groups = new Map<string, SessionDto[]>();

  for (const session of sessions) {
    const key = dayKey(new Date(session.startAt), calendar);
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
      label: formatDayHeading(daySessions[0].startAt, calendar, language, t),
      sessions: daySessions,
      totalMinutes: daySessions.reduce((total, session) => total + sessionMinutes(session), 0),
    }));
}
