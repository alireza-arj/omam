import { useEffect } from "react";
import { useAuth } from "../providers/auth-provider";
import { useAttendance } from "../providers/attendance-provider";
import { useLanguage, useToast } from "../design/taraz";
import { listenForForegroundReminder, reconcileSessionReminder } from "../lib/session-notifications";

export function SessionNotificationCoordinator() {
  const { user } = useAuth();
  const { summary, isLoading } = useAttendance();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const title = t("today.reminderTitle");
  const body = t("today.reminderBody");
  const channelName = t("today.notificationChannel");

  useEffect(() => {
    if (isLoading) return;
    void reconcileSessionReminder(summary.activeSession, user?.id ?? null, { title, body, channelName }).catch(() => {});
  }, [body, channelName, isLoading, summary.activeSession, title, user?.id]);

  useEffect(() => {
    let dispose: (() => void) | undefined;
    let mounted = true;
    void listenForForegroundReminder(() => showToast({ title, description: body, tone: "warning", duration: 7000 }))
      .then((remove) => {
        if (mounted) dispose = remove;
        else remove();
      })
      .catch(() => {});
    return () => {
      mounted = false;
      dispose?.();
    };
  }, [body, showToast, title]);

  return null;
}
