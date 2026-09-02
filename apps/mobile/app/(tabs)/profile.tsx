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
import { persistPickedAvatar, supportsAvatarFiles } from "../../src/lib/avatar";
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
  useThemeMode,
  useToast,
  type SegmentOption,
  type ThemeMode,
} from "../../src/design/taraz";

const MIN_PASSWORD_LENGTH = 6;

type Currency = "IRR" | "USD";

const currencyOptions: SegmentOption<Currency>[] = [
  { value: "IRR", label: "IRR" },
  { value: "USD", label: "USD" },
];

const calendarOptions: SegmentOption<CalendarSystem>[] = [
  { value: "JALALI", label: "Shamsi" },
  { value: "GREGORIAN", label: "Gregorian" },
];

export default function ProfileScreen() {
  const { settings, saveSettings, isMutating: isSavingSettings } = useAttendance();
  const { user, completeProfile, changePassword, signOut, isMutating: isSavingProfile } = useAuth();
  const colors = useColors();
  const tabBarHeight = useTabBarHeight();
  const { mode, setMode } = useThemeMode();
  const { showToast } = useToast();

  const appearanceOptions = useMemo<SegmentOption<ThemeMode>[]>(
    () => [
      {
        value: "system",
        label: "System",
        icon: (active) => (
          <Icon glyph={Smartphone} size={16} color={active ? colors.textTitle : colors.textMuted} />
        ),
      },
      {
        value: "light",
        label: "Light",
        icon: (active) => (
          <Icon glyph={Sun} size={16} color={active ? colors.textTitle : colors.textMuted} />
        ),
      },
      {
        value: "dark",
        label: "Dark",
        icon: (active) => (
          <Icon glyph={Moon} size={16} color={active ? colors.textTitle : colors.textMuted} />
        ),
      },
    ],
    [colors.textMuted, colors.textTitle],
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
  const calendarPreview = useMemo(() => formatFullDate(new Date(), calendar), [calendar]);

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
        title: "Gallery access needed",
        description: "Enable photo access to choose an avatar.",
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
        title: "Image could not be read",
        description: "Choose a different photo.",
        tone: "error",
      });
    }
  }

  async function handleSaveProfile() {
    try {
      await completeProfile({ nickname: nickname.trim(), avatarUrl });
      showToast({ title: "Profile saved", tone: "success" });
    } catch (error) {
      showToast({
        title: "Profile could not be saved",
        description: error instanceof Error ? error.message : "Try again.",
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
      showToast({ title: "Password changed", tone: "success" });
    } catch (error) {
      showToast({
        title: "Password could not be changed",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    }
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
      showToast({ title: "Settings saved", tone: "success" });
    } catch (error) {
      const known = error instanceof Error && error.message !== "ATTENDANCE_SAVE_FAILED";

      showToast({
        title: "Settings could not be saved",
        description: known ? (error as Error).message : "Try again.",
        tone: "error",
      });
    }
  }

  return (
    <Screen scroll bottomInset={tabBarHeight} gap={layout.gapDefault}>
      <PageHeader title="Profile" overline={user?.username} />

      <Card style={{ gap: layout.gapLoose }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: layout.gapLoose }}>
          <Avatar uri={avatarUrl} name={nickname || user?.username} size={64} />

          <View style={{ flex: 1, gap: layout.gapTight }}>
            <Text role="title3" numberOfLines={1}>
              {nickname.trim() || "Your account"}
            </Text>
            <Button
              label="Upload photo"
              variant="quiet"
              size="sm"
              onPress={pickAvatar}
              icon={<Icon glyph={Camera} size={16} color={colors.textTitle} />}
            />
          </View>
        </View>

        <Input
          label="Nickname"
          autoCapitalize="words"
          value={nickname}
          onChangeText={setNickname}
          placeholder="Hassan"
          hint={isProfileIncomplete ? "At least two characters." : undefined}
        />

        <Button
          label="Save profile"
          full
          size="lg"
          loading={isSavingProfile}
          disabled={isProfileIncomplete}
          onPress={handleSaveProfile}
        />
      </Card>

      <Card style={{ gap: layout.gapTight }}>
        <Text role="title3">Calculation</Text>

        <View style={{ gap: layout.gapTight, paddingVertical: layout.padControlY }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: layout.gapDefault }}>
            <Icon glyph={CalendarDays} size={20} color={colors.textMuted} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text role="body" tone="title">
                Calendar
              </Text>
              <Text role="caption" tone="muted">
                {calendarPreview}
              </Text>
            </View>
          </View>

          <SegmentedControl options={calendarOptions} value={calendar} onChange={setCalendar} full />

          <Text role="caption" tone="muted">
            Months and weeks are grouped in this calendar. Recorded sessions are not changed.
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
            Currency
          </Text>
          <SegmentedControl options={currencyOptions} value={currency} onChange={setCurrency} />
        </View>

        <Divider inset={30} />

        <View style={{ flexDirection: "row", gap: layout.gapDefault, paddingVertical: layout.padControlY }}>
          <Icon glyph={Coins} size={20} color={colors.textMuted} />
          <Input
            label="Hourly rate"
            keyboardType="numeric"
            value={hourlyRate}
            onChangeText={setHourlyRate}
            placeholder="250000"
            trailing={
              <Text role="caption" tone="muted">
                {currency === "IRR" ? "Toman" : "USD"}
              </Text>
            }
            containerStyle={{ flex: 1 }}
          />
        </View>

        <Divider inset={30} />

        <View style={{ flexDirection: "row", gap: layout.gapDefault, paddingVertical: layout.padControlY }}>
          <Icon glyph={Target} size={20} color={colors.textMuted} />
          <Input
            label="Monthly goal"
            keyboardType="numeric"
            value={monthlyGoalHours}
            onChangeText={setMonthlyGoalHours}
            placeholder="160"
            trailing={
              <Text role="caption" tone="muted">
                hours
              </Text>
            }
            containerStyle={{ flex: 1 }}
          />
        </View>

        <Button
          label="Save settings"
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
          <Text role="title3">Appearance</Text>
          <Text role="caption" tone="muted">
            System follows your device setting.
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
        <Accordion title="Password" titleRole="title3">
          <View style={{ gap: layout.gapDefault, paddingBottom: layout.padCard }}>
            <Text role="caption" tone="muted">
              There is no recovery — a forgotten password cannot be reset.
            </Text>

            <Input
              label="Current password"
              autoComplete="password"
              leading={<Icon glyph={LockKeyhole} size={16} color={colors.textMuted} />}
              onChangeText={setCurrentPassword}
              placeholder="Current password"
              secureTextEntry
              value={currentPassword}
            />

            <Input
              label="New password"
              autoComplete="new-password"
              leading={<Icon glyph={LockKeyhole} size={16} color={colors.textMuted} />}
              onChangeText={setNextPassword}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              secureTextEntry
              value={nextPassword}
            />

            <Input
              label="Confirm new password"
              autoComplete="new-password"
              error={
                confirmPassword && passwordProblem === "mismatch"
                  ? "The two passwords do not match."
                  : undefined
              }
              leading={<Icon glyph={LockKeyhole} size={16} color={colors.textMuted} />}
              onChangeText={setConfirmPassword}
              placeholder="Repeat it"
              secureTextEntry
              value={confirmPassword}
            />

            {passwordProblem === "tooShort" ? (
              <Text role="caption" tone="accent">
                {`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`}
              </Text>
            ) : null}

            {passwordProblem === "unchanged" ? (
              <Text role="caption" tone="accent">
                Pick a password different from the current one.
              </Text>
            ) : null}

            <Button
              label="Change password"
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

      <Card style={{ gap: layout.gapDefault }}>
        <View style={{ gap: 1 }}>
          <Text role="title3">Account</Text>
          <Text role="caption" tone="muted">
            Each account keeps its own sessions and settings on this device.
          </Text>
        </View>

        <Button
          label="Switch account"
          full
          size="lg"
          variant="quiet"
          disabled={isSavingProfile}
          onPress={() => setSwitchingAccount(true)}
          icon={<Icon glyph={UserRoundCog} size={18} color={colors.textTitle} />}
        />

        <Button
          label="Sign out"
          full
          size="lg"
          variant="outline"
          loading={isSavingProfile}
          onPress={signOut}
        />
      </Card>

      <ConfirmDialog
        visible={switchingAccount}
        title="Switch account?"
        description="You will be signed out. Sign in with another account, or create a new one — this account's sessions stay on the device."
        confirmLabel="Sign out"
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
