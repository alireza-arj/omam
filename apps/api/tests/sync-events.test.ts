import { afterAll, beforeAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { syncEventSchema, syncResponseSchema, type SyncSessionInputDto } from "@omam/contracts";
import { prisma } from "../src/lib/prisma";
import { createAuthSession } from "../src/lib/auth";
import { publishSyncChange } from "../src/lib/sync-events";
import { syncEventsUrl } from "../../mobile/src/lib/sync/events";

if (!process.env.DATABASE_URL?.includes("/omam_desktop_")) throw new Error("Use test:desktop:isolated for sync event integration tests");

const base = process.env.SMOKE_API_URL!;
const replica = process.env.SMOKE_REPLICA_URL!;
const sockets: WebSocket[] = [];
let phone: string;
let mac: string;
let anotherTeam: string;
let anotherUser: string;
let organizationId: string;

async function waitUntil(check: () => boolean) {
  const deadline = Date.now() + 5000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for a sync event");
    await Bun.sleep(10);
  }
}

function connect(token: string | null, serverUrl = base) {
  const socket = new WebSocket(syncEventsUrl(serverUrl));
  sockets.push(socket);
  const events: string[] = [];
  const closed = { code: 0 };
  socket.onopen = () => socket.send(JSON.stringify(token ? { type: "authenticate", token } : { type: "ping" }));
  socket.onmessage = (message) => { events.push(syncEventSchema.parse(JSON.parse(String(message.data))).type); };
  socket.onclose = (event) => { closed.code = event.code; };
  return { socket, events, closed, changes: () => events.filter((event) => event === "changed").length };
}

async function request(path: string, token: string, body: unknown, method = "POST", serverUrl = base) {
  const response = await fetch(serverUrl + path, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json() as Promise<unknown>;
}

const sync = async (token: string, sessions: SyncSessionInputDto[] = [], since: string | null = null, serverUrl = base) =>
  syncResponseSchema.parse(await request("/sync", token, { sessions, since }, "POST", serverUrl));

beforeAll(async () => {
  if (!base || !replica) throw new Error("The isolated runner must start both API replicas");
  const id = randomUUID();
  const organization = await prisma.organization.create({ data: { name: "Live sync", slug: `live-${id}`, calendar: "GREGORIAN" } });
  organizationId = organization.id;
  const second = await prisma.organization.create({ data: { name: "Other team", slug: `other-${id}` } });
  const user = await prisma.user.create({ data: { username: `live-${id}`, passwordHash: "unused-test-hash", memberships: { create: [
    { organizationId: organization.id, role: "OWNER" }, { organizationId: second.id },
  ] } } });
  const other = await prisma.user.create({ data: { username: `other-${id}`, passwordHash: "unused-test-hash", memberships: { create: { organizationId: organization.id } } } });
  phone = await createAuthSession(user.id, "Phone", organization.id);
  mac = await createAuthSession(user.id, "Mac", organization.id);
  anotherTeam = await createAuthSession(user.id, "Other team", second.id);
  anotherUser = await createAuthSession(other.id, "Other member", organization.id);
});

afterAll(async () => {
  for (const socket of sockets) socket.close();
  await prisma.$disconnect();
});

test("live notifications cross API replicas, stay scoped, and preserve offline catch-up and payroll locks", async () => {
  const invalid = connect("invalid-token");
  const anonymous = connect(null);
  await waitUntil(() => !!invalid.closed.code && !!anonymous.closed.code);
  expect(invalid.closed.code).toBe(4401);
  expect(anonymous.closed.code).toBe(4401);
  expect(invalid.events).toEqual([]);

  const onPhone = connect(phone);
  const onMac = connect(mac, replica);
  const otherTeam = connect(anotherTeam, replica);
  const otherMember = connect(anotherUser, replica);
  await waitUntil(() => [onPhone, onMac, otherTeam, otherMember].every((connection) => connection.events.includes("ready")));
  const initial = await sync(mac, [], null, replica);
  await Bun.sleep(100);
  expect(onMac.changes()).toBe(0);
  await expect(prisma.$transaction(async (tx) => {
    await publishSyncChange({ organizationId }, tx);
    throw new Error("ROLLBACK");
  })).rejects.toThrow("ROLLBACK");
  await Bun.sleep(100);
  expect(onMac.changes()).toBe(0);

  const session: SyncSessionInputDto = {
    clientId: "live-phone-session", deviceId: "live-phone", source: "TIMER", category: "REMOTE",
    startAt: "2026-07-05T09:00:00.000Z", endAt: null, updatedAt: new Date().toISOString(),
  };
  await sync(phone, [session]);
  await waitUntil(() => onMac.changes() === 1);
  const running = await sync(mac, [], initial.serverTime, replica);
  expect(running.sessions.find((row) => row.clientId === session.clientId)?.status).toBe("OPEN");
  expect(onPhone.changes()).toBe(0);
  expect(otherTeam.changes()).toBe(0);
  expect(otherMember.changes()).toBe(0);

  const stopped = { ...session, endAt: "2026-07-05T17:00:00.000Z", updatedAt: new Date().toISOString() };
  await sync(mac, [stopped], running.serverTime, replica);
  await waitUntil(() => onPhone.changes() === 1);
  expect((await sync(phone)).sessions.find((row) => row.clientId === session.clientId)?.durationMinutes).toBe(480);

  const remoteId = running.sessions.find((row) => row.clientId === session.clientId)!.id;
  await request(`/timesheets/${remoteId}`, phone, { ...stopped, note: "Edited in the panel" }, "PATCH");
  await waitUntil(() => onMac.changes() === 2);
  const edited = await sync(mac, [], running.serverTime, replica);
  expect(edited.sessions.find((row) => row.id === remoteId)?.note).toBe("Edited in the panel");

  onMac.socket.close();
  await waitUntil(() => !!onMac.closed.code);
  await request(`/timesheets/${remoteId}`, phone, {}, "DELETE");
  const reconnected = connect(mac, replica);
  await waitUntil(() => reconnected.events.includes("ready"));
  const catchUp = await sync(mac, [], edited.serverTime, replica);
  expect(catchUp.sessions.find((row) => row.id === remoteId)?.deletedAt).toBeTruthy();

  const period = await request("/payroll/periods", phone, { month: "2026-07", calendar: "GREGORIAN" }) as { period: { id: string } };
  await request(`/payroll/periods/${period.period.id}`, phone, { status: "LOCKED" }, "PATCH");
  await waitUntil(() => reconnected.changes() === 1 && otherMember.changes() === 1);
  const locked = await sync(mac, [{ ...stopped, updatedAt: new Date().toISOString() }], catchUp.serverTime, replica);
  expect(locked.results[0]?.outcome).not.toBe("applied");
  expect(locked.lockedPeriods?.some((row) => row.month === "2026-07")).toBe(true);
  expect(otherTeam.changes()).toBe(0);

  const beforeHeartbeat = reconnected.changes();
  reconnected.socket.send(JSON.stringify({ type: "ping" }));
  await waitUntil(() => reconnected.events.includes("pong"));
  expect(reconnected.changes()).toBe(beforeHeartbeat);

  await request("/team/select", anotherTeam, { organizationId });
  otherTeam.socket.send(JSON.stringify({ type: "ping" }));
  await waitUntil(() => !!otherTeam.closed.code);
  expect(otherTeam.closed.code).toBe(4403);

  await request("/auth/logout", mac, {});
  reconnected.socket.send(JSON.stringify({ type: "ping" }));
  await waitUntil(() => !!reconnected.closed.code);
  expect(reconnected.closed.code).toBe(4401);
}, 20_000);
