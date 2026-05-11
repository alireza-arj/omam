import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Canvas, Circle } from "@shopify/react-native-skia";

type Dot = {
  x: number;
  y: number;
  z: number;
};

const RADIUS = 36;
const CENTER = 58;
const CAMERA_DISTANCE = 150;
const TILT_X = -0.45;
const BASE_LAT_LON: Array<[number, number]> = [
  [58, 14],
  [42, 42],
  [16, 54],
  [-6, 44],
  [-24, 34],
  [-34, 16],
  [-28, -10],
  [-12, -30],
  [9, -38],
  [28, -22],
  [14, 16],
  [-4, 20],
  [-20, 8],
  [36, 10],
  [-42, -8],
  [52, -16],
  [24, -52],
];

function toCartesian([latDeg, lonDeg]: [number, number]): Dot {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const cosLat = Math.cos(lat);

  return {
    x: RADIUS * cosLat * Math.cos(lon),
    y: RADIUS * Math.sin(lat),
    z: RADIUS * cosLat * Math.sin(lon),
  };
}

function rotateY(dot: Dot, angle: number): Dot {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: dot.x * cos - dot.z * sin,
    y: dot.y,
    z: dot.x * sin + dot.z * cos,
  };
}

function rotateX(dot: Dot, angle: number): Dot {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: dot.x,
    y: dot.y * cos - dot.z * sin,
    z: dot.y * sin + dot.z * cos,
  };
}

const BASE_DOTS = BASE_LAT_LON.map(toCartesian);

export function ZoneGlobe() {
  const [angle, setAngle] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setAngle((value) => (value + 0.04) % (Math.PI * 2));
    }, 32);

    return () => clearInterval(timer);
  }, []);

  const projectedDots = useMemo(() => {
    return BASE_DOTS.map((baseDot, index) => {
      const rotatedY = rotateY(baseDot, angle);
      const rotated = rotateX(rotatedY, TILT_X);
      const perspective = CAMERA_DISTANCE / (CAMERA_DISTANCE - rotated.z);
      const depth = (rotated.z + RADIUS) / (2 * RADIUS);

      return {
        key: `zone-dot-${index}`,
        x: CENTER + rotated.x * perspective,
        y: CENTER + rotated.y * perspective,
        r: 1.1 + depth * 1.9,
        opacity: 0.24 + depth * 0.7,
        z: rotated.z,
      };
    }).sort((a, b) => a.z - b.z);
  }, [angle]);

  return (
    <View className="items-center gap-2">
      <Text className="text-base font-medium text-[#232126]">Zone</Text>
      <Canvas style={{ width: 116, height: 116 }}>
        <Circle cx={CENTER} cy={CENTER} r={47.5} color="#3f3c44" style="stroke" strokeWidth={1.2} opacity={0.32} />
        <Circle cx={CENTER} cy={CENTER} r={41} color="#2a2730" style="stroke" strokeWidth={0.9} opacity={0.22} />
        <Circle cx={CENTER} cy={CENTER} r={39} color="#17151a" opacity={0.06} />
        {projectedDots.map((dot) => (
          <Circle key={dot.key} cx={dot.x} cy={dot.y} r={dot.r} color="#17151a" opacity={dot.opacity} />
        ))}
        <Circle cx={CENTER} cy={CENTER} r={3} color="#17151a" />
      </Canvas>
    </View>
  );
}
