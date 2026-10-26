import { createTranslator } from "@omam/i18n";

declare const self: ServiceWorkerGlobalScope;
declare const __PWA_BUILD__: { version: string; assets: { url: string; integrity: string }[] };
const build = typeof __PWA_BUILD__ === "undefined" ? { version: "dev", assets: [] } : __PWA_BUILD__;
const CACHE_PREFIX = "tarazkar-pwa-";
const CACHE_NAME = `${CACHE_PREFIX}v4-${build.version}`;
const assets = new Set(build.assets.map((asset) => asset.url));
const development = self.location.pathname.endsWith("/pwa-dev-sw.js");

function excluded(path: string) {
  return ["/api", "/admin", "/electron"].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

async function precache() {
  if (!assets.has("/index.html")) throw new Error("PWA_BUILD_MISSING");
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(build.assets.map(({ url, integrity }) => new Request(url, {
    cache: "reload", credentials: "same-origin", integrity,
  })));
}

async function cachedResponse(response: Response, range: string | null) {
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (!match[1] && !match[2])) return response;
  const bytes = await response.arrayBuffer();
  const size = bytes.byteLength;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (start >= size || end < start || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  const headers = new Headers(response.headers);
  headers.delete("Content-Encoding");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(end - start + 1));
  return new Response(bytes.slice(start, end + 1), { status: 206, headers });
}

self.addEventListener("install", (event) => {
  if (development) {
    event.waitUntil(self.skipWaiting());
    return;
  }
  event.waitUntil(precache());
});

self.addEventListener("activate", (event) => {
  if (development) {
    event.waitUntil(self.clients.claim());
    return;
  }
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
    .map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (development) return;
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || excluded(url.pathname)) return;
  if (event.request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match("/index.html")) ?? fetch(event.request);
    })());
    return;
  }
  if (!assets.has(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(url.pathname);
    return cached ? cachedResponse(cached, event.request.headers.get("Range")) : fetch(event.request);
  })());
});

self.addEventListener("message", (event) => {
  if (!["GET_OFFLINE_STATUS", "PREPARE_OFFLINE"].includes(event.data?.type) || !event.ports[0]) return;
  event.waitUntil((async () => {
    let ready = false;
    try {
      if (!development && event.data.type === "PREPARE_OFFLINE") await precache();
      const cache = await caches.open(CACHE_NAME);
      const present = await Promise.all(build.assets.map(({ url }) => cache.match(url)));
      ready = !development && assets.has("/index.html") && present.every(Boolean);
    } catch {}
    event.ports[0]!.postMessage({ type: "OFFLINE_STATUS", ready });
  })());
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
