import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react-native";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { IconTile } from "./icon-tile";
import { Text } from "./text";
import { layout } from "../tokens";

export type EmptyStateProps = {
  title: string;
  /** One sentence of guidance, then one action. Nothing more. */
  description?: string;
  glyph?: LucideIcon;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({ title, description, glyph, action, style }: EmptyStateProps) {
  return (
    <View style={[{ alignItems: "center", gap: layout.gapTight, padding: layout.padSection }, style]}>
      {glyph ? <IconTile glyph={glyph} size={layout.tapMin} style={{ marginBottom: layout.gapTight }} /> : null}
      <Text role="title3" style={{ textAlign: "center" }}>{title}</Text>
      {description ? (
        <Text role="bodySm" tone="muted" style={{ textAlign: "center", maxWidth: layout.mobileContentMaxWidth - layout.padPage * 2 }}>
          {description}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: layout.gapDefault }}>{action}</View> : null}
    </View>
  );
}
