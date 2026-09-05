/**
 * Omam — languages.
 *
 * `en` is the source of truth: its shape types every other dictionary, so a
 * missing or misspelled key is a build error rather than a blank label.
 *
 * Digits stay Latin in both languages. The whole product reads durations and
 * money in a tabular monospace face, and Persian-Indic digits have no glyphs
 * in it — switching them would break every column that lines up today.
 */

import { en } from "./en";
import { fa } from "./fa";

export const LANGUAGES = ["en", "fa"] as const;

export type Language = (typeof LANGUAGES)[number];

export type Direction = "ltr" | "rtl";

export const DEFAULT_LANGUAGE: Language = "en";

export const DIRECTION: Record<Language, Direction> = {
  en: "ltr",
  fa: "rtl",
};

/** What each language calls itself, for the picker. */
export const LANGUAGE_LABEL: Record<Language, string> = {
  en: "English",
  fa: "فارسی",
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

export function asLanguage(value: unknown, fallback: Language = DEFAULT_LANGUAGE): Language {
  return isLanguage(value) ? value : fallback;
}

export function directionOf(language: Language): Direction {
  return DIRECTION[language];
}

export function isRtl(language: Language) {
  return DIRECTION[language] === "rtl";
}

/* ── dictionary shape ────────────────────────────────────────────────────── */

/** A phrase that changes with a count. Persian uses one form for both. */
export type Plural = { one: string; other: string };

export type Phrase = string | Plural;

export type Dictionary = { [key: string]: Phrase | Dictionary };

type Leaves<T> = T extends Phrase
  ? never
  : {
      [K in keyof T & string]: T[K] extends Phrase ? K : `${K}.${Leaves<T[K]> & string}`;
    }[keyof T & string];

export type TranslationKey = Leaves<typeof en>;

/**
 * The English dictionary's shape with its literal strings widened, so another
 * language must supply every key without having to repeat English's wording.
 */
type Widen<T> = T extends string
  ? string
  : T extends { one: string; other: string }
    ? Plural
    : { [K in keyof T]: Widen<T[K]> };

export type Translations = Widen<typeof en>;

export type TranslationValues = Record<string, string | number>;

export const dictionaries: Record<Language, Dictionary> = { en, fa };

function lookup(dictionary: Dictionary, key: string): Phrase | undefined {
  let node: Phrase | Dictionary | undefined = dictionary;

  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null || !(part in node)) {
      return undefined;
    }

    node = (node as Dictionary)[part];
  }

  return typeof node === "string" || (typeof node === "object" && "other" in node)
    ? (node as Phrase)
    : undefined;
}

function interpolate(template: string, values?: TranslationValues) {
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

export type Translator = (key: TranslationKey, values?: TranslationValues) => string;

/**
 * Falls back to English, then to the key itself. A key on screen is ugly but
 * it names the thing that is missing, which a blank label never does.
 */
export function createTranslator(language: Language): Translator {
  const primary = dictionaries[language] ?? en;

  return (key, values) => {
    const phrase = lookup(primary, key) ?? lookup(en, key);

    if (!phrase) {
      return key;
    }

    if (typeof phrase === "string") {
      return interpolate(phrase, values);
    }

    const count = Number(values?.count ?? 0);

    return interpolate(count === 1 ? phrase.one : phrase.other, values);
  };
}

export { en, fa };

/* ── numbers ─────────────────────────────────────────────────────────────── */

/**
 * A worked duration.
 *
 * English reads `7h 30m`; Persian reads `7:30`, the notation Iranian
 * attendance systems already use. Both are fixed-width enough to sit in a
 * table column, which `۷ ساعت و ۳۰ دقیقه` is not.
 */
export function formatDurationShort(minutes: number, language: Language) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;

  if (language === "fa") {
    return `${hours}:${String(rest).padStart(2, "0")}`;
  }

  if (!hours) {
    return `${rest}m`;
  }

  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

/** Hours to one decimal, for a column that compares against a goal. */
export function formatHours(minutes: number) {
  return (Math.max(0, minutes) / 60).toFixed(1);
}

/** Grouped thousands. Latin digits in both languages — see the note above. */
export function formatNumber(value: number, fractionDigits = 0) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/**
 * Turns a thrown message into something readable.
 *
 * Data layers throw a stable code — `SESSION_ACTIVE` — rather than a sentence,
 * because they have no language. Anything that is not a known code is passed
 * through as-is, so a server message still reaches the reader.
 */
export function translateError(error: unknown, t: Translator, fallbackKey: TranslationKey = "common.somethingWrong") {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";

  if (!message) {
    return t(fallbackKey);
  }

  if (/^[A-Z][A-Z0-9_]+$/.test(message)) {
    const translated = t(`errors.${message}` as TranslationKey);

    return translated === `errors.${message}` ? t(fallbackKey) : translated;
  }

  return message;
}
