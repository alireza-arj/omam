import { StyleSheet } from "react-native";
import { Tabs } from "heroui-native/tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import type { LucideIcon } from "lucide-react-native";
import { Glass } from "./glass";
import { Icon } from "./icon";
import { useColors } from "../theme";
import { useLanguage } from "../i18n";
import { layout, space, typeRolesByLanguage } from "../tokens";

export type TabItem = { label: string; glyph: LucideIcon };
export type TabBarProps = BottomTabBarProps & { items: Record<string, TabItem> };

export function TabBar({ state, descriptors, navigation, items }: TabBarProps) {
  const colors = useColors();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();

  return (
    <Glass style={[styles.bar, { paddingBottom: Math.max(insets.bottom, layout.gapDefault) }]}>
      <Tabs
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
          <Tabs.Indicator />
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
                style={{ alignItems: "center", flex: 1, flexDirection: "column", gap: space[1], minHeight: layout.tabBarContentHeight }}
              >
                <Icon glyph={item.glyph} size={space[9]} color={tint} />
                <Tabs.Label style={[typeRolesByLanguage[language].caption, { color: tint }]}>{item.label}</Tabs.Label>
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>
      </Tabs>
    </Glass>
  );
}

const styles = StyleSheet.create({
  bar: { bottom: 0, start: 0, end: 0, paddingTop: space[4], paddingHorizontal: layout.padPage, position: "absolute" },
});

export function useTabBarHeight() {
  const insets = useSafeAreaInsets();
  return space[4] + layout.tabBarContentHeight + Math.max(insets.bottom, layout.gapDefault);
}
