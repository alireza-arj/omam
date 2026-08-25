import type { ReactNode } from "react";
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../theme";
import { accentShadow, layout, motion, radius } from "../tokens";

export type IconButtonProps = Omit<PressableProps, "style" | "children"> & {
  children: ReactNode;
  /** Every icon-only control still needs a name. */
  label: string;
  variant?: "primary" | "secondary" | "quiet" | "ghost";
  size?: "sm" | "md" | "lg";
  round?: boolean;
  style?: StyleProp<ViewStyle>;
};

const SIZES = { sm: layout.controlSm, md: layout.controlMd, lg: layout.controlLg } as const;

export function IconButton({
  children,
  label,
  variant = "quiet",
  size = "md",
  round = false,
  disabled = false,
  style,
  ...rest
}: IconButtonProps) {
  const { colors, elevation } = useTheme();
  const box = SIZES[size];

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled ?? false}
      hitSlop={box < layout.tapMin ? (layout.tapMin - box) / 2 : 0}
      style={({ pressed }) => [
        styles.base,
        {
          height: box,
          width: box,
          borderRadius: round ? radius.pill : radius.control,
          backgroundColor:
            variant === "primary"
              ? pressed
                ? colors.fillAccentPressed
                : colors.fillAccent
              : variant === "secondary"
                ? colors.surfaceCard
                : variant === "quiet"
                  ? pressed
                    ? colors.fillQuietPressed
                    : colors.fillQuiet
                  : "transparent",
          opacity: disabled ? 0.4 : 1,
          transform: [{ scale: pressed && !disabled ? motion.pressScale : 1 }],
        },
        variant === "secondary" && elevation(1),
        variant === "primary" && accentShadow(),
        style,
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
});
