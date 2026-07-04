import { Redirect } from "expo-router";
import { Tabs } from "expo-router";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AttendanceProvider } from "../../src/providers/attendance-provider";
import { useAuth } from "../../src/providers/auth-provider";

const selectedIconColor = "#12372D";
const defaultIconColor = "rgba(16,32,59,0.46)";

const androidTabs = {
  index: {
    label: "Today",
    icon: require("../../assets/tabs/tab-home.png"),
  },
  report: {
    label: "Report",
    icon: require("../../assets/tabs/tab-report.png"),
  },
  profile: {
    label: "Profile",
    icon: require("../../assets/tabs/tab-profile.png"),
  },
} as const;

type AndroidTabName = keyof typeof androidTabs;

function TabsNavigation() {
  if (Platform.OS !== "ios") {
    return <AndroidTabsNavigation />;
  }

  return (
    <NativeTabs
      backgroundColor="rgba(255,255,255,0.72)"
      blurEffect="systemUltraThinMaterialLight"
      disableTransparentOnScrollEdge
      iconColor={{
        default: "rgba(16,32,59,0.46)",
        selected: selectedIconColor,
      }}
      labelVisibilityMode="unlabeled"
      rippleColor="rgba(105,243,198,0.18)"
      indicatorColor="rgba(105,243,198,0.28)"
      shadowColor="rgba(16,32,59,0.14)"
      tintColor={selectedIconColor}
    >
      <NativeTabs.Trigger name="index">
        <Icon
          sf={{ default: "house", selected: "house.fill" }}
          androidSrc={require("../../assets/tabs/tab-home.png")}
          selectedColor={selectedIconColor}
        />
        <Label hidden />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="report">
        <Icon
          sf={{ default: "chart.bar", selected: "chart.bar.fill" }}
          androidSrc={require("../../assets/tabs/tab-report.png")}
          selectedColor={selectedIconColor}
        />
        <Label hidden />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon
          sf={{ default: "person", selected: "person.fill" }}
          androidSrc={require("../../assets/tabs/tab-profile.png")}
          selectedColor={selectedIconColor}
        />
        <Label hidden />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function AndroidTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const bottomOffset = Math.max(insets.bottom, 14);
  const barWidth = Math.min(width - 40, 344);

  return (
    <View pointerEvents="box-none" style={[styles.androidBarRoot, { bottom: bottomOffset }]}>
      <View style={[styles.androidBar, { width: barWidth }]}>
        {state.routes.map((route, index) => {
          const tabName = route.name as AndroidTabName;
          const tab = androidTabs[tabName];

          if (!tab) {
            return null;
          }

          const descriptor = descriptors[route.key];
          const isFocused = state.index === index;
          const color = isFocused ? selectedIconColor : defaultIconColor;

          function handlePress() {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          }

          function handleLongPress() {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          }

          return (
            <Pressable
              key={route.key}
              accessibilityLabel={descriptor.options.tabBarAccessibilityLabel ?? tab.label}
              accessibilityRole="tab"
              accessibilityState={isFocused ? { selected: true } : undefined}
              onLongPress={handleLongPress}
              onPress={handlePress}
              style={({ pressed }) => [
                styles.androidTab,
                isFocused && styles.androidTabSelected,
                pressed && styles.androidTabPressed,
              ]}
            >
              <Image source={tab.icon} style={[styles.androidIcon, { tintColor: color }]} resizeMode="contain" />
              {isFocused ? <Text style={styles.androidTabLabel}>{tab.label}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function AndroidTabsNavigation() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => <AndroidTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: androidTabs.index.label }} />
      <Tabs.Screen name="report" options={{ title: androidTabs.report.label }} />
      <Tabs.Screen name="profile" options={{ title: androidTabs.profile.label }} />
    </Tabs>
  );
}

export default function TabsLayout() {
  const { isReady, isAuthenticated, needsProfileSetup } = useAuth();

  if (!isReady) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)" />;
  }

  if (needsProfileSetup) {
    return <Redirect href="/(auth)/profile" />;
  }

  return (
    <AttendanceProvider>
      <TabsNavigation />
    </AttendanceProvider>
  );
}

const styles = StyleSheet.create({
  androidBarRoot: {
    alignItems: "center",
    left: 0,
    position: "absolute",
    right: 0,
  },
  androidBar: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.88)",
    borderColor: "rgba(18,55,45,0.10)",
    borderRadius: 36,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 12,
    flexDirection: "row",
    gap: 6,
    height: 72,
    justifyContent: "space-between",
    paddingHorizontal: 10,
    shadowColor: "rgba(16,32,59,0.20)",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 26,
  },
  androidIcon: {
    height: 25,
    width: 25,
  },
  androidTab: {
    alignItems: "center",
    borderRadius: 28,
    flexDirection: "row",
    gap: 7,
    height: 54,
    justifyContent: "center",
    minWidth: 66,
    paddingHorizontal: 15,
  },
  androidTabLabel: {
    color: selectedIconColor,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  },
  androidTabPressed: {
    backgroundColor: "rgba(105,243,198,0.12)",
    transform: [{ scale: 0.97 }],
  },
  androidTabSelected: {
    backgroundColor: "rgba(105,243,198,0.34)",
    minWidth: 132,
  },
});
