import { useMemo, useState } from "react";
import { Alert, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogIn, LockKeyhole, UserRound } from "lucide-react-native";
import { OmamLogo } from "../../src/components/omam-logo";
import { useAuth } from "../../src/providers/auth-provider";

function isUsernameValid(input: string) {
  return /^[a-zA-Z0-9_]{3,32}$/.test(input.trim());
}

export default function LoginScreen() {
  const { isAuthenticated, isReady, isMutating, signIn, needsProfileSetup } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isInvalid = useMemo(() => {
    return !isUsernameValid(username) || password.length < 6;
  }, [password.length, username]);

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
    setErrorMessage(null);

    if (!isUsernameValid(username)) {
      setErrorMessage("Username must be 3-32 letters, numbers, or underscores.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    try {
      await signIn(username.trim(), password);
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred while signing in.";
      setErrorMessage(message);

      if (Platform.OS !== "web") {
        Alert.alert("Sign in failed", message);
      }
    }
  }

  function updateUsername(value: string) {
    setUsername(value);
    if (errorMessage) setErrorMessage(null);
  }

  function updatePassword(value: string) {
    setPassword(value);
    if (errorMessage) setErrorMessage(null);
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

          <Text className="mt-2 text-center text-[34px] leading-[40px] text-[#0f2225]">Sign in to Omam</Text>
          <Text className="mt-2 text-center text-sm leading-6 text-[#5b6d70]">Enter your username and password to continue.</Text>

          <View className="mt-5 gap-2">
            <Text className="text-sm text-[#5b6d70]">Username</Text>
            <View className="min-h-[52px] flex-row items-center rounded-xl border border-[#d7e4db] bg-white px-4">
              <UserRound size={18} color="#245748" />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                value={username}
                onChangeText={updateUsername}
                placeholder="e.g. hassan_dev"
                placeholderTextColor="#8b9598"
                className="mx-3 flex-1 py-3 text-base text-[#163034]"
                accessibilityLabel="Username"
              />
            </View>
          </View>

          <View className="mt-3 gap-2">
            <Text className="text-sm text-[#5b6d70]">Password</Text>
            <View className="min-h-[52px] flex-row items-center rounded-xl border border-[#d7e4db] bg-white px-4">
              <LockKeyhole size={18} color="#245748" />
              <TextInput
                secureTextEntry
                autoComplete="password"
                value={password}
                onChangeText={updatePassword}
                placeholder="At least 6 characters"
                placeholderTextColor="#8b9598"
                className="mx-3 flex-1 py-3 text-base text-[#163034]"
                accessibilityLabel="Password"
                onSubmitEditing={handleLogin}
              />
            </View>
          </View>

          {errorMessage ? (
            <Text accessibilityRole="alert" className="mt-4 rounded-xl bg-[#fff2f0] px-4 py-3 text-sm leading-5 text-[#a23b2a]">
              {errorMessage}
            </Text>
          ) : null}

          <Pressable
            onPress={handleLogin}
            disabled={isMutating}
            accessibilityRole="button"
            accessibilityState={{ disabled: isMutating, busy: isMutating }}
            className={`mt-5 min-h-[52px] flex-row items-center justify-center rounded-full px-5 ${isInvalid ? "bg-[#9fbab0]" : "bg-[#1e6f4d]"}`}
          >
            <LogIn size={19} color="#f7fbf7" />
            <Text className="mx-2 text-center text-base text-[#f7fbf7]">
              {isMutating ? "Signing in..." : "Sign in"}
            </Text>
          </Pressable>

          <Text className="mt-4 text-center text-xs leading-5 text-[#7d8c88]">
            If there is no user yet, the first sign-in automatically creates the initial account.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
