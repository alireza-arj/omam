import { useEffect, useLayoutEffect, useState, type PropsWithChildren } from "react";
import { AccessibilityInfo, View } from "react-native";
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
    "--field-background": colors.surfaceCard,
    "--field-foreground": colors.textTitle,
    "--field-placeholder": colors.textMuted,
    "--field-border": colors.lineStrong,
    "--field-radius": radius.control,
  };
}

export function HeroUIProvider({ children }: PropsWithChildren) {
  const { isDark } = useTheme();
  const { language, isRtl, direction } = useLanguage();
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
          toast: {
            insets: { top: layout.gapTight, left: layout.padPage, right: layout.padPage },
            maxVisibleToasts: 3,
            contentWrapper: (content) => <View style={{ flex: 1, direction }}>{content}</View>,
          },
        }}
      >
        {children}
      </HeroUINativeProvider>
    </LayoutDirection>
  );
}
