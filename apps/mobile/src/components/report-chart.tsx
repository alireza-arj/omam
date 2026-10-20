import { useEffect, useMemo, useState } from "react";
import { Pressable, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { ReportBucket } from "../lib/report";
import { Text, layout, motion, radius, space, useColors, useLanguage } from "../design/taraz";

type Props = {
  buckets: ReportBucket[];
  /** Target per bucket in minutes; drawn as a dashed reference line when set. */
  targetMinutes?: number;
  /** Bucket keys to label on the axis; every bucket when omitted. */
  axisKeys?: string[];
  formatValue: (minutes: number) => string;
};

const GRID_STEPS = 3;
const BAR_MAX_WIDTH = 24;
const BAR_GAP = 2;
const MIN_BAR = 3;

/**
 * Columns for one measure over time. One hue throughout: filled days in the
 * accent, empty days as a short stub on the baseline so the rhythm of the
 * period still reads. Tapping a column pins its value above the plot.
 */
export function ReportChart({ buckets, targetMinutes, axisKeys, formatValue }: Props) {
  const colors = useColors();
  const { t } = useLanguage();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const peak = Math.max(...buckets.map((bucket) => bucket.minutes), 0);
  const scaleMax = useMemo(() => niceCeiling(Math.max(peak, targetMinutes ?? 0, 60)), [peak, targetMinutes]);
  const plotHeight = layout.chartHeight;
  const slot = buckets.length ? width / buckets.length : 0;
  const barWidth = Math.max(2, Math.min(BAR_MAX_WIDTH, slot - BAR_GAP));
  const active = buckets.find((bucket) => bucket.key === selected);
  const peakBucket = peak > 0 ? buckets.find((bucket) => bucket.minutes === peak) : undefined;
  const headline = active ?? peakBucket;
  const shownAxis = new Set(axisKeys ?? buckets.map((bucket) => bucket.key));

  useEffect(() => setSelected(null), [buckets]);

  return (
    <View style={{ gap: layout.gapDefault }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: layout.gapDefault, minHeight: layout.controlSm }}>
        <Text role="caption" tone="muted" style={{ flex: 1 }} numberOfLines={1}>
          {active ? active.label : headline ? t("report.chartPeak", { value: headline.label }) : ""}
        </Text>
        {headline ? (
          <Text role="label" tone="title">
            {formatValue(headline.minutes)}
          </Text>
        ) : null}
      </View>

      <View
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        style={{ height: plotHeight, direction: "ltr" }}
      >
        {Array.from({ length: GRID_STEPS + 1 }, (_, step) => (
          <View
            key={step}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: (plotHeight * step) / GRID_STEPS,
              height: layout.hairline,
              backgroundColor: step === GRID_STEPS ? colors.lineStrong : colors.lineHairline,
            }}
          />
        ))}

        {targetMinutes && targetMinutes <= scaleMax ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: plotHeight - (targetMinutes / scaleMax) * plotHeight,
              borderTopWidth: 1,
              borderStyle: "dashed",
              borderColor: colors.textFaint,
            }}
          />
        ) : null}

        <View style={{ flexDirection: "row", height: plotHeight, alignItems: "flex-end" }}>
          {buckets.map((bucket) => {
            const isSelected = bucket.key === selected;
            const dimmed = selected !== null && !isSelected;
            const tone = bucket.minutes === 0 ? colors.fillQuietPressed : colors.fillAccent;

            return (
              <Pressable
                key={bucket.key}
                accessibilityRole="button"
                accessibilityLabel={`${bucket.label}, ${formatValue(bucket.minutes)}`}
                onPress={() => setSelected(isSelected ? null : bucket.key)}
                style={{ flex: 1, height: plotHeight, alignItems: "center", justifyContent: "flex-end" }}
              >
                <Column
                  height={bucket.minutes ? Math.max(MIN_BAR, (bucket.minutes / scaleMax) * plotHeight) : MIN_BAR}
                  width={barWidth}
                  color={tone}
                  opacity={dimmed ? 0.35 : 1}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ flexDirection: "row", direction: "ltr" }}>
        {buckets.map((bucket) => (
          <View key={bucket.key} style={{ flex: 1, alignItems: "center", overflow: "visible" }}>
            {shownAxis.has(bucket.key) ? (
              <Text
                role="caption"
                tone={bucket.key === selected ? "title" : "faint"}
                numberOfLines={1}
                style={{ textAlign: "center", minWidth: space[10] }}
              >
                {bucket.label}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function Column({ height, width, color, opacity }: { height: number; width: number; color: string; opacity: number }) {
  const reduceMotion = useReducedMotion();
  const animated = useSharedValue(reduceMotion ? height : 0);

  useEffect(() => {
    animated.value = reduceMotion
      ? height
      : withTiming(height, {
          duration: motion.durSlow,
          easing: Easing.bezier(motion.easeOut.x1, motion.easeOut.y1, motion.easeOut.x2, motion.easeOut.y2),
        });
  }, [animated, height, reduceMotion]);

  const style = useAnimatedStyle(() => ({ height: animated.value }));

  return (
    <Animated.View
      style={[
        {
          width,
          backgroundColor: color,
          opacity,
          borderTopLeftRadius: Math.min(radius.xs, width / 2),
          borderTopRightRadius: Math.min(radius.xs, width / 2),
        },
        style,
      ]}
    />
  );
}

/** Rounds a minute count up to a whole number of hours on a 1-2-5 step. */
function niceCeiling(minutes: number) {
  const hours = minutes / 60;
  const magnitude = 10 ** Math.floor(Math.log10(hours));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= hours) ?? 10;

  return Math.ceil(step * magnitude) * 60;
}
