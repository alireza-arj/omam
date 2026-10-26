import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Platform } from "react-native";
import { isDesktop } from "../lib/desktop";

function offlineReady(worker: ServiceWorker | null, prepare = false) {
  if (!worker) return Promise.resolve(null);
  return new Promise<boolean | null>((resolve) => {
    const channel = new MessageChannel();
    const finish = (ready: boolean | null) => {
      clearTimeout(timeout);
      channel.port1.close();
      resolve(ready);
    };
    const timeout = setTimeout(() => finish(null), prepare ? 30_000 : 2_000);
    channel.port1.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data as { type?: string; ready?: boolean } | null;
      finish(data?.type === "OFFLINE_STATUS" ? data.ready === true : null);
    };
    try { worker.postMessage({ type: prepare ? "PREPARE_OFFLINE" : "GET_OFFLINE_STATUS" }, [channel.port2]); }
    catch { finish(null); }
  });
}

export function PwaProvider({ children }: PropsWithChildren) {
  const enabled = Platform.OS === "web" && !isDesktop() && !__DEV__;
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const persistentRequested = useRef(false);

  useEffect(() => {
    if (!enabled || !window.isSecureContext || !("serviceWorker" in navigator)) return;
    let active = true;
    let checking = false;
    let checkAgain = false;
    let registration: ServiceWorkerRegistration | undefined;
    const watched = new Set<ServiceWorker>();

    async function inspect() {
      if (!registration || !active) return;
      if (checking) { checkAgain = true; return; }
      checking = true;
      try {
        let ready = await offlineReady(registration.active);
        const waiting = await offlineReady(registration.waiting);
        if (!active) return;
        if (ready === false && navigator.onLine && !registration.installing && !waiting) {
          ready = await offlineReady(registration.active, true);
          if (!active) return;
        }
        if (ready && !persistentRequested.current && navigator.storage?.persist) {
          persistentRequested.current = true;
          void navigator.storage.persist().catch(() => {});
        }
      } finally {
        checking = false;
        if (checkAgain && active) { checkAgain = false; void inspect(); }
      }
    }

    const changed = () => {
      const installing = registration?.installing;
      if (installing && !watched.has(installing)) {
        watched.add(installing);
        installing.addEventListener("statechange", changed);
      }
      void inspect();
    };
    const refresh = () => {
      if (!registration) { retry(); return; }
      void registration?.update().catch(() => {});
      changed();
    };
    const shown = () => { if (document.visibilityState === "visible") refresh(); };
    void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((value) => {
      if (!active) return;
      registration = value;
      registration.addEventListener("updatefound", changed);
      changed();
    }).catch(() => {});
    navigator.serviceWorker.addEventListener("controllerchange", changed);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", shown);
    return () => {
      active = false;
      registration?.removeEventListener("updatefound", changed);
      for (const worker of watched) worker.removeEventListener("statechange", changed);
      navigator.serviceWorker.removeEventListener("controllerchange", changed);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", shown);
    };
  }, [attempt, enabled]);

  return children;
}
