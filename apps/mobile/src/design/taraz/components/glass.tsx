import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { GlassView } from "heroui-native/glass-view";
import { useTheme } from "../theme";
import { blur } from "../tokens";

export type GlassProps = {
  children?: ReactNode;
  /** thin for small overlays, regular for bars and cards, thick for sheets. */
  weight?: keyof typeof blur;
  strong?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Chrome that sits over scrolling content. Glass always means *something is
 * behind this* — never a blur applied to a static background for effect.
 */
export function Glass({ children, weight = "regular", strong = false, style }: GlassProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.root, style]}>
      <GlassView
        intensity={blur[weight]}
        tint={colors.blurTint}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: strong ? colors.surfaceGlassStrong : colors.surfaceGlass },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ root: { overflow: "hidden" } });
