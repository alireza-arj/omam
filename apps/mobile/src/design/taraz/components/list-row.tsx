import type { ReactNode } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import { ListGroup } from "heroui-native/list-group";
import { useLanguage } from "../i18n";
import { layout, typeRolesByLanguage } from "../tokens";

export type ListRowProps = {
  label: string;
  hint?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function ListRow({ label, hint, leading, trailing, onPress, style }: ListRowProps) {
  const { language } = useLanguage();
  const roles = typeRolesByLanguage[language];
  return (
    <ListGroup.Item
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      style={[{ minHeight: layout.tapMin, paddingHorizontal: 0, gap: layout.gapDefault }, style]}
    >
      {leading ? <ListGroup.ItemPrefix>{leading}</ListGroup.ItemPrefix> : null}
      <ListGroup.ItemContent>
        <ListGroup.ItemTitle style={roles.body}>{label}</ListGroup.ItemTitle>
        {hint ? <ListGroup.ItemDescription style={roles.caption}>{hint}</ListGroup.ItemDescription> : null}
      </ListGroup.ItemContent>
      {trailing ? <ListGroup.ItemSuffix>{trailing}</ListGroup.ItemSuffix> : null}
    </ListGroup.Item>
  );
}
