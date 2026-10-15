import { Platform } from "react-native";

// Retain native notification access to clear reminders scheduled by older versions.
export async function clearLegacyNotifications() {
  if (Platform.OS === "web") return;

  const notifications = await import("expo-notifications");
  notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  await Promise.all([
    notifications.cancelAllScheduledNotificationsAsync(),
    notifications.dismissAllNotificationsAsync(),
  ]);
  if (Platform.OS === "android") {
    await notifications.deleteNotificationChannelAsync("work-sessions");
  }
}
