import { useMemo, useState } from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Camera } from "lucide-react-native";
import { translateError } from "@omam/i18n";
import { persistPickedAvatar, supportsAvatarFiles } from "../../src/lib/avatar";
import { useAuth } from "../../src/providers/auth-provider";
import {
  Avatar,
  Button,
  Card,
  Icon,
  Input,
  Text,
  layout,
  useColors,
  useToast,
  useTranslation,
} from "../../src/design/taraz";

export default function ProfileSetupScreen() {
  const { isReady, isAuthenticated, needsProfileSetup, completeProfile, isMutating, user } =
    useAuth();
  const colors = useColors();
  const { showToast } = useToast();
  const t = useTranslation();
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);

  const isIncomplete = useMemo(() => nickname.trim().length < 2, [nickname]);

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

  async function handleSave() {
    try {
      await completeProfile({ nickname: nickname.trim(), avatarUrl });
    } catch (error) {
      showToast({
        title: t("profile.profileFailed"),
        description: translateError(error, t),
        tone: "error",
      });
    }
  }

  return (
    <SafeAreaView
      style={{ backgroundColor: colors.surfaceApp, flex: 1 }}
      edges={["top", "bottom"]}
    >
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: layout.padPage }}>
        <Card
          elevation={2}
          style={{
            alignSelf: "center",
            gap: layout.gapLoose,
            maxWidth: 460,
            padding: layout.padSection,
            width: "100%",
          }}
        >
          <View style={{ gap: 2 }}>
            <Text role="overline" tone="muted">
              {t("auth.setupOverline")}
            </Text>
            <Text role="title1">{t("auth.setupTitle")}</Text>
            <Text role="bodySm" tone="muted">
              {t("auth.setupSubtitle")}
            </Text>
          </View>

          <View style={{ alignItems: "center", gap: layout.gapDefault }}>
            <Avatar uri={avatarUrl} name={nickname || user?.username} size={88} />
            <Button
              label={t("auth.uploadPhoto")}
              variant="quiet"
              size="sm"
              onPress={pickAvatar}
              icon={<Icon glyph={Camera} size={16} color={colors.textTitle} />}
              style={{ alignSelf: "center" }}
            />
          </View>

          <Input
            label={t("auth.nickname")}
            freeText
            autoCapitalize="words"
            value={nickname}
            onChangeText={setNickname}
            placeholder={t("auth.nicknamePlaceholder")}
            hint={isIncomplete ? t("auth.nicknameRule") : undefined}
          />

          <Button
            label={t("auth.saveProfile")}
            full
            size="lg"
            disabled={isIncomplete}
            loading={isMutating}
            onPress={handleSave}
          />
        </Card>
      </View>
    </SafeAreaView>
  );
}
