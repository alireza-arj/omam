import { StyleSheet, View } from "react-native";
import type { ComponentProps } from "react";
import { Tabs as RouterTabs } from "expo-router";
import { Tabs } from "heroui-native/tabs";
import { Easing } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { LucideIcon } from "lucide-react-native";
import { Glass } from "./glass";
import { Icon } from "./icon";
import { useColors } from "../theme";
import { useLanguage } from "../i18n";
import { layout, motion, radius, shadow, space, typeRolesByLanguage } from "../tokens";

const indicatorTiming = {
  type: "timing" as const,
  config: {
    duration: motion.durFast,
    easing: Easing.bezier(motion.easeInOut.x1, motion.easeInOut.y1, motion.easeInOut.x2, motion.easeInOut.y2),
  },
};

export type TabItem = { label: string; glyph: LucideIcon };
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof RouterTabs>["tabBar"]>>[0];
export type TabBarProps = BottomTabBarProps & { items: Record<string, TabItem> };

export function TabBar({ state, descriptors, navigation, items }: TabBarProps) {
  const colors = useColors();
  const { language, direction } = useLanguage();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { bottom: insets.bottom + layout.gapDefault, backgroundColor: colors.surfaceGlassStrong }, shadow(3, colors)]}>
    <Glass strong style={styles.material}>
      <Tabs
        key={direction}
        value={state.routes[state.index].key}
        onValueChange={(key) => {
          const route = state.routes.find((entry) => entry.key === key);
          if (!route) return;
          const event = navigation.emit({ type: "tabPress", target: key, canPreventDefault: true });
          if (state.routes[state.index].key !== key && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        }}
      >
        <Tabs.List style={{ backgroundColor: "transparent", padding: 0, width: "100%" }}>
          <Tabs.Indicator animation={{ width: indicatorTiming, height: indicatorTiming, translateX: indicatorTiming }} />
          {state.routes.map((route, index) => {
            const item = items[route.name];
            if (!item) return null;
            const focused = state.index === index;
            const tint = focused ? colors.fillAccent : colors.textMuted;
            return (
              <Tabs.Trigger
                key={route.key}
                value={route.key}
                accessibilityLabel={descriptors[route.key]?.options.tabBarAccessibilityLabel ?? item.label}
                onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
                style={{ alignItems: "center", flex: 1, flexDirection: "column", gap: space[1], minHeight: layout.tabBarContentHeight, paddingVertical: space[2] }}
              >
                <Icon glyph={item.glyph} size={layout.iconMd + 2} color={tint} filled={false} />
                <Tabs.Label style={[typeRolesByLanguage[language].caption, { color: tint, textAlign: "center" }]}>{item.label}</Tabs.Label>
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>
      </Tabs>
    </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { start: layout.padPage, end: layout.padPage, position: "absolute", borderRadius: radius.pill, maxWidth: layout.mobileContentMaxWidth, marginHorizontal: "auto" },
  material: { borderRadius: radius.pill, paddingHorizontal: space[4], paddingVertical: space[2] },
});

export function useTabBarHeight() {
  const insets = useSafeAreaInsets();
  return space[2] * 2 + layout.tabBarContentHeight + layout.hairline * 2 + insets.bottom + layout.gapDefault + layout.gapLoose;
}
