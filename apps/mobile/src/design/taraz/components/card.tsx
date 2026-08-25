import type { ReactNode } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { Glass } from "./glass";
import { useTheme } from "../theme";
import { layout, motion, radius, type Elevation } from "../tokens";

export type CardProps = {
  children?: ReactNode;
  elevation?: Elevation;
  padded?: boolean;
  glass?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * White, 14px radius, hairline plus a soft drop. Never a border and a shadow
 * as separate decisions — the hairline is part of the elevation token.
 */
export function Card({
  children,
  elevation = 1,
  padded = true,
  glass = false,
  onPress,
  style,
}: CardProps) {
  const { colors, elevation: shadowFor } = useTheme();

  const base: ViewStyle = {
    borderRadius: radius.card,
    padding: padded ? layout.padCard : 0,
    backgroundColor: glass ? "transparent" : colors.surfaceCard,
  };

  if (glass) {
    return (
      <Glass strong style={[{ borderRadius: radius.card }, shadowFor(elevation), style]}>
        <View style={{ padding: padded ? layout.padCard : 0 }}>{children}</View>
      </Glass>
    );
  }

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          base,
          shadowFor(pressed ? 2 : elevation),
          { transform: [{ scale: pressed ? motion.pressScaleLarge : 1 }] },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[base, shadowFor(elevation), style]}>{children}</View>;
}
