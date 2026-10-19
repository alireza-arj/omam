import { isDesktop } from "../../src/lib/desktop";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { passwordSchema, usernameSchema } from "@omam/contracts";
import { translateError } from "@omam/i18n";
import { Wordmark } from "../../src/components/wordmark";
import { useAuth } from "../../src/providers/auth-provider";
import {
  Button, Card, Input, InviteCodeInput, Text, SegmentedControl,
  layout, useColors, useTranslation,
} from "../../src/design/taraz";

type Mode = "signIn" | "signUp";

export default function SignInScreen() {
  const { isAuthenticated, isReady, isMutating, signIn, signUp, signInTeam } = useAuth();
  const colors = useColors();
  const t = useTranslation();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [accountMode, setAccountMode] = useState<"team" | "personal">(params.mode === "team" ? "team" : "personal");
  const [mode, setMode] = useState<Mode>("signIn");
  const [inviteCode, setInviteCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const isTeam = accountMode === "team";
  const isSignUp = mode === "signUp";
  const usernameValid = usernameSchema.safeParse(username).success;
  const passwordValid = passwordSchema.safeParse(password).success;
  const passwordsMatch = password === confirmPassword;
  const isInvalid = isTeam ? inviteCode.length !== 8 : !usernameValid || !passwordValid || (isSignUp && !passwordsMatch);

  if (!isReady) return null;
  if (isAuthenticated) return <Redirect href={isDesktop() ? "/desktop" : "/(tabs)"} />;

  async function handleSubmit() {
    if (isInvalid || isMutating) return;
    setErrorMessage(null);
    try {
      if (isTeam) await signInTeam(inviteCode);
      else if (isSignUp) await signUp(username.trim(), password);
      else await signIn(username.trim(), password);
    } catch (error) {
      setErrorMessage(translateError(error, t));
    }
  }

  return (
    <SafeAreaView style={{ backgroundColor: colors.surfaceApp, flex: 1 }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: layout.padPage, paddingVertical: layout.gapLoose }}
          keyboardShouldPersistTaps="handled"
        >
          <Card elevation={0} style={{ alignSelf: "center", gap: layout.gapLoose, maxWidth: layout.dialogMaxWidth, padding: layout.padSection, width: "100%" }}>
            <Wordmark />
            <SegmentedControl
              options={[{ value: "personal", label: t("workspace.personalLogin") }, { value: "team", label: t("workspace.teamLogin") }]}
              value={accountMode}
              disabled={isMutating}
              onChange={(next) => { setAccountMode(next); setMode("signIn"); setPassword(""); setConfirmPassword(""); setErrorMessage(null); }}
              full
            />
            <View style={{ gap: layout.gapTight }}>
              <Text role="title2">{isTeam ? t("workspace.teamLogin") : isSignUp ? t("auth.createTitle") : t("auth.signInTitle")}</Text>
              {isTeam ? <Text role="bodySm" tone="muted">{t("workspace.teamLoginHint")}</Text> : null}
            </View>
            {isTeam ? (
              <InviteCodeInput label={t("team.inviteCode")} value={inviteCode} onChange={(next) => { setInviteCode(next); setErrorMessage(null); }} disabled={isMutating} invalid={Boolean(errorMessage)} />
            ) : (
              <View style={{ gap: layout.gapDefault }}>
                <Input
                  label={t("auth.username")}
                  placeholder={t("auth.usernamePlaceholder")}
                  autoCapitalize="none"
                  autoComplete="username"
                  autoCorrect={false}
                  maxLength={32}
                  editable={!isMutating}
                  error={usernameTouched && username && !usernameValid ? t("auth.usernameRule") : undefined}
                  onBlur={() => setUsernameTouched(true)}
                  onChangeText={(next) => { setUsername(next); setErrorMessage(null); }}
                  value={username}
                />
                <Input
                  key={mode}
                  label={t("auth.password")}
                  placeholder={isSignUp ? t("auth.passwordPlaceholder", { count: 6 }) : t("auth.signInPasswordPlaceholder")}
                  autoComplete={isSignUp ? "new-password" : "password"}
                  autoCapitalize="none"
                  maxLength={72}
                  editable={!isMutating}
                  hint={isSignUp ? t("auth.passwordRule", { count: 6 }) : undefined}
                  onChangeText={(next) => { setPassword(next); setErrorMessage(null); }}
                  onSubmitEditing={handleSubmit}
                  secureTextEntry
                  value={password}
                />
                {isSignUp ? <Input
                  label={t("auth.confirmPassword")}
                  placeholder={t("auth.repeatPlaceholder")}
                  autoComplete="new-password"
                  autoCapitalize="none"
                  maxLength={72}
                  editable={!isMutating}
                  error={confirmPassword && !passwordsMatch ? t("auth.passwordsDiffer") : undefined}
                  onChangeText={(next) => { setConfirmPassword(next); setErrorMessage(null); }}
                  onSubmitEditing={handleSubmit}
                  secureTextEntry
                  value={confirmPassword}
                /> : null}
              </View>
            )}
            {errorMessage ? <Text accessibilityRole="alert" role="bodySm" tone="warning">{errorMessage}</Text> : null}
            <View style={{ gap: layout.gapTight }}>
              <Button label={isTeam || !isSignUp ? t("auth.signIn") : t("auth.createAccount")} full size="lg" disabled={isInvalid} loading={isMutating} onPress={handleSubmit} />
              {!isTeam ? <Button
                label={isSignUp ? t("auth.haveAccount") : t("auth.createNew")}
                full variant="ghost" disabled={isMutating}
                onPress={() => { setMode(isSignUp ? "signIn" : "signUp"); setPassword(""); setConfirmPassword(""); setErrorMessage(null); setUsernameTouched(false); }}
              /> : null}
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
