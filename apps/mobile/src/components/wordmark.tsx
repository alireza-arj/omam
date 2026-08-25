import { Text as RNText, type StyleProp, type TextStyle } from "react-native";
import { fontFamily, useColors } from "../design/taraz";

type Props = {
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
};

/**
 * No mark was drawn for this system. Wherever a logo would go, the product
 * name is set in Figtree 800 at −4.5% tracking.
 */
export function Wordmark({ size = 30, color, style }: Props) {
  const colors = useColors();

  return (
    <RNText
      accessibilityRole="header"
      style={[
        {
          color: color ?? colors.textTitle,
          fontFamily: fontFamily.display[800],
          fontSize: size,
          letterSpacing: -0.045 * size,
          lineHeight: Math.round(size * 1.06),
        },
        style,
      ]}
    >
      Omam
    </RNText>
  );
}
