import type { LucideIcon } from "lucide-react-native";
import { useColors } from "../theme";

export type IconSize = 16 | 20 | 24 | 28;

export type IconProps = {
  /** Any Lucide glyph — the icon set is the only pictorial layer. */
  glyph: LucideIcon;
  size?: IconSize | number;
  color?: string;
  /** Filled treatment for the active tab item and the play affordance. */
  filled?: boolean;
};

/**
 * The only way icons enter a design. Fixes the stroke at 1.5px on the 24px
 * grid so glyphs read as one clinical, thin-stroke set, and inherits the
 * current text colour by default.
 */
export function Icon({ glyph: Glyph, size = 20, color, filled = false }: IconProps) {
  const colors = useColors();
  const tint = color ?? colors.textBody;

  return (
    <Glyph
      size={size}
      color={tint}
      strokeWidth={1.5}
      fill={filled ? tint : "transparent"}
    />
  );
}
