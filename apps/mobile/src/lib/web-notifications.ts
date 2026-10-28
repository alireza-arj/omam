import { isDesktop } from "./desktop";

export type WebNotificationSupport = "supported" | "install" | "unsupported";
let enabled = false;

export function webNotificationSupport(): WebNotificationSupport {
  if (typeof window === "undefined" || isDesktop()) return "unsupported";
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (ios && !standalone) return "install";
  return window.isSecureContext && "Notification" in window && "serviceWorker" in navigator && typeof ServiceWorkerRegistration !== "undefined" &&
    "showNotification" in ServiceWorkerRegistration.prototype ? "supported" : "unsupported";
}

export function webNotificationPermission(): NotificationPermission {
  return typeof Notification === "undefined" ? "default" : Notification.permission;
}

export function setWebNotificationsEnabled(value: boolean) { enabled = value; }

export function requestWebNotificationPermission() {
  if (webNotificationSupport() !== "supported") throw new Error("NOTIFICATIONS_UNSUPPORTED");
  return Notification.requestPermission().catch(() => { throw new Error("NOTIFICATIONS_UNAVAILABLE"); });
}

export async function webNotificationRegistration() {
  if (webNotificationSupport() !== "supported") throw new Error("NOTIFICATIONS_UNSUPPORTED");
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const workerPath = typeof __DEV__ !== "undefined" && __DEV__ ? "/pwa-dev-sw.js" : "/sw.js";
  try {
    return await Promise.race([
      navigator.serviceWorker.register(workerPath).then(() => navigator.serviceWorker.ready),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("NOTIFICATIONS_UNAVAILABLE")), 10_000); }),
    ]);
  } catch { throw new Error("NOTIFICATIONS_UNAVAILABLE"); }
  finally { clearTimeout(timeout); }
}

export async function showWebNotification(kind: "clock-in" | "clock-out" | "test", copy: { title: string; body: string }) {
  if (!enabled || webNotificationSupport() !== "supported" || webNotificationPermission() !== "granted") return;
  const registration = await webNotificationRegistration();
  if (!enabled) return;
  const language = document.documentElement.lang === "fa" ? "fa" : "en";
  await registration.showNotification(copy.title, {
    body: copy.body, icon: "/icon-512.png", badge: "/icon-512.png", tag: kind,
    lang: language, dir: language === "fa" ? "rtl" : "ltr", data: { kind },
  });
}

export async function disconnectWebNotifications() {
  enabled = false;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager?.getSubscription();
  if (subscription) await subscription.unsubscribe();
  const notifications = await registration?.getNotifications();
  for (const notification of notifications ?? []) notification.close();
  return subscription?.endpoint ?? null;
}

export function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const decoded = atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "="));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}
