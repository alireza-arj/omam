import "../global.css";
import { Suspense, useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { SQLiteProvider } from "expo-sqlite";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Text, TextInput } from "react-native";
import {
  Vazirmatn_300Light,
  Vazirmatn_400Regular,
  Vazirmatn_500Medium,
  Vazirmatn_600SemiBold,
  Vazirmatn_700Bold,
} from "@expo-google-fonts/vazirmatn";
import { LanguageProvider, useLanguage } from "../src/providers/language-provider";
import { AuthProvider } from "../src/providers/auth-provider";
import { DATABASE_NAME, initializeDatabase } from "../src/lib/database";
import type { AppLanguage } from "../src/i18n/translations";

let didCaptureTypographyBase = false;
let baseTextStyle: unknown;
let baseTextInputStyle: unknown;
let configuredTypographyLanguage: AppLanguage | null = null;

function withLanguageFont(baseStyle: unknown, language: AppLanguage) {
  if (language !== "fa") {
    return baseStyle;
  }

  return baseStyle === undefined ? [{ fontFamily: "Vazirmatn_400Regular" }] : [{ fontFamily: "Vazirmatn_400Regular" }, baseStyle];
}

function configureDefaultTypography(language: AppLanguage) {
  if (configuredTypographyLanguage === language) {
    return;
  }

  const TextComponent = Text as unknown as { defaultProps?: { style?: unknown } };
  const TextInputComponent = TextInput as unknown as { defaultProps?: { style?: unknown } };

  if (!didCaptureTypographyBase) {
    baseTextStyle = TextComponent.defaultProps?.style;
    baseTextInputStyle = TextInputComponent.defaultProps?.style;
    didCaptureTypographyBase = true;
  }

  TextComponent.defaultProps = TextComponent.defaultProps ?? {};
  TextComponent.defaultProps.style = withLanguageFont(baseTextStyle, language);

  TextInputComponent.defaultProps = TextInputComponent.defaultProps ?? {};
  TextInputComponent.defaultProps.style = withLanguageFont(baseTextInputStyle, language);

  configuredTypographyLanguage = language;
}

function LoadingFallback() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#eaf4ed" }}>
      <ActivityIndicator size="large" color="#1e6f4d" />
    </View>
  );
}

function RootNavigation() {
  const { isReady, isRTL, language } = useLanguage();
  const [fontsLoaded] = useFonts({
    Vazirmatn_300Light,
    Vazirmatn_400Regular,
    Vazirmatn_500Medium,
    Vazirmatn_600SemiBold,
    Vazirmatn_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      configureDefaultTypography(language);
    }
  }, [fontsLoaded, language]);

  if (!isReady || !fontsLoaded) {
    return null;
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase}>
        <AuthProvider>
          <GestureHandlerRootView style={{ flex: 1, direction: isRTL ? "rtl" : "ltr" }}>
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
    <LanguageProvider>
      <RootNavigation />
    </LanguageProvider>
  );
}
