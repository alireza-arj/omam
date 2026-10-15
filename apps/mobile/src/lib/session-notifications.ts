import { Platform } from "react-native";
import type { SessionDto } from "@omam/contracts";
import { showWebNotification } from "./web-notifications";

const REMINDER_KIND = "session-reminder";
const CHANNEL_ID = "work-sessions";
const TWO_HOURS = 2 * 60 * 60;
type Notifications = typeof import("expo-notifications");
type NotificationCopy = { title: string; body: string; channelName: string };
let initialization: Promise<Notifications> | undefined;
let scheduleQueue: Promise<void> = Promise.resolve();

function isSessionNotification(kind: unknown) {
  return kind === "clock-in" || kind === "clock-out" || kind === REMINDER_KIND;
}

function queueSchedule(operation: () => Promise<void>) {
  const pending = scheduleQueue.then(operation, operation);
  scheduleQueue = pending.catch(() => {});
  return pending;
}

async function nativeNotifications() {
  if (Platform.OS === "web") return null;
  initialization ??= import("expo-notifications").then(async (notifications) => {
    notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const show = isSessionNotification(notification.request.content.data?.kind);
        return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: false, shouldSetBadge: false };
      },
    });
    const scheduled = await notifications.getAllScheduledNotificationsAsync();
    for (const item of scheduled) {
      if (!isSessionNotification(item.content.data?.kind)) {
        await notifications.cancelScheduledNotificationAsync(item.identifier);
      }
    }
    const presented = await notifications.getPresentedNotificationsAsync();
    for (const item of presented) {
      if (!isSessionNotification(item.request.content.data?.kind)) {
        await notifications.dismissNotificationAsync(item.request.identifier);
      }
    }
    return notifications;
  }).catch((error: unknown) => {
    initialization = undefined;
    throw error;
  });
  return initialization;
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

export function sendSessionNotification(kind: "clock-in" | "clock-out", copy: NotificationCopy) {
  return queueSchedule(async () => {
    if (kind !== "clock-in" && kind !== "clock-out") return;
    if (Platform.OS === "web") return showWebNotification(kind, copy);
    const notifications = await canNotify(kind === "clock-in", copy.channelName);
    if (!notifications) return;
    await notifications.scheduleNotificationAsync({
      content: { title: copy.title, body: copy.body, data: { kind } },
      trigger: Platform.OS === "android"
        ? { type: notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, channelId: CHANNEL_ID }
        : null,
    });
  });
}

export function reconcileSessionReminder(session: SessionDto | null, userId: string | null, copy: NotificationCopy) {
  return queueSchedule(async () => {
    const notifications = await nativeNotifications();
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
    if (!active || matching || !await canNotify(false, copy.channelName)) return;
    await notifications.scheduleNotificationAsync({
      content: { title: copy.title, body: copy.body, data: { kind: REMINDER_KIND, sessionKey: active } },
      trigger: { type: notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: TWO_HOURS, repeats: true, channelId: CHANNEL_ID },
    });
  });
}

export function cancelSessionReminder(sessionId: string) {
  return queueSchedule(async () => {
    const notifications = await nativeNotifications();
    if (!notifications) return;
    const scheduled = await notifications.getAllScheduledNotificationsAsync();
    for (const item of scheduled) {
      if (item.content.data?.kind === REMINDER_KIND && String(item.content.data?.sessionKey).endsWith(`:${sessionId}`)) {
        await notifications.cancelScheduledNotificationAsync(item.identifier);
      }
    }
  });
}

export async function configureSessionNotificationHandler() {
  await nativeNotifications();
}
