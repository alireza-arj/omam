import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Camera, CheckCircle2, Clock3, LogOut, Target, UserRound, Wallet } from "lucide-react-native";
import { useAttendance } from "../../src/providers/attendance-provider";
import { useAuth } from "../../src/providers/auth-provider";

type SegmentedToggleProps<T extends string> = {
  compact?: boolean;
  leftLabel: string;
  rightLabel: string;
  leftValue: T;
  rightValue: T;
  value: T;
  onChange: (next: T) => void;
};

function SegmentedToggle<T extends string>({
  compact = false,
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
    <View className={`${compact ? "h-10 w-[144px]" : "h-11 w-[170px]"} flex-row rounded-full border border-[#d6ccb8] bg-[#f9f4e8] p-1`}>
      <Pressable
        onPress={() => onChange(leftValue)}
        className={`flex-1 items-center justify-center rounded-full ${isLeftActive ? "bg-[#89cfb1]" : "bg-transparent"}`}
      >
        <Text className={`${compact ? "text-sm" : "text-base"} ${isLeftActive ? "text-[#1c4b3c]" : "text-[#5f5c53]"}`}>{leftLabel}</Text>
      </Pressable>

      <Pressable
        onPress={() => onChange(rightValue)}
        className={`flex-1 items-center justify-center rounded-full ${isRightActive ? "bg-[#89cfb1]" : "bg-transparent"}`}
      >
        <Text className={`${compact ? "text-sm" : "text-base"} ${isRightActive ? "text-[#1c4b3c]" : "text-[#5f5c53]"}`}>{rightLabel}</Text>
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
  const { height } = useWindowDimensions();
  const isShortScreen = height < 760;
  const controlWidthClassName = isShortScreen ? "w-[136px]" : "w-[156px]";

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
      Alert.alert("Permission required", "Enable gallery access to pick an avatar.");
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
      Alert.alert("Image selection failed", "Please choose a different image.");
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
      const message = error instanceof Error ? error.message : "An unknown error occurred while signing in.";
      Alert.alert("Sign in failed", message);
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
            ? "An unknown error occurred while saving settings."
            : error.message
          : "An unknown error occurred while saving settings.";
      Alert.alert("Saving settings failed", message);
    }
  }

  async function handleLogout() {
    await signOut();
  }

  return (
    <SafeAreaView className="flex-1 bg-[#eef3ec]" edges={["top"]}>
      <View
        className="flex-1 px-5 pb-[112px] pt-2"
        style={{
          gap: isShortScreen ? 8 : 10,
        }}
      >
        <View className={`rounded-[24px] border border-[#d0dccf] bg-[#f8fbf7] ${isShortScreen ? "p-3" : "p-4"}`}>
          <View className={`${isShortScreen ? "mb-1.5" : "mb-3"} flex-row items-center gap-3`}>
            <View className={`${isShortScreen ? "h-10 w-10" : "h-11 w-11"} items-center justify-center rounded-2xl bg-[#deece2]`}>
              <UserRound size={20} color="#2f6e5b" />
            </View>
            <View>
              <Text className="text-xl text-[#16352d]">Account</Text>
              <Text className="text-sm text-[#5f7268]">{user?.username}</Text>
            </View>
          </View>

          <View className={`${isShortScreen ? "mb-2" : "mb-3"} flex-row items-center gap-3`}>
            <View className={`${isShortScreen ? "h-[58px] w-[58px]" : "h-[68px] w-[68px]"} items-center justify-center overflow-hidden rounded-full border border-[#cfe0d4] bg-[#e3efe7]`}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} className={isShortScreen ? "h-[58px] w-[58px]" : "h-[68px] w-[68px]"} resizeMode="cover" />
              ) : (
                <UserRound size={isShortScreen ? 26 : 30} color="#7d978b" />
              )}
            </View>
            <View className="flex-1 gap-2">
              <Pressable onPress={pickAvatar} className={`flex-row items-center justify-center gap-2 rounded-full border border-[#c9d9cf] bg-white px-4 ${isShortScreen ? "py-2" : "py-2.5"}`}>
                <Camera size={14} color="#245748" />
                <Text className="text-sm text-[#245748]">Upload photo</Text>
              </Pressable>
              <TextInput
                autoCapitalize="words"
                value={nickname}
                onChangeText={setNickname}
                placeholder="e.g. Hassan"
                placeholderTextColor="#8b9598"
                className={`rounded-xl border border-[#d7e4db] bg-white px-4 ${isShortScreen ? "py-2" : "py-2.5"} text-base text-[#163034]`}
              />
            </View>
          </View>

          <Pressable
            onPress={handleSaveProfile}
            disabled={isProfileDisabled}
            className={`rounded-full px-5 ${isShortScreen ? "py-3" : "py-3.5"} ${isProfileDisabled ? "bg-[#9fbab0]" : "bg-[#1e6f4d]"}`}
          >
            <Text className="text-center text-base text-[#f7fbf7]">
              {isAuthMutating ? "Saving..." : "Save profile"}
            </Text>
          </Pressable>
        </View>

        <View className={`rounded-[24px] border border-[#d9cfbb] bg-[#fbf6ea] ${isShortScreen ? "p-3" : "p-4"}`}>
          <View className="mb-1 flex-row items-center gap-2">
            <Target size={20} color="#2f6e5b" />
            <Text className="text-lg text-[#24453c]">Calculation settings</Text>
          </View>

          <View className={`flex-row items-center justify-between ${isShortScreen ? "py-2" : "py-3"}`}>
            <View className="min-w-0 flex-1 flex-row items-center gap-2">
              <Wallet size={20} color="#2f6e5b" />
              <Text className="flex-1 text-base text-[#24453c]" numberOfLines={1}>Currency</Text>
            </View>
            <SegmentedToggle
              compact={isShortScreen}
              leftLabel="IRR"
              rightLabel="USD"
              leftValue="IRR"
              rightValue="USD"
              value={currency}
              onChange={setCurrency}
            />
          </View>

          <SectionDivider />

          <View className={`flex-row items-center justify-between ${isShortScreen ? "py-2" : "py-3"}`}>
            <View className="min-w-0 flex-1 flex-row items-center gap-2">
              <Clock3 size={19} color="#2f6e5b" />
              <Text className="flex-1 text-base text-[#24453c]" numberOfLines={1}>Hourly rate</Text>
            </View>

            <View className={`${controlWidthClassName} flex-row items-center rounded-xl border border-[#d9cfbb] bg-[#fffaf0] px-3 ${isShortScreen ? "py-1.5" : "py-2"}`}>
              <TextInput
                keyboardType="numeric"
                value={hourlyRate}
                onChangeText={setHourlyRate}
                className={`${isShortScreen ? "text-base" : "text-[17px]"} flex-1 text-[#1d3f35]`}
                placeholder="e.g. 250000"
                placeholderTextColor="#98a99e"
              />
              <Text className="text-sm text-[#7c7567]">{currency === "IRR" ? "Toman" : "USD"}</Text>
            </View>
          </View>

          <SectionDivider />

          <View className={`flex-row items-center justify-between ${isShortScreen ? "py-2" : "py-3"}`}>
            <View className="min-w-0 flex-1 flex-row items-center gap-2">
              <Target size={19} color="#d69090" />
              <Text className="flex-1 text-base text-[#24453c]" numberOfLines={1}>Monthly goal hours</Text>
            </View>

            <View className={`${controlWidthClassName} flex-row items-center rounded-xl border border-[#d9cfbb] bg-[#fffaf0] px-3 ${isShortScreen ? "py-1.5" : "py-2"}`}>
              <TextInput
                keyboardType="numeric"
                value={monthlyGoalHours}
                onChangeText={setMonthlyGoalHours}
                className={`${isShortScreen ? "text-base" : "text-[17px]"} flex-1 text-[#1d3f35]`}
                placeholder="e.g. 160"
                placeholderTextColor="#98a99e"
              />
              <Text className="text-sm text-[#7c7567]">hr</Text>
            </View>
          </View>

          <Pressable
            onPress={handleSaveSettings}
            disabled={isAttendanceMutating}
            className={`mt-2 flex-row items-center justify-center rounded-full border border-[#89cfb1] bg-[#93ddbe] px-5 ${isShortScreen ? "py-3" : "py-3.5"}`}
          >
            <CheckCircle2 size={19} color="#245748" />
            <Text className="mx-2 text-base text-[#10392d]">
              {isAttendanceMutating ? "Saving..." : "Save settings"}
            </Text>
          </Pressable>
        </View>

        <View className={`rounded-2xl border border-[#e0c9c1] bg-[#fff3f0] ${isShortScreen ? "p-3" : "p-4"}`}>
          <Pressable onPress={handleLogout} disabled={isAuthMutating} className={`rounded-xl bg-[#f2d5ce] px-5 ${isShortScreen ? "py-3" : "py-3.5"}`}>
            <View className="flex-row items-center justify-center gap-2">
              <LogOut size={16} color="#6e3328" />
              <Text className="text-center text-base text-[#6e3328]">
                {isAuthMutating ? "Signing out..." : "Sign out"}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
