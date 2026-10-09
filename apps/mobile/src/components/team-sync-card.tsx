import { useState } from "react";
import { View } from "react-native";
import { CloudOff, KeyRound, LockKeyhole, RefreshCw, UserRound } from "lucide-react-native";
import { formatDayLabel } from "@omam/calendar";
import { translateError } from "@omam/i18n";
import { useAttendance } from "../providers/attendance-provider";
import { useSync } from "../providers/sync-provider";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Divider,
  Icon,
  Input,
  MotionReveal,
  SegmentedControl,
  Text,
  layout,
  useColors,
  useLanguage,
  useToast,
  type SegmentOption,
} from "../design/taraz";

type Mode = "signIn" | "join";

/**
 * Links this device to the team server. Everything the app does keeps working
 * without it — the link only decides whether the hours also leave the device.
 */
export function TeamSyncCard() {
  const sync = useSync();
  const { calendar } = useAttendance();
  const { showToast } = useToast();
  const { language, t } = useLanguage();
  const colors = useColors();

  const modeOptions: SegmentOption<Mode>[] = [
    { value: "signIn", label: t("team.haveAccount") },
    { value: "join", label: t("team.haveInvite") },
  ];

  const errorText = (cause: unknown) => translateError(cause, t, "team.unreachable");

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("signIn");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  async function handleLink() {
    setError(null);

    try {
      if (mode === "join") {
        await sync.joinWithInvite({
          username: username.trim(),
          password,
          inviteCode: inviteCode.trim(),
        });
      } else {
        await sync.signInAndLink({ username: username.trim(), password });
      }

      setIsOpen(false);
      setPassword("");
      setInviteCode("");
      showToast({ title: t("team.connected"), tone: "success" });
    } catch (cause) {
      setError(errorText(cause));
    }
  }

  async function handleSync() {
    try { await sync.syncNow(); showToast({ title: t("team.upToDate"), tone: "success" }); }
    catch (cause) { showToast({ title: errorText(cause), tone: "error" }); }
  }

  if (!sync.isLinked) {
    return (
      <Card style={{ gap: layout.gapDefault }}>
        <View style={{ gap: 1 }}>
          <Text role="title3">{t("team.title")}</Text>
          <Text role="caption" tone="muted">
            {t("team.intro")}
          </Text>
        </View>

        {isOpen ? (
          <MotionReveal style={{ gap: layout.gapDefault }}>
            <SegmentedControl options={modeOptions} value={mode} onChange={setMode} full />

            <Input
              label={t("auth.username")}
              autoCapitalize="none"
              autoCorrect={false}
              leading={<Icon glyph={UserRound} size={16} color={colors.textMuted} />}
              placeholder={t("team.usernamePlaceholder")}
              value={username}
              onChangeText={setUsername}
            />

            <Input
              label={t("auth.password")}
              autoCapitalize="none"
              secureTextEntry
              leading={<Icon glyph={LockKeyhole} size={16} color={colors.textMuted} />}
              placeholder={t("auth.password")}
              value={password}
              onChangeText={setPassword}
            />

            {mode === "join" ? (
              <MotionReveal>
                <Input
                  label={t("team.inviteCode")}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  leading={<Icon glyph={KeyRound} size={16} color={colors.textMuted} />}
                  placeholder={t("team.invitePlaceholder")}
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  hint={t("team.inviteHint")}
                />
              </MotionReveal>
            ) : null}

            {error ? (
              <Text role="caption" tone="accent">
                {error}
              </Text>
            ) : null}

            <Button
              label={mode === "join" ? t("team.join") : t("team.connectAction")}
              full
              size="lg"
              variant="primary"
              loading={sync.isLinking}
              disabled={!username.trim() || password.length < 6}
              onPress={handleLink}
            />

            <Button
              label={t("common.cancel")}
              full
              size="lg"
              variant="ghost"
              onPress={() => setIsOpen(false)}
            />
          </MotionReveal>
        ) : (
          <Button
            label={t("team.connect")}
            full
            size="lg"
            variant="quiet"
            onPress={() => setIsOpen(true)}
          />
        )}
      </Card>
    );
  }

  return (
    <Card style={{ gap: layout.gapDefault }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: layout.gapDefault }}>
        <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
          <Text role="title3" numberOfLines={1}>
            {sync.organizationName ?? t("team.title")}
          </Text>
          <Text role="caption" tone="muted" numberOfLines={1}>
            {t("team.signedInAs", { username: sync.serverUsername ?? "" })}
          </Text>
        </View>

        {sync.pendingCount > 0 ? (
          <Badge label={t("team.toSend", { count: sync.pendingCount })} tone="warning" />
        ) : (
          <Badge label={t("team.synced")} tone="success" />
        )}
      </View>

      {sync.teams.length > 1 ? <View style={{ gap: layout.gapTight }}>
        <Text role="caption" tone="muted">{t("workspace.switchTeam")}</Text>
        {sync.teams.map((team) => <Button key={team.organizationId} label={team.organizationName} variant={team.organizationId === sync.organizationId ? "quiet" : "outline"} full disabled={sync.isSyncing || sync.isLinking || team.organizationId === sync.organizationId} onPress={() => { void sync.selectTeam(team.organizationId).catch((cause) => showToast({ title: errorText(cause), tone: "error" })); }} />)}
      </View> : null}
      <Input label={t("team.inviteCode")} value={inviteCode} onChangeText={setInviteCode} placeholder={t("team.invitePlaceholder")} autoCapitalize="characters" hint={t("workspace.joinExistingHint")} />
      <Button label={t("workspace.joinTeam")} variant="outline" full disabled={!inviteCode.trim() || sync.isSyncing || sync.isLinking} onPress={() => { void sync.joinTeam(inviteCode.trim()).then(() => { setInviteCode(""); showToast({ title: t("workspace.teamJoined"), tone: "success" }); }).catch((cause) => showToast({ title: errorText(cause), tone: "error" })); }} />
      <Divider />

      <View style={{ gap: 2 }}>
        <Text role="caption" tone="muted">
          {sync.lastSyncAt
            ? t("team.lastSynced", {
                when: formatDayLabel(new Date(sync.lastSyncAt), calendar, language),
              })
            : t("team.neverSynced")}
        </Text>

        {sync.rejectedCount > 0 ? (
          <Text role="caption" tone="accent">
            {t("team.refused", { count: sync.rejectedCount })}
          </Text>
        ) : null}

        {sync.lastError ? (
          <Text role="caption" tone="accent">
            {translateError(sync.lastError, t)}
          </Text>
        ) : null}
      </View>

      <Button
        label={t("team.syncNow")}
        full
        size="lg"
        variant="quiet"
        loading={sync.isSyncing}
        onPress={handleSync}
        icon={<Icon glyph={RefreshCw} size={18} color={colors.textTitle} />}
      />

      <Button
        label={t("team.disconnect")}
        full
        size="lg"
        variant="outline"
        onPress={() => setUnlinking(true)}
        icon={<Icon glyph={CloudOff} size={18} color={colors.textBody} />}
      />

      <ConfirmDialog
        visible={unlinking}
        title={t("team.disconnectTitle")}
        description={t("team.disconnectDescription")}
        confirmLabel={t("team.disconnect")}
        onConfirm={() => {
          setUnlinking(false);
          void sync.unlink();
        }}
        onCancel={() => setUnlinking(false)}
      />
    </Card>
  );
}
