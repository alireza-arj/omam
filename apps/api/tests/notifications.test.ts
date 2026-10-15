import { afterAll, beforeAll, beforeEach, expect, spyOn, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { Elysia } from "elysia";
import webPush from "web-push";
import { prisma } from "../src/lib/prisma";
import { createAuthSession } from "../src/lib/auth";
import { errorHandler } from "../src/lib/context";
import { notificationRoutes } from "../src/routes/notifications";
import { REMINDER_INTERVAL_MS, sendDueSessionReminders } from "../src/lib/push-notifications";

if (!process.env.DATABASE_URL?.includes("/omam_desktop_")) throw new Error("Use test:desktop:isolated for notification integration tests");

const keys = webPush.generateVAPIDKeys();
const endpoint = `https://web.push.apple.com/test-${randomBytes(12).toString("hex")}`;
const input = { endpoint, keys: { p256dh: keys.publicKey, auth: randomBytes(16).toString("base64url") }, deviceId: "test-pwa", language: "en" };
const app = new Elysia().use(errorHandler).use(notificationRoutes);
const start = new Date(Date.now() - REMINDER_INTERVAL_MS);
let userId: string;
let organizationId: string;
let token: string;
let sessionId: string;
let authSessionId: string;
const send = spyOn(webPush, "sendNotification");

const call = (method: string, path: string, body?: unknown, authorization = token) => app.handle(new Request(`http://localhost/notifications${path}`, {
  method, headers: { "Content-Type": "application/json", ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
}));

beforeAll(async () => {
  process.env.WEB_PUSH_PUBLIC_KEY = keys.publicKey;
  process.env.WEB_PUSH_PRIVATE_KEY = keys.privateKey;
  process.env.WEB_PUSH_SUBJECT = "mailto:test@example.com";
  const id = randomBytes(10).toString("hex");
  const organization = await prisma.organization.create({ data: { name: "Push test", slug: `push-${id}` } });
  organizationId = organization.id;
  const user = await prisma.user.create({ data: { username: `push-${id}`, passwordHash: "unused-test-hash", memberships: { create: { organizationId } } } });
  userId = user.id;
  token = await createAuthSession(userId, "Push test", organizationId);
  authSessionId = (await prisma.authSession.findFirstOrThrow({ where: { userId } })).id;
  sessionId = (await prisma.workSession.create({ data: { organizationId, userId, deviceId: input.deviceId, startAt: start } })).id;
});

beforeEach(async () => {
  send.mockReset();
  send.mockResolvedValue({ statusCode: 201, body: "", headers: {} });
  await prisma.authSession.update({ where: { id: authSessionId }, data: { revokedAt: null, expiresAt: new Date(Date.now() + 86_400_000), organizationId } });
  await prisma.membership.update({ where: { organizationId_userId: { organizationId, userId } }, data: { status: "ACTIVE" } });
  await prisma.workSession.update({ where: { id: sessionId }, data: { endAt: null, deletedAt: null, status: "OPEN", deviceId: input.deviceId } });
  expect((await call("POST", "/subscription", input)).status).toBe(200);
  await prisma.pushSubscription.update({ where: { endpoint }, data: { lastSessionId: null, lastReminderAt: null } });
});

afterAll(async () => {
  send.mockRestore();
  await prisma.pushSubscription.updateMany({ where: { endpoint }, data: { deletedAt: new Date() } });
  await prisma.authSession.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
  await prisma.$disconnect();
});

test("notification routes require auth, validate endpoints and keys, and upsert one subscription", async () => {
  expect((await call("GET", "/configuration", undefined, "")).status).toBe(401);
  for (const target of ["http://localhost/push", "https://127.0.0.1/push", "https://fcm.googleapis.com.evil.test/push", "https://fcm.googleapis.com:8443/push"]) {
    expect((await call("POST", "/subscription", { ...input, endpoint: target })).status).toBe(422);
  }
  expect((await call("POST", "/subscription", { ...input, keys: { ...input.keys, auth: "invalid" } })).status).toBe(422);
  expect((await call("POST", "/subscription", input)).status).toBe(200);
  expect(await prisma.pushSubscription.count({ where: { endpoint } })).toBe(1);
  const configuration = await (await call("GET", "/configuration")).json() as { publicKey: string; privateKey?: string };
  expect(configuration.publicKey).toBe(keys.publicKey);
  expect(configuration.privateKey).toBeUndefined();
});

test("configuration can be absent without exposing a broken enabled state", async () => {
  const original = process.env.WEB_PUSH_PRIVATE_KEY;
  delete process.env.WEB_PUSH_PRIVATE_KEY;
  try {
    expect(await (await call("GET", "/configuration")).json()).toEqual({ publicKey: null });
    expect((await call("POST", "/subscription", input)).status).toBe(503);
  } finally { process.env.WEB_PUSH_PRIVATE_KEY = original; }
});

test("Web Push encrypts a valid request with the configured VAPID keys", () => {
  const request = webPush.generateRequestDetails({ endpoint, keys: input.keys }, "test", {
    vapidDetails: { publicKey: keys.publicKey, privateKey: keys.privateKey, subject: "mailto:test@example.com" },
    TTL: 300,
  });
  expect(request.method).toBe("POST");
  expect(request.headers["Content-Encoding"]).toBe("aes128gcm");
  expect(request.headers.Authorization).toContain("vapid ");
  expect(request.body?.length).toBeGreaterThan(0);
});

test("reminders wait two hours, repeat once per interval, and localize to Persian", async () => {
  await sendDueSessionReminders(new Date(start.getTime() + REMINDER_INTERVAL_MS - 1));
  expect(send).not.toHaveBeenCalled();
  const due = new Date(start.getTime() + REMINDER_INTERVAL_MS);
  await sendDueSessionReminders(due);
  expect(send).toHaveBeenCalledTimes(1);
  await sendDueSessionReminders(new Date(due.getTime() + 60_000));
  expect(send).toHaveBeenCalledTimes(1);
  expect((await call("POST", "/subscription", { ...input, language: "fa" })).status).toBe(200);
  await sendDueSessionReminders(new Date(due.getTime() + REMINDER_INTERVAL_MS));
  expect(send).toHaveBeenCalledTimes(2);
  const payload = JSON.parse(String(send.mock.calls[1]?.[1])) as { lang: string; dir: string; title: string };
  expect(payload.lang).toBe("fa");
  expect(payload.dir).toBe("rtl");
  expect(payload.title).toBe("هنوز مشغول کارید؟");
});

test("concurrent API workers claim a reminder only once", async () => {
  const due = new Date(start.getTime() + REMINDER_INTERVAL_MS);
  await Promise.all([sendDueSessionReminders(due), sendDueSessionReminders(due)]);
  expect(send).toHaveBeenCalledTimes(1);
});

test("completed, deleted, and other-device sessions do not trigger reminders", async () => {
  await prisma.workSession.update({ where: { id: sessionId }, data: { endAt: new Date(), status: "COMPLETED" } });
  await sendDueSessionReminders();
  await prisma.workSession.update({ where: { id: sessionId }, data: { endAt: null, status: "OPEN", deletedAt: new Date() } });
  await sendDueSessionReminders();
  await prisma.workSession.update({ where: { id: sessionId }, data: { deletedAt: null, deviceId: "another-device" } });
  await sendDueSessionReminders();
  expect(send).not.toHaveBeenCalled();
});

test("revoked and expired logins, suspended members, and deselected teams receive no reminders", async () => {
  await prisma.authSession.update({ where: { id: authSessionId }, data: { revokedAt: new Date() } });
  await sendDueSessionReminders();
  await prisma.authSession.update({ where: { id: authSessionId }, data: { revokedAt: null, expiresAt: new Date(0) } });
  await sendDueSessionReminders();
  await prisma.authSession.update({ where: { id: authSessionId }, data: { expiresAt: new Date(Date.now() + 86_400_000) } });
  await prisma.membership.update({ where: { organizationId_userId: { organizationId, userId } }, data: { status: "SUSPENDED" } });
  await sendDueSessionReminders();
  await prisma.membership.update({ where: { organizationId_userId: { organizationId, userId } }, data: { status: "ACTIVE" } });
  const otherTeam = await prisma.organization.create({ data: { name: "Other push team", slug: `other-push-${randomBytes(8).toString("hex")}` } });
  await prisma.authSession.update({ where: { id: authSessionId }, data: { organizationId: otherTeam.id } });
  await sendDueSessionReminders();
  expect(send).not.toHaveBeenCalled();
});

test("only the owning login can remove a subscription and removal is a soft delete", async () => {
  const otherToken = await createAuthSession(userId, "Other login", organizationId);
  expect((await call("DELETE", "/subscription", { endpoint }, otherToken)).status).toBe(200);
  expect((await prisma.pushSubscription.findUniqueOrThrow({ where: { endpoint } })).deletedAt).toBeNull();
  expect((await call("DELETE", "/subscription", { endpoint })).status).toBe(200);
  expect((await prisma.pushSubscription.findUniqueOrThrow({ where: { endpoint } })).deletedAt).not.toBeNull();
  await sendDueSessionReminders();
  expect(send).not.toHaveBeenCalled();
});

test("expired push endpoints are soft-deleted and temporary delivery errors can retry", async () => {
  send.mockRejectedValueOnce(new webPush.WebPushError("Gone", 410, {}, "", endpoint));
  await sendDueSessionReminders();
  expect((await prisma.pushSubscription.findUniqueOrThrow({ where: { endpoint } })).deletedAt).not.toBeNull();
  expect((await call("POST", "/subscription", input)).status).toBe(200);
  await prisma.pushSubscription.update({ where: { endpoint }, data: { lastReminderAt: null, lastSessionId: null } });
  send.mockRejectedValueOnce(new Error("Temporary network failure"));
  await sendDueSessionReminders();
  expect((await prisma.pushSubscription.findUniqueOrThrow({ where: { endpoint } })).lastReminderAt).toBeNull();
  await sendDueSessionReminders();
  expect(send).toHaveBeenCalledTimes(3);
});
