import { useMemo, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogIn, LockKeyhole, UserRound } from "lucide-react-native";
import { OmamLogo } from "../../src/components/omam-logo";
import { useAuth } from "../../src/providers/auth-provider";
import { useLanguage } from "../../src/providers/language-provider";

function isUsernameValid(input: string) {
  return /^[a-zA-Z0-9_]{3,32}$/.test(input.trim());
}

export default function LoginScreen() {
  const { isAuthenticated, isReady, isMutating, signIn, needsProfileSetup } = useAuth();
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const isDisabled = useMemo(() => {
    return isMutating || !isUsernameValid(username) || password.length < 6;
  }, [isMutating, password.length, username]);

  if (!isReady) {
    return null;
  }

  if (isAuthenticated) {
    if (needsProfileSetup) {
      return <Redirect href="/(auth)/profile" />;
    }

    return <Redirect href="/(tabs)" />;
  }

  async function handleLogin() {
    try {
      await signIn(username.trim(), password);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("auth.errorFallback");
      Alert.alert(t("auth.errorTitle"), message);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#eaf4ed]" edges={["top", "bottom"]}>
      <View className="flex-1 items-center justify-center bg-[#eaf4ed] px-6 pb-8 pt-6">
        <View className="absolute left-[-120px] top-[-80px] h-[230px] w-[230px] rounded-full bg-[#1f7d56]/10" />
        <View className="absolute right-[-90px] top-[150px] h-[190px] w-[190px] rounded-full bg-[#c9ad64]/14" />

        <View
          className="w-full max-w-[460px] rounded-[34px] border border-[#d5e5da] bg-[#f8fdf9] px-5 py-6"
          style={{
            shadowColor: "#15372b",
            shadowOffset: { width: 0, height: 14 },
            shadowOpacity: 0.08,
            shadowRadius: 24,
            elevation: 3,
          }}
        >
          <View className="mb-5 items-center">
            <View className="rounded-[28px] border border-[#d5e5da] bg-white p-3">
              <OmamLogo size={88} />
            </View>
          </View>

          <Text className="mt-2 text-center text-[34px] leading-[40px] text-[#0f2225]">{t("auth.startSubtitle")}</Text>
          <Text className="mt-2 text-center text-sm leading-6 text-[#5b6d70]">{t("auth.startHint")}</Text>

          <View className="mt-5 gap-2">
            <Text className="text-sm text-[#5b6d70]">{t("auth.username")}</Text>
            <View className="min-h-[52px] flex-row items-center rounded-xl border border-[#d7e4db] bg-white px-4">
              <UserRound size={18} color="#245748" />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                value={username}
                onChangeText={setUsername}
                placeholder={t("auth.usernamePlaceholder")}
                placeholderTextColor="#8b9598"
                className="mx-3 flex-1 py-3 text-base text-[#163034]"
                accessibilityLabel={t("auth.username")}
              />
            </View>
          </View>

          <View className="mt-3 gap-2">
            <Text className="text-sm text-[#5b6d70]">{t("auth.password")}</Text>
            <View className="min-h-[52px] flex-row items-center rounded-xl border border-[#d7e4db] bg-white px-4">
              <LockKeyhole size={18} color="#245748" />
              <TextInput
                secureTextEntry
                autoComplete="password"
                value={password}
                onChangeText={setPassword}
                placeholder={t("auth.passwordPlaceholder")}
                placeholderTextColor="#8b9598"
                className="mx-3 flex-1 py-3 text-base text-[#163034]"
                accessibilityLabel={t("auth.password")}
                onSubmitEditing={isDisabled ? undefined : handleLogin}
              />
            </View>
          </View>

          <Pressable
            onPress={handleLogin}
            disabled={isDisabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: isDisabled, busy: isMutating }}
            className={`mt-5 min-h-[52px] flex-row items-center justify-center rounded-full px-5 ${isDisabled ? "bg-[#9fbab0]" : "bg-[#1e6f4d]"}`}
          >
            <LogIn size={19} color="#f7fbf7" />
            <Text className="mx-2 text-center text-base text-[#f7fbf7]">
              {isMutating ? t("auth.loggingIn") : t("auth.login")}
            </Text>
          </Pressable>

          <Text className="mt-4 text-center text-xs leading-5 text-[#7d8c88]">{t("auth.firstUserHint")}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
