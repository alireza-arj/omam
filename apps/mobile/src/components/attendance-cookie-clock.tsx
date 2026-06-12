import { useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Play, Square } from "lucide-react-native";
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Stop } from "react-native-svg";

type Props = {
  isRunning: boolean;
  isMutating: boolean;
  elapsedSeconds: number;
  currentDate: Date;
  onPress: () => void;
  idleLabel: string;
  runningLabel: string;
  savingLabel: string;
  size?: number;
};

const CLOCK_SIZE = 312;

const AnimatedView = Animated.createAnimatedComponent(View);

function angleFromDate(date: Date) {
  const sec = date.getSeconds();
  const min = date.getMinutes();
  const hour = date.getHours() % 12;

  return {
    secondAngle: sec * 6,
    minuteAngle: min * 6 + sec * 0.1,
    hourAngle: hour * 30 + min * 0.5,
  };
}

function polarToCartesian(cx: number, cy: number, radius: number, degrees: number) {
  const radians = ((degrees - 90) * Math.PI) / 180;

  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function buildSectorPath(cx: number, cy: number, radius: number, startDegrees: number, sweepDegrees: number) {
  const clampedSweep = Math.max(0, Math.min(359.999, sweepDegrees));

  if (clampedSweep <= 0.01) {
    return "";
  }

  const normalizedStart = ((startDegrees % 360) + 360) % 360;
  const endDegrees = normalizedStart + clampedSweep;
  const start = polarToCartesian(cx, cy, radius, normalizedStart);
  const end = polarToCartesian(cx, cy, radius, endDegrees);
  const largeArc = clampedSweep > 180 ? 1 : 0;

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

export function AttendanceCookieClock({
  isRunning,
  isMutating,
  elapsedSeconds,
  currentDate,
  onPress,
  idleLabel,
  runningLabel,
  savingLabel,
  size = CLOCK_SIZE,
}: Props) {
  const buttonScale = useRef(new Animated.Value(1)).current;
  const buttonTranslateY = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const glowTranslate = useRef(new Animated.Value(-220)).current;

  const activeAngles = useMemo(() => angleFromDate(currentDate), [currentDate]);
  const hourAngle = activeAngles.hourAngle;
  const minuteAngle = activeAngles.minuteAngle;
  const secondAngle = activeAngles.secondAngle;

  const ticks = useMemo(() => Array.from({ length: 12 }, (_, index) => index), []);
  const dialSize = Math.max(size - 30, 120);
  const center = dialSize / 2;
  const tickHeight = Math.max(10, Math.round(dialSize * 0.08));
  const hourHeight = Math.max(40, Math.round(dialSize * 0.25));
  const minuteHeight = Math.max(58, Math.round(dialSize * 0.34));
  const secondHeight = Math.max(66, Math.round(dialSize * 0.4));
  const sessionStartDate = useMemo(
    () => new Date(currentDate.getTime() - Math.max(0, elapsedSeconds) * 1000),
    [currentDate, elapsedSeconds],
  );
  const sessionStartAngle = useMemo(() => angleFromDate(sessionStartDate).hourAngle, [sessionStartDate]);
  const elapsedDialDegrees = isRunning ? ((Math.max(0, elapsedSeconds) % 43200) / 43200) * 360 : 0;
  const passedSectorPath = useMemo(
    () => buildSectorPath(center, center, Math.max(24, center - 8), sessionStartAngle, elapsedDialDegrees),
    [center, elapsedDialDegrees, sessionStartAngle],
  );

  useEffect(() => {
    const glowAnimation = Animated.loop(
      Animated.timing(glowTranslate, {
        toValue: 220,
        duration: 2100,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );

    glowAnimation.start();

    return () => glowAnimation.stop();
  }, [glowTranslate]);

  function animateButton(pressed: boolean) {
    Animated.parallel([
      Animated.spring(buttonScale, {
        toValue: pressed ? 0.96 : 1,
        damping: 14,
        stiffness: 280,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.spring(buttonTranslateY, {
        toValue: pressed ? 2 : 0,
        damping: 14,
        stiffness: 280,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.spring(iconScale, {
        toValue: pressed ? 0.88 : 1,
        damping: 12,
        stiffness: 320,
        mass: 0.7,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function handlePress() {
    if (isMutating) {
      return;
    }

    onPress();
  }

  const buttonLabel = isMutating ? savingLabel : isRunning ? runningLabel : idleLabel;
  const ButtonIcon = isRunning ? Square : Play;
  const buttonGradient: readonly [string, string, string] = isMutating
    ? ["#20302c", "#263b35", "#16231f"]
    : ["#0f332b", "#15513f", "#08231d"];

  return (
    <View className="items-center">
      <AnimatedView
        style={{
          width: size,
          height: size,
          borderRadius: 999,
        }}
        className="items-center justify-center"
      >
        <Svg width={size} height={size} style={{ position: "absolute" }}>
          <Defs>
            <SvgLinearGradient id="clockRing" x1="24" y1="18" x2={size - 20} y2={size - 10} gradientUnits="userSpaceOnUse">
              <Stop stopColor="#69F3C6" />
              <Stop offset="0.54" stopColor="#2F6153" />
              <Stop offset="1" stopColor="#1E6F4D" />
            </SvgLinearGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={(size / 2) - 7} stroke="url(#clockRing)" strokeWidth="12" fill="none" />
        </Svg>

        <View
          style={{
            width: dialSize,
            height: dialSize,
            borderRadius: 999,
          }}
          className="overflow-hidden border border-[#2f6153] bg-transparent"
        >
          <Svg width={dialSize} height={dialSize} style={{ position: "absolute" }}>
            <Defs>
              <SvgLinearGradient id="clockFaceGradient" x1="0" y1="0" x2={dialSize} y2={dialSize} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor="#ffffff" />
                <Stop offset="0.58" stopColor="#f7fbf9" />
                <Stop offset="1" stopColor="#edf4f0" />
              </SvgLinearGradient>
              <SvgLinearGradient id="clockPassedGradient" x1={center} y1={center} x2={dialSize} y2="0" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor="#0f6f5d" />
                <Stop offset="0.5" stopColor="#1fb08e" />
                <Stop offset="1" stopColor="#69F3C6" />
              </SvgLinearGradient>
            </Defs>
            <Circle cx={center} cy={center} r={Math.max(24, center - 8)} fill="url(#clockFaceGradient)" />
            {passedSectorPath ? <Path d={passedSectorPath} fill="url(#clockPassedGradient)" /> : null}
          </Svg>

          {ticks.map((tick) => {
            const angle = tick * 30;
            const radians = (angle * Math.PI) / 180;
            const tickRadius = center - 16;
            const tickCenterX = center + tickRadius * Math.sin(radians);
            const tickCenterY = center - tickRadius * Math.cos(radians);

            return (
              <View
                key={`tick-${tick}`}
                style={{
                  position: "absolute",
                  left: tickCenterX - 1,
                  top: tickCenterY - tickHeight / 2,
                  width: 2,
                  height: tickHeight,
                  borderRadius: 999,
                  backgroundColor: "#2f6153",
                  transform: [{ rotate: `${angle}deg` }],
                }}
              />
            );
          })}

          <View className="absolute inset-0 items-center justify-center">
            <View
              style={{
                position: "absolute",
                width: 5,
                height: hourHeight,
                borderRadius: 999,
                backgroundColor: "#1e473b",
                transform: [{ rotate: `${hourAngle}deg` }, { translateY: -Math.floor(hourHeight / 2) + 2 }],
              }}
            />

            <View
              style={{
                position: "absolute",
                width: 3,
                height: minuteHeight,
                borderRadius: 999,
                backgroundColor: "#2f6153",
                transform: [{ rotate: `${minuteAngle}deg` }, { translateY: -Math.floor(minuteHeight / 2) + 2 }],
              }}
            />

            <View
              style={{
                position: "absolute",
                width: 2,
                height: secondHeight,
                borderRadius: 999,
                backgroundColor: isRunning ? "#1c8f87" : "#6a8f82",
                transform: [{ rotate: `${secondAngle}deg` }, { translateY: -Math.floor(secondHeight / 2) + 2 }],
              }}
            />

            <View className="h-5 w-5 rounded-full bg-[#69F3C6]" />
            <View className="absolute h-2.5 w-2.5 rounded-full bg-[#f7fbf9]" />
          </View>
        </View>
      </AnimatedView>

      <Pressable
        onPress={handlePress}
        onPressIn={() => animateButton(true)}
        onPressOut={() => animateButton(false)}
        disabled={isMutating}
        accessibilityRole="button"
        accessibilityState={{ disabled: isMutating, busy: isMutating }}
        accessibilityLabel={buttonLabel}
        className="mt-5"
      >
        <AnimatedView
          style={{
            alignItems: "center",
            borderColor: "#101816",
            borderRadius: 999,
            borderWidth: 3,
            flexDirection: "row",
            minHeight: 58,
            minWidth: 236,
            overflow: "hidden",
            opacity: isMutating ? 0.86 : 1,
            paddingHorizontal: 10,
            paddingVertical: 8,
            shadowColor: "#0b241e",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.28,
            shadowRadius: 16,
            elevation: 8,
            transform: [{ scale: buttonScale }, { translateY: buttonTranslateY }],
          }}
        >
          <LinearGradient
            colors={buttonGradient}
            start={{ x: 0.05, y: 0.1 }}
            end={{ x: 0.95, y: 0.9 }}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
            }}
          />
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -18,
              bottom: -18,
              width: 86,
              transform: [{ translateX: glowTranslate }, { rotate: "-17deg" }],
              opacity: 0.18,
            }}
          >
            <LinearGradient
              colors={["rgba(255,255,255,0)", "rgba(34,99,77,0.9)", "rgba(255,255,255,0)"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ flex: 1 }}
            />
          </Animated.View>

          <AnimatedView
            style={{
              alignItems: "center",
              backgroundColor: "#f6faf7",
              borderColor: "#dbe7e2",
              borderRadius: 999,
              borderWidth: 1,
              height: 44,
              justifyContent: "center",
              transform: [{ scale: iconScale }],
              width: 44,
            }}
          >
            {isMutating ? (
              <ActivityIndicator color="#12372d" />
            ) : (
              <ButtonIcon size={19} color="#12372d" fill={isRunning ? "#12372d" : "none"} />
            )}
          </AnimatedView>

          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{
              color: "#f7fbf8",
              flex: 1,
              fontSize: 17,
              fontWeight: "600",
              marginHorizontal: 16,
              textAlign: "center",
            }}
          >
            {buttonLabel}
          </Text>
        </AnimatedView>
      </Pressable>
    </View>
  );
}
