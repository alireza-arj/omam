import type { LucideIcon } from "lucide-react-native";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Card } from "./card";
import { IconTile, type IconTileTone } from "./icon-tile";
import { Text } from "./text";
import { layout } from "../tokens";

export type StatProps = {
  label: string;
  value: string;
  hint?: string;
  glyph?: LucideIcon;
  tone?: IconTileTone;
  /** Counts and timecodes are monospaced; everything else is display type. */
  mono?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Stat({ label, value, hint, glyph, tone, mono = false, style }: StatProps) {
  return (
    <Card style={[{ flex: 1, gap: layout.gapDefault, minWidth: 0 }, style]}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: layout.gapTight + 2 }}>
        {glyph ? <IconTile glyph={glyph} tone={tone} size={layout.controlSm} /> : null}
        <Text role="label" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
          {label}
        </Text>
      </View>
      <View style={{ gap: 2 }}>
        <Text role={mono ? "monoLg" : "title1"} tone="title" numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {hint ? (
          <Text role="caption" tone="muted" numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
