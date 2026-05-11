import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Camera, CheckCircle2, Clock3, Globe2, LogOut, Target, UserRound, Wallet } from "lucide-react-native";
import { useAttendance } from "../../src/providers/attendance-provider";
import { useAuth } from "../../src/providers/auth-provider";
import { useLanguage } from "../../src/providers/language-provider";

type SegmentedToggleProps<T extends string> = {
  leftLabel: string;
  rightLabel: string;
  leftValue: T;
  rightValue: T;
  value: T;
  onChange: (next: T) => void;
};

function SegmentedToggle<T extends string>({
  leftLabel,
  rightLabel,
  leftValue,
  rightValue,
  value,
  onChange,
}: SegmentedToggleProps<T>) {
  const isLeftActive = value === leftValue;
  const isRightActive = value === rightValue;

  return (
    <View className="h-11 w-[170px] flex-row rounded-full border border-[#d6ccb8] bg-[#f9f4e8] p-1">
      <Pressable
        onPress={() => onChange(leftValue)}
        className={`flex-1 items-center justify-center rounded-full ${isLeftActive ? "bg-[#89cfb1]" : "bg-transparent"}`}
      >
        <Text className={`text-base ${isLeftActive ? "text-[#1c4b3c]" : "text-[#5f5c53]"}`}>{leftLabel}</Text>
      </Pressable>

      <Pressable
        onPress={() => onChange(rightValue)}
        className={`flex-1 items-center justify-center rounded-full ${isRightActive ? "bg-[#89cfb1]" : "bg-transparent"}`}
      >
        <Text className={`text-base ${isRightActive ? "text-[#1c4b3c]" : "text-[#5f5c53]"}`}>{rightLabel}</Text>
      </Pressable>
    </View>
  );
}

function SectionDivider() {
  return <View className="h-px bg-[#e3d8c6]" />;
}

export default function ProfileScreen() {
  const { settings, saveSettings, isMutating: isAttendanceMutating } = useAttendance();
  const { user, completeProfile, signOut, isMutating: isAuthMutating } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [hourlyRate, setHourlyRate] = useState(`${settings.hourlyRate}`);
  const [monthlyGoalHours, setMonthlyGoalHours] = useState(`${settings.monthlyGoalHours}`);
  const [currency, setCurrency] = useState<"IRR" | "USD">(settings.currency);

  useEffect(() => {
    setNickname(user?.nickname ?? "");
    setAvatarUrl(user?.avatarUrl ?? null);
  }, [user?.avatarUrl, user?.nickname]);

  useEffect(() => {
    setHourlyRate(`${settings.hourlyRate}`);
    setMonthlyGoalHours(`${settings.monthlyGoalHours}`);
    setCurrency(settings.currency);
  }, [settings.currency, settings.hourlyRate, settings.monthlyGoalHours]);

  const isProfileDisabled = useMemo(() => {
    return isAuthMutating || nickname.trim().length < 2;
  }, [isAuthMutating, nickname]);

  async function pickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(t("auth.profilePermissionTitle"), t("auth.profilePermissionHint"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];

    if (!asset?.base64) {
      Alert.alert(t("auth.profileImageErrorTitle"), t("auth.profileImageErrorHint"));
      return;
    }

    const mimeType = asset.mimeType?.startsWith("image/") ? asset.mimeType : "image/jpeg";
    setAvatarUrl(`data:${mimeType};base64,${asset.base64}`);
  }

  async function handleSaveProfile() {
    try {
      await completeProfile({
        nickname: nickname.trim(),
        avatarUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t("auth.errorFallback");
      Alert.alert(t("auth.errorTitle"), message);
    }
  }

  async function handleSaveSettings() {
    try {
      await saveSettings({
        ...settings,
        hourlyRate: Number(hourlyRate) || 0,
        monthlyGoalHours: Number(monthlyGoalHours) || 0,
        currency,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message === "ATTENDANCE_SAVE_FAILED"
            ? t("report.saveFailedFallback")
            : error.message
          : t("report.saveFailedFallback");
      Alert.alert(t("report.saveFailedTitle"), message);
    }
  }

  async function handleLogout() {
    await signOut();
  }

  return (
    <SafeAreaView className="flex-1 bg-[#eef3ec]" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 122,
          paddingTop: 10,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="rounded-[26px] border border-[#d0dccf] bg-[#f8fbf7] p-4">
          <View className="mb-4 flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#deece2]">
              <UserRound size={20} color="#2f6e5b" />
            </View>
            <View>
              <Text className="text-xl text-[#16352d]">{t("auth.account")}</Text>
              <Text className="text-sm text-[#5f7268]">{user?.username}</Text>
            </View>
          </View>

          <View className="mb-4 items-center">
            <View className="h-[94px] w-[94px] items-center justify-center overflow-hidden rounded-full border border-[#cfe0d4] bg-[#e3efe7]">
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} className="h-[94px] w-[94px]" resizeMode="cover" />
              ) : (
                <Text className="text-3xl">👤</Text>
              )}
            </View>
            <Pressable onPress={pickAvatar} className="mt-3 flex-row items-center gap-2 rounded-full border border-[#c9d9cf] bg-white px-4 py-2.5">
              <Camera size={14} color="#245748" />
              <Text className="text-sm text-[#245748]">{t("auth.profileUploadAvatar")}</Text>
            </Pressable>
          </View>

          <View className="gap-2">
            <Text className="text-sm text-[#5b6d70]">{t("auth.nickname")}</Text>
            <TextInput
              autoCapitalize="words"
              value={nickname}
              onChangeText={setNickname}
              placeholder={t("auth.nicknamePlaceholder")}
              placeholderTextColor="#8b9598"
              className="rounded-xl border border-[#d7e4db] bg-white px-4 py-3 text-base text-[#163034]"
            />
          </View>

          <Pressable
            onPress={handleSaveProfile}
            disabled={isProfileDisabled}
            className={`mt-4 rounded-full px-5 py-3.5 ${isProfileDisabled ? "bg-[#9fbab0]" : "bg-[#1e6f4d]"}`}
          >
            <Text className="text-center text-base text-[#f7fbf7]">
              {isAuthMutating ? t("common.saving") : t("auth.profileSave")}
            </Text>
          </Pressable>
        </View>

        <View className="rounded-[26px] border border-[#d9cfbb] bg-[#fbf6ea] p-4">
          <View className="mb-2 flex-row items-center gap-2">
            <Target size={20} color="#2f6e5b" />
            <Text className="text-lg text-[#24453c]">{t("report.calculationSettings")}</Text>
          </View>

          <View className="flex-row items-center justify-between py-2">
            <View className="flex-row items-center gap-2">
              <Globe2 size={20} color="#2f6e5b" />
              <Text className="text-base text-[#24453c]">{t("report.languageTitle")}</Text>
            </View>
            <SegmentedToggle
              leftLabel="FA"
              rightLabel="EN"
              leftValue="fa"
              rightValue="en"
              value={language}
              onChange={setLanguage}
            />
          </View>

          <SectionDivider />

          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center gap-2">
              <Wallet size={20} color="#2f6e5b" />
              <Text className="text-base text-[#24453c]">{t("report.currencyTitle")}</Text>
            </View>
            <SegmentedToggle
              leftLabel="IRR"
              rightLabel="USD"
              leftValue="IRR"
              rightValue="USD"
              value={currency}
              onChange={setCurrency}
            />
          </View>

          <SectionDivider />

          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center gap-2">
              <Clock3 size={19} color="#2f6e5b" />
              <Text className="text-base text-[#24453c]">{t("report.hourlyRate")}</Text>
            </View>

            <View className="w-[156px] flex-row items-center rounded-xl border border-[#d9cfbb] bg-[#fffaf0] px-3 py-2">
              <TextInput
                keyboardType="numeric"
                value={hourlyRate}
                onChangeText={setHourlyRate}
                className="flex-1 text-[17px] text-[#1d3f35]"
                placeholder={t("report.hourlyRatePlaceholder")}
                placeholderTextColor="#98a99e"
              />
              <Text className="text-sm text-[#7c7567]">{currency === "IRR" ? t("format.toman") : "USD"}</Text>
            </View>
          </View>

          <SectionDivider />

          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center gap-2">
              <Target size={19} color="#d69090" />
              <Text className="text-base text-[#24453c]">{t("report.monthlyGoalHours")}</Text>
            </View>

            <View className="w-[156px] flex-row items-center rounded-xl border border-[#d9cfbb] bg-[#fffaf0] px-3 py-2">
              <TextInput
                keyboardType="numeric"
                value={monthlyGoalHours}
                onChangeText={setMonthlyGoalHours}
                className="flex-1 text-[17px] text-[#1d3f35]"
                placeholder={t("report.monthlyGoalHoursPlaceholder")}
                placeholderTextColor="#98a99e"
              />
              <Text className="text-sm text-[#7c7567]">{t("format.hour")}</Text>
            </View>
          </View>

          <Pressable
            onPress={handleSaveSettings}
            disabled={isAttendanceMutating}
            className="mt-2 flex-row items-center justify-center rounded-full border border-[#89cfb1] bg-[#93ddbe] px-5 py-3.5"
          >
            <CheckCircle2 size={19} color="#245748" />
            <Text className="mx-2 text-base text-[#10392d]">
              {isAttendanceMutating ? t("common.saving") : t("report.saveSettings")}
            </Text>
          </Pressable>
        </View>

        <View className="rounded-2xl border border-[#e0c9c1] bg-[#fff3f0] p-4">
          <Pressable onPress={handleLogout} disabled={isAuthMutating} className="rounded-xl bg-[#f2d5ce] px-5 py-3.5">
            <View className="flex-row items-center justify-center gap-2">
              <LogOut size={16} color="#6e3328" />
              <Text className="text-center text-base text-[#6e3328]">
                {isAuthMutating ? t("auth.loggingOut") : t("auth.logout")}
              </Text>
            </View>
          </Pressable>
        </View>

        <View className="h-12" />
      </ScrollView>
    </SafeAreaView>
  );
}
