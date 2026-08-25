import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./text";
import { useTheme } from "../theme";
import {
  accentShadow,
  fontFamily,
  fontSize,
  layout,
  motion,
  radius,
  type ColorScheme,
} from "../tokens";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "ghost" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = Omit<PressableProps, "style" | "children"> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  pill?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  iconEnd?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

const SIZES = {
  sm: { height: layout.controlSm, padX: 10, gap: 5, radius: radius.sm, font: fontFamily.display[500], size: fontSize.sm },
  md: { height: layout.controlMd, padX: layout.padControlX, gap: 6, radius: radius.control, font: fontFamily.display[600], size: fontSize.sm },
  lg: { height: layout.controlLg, padX: 20, gap: 8, radius: radius.lg, font: fontFamily.display[600], size: fontSize.base },
} as const;

function surface(variant: ButtonVariant, colors: ColorScheme, pressed: boolean) {
  switch (variant) {
    case "primary":
      return {
        backgroundColor: pressed ? colors.fillAccentPressed : colors.fillAccent,
        textColor: colors.textOnAccent,
      };
    case "secondary":
      return { backgroundColor: colors.surfaceCard, textColor: colors.textTitle };
    case "quiet":
      return {
        backgroundColor: pressed ? colors.fillQuietPressed : colors.fillQuiet,
        textColor: colors.textTitle,
      };
    case "ghost":
      return { backgroundColor: "transparent", textColor: colors.textAccent };
    case "outline":
      return { backgroundColor: "transparent", textColor: colors.textTitle };
  }
}

/** Buttons are verbs: "Start", "Save", "Sign out" — never "OK" or "Submit". */
export function Button({
  label,
  variant = "primary",
  size = "md",
  full = false,
  pill = false,
  loading = false,
  disabled = false,
  icon,
  iconEnd,
  style,
  ...rest
}: ButtonProps) {
  const { colors, elevation } = useTheme();
  const s = SIZES[size];
  const isInert = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isInert === true, busy: loading }}
      disabled={isInert}
      style={({ pressed }) => [
        styles.base,
        {
          height: s.height,
          paddingHorizontal: s.padX,
          gap: s.gap,
          borderRadius: pill ? radius.pill : s.radius,
          backgroundColor: surface(variant, colors, pressed).backgroundColor,
          alignSelf: full ? "stretch" : "flex-start",
          opacity: isInert ? 0.4 : 1,
          transform: [{ scale: pressed && !isInert ? motion.pressScale : 1 }],
        },
        variant === "secondary" ? elevation(1) : null,
        variant === "primary" ? accentShadow() : null,
        variant === "outline"
          ? { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineStrong }
          : null,
        style,
      ]}
      {...rest}
    >
      {({ pressed }) => {
        const textColor = surface(variant, colors, pressed).textColor;

        return (
          <>
            {loading ? <ActivityIndicator size="small" color={textColor} /> : icon}
            <Text
              color={textColor}
              numberOfLines={1}
              style={{
                fontFamily: s.font,
                fontSize: s.size,
                lineHeight: Math.round(s.size * 1.1),
                letterSpacing: -0.09,
              }}
            >
              {label}
            </Text>
            {iconEnd ? <View>{iconEnd}</View> : null}
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", flexDirection: "row", justifyContent: "center" },
});
