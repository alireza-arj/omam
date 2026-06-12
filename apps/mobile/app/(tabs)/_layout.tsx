import { Redirect, Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { BarChart3, House, UserRound } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AttendanceProvider } from "../../src/providers/attendance-provider";
import { palette } from "../../src/constants/theme";
import { useAuth } from "../../src/providers/auth-provider";
import { useLanguage } from "../../src/providers/language-provider";

const activePillColors = ["#e9fff4", "#c5f3da", "#8ee0b8"] as const;
const inactivePillColors = ["rgba(255,255,255,0.96)", "rgba(244,248,246,0.96)", "rgba(235,241,238,0.96)"] as const;

const styles = StyleSheet.create({
  tabSlot: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  tabPill: {
    height: 58,
    borderRadius: 999,
    overflow: "hidden",
    justifyContent: "center",
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 6,
  },
  tabPillBorder: {
    borderRadius: 999,
    borderWidth: 1,
  },
  tabPillBorderActive: {
    borderColor: "rgba(79, 178, 128, 0.28)",
  },
  tabPillBorderInactive: {
    borderColor: "rgba(16, 32, 59, 0.06)",
  },
  tabPressable: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  tabContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});

function LiquidTabButton(props: BottomTabBarButtonProps) {
  const { children, accessibilityState, accessibilityLabel, testID, onPress, onLongPress, style } = props;
  const focused = Boolean(accessibilityState?.selected);
  const focusProgress = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(focusProgress, {
      toValue: focused ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [focusProgress, focused]);

  const pillWidth = focusProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [60, 158],
  });
  const pillScale = focusProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.03],
  });
  const activeLayerOpacity = focusProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const contentOpacity = focusProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.76, 1],
  });
  const shadowOpacity = focusProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.06, 0.18],
  });

  return (
    <View style={[style, styles.tabSlot]}>
      <Animated.View
        style={[
          styles.tabPill,
          {
            width: pillWidth,
            shadowOpacity,
            transform: [{ scale: pillScale }],
          },
        ]}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <LinearGradient colors={inactivePillColors} start={{ x: 0.05, y: 0.1 }} end={{ x: 0.95, y: 0.95 }} style={StyleSheet.absoluteFill} />
        </View>

        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: activeLayerOpacity }]}>
          <LinearGradient colors={activePillColors} start={{ x: 0.04, y: 0.08 }} end={{ x: 0.96, y: 0.94 }} style={StyleSheet.absoluteFill} />
        </Animated.View>

        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            styles.tabPillBorder,
            focused ? styles.tabPillBorderActive : styles.tabPillBorderInactive,
          ]}
        />

        <Pressable
          testID={testID}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="tab"
          accessibilityState={accessibilityState}
          onPress={onPress}
          onLongPress={onLongPress}
          style={styles.tabPressable}
        >
          <Animated.View style={[styles.tabContent, { opacity: contentOpacity }]}>{children}</Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function TabsNavigation() {
  const { language, t } = useLanguage();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        animation: "fade",
        tabBarLabelPosition: "beside-icon",
        tabBarShowLabel: true,
        tabBarActiveTintColor: palette.ink,
        tabBarInactiveTintColor: "rgba(16,32,59,0.44)",
        tabBarStyle: {
          position: "absolute",
          left: 14,
          right: 14,
          bottom: Math.max(12, insets.bottom + 8),
          height: 92,
          paddingHorizontal: 10,
          paddingVertical: 12,
          borderRadius: 32,
          backgroundColor: "rgba(255,255,255,0.9)",
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: "rgba(16, 32, 59, 0.08)",
          shadowColor: palette.ink,
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: 0.14,
          shadowRadius: 24,
          elevation: 16,
          overflow: "hidden",
        },
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <BlurView intensity={20} tint="light" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={["rgba(255,255,255,0.92)", "rgba(246,250,248,0.9)", "rgba(237,247,241,0.88)"]}
              start={{ x: 0.1, y: 0.05 }}
              end={{ x: 0.92, y: 0.95 }}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={{
                position: "absolute",
                left: -26,
                top: -18,
                width: 108,
                height: 108,
                borderRadius: 999,
                backgroundColor: "rgba(105,243,198,0.18)",
              }}
            />
            <View
              style={{
                position: "absolute",
                right: -22,
                bottom: -18,
                width: 130,
                height: 130,
                borderRadius: 999,
                backgroundColor: "rgba(255,198,113,0.12)",
              }}
            />
          </View>
        ),
        tabBarButton: (props) => <LiquidTabButton {...props} />,
        tabBarActiveBackgroundColor: "transparent",
        tabBarInactiveBackgroundColor: "transparent",
        tabBarLabelStyle: {
          fontSize: 13,
          lineHeight: 16,
          ...(language === "fa" ? { fontFamily: "Vazirmatn_600SemiBold" } : { fontWeight: "600" }),
        },
        tabBarIconStyle: {
          marginEnd: 2,
        },
        tabBarItemStyle: {
          flex: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          tabBarIcon: ({ color, size, focused }) => (
            <House color={focused ? palette.ink : color} size={size - 2} strokeWidth={focused ? 2.5 : 2.1} />
          ),
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: t("tabs.report"),
          tabBarIcon: ({ color, size, focused }) => (
            <BarChart3 color={focused ? palette.ink : color} size={size - 2} strokeWidth={focused ? 2.5 : 2.1} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: ({ color, size, focused }) => (
            <UserRound color={focused ? palette.ink : color} size={size - 2} strokeWidth={focused ? 2.5 : 2.1} />
          ),
        }}
      />
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
