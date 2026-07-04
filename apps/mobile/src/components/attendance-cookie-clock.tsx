import { useMemo, type ReactNode } from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from "react-native-svg";
import { AnimatedTimerButton } from "./animated-timer-button";

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
  categorySelector?: ReactNode;
};

const CLOCK_SIZE = 312;

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

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  degrees: number,
) {
  const radians = ((degrees - 90) * Math.PI) / 180;

  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function buildSectorPath(
  cx: number,
  cy: number,
  radius: number,
  startDegrees: number,
  sweepDegrees: number,
) {
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
  categorySelector,
}: Props) {
  const activeAngles = useMemo(() => angleFromDate(currentDate), [currentDate]);
  const hourAngle = activeAngles.hourAngle;
  const minuteAngle = activeAngles.minuteAngle;
  const secondAngle = activeAngles.secondAngle;

  const ticks = useMemo(
    () => Array.from({ length: 12 }, (_, index) => index),
    [],
  );
  const dialSize = Math.max(size - 30, 120);
  const center = dialSize / 2;
  const tickHeight = Math.max(10, Math.round(dialSize * 0.08));
  const hourHeight = Math.max(40, Math.round(dialSize * 0.25));
  const minuteHeight = Math.max(58, Math.round(dialSize * 0.34));
  const secondHeight = Math.max(66, Math.round(dialSize * 0.4));
  const sessionStartDate = useMemo(
    () =>
      new Date(currentDate.getTime() - Math.max(0, elapsedSeconds) * 1000),
    [currentDate, elapsedSeconds],
  );
  const sessionStartAngle = useMemo(
    () => angleFromDate(sessionStartDate).hourAngle,
    [sessionStartDate],
  );
  const elapsedDialDegrees = isRunning
    ? ((Math.max(0, elapsedSeconds) % 43200) / 43200) * 360
    : 0;
  const passedSectorPath = useMemo(
    () =>
      buildSectorPath(
        center,
        center,
        Math.max(24, center - 8),
        sessionStartAngle,
        elapsedDialDegrees,
      ),
    [center, elapsedDialDegrees, sessionStartAngle],
  );

  return (
    <View className="items-center">
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 999,
        }}
        className="items-center justify-center"
      >
        <Svg width={size} height={size} style={{ position: "absolute" }}>
          <Defs>
            <SvgLinearGradient
              id="clockRing"
              x1="24"
              y1="18"
              x2={size - 20}
              y2={size - 10}
              gradientUnits="userSpaceOnUse"
            >
              <Stop stopColor="#69F3C6" />
              <Stop offset="0.54" stopColor="#2F6153" />
              <Stop offset="1" stopColor="#1E6F4D" />
            </SvgLinearGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 7}
            stroke="url(#clockRing)"
            strokeWidth="12"
            fill="none"
          />
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
              <SvgLinearGradient
                id="clockFaceGradient"
                x1="0"
                y1="0"
                x2={dialSize}
                y2={dialSize}
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0" stopColor="#ffffff" />
                <Stop offset="0.58" stopColor="#f7fbf9" />
                <Stop offset="1" stopColor="#edf4f0" />
              </SvgLinearGradient>
              <SvgLinearGradient
                id="clockPassedGradient"
                x1={center}
                y1={center}
                x2={dialSize}
                y2="0"
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0" stopColor="#0f6f5d" />
                <Stop offset="0.5" stopColor="#1fb08e" />
                <Stop offset="1" stopColor="#69F3C6" />
              </SvgLinearGradient>
            </Defs>
            <Circle
              cx={center}
              cy={center}
              r={Math.max(24, center - 8)}
              fill="url(#clockFaceGradient)"
            />
            {passedSectorPath ? (
              <Path d={passedSectorPath} fill="url(#clockPassedGradient)" />
            ) : null}
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
                transform: [
                  { rotate: `${hourAngle}deg` },
                  { translateY: -Math.floor(hourHeight / 2) + 2 },
                ],
              }}
            />

            <View
              style={{
                position: "absolute",
                width: 3,
                height: minuteHeight,
                borderRadius: 999,
                backgroundColor: "#2f6153",
                transform: [
                  { rotate: `${minuteAngle}deg` },
                  { translateY: -Math.floor(minuteHeight / 2) + 2 },
                ],
              }}
            />

            <View
              style={{
                position: "absolute",
                width: 2,
                height: secondHeight,
                borderRadius: 999,
                backgroundColor: isRunning ? "#1c8f87" : "#6a8f82",
                transform: [
                  { rotate: `${secondAngle}deg` },
                  { translateY: -Math.floor(secondHeight / 2) + 2 },
                ],
              }}
            />

            <View className="h-5 w-5 rounded-full bg-[#69F3C6]" />
            <View className="absolute h-2.5 w-2.5 rounded-full bg-[#f7fbf9]" />
          </View>
        </View>
      </View>

      {categorySelector}

      <AnimatedTimerButton
        isRunning={isRunning}
        onToggle={onPress}
        isLoading={isMutating}
        idleText={idleLabel}
        runningText={runningLabel}
        loadingText={savingLabel}
        style={{ marginTop: 20 }}
      />
    </View>
  );
}
