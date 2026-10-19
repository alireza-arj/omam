export function createSyncQueue(sync: () => Promise<boolean>) {
  let requested = false;
  let stopped = false;
  let running: Promise<void> | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;

  function drain(): Promise<void> {
    if (running) return running;
    running = (async () => {
      while (requested && !stopped) {
        requested = false;
        const more = await sync();
        requested = requested || more;
        failures = 0;
      }
    })().catch((cause: unknown) => {
      if (!stopped) {
        requested = true;
        const delay = Math.min(60_000, 1_000 * 2 ** Math.min(failures++, 6));
        retry = setTimeout(() => { void drain().catch(() => undefined); }, delay);
      }
      throw cause;
    }).finally(() => { running = null; });
    return running;
  }

  return {
    request() {
      if (stopped) return Promise.resolve();
      requested = true;
      clearTimeout(retry);
      return drain();
    },
    stop() {
      stopped = true;
      requested = false;
      clearTimeout(retry);
    },
  };
}

export type SyncQueue = ReturnType<typeof createSyncQueue>;
