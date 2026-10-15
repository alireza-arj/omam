import { useEffect } from "react";
import { useAuth } from "../providers/auth-provider";
import { useAttendance } from "../providers/attendance-provider";
import { useLanguage } from "../design/taraz";
import { configureSessionNotificationHandler, reconcileSessionReminder } from "../lib/session-notifications";

export function SessionNotificationCoordinator() {
  const { user } = useAuth();
  const { summary, isLoading } = useAttendance();
  const { t } = useLanguage();
  const title = t("today.reminderTitle");
  const body = t("today.reminderBody");
  const channelName = t("today.notificationChannel");

  useEffect(() => {
    void configureSessionNotificationHandler().catch(() => {});
  }, []);

  useEffect(() => {
    if (isLoading) return;
    void reconcileSessionReminder(summary.activeSession, user?.id ?? null, { title, body, channelName }).catch(() => {});
  }, [body, channelName, isLoading, summary.activeSession, title, user?.id]);

  return null;
}
