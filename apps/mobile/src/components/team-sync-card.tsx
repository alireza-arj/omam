import { useRouter } from "expo-router";
import { useAuth } from "../providers/auth-provider";
import { useState } from "react";
import { View } from "react-native";
import { CloudOff, RefreshCw, Users } from "lucide-react-native";
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
  Notice,
  SectionHeader,
  Text,
  layout,
  useColors,
  useLanguage,
} from "../design/taraz";

export function TeamSyncCard() {
  const sync = useSync();
  const router = useRouter();
  const { signOut, isMutating } = useAuth();
  const { calendar } = useAttendance();
  const { language, t } = useLanguage();
  const colors = useColors();

  const [unlinking, setUnlinking] = useState(false);

  async function handleSync() {
    await sync.syncNow().catch(() => {});
  }

  if (!sync.isLinked) {
    return (
      <Card style={{ gap: layout.gapDefault }}>
        <SectionHeader glyph={Users} title={t("team.title")} description={t("team.personalAccountHint")} />

        <Button label={t("workspace.teamLogin")} full size="lg" variant="quiet" loading={isMutating} onPress={() => {
          void signOut().then(() => router.replace({ pathname: "/(auth)", params: { mode: "team" } })).catch(() => {});
        }} />
      </Card>
    );
  }

  return (
    <Card style={{ gap: layout.gapDefault }}>
      <SectionHeader
        glyph={Users}
        tone="info"
        title={sync.organizationName ?? t("team.title")}
        description={t("team.signedInAs", { username: sync.serverUsername ?? "" })}
        trailing={sync.pendingCount > 0 ? (
          <Badge label={t("team.toSend", { count: sync.pendingCount })} tone="warning" />
        ) : (
          <Badge label={t("team.synced")} tone="success" />
        )}
      />

      {sync.teams.length > 1 ? <View style={{ gap: layout.gapTight }}>
        <Text role="caption" tone="muted">{t("workspace.switchTeam")}</Text>
        {sync.teams.map((team) => <Button key={team.organizationId} label={team.organizationName} variant={team.organizationId === sync.organizationId ? "quiet" : "outline"} full disabled={sync.isSyncing || sync.isLinking || team.organizationId === sync.organizationId} onPress={() => { void sync.selectTeam(team.organizationId).catch(() => {}); }} />)}
      </View> : null}
      <Divider />
      <View style={{ gap: layout.gapTight }}>
        <Text role="caption" tone="muted">
          {sync.lastSyncAt
            ? t("team.lastSynced", {
                when: formatDayLabel(new Date(sync.lastSyncAt), calendar, language),
              })
            : t("team.neverSynced")}
        </Text>

        {sync.rejectedCount > 0 ? <Notice tone="warning" title={t("team.refused", { count: sync.rejectedCount })} /> : null}
        {sync.lastError ? <Notice tone="danger" title={translateError(sync.lastError, t)} /> : null}
      </View>

      <Button
        label={t("team.syncNow")}
        full
        size="lg"
        variant="quiet"
        loading={sync.isSyncing}
        onPress={handleSync}
        icon={<Icon glyph={RefreshCw} size={layout.iconSm} color={colors.textTitle} />}
      />

      <Button
        label={t("team.disconnect")}
        full
        size="lg"
        variant="ghost"
        onPress={() => setUnlinking(true)}
        icon={<Icon glyph={CloudOff} size={layout.iconSm} color={colors.textBody} />}
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
