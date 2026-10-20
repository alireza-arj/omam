import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react-native";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { IconTile, type IconTileTone } from "./icon-tile";
import { Text } from "./text";
import { layout } from "../tokens";

export type SectionHeaderProps = {
  title: string;
  description?: string;
  glyph?: LucideIcon;
  tone?: IconTileTone;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Heading for a card: optional icon tile, a title, one line of guidance. */
export function SectionHeader({ title, description, glyph, tone, trailing, style }: SectionHeaderProps) {
  return (
    <View style={[{ alignItems: "center", flexDirection: "row", gap: layout.gapDefault }, style]}>
      {glyph ? <IconTile glyph={glyph} tone={tone} /> : null}
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text role="title3">{title}</Text>
        {description ? <Text role="caption" tone="muted">{description}</Text> : null}
      </View>
      {trailing}
    </View>
  );
}
