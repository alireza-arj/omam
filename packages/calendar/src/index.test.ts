import { describe, expect, test } from "bun:test";
import {
  addMonths,
  dayKey,
  formatDayLabel,
  formatFullDate,
  formatMonthLabel,
  gregorianToJalali,
  isLeapJalaliYear,
  jalaliMonthLength,
  jalaliToGregorian,
  monthKey,
  monthRange,
  normalizeMonthKey,
  parseDayKey,
  startOfWeek,
  toDate,
  toParts,
} from "./index";

/** Local-time helper: these functions are all timezone-relative by design. */
function local(year: number, month: number, day: number, hours = 0, minutes = 0) {
  return new Date(year, month - 1, day, hours, minutes);
}

describe("jalali conversion", () => {
  test("matches known anchors", () => {
    expect(gregorianToJalali(1979, 2, 11)).toEqual({ year: 1357, month: 11, day: 22 });
    expect(gregorianToJalali(2024, 3, 20)).toEqual({ year: 1403, month: 1, day: 1 });
    expect(gregorianToJalali(2025, 3, 21)).toEqual({ year: 1404, month: 1, day: 1 });
    expect(gregorianToJalali(2026, 3, 21)).toEqual({ year: 1405, month: 1, day: 1 });
    expect(gregorianToJalali(2026, 9, 1)).toEqual({ year: 1405, month: 6, day: 10 });
    expect(jalaliToGregorian(1405, 6, 10)).toEqual({ year: 2026, month: 9, day: 1 });
  });

  test("round-trips every day across 30 years", () => {
    const cursor = new Date(2000, 0, 1);
    let mismatches = 0;

    for (let index = 0; index < 30 * 366; index += 1) {
      const jalali = gregorianToJalali(
        cursor.getFullYear(),
        cursor.getMonth() + 1,
        cursor.getDate(),
      );
      const back = jalaliToGregorian(jalali.year, jalali.month, jalali.day);

      if (
        back.year !== cursor.getFullYear() ||
        back.month !== cursor.getMonth() + 1 ||
        back.day !== cursor.getDate() ||
        jalali.day > jalaliMonthLength(jalali.year, jalali.month)
      ) {
        mismatches += 1;
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    expect(mismatches).toBe(0);
  });

  test("month lengths add up to the year", () => {
    for (let jy = 1398; jy <= 1412; jy += 1) {
      const start = jalaliToGregorian(jy, 1, 1);
      const next = jalaliToGregorian(jy + 1, 1, 1);
      const days = Math.round(
        (Date.UTC(next.year, next.month - 1, next.day) -
          Date.UTC(start.year, start.month - 1, start.day)) /
          86_400_000,
      );
      let sum = 0;

      for (let month = 1; month <= 12; month += 1) {
        sum += jalaliMonthLength(jy, month);
      }

      expect(sum).toBe(days);
      expect(days).toBe(isLeapJalaliYear(jy) ? 366 : 365);
    }
  });

  test("rejects days that do not exist", () => {
    expect(jalaliMonthLength(1403, 12)).toBe(30);
    expect(jalaliMonthLength(1404, 12)).toBe(29);
    expect(toDate({ year: 1404, month: 12, day: 31 }, "JALALI")).toBeNull();
    expect(toDate({ year: 1403, month: 12, day: 30 }, "JALALI")).not.toBeNull();
    expect(toDate({ year: 2026, month: 4, day: 31 }, "GREGORIAN")).toBeNull();
    expect(parseDayKey("1404-12-31", "JALALI")).toBeNull();
    expect(parseDayKey("1405-06-10", "JALALI")).toEqual({ year: 1405, month: 6, day: 10 });
  });
});

describe("keys and ranges", () => {
  const instant = local(2026, 9, 1, 14, 30);

  test("keys are calendar-relative but day boundaries are not", () => {
    expect(dayKey(instant, "JALALI")).toBe("1405-06-10");
    expect(dayKey(instant, "GREGORIAN")).toBe("2026-09-01");
    expect(monthKey(instant, "JALALI")).toBe("1405-06");

    // 00:30 local belongs to that local day in both calendars, not to the
    // previous UTC one.
    const afterMidnight = local(2026, 9, 1, 0, 30);
    expect(dayKey(afterMidnight, "JALALI")).toBe(dayKey(instant, "JALALI"));
  });

  test("a jalali month spans two gregorian ones", () => {
    const range = monthRange("1405-06", "JALALI");

    expect(dayKey(range.from, "GREGORIAN")).toBe("2026-08-23");
    expect(dayKey(range.to, "GREGORIAN")).toBe("2026-09-22");
    expect(range.from.getHours()).toBe(0);
    expect(range.to.getMilliseconds()).toBe(999);
  });

  test("month arithmetic rolls over the year", () => {
    expect(monthKey(addMonths(instant, 1, "JALALI"), "JALALI")).toBe("1405-07");
    expect(monthKey(addMonths(instant, -6, "JALALI"), "JALALI")).toBe("1404-12");
    expect(monthKey(addMonths(instant, 7, "JALALI"), "JALALI")).toBe("1406-01");
    expect(monthKey(addMonths(instant, -18, "JALALI"), "JALALI")).toBe("1403-12");
  });

  test("every month of a jalali year is contiguous and correctly sized", () => {
    for (let month = 1; month <= 12; month += 1) {
      const key = `1405-${`${month}`.padStart(2, "0")}`;
      const range = monthRange(key, "JALALI");
      const parts = toParts(range.from, "JALALI");
      const days = Math.round((range.to.getTime() + 1 - range.from.getTime()) / 86_400_000);

      expect(parts).toEqual({ year: 1405, month, day: 1 });
      expect(days).toBe(jalaliMonthLength(1405, month));
    }
  });

  test("the jalali week starts on Shanbe", () => {
    expect(startOfWeek(instant, "JALALI").getDay()).toBe(6);
    expect(startOfWeek(instant, "GREGORIAN").getDay()).toBe(0);
  });

  test("normalizes a missing or malformed month key", () => {
    expect(normalizeMonthKey("1405-6", "JALALI")).toBe("1405-06");
    expect(normalizeMonthKey("nonsense", "JALALI")).toBe(monthKey(new Date(), "JALALI"));
    expect(normalizeMonthKey(undefined, "JALALI")).toBe(monthKey(new Date(), "JALALI"));
  });
});

describe("labels", () => {
  const instant = local(2026, 9, 1, 14, 30);

  test("reads dates in the active calendar", () => {
    expect(formatDayLabel(instant, "JALALI")).toBe("Seshanbe, 10 Shahrivar");
    expect(formatDayLabel(instant, "GREGORIAN")).toBe("Tuesday, 1 September");
    expect(formatMonthLabel("1405-06", "JALALI")).toBe("Shahrivar 1405");
    expect(formatFullDate(instant, "JALALI")).toBe("10 Shahrivar 1405");
  });
});

describe("existing sessions", () => {
  test("an instant recorded before the calendar existed reads as Shamsi", () => {
    // A session stored by the old build as a UTC instant.
    const stored = local(2026, 8, 25, 9, 15).toISOString();
    const session = new Date(stored);

    expect(dayKey(session, "JALALI")).toBe("1405-06-03");
    expect(formatFullDate(session, "JALALI")).toBe("3 Shahrivar 1405");
    // The instant itself is untouched by the reinterpretation.
    expect(session.toISOString()).toBe(stored);
  });
});
