import { View } from "react-native";
import { startupTokens, useLanguage, useTheme } from "../design/taraz";
import { BrandMark } from "./brand-mark";

export function StartupSplash() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();

  return (
    <View
      testID="startup-splash"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${t("admin.brand")} — ${t("common.loading")}`}
      accessibilityState={{ busy: true }}
      style={{ alignItems: "center", backgroundColor: colors.surfaceApp, flex: 1, justifyContent: "center" }}
    >
      <BrandMark size={startupTokens.logoSize} backgroundColor={isDark ? startupTokens.darkLogoBackground : startupTokens.lightLogoBackground} />
    </View>
  );
}
