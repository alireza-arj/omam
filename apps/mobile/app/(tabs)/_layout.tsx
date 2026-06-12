import { Redirect, Tabs } from "expo-router";
import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring, interpolate, Extrapolation } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { AttendanceProvider } from "../../src/providers/attendance-provider";
import { House, BarChart3, UserRound } from "lucide-react-native";
import { palette } from "../../src/constants/theme";
import { useAuth } from "../../src/providers/auth-provider";
import { useLanguage } from "../../src/providers/language-provider";

const SPRING_CONFIG = { damping: 18, stiffness: 220, mass: 0.9 };

const styles = StyleSheet.create({
  glassBar: {
    position: "absolute",
    left: 20,
    right: 20,
    height: 72,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(16,32,59,0.07)",
    overflow: "hidden",
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 14,
  },
  blurFill: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientFill: {
    ...StyleSheet.absoluteFillObject,
  },
  orbGreen: {
    position: "absolute",
    left: -28,
    top: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(105,243,198,0.22)",
  },
  orbAmber: {
    position: "absolute",
    right: -24,
    bottom: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,198,113,0.14)",
  },
  orbMint: {
    position: "absolute",
    left: "40%",
    top: -30,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(105,243,198,0.10)",
  },
  tabSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: 2,
  },
  pill: {
    position: "absolute",
    width: 58,
    height: 52,
    borderRadius: 999,
    overflow: "hidden",
  },
  pillGradientActive: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
  },
  pillBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(79,178,128,0.30)",
  },
  pillHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  tabPressable: {
    flex: 1,
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});

function GlassBackground() {
  return (
    <View style={styles.glassBar} pointerEvents="none">
      <BlurView intensity={80} tint="light" style={styles.blurFill} />
      <LinearGradient
        colors={["rgba(255,255,255,0.88)", "rgba(244,250,247,0.82)", "rgba(232,246,237,0.78)"]}
        start={{ x: 0.08, y: 0.04 }}
        end={{ x: 0.94, y: 0.96 }}
        style={styles.gradientFill}
      />
      <View style={styles.orbGreen} />
      <View style={styles.orbAmber} />
      <View style={styles.orbMint} />
    </View>
  );
}

function LiquidTabButton({ selected, icon: Icon, label, onPress }: {
  selected: boolean;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  onPress: () => void;
}) {
  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(selected ? 1 : 0, SPRING_CONFIG);
  }, [selected]);

  const pillStyle = useAnimatedStyle(() => {
    const width = interpolate(progress.value, [0, 1], [48, 72], Extrapolation.CLAMP);
    const height = interpolate(progress.value, [0, 1], [48, 52], Extrapolation.CLAMP);
    const scale = interpolate(progress.value, [0, 1], [0.90, 1.03], Extrapolation.CLAMP);

    return {
      width,
      height,
      transform: [{ scale }],
      opacity: interpolate(progress.value, [0, 0.3, 1], [0, 1, 1], Extrapolation.CLAMP),
    };
  });

  const iconStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(progress.value, [0, 0.4, 1], [0.5, 0.8, 1], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(progress.value, [0, 1], [0.85, 1], Extrapolation.CLAMP) }],
    };
  });

  const labelStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(progress.value, [0, 0.4, 1], [0, 0.6, 1], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(progress.value, [0, 1], [2, 0], Extrapolation.CLAMP) }],
    };
  });

  const iconColor = selected ? palette.mint : "rgba(16,32,59,0.38)";
  const labelColor = `rgba(16,32,59,${interpolate(progress.value, [0, 1], [0.38, 1], Extrapolation.CLAMP).toFixed(2)})`;

  return (
    <Pressable onPress={onPress} style={styles.tabSlot}>
      <Reanimated.View style={[styles.pill, pillStyle]}>
        <LinearGradient
          colors={["#e9fff4", "#c5f3da", "#a8e8c4"]}
          start={{ x: 0.04, y: 0.06 }}
          end={{ x: 0.96, y: 0.94 }}
          style={styles.pillGradientActive}
        />
        <View style={styles.pillBorder} />
        <View style={styles.pillHighlight} />
      </Reanimated.View>

      <Reanimated.View style={[styles.iconWrap, iconStyle]}>
        <Icon size={20} color={iconColor} />
      </Reanimated.View>
      <Reanimated.Text style={[styles.label, { color: labelColor }, labelStyle]}>
        {label}
      </Reanimated.Text>
    </Pressable>
  );
}

function TabsNavigation() {
  const { language, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const tabLabels = useMemo(() => [t("tabs.home"), t("tabs.report"), t("tabs.profile")], [t]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        animation: "none",
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          left: 20,
          right: 20,
          bottom: Math.max(12, insets.bottom + 8),
          height: 72,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          borderWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarBackground: () => <GlassBackground />,
        tabBarActiveBackgroundColor: "transparent",
        tabBarInactiveBackgroundColor: "transparent",
        tabBarLabelStyle: {
          display: "none",
        },
        tabBarIconStyle: {
          display: "none",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: tabLabels[0],
          tabBarButton: (props) => (
            <LiquidTabButton
              selected={props.accessibilityState?.selected ?? false}
              icon={House}
              label={tabLabels[0]}
              onPress={() => props.onPress?.(null as any)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: tabLabels[1],
          tabBarButton: (props) => (
            <LiquidTabButton
              selected={props.accessibilityState?.selected ?? false}
              icon={BarChart3}
              label={tabLabels[1]}
              onPress={() => props.onPress?.(null as any)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: tabLabels[2],
          tabBarButton: (props) => (
            <LiquidTabButton
              selected={props.accessibilityState?.selected ?? false}
              icon={UserRound}
              label={tabLabels[2]}
              onPress={() => props.onPress?.(null as any)}
            />
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
