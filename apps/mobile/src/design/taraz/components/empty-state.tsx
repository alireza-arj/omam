import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./text";
import { useColors } from "../theme";
import { layout, radius } from "../tokens";

export type EmptyStateProps = {
  title: string;
  /** One sentence of guidance, then one action. Nothing more. */
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({ title, description, icon, action, style }: EmptyStateProps) {
  const colors = useColors();

  return (
    <View
      style={[
        { alignItems: "center", gap: layout.gapTight, paddingHorizontal: layout.padSection, paddingVertical: 28 },
        style,
      ]}
    >
      {icon ? (
        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.fillQuiet,
            borderRadius: radius.full,
            height: 44,
            justifyContent: "center",
            marginBottom: 2,
            width: 44,
          }}
        >
          {icon}
        </View>
      ) : null}

      <Text role="title3">{title}</Text>
      {description ? (
        <Text role="bodySm" tone="muted" style={{ textAlign: "center" }}>
          {description}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: layout.gapDefault }}>{action}</View> : null}
    </View>
  );
}
