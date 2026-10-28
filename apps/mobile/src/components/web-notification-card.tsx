import { translateError } from "@omam/i18n";
import { Bell } from "lucide-react-native";
import { Button, Card, Notice, SectionHeader, Text, layout, useLanguage } from "../design/taraz";
import { useNotifications } from "../providers/notification-provider";

export function WebNotificationCard() {
  const notifications = useNotifications();
  const { t } = useLanguage();
  if (!notifications.visible) return null;
  const granted = notifications.permission === "granted";
  const active = notifications.enabled && granted;
  const supported = notifications.support === "supported";
  const blocked = notifications.permission === "denied";
  const message = notifications.support === "install" ? t("notifications.install")
    : !supported ? t("notifications.unsupported")
    : blocked ? t("notifications.blocked")
    : active ? t("notifications.enabled") : t("notifications.description");

  return <Card style={{ gap: layout.gapDefault }}>
    <SectionHeader glyph={Bell} tone={active ? "success" : "neutral"} title={t("notifications.title")} description={message} />
    {active ? <Text role="caption" tone="muted">{
      notifications.pushState === "connected" ? t("notifications.remindersConnected")
        : notifications.pushState === "unlinked" ? t("notifications.remindersUnlinked")
        : notifications.pushState === "unconfigured" ? t("notifications.remindersUnconfigured")
        : notifications.pushState === "unavailable" ? t("notifications.remindersUnavailable")
        : notifications.pushState === "failed" ? t("notifications.remindersFailed")
        : t("notifications.remindersConnecting")
    }</Text> : null}
    {notifications.error ? <Notice tone="danger" title={translateError(notifications.error, t, "notifications.failed")} /> : null}
    <Button label={t("notifications.preview")} full variant="quiet" onPress={notifications.preview} />
    {supported && !blocked && !active ? <Button label={t("notifications.enable")} full size="lg" loading={notifications.busy} onPress={() => { void notifications.enable(); }} /> : null}
    {active ? <Button label={t("notifications.test")} full variant="quiet" loading={notifications.busy} onPress={() => { void notifications.test(); }} /> : null}
    {notifications.enabled ? <Button label={t("notifications.disable")} full variant="outline" loading={notifications.busy} onPress={() => { void notifications.disable(); }} /> : null}
  </Card>;
}
