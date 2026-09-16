export type DatabaseAccessStatus = "loading" | "waiting" | "ready" | "unavailable";

type DatabaseLockManager = {
  request(
    name: string,
    options: { mode: "exclusive"; ifAvailable?: boolean },
    callback: (lock: object | null) => Promise<void>,
  ): Promise<void>;
};

export function createBrowserDatabaseAccess(locks?: DatabaseLockManager) {
  let status: DatabaseAccessStatus = "loading";
  let started = false;
  const listeners = new Set<() => void>();

  function update(next: DatabaseAccessStatus) {
    status = next;
    listeners.forEach((listener) => listener());
  }

  async function hold(lock: object | null) {
    if (!lock) {
      update("waiting");
      return;
    }
    update("ready");
    // Expo's file pool stays open after db.closeAsync(), until the document's worker exits.
    await new Promise<void>(() => {});
  }

  return {
    getSnapshot: () => status,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    start() {
      if (started) return;
      started = true;
      if (!locks) {
        update("unavailable");
        return;
      }
      // One lock covers the entire Expo SQLite file pool, not just one database name.
      async function acquire(manager: DatabaseLockManager) {
        await manager.request("omam:expo-sqlite", { mode: "exclusive", ifAvailable: true }, hold);
        if (status === "waiting") {
          await manager.request("omam:expo-sqlite", { mode: "exclusive" }, hold);
        }
      }
      void acquire(locks).catch(() => update("unavailable"));
    },
  };
}

type DatabaseAccessScope = typeof globalThis & {
  __omamBrowserDatabaseAccess?: ReturnType<typeof createBrowserDatabaseAccess>;
};

export function getBrowserDatabaseAccess() {
  const scope = globalThis as DatabaseAccessScope;
  // React remounts and Fast Refresh must reuse ownership rather than queue behind themselves.
  return scope.__omamBrowserDatabaseAccess ??= createBrowserDatabaseAccess(
    typeof navigator === "undefined" ? undefined : navigator.locks,
  );
}

export function isDatabaseAccessConflict(error: Error) {
  return /NoModificationAllowedError|createSyncAccessHandle|another open Access Handle/i.test(error.message);
}
