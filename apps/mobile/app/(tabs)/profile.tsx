import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  CalendarDays,
  Camera,
  Coins,
  Languages,
  LockKeyhole,
  Moon,
  Palette,
  Smartphone,
  Sun,
  UserRoundCog,
  Wallet,
} from "lucide-react-native";
import { formatFullDate, type CalendarSystem } from "@omam/calendar";
import { LANGUAGES, LANGUAGE_LABEL, translateError, type Language } from "@omam/i18n";
import type { Currency } from "@omam/contracts";
import { persistPickedAvatar, supportsAvatarFiles } from "../../src/lib/avatar";
import { TeamSyncCard } from "../../src/components/team-sync-card";
import { WebNotificationCard } from "../../src/components/web-notification-card";
import { useAttendance } from "../../src/providers/attendance-provider";
import { useAuth } from "../../src/providers/auth-provider";
import {
  Accordion,
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  Icon,
  IconButton,
  IconTile,
  Input,
  PageHeader,
  Screen,
  SegmentedControl,
  Notice,
  SectionHeader,
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
          <Icon glyph={Smartphone} size={layout.iconSm} color={active ? colors.textTitle : colors.textMuted} />
        ),
      },
      {
        value: "light",
        label: t("profile.themeLight"),
        icon: (active) => (
          <Icon glyph={Sun} size={layout.iconSm} color={active ? colors.textTitle : colors.textMuted} />
        ),
      },
      {
        value: "dark",
        label: t("profile.themeDark"),
        icon: (active) => (
          <Icon glyph={Moon} size={layout.iconSm} color={active ? colors.textTitle : colors.textMuted} />
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
      showToast({
        title: t("profile.settingsFailed"),
        description: translateError(error, t),
        tone: "error",
      });
    }
  }

  return (
    <Screen scroll bottomInset={tabBarHeight} gap={layout.gapDefault}>
      <PageHeader title={t("profile.title")} />

      <Card style={{ gap: layout.gapLoose }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: layout.gapDefault + 4 }}>
          <Avatar uri={avatarUrl} name={nickname || user?.username} size={layout.avatarLg} />

          <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
            <Text role="title3" numberOfLines={1}>
              {nickname.trim() || t("profile.yourAccount")}
            </Text>
            <Text role="mono" tone="muted" numberOfLines={1}>
              @{user?.username}
            </Text>
          </View>

          <IconButton label={t("auth.uploadPhoto")} variant="quiet" round onPress={pickAvatar}>
            <Icon glyph={Camera} size={layout.iconMd} color={colors.textTitle} />
          </IconButton>
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
          variant="secondary"
          loading={isSavingProfile}
          disabled={isProfileIncomplete}
          onPress={handleSaveProfile}
        />
      </Card>

      <Card style={{ gap: layout.gapLoose }}>
        <SectionHeader glyph={Wallet} title={t("profile.calculation")} />

        <View style={{ gap: layout.gapTight }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: layout.gapTight }}>
            <Icon glyph={CalendarDays} size={layout.iconSm} color={colors.textMuted} />
            <Text role="label" tone="body" style={{ flex: 1 }}>
              {t("profile.calendar")}
            </Text>
          </View>
          <SegmentedControl options={calendarOptions} value={calendar} onChange={setCalendar} full />
          <Text role="caption" tone="muted">
            {joinCaption(calendarPreview, t("profile.calendarHint"))}
          </Text>
        </View>

        <View style={{ gap: layout.gapTight }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: layout.gapTight }}>
            <Icon glyph={Coins} size={layout.iconSm} color={colors.textMuted} />
            <Text role="label" tone="body" style={{ flex: 1 }}>
              {t("profile.currency")}
            </Text>
          </View>
          <SegmentedControl options={currencyOptions} value={currency} onChange={setCurrency} full />
        </View>

        <View style={{ flexDirection: "row", gap: layout.gapDefault }}>
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
          loading={isSavingSettings}
          onPress={handleSaveSettings}
        />
      </Card>

      <Card style={{ gap: layout.gapDefault }}>
        <SectionHeader glyph={Languages} title={t("language.label")} description={t("language.hint")} />
        <SegmentedControl options={languageOptions} value={language} onChange={handleChangeLanguage} full />
      </Card>

      <Card style={{ gap: layout.gapDefault }}>
        <SectionHeader glyph={Palette} title={t("profile.appearance")} description={t("profile.appearanceHint")} />
        <SegmentedControl options={appearanceOptions} value={mode} onChange={setMode} full />
      </Card>

      <WebNotificationCard />

      <Card padded={false} style={{ paddingHorizontal: layout.padCard, paddingVertical: layout.gapTight }}>
        <Accordion
          title={t("profile.password")}
          titleRole="title3"
          leading={<IconTile glyph={LockKeyhole} />}
        >
          <View style={{ gap: layout.gapDefault, paddingBottom: layout.padCard }}>
            <Notice tone="warning" title={t("profile.passwordHint")} />

            <Input
              label={t("profile.currentPassword")}
              autoComplete="password"
              onChangeText={setCurrentPassword}
              placeholder={t("profile.currentPassword")}
              secureTextEntry
              value={currentPassword}
            />

            <Input
              label={t("profile.newPassword")}
              autoComplete="new-password"
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
        <SectionHeader glyph={UserRoundCog} title={t("profile.account")} description={t("profile.accountHint")} />

        <Button
          label={t("profile.switchAccount")}
          full
          size="lg"
          variant="quiet"
          disabled={isSavingProfile}
          onPress={() => setSwitchingAccount(true)}
        />

        <Button
          label={t("profile.signOut")}
          full
          size="lg"
          variant="dangerSoft"
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

function joinCaption(...parts: string[]) {
  return parts.filter(Boolean).join(" — ");
}
