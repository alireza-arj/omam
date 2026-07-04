import "../global.css";
import { Component, Suspense, type PropsWithChildren, type ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../src/providers/auth-provider";
import { DATABASE_NAME, initializeDatabase } from "../src/lib/database";

function LoadingFallback() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#eaf4ed" }}>
      <ActivityIndicator size="large" color="#1e6f4d" />
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
      return (
        <View style={{ flex: 1, justifyContent: "center", backgroundColor: "#eaf4ed", padding: 24 }}>
          <View style={{ width: "100%", maxWidth: 520, alignSelf: "center", borderRadius: 24, backgroundColor: "#f8fdf9", padding: 24 }}>
            <Text style={{ color: "#0f2225", fontSize: 24, lineHeight: 30 }}>Omam could not start</Text>
            <Text style={{ marginTop: 10, color: "#5b6d70", fontSize: 15, lineHeight: 22 }}>
              {this.state.error.message}
            </Text>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

function RootNavigation() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase}>
        <AuthProvider>
          <GestureHandlerRootView style={{ flex: 1, direction: "ltr" }}>
            <SafeAreaProvider>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: "fade",
                  animationTypeForReplace: "push",
                  animationDuration: 140,
                }}
              >
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
              </Stack>
            </SafeAreaProvider>
          </GestureHandlerRootView>
        </AuthProvider>
      </SQLiteProvider>
    </Suspense>
  );
}

export default function RootLayout() {
  return (
    <RootErrorBoundary>
      <RootNavigation />
    </RootErrorBoundary>
  );
}
