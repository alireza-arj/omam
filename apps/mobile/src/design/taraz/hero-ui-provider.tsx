import { useEffect, useLayoutEffect, useState, type PropsWithChildren } from "react";
import { AccessibilityInfo } from "react-native";
import { HeroUINativeProvider } from "heroui-native/provider";
import { LayoutDirection, Uniwind } from "uniwind";
import { useLanguage } from "./i18n";
import { useTheme } from "./theme";
import { darkColors, lightColors, layout, palette, radius, typeRolesByLanguage, type ColorScheme } from "./tokens";

function themeVariables(colors: ColorScheme) {
  return {
    "--background": colors.surfaceApp,
    "--foreground": colors.textTitle,
    "--surface": colors.surfaceCard,
    "--surface-foreground": colors.textTitle,
    "--surface-secondary": colors.surfaceSunken,
    "--surface-secondary-foreground": colors.textBody,
    "--surface-tertiary": colors.fillQuiet,
        "--surface-tertiary-foreground": colors.textBody,
    "--overlay": colors.surfaceCard,
    "--overlay-foreground": colors.textTitle,
    "--backdrop": colors.surfaceScrim,
    "--muted": colors.textMuted,
    "--accent": colors.fillAccent,
    "--accent-foreground": colors.textOnAccent,
    "--color-accent-hover": colors.fillAccentPressed,
    "--color-default-hover": colors.fillQuietPressed,
    "--color-danger-hover": colors.fillAccentPressed,
    "--color-danger-soft-hover": colors.fillAccentSoft,
    "--field": colors.surfaceCard,
    "--default": colors.fillQuiet,
    "--default-foreground": colors.textTitle,
    "--segment": colors.surfaceCard,
    "--segment-foreground": colors.textTitle,
    "--border": colors.lineStrong,
    "--separator": colors.lineHairline,
    "--focus": colors.fillAccent,
    "--link": colors.textLink,
    "--success": palette.success500,
    "--success-foreground": palette.gray0,
    "--warning": palette.warning500,
    "--warning-foreground": palette.gray950,
    "--danger": palette.accent600,
    "--danger-foreground": palette.gray0,
    "--field-background": colors.surfaceSunken,
    "--field-foreground": colors.textTitle,
    "--field-placeholder": colors.textFaint,
    "--field-border": colors.lineHairline,
    "--field-border-width": `${layout.hairline}px`,
    "--field-radius": radius.lg,
    "--field-shadow": "none",
  };
}

export function HeroUIProvider({ children }: PropsWithChildren) {
  const { isDark } = useTheme();
  const { language, isRtl } = useLanguage();
  const [reduceMotion, setReduceMotion] = useState(false);

  useLayoutEffect(() => {
    const font = typeRolesByLanguage[language].body.fontFamily ?? "";
    Uniwind.updateCSSVariables("light", { ...themeVariables(lightColors), "--font-sans": font });
    Uniwind.updateCSSVariables("dark", { ...themeVariables(darkColors), "--font-sans": font });
    Uniwind.setTheme(isDark ? "dark" : "light");
  }, [isDark, language]);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return (
    <LayoutDirection rtl={isRtl}>
      <HeroUINativeProvider
        config={{
          isRTL: isRtl,
          animation: reduceMotion ? "disable-all" : undefined,
          textProps: { allowFontScaling: true },
        }}
      >
        {children}
      </HeroUINativeProvider>
    </LayoutDirection>
  );
}
