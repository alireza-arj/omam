import { type StyleProp, type ViewStyle } from "react-native";
import { Skeleton as HeroSkeleton } from "heroui-native/skeleton";
import { radius, space } from "../tokens";

export type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  round?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({ width = "100%", height = space[6], round = false, style }: SkeletonProps) {
  return <HeroSkeleton style={[{ height, width, borderRadius: round ? radius.full : radius.xs }, style]} />;
}
