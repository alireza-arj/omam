import { useMemo, useState } from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LockKeyhole, UserRound } from "lucide-react-native";
import { Wordmark } from "../../src/components/wordmark";
import { useAuth } from "../../src/providers/auth-provider";
import {
  Button,
  Card,
  Icon,
  Input,
  Text,
  layout,
  useColors,
} from "../../src/design/taraz";

type Mode = "signIn" | "signUp";

const MIN_PASSWORD_LENGTH = 6;

function isUsernameValid(input: string) {
  return /^[a-zA-Z0-9_]{3,32}$/.test(input.trim());
}

export default function SignInScreen() {
  const { isAuthenticated, isReady, isMutating, signIn, signUp, hasAccounts, needsProfileSetup } =
    useAuth();
  const colors = useColors();
  const [mode, setMode] = useState<Mode | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Until an account exists, signing up is the only thing that can succeed.
  const activeMode: Mode = mode ?? (hasAccounts ? "signIn" : "signUp");
  const isSignUp = activeMode === "signUp";

  const isInvalid = useMemo(() => {
    if (!isUsernameValid(username) || password.length < MIN_PASSWORD_LENGTH) {
      return true;
    }

    return isSignUp && confirmPassword !== password;
  }, [confirmPassword, isSignUp, password, username]);

  if (!isReady) {
    return null;
  }

  if (isAuthenticated) {
    return <Redirect href={needsProfileSetup ? "/(auth)/profile" : "/(tabs)"} />;
  }

  function switchMode(next: Mode) {
    setMode(next);
    setPassword("");
    setConfirmPassword("");
    setErrorMessage(null);
  }

  async function handleSubmit() {
    setErrorMessage(null);

    if (!isUsernameValid(username)) {
      setErrorMessage("Username must be 3–32 letters, numbers or underscores.");

      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);

      return;
    }

    if (isSignUp && confirmPassword !== password) {
      setErrorMessage("The two passwords do not match.");

      return;
    }

    try {
      if (isSignUp) {
        await signUp(username.trim(), password);
      } else {
        await signIn(username.trim(), password);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Something went wrong. Try again.",
      );
    }
  }

  return (
    <SafeAreaView
      style={{ backgroundColor: colors.surfaceApp, flex: 1 }}
      edges={["top", "bottom"]}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: layout.padPage,
        }}
      >
        <Card
          elevation={2}
          style={{ alignSelf: "center", gap: layout.gapLoose, maxWidth: 460, padding: layout.padSection, width: "100%" }}
        >
          <View style={{ gap: layout.gapTight }}>
            <Wordmark size={34} />
            <Text role="title3" tone="muted">
              {isSignUp ? "Create an account on this device." : "Sign in to continue."}
            </Text>
          </View>

          <View style={{ gap: layout.gapDefault }}>
            <Input
              label="Username"
              accessibilityLabel="Username"
              autoCapitalize="none"
              autoComplete="username"
              autoCorrect={false}
              leading={<Icon glyph={UserRound} size={16} color={colors.textMuted} />}
              onChangeText={(value) => {
                setUsername(value);
                setErrorMessage(null);
              }}
              placeholder="hassan_dev"
              value={username}
            />

            <Input
              label="Password"
              accessibilityLabel="Password"
              autoComplete={isSignUp ? "new-password" : "password"}
              leading={<Icon glyph={LockKeyhole} size={16} color={colors.textMuted} />}
              onChangeText={(value) => {
                setPassword(value);
                setErrorMessage(null);
              }}
              onSubmitEditing={isSignUp ? undefined : handleSubmit}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              secureTextEntry
              value={password}
            />

            {isSignUp ? (
              <Input
                label="Confirm password"
                accessibilityLabel="Confirm password"
                autoComplete="new-password"
                leading={<Icon glyph={LockKeyhole} size={16} color={colors.textMuted} />}
                onChangeText={(value) => {
                  setConfirmPassword(value);
                  setErrorMessage(null);
                }}
                onSubmitEditing={handleSubmit}
                placeholder="Repeat it"
                secureTextEntry
                value={confirmPassword}
              />
            ) : null}
          </View>

          {errorMessage ? (
            <Text accessibilityRole="alert" role="bodySm" tone="accent">
              {errorMessage}
            </Text>
          ) : null}

          <Button
            label={isSignUp ? "Create account" : "Sign in"}
            full
            size="lg"
            disabled={isInvalid}
            loading={isMutating}
            onPress={handleSubmit}
          />

          <Button
            label={isSignUp ? "I already have an account" : "Create a new account"}
            full
            size="md"
            variant="ghost"
            disabled={isMutating}
            onPress={() => switchMode(isSignUp ? "signIn" : "signUp")}
          />

          <Text role="caption" tone="muted">
            Accounts and their sessions live only on this device. There is no password recovery —
            keep a note of it somewhere safe.
          </Text>
        </Card>
      </View>
    </SafeAreaView>
  );
}
