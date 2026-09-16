import { describe, expect, test } from "bun:test";
import { createBrowserDatabaseAccess, isDatabaseAccessConflict } from "./browser-database-access";

describe("browser database ownership", () => {
  test("keeps ownership across React unsubscribe and restart", async () => {
    let requests = 0;
    let released = false;
    const access = createBrowserDatabaseAccess({
      async request(_name, _options, callback) {
        requests++;
        await callback({});
        released = true;
      },
    });
    const observed: string[] = [];
    const unsubscribe = access.subscribe(() => observed.push(access.getSnapshot()));

    access.start();
    expect(access.getSnapshot()).toBe("ready");
    unsubscribe();
    access.start();
    await Promise.resolve();

    expect(requests).toBe(1);
    expect(released).toBe(false);
    expect(observed).toEqual(["ready"]);
  });

  test("queues a second tab and opens only after ownership is granted", async () => {
    let grant: ((lock: object) => Promise<void>) | undefined;
    const requests: { name: string; ifAvailable?: boolean }[] = [];
    const access = createBrowserDatabaseAccess({
      async request(name, options, callback) {
        requests.push({ name, ifAvailable: options.ifAvailable });
        if (options.ifAvailable) return callback(null);
        await new Promise<void>((resolve) => {
          grant = async (lock) => { await callback(lock); resolve(); };
        });
      },
    });

    access.start();
    expect(access.getSnapshot()).toBe("waiting");
    await Bun.sleep(0);
    expect(requests).toEqual([
      { name: "omam:expo-sqlite", ifAvailable: true },
      { name: "omam:expo-sqlite", ifAvailable: undefined },
    ]);
    expect(grant).toBeDefined();
    void grant!({});
    expect(access.getSnapshot()).toBe("ready");
  });

  test("does not open without safe storage coordination", async () => {
    const unsupported = createBrowserDatabaseAccess();
    unsupported.start();
    expect(unsupported.getSnapshot()).toBe("unavailable");

    const rejected = createBrowserDatabaseAccess({
      request() { throw new DOMException("Denied", "SecurityError"); },
    });
    rejected.start();
    await Bun.sleep(0);
    expect(rejected.getSnapshot()).toBe("unavailable");
  });

  test("recognizes serialized Expo access errors without masking other failures", () => {
    expect(isDatabaseAccessConflict(new Error("NoModificationAllowedError: Failed to execute 'createSyncAccessHandle'"))).toBe(true);
    expect(isDatabaseAccessConflict(new Error("Access Handles cannot be created if there is another open Access Handle"))).toBe(true);
    expect(isDatabaseAccessConflict(new Error("database disk image is malformed"))).toBe(false);
  });
});
