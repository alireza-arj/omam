import { expect, test } from "bun:test";
import { createSyncQueue } from "./queue";

function deferred() {
  let resolve = (_value: boolean) => {};
  const promise = new Promise<boolean>((done) => { resolve = done; });
  return { promise, resolve };
}

test("changes arriving during a push are sent in one serialized follow-up", async () => {
  const first = deferred();
  let calls = 0;
  const queue = createSyncQueue(async () => ++calls === 1 ? first.promise : false);
  const initial = queue.request();
  const changed = queue.request();
  queue.request();
  expect(calls).toBe(1);
  first.resolve(false);
  await Promise.all([initial, changed]);
  expect(calls).toBe(2);
  queue.stop();
});

test("a backlog drains across batches without waiting for another action", async () => {
  let pending = 450;
  let calls = 0;
  const queue = createSyncQueue(async () => {
    calls++;
    pending = Math.max(0, pending - 200);
    return pending > 0;
  });
  await queue.request();
  expect(pending).toBe(0);
  expect(calls).toBe(3);
  await Bun.sleep(2100);
  expect(calls).toBe(3);
  queue.stop();
});

test("an offline push retries and a stopped account cancels further work", async () => {
  let calls = 0;
  const queue = createSyncQueue(async () => {
    if (++calls === 1) throw new Error("SERVER_UNREACHABLE");
    return false;
  });
  await expect(queue.request()).rejects.toThrow("SERVER_UNREACHABLE");
  await Bun.sleep(1100);
  expect(calls).toBe(2);
  queue.stop();
  await queue.request();
  expect(calls).toBe(2);

  const cancelled = createSyncQueue(async () => { calls++; throw new Error("offline"); });
  await expect(cancelled.request()).rejects.toThrow("offline");
  cancelled.stop();
  await Bun.sleep(1100);
  expect(calls).toBe(3);
});
