import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import {
  applicationServerKey, disconnectWebNotifications, requestWebNotificationPermission, setWebNotificationsEnabled,
  showWebNotification, webNotificationRegistration, webNotificationSupport,
} from "./web-notifications";

const globals = ["window", "navigator", "document", "Notification", "ServiceWorkerRegistration"] as const;
const original = new Map(globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const show = mock(async () => {});
const unsubscribe = mock(async () => true);
const close = mock(() => {});
const requestPermission = mock(async (): Promise<NotificationPermission> => "granted");
const registration = {
  showNotification: show,
  pushManager: { getSubscription: async () => ({ endpoint: "https://web.push.apple.com/test", unsubscribe }) },
  getNotifications: async () => [{ close }],
};
const register = mock(async () => registration);
const browser = { isSecureContext: true, matchMedia: () => ({ matches: false }), Notification: {} };
const navigatorStub = {
  userAgent: "Android Chrome", platform: "Linux", maxTouchPoints: 0,
  serviceWorker: { register, ready: Promise.resolve(registration), getRegistration: async () => registration },
};

beforeEach(() => {
  setWebNotificationsEnabled(false);
  show.mockClear(); unsubscribe.mockClear(); close.mockClear();
  requestPermission.mockClear(); register.mockReset(); register.mockImplementation(async () => registration);
  navigatorStub.userAgent = "Android Chrome";
  navigatorStub.platform = "Linux";
  navigatorStub.maxTouchPoints = 0;
  navigatorStub.serviceWorker.ready = Promise.resolve(registration);
  browser.isSecureContext = true;
  browser.matchMedia = () => ({ matches: false });
  for (const [key, value] of Object.entries({
    window: browser, navigator: navigatorStub, document: { documentElement: { lang: "fa" } },
    Notification: { permission: "granted", requestPermission },
    ServiceWorkerRegistration: class { showNotification() {} },
  })) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
});

afterEach(() => {
  for (const key of globals) {
    const descriptor = original.get(key);
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  setWebNotificationsEnabled(false);
});

test("iPhone and iPad require Home Screen installation before enabling notifications", () => {
  navigatorStub.userAgent = "iPhone";
  expect(webNotificationSupport()).toBe("install");
  browser.matchMedia = () => ({ matches: true });
  expect(webNotificationSupport()).toBe("supported");
  browser.matchMedia = () => ({ matches: false });
  navigatorStub.userAgent = "Macintosh";
  navigatorStub.platform = "MacIntel";
  navigatorStub.maxTouchPoints = 5;
  expect(webNotificationSupport()).toBe("install");
});

test("insecure or unsupported browsers cannot register or ask for permission", async () => {
  browser.isSecureContext = false;
  expect(webNotificationSupport()).toBe("unsupported");
  expect(() => requestWebNotificationPermission()).toThrow("NOTIFICATIONS_UNSUPPORTED");
  await expect(webNotificationRegistration()).rejects.toThrow("NOTIFICATIONS_UNSUPPORTED");
  expect(register).not.toHaveBeenCalled();
  expect(requestPermission).not.toHaveBeenCalled();
});

test("session notifications require both explicit opt-in and granted permission", async () => {
  await showWebNotification("clock-in", { title: "Start", body: "Started" });
  expect(show).not.toHaveBeenCalled();
  setWebNotificationsEnabled(true);
  Object.defineProperty(Notification, "permission", { value: "denied", configurable: true });
  await showWebNotification("clock-out", { title: "Stop", body: "Stopped" });
  expect(show).not.toHaveBeenCalled();
  expect(requestPermission).not.toHaveBeenCalled();
});

test("uses service worker notifications with localized direction and opens permission only explicitly", async () => {
  await requestWebNotificationPermission();
  expect(requestPermission).toHaveBeenCalledTimes(1);
  setWebNotificationsEnabled(true);
  await showWebNotification("clock-in", { title: "Start", body: "Started" });
  expect(register).toHaveBeenCalledWith("/sw.js");
  expect(show).toHaveBeenCalledWith("Start", expect.objectContaining({ body: "Started", lang: "fa", dir: "rtl", tag: "clock-in" }));
  expect(requestPermission).toHaveBeenCalledTimes(1);
});

test("sign-out unsubscribes push, dismisses notifications, and stops local delivery", async () => {
  setWebNotificationsEnabled(true);
  expect(await disconnectWebNotifications()).toBe("https://web.push.apple.com/test");
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledTimes(1);
  await showWebNotification("clock-out", { title: "Stop", body: "Stopped" });
  expect(show).not.toHaveBeenCalled();
});

test("disabling notifications during worker startup prevents a late notification", async () => {
  let ready: (value: typeof registration) => void = () => {};
  navigatorStub.serviceWorker.ready = new Promise((resolve) => { ready = resolve; });
  setWebNotificationsEnabled(true);
  const delivery = showWebNotification("clock-in", { title: "Start", body: "Started" });
  setWebNotificationsEnabled(false);
  ready(registration);
  await delivery;
  expect(show).not.toHaveBeenCalled();
});

test("registration failures use stable translatable codes", async () => {
  register.mockImplementation(async () => { throw new Error("Browser detail"); });
  await expect(webNotificationRegistration()).rejects.toThrow("NOTIFICATIONS_UNAVAILABLE");
});

test("decodes URL-safe VAPID public keys for PushManager", () => {
  expect([...applicationServerKey("-_8")]).toEqual([251, 255]);
});
