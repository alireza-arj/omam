import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { Toast, toast } from "@heroui/react";
import { useT } from "./i18n";

/* ── theme ───────────────────────────────────────────────────────────────── */

type Theme = "light" | "dark";

const THEME_KEY = "omam.admin.theme";

function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_KEY);

    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState<Theme>(
    () =>
      readStoredTheme() ??
      (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* a private window keeps the choice for this session only */
    }
  }, [theme]);

  const value = useMemo(
    () => ({ theme, toggle: () => setTheme((current) => (current === "dark" ? "light" : "dark")) }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }

  return context;
}

/* ── toast ───────────────────────────────────────────────────────────────── */

export function ToastProvider({ children }: PropsWithChildren) {
  const t = useT();
  return (
    <>
      {children}
      <Toast.Provider placement="bottom end">
        {({ toast: notification }) => (
          <Toast toast={notification} variant={notification.content.variant}>
            <Toast.Indicator />
            <Toast.Content><Toast.Title>{notification.content.title}</Toast.Title></Toast.Content>
            <Toast.CloseButton aria-label={t("common.close")} />
          </Toast>
        )}
      </Toast.Provider>
    </>
  );
}

export function useToast() {
  return (message: string, tone: "neutral" | "success" | "error" = "neutral") => {
    toast(message, { variant: tone === "error" ? "danger" : tone === "success" ? "success" : "default", timeout: 4200 });
  };
}
