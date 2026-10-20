import type { LucideIcon } from "lucide-react-native";
import { View } from "react-native";
import { useLanguage } from "../i18n";
import { useColors } from "../theme";

export type IconSize = 16 | 20 | 24 | 28;

export type IconProps = {
  /** Any Lucide glyph — the icon set is the only pictorial layer. */
  glyph: LucideIcon;
  size?: IconSize | number;
  color?: string;
  /** Filled treatment for the active tab item and the play affordance. */
  filled?: boolean;
  /** Arrows and chevrons that point along the reading direction flip under RTL. */
  directional?: boolean;
};

/**
 * The only way icons enter a design. Fixes the stroke at 1.5px on the 24px
 * grid so glyphs read as one clinical, thin-stroke set, and inherits the
 * current text colour by default.
 */
export function Icon({ glyph: Glyph, size = 20, color, filled = false, directional = false }: IconProps) {
  const colors = useColors();
  const { isRtl } = useLanguage();
  const tint = color ?? colors.textBody;

  const glyph = <Glyph size={size} color={tint} strokeWidth={1.5} fill={filled ? tint : "transparent"} />;

  // SVG ignores a style transform on react-native-web, so the mirror goes on a wrapper.
  return directional && isRtl ? <View style={{ transform: [{ scaleX: -1 }] }}>{glyph}</View> : glyph;
}
