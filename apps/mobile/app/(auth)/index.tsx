import { useMemo, useState } from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LockKeyhole, UserRound } from "lucide-react-native";
import { Wordmark } from "../../src/components/wordmark";
import { useAuth } from "../../src/providers/auth-provider";
import { translateError } from "@omam/i18n";
import {
  Button,
  Card,
  Icon,
  Input,
  Text,
  layout,
  useColors,
  useTranslation,
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
  const t = useTranslation();
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
      setErrorMessage(t("auth.usernameRule"));

      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(t("auth.passwordRule", { count: MIN_PASSWORD_LENGTH }));

      return;
    }

    if (isSignUp && confirmPassword !== password) {
      setErrorMessage(t("auth.passwordsDiffer"));

      return;
    }

    try {
      if (isSignUp) {
        await signUp(username.trim(), password);
      } else {
        await signIn(username.trim(), password);
      }
    } catch (error) {
      setErrorMessage(translateError(error, t));
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
              {isSignUp ? t("auth.createTitle") : t("auth.signInTitle")}
            </Text>
          </View>

          <View style={{ gap: layout.gapDefault }}>
            <Input
              label={t("auth.username")}
              accessibilityLabel={t("auth.username")}
              autoCapitalize="none"
              autoComplete="username"
              autoCorrect={false}
              leading={<Icon glyph={UserRound} size={16} color={colors.textMuted} />}
              onChangeText={(value) => {
                setUsername(value);
                setErrorMessage(null);
              }}
              placeholder={t("auth.usernamePlaceholder")}
              value={username}
            />

            <Input
              label={t("auth.password")}
              accessibilityLabel={t("auth.password")}
              autoComplete={isSignUp ? "new-password" : "password"}
              leading={<Icon glyph={LockKeyhole} size={16} color={colors.textMuted} />}
              onChangeText={(value) => {
                setPassword(value);
                setErrorMessage(null);
              }}
              onSubmitEditing={isSignUp ? undefined : handleSubmit}
              placeholder={t("auth.passwordPlaceholder", { count: MIN_PASSWORD_LENGTH })}
              secureTextEntry
              value={password}
            />

            {isSignUp ? (
              <Input
                label={t("auth.confirmPassword")}
                accessibilityLabel={t("auth.confirmPassword")}
                autoComplete="new-password"
                leading={<Icon glyph={LockKeyhole} size={16} color={colors.textMuted} />}
                onChangeText={(value) => {
                  setConfirmPassword(value);
                  setErrorMessage(null);
                }}
                onSubmitEditing={handleSubmit}
                placeholder={t("auth.repeatPlaceholder")}
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
            label={isSignUp ? t("auth.createAccount") : t("auth.signIn")}
            full
            size="lg"
            disabled={isInvalid}
            loading={isMutating}
            onPress={handleSubmit}
          />

          <Button
            label={isSignUp ? t("auth.haveAccount") : t("auth.createNew")}
            full
            size="md"
            variant="ghost"
            disabled={isMutating}
            onPress={() => switchMode(isSignUp ? "signIn" : "signUp")}
          />

          <Text role="caption" tone="muted">
            {t("auth.localOnly")}
          </Text>
        </Card>
      </View>
    </SafeAreaView>
  );
}
