import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  fallbackLanguage,
  getDefaultLanguage,
  languageMeta,
  resolveLanguage,
  translate,
  type AppLanguage,
  type TranslationKey,
  type TranslationParams,
} from "../i18n/translations";

const LANGUAGE_STORAGE_KEY = "@omam:language";

type LanguageContextValue = {
  language: AppLanguage;
  locale: string;
  isRTL: boolean;
  isReady: boolean;
  setLanguage: (next: AppLanguage) => Promise<void>;
  t: (key: TranslationKey, params?: TranslationParams) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState(fallbackLanguage);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isActive = true;
    async function boot() {
      const storedValue = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).catch(() => null);
      const storedLanguage = resolveLanguage(storedValue);
      const initialLanguage = storedLanguage ?? getDefaultLanguage();
      if (!isActive) {
        return;
      }
      setLanguageState(initialLanguage);
      setIsReady(true);
    }
    boot().catch(() => {
      if (!isActive) {
        return;
      }
      const initialLanguage = getDefaultLanguage();
      setLanguageState(initialLanguage);
      setIsReady(true);
    });
    return () => {
      isActive = false;
    };
  }, []);

  const setLanguage = useCallback(async (next: AppLanguage) => {
    if (next === language) {
      return;
    }
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, next).catch(() => undefined);
    setLanguageState(next);
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    locale: languageMeta[language].locale,
    isRTL: languageMeta[language].isRTL,
    isReady,
    setLanguage,
    t: (key, params) => translate(language, key, params),
  }), [isReady, language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
