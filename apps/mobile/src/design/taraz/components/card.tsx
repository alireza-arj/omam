import type { ReactNode } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import { Card as HeroCard } from "heroui-native/card";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { Glass } from "./glass";
import { layout, radius, type Elevation } from "../tokens";

export type CardProps = {
  children?: ReactNode;
  elevation?: Elevation;
  padded?: boolean;
  glass?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, elevation = 1, padded = true, glass = false, onPress, style }: CardProps) {
  const card = (
    <HeroCard
      variant={elevation === 0 ? "secondary" : "default"}
      style={[{ padding: padded ? layout.padCard : 0 }, glass ? { backgroundColor: "transparent" } : null, style]}
    >
      {children}
    </HeroCard>
  );

  if (onPress) {
    return <PressableFeedback accessibilityRole="button" onPress={onPress}>{card}</PressableFeedback>;
  }
  return glass ? <Glass strong style={{ borderRadius: radius.card }}>{card}</Glass> : card;
}
