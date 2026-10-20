import { Text as RNText, type StyleProp, type TextStyle } from "react-native";
import { fontFamily, localizedFace, useColors, useLanguage } from "../design/taraz";

type Props = {
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
};

/**
 * No mark was drawn for this system. Wherever a logo would go, the product
 * name is set in the display face at 800, tracked tight in Latin only.
 */
export function Wordmark({ size = 30, color, style }: Props) {
  const colors = useColors();
  const { language, isRtl, t } = useLanguage();

  return (
    <RNText
      accessibilityRole="header"
      style={[
        {
          color: color ?? colors.textTitle,
          fontFamily: localizedFace(fontFamily.display[800], language),
          fontSize: size,
          letterSpacing: isRtl ? 0 : -0.045 * size,
          lineHeight: Math.round(size * (isRtl ? 1.4 : 1.1)),
          writingDirection: isRtl ? "rtl" : "ltr",
        },
        style,
      ]}
    >
      {t("admin.brand")}
    </RNText>
  );
}
