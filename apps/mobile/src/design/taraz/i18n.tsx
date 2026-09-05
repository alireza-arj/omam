import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

const STORAGE_KEY = "taraz.language";

type LanguageValue = {
  language: Language;
  direction: Direction;
  isRtl: boolean;
  /** Looks a phrase up in the active language. */
  t: Translator;
  /** A worked duration written the way the active language reads it. */
  formatDuration: (minutes: number) => string;
  setLanguage: (next: Language) => void;
};

const LanguageContext = createContext<LanguageValue | null>(null);

/**
 * The language lives in the design layer because it decides two rendering
 * concerns nothing else can: which typeface has the glyphs, and which way the
 * layout runs.
 *
 * It is stored per device rather than per account so the sign-in screen —
 * which has no account yet — is already in the right language. Signing in
 * adopts whatever the account has saved.
 */
export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active && stored) {
          setLanguageState(asLanguage(stored));
        }
      })
      .catch(() => {
        /* A missing preference just means English. */
      });

    return () => {
      active = false;
    };
  }, []);

  /**
   * React Native reads the `direction` style through Yoga, but react-native-web
   * drops it: on the web the document itself has to carry the direction, and
   * CSS then mirrors every flex row underneath.
   */
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.setAttribute("dir", directionOf(language));
    document.documentElement.setAttribute("lang", language);
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      /* The choice still applies for this session. */
    });
  }, []);

  const value = useMemo<LanguageValue>(
    () => ({
      language,
      direction: directionOf(language),
      isRtl: isRtl(language),
      t: createTranslator(language),
      formatDuration: (minutes: number) => formatDurationShort(minutes, language),
      setLanguage,
    }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageValue {
  const value = useContext(LanguageContext);

  if (!value) {
    throw new Error("useLanguage must be used inside a LanguageProvider");
  }

  return value;
}

/** The common case: just the lookup function. */
export function useTranslation(): Translator {
  return useLanguage().t;
}
