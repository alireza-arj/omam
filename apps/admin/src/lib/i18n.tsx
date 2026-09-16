import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  DEFAULT_LANGUAGE,
  asLanguage,
  createTranslator,
  directionOf,
  formatDurationShort,
  isRtl,
  type Direction,
  type Language,
  type Translator,
} from "@omam/i18n";

import { I18nProvider } from "@heroui/react";

const STORAGE_KEY = "omam.admin.language";

function readStored(): Language | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    return stored ? asLanguage(stored) : null;
  } catch {
    return null;
  }
}

type LanguageValue = {
  language: Language;
  direction: Direction;
  isRtl: boolean;
  t: Translator;
  formatDuration: (minutes: number) => string;
  setLanguage: (next: Language) => void;
  /** Used once, when the signed-in account names a language of its own. */
  adoptLanguage: (next: Language) => void;
};

const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<Language>(() => readStored() ?? DEFAULT_LANGUAGE);

  // The document carries the direction: every flex row, `text-align: start`
  // and logical box property in the stylesheet mirrors off this one attribute.
  useEffect(() => {
    document.documentElement.setAttribute("dir", directionOf(language));
    document.documentElement.setAttribute("lang", language);
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);

    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* The choice still applies for this session. */
    }
  }, []);

  /** A stored choice on this browser outranks the account's own. */
  const adoptLanguage = useCallback((next: Language) => {
    if (!readStored()) {
      setLanguageState(next);
    }
  }, []);

  const value = useMemo<LanguageValue>(
    () => ({
      language,
      direction: directionOf(language),
      isRtl: isRtl(language),
      t: createTranslator(language),
      formatDuration: (minutes: number) => formatDurationShort(minutes, language),
      setLanguage,
      adoptLanguage,
    }),
    [adoptLanguage, language, setLanguage],
  );

  return <LanguageContext.Provider value={value}><I18nProvider locale={language === "fa" ? "fa-IR" : "en-US"}>{children}</I18nProvider></LanguageContext.Provider>;
}

export function useLanguage(): LanguageValue {
  const value = useContext(LanguageContext);

  if (!value) {
    throw new Error("useLanguage must be used inside LanguageProvider.");
  }

  return value;
}

/** The common case: just the lookup function. */
export function useT(): Translator {
  return useLanguage().t;
}
