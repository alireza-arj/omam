import type { ReactNode } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./text";
import { layout, motion } from "../tokens";

export type ListRowProps = {
  label: string;
  hint?: string;
  leading?: ReactNode;
  /** A value, a control, or a chevron — one thing only. */
  trailing?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function ListRow({ label, hint, leading, trailing, onPress, style }: ListRowProps) {
  const body = (pressed: boolean): ViewStyle => ({
    alignItems: "center",
    flexDirection: "row",
    gap: layout.gapDefault,
    minHeight: layout.tapMin,
    paddingVertical: layout.padControlY,
    transform: [{ scale: pressed ? motion.pressScaleLarge : 1 }],
  });

  const content = (
    <>
      {leading}
      <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
        <Text role="body" tone="title" numberOfLines={1}>
          {label}
        </Text>
        {hint ? (
          <Text role="caption" tone="muted" numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
      {trailing}
    </>
  );

  if (!onPress) {
    return <View style={[body(false), style]}>{content}</View>;
  }

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [body(pressed), style]}>
      {content}
    </Pressable>
  );
}
