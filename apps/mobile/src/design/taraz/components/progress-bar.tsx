import { useEffect } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useColors } from "../theme";
import { Surface } from "heroui-native/surface";
import { motion, radius } from "../tokens";

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
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(clamped);

  useEffect(() => {
    progress.value = reduceMotion
      ? clamped
      : withTiming(clamped, {
          duration: motion.durNormal,
          easing: Easing.bezier(motion.easeInOut.x1, motion.easeInOut.y1, motion.easeInOut.x2, motion.easeInOut.y2),
        });
  }, [clamped, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

  return (
    <Surface
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[
        {
          backgroundColor: colors.fillQuiet,
          borderRadius: radius.pill,
          height,
          padding: 0,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View
        style={[{
          backgroundColor: tone === "accent" ? colors.fillAccent : colors.textFaint,
          borderRadius: radius.pill,
          height: "100%",
          width: "100%",
          transformOrigin: "left",
        }, animatedStyle]}
      />
    </Surface>
  );
}
