import { Elysia } from "elysia";
import { pushSubscriptionInputSchema, removePushSubscriptionInputSchema } from "@omam/contracts";
import { prisma } from "../lib/prisma";
import { authenticated } from "../lib/context";
import { requireOrganization } from "../lib/auth";
import { AppError, parseInput } from "../lib/errors";
import { pushConfiguration } from "../lib/push-notifications";

export const notificationRoutes = new Elysia({ prefix: "/notifications" })
  .use(authenticated)
  .get("/configuration", () => ({ publicKey: pushConfiguration()?.publicKey ?? null }))
  .post("/subscription", async ({ principal, body }) => {
    const input = parseInput(pushSubscriptionInputSchema, body);
    const organization = requireOrganization(principal);
    if (!pushConfiguration()) throw new AppError(503, "Push is not configured.", "PUSH_NOT_CONFIGURED");
    const data = {
      authSessionId: principal.sessionId, organizationId: organization.id, deviceId: input.deviceId,
      p256dh: input.keys.p256dh, auth: input.keys.auth, language: input.language, deletedAt: null,
    };
    const existing = await prisma.pushSubscription.findUnique({ where: { endpoint: input.endpoint } });
    await prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: { endpoint: input.endpoint, ...data },
      update: {
        ...data,
        ...(existing?.authSessionId !== principal.sessionId || existing?.deviceId !== input.deviceId || existing?.organizationId !== organization.id
          ? { lastSessionId: null, lastReminderAt: null } : {}),
      },
    });
    return { ok: true };
  })
  .delete("/subscription", async ({ principal, body }) => {
    const input = parseInput(removePushSubscriptionInputSchema, body);
    await prisma.pushSubscription.updateMany({
      where: { endpoint: input.endpoint, authSessionId: principal.sessionId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  });
