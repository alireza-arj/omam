import webPush from "web-push";
import { createTranslator, directionOf } from "@omam/i18n";
import { prisma } from "./prisma";

export const REMINDER_INTERVAL_MS = 2 * 60 * 60 * 1000;

export function pushConfiguration() {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
  const subject = process.env.WEB_PUSH_SUBJECT?.trim();
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

export function reminderDue(startAt: Date, sessionId: string, lastSessionId: string | null, lastReminderAt: Date | null, now: Date) {
  const previous = lastSessionId === sessionId ? lastReminderAt?.getTime() ?? 0 : 0;
  return now.getTime() - Math.max(startAt.getTime(), previous) >= REMINDER_INTERVAL_MS;
}

export async function sendDueSessionReminders(now = new Date()) {
  const configuration = pushConfiguration();
  if (!configuration) return;
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { deletedAt: null, authSession: { revokedAt: null, expiresAt: { gt: now } } },
    include: { authSession: { include: { user: { include: { memberships: { where: { status: "ACTIVE" } } } } } } },
  });
  for (const subscription of subscriptions) {
    const auth = subscription.authSession;
    if (auth.organizationId && auth.organizationId !== subscription.organizationId) continue;
    if (!auth.user.memberships.some((membership) => membership.organizationId === subscription.organizationId)) continue;
    const session = await prisma.workSession.findFirst({
      where: {
        userId: auth.userId, organizationId: subscription.organizationId, deviceId: subscription.deviceId,
        status: "OPEN", endAt: null, deletedAt: null,
      },
      orderBy: { startAt: "desc" },
    });
    if (!session || !reminderDue(session.startAt, session.id, subscription.lastSessionId, subscription.lastReminderAt, now)) continue;
    const claim = await prisma.pushSubscription.updateMany({
      where: { id: subscription.id, deletedAt: null, updatedAt: subscription.updatedAt },
      data: { lastSessionId: session.id, lastReminderAt: now },
    });
    if (!claim.count) continue;
    const t = createTranslator(subscription.language);
    try {
      await webPush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, JSON.stringify({
        title: t("today.reminderTitle"), body: t("today.reminderBody"),
        kind: "session-reminder", lang: subscription.language, dir: directionOf(subscription.language),
      }), {
        vapidDetails: configuration, TTL: 300, timeout: 10_000, topic: "session-reminder",
      });
    } catch (error) {
      if (error instanceof webPush.WebPushError && [404, 410].includes(error.statusCode)) {
        await prisma.pushSubscription.updateMany({ where: { id: subscription.id, lastReminderAt: now }, data: { deletedAt: now } });
      } else {
        await prisma.pushSubscription.updateMany({
          where: { id: subscription.id, lastReminderAt: now },
          data: { lastSessionId: subscription.lastSessionId, lastReminderAt: subscription.lastReminderAt },
        });
        console.error("[push] reminder delivery failed", error instanceof webPush.WebPushError ? error.statusCode : "DELIVERY_FAILED");
      }
    }
  }
}

export function startSessionReminderWorker() {
  if (!pushConfiguration()) return;
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await sendDueSessionReminders(); }
    catch { console.error("[push] reminder scan failed"); }
    finally { running = false; }
  };
  void run();
  const interval = setInterval(() => { void run(); }, 60_000);
  interval.unref();
}
