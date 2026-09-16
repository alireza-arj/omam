import { type StyleProp, type ViewStyle } from "react-native";
import { Chip } from "heroui-native/chip";
import { useLanguage } from "../i18n";
import { useColors } from "../theme";
import { typeRolesByLanguage } from "../tokens";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "info";
export type BadgeProps = { label: string; tone?: BadgeTone; style?: StyleProp<ViewStyle> };

export function Badge({ label, tone = "neutral", style }: BadgeProps) {
  const colors = useColors();
  const { language } = useLanguage();
  return (
    <Chip
      size="sm"
      variant="soft"
      color={tone === "neutral" || tone === "info" ? "default" : tone}
      style={[{ alignSelf: "flex-start" }, tone === "info" ? { backgroundColor: colors.infoFill } : null, style]}
    >
      <Chip.Label style={[typeRolesByLanguage[language].caption, tone === "info" ? { color: colors.infoText } : null]}>{label}</Chip.Label>
    </Chip>
  );
}
