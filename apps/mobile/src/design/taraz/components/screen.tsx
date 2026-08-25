import type { ReactNode } from "react";
import { ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "../theme";
import { layout } from "../tokens";

export type ScreenProps = {
  children: ReactNode;
  /** Flat `--surface-app`. No textures, no patterns, no illustration. */
  scroll?: boolean;
  gutter?: boolean;
  gap?: number;
  /** Room for the translucent tab bar the content scrolls beneath. */
  bottomInset?: number;
  center?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  scroll = false,
  gutter = true,
  gap = layout.gapDefault,
  bottomInset = 0,
  center = false,
  contentStyle,
}: ScreenProps) {
  const colors = useColors();
  const padding: ViewStyle = {
    paddingHorizontal: gutter ? layout.padPage : 0,
    paddingBottom: bottomInset,
    gap,
  };

  return (
    <SafeAreaView style={{ backgroundColor: colors.surfaceApp, flex: 1 }} edges={["top"]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[padding, { paddingTop: layout.gapDefault }, contentStyle]}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={[
            padding,
            { flex: 1, paddingTop: layout.gapDefault },
            center ? { alignItems: "center", justifyContent: "center" } : null,
            contentStyle,
          ]}
        >
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
