import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
  const pressScale = useRef(new Animated.Value(1)).current;
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

  function animateScale(toValue: number, duration: number) {
    Animated.timing(pressScale, {
      toValue,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }

  function handlePress() {
    if (isMutating) {
      return;
    }

    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => animateScale(0.97, 120)}
      onPressOut={() => animateScale(1, 160)}
      disabled={isMutating}
      className="items-center"
    >
      <AnimatedView
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          transform: [{ scale: pressScale }],
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

      <View
        style={{
          shadowColor: "#1b4336",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.26,
          shadowRadius: 10,
          elevation: 8,
        }}
        className="relative mt-5 overflow-hidden rounded-full border-2 border-[#73d0b2] px-6 py-2"
      >
        <LinearGradient
          colors={["#1f5f4e", "#2f9b84", "#1f7563"]}
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
            top: -20,
            bottom: -20,
            width: 96,
            transform: [{ translateX: glowTranslate }, { rotate: "-16deg" }],
            opacity: 0.42,
          }}
        >
          <LinearGradient
            colors={["rgba(255,255,255,0)", "rgba(214,255,244,0.9)", "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{
              flex: 1,
            }}
          />
        </Animated.View>
        <Text className="text-lg text-white">{isMutating ? savingLabel : isRunning ? runningLabel : idleLabel}</Text>
      </View>
    </Pressable>
  );
}
