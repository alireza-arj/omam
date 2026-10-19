import { syncTransaction } from "../lib/sync-transaction";
import { Elysia } from "elysia";
import { syncRequestSchema, type SyncPushResultDto } from "@omam/contracts";
import { prisma } from "../lib/prisma";
import { authenticated } from "../lib/context";
import { ensureUserDefaultSettings, requireOrganization } from "../lib/auth";
import { parseInput } from "../lib/errors";
import { serializeSyncSession } from "../lib/serialize";
import { calculateSessionMinutes } from "../lib/time";
import { isSessionLocked } from "../lib/payroll";
import { publishSyncChange } from "../lib/sync-events";

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
    const { results, conflicts } = await syncTransaction(async (tx) => {
      const results: SyncPushResultDto[] = [];
      const conflicts: { clientId: string; sessionIds: string[] }[] = [];
      const ordered = [...payload.sessions].sort((a, b) => Number(Boolean(b.deletedAt)) - Number(Boolean(a.deletedAt)));
      for (const incoming of ordered) {
        const startAt = new Date(incoming.startAt);
        const endAt = incoming.endAt ? new Date(incoming.endAt) : null;
        const clientUpdatedAt = new Date(incoming.updatedAt);

        const existing = await tx.workSession.findUnique({
          where: { userId_clientId: { userId, clientId: incoming.clientId } },
        });

        if (existing && existing.organizationId !== organization.id) {
          results.push({ clientId: incoming.clientId, serverId: null, outcome: "rejected", reason: "TEAM_MISMATCH" });
          continue;
        }
        if (existing?.deletedAt && !incoming.deletedAt) {
          results.push({ clientId: incoming.clientId, serverId: existing.id, outcome: "skipped", reason: "SESSION_DELETED" });
          continue;
        }
        if (incoming.projectId && !(await tx.project.findFirst({ where: { id: incoming.projectId, organizationId: organization.id } }))) {
          results.push({ clientId: incoming.clientId, serverId: existing?.id ?? null, outcome: "rejected", reason: "TEAM_MISMATCH" });
          continue;
        }

        if (endAt && endAt.getTime() < startAt.getTime()) {
          results.push({
            clientId: incoming.clientId,
            serverId: existing?.id ?? null,
            outcome: "rejected",
            reason: "END_BEFORE_START",
          });
          continue;
        }

        const lockedMonth =
          (await isSessionLocked(organization.id, startAt, endAt, tx)) ??
          (existing ? await isSessionLocked(organization.id, existing.startAt, existing.endAt, tx) : null);

        if (lockedMonth) {
          results.push({
            clientId: incoming.clientId,
            serverId: existing?.id ?? null,
            outcome: "rejected",
            reason: "PAYROLL_LOCKED",
          });
          continue;
        }

        if (existing && existing.updatedAt.getTime() > clientUpdatedAt.getTime()) {
          results.push({
            clientId: incoming.clientId,
            serverId: existing.id,
            outcome: "skipped",
            reason: "SERVER_NEWER",
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

          await tx.workSession.update({
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

        if (incoming.deviceId && (incoming.source === "TIMER" || !endAt)) {
          const overlapping = await tx.workSession.findMany({ where: {
            organizationId: organization.id, userId, deletedAt: null,
            ...(existing ? { id: { not: existing.id } } : {}),
            ...(endAt ? { startAt: { lt: endAt } } : {}),
            AND: [{ OR: [{ endAt: null }, { endAt: { gt: startAt } }] }, { OR: [{ source: "TIMER" }, { endAt: null }] }],
          } });
          const others = overlapping.filter((row) => !row.deviceId || row.deviceId !== incoming.deviceId);
          if (others.length) {
            conflicts.push({ clientId: incoming.clientId, sessionIds: others.map((row) => row.id) });
            results.push({ clientId: incoming.clientId, serverId: existing?.id ?? null, outcome: "rejected", reason: "SESSION_CONFLICT" });
            continue;
          }
        }

        if (!endAt && await tx.workSession.findFirst({ where: {
          organizationId: organization.id, userId, endAt: null, deletedAt: null,
          ...(existing ? { id: { not: existing.id } } : {}),
        } })) {
          results.push({ clientId: incoming.clientId, serverId: existing?.id ?? null, outcome: "rejected", reason: "SESSION_ACTIVE" });
          continue;
        }

        if (!existing) {
          const created = await tx.workSession.create({
            data: {
              organizationId: organization.id,
              userId,
              clientId: incoming.clientId,
              deviceId: incoming.deviceId ?? null,
              deviceName: incoming.deviceName ?? null,
              projectId: incoming.projectId ?? null,
              startAt,
              endAt,
              durationMinutes,
              category: incoming.category,
              note: incoming.note ?? null,
              status,
              source: incoming.source ?? "SYNC",
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

        const updated = await tx.workSession.update({
          where: { id: existing.id },
          data: {
            deviceId: existing.deviceId ?? incoming.deviceId ?? null,
            deviceName: existing.deviceName ?? incoming.deviceName ?? null,
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

      if (results.some((result) => result.outcome === "applied" && result.serverId)) {
        await publishSyncChange({ organizationId: organization.id, userId, exceptSessionId: principal.sessionId }, tx);
      }
      return { results, conflicts };
    });

    const since = payload.since ? new Date(payload.since) : null;

    const [changed, settings, lockedPeriods] = await Promise.all([
      prisma.workSession.findMany({
        where: {
          userId,
          organizationId: organization.id,
          ...(since ? { OR: [{ updatedAt: { gt: since } }, { id: { in: [...results.filter((result) => result.serverId).map((result) => result.serverId!), ...conflicts.flatMap((entry) => entry.sessionIds)] } }] } : {}),
        },
        include: { project: true },
        orderBy: { updatedAt: "asc" },
      }),
      ensureUserDefaultSettings(userId).then(() =>
        prisma.appSettings.findUniqueOrThrow({ where: { userId } }),
      ),
      prisma.payrollPeriod.findMany({ where: { organizationId: organization.id, status: { in: ["LOCKED", "PAID"] } }, select: { month: true, from: true, to: true } }),
    ]);

    return {
      serverTime: serverTime.toISOString(),
      results,
      conflicts,
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
      lockedPeriods: lockedPeriods.map((period) => ({ month: period.month, from: period.from.toISOString(), to: period.to.toISOString() })),
    };
  });
