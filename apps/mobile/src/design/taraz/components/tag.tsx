import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./text";
import { useColors } from "../theme";
import { motion, radius } from "../tokens";

export type TagProps = {
  label: string;
  icon?: ReactNode;
  /** A selected tag is near-black, not crimson — crimson always means *do something*. */
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function Tag({ label, icon, selected = false, onPress, style }: TagProps) {
  const colors = useColors();

  const body = (pressed: boolean): ViewStyle => ({
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: selected
      ? colors.surfaceInverse
      : pressed
        ? colors.fillQuietPressed
        : colors.fillQuiet,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: 5,
    height: 28,
    paddingHorizontal: 10,
    transform: [{ scale: pressed ? motion.pressScale : 1 }],
  });

  const content = (
    <>
      {icon}
      <Text role="label" color={selected ? colors.textOnInverse : colors.textBody}>
        {label}
      </Text>
    </>
  );

  if (!onPress) {
    return <View style={[body(false), style]}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [body(pressed), style]}
    >
      {content}
    </Pressable>
  );
}

export const tagStyles = StyleSheet.create({ row: { flexDirection: "row", gap: 6 } });
