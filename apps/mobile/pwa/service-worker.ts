import { createTranslator } from "@omam/i18n";

declare const self: ServiceWorkerGlobalScope;
const CACHE_NAME = "tarazkar-pwa-v3";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (self.location.pathname.endsWith("/pwa-dev-sw.js")) return;
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin ||
      ["/api", "/admin", "/electron"].some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`))) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(async () => (await caches.match("/")) ?? Response.error()));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request).then((response) => {
    if (response.status === 200 && response.type !== "opaque") {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
    }
    return response;
  })));
});

self.addEventListener("push", (event) => {
  let payload: Record<string, unknown> = {};
  try {
    const data: unknown = event.data?.json();
    if (data && typeof data === "object") payload = data as Record<string, unknown>;
  } catch {}
  const language = payload.lang === "fa" ? "fa" : "en";
  const t = createTranslator(language);
  event.waitUntil(self.registration.showNotification(
    typeof payload.title === "string" ? payload.title : t("today.reminderTitle"), {
      body: typeof payload.body === "string" ? payload.body : t("today.reminderBody"),
      icon: "/icon-512.png", badge: "/icon-512.png", tag: "session-reminder",
      lang: language, dir: language === "fa" ? "rtl" : "ltr", data: { kind: "session-reminder" },
    },
  ));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => {
      const url = new URL(client.url);
      return url.origin === self.location.origin && !["/admin", "/api", "/electron"].some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`));
    });
    if (existing) {
      await existing.navigate("/");
      await existing.focus();
    } else await self.clients.openWindow("/");
  })());
});
