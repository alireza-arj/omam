import { Elysia } from "elysia";
import { syncRequestSchema, type SyncPushResultDto } from "@omam/contracts";
import { prisma } from "../lib/prisma";
import { authenticated } from "../lib/context";
import { ensureUserDefaultSettings, requireOrganization } from "../lib/auth";
import { parseInput } from "../lib/errors";
import { serializeSyncSession } from "../lib/serialize";
import { calculateSessionMinutes } from "../lib/time";
import { isMonthLocked } from "../lib/payroll";

/**
 * One round trip for the offline app: it sends everything it changed since the
 * last sync and receives everything the server changed, including deletions.
 *
 * Conflicts use the newer updatedAt; a locked payroll month always wins.
 */
export const syncRoutes = new Elysia({ prefix: "/sync" })
  .use(authenticated)

  .post("/", async ({ principal, body }) => {
    const organization = requireOrganization(principal);
    const payload = parseInput(syncRequestSchema, body);
    const userId = principal.user.id;

    // Stamped before the read so a row written mid-request is picked up by the
    // next sync instead of being skipped forever.
    const serverTime = new Date();
    const results: SyncPushResultDto[] = [];
    const lockedMonths = new Map<string, string | null>();

    async function lockedMonthFor(date: Date) {
      // Keyed by day, not by Gregorian month: a Jalali payroll month starts
      // mid-month, so two dates in one Gregorian month can fall on either side
      // of a lock.
      const key = date.toISOString().slice(0, 10);

      if (!lockedMonths.has(key)) {
        lockedMonths.set(key, await isMonthLocked(organization.id, date));
      }

      return lockedMonths.get(key) ?? null;
    }

    for (const incoming of payload.sessions) {
      const startAt = new Date(incoming.startAt);
      const endAt = incoming.endAt ? new Date(incoming.endAt) : null;
      const clientUpdatedAt = new Date(incoming.updatedAt);

      const existing = await prisma.workSession.findUnique({
        where: { userId_clientId: { userId, clientId: incoming.clientId } },
      });

      if (endAt && endAt.getTime() < startAt.getTime()) {
        results.push({
          clientId: incoming.clientId,
          serverId: existing?.id ?? null,
          outcome: "rejected",
          reason: "The end time is before the start time.",
        });
        continue;
      }

      const lockedMonth =
        (await lockedMonthFor(startAt)) ??
        (existing ? await lockedMonthFor(existing.startAt) : null);

      if (lockedMonth) {
        results.push({
          clientId: incoming.clientId,
          serverId: existing?.id ?? null,
          outcome: "rejected",
          reason: `Payroll for ${lockedMonth} is closed.`,
        });
        continue;
      }

      if (existing && existing.updatedAt.getTime() > clientUpdatedAt.getTime()) {
        results.push({
          clientId: incoming.clientId,
          serverId: existing.id,
          outcome: "skipped",
          reason: "The server has a newer version of this session.",
        });
        continue;
      }

      if (incoming.deletedAt) {
        if (!existing) {
          // Deleted before it ever reached the server: nothing to do.
          results.push({
            clientId: incoming.clientId,
            serverId: null,
            outcome: "applied",
            reason: null,
          });
          continue;
        }

        await prisma.workSession.update({
          where: { id: existing.id },
          data: { deletedAt: new Date(incoming.deletedAt) },
        });

        results.push({
          clientId: incoming.clientId,
          serverId: existing.id,
          outcome: "applied",
          reason: null,
        });
        continue;
      }

      const durationMinutes = endAt ? calculateSessionMinutes({ startAt, endAt }) : 0;
      const status = endAt ? ("COMPLETED" as const) : ("OPEN" as const);

      if (!existing) {
        const created = await prisma.workSession.create({
          data: {
            organizationId: organization.id,
            userId,
            clientId: incoming.clientId,
            projectId: incoming.projectId ?? null,
            startAt,
            endAt,
            durationMinutes,
            category: incoming.category,
            note: incoming.note ?? null,
            status,
            source: "SYNC",
          },
        });

        results.push({
          clientId: incoming.clientId,
          serverId: created.id,
          outcome: "applied",
          reason: null,
        });
        continue;
      }

      const updated = await prisma.workSession.update({
        where: { id: existing.id },
        data: {
          startAt,
          endAt,
          durationMinutes,
          category: incoming.category,
          note: incoming.note ?? null,
          projectId: incoming.projectId ?? existing.projectId,
          deletedAt: null,
          status,
        },
      });

      results.push({
        clientId: incoming.clientId,
        serverId: updated.id,
        outcome: "applied",
        reason: null,
      });
    }

    const since = payload.since ? new Date(payload.since) : null;

    const [changed, settings] = await Promise.all([
      prisma.workSession.findMany({
        where: {
          userId,
          organizationId: organization.id,
          ...(since ? { updatedAt: { gt: since } } : {}),
        },
        include: { project: true },
        orderBy: { updatedAt: "asc" },
        take: 1000,
      }),
      ensureUserDefaultSettings(userId).then(() =>
        prisma.appSettings.findUniqueOrThrow({ where: { userId } }),
      ),
    ]);

    return {
      serverTime: serverTime.toISOString(),
      results,
      sessions: changed.map(serializeSyncSession),
      settings: {
        hourlyRate: settings.hourlyRate,
        currency: settings.currency,
        monthlyGoalHours: settings.monthlyGoalHours,
        calendar: settings.calendar,
        language: settings.language,
      },
      organization: {
        id: organization.id,
        name: organization.name,
      },
    };
  });
