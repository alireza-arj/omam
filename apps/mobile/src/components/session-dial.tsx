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

/**
 * A twelve-hour dial: white face, hairline ring, ink hands. The elapsed span of
 * the running session is the only filled area, and it is crimson — the one
 * place on this screen where colour means *something is happening*.
 */
export function SessionDial({ size = 300, isRunning, elapsedSeconds, currentDate }: Props) {
  const { colors, elevation } = useTheme();

  const center = size / 2;
  const faceRadius = center - 6;
  const seconds = currentDate.getSeconds();
  const minutes = currentDate.getMinutes();
  const hourAngle = (currentDate.getHours() % 12) * 30 + minutes * 0.5;
  const minuteAngle = minutes * 6 + seconds * 0.1;
  const secondAngle = seconds * 6;

  const elapsed = Math.max(0, elapsedSeconds);
  const sessionStartAngle = hourAngle - ((elapsed % 43200) / 43200) * 360;
  const sectorPath = useMemo(
    () =>
      isRunning
        ? buildSectorPath(center, center, faceRadius, sessionStartAngle, ((elapsed % 43200) / 43200) * 360)
        : "",
    [center, elapsed, faceRadius, isRunning, sessionStartAngle],
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
        <Circle
          cx={center}
          cy={center}
          r={faceRadius}
          fill="none"
          stroke={colors.lineHairline}
          strokeWidth={1}
        />

        {sectorPath ? <Path d={sectorPath} fill={colors.fillAccentSoft} /> : null}

        <G>
          {Array.from({ length: 12 }, (_, index) => {
            const angle = index * 30;
            const isQuarter = index % 3 === 0;
            const length = isQuarter ? 12 : 7;
            const outer = polarToCartesian(center, center, faceRadius - 10, angle);
            const inner = polarToCartesian(center, center, faceRadius - 10 - length, angle);

            return (
              <Path
                key={angle}
                d={`M ${outer.x} ${outer.y} L ${inner.x} ${inner.y}`}
                stroke={isQuarter ? colors.lineStrong : colors.lineHairline}
                strokeWidth={isQuarter ? 2 : 1}
                strokeLinecap="round"
              />
            );
          })}
        </G>

        {hand(faceRadius * 0.5, 5, hourAngle, colors.textTitle)}
        {hand(faceRadius * 0.72, 3, minuteAngle, colors.textBody)}
        {hand(faceRadius * 0.8, 1.5, secondAngle, isRunning ? palette.accent500 : colors.textFaint)}

        <Circle cx={center} cy={center} r={4} fill={isRunning ? palette.accent500 : colors.textTitle} />
        <Circle cx={center} cy={center} r={1.5} fill={colors.surfaceCard} />
      </Svg>
    </View>
  );
}
