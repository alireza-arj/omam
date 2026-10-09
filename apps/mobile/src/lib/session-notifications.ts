import { getDesktopBridge } from "./desktop";
import { Platform } from "react-native";
import type { SessionDto } from "@omam/contracts";

const REMINDER_KIND = "session-reminder";
const CHANNEL_ID = "work-sessions";
const TWO_HOURS = 2 * 60 * 60;
let scheduleQueue: Promise<void> = Promise.resolve();

function queueSchedule(operation: () => Promise<void>) {
  const pending = scheduleQueue.then(operation, operation);
  scheduleQueue = pending.catch(() => {});
  return pending;
}

type NotificationCopy = {
  title: string;
  body: string;
  channelName: string;
};

async function nativeNotifications() {
  if (Platform.OS === "web") return null;
  return import("expo-notifications");
}

async function canNotify(request: boolean, channelName: string) {
  const notifications = await nativeNotifications();
  if (!notifications) return null;

  if (Platform.OS === "android") {
    await notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: channelName,
      importance: notifications.AndroidImportance.DEFAULT,
    });
  }

  let permission = await notifications.getPermissionsAsync();
  if (!permission.granted && request && permission.canAskAgain) {
    permission = await notifications.requestPermissionsAsync();
  }
  return permission.granted ? notifications : null;
}

export async function sendSessionNotification(kind: "clock-in" | "clock-out", copy: NotificationCopy) {
  const desktop = getDesktopBridge();
  if (desktop) { await desktop.notify(copy.title, copy.body); return; }
  const notifications = await canNotify(kind === "clock-in", copy.channelName);
  if (!notifications) return;
  await notifications.scheduleNotificationAsync({
    content: { title: copy.title, body: copy.body, data: { kind } },
    trigger: Platform.OS === "android"
      ? { type: notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, channelId: CHANNEL_ID }
      : null,
  });
}

export function reconcileSessionReminder(session: SessionDto | null, userId: string | null, copy: NotificationCopy) {
  return queueSchedule(() => reconcileReminder(session, userId, copy));
}

async function reconcileReminder(session: SessionDto | null, userId: string | null, copy: NotificationCopy) {
  const notifications = await canNotify(false, copy.channelName);
  if (!notifications) return;

  const scheduled = await notifications.getAllScheduledNotificationsAsync();
  const reminders = scheduled.filter((item) => item.content.data?.kind === REMINDER_KIND);
  const active = session && userId ? `${userId}:${session.id}` : null;
  const matching = reminders.find((item) => item.content.data?.sessionKey === active && item.content.title === copy.title && item.content.body === copy.body);

  for (const reminder of reminders) {
    if (!active || reminder.content.data?.sessionKey !== active || reminder.identifier !== matching?.identifier) {
      await notifications.cancelScheduledNotificationAsync(reminder.identifier);
    }
  }

  if (!active || matching) return;

  await notifications.scheduleNotificationAsync({
    content: {
      title: copy.title,
      body: copy.body,
      data: { kind: REMINDER_KIND, sessionKey: active },
    },
    trigger: { type: notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: TWO_HOURS, repeats: true, channelId: CHANNEL_ID },
  });
}

export function cancelSessionReminder(sessionId: string) {
  return queueSchedule(() => cancelReminder(sessionId));
}

async function cancelReminder(sessionId: string) {
  const notifications = await nativeNotifications();
  if (!notifications) return;
  const scheduled = await notifications.getAllScheduledNotificationsAsync();
  for (const item of scheduled) {
    if (item.content.data?.kind === REMINDER_KIND && String(item.content.data?.sessionKey).endsWith(`:${sessionId}`)) {
      await notifications.cancelScheduledNotificationAsync(item.identifier);
    }
  }
}

export async function listenForForegroundReminder(onReminder: () => void) {
  const notifications = await nativeNotifications();
  if (!notifications) return () => {};
  notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  const subscription = notifications.addNotificationReceivedListener((notification) => {
    if (notification.request.content.data?.kind === REMINDER_KIND) onReminder();
  });
  return () => subscription.remove();
}
