import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Play, Square } from "lucide-react-native";
import Reanimated, {
  Easing,
  SharedValue,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

export type TimerButtonColors = {
  idle: string;
  running: string;
  idleDeep: string;
  runningDeep: string;
  accent: string;
  accentSoft: string;
  text: string;
  iconBackground: string;
  iconForeground: string;
  shadow: string;
};

type Props = {
  isRunning: boolean;
  onToggle: () => void | Promise<void>;
  disabled?: boolean;
  isLoading?: boolean;
  idleText?: string;
  runningText?: string;
  loadingText?: string;
  successText?: string;
  durationMs?: number;
  successDurationMs?: number;
  colors?: Partial<TimerButtonColors>;
  style?: StyleProp<ViewStyle>;
};

const DEFAULT_COLORS: TimerButtonColors = {
  idle: "#176B4E",
  running: "#0F4F3D",
  idleDeep: "#082D25",
  runningDeep: "#09251F",
  accent: "#69F3C6",
  accentSoft: "rgba(105, 243, 198, 0.18)",
  text: "#F7FBF8",
  iconBackground: "#F6FAF7",
  iconForeground: "#12372D",
  shadow: "#0B241E",
};

const TRAILS = [
  { offset: 0.04, width: 30, opacity: 0.42 },
  { offset: 0.1, width: 21, opacity: 0.3 },
  { offset: 0.17, width: 13, opacity: 0.2 },
];

function FlightTrail({
  progress,
  buttonWidth,
  offset,
  trailWidth,
  opacity,
  color,
}: {
  progress: SharedValue<number>;
  buttonWidth: number;
  offset: number;
  trailWidth: number;
  opacity: number;
  color: string;
}) {
  const trailStyle = useAnimatedStyle(() => {
    const travel = Math.max(1, buttonWidth - 46);
    const x = interpolate(progress.value, [0, 1], [-travel / 2, travel / 2]);
    const visible = progress.value > offset && progress.value < 0.96 ? 1 : 0;

    return {
      opacity: visible * opacity,
      width: trailWidth,
      transform: [{ translateX: x - trailWidth - offset * 108 }],
    };
  });

  return (
    <Reanimated.View
      pointerEvents="none"
      style={[
        styles.trail,
        trailStyle,
        {
          backgroundColor: color,
          shadowColor: color,
        },
      ]}
    />
  );
}

export function AnimatedTimerButton({
  isRunning,
  onToggle,
  disabled = false,
  isLoading = false,
  idleText = "Start Timer",
  runningText = "Stop Timer",
  loadingText = "Saving",
  successText = "SAME DAY SAME SHIT!",
  durationMs = 1700,
  successDurationMs = 1000,
  colors: colorOverrides,
  style,
}: Props) {
  const colors = useMemo(
    () => ({ ...DEFAULT_COLORS, ...colorOverrides }),
    [colorOverrides],
  );
  const [phase, setPhase] = useState<"idle" | "flight" | "success">("idle");
  const [buttonWidth, setButtonWidth] = useState(0);

  const press = useSharedValue(0);
  const labelOpacity = useSharedValue(1);
  const flight = useSharedValue(0);
  const flightOpacity = useSharedValue(0);
  const successOpacity = useSharedValue(0);
  const successPop = useSharedValue(0);
  const glow = useSharedValue(0);

  const isBusy = phase !== "idle" || disabled || isLoading;
  const label = isLoading ? loadingText : isRunning ? runningText : idleText;
  const Icon = isRunning ? Square : Play;

  const resetToIdle = useCallback(() => {
    setPhase("idle");
  }, []);

  const runSequence = useCallback(() => {
    setPhase("flight");
    press.value = withSequence(
      withTiming(1, { duration: 90 }),
      withSpring(0, { damping: 17, stiffness: 360, mass: 0.7 }),
    );
    labelOpacity.value = withTiming(0, { duration: 180 });
    flight.value = 0;
    flightOpacity.value = withTiming(1, { duration: 110 });
    glow.value = withTiming(1, { duration: 260 });

    flight.value = withTiming(
      1,
      { duration: durationMs, easing: Easing.bezier(0.16, 1, 0.3, 1) },
      () => {
        flightOpacity.value = withTiming(0, { duration: 160 });
        flight.value = 0;
        runOnJS(setPhase)("success");
        successPop.value = withSequence(
          withTiming(1, { duration: 120 }),
          withSpring(0, { damping: 9, stiffness: 230, mass: 0.7 }),
        );
        successOpacity.value = withTiming(1, { duration: 220 }, () => {
          successOpacity.value = withDelay(
            successDurationMs,
            withTiming(0, { duration: 220 }, () => {
              labelOpacity.value = withTiming(1, { duration: 220 });
              glow.value = withTiming(0, { duration: 320 });
              runOnJS(resetToIdle)();
            }),
          );
        });
      },
    );
  }, [
    durationMs,
    flight,
    flightOpacity,
    glow,
    labelOpacity,
    press,
    resetToIdle,
    successDurationMs,
    successOpacity,
    successPop,
  ]);

  const handlePress = useCallback(() => {
    if (isBusy) return;
    runSequence();
    void Promise.resolve(onToggle()).catch(() => {
      labelOpacity.value = withTiming(1, { duration: 180 });
    });
  }, [isBusy, labelOpacity, onToggle, runSequence]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setButtonWidth(event.nativeEvent.layout.width);
  }, []);

  const containerStyle = useAnimatedStyle(() => {
    const active = Math.max(flightOpacity.value, successOpacity.value);
    const backgroundColor = interpolateColor(
      active,
      [0, 1],
      [isRunning ? colors.runningDeep : colors.idleDeep, colors.idle],
    );

    return {
      backgroundColor,
      transform: [
        { scale: 1 - press.value * 0.035 + successPop.value * 0.035 },
        { translateY: press.value * 2 },
      ],
    };
  }, [colors.idle, colors.idleDeep, colors.runningDeep, isRunning]);

  const brightStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.14,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
    transform: [{ translateY: interpolate(labelOpacity.value, [0, 1], [4, 0]) }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
    transform: [{ scale: 0.94 + labelOpacity.value * 0.06 }],
  }));

  const emojiStyle = useAnimatedStyle(() => {
    const travel = Math.max(1, buttonWidth - 46);
    const x = interpolate(flight.value, [0, 1], [-travel / 2, travel / 2]);
    const rotation = interpolate(flight.value, [0, 0.4, 0.75, 1], [-18, 12, -9, 6]);
    const lift = interpolate(flight.value, [0, 0.5, 1], [2, -2, 1]);

    return {
      opacity: flightOpacity.value,
      transform: [{ translateX: x }, { translateY: lift }, { rotate: `${rotation}deg` }],
    };
  });

  const successStyle = useAnimatedStyle(() => ({
    opacity: successOpacity.value,
    transform: [{ scale: 0.96 + successOpacity.value * 0.04 }],
  }));

  const sparkleOneStyle = useAnimatedStyle(() => ({
    opacity: successOpacity.value,
    transform: [
      { translateX: -92 + successPop.value * -5 },
      { translateY: -9 + successPop.value * -4 },
      { scale: 0.75 + successOpacity.value * 0.35 },
      { rotate: `${successPop.value * 24}deg` },
    ],
  }));

  const sparkleTwoStyle = useAnimatedStyle(() => ({
    opacity: successOpacity.value * 0.82,
    transform: [
      { translateX: 92 + successPop.value * 5 },
      { translateY: 10 + successPop.value * 3 },
      { scale: 0.7 + successOpacity.value * 0.3 },
      { rotate: `${successPop.value * -18}deg` },
    ],
  }));

  const accessibleState = useMemo(
    () => ({ busy: isBusy, disabled: isBusy }),
    [isBusy],
  );

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => {
        if (!isBusy) press.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        press.value = withSpring(0, { damping: 17, stiffness: 360, mass: 0.7 });
      }}
      disabled={isBusy}
      accessibilityRole="button"
      accessibilityState={accessibleState}
      accessibilityLabel={label}
      style={style}
    >
      <Reanimated.View
        onLayout={handleLayout}
        style={[
          styles.button,
          containerStyle,
          {
            opacity: disabled ? 0.62 : 1,
            shadowColor: colors.shadow,
          },
        ]}
      >
        <LinearGradient
          colors={[
            isRunning ? colors.running : colors.idle,
            isRunning ? colors.runningDeep : colors.idleDeep,
          ]}
          start={{ x: 0.08, y: 0 }}
          end={{ x: 0.92, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.gradientLayer]}
        />
        <Reanimated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.brightLayer, brightStyle]}
        />
        <Reanimated.View pointerEvents="none" style={styles.accentGlow}>
          <LinearGradient
            colors={["rgba(255,255,255,0)", colors.accentSoft, "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Reanimated.View>

        <Reanimated.View
          style={[
            styles.iconShell,
            iconStyle,
            { backgroundColor: colors.iconBackground },
          ]}
        >
          {isLoading && phase === "idle" ? (
            <ActivityIndicator color={colors.iconForeground} />
          ) : (
            <Icon
              size={19}
              color={colors.iconForeground}
              fill={isRunning ? colors.iconForeground : "none"}
            />
          )}
        </Reanimated.View>

        <Reanimated.View style={[styles.labelShell, labelStyle]}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.label, { color: colors.text }]}
          >
            {label}
          </Text>
        </Reanimated.View>

        {buttonWidth > 0
          ? TRAILS.map((trail) => (
              <FlightTrail
                key={trail.offset}
                progress={flight}
                buttonWidth={buttonWidth}
                offset={trail.offset}
                trailWidth={trail.width}
                opacity={trail.opacity}
                color={colors.accent}
              />
            ))
          : null}

        <Reanimated.View pointerEvents="none" style={[styles.emoji, emojiStyle]}>
          <Text style={[styles.emojiText, { textShadowColor: colors.accent }]}>💸</Text>
        </Reanimated.View>

        <Reanimated.View pointerEvents="none" style={[styles.successShell, successStyle]}>
          <Reanimated.Text style={[styles.sparkle, sparkleOneStyle]}>✦</Reanimated.Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.successText, { color: colors.text, textShadowColor: colors.accent }]}
          >
            {successText}
          </Text>
          <Reanimated.Text style={[styles.sparkle, sparkleTwoStyle]}>✦</Reanimated.Text>
        </Reanimated.View>
      </Reanimated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderColor: "rgba(8, 20, 16, 0.88)",
    borderRadius: 999,
    borderWidth: 1,
    elevation: 9,
    flexDirection: "row",
    minHeight: 60,
    minWidth: 244,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 8,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
  },
  brightLayer: {
    backgroundColor: "#FFFFFF",
  },
  gradientLayer: {
    opacity: 0.88,
  },
  accentGlow: {
    bottom: -20,
    left: 28,
    opacity: 0.55,
    position: "absolute",
    right: 28,
    top: -20,
    transform: [{ rotate: "-13deg" }],
  },
  iconShell: {
    alignItems: "center",
    borderColor: "rgba(255, 255, 255, 0.52)",
    borderRadius: 999,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  labelShell: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  label: {
    fontSize: 17,
    fontWeight: "700",
    marginHorizontal: 16,
    textAlign: "center",
  },
  trail: {
    borderRadius: 999,
    height: 3,
    left: "50%",
    position: "absolute",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 7,
    top: "50%",
  },
  emoji: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  emojiText: {
    fontSize: 28,
    textShadowRadius: 9,
  },
  successShell: {
    alignItems: "center",
    bottom: 0,
    flexDirection: "row",
    justifyContent: "center",
    left: 0,
    paddingHorizontal: 20,
    position: "absolute",
    right: 0,
    top: 0,
  },
  successText: {
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    textShadowRadius: 12,
  },
  sparkle: {
    color: "#DFFFEF",
    fontSize: 15,
    fontWeight: "800",
    position: "absolute",
  },
});
