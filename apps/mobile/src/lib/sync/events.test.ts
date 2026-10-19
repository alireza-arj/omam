import { afterEach, expect, spyOn, test } from "bun:test";
import { connectSyncEvents, syncEventsUrl } from "./events";

class TestSocket {
  static instances: TestSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];
  closed = false;
  constructor(readonly url: string | URL) { TestSocket.instances.push(this); }
  send(value: string) { this.sent.push(value); }
  close() { this.closed = true; }
  receive(type: string) { this.onmessage?.({ data: JSON.stringify({ type }) }); }
}

afterEach(() => { TestSocket.instances = []; });

test("notification URLs preserve the API path and use secure sockets on HTTPS", () => {
  expect(syncEventsUrl("https://omam.ir/api/")).toBe("wss://omam.ir/api/sync/events");
  expect(syncEventsUrl("http://localhost:3001")).toBe("ws://localhost:3001/sync/events");
});

test("authentication stays out of the URL and only ready/change events trigger sync", () => {
  const constructor = spyOn(globalThis, "WebSocket").mockImplementation((url) => new TestSocket(url) as unknown as WebSocket);
  let syncs = 0;
  const connection = connectSyncEvents({ serverUrl: "https://omam.ir/api", token: "private-token", onSyncNeeded: () => { syncs++; } });
  try {
    const socket = TestSocket.instances[0]!;
    expect(String(socket.url)).not.toContain("private-token");
    socket.onopen?.();
    expect(JSON.parse(socket.sent[0]!)).toEqual({ type: "authenticate", token: "private-token" });
    socket.receive("ready");
    socket.receive("pong");
    expect(syncs).toBe(1);
    socket.receive("changed");
    socket.receive("unrecognized");
    expect(syncs).toBe(2);
  } finally {
    connection.close();
    constructor.mockRestore();
  }
});

test("a broken connection reconnects and ignores notifications from its old socket", async () => {
  const constructor = spyOn(globalThis, "WebSocket").mockImplementation((url) => new TestSocket(url) as unknown as WebSocket);
  let syncs = 0;
  const connection = connectSyncEvents({ serverUrl: "https://omam.ir/api", token: "token", onSyncNeeded: () => { syncs++; } });
  try {
    const first = TestSocket.instances[0]!;
    first.receive("ready");
    first.onerror?.();
    first.receive("changed");
    expect(syncs).toBe(1);
    await Bun.sleep(1100);
    expect(TestSocket.instances).toHaveLength(2);
    TestSocket.instances[1]!.receive("ready");
    expect(syncs).toBe(2);
    expect(first.closed).toBe(true);
  } finally {
    connection.close();
    constructor.mockRestore();
  }
});
