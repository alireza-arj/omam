/**
 * Jalali (Solar Hijri) ↔ Gregorian conversion.
 *
 * A direct TypeScript port of Behdad Esfahbod's algorithm (the one behind
 * `jalaali-js`, MIT). It is arithmetic only — no `Intl`, no data tables beyond
 * the leap-year breaks — so it behaves identically on Hermes, Node and Bun,
 * which `Intl.DateTimeFormat("fa-IR-u-ca-persian")` does not.
 *
 * Valid for Jalali years -61..3177 (Gregorian 560..3798), which covers every
 * date this app can hold.
 */

export type YearMonthDay = {
  /** Calendar year, e.g. 1405 for Jalali or 2026 for Gregorian. */
  year: number;
  /** 1–12. */
  month: number;
  /** 1–31. */
  day: number;
};

function div(a: number, b: number) {
  return Math.trunc(a / b);
}

function mod(a: number, b: number) {
  return a - Math.trunc(a / b) * b;
}

/** Jalali years at which the 33-year leap cycle shifts. */
const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394,
  2456, 3178,
];

export const MIN_JALALI_YEAR = BREAKS[0];
export const MAX_JALALI_YEAR = BREAKS[BREAKS.length - 1] - 1;

type JalaliCalibration = {
  /** 1 when the Jalali year is a leap year, otherwise 0 or the distance to one. */
  leap: number;
  /** The Gregorian year the Jalali year starts in. */
  gy: number;
  /** Day of March on which the Jalali year starts. */
  march: number;
};

/**
 * Leap offset and Nowruz position for a Jalali year. `withoutLeap` skips the
 * leap computation for callers that only need `march`.
 */
function jalaliCalibration(jy: number, withoutLeap: boolean): JalaliCalibration {
  if (jy < MIN_JALALI_YEAR || jy > MAX_JALALI_YEAR) {
    throw new RangeError(`Jalali year ${jy} is out of the supported range.`);
  }

  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jump = 0;

  for (let index = 1; index < BREAKS.length; index += 1) {
    const jm = BREAKS[index];

    jump = jm - jp;

    if (jy < jm) {
      break;
    }

    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }

  let n = jy - jp;

  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);

  if (mod(jump, 33) === 4 && jump - n === 4) {
    leapJ += 1;
  }

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  let leap = 0;

  if (!withoutLeap) {
    if (jump - n < 6) {
      n = n - jump + div(jump + 4, 33) * 33;
    }

    leap = mod(mod(n + 1, 33) - 1, 4);

    if (leap === -1) {
      leap = 4;
    }
  }

  return { leap, gy, march };
}

/** Julian Day Number for a Gregorian date. */
function gregorianToJdn(gy: number, gm: number, gd: number) {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;

  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;

  return d;
}

/** Gregorian date for a Julian Day Number. */
function jdnToGregorian(jdn: number): YearMonthDay {
  let j = 4 * jdn + 139361631;

  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;

  const i = div(mod(j, 1461), 4) * 5 + 308;
  const day = div(mod(i, 153), 5) + 1;
  const month = mod(div(i, 153), 12) + 1;
  const year = div(j, 1461) - 100100 + div(8 - month, 6);

  return { year, month, day };
}

/** Julian Day Number for a Jalali date. */
function jalaliToJdn(jy: number, jm: number, jd: number) {
  const calibration = jalaliCalibration(jy, true);

  return (
    gregorianToJdn(calibration.gy, 3, calibration.march) +
    (jm - 1) * 31 -
    div(jm, 7) * (jm - 7) +
    jd -
    1
  );
}

/** Jalali date for a Julian Day Number. */
function jdnToJalali(jdn: number): YearMonthDay {
  const { year: gy } = jdnToGregorian(jdn);
  let jy = gy - 621;

  const calibration = jalaliCalibration(jy, false);
  let k = jdn - gregorianToJdn(gy, 3, calibration.march);

  if (k >= 0) {
    if (k <= 185) {
      return { year: jy, month: 1 + div(k, 31), day: mod(k, 31) + 1 };
    }

    k -= 186;
  } else {
    jy -= 1;
    k += 179;

    if (calibration.leap === 1) {
      k += 1;
    }
  }

  return { year: jy, month: 7 + div(k, 30), day: mod(k, 30) + 1 };
}

export function gregorianToJalali(gy: number, gm: number, gd: number): YearMonthDay {
  return jdnToJalali(gregorianToJdn(gy, gm, gd));
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): YearMonthDay {
  return jdnToGregorian(jalaliToJdn(jy, jm, jd));
}

export function isLeapJalaliYear(jy: number) {
  return jalaliCalibration(jy, false).leap === 0;
}

/** 31 for Farvardin–Shahrivar, 30 for Mehr–Bahman, 29 or 30 for Esfand. */
export function jalaliMonthLength(jy: number, jm: number) {
  if (jm <= 6) {
    return 31;
  }

  if (jm <= 11) {
    return 30;
  }

  return isLeapJalaliYear(jy) ? 30 : 29;
}
