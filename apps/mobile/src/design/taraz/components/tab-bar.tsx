import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import type { LucideIcon } from "lucide-react-native";
import { Glass } from "./glass";
import { Icon } from "./icon";
import { Text } from "./text";
import { useColors } from "../theme";
import { layout, motion } from "../tokens";

export type TabItem = { label: string; glyph: LucideIcon };

export type TabBarProps = BottomTabBarProps & {
  items: Record<string, TabItem>;
};

/**
 * Translucent chrome fixed to the bottom edge; content scrolls beneath it.
 * Crimson marks the active item — the only colour in the bar. (The system asks
 * for a solid glyph here; Lucide ships no solid variant, so colour carries it.)
 */
export function TabBar({ state, descriptors, navigation, items }: TabBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Glass
      weight="regular"
      style={[
        styles.bar,
        {
          borderTopColor: colors.lineHairline,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const item = items[route.name];

        if (!item) {
          return null;
        }

        const focused = state.index === index;
        const tint = focused ? colors.fillAccent : colors.textMuted;

        function handlePress() {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        }

        return (
          <Pressable
            key={route.key}
            accessibilityLabel={descriptors[route.key]?.options.tabBarAccessibilityLabel ?? item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
            onPress={handlePress}
            style={({ pressed }) => [
              styles.tab,
              { transform: [{ scale: pressed ? motion.pressScale : 1 }] },
            ]}
          >
            <Icon glyph={item.glyph} size={24} color={tint} />
            <Text role="overline" color={tint}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </Glass>
  );
}

const styles = StyleSheet.create({
  bar: {
    bottom: 0,
    flexDirection: "row",
    left: 0,
    paddingTop: 8,
    position: "absolute",
    right: 0,
  },
  tab: {
    alignItems: "center",
    flex: 1,
    gap: 3,
    justifyContent: "center",
    minHeight: layout.tapMin,
  },
});

/** Icon (24) + gap + overline label + the bar's own padding. */
const TAB_BAR_CONTENT_HEIGHT = 8 + 24 + 3 + 14;

/** Bottom padding a screen needs so its content clears the translucent bar. */
export function useTabBarHeight() {
  const insets = useSafeAreaInsets();

  return TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 10);
}
