import { syncEventSchema } from "@omam/contracts";

export function syncEventsUrl(baseUrl: string) {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/sync/events`);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export function connectSyncEvents(options: {
  serverUrl: string;
  token: string;
  onSyncNeeded: () => void;
}) {
  let socket: WebSocket | undefined;
  let stopped = false;
  let attempts = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let heartbeat: ReturnType<typeof setTimeout> | undefined;

  function clearTimers() {
    clearTimeout(retry);
    clearTimeout(timeout);
    clearTimeout(heartbeat);
  }

  function ping() {
    heartbeat = setTimeout(() => {
      socket?.send(JSON.stringify({ type: "ping" }));
      timeout = setTimeout(reconnect, 10_000);
    }, 25_000);
  }

  function connect() {
    if (stopped) return;
    try {
      const current = new WebSocket(syncEventsUrl(options.serverUrl));
      socket = current;
      timeout = setTimeout(reconnect, 15_000);
      current.onopen = () => {
        if (current !== socket) return;
        current.send(JSON.stringify({ type: "authenticate", token: options.token }));
      };
      current.onmessage = (message) => {
        if (current !== socket || typeof message.data !== "string") return;
        let payload: unknown;
        try { payload = JSON.parse(message.data); } catch { return; }
        const event = syncEventSchema.safeParse(payload);
        if (!event.success) return;
        if (event.data.type === "ready" || event.data.type === "pong") {
          clearTimeout(timeout);
          clearTimeout(heartbeat);
          ping();
        }
        if (event.data.type === "ready") attempts = 0;
        if (event.data.type !== "pong") options.onSyncNeeded();
      };
      current.onerror = () => {
        if (current === socket) reconnect();
      };
      current.onclose = (event) => {
        if (current !== socket) return;
        if (event.code === 4401 || event.code === 4403) options.onSyncNeeded();
        reconnect();
      };
    } catch {
      reconnect();
    }
  }

  function reconnect(immediate = false) {
    clearTimers();
    const previous = socket;
    socket = undefined;
    previous?.close();
    if (stopped) return;
    const delay = immediate ? 0 : Math.min(60_000, 1_000 * 2 ** Math.min(attempts++, 6));
    retry = setTimeout(connect, delay);
  }

  connect();
  return {
    reconnect: () => reconnect(true),
    close() {
      stopped = true;
      reconnect();
    },
  };
}
