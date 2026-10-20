import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./text";
import { layout } from "../tokens";

export type PageHeaderProps = {
  title: string;
  overline?: string;
  subtitle?: string;
  /** Sits before the title in reading order — a back button. */
  leading?: ReactNode;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** The iOS large title, in sentence case. */
export function PageHeader({ title, overline, subtitle, leading, trailing, style }: PageHeaderProps) {
  return (
    <View style={[{ alignItems: "center", flexDirection: "row", gap: layout.gapDefault, minHeight: layout.tapMin }, style]}>
      {leading}
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        {overline ? (
          <Text role="overline" tone="muted" numberOfLines={1}>
            {overline}
          </Text>
        ) : null}
        <Text role={leading ? "title2" : "title1"} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text role="bodySm" tone="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}
