/**
 * Taraz — design tokens.
 *
 * Ported verbatim from the Moview design system (tokens/*.css). Values are the
 * source of truth: nothing in the app should hardcode a colour, radius, spacing
 * step or type size that is not one of these.
 */

import { Platform, StyleSheet, type TextStyle, type ViewStyle } from "react-native";

/* ── palette ─────────────────────────────────────────────────────────────── */

export const palette = {
  /* neutrals — blue-grey tinted, never pure grey */
  gray0: "#FFFFFF",
  gray25: "#FBFCFD",
  gray50: "#F5F7FA",
  gray100: "#EDF0F4",
  gray200: "#E1E6EC",
  gray300: "#CBD2DB",
  gray400: "#A3ADBA",
  gray500: "#7C8796",
  gray600: "#5B6572",
  gray700: "#3E4753",
  gray800: "#262D36",
  gray900: "#151A21",
  gray950: "#0B0E12",

  /* accent — crimson. Reserved for actions, active states and links. */
  accent50: "#FFF1F4",
  accent100: "#FFE0E7",
  accent200: "#FFC2CF",
  accent300: "#FF93AC",
  accent400: "#FF5C82",
  accent500: "#FF375F",
  accent600: "#E31C47",
  accent700: "#BB1236",
  accent800: "#8E0E29",
  accent900: "#5E0A1B",

  /* semantics — status only, never decoration */
  success100: "#DBF5E9",
  success500: "#0E9F6E",
  success700: "#07694A",
  warning100: "#FCEEDA",
  warning500: "#E8A33D",
  warning700: "#9A6410",
  info100: "#E2EEFF",
  info500: "#2F80ED",
  info700: "#1B4F97",
} as const;

/* ── semantic colour aliases ─────────────────────────────────────────────── */

export type ColorScheme = {
  surfaceApp: string;
  surfaceCard: string;
  surfaceSunken: string;
  surfaceInverse: string;
  surfaceGlass: string;
  surfaceGlassStrong: string;
  surfaceScrim: string;

  textTitle: string;
  textBody: string;
  textMuted: string;
  textFaint: string;
  textOnAccent: string;
  textOnInverse: string;
  textAccent: string;
  textLink: string;

  lineHairline: string;
  lineStrong: string;
  lineAccent: string;

  fillQuiet: string;
  fillQuietPressed: string;
  fillAccent: string;
  fillAccentPressed: string;
  fillAccentSoft: string;

  successFill: string;
  successText: string;
  warningFill: string;
  warningText: string;
  infoFill: string;
  infoText: string;

  focusRing: string;
  blurTint: "light" | "dark";
};

export const lightColors: ColorScheme = {
  surfaceApp: palette.gray50,
  surfaceCard: palette.gray0,
  surfaceSunken: palette.gray100,
  surfaceInverse: palette.gray950,
  surfaceGlass: "rgba(255,255,255,0.68)",
  surfaceGlassStrong: "rgba(255,255,255,0.86)",
  surfaceScrim: "rgba(11,14,18,0.32)",

  textTitle: palette.gray950,
  textBody: palette.gray800,
  textMuted: palette.gray500,
  textFaint: palette.gray400,
  textOnAccent: "#FFFFFF",
  textOnInverse: palette.gray25,
  textAccent: palette.accent600,
  textLink: palette.accent600,

  lineHairline: "rgba(21,26,33,0.10)",
  lineStrong: "rgba(21,26,33,0.18)",
  lineAccent: palette.accent500,

  fillQuiet: palette.gray100,
  fillQuietPressed: palette.gray200,
  fillAccent: palette.accent500,
  fillAccentPressed: palette.accent600,
  fillAccentSoft: palette.accent50,

  successFill: palette.success100,
  successText: palette.success700,
  warningFill: palette.warning100,
  warningText: palette.warning700,
  infoFill: palette.info100,
  infoText: palette.info700,

  focusRing: "rgba(255,55,95,0.38)",
  blurTint: "light",
};

export const darkColors: ColorScheme = {
  ...lightColors,
  surfaceApp: palette.gray950,
  surfaceCard: "#12171E",
  surfaceSunken: "#0F1319",
  surfaceInverse: palette.gray0,
  surfaceGlass: "rgba(18,23,30,0.66)",
  surfaceGlassStrong: "rgba(18,23,30,0.88)",
  surfaceScrim: "rgba(0,0,0,0.55)",

  textTitle: palette.gray25,
  textBody: palette.gray200,
  textMuted: palette.gray400,
  textFaint: palette.gray600,
  textOnInverse: palette.gray950,
  textAccent: palette.accent400,
  textLink: palette.accent400,

  lineHairline: "rgba(255,255,255,0.10)",
  lineStrong: "rgba(255,255,255,0.20)",

  fillQuiet: "rgba(255,255,255,0.07)",
  fillQuietPressed: "rgba(255,255,255,0.12)",
  fillAccentSoft: "rgba(255,55,95,0.16)",

  successFill: "rgba(14,159,110,0.18)",
  successText: "#5FD3AB",
  warningFill: "rgba(232,163,61,0.18)",
  warningText: "#E8A33D",
  infoFill: "rgba(47,128,237,0.18)",
  infoText: "#7FB2F5",

  blurTint: "dark",
};

/* ── spacing — compact density ───────────────────────────────────────────── */

export const space = {
  0: 0,
  1: 2,
  2: 4,
  3: 6,
  4: 8,
  5: 10,
  6: 12,
  7: 16,
  8: 20,
  9: 24,
  10: 32,
  11: 40,
  12: 56,
  13: 72,
  14: 96,
} as const;

export const layout = {
  padControlX: 12,
  padControlY: 7,
  padCard: 14,
  padSection: 20,
  padPage: 20,
  gapTight: 6,
  gapDefault: 10,
  gapLoose: 16,
  gapSection: 32,
  controlSm: 28,
  controlMd: 34,
  controlLg: 44,
  tapMin: 44,
  hairline: StyleSheet.hairlineWidth,
} as const;

/* ── radius ──────────────────────────────────────────────────────────────── */

export const radius = {
  xs: 5,
  sm: 8,
  md: 10,
  lg: 14,
  xl: 18,
  "2xl": 24,
  "3xl": 34,
  full: 999,
  control: 10,
  card: 14,
  sheet: 24,
  pill: 999,
} as const;

/* ── motion ──────────────────────────────────────────────────────────────── */

export const motion = {
  durInstant: 80,
  durFast: 140,
  durNormal: 220,
  durSlow: 340,
  durSheet: 420,
  pressScale: 0.97,
  pressScaleLarge: 0.985,
  /* cubic-bezier(.32,.72,0,1) — the one easing family */
  easeStandard: { x1: 0.32, y1: 0.72, x2: 0, y2: 1 },
  easeOut: { x1: 0.16, y1: 1, x2: 0.3, y2: 1 },
} as const;

/* ── elevation ───────────────────────────────────────────────────────────── */

/**
 * Five steps, all cool-cast and soft. The CSS tokens pair a soft drop with a
 * 1px hairline ring; React Native has no spread, so the ring becomes a
 * hairline border — `border` here IS part of the shadow, never decoration.
 */
export type Elevation = 0 | 1 | 2 | 3 | 4;

export function shadow(level: Elevation, colors: ColorScheme): ViewStyle {
  const ring: ViewStyle = {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineHairline,
  };

  if (level === 0) {
    return ring;
  }

  const drop = (
    height: number,
    blur: number,
    opacity: number,
    android: number,
  ): ViewStyle =>
    Platform.select<ViewStyle>({
      android: { elevation: android, shadowColor: "#151A21" },
      default: {
        shadowColor: "#151A21",
        shadowOffset: { width: 0, height },
        shadowOpacity: opacity,
        shadowRadius: blur,
      },
    }) as ViewStyle;

  switch (level) {
    case 1:
      return { ...ring, ...drop(1, 2, 0.06, 1) };
    case 2:
      return { ...ring, ...drop(2, 6, 0.09, 3) };
    case 3:
      return { ...ring, ...drop(10, 24, 0.14, 8) };
    case 4:
      return { ...drop(26, 60, 0.28, 18) };
  }
}

export function accentShadow(): ViewStyle {
  return Platform.select<ViewStyle>({
    android: { elevation: 6, shadowColor: palette.accent500 },
    default: {
      shadowColor: palette.accent500,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.45,
      shadowRadius: 14,
    },
  }) as ViewStyle;
}

/* ── blur ────────────────────────────────────────────────────────────────── */

/** Glass always means *something is behind this* — never decoration. */
export const blur = { thin: 12, regular: 22, thick: 40 } as const;

/* ── typography ──────────────────────────────────────────────────────────── */

export const fontFamily = {
  display: {
    400: "Figtree_400Regular",
    500: "Figtree_500Medium",
    600: "Figtree_600SemiBold",
    700: "Figtree_700Bold",
    800: "Figtree_800ExtraBold",
  },
  text: {
    400: "PublicSans_400Regular",
    500: "PublicSans_500Medium",
    600: "PublicSans_600SemiBold",
  },
  mono: {
    400: "IBMPlexMono_400Regular",
    500: "IBMPlexMono_500Medium",
  },
} as const;

export const fontSize = {
  "3xs": 10,
  "2xs": 11,
  xs: 12,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  "2xl": 30,
  "3xl": 38,
  "4xl": 48,
  "5xl": 64,
} as const;

export const leading = {
  tight: 1.06,
  snug: 1.2,
  normal: 1.45,
  relaxed: 1.6,
} as const;

/** Tracking is authored in em; React Native wants points. */
const track = (em: number, size: number) => Math.round(em * size * 100) / 100;

export type TypeRole =
  | "display"
  | "title1"
  | "title2"
  | "title3"
  | "body"
  | "bodySm"
  | "label"
  | "caption"
  | "overline"
  | "mono"
  | "monoLg"
  | "monoDisplay";

const role = (
  family: string,
  size: number,
  lineRatio: number,
  trackingEm: number,
  extra?: TextStyle,
): TextStyle => ({
  fontFamily: family,
  fontSize: size,
  lineHeight: Math.round(size * lineRatio),
  letterSpacing: track(trackingEm, size),
  ...extra,
});

export const typeRoles: Record<TypeRole, TextStyle> = {
  display: role(fontFamily.display[700], fontSize["4xl"], leading.tight, -0.045),
  title1: role(fontFamily.display[700], fontSize["2xl"], leading.snug, -0.03),
  title2: role(fontFamily.display[600], fontSize.lg, leading.snug, -0.018),
  title3: role(fontFamily.display[600], fontSize.md, leading.snug, -0.018),
  body: role(fontFamily.text[400], fontSize.base, leading.normal, -0.006),
  bodySm: role(fontFamily.text[400], fontSize.sm, leading.normal, -0.006),
  label: role(fontFamily.display[500], fontSize.sm, 1.25, -0.006),
  caption: role(fontFamily.text[400], fontSize.xs, 1.35, 0),
  overline: role(fontFamily.display[600], fontSize["2xs"], 1.2, 0.09, {
    textTransform: "uppercase",
  }),
  mono: role(fontFamily.mono[400], fontSize.xs, 1.4, 0),
  monoLg: role(fontFamily.mono[400], fontSize["2xl"], leading.snug, -0.018),
  monoDisplay: role(fontFamily.mono[400], fontSize["3xl"], leading.tight, -0.03),
};

/* ── Persian faces ───────────────────────────────────────────────────────── */

/**
 * Vazirmatn stands in for all three Latin families when the app is read in
 * Persian, which none of them have glyphs for.
 *
 * `monoDisplay` is the exception and keeps IBM Plex Mono: it only ever renders
 * digits and colons, and it is the running clock, which would jitter once a
 * second on a proportional face.
 */
const PERSIAN_FACE: Record<string, string> = {
  [fontFamily.display[400]]: "Vazirmatn_400Regular",
  [fontFamily.display[500]]: "Vazirmatn_500Medium",
  [fontFamily.display[600]]: "Vazirmatn_600SemiBold",
  [fontFamily.display[700]]: "Vazirmatn_700Bold",
  [fontFamily.display[800]]: "Vazirmatn_800ExtraBold",
  [fontFamily.text[400]]: "Vazirmatn_400Regular",
  [fontFamily.text[500]]: "Vazirmatn_500Medium",
  [fontFamily.text[600]]: "Vazirmatn_600SemiBold",
  [fontFamily.mono[400]]: "Vazirmatn_400Regular",
  [fontFamily.mono[500]]: "Vazirmatn_500Medium",
};

/** Persian ascenders and descenders are taller; the Latin leading crowds them. */
const PERSIAN_LEADING = 1.14;

const persianTypeRoles = Object.fromEntries(
  (Object.entries(typeRoles) as [TypeRole, TextStyle][]).map(([role, style]) => {
    if (role === "monoDisplay") {
      return [role, style];
    }

    const family = typeof style.fontFamily === "string" ? style.fontFamily : undefined;

    return [
      role,
      {
        ...style,
        ...(family && PERSIAN_FACE[family] ? { fontFamily: PERSIAN_FACE[family] } : null),
        ...(typeof style.lineHeight === "number"
          ? { lineHeight: Math.round(style.lineHeight * PERSIAN_LEADING) }
          : null),
        // Latin tracking is authored for Latin letterforms and pulls Persian
        // joins apart.
        letterSpacing: 0,
      },
    ];
  }),
) as Record<TypeRole, TextStyle>;

export const typeRolesByLanguage = {
  en: typeRoles,
  fa: persianTypeRoles,
} as const;
