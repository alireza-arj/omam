import { beforeAll, beforeEach, expect, mock, test } from "bun:test";
import { runInNewContext } from "node:vm";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { precacheBuild } from "../scripts/build-service-worker";

type WorkerEvent = {
  data?: { json: () => unknown } | { type: string }; notification?: { close: () => void };
  waitUntil: (operation: Promise<unknown>) => void;
  request?: Request;
  respondWith?: (response: Promise<Response>) => void;
  ports?: { postMessage: (message: unknown) => void }[];
};
const listeners = new Map<string, (event: WorkerEvent) => void>();
const show = mock(async () => {});
const openWindow = mock(async () => {});
let windows: { url: string; focus: () => Promise<void>; navigate: (path: string) => Promise<void> }[] = [];
let worker = "";
const origin = "https://omam.test";
const build = { version: "test", assets: ["/index.html", "/entry.js", "/sqlite.wasm"].map((url) => ({ url, integrity: "sha256-test" })) };
const cacheName = "tarazkar-pwa-v4-test";
let stored: Map<string, Map<string, Response>>;
const fetchNetwork = mock(async (_request: Request) => new Response("network"));
const skipWaiting = mock(async () => {});
const claim = mock(async () => {});
let installFailure = false;
type CachedRequest = { url: string; cache?: RequestCache; integrity?: string };
let installedRequests: CachedRequest[] = [];

function contents(name = cacheName) {
  let entries = stored.get(name);
  if (!entries) { entries = new Map(); stored.set(name, entries); }
  return entries;
}

beforeAll(async () => {
  const result = await Bun.build({ entrypoints: [import.meta.dir + "/service-worker.ts"], target: "browser", define: { __PWA_BUILD__: JSON.stringify(build) } });
  expect(result.success).toBe(true);
  worker = await result.outputs[0]!.text();
});

beforeEach(() => {
  listeners.clear(); show.mockClear(); openWindow.mockClear(); windows = [];
  stored = new Map(); installedRequests = []; installFailure = false;
  fetchNetwork.mockReset(); fetchNetwork.mockImplementation(async () => new Response("network"));
  skipWaiting.mockClear(); claim.mockClear();
  runInNewContext(worker, {
    URL, Response, Headers,
    Request: class {
      url: string;
      cache?: RequestCache;
      integrity?: string;
      constructor(input: string, options?: RequestInit) {
        this.url = new URL(input, origin).href;
        this.cache = options?.cache;
        this.integrity = options?.integrity;
      }
    },
    fetch: fetchNetwork,
    caches: {
      keys: async () => [...stored.keys()],
      delete: async (name: string) => stored.delete(name),
      open: async (name: string) => ({
        addAll: async (requests: CachedRequest[]) => {
          installedRequests = requests;
          if (installFailure) throw new Error("offline");
          for (const request of requests) contents(name).set(new URL(request.url).pathname, new Response(new URL(request.url).pathname));
        },
        match: async (path: string) => contents(name).get(path)?.clone(),
      }),
    },
    self: {
      location: { origin: "https://omam.test", pathname: "/sw.js" },
      registration: { showNotification: show },
      skipWaiting,
      clients: { matchAll: async () => windows, openWindow, claim },
      addEventListener: (kind: string, handler: (event: WorkerEvent) => void) => listeners.set(kind, handler),
    },
  });
});

async function lifecycle(kind: string) {
  let completion: Promise<unknown> = Promise.resolve();
  listeners.get(kind)!({ waitUntil: (promise) => { completion = promise; } });
  await completion;
}

async function request(path: string, options: RequestInit = {}, navigate = false) {
  const request = { url: new URL(path, origin).href, method: options.method ?? "GET", mode: navigate ? "navigate" : "cors", headers: new Headers(options.headers) } as Request;
  let response: Promise<Response> | undefined;
  listeners.get("fetch")!({ request, waitUntil: () => {}, respondWith: (value) => { response = value; } });
  return response;
}

test("install precaches every build resource with integrity and fresh network reads without replacing open clients", async () => {
  await lifecycle("install");
  expect(installedRequests.map((request) => new URL(request.url).pathname)).toEqual(build.assets.map(({ url }) => url));
  expect(installedRequests.every((request) => request.cache === "reload" && request.integrity === "sha256-test")).toBe(true);
  expect(skipWaiting).not.toHaveBeenCalled();
});

test("a failed install preserves the old build and never activates a partial update", async () => {
  contents("tarazkar-pwa-old").set("/index.html", new Response("old"));
  installFailure = true;
  await expect(lifecycle("install")).rejects.toThrow("offline");
  expect(await contents("tarazkar-pwa-old").get("/index.html")!.text()).toBe("old");
  expect(claim).not.toHaveBeenCalled();
});

test("activation removes only app caches and preserves unrelated origin storage", async () => {
  contents("tarazkar-pwa-v3"); contents("admin-cache"); contents();
  await lifecycle("activate");
  expect([...stored.keys()].sort()).toEqual(["admin-cache", cacheName].sort());
  expect(claim).toHaveBeenCalledTimes(1);
});

test("offline deep links and reloads use the installed HTML and SQLite without waiting for the network", async () => {
  await lifecycle("install");
  fetchNetwork.mockImplementation(async () => { throw new Error("offline"); });
  for (const path of ["/", "/profile", "/history?month=1405-08", "/session/local-id"]) {
    expect(await (await request(path, {}, true))!.text()).toBe("/index.html");
  }
  expect(await (await request("/sqlite.wasm?version=1"))!.text()).toBe("/sqlite.wasm");
  expect(fetchNetwork).not.toHaveBeenCalled();
});

test("API, admin, desktop releases, mutations and unlisted resources never enter the app cache", async () => {
  await lifecycle("install");
  for (const path of ["/api", "/api/users", "/admin", "/admin/", "/electron/latest", "https://other.test/entry.js", "/sw.js", "/avatar-private.png"]) {
    expect(await request(path, {}, path !== "/sw.js" && path !== "/avatar-private.png")).toBeUndefined();
  }
  expect(await request("/entry.js", { method: "POST" })).toBeUndefined();
});

test("cached media supports byte ranges without a network connection", async () => {
  await lifecycle("install");
  const partial = await request("/entry.js", { headers: { Range: "bytes=1-2" } });
  expect(partial!.status).toBe(206);
  expect(partial!.headers.get("Content-Range")).toBe("bytes 1-2/9");
  expect(await partial!.text()).toBe("en");
  expect(await (await request("/entry.js", { headers: { Range: "bytes=-2" } }))!.text()).toBe("js");
  expect(await (await request("/entry.js", { headers: { Range: "bytes=7-" } }))!.text()).toBe("js");
  expect((await request("/entry.js", { headers: { Range: "bytes=100-200" } }))!.status).toBe(416);
  expect((await request("/entry.js", { headers: { Range: "bytes=4-2" } }))!.status).toBe(416);
  expect(fetchNetwork).not.toHaveBeenCalled();
});

test("readiness is true only while the full offline build is available", async () => {
  const replies: unknown[] = [];
  async function status() {
    let completion: Promise<unknown> = Promise.resolve();
    listeners.get("message")!({ data: { type: "GET_OFFLINE_STATUS" }, ports: [{ postMessage: (value) => replies.push(value) }], waitUntil: (promise) => { completion = promise; } });
    await completion;
  }
  await status();
  await lifecycle("install");
  await status();
  contents().delete("/sqlite.wasm");
  await status();
  expect(replies).toEqual([{ type: "OFFLINE_STATUS", ready: false }, { type: "OFFLINE_STATUS", ready: true }, { type: "OFFLINE_STATUS", ready: false }]);
});

test("an online retry repairs an incomplete cache and a failed retry reports unavailable", async () => {
  const replies: unknown[] = [];
  async function repair() {
    let completion: Promise<unknown> = Promise.resolve();
    listeners.get("message")!({ data: { type: "PREPARE_OFFLINE" }, ports: [{ postMessage: (value) => replies.push(value) }], waitUntil: (promise) => { completion = promise; } });
    await completion;
  }
  await repair();
  expect(contents().has("/sqlite.wasm")).toBe(true);
  contents().delete("/sqlite.wasm");
  installFailure = true;
  await repair();
  expect(replies).toEqual([{ type: "OFFLINE_STATUS", ready: true }, { type: "OFFLINE_STATUS", ready: false }]);
});

test("the generated build includes all web resources and changes version when resource bytes change", () => {
  const dir = mkdtempSync(join(tmpdir(), "omam-precache-"));
  try {
    const paths = ["index.html", "_expo/static/js/web/entry.js", "_expo/static/js/web/worker.js", "_expo/static/css/global.css", "assets/@fonts/Persian font.ttf", "assets/sqlite.wasm", "assets/sound.m4a", "icon-512.png", "manifest.webmanifest"];
    for (const path of [...paths, "_expo/static/js/android/entry.hbc", "assets/nativehash", "_expo/static/js/web/entry.js.map", "metadata.json", "sw.js", "api/private.json"]) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), path);
    }
    const first = precacheBuild(dir);
    expect(first.assets.map(({ url }) => decodeURI(url)).sort()).toEqual(paths.map((path) => `/${path}`).sort());
    expect(first.assets.every(({ integrity }) => /^sha256-[A-Za-z0-9+/]+=*$/.test(integrity))).toBe(true);
    expect(precacheBuild(dir)).toEqual(first);
    writeFileSync(join(dir, "assets/@fonts/Persian font.ttf"), "new font");
    expect(precacheBuild(dir).version).not.toBe(first.version);
    rmSync(join(dir, "index.html"));
    expect(() => precacheBuild(dir)).toThrow("missing its HTML or web bundle");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

async function push(data: () => unknown) {
  let completion: Promise<unknown> = Promise.resolve();
  listeners.get("push")!({ data: { json: data }, waitUntil: (promise) => { completion = promise; } });
  await completion;
}

test("a background push displays a Persian system notification without an open app", async () => {
  await push(() => ({ title: "عنوان", body: "متن", lang: "fa", url: "https://evil.test" }));
  expect(show).toHaveBeenCalledWith("عنوان", expect.objectContaining({ body: "متن", lang: "fa", dir: "rtl", tag: "session-reminder" }));
  expect(openWindow).not.toHaveBeenCalled();
});

test("malformed or empty push payloads still display a visible notification", async () => {
  await push(() => { throw new Error("Malformed JSON"); });
  await push(() => null);
  expect(show).toHaveBeenCalledTimes(2);
  expect(show).toHaveBeenLastCalledWith("Still on the clock?", expect.objectContaining({ lang: "en", dir: "ltr" }));
});

test("a notification click focuses the app and never uses an untrusted payload URL or admin tab", async () => {
  const focus = mock(async () => {});
  const navigate = mock(async (_path: string) => {});
  const adminNavigate = mock(async (_path: string) => {});
  windows = [
    { url: "https://omam.test/admin/", focus, navigate: adminNavigate },
    { url: "https://omam.test/profile", focus, navigate },
  ];
  const close = mock(() => {});
  let completion: Promise<unknown> = Promise.resolve();
  listeners.get("notificationclick")!({ notification: { close }, waitUntil: (promise) => { completion = promise; } });
  await completion;
  expect(close).toHaveBeenCalledTimes(1);
  expect(navigate).toHaveBeenCalledWith("/");
  expect(focus).toHaveBeenCalledTimes(1);
  expect(adminNavigate).not.toHaveBeenCalled();
  expect(openWindow).not.toHaveBeenCalled();
});

test("a notification click opens the app when all windows are closed", async () => {
  let completion: Promise<unknown> = Promise.resolve();
  listeners.get("notificationclick")!({ notification: { close: () => {} }, waitUntil: (promise) => { completion = promise; } });
  await completion;
  expect(openWindow).toHaveBeenCalledWith("/");
});
