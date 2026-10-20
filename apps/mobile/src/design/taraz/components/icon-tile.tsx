import type { LucideIcon } from "lucide-react-native";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Icon } from "./icon";
import { useColors } from "../theme";
import { layout, radius, type ColorScheme } from "../tokens";

export type IconTileTone = "neutral" | "accent" | "success" | "warning" | "info";

const TONES: Record<IconTileTone, [keyof ColorScheme, keyof ColorScheme]> = {
  neutral: ["fillQuiet", "textBody"],
  accent: ["fillAccentSoft", "textAccent"],
  success: ["successFill", "successText"],
  warning: ["warningFill", "warningText"],
  info: ["infoFill", "infoText"],
};

export type IconTileProps = {
  glyph: LucideIcon;
  tone?: IconTileTone;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** The one leading-icon treatment: a soft square, so rows and headings line up. */
export function IconTile({ glyph, tone = "neutral", size = layout.iconTile, style }: IconTileProps) {
  const colors = useColors();
  const [background, foreground] = TONES[tone];

  return (
    <View
      style={[
        {
          alignItems: "center",
          backgroundColor: colors[background],
          borderRadius: radius.md,
          height: size,
          justifyContent: "center",
          width: size,
        },
        style,
      ]}
    >
      <Icon glyph={glyph} size={Math.round(size * 0.5)} color={colors[foreground]} />
    </View>
  );
}
