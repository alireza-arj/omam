import { describe, expect, test } from "bun:test";
import {
  DIRECTION,
  LANGUAGES,
  createTranslator,
  dictionaries,
  formatDurationShort,
  translateError,
  type Dictionary,
} from "./index";

function leaves(dictionary: Dictionary, prefix = ""): [key: string, value: string][] {
  const found: [string, string][] = [];

  for (const [key, value] of Object.entries(dictionary)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "string") {
      found.push([path, value]);
    } else if ("other" in value && typeof value.other === "string") {
      found.push([`${path}.one`, value.one as string]);
      found.push([`${path}.other`, value.other as string]);
    } else {
      found.push(...leaves(value as Dictionary, path));
    }
  }

  return found;
}

describe("dictionaries", () => {
  const english = leaves(dictionaries.en);

  test("every language covers every English key", () => {
    for (const language of LANGUAGES) {
      const keys = new Set(leaves(dictionaries[language]).map(([key]) => key));

      expect([language, english.filter(([key]) => !keys.has(key)).map(([key]) => key)]).toEqual([
        language,
        [],
      ]);
    }
  });

  test("no phrase is blank", () => {
    for (const language of LANGUAGES) {
      for (const [key, value] of leaves(dictionaries[language])) {
        expect([language, key, value.trim().length > 0]).toEqual([language, key, true]);
      }
    }
  });

  /** A `{name}` left untranslated shows up on screen as a literal brace. */
  test("placeholders match across languages", () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const expected = new Map(english.map(([key, value]) => [key, placeholders(value)]));

    for (const language of LANGUAGES) {
      for (const [key, value] of leaves(dictionaries[language])) {
        expect([key, placeholders(value)]).toEqual([key, expected.get(key) ?? []]);
      }
    }
  });
});

describe("translator", () => {
  test("interpolates and picks a plural form", () => {
    const t = createTranslator("en");

    expect(t("auth.passwordRule", { count: 6 })).toBe("Password must be at least 6 characters.");
    expect(t("report.sessionCount", { count: 1 })).toBe("1 session");
    expect(t("report.sessionCount", { count: 4 })).toBe("4 sessions");
  });

  test("falls back to English rather than showing nothing", () => {
    const fa = createTranslator("fa");

    expect(fa("tabs.today")).toBe("امروز");
    // A key that does not exist comes back as itself, which names the gap.
    expect(fa("does.not.exist" as never)).toBe("does.not.exist");
  });

  test("Persian is right to left", () => {
    expect(DIRECTION.fa).toBe("rtl");
    expect(DIRECTION.en).toBe("ltr");
  });
});

describe("durations", () => {
  test("read the way each language writes them", () => {
    expect(formatDurationShort(450, "en")).toBe("7h 30m");
    expect(formatDurationShort(450, "fa")).toBe("7:30");
    expect(formatDurationShort(45, "en")).toBe("45m");
    expect(formatDurationShort(45, "fa")).toBe("0:45");
    expect(formatDurationShort(-10, "en")).toBe("0m");
  });
});

describe("translateError", () => {
  const t = createTranslator("fa");

  test("turns a thrown code into a sentence", () => {
    expect(translateError(new Error("SESSION_ACTIVE"), t)).toBe("همین حالا یک رکورد در جریان است.");
  });

  test("passes a server sentence through untouched", () => {
    expect(translateError(new Error("Payroll for 1405-06 is closed."), t)).toBe(
      "Payroll for 1405-06 is closed.",
    );
  });

  test("an unknown code falls back rather than showing the code", () => {
    expect(translateError(new Error("WAT_IS_THIS"), t)).toBe("مشکلی پیش آمد. دوباره تلاش کنید.");
  });
});
