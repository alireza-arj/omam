import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Platform } from "react-native";
import { useLanguage } from "../design/taraz";
import { useAuth } from "./auth-provider";
import { useSync } from "./sync-provider";
import { useSQLiteContext } from "../lib/sqlite-context";
import AsyncStorage from "../lib/storage";
import { linkKey, type StoredLink } from "../lib/sync/link";
import { serverPushConfiguration, saveServerPushSubscription, removeServerPushSubscription } from "../lib/sync/client";
import {
  applicationServerKey, disconnectWebNotifications, requestWebNotificationPermission, setWebNotificationsEnabled,
  showWebNotification, webNotificationPermission, webNotificationRegistration, webNotificationSupport, type WebNotificationSupport,
} from "../lib/web-notifications";
import { isDesktop } from "../lib/desktop";

type PushState = "off" | "connected" | "unlinked" | "unconfigured" | "unavailable" | "failed";
type NotificationContextValue = {
  visible: boolean; support: WebNotificationSupport; permission: NotificationPermission; enabled: boolean;
  busy: boolean; pushState: PushState; error: unknown;
  enable: () => Promise<void>; disable: () => Promise<void>; test: () => Promise<void>;
};
const NotificationContext = createContext<NotificationContextValue | null>(null);
const preferenceKey = (userId: string) => `@omam:notifications:${userId}`;
const notificationError = (cause: unknown) => cause instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(cause.message)
  ? cause : new Error("NOTIFICATIONS_UNAVAILABLE");

export function NotificationProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const sync = useSync();
  const db = useSQLiteContext();
  const { language, t } = useLanguage();
  const visible = Platform.OS === "web" && !isDesktop();
  const userId = user?.id;
  const [support, setSupport] = useState<WebNotificationSupport>("unsupported");
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pushState, setPushState] = useState<PushState>("off");
  const [error, setError] = useState<unknown>(null);
  const generation = useRef(0);
  const desired = useRef(false);
  const translator = useRef(t);
  translator.current = t;
  const queue = useRef(Promise.resolve());
  const enqueue = useCallback((operation: () => Promise<void>) => {
    const next = queue.current.then(operation, operation);
    queue.current = next.catch(() => {});
    return next;
  }, []);

  useEffect(() => {
    if (!visible) return;
    const current = ++generation.current;
    desired.current = false;
    setWebNotificationsEnabled(false);
    setReady(false);
    setEnabled(false);
    setError(null);
    setPushState("off");
    setSupport(webNotificationSupport());
    setPermission(webNotificationPermission());
    if (userId) {
      void AsyncStorage.getItem(preferenceKey(userId)).then((value) => {
        if (generation.current !== current) return;
        setEnabled(value === "true");
        desired.current = value === "true";
        setWebNotificationsEnabled(value === "true");
        setReady(true);
      }).catch((cause: unknown) => { if (generation.current === current) { setError(notificationError(cause)); setReady(true); } });
    }
    return () => {
      ++generation.current;
      desired.current = false;
      setWebNotificationsEnabled(false);
      void enqueue(async () => {
        const endpoint = await disconnectWebNotifications();
        const stored = userId ? await AsyncStorage.getItem(linkKey(userId)) : null;
        if (endpoint && stored) {
          const link = JSON.parse(stored) as StoredLink;
          await removeServerPushSubscription(link.serverUrl, link.token, endpoint, translator.current).catch(() => {});
        }
      }).catch(() => {});
    };
  }, [visible, userId, sync.isLinked, sync.serverUrl, sync.organizationId, enqueue]);

  const connect = useCallback(async () => {
    if (!visible || !ready || !enabled || !desired.current || !userId || webNotificationPermission() !== "granted") return;
    const current = generation.current;
    await enqueue(async () => {
      if (generation.current !== current || !desired.current) return;
      setWebNotificationsEnabled(true);
      if (!sync.isLinked) { setPushState("unlinked"); return; }
      if (typeof PushManager === "undefined") { setPushState("unavailable"); return; }
      const stored = await AsyncStorage.getItem(linkKey(userId));
      if (!stored || generation.current !== current) return;
      const link = JSON.parse(stored) as StoredLink;
      const configuration = await serverPushConfiguration(link.serverUrl, link.token, t);
      if (generation.current !== current) return;
      if (!configuration.publicKey) { setPushState("unconfigured"); return; }
      const registration = await webNotificationRegistration();
      if (generation.current !== current) return;
      let subscription = await registration.pushManager.getSubscription();
      const key = applicationServerKey(configuration.publicKey);
      const existingKey = subscription?.options.applicationServerKey;
      if (subscription && existingKey && new Uint8Array(existingKey).join() !== key.join()) {
        await subscription.unsubscribe();
        subscription = null;
      }
      subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      if (generation.current !== current) return;
      const device = await db.getFirstAsync<{ id: string }>("SELECT id FROM AppDevice LIMIT 1");
      const serialized = subscription.toJSON();
      if (!device || !serialized.keys?.p256dh || !serialized.keys.auth) throw new Error("NOTIFICATIONS_UNAVAILABLE");
      await saveServerPushSubscription(link.serverUrl, link.token, {
        endpoint: subscription.endpoint, keys: { p256dh: serialized.keys.p256dh, auth: serialized.keys.auth }, deviceId: device.id, language,
      }, t);
      if (generation.current === current) { setPushState("connected"); setError(null); }
    }).catch((cause: unknown) => {
      if (generation.current === current) { setPushState("failed"); setError(notificationError(cause)); }
    });
  }, [visible, ready, enabled, userId, sync.isLinked, language, t, db, enqueue]);

  useEffect(() => {
    if (!visible) return;
    void connect();
    const refresh = () => {
      setSupport(webNotificationSupport());
      setPermission(webNotificationPermission());
      if (document.visibilityState === "visible") void connect();
    };
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [visible, connect]);

  async function enable() {
    if (!userId) return;
    const current = generation.current;
    setBusy(true);
    setError(null);
    try {
      const granted = await requestWebNotificationPermission();
      if (generation.current !== current) return;
      setPermission(granted);
      if (granted !== "granted") return;
      await webNotificationRegistration();
      await AsyncStorage.setItem(preferenceKey(userId), "true");
      if (generation.current !== current) return;
      setWebNotificationsEnabled(true);
      desired.current = true;
      setEnabled(true);
    } catch (cause) { setError(notificationError(cause)); }
    finally { setBusy(false); }
  }

  async function disable() {
    if (!userId) return;
    setWebNotificationsEnabled(false);
    desired.current = false;
    ++generation.current;
    setEnabled(false);
    setPushState("off");
    setBusy(true);
    setError(null);
    try {
      await enqueue(async () => {
        const endpoint = await disconnectWebNotifications();
        const stored = await AsyncStorage.getItem(linkKey(userId));
        if (endpoint && stored) {
          const link = JSON.parse(stored) as StoredLink;
          await removeServerPushSubscription(link.serverUrl, link.token, endpoint, t).catch(() => {});
        }
      });
      await AsyncStorage.setItem(preferenceKey(userId), "false");
    } catch (cause) { setError(notificationError(cause)); }
    finally { setBusy(false); }
  }

  async function test() {
    setBusy(true);
    setError(null);
    try { await showWebNotification("test", { title: t("notifications.testTitle"), body: t("notifications.testBody") }); }
    catch (cause) { setError(notificationError(cause)); }
    finally { setBusy(false); }
  }

  return <NotificationContext.Provider value={{ visible, support, permission, enabled, busy: busy || !ready, pushState, error, enable, disable, test }}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error("NOTIFICATIONS_UNAVAILABLE");
  return value;
}
