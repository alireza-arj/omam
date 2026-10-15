import { beforeAll, beforeEach, expect, mock, test } from "bun:test";
import { runInNewContext } from "node:vm";

type WorkerEvent = {
  data?: { json: () => unknown }; notification?: { close: () => void };
  waitUntil: (operation: Promise<unknown>) => void;
};
const listeners = new Map<string, (event: WorkerEvent) => void>();
const show = mock(async () => {});
const openWindow = mock(async () => {});
let windows: { url: string; focus: () => Promise<void>; navigate: (path: string) => Promise<void> }[] = [];
let worker = "";

beforeAll(async () => {
  const result = await Bun.build({ entrypoints: [import.meta.dir + "/service-worker.ts"], target: "browser" });
  expect(result.success).toBe(true);
  worker = await result.outputs[0]!.text();
});

beforeEach(() => {
  listeners.clear(); show.mockClear(); openWindow.mockClear(); windows = [];
  runInNewContext(worker, {
    URL,
    self: {
      location: { origin: "https://omam.test", pathname: "/sw.js" },
      registration: { showNotification: show },
      clients: { matchAll: async () => windows, openWindow },
      addEventListener: (kind: string, handler: (event: WorkerEvent) => void) => listeners.set(kind, handler),
    },
  });
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
