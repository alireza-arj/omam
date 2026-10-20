import type { ReactNode } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import { ListGroup } from "heroui-native/list-group";
import { ChevronRight } from "lucide-react-native";
import { Icon } from "./icon";
import { useLanguage } from "../i18n";
import { useColors } from "../theme";
import { layout, typeRolesByLanguage } from "../tokens";

export type ListRowProps = {
  label: string;
  hint?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Adds the reading-direction chevron when the row opens something. */
  chevron?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function ListRow({ label, hint, leading, trailing, chevron = false, onPress, style }: ListRowProps) {
  const { language } = useLanguage();
  const colors = useColors();
  const roles = typeRolesByLanguage[language];
  return (
    <ListGroup.Item
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={[{ minHeight: layout.controlField, paddingHorizontal: 0, paddingVertical: layout.gapTight, gap: layout.gapDefault }, style]}
    >
      {leading ? <ListGroup.ItemPrefix>{leading}</ListGroup.ItemPrefix> : null}
      <ListGroup.ItemContent>
        <ListGroup.ItemTitle style={[roles.body, { color: colors.textTitle }]}>{label}</ListGroup.ItemTitle>
        {hint ? <ListGroup.ItemDescription style={[roles.caption, { color: colors.textMuted }]}>{hint}</ListGroup.ItemDescription> : null}
      </ListGroup.ItemContent>
      {trailing || chevron ? (
        <ListGroup.ItemSuffix style={{ flexDirection: "row", alignItems: "center", gap: layout.gapTight }}>
          {trailing}
          {chevron ? <Icon glyph={ChevronRight} size={layout.iconSm} color={colors.textFaint} directional /> : null}
        </ListGroup.ItemSuffix>
      ) : null}
    </ListGroup.Item>
  );
}
