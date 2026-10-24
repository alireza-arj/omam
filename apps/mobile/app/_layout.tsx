import "../global.css";
import { isDesktop } from "../src/lib/desktop";
import { desktopTokens } from "../src/design/taraz/tokens";
import { Component, Suspense, type PropsWithChildren, type ReactNode } from "react";
import { Platform, View } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useReducedMotion } from "react-native-reanimated";
import { AttendanceProvider } from "../src/providers/attendance-provider";
import { AuthProvider } from "../src/providers/auth-provider";
import { SyncProvider } from "../src/providers/sync-provider";
import { NotificationProvider } from "../src/providers/notification-provider";
import { DatabaseProvider } from "../src/providers/database-provider";
import { SessionConflicts } from "../src/components/session-conflicts";
import { SessionNotificationCoordinator } from "../src/components/session-notification-coordinator";
import { AppUpdateDialog } from "../src/components/app-update-dialog";
import {
  Card,
  LanguageProvider,
  Text,
  ThemeProvider,
  HeroUIProvider,
  Spinner,
  layout,
  motion,
  useLanguage,
  useTarazFonts,
  useTheme,
} from "../src/design/taraz";

function Splash() {
  const { colors } = useTheme();

  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: colors.surfaceApp,
        flex: 1,
        justifyContent: "center",
      }}
    >
      <Spinner size="lg" color={colors.fillAccent} />
    </View>
  );
}

function StartupFailure({ message }: { message: string }) {
  const { colors } = useTheme();
  const { t } = useLanguage();

  return (
    <View
      style={{
        backgroundColor: colors.surfaceApp,
        flex: 1,
        justifyContent: "center",
        padding: layout.padPage,
      }}
    >
      <Card elevation={2} style={{ alignSelf: "center", gap: layout.gapTight, maxWidth: layout.startupMaxWidth, width: "100%" }}>
        <Text role="title2">{t("common.startupFailed")}</Text>
        <Text role="bodySm" tone="muted">
          {message}
        </Text>
      </Card>
    </View>
  );
}

class RootErrorBoundary extends Component<PropsWithChildren, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render(): ReactNode {
    if (this.state.error) {
      return <StartupFailure message={this.state.error.message} />;
    }

    return this.props.children;
  }
}

function RootNavigation() {
  const { colors, isDark } = useTheme();
  const { fontsLoaded, fontError } = useTarazFonts();
  const reduceMotion = useReducedMotion();

  if (!fontsLoaded && !fontError) {
    return <Splash />;
  }

  return (
    <Suspense fallback={<Splash />}>
      <DatabaseProvider>
        <AuthProvider>
          {/*
           * Attendance lives above the navigator, not inside `(tabs)`, so the
           * session editor at `/session/[id]` shares the same cache and its
           * `refresh()` reaches both tabs.
           */}
          <AttendanceProvider>
            <SessionNotificationCoordinator />
            {/* Sync sits under Attendance so a pull can refresh what is on screen. */}
            <SyncProvider>
              <NotificationProvider>
                <SessionConflicts />
                <AppUpdateDialog />
                <StatusBar style={isDark ? "light" : "dark"} />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    animation: reduceMotion || isDesktop() ? "none" : "fade",
                    animationTypeForReplace: "push",
                    animationDuration: motion.durFast,
                    contentStyle: { backgroundColor: isDesktop() ? desktopTokens["--dt-clear"] : colors.surfaceApp },
                  }}
                >
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="session/[id]" options={{ animation: reduceMotion || isDesktop() ? "none" : "slide_from_right" }} />
                </Stack>
              </NotificationProvider>
            </SyncProvider>
          </AttendanceProvider>
        </AuthProvider>
      </DatabaseProvider>
    </Suspense>
  );
}

function WebFrame({ children }: PropsWithChildren) {
  const { colors } = useTheme();

  if (Platform.OS !== "web" || isDesktop()) return children;

  return (
    <View style={{ alignItems: "center", backgroundColor: colors.surfaceSunken, flex: 1 }}>
      <View
        style={{
          backgroundColor: colors.surfaceApp,
          borderColor: colors.lineHairline,
          borderStartWidth: layout.hairline,
          borderEndWidth: layout.hairline,
          flex: 1,
          maxWidth: layout.webFrameMaxWidth,
          overflow: "hidden",
          width: "100%",
        }}
      >
        {children}
      </View>
    </View>
  );
}

function AppProviders({ children }: PropsWithChildren) {
  const { direction } = useLanguage();
  return (
    <GestureHandlerRootView style={{ flex: 1, direction }}>
      <WebFrame>
        <SafeAreaProvider>
          <HeroUIProvider>{children}</HeroUIProvider>
        </SafeAreaProvider>
      </WebFrame>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AppProviders>
          <RootErrorBoundary>
            <RootNavigation />
          </RootErrorBoundary>
        </AppProviders>
      </ThemeProvider>
    </LanguageProvider>
  );
}
