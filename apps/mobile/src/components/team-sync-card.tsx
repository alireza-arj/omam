import { useState } from "react";
import { View } from "react-native";
import { CloudOff, KeyRound, LockKeyhole, RefreshCw, Server, UserRound } from "lucide-react-native";
import { formatDayLabel } from "@omam/calendar";
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
  SegmentedControl,
  Text,
  layout,
  useColors,
  useToast,
  type SegmentOption,
} from "../design/taraz";

type Mode = "signIn" | "join";

const modeOptions: SegmentOption<Mode>[] = [
  { value: "signIn", label: "I have an account" },
  { value: "join", label: "I have an invite" },
];

function errorText(cause: unknown) {
  return cause instanceof Error ? cause.message : "Could not reach the server.";
}

/**
 * Links this device to the team server. Everything the app does keeps working
 * without it — the link only decides whether the hours also leave the device.
 */
export function TeamSyncCard() {
  const sync = useSync();
  const { calendar } = useAttendance();
  const { showToast } = useToast();
  const colors = useColors();

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("signIn");
  const [serverUrl, setServerUrl] = useState("");
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
          serverUrl,
          username: username.trim(),
          password,
          inviteCode: inviteCode.trim(),
        });
      } else {
        await sync.signInAndLink({ serverUrl, username: username.trim(), password });
      }

      setIsOpen(false);
      setPassword("");
      setInviteCode("");
      showToast({ title: "Connected to your team.", tone: "success" });
    } catch (cause) {
      setError(errorText(cause));
    }
  }

  async function handleSync() {
    await sync.syncNow();

    showToast(
      sync.lastError
        ? { title: "Sync failed", description: sync.lastError, tone: "error" }
        : { title: "Up to date.", tone: "success" },
    );
  }

  if (!sync.isLinked) {
    return (
      <Card style={{ gap: layout.gapDefault }}>
        <View style={{ gap: 1 }}>
          <Text role="title3">Team</Text>
          <Text role="caption" tone="muted">
            Connect to your team's server so your hours reach your manager. Until you do,
            everything stays on this device.
          </Text>
        </View>

        {isOpen ? (
          <View style={{ gap: layout.gapDefault }}>
            <SegmentedControl options={modeOptions} value={mode} onChange={setMode} full />

            <Input
              label="Server address"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              leading={<Icon glyph={Server} size={16} color={colors.textMuted} />}
              placeholder="https://omam.yourteam.com"
              value={serverUrl}
              onChangeText={setServerUrl}
            />

            <Input
              label="Username"
              autoCapitalize="none"
              autoCorrect={false}
              leading={<Icon glyph={UserRound} size={16} color={colors.textMuted} />}
              placeholder="Your team username"
              value={username}
              onChangeText={setUsername}
            />

            <Input
              label="Password"
              autoCapitalize="none"
              secureTextEntry
              leading={<Icon glyph={LockKeyhole} size={16} color={colors.textMuted} />}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
            />

            {mode === "join" ? (
              <Input
                label="Invite code"
                autoCapitalize="characters"
                autoCorrect={false}
                leading={<Icon glyph={KeyRound} size={16} color={colors.textMuted} />}
                placeholder="ABCD-1234"
                value={inviteCode}
                onChangeText={setInviteCode}
                hint="Your manager sends this from the admin panel."
              />
            ) : null}

            {error ? (
              <Text role="caption" tone="accent">
                {error}
              </Text>
            ) : null}

            <Button
              label={mode === "join" ? "Join the team" : "Connect"}
              full
              size="lg"
              variant="primary"
              loading={sync.isLinking}
              disabled={!username.trim() || password.length < 6}
              onPress={handleLink}
            />

            <Button label="Cancel" full size="lg" variant="ghost" onPress={() => setIsOpen(false)} />
          </View>
        ) : (
          <Button
            label="Connect to a team"
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
            {sync.organizationName ?? "Team"}
          </Text>
          <Text role="caption" tone="muted" numberOfLines={1}>
            Signed in as {sync.serverUsername}
          </Text>
        </View>

        {sync.pendingCount > 0 ? (
          <Badge label={`${sync.pendingCount} to send`} tone="warning" />
        ) : (
          <Badge label="Synced" tone="success" />
        )}
      </View>

      <Divider />

      <View style={{ gap: 2 }}>
        <Text role="caption" tone="muted">
          {sync.lastSyncAt
            ? `Last synced ${formatDayLabel(new Date(sync.lastSyncAt), calendar)}`
            : "Not synced yet"}
        </Text>

        {sync.rejectedCount > 0 ? (
          <Text role="caption" tone="accent">
            {sync.rejectedCount} {sync.rejectedCount === 1 ? "entry was" : "entries were"} refused —
            that month's payroll is already closed.
          </Text>
        ) : null}

        {sync.lastError ? (
          <Text role="caption" tone="accent">
            {sync.lastError}
          </Text>
        ) : null}
      </View>

      <Button
        label="Sync now"
        full
        size="lg"
        variant="quiet"
        loading={sync.isSyncing}
        onPress={handleSync}
        icon={<Icon glyph={RefreshCw} size={18} color={colors.textTitle} />}
      />

      <Button
        label="Disconnect"
        full
        size="lg"
        variant="outline"
        onPress={() => setUnlinking(true)}
        icon={<Icon glyph={CloudOff} size={18} color={colors.textBody} />}
      />

      <ConfirmDialog
        visible={unlinking}
        title="Disconnect from the team?"
        description="Your sessions stay on this device, but they stop reaching your manager. Connecting again sends the whole history back up."
        confirmLabel="Disconnect"
        onConfirm={() => {
          setUnlinking(false);
          void sync.unlink();
        }}
        onCancel={() => setUnlinking(false)}
      />
    </Card>
  );
}
