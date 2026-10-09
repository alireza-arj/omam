import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { Platform, useColorScheme } from "react-native";
import AsyncStorage from "../../lib/storage";
import {
  darkColors,
  lightColors,
  shadow,
  type ColorScheme,
  type Elevation,
} from "./tokens";

/** `system` follows the device; the other two pin the appearance. */
export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "taraz.theme-mode";

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

type Theme = {
  colors: ColorScheme;
  isDark: boolean;
  /** Elevation step as a ready-to-spread React Native style. */
  elevation: (level: Elevation) => ReturnType<typeof shadow>;
  mode: ThemeMode;
  setMode: (next: ThemeMode) => void;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active && isThemeMode(stored)) {
          setModeState(stored);
        }
      })
      .catch(() => {
        /* A missing preference just means "system". */
      });

    return () => {
      active = false;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      /* The choice still applies for this session. */
    });
  }, []);

  const isDark = mode === "system" ? systemScheme === "dark" : mode === "dark";

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const surface = isDark ? darkColors.surfaceApp : lightColors.surfaceApp;
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (viewport && !viewport.content.includes("viewport-fit=cover")) {
      viewport.content = "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content";
    }
    document.documentElement.style.setProperty("--app-background", surface);
    const themeTags = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeTags.length === 0) {
      const tag = document.createElement("meta");
      tag.name = "theme-color";
      tag.content = surface;
      document.head.appendChild(tag);
    }
    themeTags.forEach((tag) => {
      tag.content = surface;
    });
    const statusBar = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (statusBar) statusBar.content = isDark ? "black-translucent" : "default";
  }, [isDark]);

  const value = useMemo<Theme>(() => {
    const colors = isDark ? darkColors : lightColors;

    return {
      colors,
      isDark,
      elevation: (level) => shadow(level, colors),
      mode,
      setMode,
    };
  }, [isDark, mode, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);

  if (!theme) {
    throw new Error("useTheme must be used inside a ThemeProvider");
  }

  return theme;
}

/** Colours only — the common case. */
export function useColors(): ColorScheme {
  return useTheme().colors;
}

/** The appearance preference and its setter, for the control that changes it. */
export function useThemeMode() {
  const { mode, setMode, isDark } = useTheme();

  return { mode, setMode, isDark };
}
