import { useEffect } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useColors } from "../theme";
import { motion, radius } from "../tokens";

export type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  round?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** A quiet fill that breathes — it never pulses hard or shimmers. */
export function Skeleton({ width = "100%", height = 12, round = false, style }: SkeletonProps) {
  const colors = useColors();
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: motion.durSlow * 2 }), -1, true);
  }, [opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          backgroundColor: colors.fillQuiet,
          borderRadius: round ? radius.full : radius.xs,
          height,
          width,
        },
        animated,
        style,
      ]}
    />
  );
}
