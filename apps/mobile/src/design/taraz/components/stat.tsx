import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Card } from "./card";
import { Text } from "./text";
import { layout } from "../tokens";

export type StatProps = {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  /** Counts and timecodes are monospaced; everything else is display type. */
  mono?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Stat({ label, value, hint, icon, mono = false, style }: StatProps) {
  return (
    <Card style={[{ flex: 1, gap: layout.gapTight }, style]}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: layout.gapTight }}>
        {icon}
        <Text role="overline" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
          {label}
        </Text>
      </View>
      <Text role={mono ? "monoLg" : "title1"} tone="title" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {hint ? (
        <Text role="caption" tone="muted" numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}
