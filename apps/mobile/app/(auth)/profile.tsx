import { useMemo, useState } from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Camera } from "lucide-react-native";
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
} from "../../src/design/taraz";

export default function ProfileSetupScreen() {
  const { isReady, isAuthenticated, needsProfileSetup, completeProfile, isMutating, user } =
    useAuth();
  const colors = useColors();
  const { showToast } = useToast();
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

  async function handleSave() {
    try {
      await completeProfile({ nickname: nickname.trim(), avatarUrl });
    } catch (error) {
      showToast({
        title: "Profile could not be saved",
        description: error instanceof Error ? error.message : "Try again.",
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
              Profile
            </Text>
            <Text role="title1">Finish your account</Text>
            <Text role="bodySm" tone="muted">
              Set a nickname and a photo before you start tracking.
            </Text>
          </View>

          <View style={{ alignItems: "center", gap: layout.gapDefault }}>
            <Avatar uri={avatarUrl} name={nickname || user?.username} size={88} />
            <Button
              label="Upload photo"
              variant="quiet"
              size="sm"
              onPress={pickAvatar}
              icon={<Icon glyph={Camera} size={16} color={colors.textTitle} />}
              style={{ alignSelf: "center" }}
            />
          </View>

          <Input
            label="Nickname"
            autoCapitalize="words"
            value={nickname}
            onChangeText={setNickname}
            placeholder="Hassan"
            hint={isIncomplete ? "At least two characters." : undefined}
          />

          <Button
            label="Save profile"
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
