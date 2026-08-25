import { View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./text";
import { useColors } from "../theme";
import { radius, type ColorScheme } from "../tokens";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "info";

export type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
};

function paint(tone: BadgeTone, colors: ColorScheme) {
  switch (tone) {
    case "accent":
      return { background: colors.fillAccentSoft, text: colors.textAccent };
    case "success":
      return { background: colors.successFill, text: colors.successText };
    case "warning":
      return { background: colors.warningFill, text: colors.warningText };
    case "info":
      return { background: colors.infoFill, text: colors.infoText };
    default:
      return { background: colors.fillQuiet, text: colors.textMuted };
  }
}

/**
 * The one place uppercase is allowed alongside the overline label — short
 * status and format marks set at 11px with 0.09em tracking.
 */
export function Badge({ label, tone = "neutral", style }: BadgeProps) {
  const colors = useColors();
  const { background, text } = paint(tone, colors);

  return (
    <View
      style={[
        {
          alignSelf: "flex-start",
          backgroundColor: background,
          borderRadius: radius.xs,
          paddingHorizontal: 6,
          paddingVertical: 3,
        },
        style,
      ]}
    >
      <Text role="overline" color={text}>
        {label}
      </Text>
    </View>
  );
}
