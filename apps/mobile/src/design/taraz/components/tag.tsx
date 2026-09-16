import type { ReactNode } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Chip } from "heroui-native/chip";
import { useLanguage } from "../i18n";
import { layout, typeRolesByLanguage } from "../tokens";

export type TagProps = {
  label: string;
  icon?: ReactNode;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function Tag({ label, icon, selected = false, onPress, style }: TagProps) {
  const { language } = useLanguage();
  return (
    <Chip
      variant={selected ? "primary" : "soft"}
      color="default"
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[{ alignSelf: "flex-start", minHeight: onPress ? layout.tapMin : undefined, gap: layout.gapTight }, style]}
    >
      {icon}
      <Chip.Label style={typeRolesByLanguage[language].label}>{label}</Chip.Label>
    </Chip>
  );
}

export const tagStyles = StyleSheet.create({ row: { flexDirection: "row", gap: layout.gapTight } });
