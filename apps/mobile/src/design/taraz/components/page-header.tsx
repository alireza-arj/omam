import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./text";
import { layout } from "../tokens";

export type PageHeaderProps = {
  title: string;
  overline?: string;
  subtitle?: string;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** The iOS large title, in sentence case. */
export function PageHeader({ title, overline, subtitle, trailing, style }: PageHeaderProps) {
  return (
    <View
      style={[
        { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", gap: layout.gapLoose },
        style,
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        {overline ? (
          <Text role="overline" tone="muted">
            {overline}
          </Text>
        ) : null}
        <Text role="title1">{title}</Text>
        {subtitle ? (
          <Text role="bodySm" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}
