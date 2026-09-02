import {
  gregorianToJalali,
  isLeapJalaliYear,
  jalaliMonthLength,
  jalaliToGregorian,
  type YearMonthDay,
} from "./jalali";

export {
  gregorianToJalali,
  isLeapJalaliYear,
  jalaliMonthLength,
  jalaliToGregorian,
  MAX_JALALI_YEAR,
  MIN_JALALI_YEAR,
  type YearMonthDay,
} from "./jalali";

/**
 * The calendar a user reads dates in. Instants are always stored as absolute
 * ISO-8601 strings; this only decides how a given instant is split into a
 * year, a month and a day, and therefore where month boundaries fall.
 */
export type CalendarSystem = "JALALI" | "GREGORIAN";

export const CALENDAR_SYSTEMS = ["JALALI", "GREGORIAN"] as const;

export const DEFAULT_CALENDAR: CalendarSystem = "JALALI";

export function isCalendarSystem(value: unknown): value is CalendarSystem {
  return value === "JALALI" || value === "GREGORIAN";
}

export function asCalendarSystem(value: unknown, fallback = DEFAULT_CALENDAR): CalendarSystem {
  return isCalendarSystem(value) ? value : fallback;
}

/* ── names ──────────────────────────────────────────────────────────────── */

const JALALI_MONTHS = [
  "Farvardin",
  "Ordibehesht",
  "Khordad",
  "Tir",
  "Mordad",
  "Shahrivar",
  "Mehr",
  "Aban",
  "Azar",
  "Dey",
  "Bahman",
  "Esfand",
];

const JALALI_MONTHS_SHORT = [
  "Far",
  "Ord",
  "Kho",
  "Tir",
  "Mor",
  "Sha",
  "Mehr",
  "Aban",
  "Azar",
  "Dey",
  "Bah",
  "Esf",
];

const GREGORIAN_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const GREGORIAN_MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Indexed by `Date.prototype.getDay()`, so position 0 is Sunday. */
const JALALI_WEEKDAYS = [
  "Yekshanbe",
  "Doshanbe",
  "Seshanbe",
  "Chaharshanbe",
  "Panjshanbe",
  "Jome",
  "Shanbe",
];

const JALALI_WEEKDAYS_SHORT = ["Ye", "Do", "Se", "Ch", "Pa", "Jo", "Sh"];

const GREGORIAN_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const GREGORIAN_WEEKDAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function monthNames(calendar: CalendarSystem) {
  return calendar === "JALALI" ? JALALI_MONTHS : GREGORIAN_MONTHS;
}

export function shortMonthNames(calendar: CalendarSystem) {
  return calendar === "JALALI" ? JALALI_MONTHS_SHORT : GREGORIAN_MONTHS_SHORT;
}

export function weekdayNames(calendar: CalendarSystem) {
  return calendar === "JALALI" ? JALALI_WEEKDAYS : GREGORIAN_WEEKDAYS;
}

export function shortWeekdayNames(calendar: CalendarSystem) {
  return calendar === "JALALI" ? JALALI_WEEKDAYS_SHORT : GREGORIAN_WEEKDAYS_SHORT;
}

/** `Date.prototype.getDay()` of the first day of the week: Saturday for Jalali. */
export function weekStartDay(calendar: CalendarSystem) {
  return calendar === "JALALI" ? 6 : 0;
}

/* ── conversion ─────────────────────────────────────────────────────────── */

/**
 * The civil year/month/day an instant falls on, in the device's timezone.
 *
 * Local time is deliberate: a session clocked in at 00:30 in Tehran belongs to
 * that day, not to the previous UTC one.
 */
export function toParts(date: Date, calendar: CalendarSystem): YearMonthDay {
  if (calendar === "GREGORIAN") {
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
  }

  return gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/**
 * A local-time `Date` from calendar parts, or null when the parts name a day
 * that does not exist (31 Esfand, 31 April). Returning null lets callers show
 * the error instead of storing a silently rolled-over date.
 */
export function toDate(
  parts: YearMonthDay,
  calendar: CalendarSystem,
  hours = 0,
  minutes = 0,
  seconds = 0,
  milliseconds = 0,
): Date | null {
  const { year, month, day } = parts;

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > monthLength(year, month, calendar)) {
    return null;
  }

  const gregorian =
    calendar === "GREGORIAN" ? { year, month, day } : jalaliToGregorian(year, month, day);

  const built = new Date(
    gregorian.year,
    gregorian.month - 1,
    gregorian.day,
    hours,
    minutes,
    seconds,
    milliseconds,
  );

  // `new Date(75, 0, 1)` is 1975, not year 75. Years under 100 need setting.
  if (gregorian.year >= 0 && gregorian.year < 100) {
    built.setFullYear(gregorian.year);
  }

  return Number.isNaN(built.getTime()) ? null : built;
}

export function monthLength(year: number, month: number, calendar: CalendarSystem) {
  if (calendar === "JALALI") {
    return jalaliMonthLength(year, month);
  }

  return new Date(year, month, 0).getDate();
}

export function isLeapYear(year: number, calendar: CalendarSystem) {
  if (calendar === "JALALI") {
    return isLeapJalaliYear(year);
  }

  return new Date(year, 1, 29).getDate() === 29;
}

/* ── keys ───────────────────────────────────────────────────────────────── */

const DAY_KEY_PATTERN = /^(\d{3,4})-(\d{1,2})-(\d{1,2})$/;
const MONTH_KEY_PATTERN = /^(\d{3,4})-(\d{1,2})$/;

function pad(value: number, length = 2) {
  return `${value}`.padStart(length, "0");
}

/**
 * `YYYY-MM-DD` in the active calendar and the device's timezone.
 *
 * Day boundaries are midnight local in every calendar, so switching calendars
 * regroups sessions by month but never by day.
 */
export function dayKey(date: Date, calendar: CalendarSystem) {
  const { year, month, day } = toParts(date, calendar);

  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** `YYYY-MM` in the active calendar. */
export function monthKey(date: Date, calendar: CalendarSystem) {
  const { year, month } = toParts(date, calendar);

  return `${pad(year, 4)}-${pad(month)}`;
}

export function parseDayKey(text: string, calendar: CalendarSystem): YearMonthDay | null {
  const match = DAY_KEY_PATTERN.exec(text.trim());

  if (!match) {
    return null;
  }

  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };

  return toDate(parts, calendar) ? parts : null;
}

export function parseMonthKey(text: string): { year: number; month: number } | null {
  const match = MONTH_KEY_PATTERN.exec(text.trim());

  if (!match) {
    return null;
  }

  const month = Number(match[2]);

  return month >= 1 && month <= 12 ? { year: Number(match[1]), month } : null;
}

export function normalizeMonthKey(input: string | undefined, calendar: CalendarSystem) {
  const parsed = input ? parseMonthKey(input) : null;

  if (parsed) {
    return `${pad(parsed.year, 4)}-${pad(parsed.month)}`;
  }

  return monthKey(new Date(), calendar);
}

/* ── ranges ─────────────────────────────────────────────────────────────── */

export type DateRange = {
  from: Date;
  /** Inclusive of the final millisecond, so `startAt <= to` needs no offset. */
  to: Date;
};

/** Local midnight on the first day of the calendar month holding `date`. */
export function startOfMonth(date: Date, calendar: CalendarSystem) {
  const { year, month } = toParts(date, calendar);

  return toDate({ year, month, day: 1 }, calendar)!;
}

/** Local midnight on the first day of the month `delta` months from `date`. */
export function addMonths(date: Date, delta: number, calendar: CalendarSystem) {
  const { year, month } = toParts(date, calendar);
  const absolute = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(absolute / 12);

  return toDate({ year: nextYear, month: absolute - nextYear * 12 + 1, day: 1 }, calendar)!;
}

export function startOfDay(date: Date) {
  const next = new Date(date);

  next.setHours(0, 0, 0, 0);

  return next;
}

export function addDays(date: Date, delta: number) {
  const next = new Date(date);

  next.setDate(next.getDate() + delta);

  return next;
}

/**
 * Local-time bounds of a `YYYY-MM` key in the active calendar. UTC bounds would
 * drop the last hours of every month and pull in the first hours of the next
 * one — 3.5 hours per month in Iran.
 */
export function monthRange(key: string, calendar: CalendarSystem): DateRange {
  const parsed = parseMonthKey(key);
  const anchor = parsed
    ? toDate({ year: parsed.year, month: parsed.month, day: 1 }, calendar)
    : null;
  const from = anchor ?? startOfMonth(new Date(), calendar);

  return { from, to: new Date(addMonths(from, 1, calendar).getTime() - 1) };
}

/** Local midnight on the first day of the week holding `date`. */
export function startOfWeek(date: Date, calendar: CalendarSystem) {
  const base = startOfDay(date);
  const offset = (base.getDay() - weekStartDay(calendar) + 7) % 7;

  return addDays(base, -offset);
}

/* ── labels ─────────────────────────────────────────────────────────────── */

/** `10 Shahrivar` */
export function formatDayMonth(date: Date, calendar: CalendarSystem) {
  const { month, day } = toParts(date, calendar);

  return `${day} ${monthNames(calendar)[month - 1]}`;
}

/** `10 Sha` */
export function formatShortDayMonth(date: Date, calendar: CalendarSystem) {
  const { month, day } = toParts(date, calendar);

  return `${day} ${shortMonthNames(calendar)[month - 1]}`;
}

/** `Shanbe` */
export function formatWeekday(date: Date, calendar: CalendarSystem) {
  return weekdayNames(calendar)[date.getDay()];
}

/** `Shanbe, 10 Shahrivar` */
export function formatDayLabel(date: Date, calendar: CalendarSystem) {
  return `${formatWeekday(date, calendar)}, ${formatDayMonth(date, calendar)}`;
}

/** `Shahrivar 1405`, from either an instant or a `YYYY-MM` key. */
export function formatMonthLabel(value: Date | string, calendar: CalendarSystem) {
  const { year, month } =
    typeof value === "string"
      ? (parseMonthKey(value) ?? toParts(new Date(), calendar))
      : toParts(value, calendar);

  return `${monthNames(calendar)[month - 1]} ${year}`;
}

/** `10 Shahrivar 1405`, for placeholders and hints. */
export function formatFullDate(date: Date, calendar: CalendarSystem) {
  const { year } = toParts(date, calendar);

  return `${formatDayMonth(date, calendar)} ${year}`;
}
