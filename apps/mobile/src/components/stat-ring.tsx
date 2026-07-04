import { useMemo } from "react";
import { Text, View } from "react-native";
import { Canvas, Circle, Path, Skia } from "@shopify/react-native-skia";
import { formatShortMinutes } from "../lib/format";

type Props = {
  progress: number;
  totalMinutes: number;
  goalHours: number;
};

export function StatRing({ progress, totalMinutes, goalHours }: Props) {
  const size = 168;
  const stroke = 14;
  const radius = (size - stroke) / 2;

  const path = useMemo(() => {
    const arc = Skia.Path.Make();
    arc.addArc(
      {
        x: stroke / 2,
        y: stroke / 2,
        width: size - stroke,
        height: size - stroke,
      },
      -210,
      Math.min(progress, 1) * 300,
    );

    return arc;
  }, [progress]);

  return (
    <View className="items-center justify-center">
      <View style={{ width: size, height: size }}>
        <Canvas style={{ flex: 1 }}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            color="rgba(255,255,255,0.08)"
            style="stroke"
            strokeWidth={stroke}
          />
          <Path
            path={path}
            color="#69f3c6"
            style="stroke"
            strokeWidth={stroke}
            strokeCap="round"
          />
        </Canvas>
        <View className="absolute inset-0 items-center justify-center gap-1">
          <Text className="text-xs uppercase tracking-[2px] text-mint/70">Month progress</Text>
          <Text className="text-2xl font-semibold text-mist">{formatShortMinutes(totalMinutes)}</Text>
          <Text className="text-sm text-muted">Goal {goalHours} h</Text>
        </View>
      </View>
    </View>
  );
}
