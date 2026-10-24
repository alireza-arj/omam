import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

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
    const surface = getComputedStyle(document.documentElement).getPropertyValue("--surface-app").trim();
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((tag) => {
      tag.content = surface;
    });

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

