import "../global.css";
import { Component, Suspense, type PropsWithChildren, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AttendanceProvider } from "../src/providers/attendance-provider";
import { AuthProvider } from "../src/providers/auth-provider";
import { SyncProvider } from "../src/providers/sync-provider";
import { DATABASE_NAME, initializeDatabase } from "../src/lib/database";
import {
  Card,
  LanguageProvider,
  Text,
  ThemeProvider,
  ToastProvider,
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
      <ActivityIndicator size="large" color={colors.fillAccent} />
    </View>
  );
}

function StartupFailure({ message }: { message: string }) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.surfaceApp,
        flex: 1,
        justifyContent: "center",
        padding: 20,
      }}
    >
      <Card elevation={2} style={{ alignSelf: "center", gap: 6, maxWidth: 520, width: "100%" }}>
        <Text role="title2">Omam could not start</Text>
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
  const { direction } = useLanguage();
  const { fontsLoaded, fontError } = useTarazFonts();

  if (!fontsLoaded && !fontError) {
    return <Splash />;
  }

  return (
    <Suspense fallback={<Splash />}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase}>
        <AuthProvider>
          {/*
           * Attendance lives above the navigator, not inside `(tabs)`, so the
           * session editor at `/session/[id]` shares the same cache and its
           * `refresh()` reaches both tabs.
           */}
          <AttendanceProvider>
            {/* Sync sits under Attendance so a pull can refresh what is on screen. */}
            <SyncProvider>
              {/*
                 * Yoga reads `direction` here and mirrors every row, `start`
                 * and `end` beneath it — no app restart and no I18nManager.
                 */}
              <GestureHandlerRootView style={{ flex: 1, direction }}>
                <SafeAreaProvider>
                  <StatusBar style={isDark ? "light" : "dark"} />
                  <ToastProvider>
                    <Stack
                      screenOptions={{
                        headerShown: false,
                        animation: "fade",
                        animationTypeForReplace: "push",
                        animationDuration: motion.durFast,
                        contentStyle: { backgroundColor: colors.surfaceApp },
                      }}
                    >
                      <Stack.Screen name="(auth)" />
                      <Stack.Screen name="(tabs)" />
                      <Stack.Screen name="session/[id]" options={{ animation: "slide_from_right" }} />
                    </Stack>
                  </ToastProvider>
                </SafeAreaProvider>
              </GestureHandlerRootView>
            </SyncProvider>
          </AttendanceProvider>
        </AuthProvider>
      </SQLiteProvider>
    </Suspense>
  );
}

export default function RootLayout() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <RootErrorBoundary>
          <RootNavigation />
        </RootErrorBoundary>
      </ThemeProvider>
    </LanguageProvider>
  );
}
