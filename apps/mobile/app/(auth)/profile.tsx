import { useMemo, useState } from "react";
import { Alert, Image, Pressable, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/providers/auth-provider";
import { useLanguage } from "../../src/providers/language-provider";

export default function ProfileSetupScreen() {
  const { isReady, isAuthenticated, needsProfileSetup, completeProfile, isMutating, user } = useAuth();
  const { t } = useLanguage();
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);

  const isDisabled = useMemo(() => {
    return isMutating || nickname.trim().length < 2;
  }, [isMutating, nickname]);

  if (!isReady) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)" />;
  }

  if (!needsProfileSetup) {
    return <Redirect href="/(tabs)" />;
  }

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

  async function handleSave() {
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

  return (
    <SafeAreaView className="flex-1 bg-[#eaf4ed]" edges={["top", "bottom"]}>
      <View className="flex-1 items-center justify-center bg-[#eaf4ed] px-6 pb-8 pt-6">
        <View className="absolute left-[-120px] top-[-80px] h-[230px] w-[230px] rounded-full bg-[#1f7d56]/10" />
        <View className="absolute right-[-90px] top-[150px] h-[190px] w-[190px] rounded-full bg-[#c9ad64]/14" />

        <View className="w-full max-w-[460px] rounded-[34px] border border-[#d5e5da] bg-[#f8fdf9] px-5 py-6">
          <Text className="text-sm text-[#5e6e72]">{t("auth.profileTitle")}</Text>
          <Text className="mt-2 text-[32px] leading-[38px] text-[#0f2225]">{t("auth.profileSubtitle")}</Text>
          <Text className="mt-2 text-sm leading-6 text-[#5b6d70]">{t("auth.profileHint")}</Text>

          <View className="mt-5 items-center">
            <View className="h-[92px] w-[92px] items-center justify-center overflow-hidden rounded-full border border-[#cfe0d4] bg-[#e3efe7]">
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} className="h-[92px] w-[92px]" resizeMode="cover" />
              ) : (
                <Text className="text-3xl">👤</Text>
              )}
            </View>

            <Pressable onPress={pickAvatar} className="mt-3 rounded-full border border-[#c9d9cf] bg-white px-4 py-2.5">
              <Text className="text-sm text-[#245748]">{t("auth.profileUploadAvatar")}</Text>
            </Pressable>
          </View>

          <View className="mt-5 gap-2">
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
            onPress={handleSave}
            disabled={isDisabled}
            className={`mt-5 rounded-full px-5 py-4 ${isDisabled ? "bg-[#9fbab0]" : "bg-[#1e6f4d]"}`}
          >
            <Text className="text-center text-base text-[#f7fbf7]">
              {isMutating ? t("common.saving") : t("auth.profileSave")}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
