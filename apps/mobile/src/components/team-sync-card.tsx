import { useRouter } from "expo-router";
import { useAuth } from "../providers/auth-provider";
import { useState } from "react";
import { View } from "react-native";
import { CloudOff, RefreshCw } from "lucide-react-native";
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
  Text,
  layout,
  useColors,
  useLanguage,
  useToast,
} from "../design/taraz";

export function TeamSyncCard() {
  const sync = useSync();
  const router = useRouter();
  const { signOut, isMutating } = useAuth();
  const { calendar } = useAttendance();
  const { showToast } = useToast();
  const { language, t } = useLanguage();
  const colors = useColors();

  const errorText = (cause: unknown) => translateError(cause, t, "team.unreachable");
  const [unlinking, setUnlinking] = useState(false);

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
            {t("team.personalAccountHint")}
          </Text>
        </View>

        <Button label={t("workspace.teamLogin")} full size="lg" variant="quiet" loading={isMutating} onPress={() => {
          void signOut().then(() => router.replace({ pathname: "/(auth)", params: { mode: "team" } })).catch((cause) => showToast({ title: errorText(cause), tone: "error" }));
        }} />
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
