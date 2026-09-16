import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import { palette, useTheme } from "../design/taraz";

type Props = {
  size?: number;
  isRunning: boolean;
  elapsedSeconds: number;
  currentDate: Date;
};

function polarToCartesian(cx: number, cy: number, radius: number, degrees: number) {
  const radians = ((degrees - 90) * Math.PI) / 180;

  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

function buildSectorPath(
  cx: number,
  cy: number,
  radius: number,
  startDegrees: number,
  sweepDegrees: number,
) {
  const sweep = Math.max(0, Math.min(359.999, sweepDegrees));

  if (sweep <= 0.01) {
    return "";
  }

  const start = polarToCartesian(cx, cy, radius, ((startDegrees % 360) + 360) % 360);
  const end = polarToCartesian(cx, cy, radius, (((startDegrees % 360) + 360) % 360) + sweep);

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${sweep > 180 ? 1 : 0} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

function buildArcPath(
  cx: number,
  cy: number,
  radius: number,
  startDegrees: number,
  sweepDegrees: number,
) {
  const sweep = Math.max(0, Math.min(359.999, sweepDegrees));

  if (sweep <= 0.01) {
    return "";
  }

  const start = polarToCartesian(cx, cy, radius, ((startDegrees % 360) + 360) % 360);
  const end = polarToCartesian(cx, cy, radius, (((startDegrees % 360) + 360) % 360) + sweep);

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${sweep > 180 ? 1 : 0} 1 ${end.x} ${end.y}`;
}

/**
 * A twelve-hour chronograph dial: white face, dual hairline ring, ink hands.
 * The elapsed span of the running session is the only filled area, highlighted
 * in crimson — the one place on this screen where colour means *something is happening*.
 */
export function SessionDial({ size = 300, isRunning, elapsedSeconds, currentDate }: Props) {
  const { colors, elevation } = useTheme();

  const center = size / 2;
  const faceRadius = center - 8;
  const seconds = currentDate.getSeconds();
  const minutes = currentDate.getMinutes();
  const hourAngle = (currentDate.getHours() % 12) * 30 + minutes * 0.5;
  const minuteAngle = minutes * 6 + seconds * 0.1;
  const secondAngle = seconds * 6;

  const elapsed = Math.max(0, elapsedSeconds);
  const sessionStartAngle = hourAngle - ((elapsed % 43200) / 43200) * 360;
  const sweepAngle = ((elapsed % 43200) / 43200) * 360;

  const sectorPath = useMemo(
    () =>
      isRunning
        ? buildSectorPath(center, center, faceRadius, sessionStartAngle, sweepAngle)
        : "",
    [center, faceRadius, isRunning, sessionStartAngle, sweepAngle],
  );

  const sectorArc = useMemo(
    () =>
      isRunning
        ? buildArcPath(center, center, faceRadius, sessionStartAngle, sweepAngle)
        : "",
    [center, faceRadius, isRunning, sessionStartAngle, sweepAngle],
  );

  const startDot = useMemo(
    () => (isRunning ? polarToCartesian(center, center, faceRadius - 2, sessionStartAngle) : null),
    [center, faceRadius, isRunning, sessionStartAngle],
  );

  const hand = (length: number, width: number, angle: number, color: string) => (
    <Rect
      x={center - width / 2}
      y={center - length}
      width={width}
      height={length + width}
      rx={width / 2}
      fill={color}
      transform={`rotate(${angle} ${center} ${center})`}
    />
  );

  const secondHandColor = isRunning ? palette.accent500 : colors.textFaint;

  return (
    <View
      style={[
        {
          backgroundColor: colors.surfaceCard,
          borderRadius: size,
          height: size,
          width: size,
        },
        elevation(2),
      ]}
    >
      <Svg width={size} height={size}>
        {/* Outer bezel */}
        <Circle
          cx={center}
          cy={center}
          r={faceRadius}
          fill="none"
          stroke={colors.lineHairline}
          strokeWidth={1}
        />

        {/* Inner track ring */}
        <Circle
          cx={center}
          cy={center}
          r={faceRadius - 14}
          fill="none"
          stroke={colors.lineHairline}
          strokeWidth={0.75}
          strokeDasharray="2, 4"
        />

        {/* Elapsed session sector */}
        {sectorPath ? <Path d={sectorPath} fill={colors.fillAccentSoft} /> : null}
        {sectorArc ? (
          <Path
            d={sectorArc}
            fill="none"
            stroke={colors.lineAccent}
            strokeWidth={2}
            strokeLinecap="round"
          />
        ) : null}
        {startDot ? (
          <Circle cx={startDot.x} cy={startDot.y} r={2.5} fill={colors.fillAccent} />
        ) : null}

        {/* 60-minute tick marks */}
        <G>
          {Array.from({ length: 60 }, (_, index) => {
            const angle = index * 6;
            const isHour = index % 5 === 0;
            const isQuarter = index % 15 === 0;

            if (isHour) {
              const length = isQuarter ? 13 : 8;
              const outer = polarToCartesian(center, center, faceRadius - 2, angle);
              const inner = polarToCartesian(center, center, faceRadius - 2 - length, angle);

              return (
                <Path
                  key={`h-${angle}`}
                  d={`M ${outer.x} ${outer.y} L ${inner.x} ${inner.y}`}
                  stroke={isQuarter ? colors.textTitle : colors.textMuted}
                  strokeWidth={isQuarter ? 2 : 1.25}
                  strokeLinecap="round"
                />
              );
            }

            // Regular minute ticks
            const outer = polarToCartesian(center, center, faceRadius - 2, angle);
            const inner = polarToCartesian(center, center, faceRadius - 5.5, angle);

            return (
              <Path
                key={`m-${angle}`}
                d={`M ${outer.x} ${outer.y} L ${inner.x} ${inner.y}`}
                stroke={colors.lineHairline}
                strokeWidth={0.75}
                strokeLinecap="round"
              />
            );
          })}
        </G>

        {/* Hour hand */}
        {hand(faceRadius * 0.52, 4.5, hourAngle, colors.textTitle)}

        {/* Minute hand */}
        {hand(faceRadius * 0.74, 2.75, minuteAngle, colors.textBody)}

        {/* Second hand with counterweight tail */}
        <G transform={`rotate(${secondAngle} ${center} ${center})`}>
          {/* Main needle */}
          <Rect
            x={center - 0.75}
            y={center - faceRadius * 0.82}
            width={1.5}
            height={faceRadius * 0.82}
            rx={0.75}
            fill={secondHandColor}
          />
          {/* Tail */}
          <Rect
            x={center - 1}
            y={center}
            width={2}
            height={faceRadius * 0.2}
            rx={1}
            fill={secondHandColor}
          />
          {/* Tail counterbalance ring */}
          <Circle
            cx={center}
            cy={center + faceRadius * 0.16}
            r={3}
            fill={colors.surfaceCard}
            stroke={secondHandColor}
            strokeWidth={1.25}
          />
        </G>

        {/* Center arbor cap */}
        <Circle
          cx={center}
          cy={center}
          r={5.5}
          fill={colors.surfaceCard}
          stroke={colors.lineStrong}
          strokeWidth={1}
        />
        <Circle
          cx={center}
          cy={center}
          r={3.5}
          fill={isRunning ? palette.accent500 : colors.textTitle}
        />
        <Circle cx={center} cy={center} r={1.25} fill={colors.surfaceCard} />
      </Svg>
    </View>
  );
}
