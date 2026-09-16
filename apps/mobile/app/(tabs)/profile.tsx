import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  CalendarDays,
  Camera,
  Coins,
  LockKeyhole,
  Moon,
  Smartphone,
  Sun,
  Target,
  UserRoundCog,
  Wallet,
} from "lucide-react-native";
import { formatFullDate, type CalendarSystem } from "@omam/calendar";
import { LANGUAGES, LANGUAGE_LABEL, translateError, type Language } from "@omam/i18n";
import type { Currency } from "@omam/contracts";
import { persistPickedAvatar, supportsAvatarFiles } from "../../src/lib/avatar";
import { TeamSyncCard } from "../../src/components/team-sync-card";
import { useAttendance } from "../../src/providers/attendance-provider";
import { useAuth } from "../../src/providers/auth-provider";
import {
  Accordion,
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  Divider,
  Icon,
  Input,
  PageHeader,
  Screen,
  SegmentedControl,
  Text,
  layout,
  useColors,
  useTabBarHeight,
  useLanguage,
  useThemeMode,
  useToast,
  type SegmentOption,
  type ThemeMode,
} from "../../src/design/taraz";

const MIN_PASSWORD_LENGTH = 6;



const currencyOptions: SegmentOption<Currency>[] = [
  { value: "IRR", label: "IRR" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
];



export default function ProfileScreen() {
  const { settings, saveSettings, isMutating: isSavingSettings } = useAttendance();
  const { user, completeProfile, changePassword, signOut, isMutating: isSavingProfile } = useAuth();
  const colors = useColors();
  const tabBarHeight = useTabBarHeight();
  const { mode, setMode } = useThemeMode();
  const { showToast } = useToast();
  const { language, setLanguage, t } = useLanguage();

  const appearanceOptions = useMemo<SegmentOption<ThemeMode>[]>(
    () => [
      {
        value: "system",
        label: t("profile.themeSystem"),
        icon: (active) => (
          <Icon glyph={Smartphone} size={16} color={active ? colors.textTitle : colors.textMuted} />
        ),
      },
      {
        value: "light",
        label: t("profile.themeLight"),
        icon: (active) => (
          <Icon glyph={Sun} size={16} color={active ? colors.textTitle : colors.textMuted} />
        ),
      },
      {
        value: "dark",
        label: t("profile.themeDark"),
        icon: (active) => (
          <Icon glyph={Moon} size={16} color={active ? colors.textTitle : colors.textMuted} />
        ),
      },
    ],
    [colors.textMuted, colors.textTitle, t],
  );

  const calendarOptions = useMemo<SegmentOption<CalendarSystem>[]>(
    () => [
      { value: "JALALI", label: t("calendarName.JALALI") },
      { value: "GREGORIAN", label: t("calendarName.GREGORIAN") },
    ],
    [t],
  );

  const languageOptions = useMemo<SegmentOption<Language>[]>(
    () => LANGUAGES.map((value) => ({ value, label: LANGUAGE_LABEL[value] })),
    [],
  );

  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [hourlyRate, setHourlyRate] = useState(`${settings.hourlyRate}`);
  const [monthlyGoalHours, setMonthlyGoalHours] = useState(`${settings.monthlyGoalHours}`);
  const [currency, setCurrency] = useState<Currency>(settings.currency);
  const [calendar, setCalendar] = useState<CalendarSystem>(settings.calendar);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [switchingAccount, setSwitchingAccount] = useState(false);

  useEffect(() => {
    setNickname(user?.nickname ?? "");
    setAvatarUrl(user?.avatarUrl ?? null);
  }, [user?.avatarUrl, user?.nickname]);

  useEffect(() => {
    setHourlyRate(`${settings.hourlyRate}`);
    setMonthlyGoalHours(`${settings.monthlyGoalHours}`);
    setCurrency(settings.currency);
    setCalendar(settings.calendar);
  }, [settings.calendar, settings.currency, settings.hourlyRate, settings.monthlyGoalHours]);

  /** Today in the selected calendar, so the choice is legible before saving. */
  const calendarPreview = useMemo(
    () => formatFullDate(new Date(), calendar, language),
    [calendar, language],
  );

  const isProfileIncomplete = useMemo(() => nickname.trim().length < 2, [nickname]);

  const passwordProblem = useMemo(() => {
    if (!currentPassword || !nextPassword || !confirmPassword) return "incomplete";
    if (nextPassword.length < MIN_PASSWORD_LENGTH) return "tooShort";
    if (nextPassword !== confirmPassword) return "mismatch";
    if (nextPassword === currentPassword) return "unchanged";

    return null;
  }, [confirmPassword, currentPassword, nextPassword]);

  async function pickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      showToast({
        title: t("profile.galleryTitle"),
        description: t("profile.galleryDescription"),
        tone: "warning",
      });

      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      // Only the web build needs the bytes inline; native copies the file.
      base64: !supportsAvatarFiles,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];

    try {
      setAvatarUrl(persistPickedAvatar(asset));
    } catch {
      showToast({
        title: t("profile.imageFailed"),
        description: t("profile.imageDescription"),
        tone: "error",
      });
    }
  }

  async function handleSaveProfile() {
    try {
      await completeProfile({ nickname: nickname.trim(), avatarUrl });
      showToast({ title: t("profile.profileSaved"), tone: "success" });
    } catch (error) {
      showToast({
        title: t("profile.profileFailed"),
        description: translateError(error, t),
        tone: "error",
      });
    }
  }

  async function handleChangePassword() {
    if (passwordProblem) {
      return;
    }

    try {
      await changePassword(currentPassword, nextPassword);
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
      showToast({ title: t("profile.passwordChanged"), tone: "success" });
    } catch (error) {
      showToast({
        title: t("profile.passwordFailed"),
        description: error instanceof Error ? error.message : t("common.retry"),
        tone: "error",
      });
    }
  }

  /**
   * The switch applies immediately — waiting for a save would leave the button
   * that saves it in the language the reader just left.
   */
  function handleChangeLanguage(next: Language) {
    setLanguage(next);
    void saveSettings({ ...settings, language: next }).catch(() => {
      /* The device keeps the choice even if the row cannot be written. */
    });
  }

  async function handleSaveSettings() {
    try {
      await saveSettings({
        ...settings,
        hourlyRate: Number(hourlyRate) || 0,
        monthlyGoalHours: Number(monthlyGoalHours) || 0,
        currency,
        calendar,
      });
      showToast({ title: t("profile.settingsSaved"), tone: "success" });
    } catch (error) {
      const known = error instanceof Error && error.message !== "ATTENDANCE_SAVE_FAILED";

      showToast({
        title: t("profile.settingsFailed"),
        description: translateError(error, t),
        tone: "error",
      });
    }
  }

  return (
    <Screen scroll bottomInset={tabBarHeight} gap={layout.gapDefault}>
      <PageHeader title={t("profile.title")} overline={user?.username} />

      <Card style={{ gap: layout.gapLoose }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: layout.gapLoose }}>
          <Avatar uri={avatarUrl} name={nickname || user?.username} size={64} />

          <View style={{ flex: 1, gap: layout.gapTight }}>
            <Text role="title3" numberOfLines={1}>
              {nickname.trim() || t("profile.yourAccount")}
            </Text>
            <Button
              label={t("auth.uploadPhoto")}
              variant="quiet"
              size="sm"
              onPress={pickAvatar}
              icon={<Icon glyph={Camera} size={16} color={colors.textTitle} />}
            />
          </View>
        </View>

        <Input
          label={t("auth.nickname")}
          freeText
          autoCapitalize="words"
          value={nickname}
          onChangeText={setNickname}
          placeholder={t("auth.nicknamePlaceholder")}
          hint={isProfileIncomplete ? t("auth.nicknameRule") : undefined}
        />

        <Button
          label={t("auth.saveProfile")}
          full
          size="lg"
          loading={isSavingProfile}
          disabled={isProfileIncomplete}
          onPress={handleSaveProfile}
        />
      </Card>

      <Card style={{ gap: layout.gapDefault }}>
        <View style={{ gap: 1 }}>
          <Text role="title3">{t("language.label")}</Text>
          <Text role="caption" tone="muted">
            {t("language.hint")}
          </Text>
        </View>

        <SegmentedControl
          options={languageOptions}
          value={language}
          onChange={handleChangeLanguage}
          size="lg"
          full
        />
      </Card>

      <Card style={{ gap: layout.gapTight }}>
        <Text role="title3">{t("profile.calculation")}</Text>

        <View style={{ gap: layout.gapTight, paddingVertical: layout.padControlY }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: layout.gapDefault }}>
            <Icon glyph={CalendarDays} size={20} color={colors.textMuted} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text role="body" tone="title">
                {t("profile.calendar")}
              </Text>
              <Text role="caption" tone="muted">
                {calendarPreview}
              </Text>
            </View>
          </View>

          <SegmentedControl options={calendarOptions} value={calendar} onChange={setCalendar} full />

          <Text role="caption" tone="muted">
            {t("profile.calendarHint")}
          </Text>
        </View>

        <Divider inset={30} />

        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            gap: layout.gapDefault,
            paddingVertical: layout.padControlY,
          }}
        >
          <Icon glyph={Wallet} size={20} color={colors.textMuted} />
          <Text role="body" tone="title" style={{ flex: 1 }}>
            {t("profile.currency")}
          </Text>
          <SegmentedControl options={currencyOptions} value={currency} onChange={setCurrency} />
        </View>

        <Divider inset={30} />

        <View style={{ flexDirection: "row", gap: layout.gapDefault, paddingVertical: layout.padControlY }}>
          <Icon glyph={Coins} size={20} color={colors.textMuted} />
          <Input
            label={t("profile.hourlyRate")}
            keyboardType="numeric"
            value={hourlyRate}
            onChangeText={setHourlyRate}
            placeholder={t("profile.hourlyRatePlaceholder")}
            trailing={
              <Text role="caption" tone="muted">
                {currency === "IRR" ? t("units.toman") : currency}
              </Text>
            }
            containerStyle={{ flex: 1 }}
          />
        </View>

        <Divider inset={30} />

        <View style={{ flexDirection: "row", gap: layout.gapDefault, paddingVertical: layout.padControlY }}>
          <Icon glyph={Target} size={20} color={colors.textMuted} />
          <Input
            label={t("profile.monthlyGoal")}
            keyboardType="numeric"
            value={monthlyGoalHours}
            onChangeText={setMonthlyGoalHours}
            placeholder="160"
            trailing={
              <Text role="caption" tone="muted">
                {t("units.hoursSuffix")}
              </Text>
            }
            containerStyle={{ flex: 1 }}
          />
        </View>

        <Button
          label={t("profile.saveSettings")}
          full
          size="lg"
          variant="secondary"
          loading={isSavingSettings}
          onPress={handleSaveSettings}
          style={{ marginTop: layout.gapTight }}
        />
      </Card>

      <Card style={{ gap: layout.gapDefault }}>
        <View style={{ gap: 1 }}>
          <Text role="title3">{t("profile.appearance")}</Text>
          <Text role="caption" tone="muted">
            {t("profile.appearanceHint")}
          </Text>
        </View>

        <SegmentedControl
          options={appearanceOptions}
          value={mode}
          onChange={setMode}
          size="lg"
          full
        />
      </Card>

      <Card padded={false} style={{ paddingHorizontal: layout.padCard }}>
        <Accordion title={t("profile.password")} titleRole="title3">
          <View style={{ gap: layout.gapDefault, paddingBottom: layout.padCard }}>
            <Text role="caption" tone="muted">
              {t("profile.passwordHint")}
            </Text>

            <Input
              label={t("profile.currentPassword")}
              autoComplete="password"
              leading={<Icon glyph={LockKeyhole} size={16} color={colors.textMuted} />}
              onChangeText={setCurrentPassword}
              placeholder={t("profile.currentPassword")}
              secureTextEntry
              value={currentPassword}
            />

            <Input
              label={t("profile.newPassword")}
              autoComplete="new-password"
              leading={<Icon glyph={LockKeyhole} size={16} color={colors.textMuted} />}
              onChangeText={setNextPassword}
              placeholder={t("auth.passwordPlaceholder", { count: MIN_PASSWORD_LENGTH })}
              secureTextEntry
              value={nextPassword}
            />

            <Input
              label={t("profile.confirmNewPassword")}
              autoComplete="new-password"
              error={
                confirmPassword && passwordProblem === "mismatch"
                  ? t("auth.passwordsDiffer")
                  : undefined
              }
              leading={<Icon glyph={LockKeyhole} size={16} color={colors.textMuted} />}
              onChangeText={setConfirmPassword}
              placeholder={t("auth.repeatPlaceholder")}
              secureTextEntry
              value={confirmPassword}
            />

            {passwordProblem === "tooShort" ? (
              <Text role="caption" tone="accent">
                {t("profile.newPasswordRule", { count: MIN_PASSWORD_LENGTH })}
              </Text>
            ) : null}

            {passwordProblem === "unchanged" ? (
              <Text role="caption" tone="accent">
                {t("profile.samePassword")}
              </Text>
            ) : null}

            <Button
              label={t("profile.changePassword")}
              full
              size="lg"
              variant="secondary"
              disabled={Boolean(passwordProblem)}
              loading={isSavingProfile}
              onPress={handleChangePassword}
            />
          </View>
        </Accordion>
      </Card>

      <TeamSyncCard />

      <Card style={{ gap: layout.gapDefault }}>
        <View style={{ gap: 1 }}>
          <Text role="title3">{t("profile.account")}</Text>
          <Text role="caption" tone="muted">
            {t("profile.accountHint")}
          </Text>
        </View>

        <Button
          label={t("profile.switchAccount")}
          full
          size="lg"
          variant="quiet"
          disabled={isSavingProfile}
          onPress={() => setSwitchingAccount(true)}
          icon={<Icon glyph={UserRoundCog} size={18} color={colors.textTitle} />}
        />

        <Button
          label={t("profile.signOut")}
          full
          size="lg"
          variant="outline"
          loading={isSavingProfile}
          onPress={signOut}
        />
      </Card>

      <ConfirmDialog
        visible={switchingAccount}
        title={t("profile.switchTitle")}
        description={t("profile.switchDescription")}
        confirmLabel={t("profile.signOut")}
        loading={isSavingProfile}
        onConfirm={() => {
          setSwitchingAccount(false);
          void signOut();
        }}
        onCancel={() => setSwitchingAccount(false)}
      />

      <View style={{ height: layout.gapDefault }} />
    </Screen>
  );
}
