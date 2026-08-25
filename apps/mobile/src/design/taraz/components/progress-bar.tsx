import { View, type StyleProp, type ViewStyle } from "react-native";
import { useColors } from "../theme";
import { radius } from "../tokens";

export type ProgressBarProps = {
  /** 0–1. */
  value: number;
  height?: number;
  tone?: "accent" | "neutral";
  style?: StyleProp<ViewStyle>;
};

export function ProgressBar({ value, height = 6, tone = "accent", style }: ProgressBarProps) {
  const colors = useColors();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[
        {
          backgroundColor: colors.fillQuiet,
          borderRadius: radius.pill,
          height,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <View
        style={{
          backgroundColor: tone === "accent" ? colors.fillAccent : colors.textFaint,
          borderRadius: radius.pill,
          height: "100%",
          width: `${clamped * 100}%`,
        }}
      />
    </View>
  );
}
