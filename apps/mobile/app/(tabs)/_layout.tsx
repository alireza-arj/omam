import { Redirect, Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { BarChart3, Clock3, House, UserRound } from "lucide-react-native";
import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native";
import { AttendanceProvider } from "../../src/providers/attendance-provider";
import { useAuth } from "../../src/providers/auth-provider";
import { useLanguage } from "../../src/providers/language-provider";

const gradientMapping: Record<string, readonly [string, string]> = {
  blue: ["hsl(223, 90%, 50%)", "hsl(208, 90%, 50%)"],
  purple: ["hsl(283, 90%, 50%)", "hsl(268, 90%, 50%)"],
  red: ["hsl(3, 90%, 50%)", "hsl(348, 90%, 50%)"],
  indigo: ["hsl(253, 90%, 50%)", "hsl(238, 90%, 50%)"],
  orange: ["hsl(43, 90%, 50%)", "hsl(28, 90%, 50%)"],
  green: ["hsl(123, 90%, 40%)", "hsl(108, 90%, 40%)"],
};

function GlassTabIcon({
  focused,
  color,
  children,
}: {
  focused: boolean;
  color: keyof typeof gradientMapping;
  children: ReactNode;
}) {
  const focusProgress = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(focusProgress, {
      toValue: focused ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [focusProgress, focused]);

  const shadowRotate = focusProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ["15deg", "25deg"],
  });
  const shadowTranslateX = focusProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });
  const shadowTranslateY = focusProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });
  const glassScale = focusProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });
  const glassTranslateY = focusProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 0],
  });
  const iconTranslateY = focusProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -1],
  });

  const [fromColor, toColor] = gradientMapping[color];

  return (
    <View
      style={{
        width: 48,
        height: 48,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ perspective: 240 }],
      }}
    >
      <Animated.View
        style={{
          position: "absolute",
          width: 44,
          height: 44,
          borderRadius: 14,
          shadowColor: "#222a35",
          shadowOffset: { width: 8, height: -8 },
          shadowOpacity: 0.2,
          shadowRadius: 10,
          elevation: 8,
          transform: [{ rotate: shadowRotate }, { translateX: shadowTranslateX }, { translateY: shadowTranslateY }],
        }}
      >
        <LinearGradient
          colors={[fromColor, toColor]}
          start={{ x: 0.2, y: 0.1 }}
          end={{ x: 0.8, y: 1 }}
          style={{ flex: 1, borderRadius: 14 }}
        />
      </Animated.View>

      <Animated.View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.36)",
          transform: [{ scale: glassScale }, { translateY: glassTranslateY }],
        }}
      >
        <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0.08)"]}
          start={{ x: 0.08, y: 0.05 }}
          end={{ x: 0.92, y: 0.95 }}
          style={{ flex: 1 }}
        />
      </Animated.View>

      <Animated.View
        style={{
          position: "absolute",
          transform: [{ translateY: iconTranslateY }],
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

function TabsNavigation() {
  const { language, t } = useLanguage();
  const { width: screenWidth } = useWindowDimensions();
  const tabBarWidth = Math.min(screenWidth * 0.84, 360);
  const tabBarHorizontalInset = Math.max((screenWidth - tabBarWidth) / 2, 12);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        animation: "fade",
        transitionSpec: {
          animation: "timing",
          config: {
            duration: 140,
            easing: Easing.out(Easing.cubic),
          },
        },
        tabBarStyle: {
          position: "absolute",
          left: tabBarHorizontalInset,
          right: tabBarHorizontalInset,
          bottom: 20,
          height: 66,
          paddingTop: 8,
          paddingBottom: 8,
          borderRadius: 999,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: "rgba(198,213,204,0.92)",
          shadowColor: "#17372b",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.16,
          shadowRadius: 16,
          elevation: 10,
          overflow: "hidden",
        },
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFill}>
            <BlurView intensity={42} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={["rgba(248, 251, 247, 0.95)", "rgba(234, 244, 237, 0.9)", "rgba(248, 241, 225, 0.9)"]}
              start={{ x: 0.05, y: 0.1 }}
              end={{ x: 0.95, y: 0.9 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ),
        tabBarActiveTintColor: "#1c8f87",
        tabBarInactiveTintColor: "rgba(42,52,50,0.58)",
        tabBarLabelStyle: {
          fontSize: 10,
          ...(language === "fa" ? { fontFamily: "Vazirmatn_500Medium" } : {}),
        },
        tabBarItemStyle: {
          borderRadius: 18,
          marginHorizontal: 2,
        },
      }}
    >
      <Tabs.Screen
        name="report"
        options={{
          title: t("tabs.report"),
          tabBarIcon: ({ color, size, focused }) => (
            <GlassTabIcon focused={focused} color="blue">
              <BarChart3 color={focused ? "#f5fffb" : color} size={size - 2} />
            </GlassTabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.today"),
          tabBarIcon: ({ color, size, focused }) => (
            <GlassTabIcon focused={focused} color="green">
              <House color={focused ? "#f5fffb" : color} size={size - 2} />
            </GlassTabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: ({ color, size, focused }) => (
            <GlassTabIcon focused={focused} color="purple">
              <UserRound color={focused ? "#f5fffb" : color} size={size - 2} />
            </GlassTabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          href: null,
          title: t("tabs.history"),
          tabBarIcon: ({ color, size }) => (
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Clock3 color={color} size={size - 2} />
            </View>
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
