import type { Prisma } from "@prisma/client";
import { Elysia } from "elysia";
import { asCalendarSystem } from "@omam/calendar";
import {
  createSessionInputSchema,
  timesheetQuerySchema,
} from "@omam/contracts";
import { prisma } from "../lib/prisma";
import { authenticated } from "../lib/context";
import { requireOrganization, requireRole } from "../lib/auth";
import { conflict, invalid, notFound, parseInput } from "../lib/errors";
import { serializeSession } from "../lib/serialize";
import { calculateSessionMinutes, monthWindow } from "../lib/time";
import { isMonthLocked } from "../lib/payroll";
import { recordAudit } from "../lib/audit";

const include = { project: true, user: true } as const;

async function loadOrgSession(organizationId: string, id: string) {
  const session = await prisma.workSession.findFirst({
    where: { id, organizationId, deletedAt: null },
    include,
  });

  if (!session) {
    throw notFound("Session not found.");
  }

  return session;
}

async function assertNotPaidOut(organizationId: string, ...dates: (Date | null)[]) {
  for (const date of dates) {
    if (!date) continue;

    const lockedMonth = await isMonthLocked(organizationId, date);

    if (lockedMonth) {
      throw conflict(
        `Payroll for ${lockedMonth} is closed, so that time cannot be changed.`,
        "PAYROLL_LOCKED",
      );
    }
  }
}

/** Read and edit of anyone's time. Everything here is manager-only. */
export const timesheetRoutes = new Elysia({ prefix: "/timesheets" })
  .use(authenticated)

  .get("/", async ({ principal, query }) => {
    requireRole(principal, "MANAGER");

    const organization = requireOrganization(principal);
    const filters = parseInput(timesheetQuerySchema, query);
    const calendar = asCalendarSystem(filters.calendar ?? organization.calendar);
    const window = monthWindow(filters.month, calendar);

    const search = filters.search;
    const where: Prisma.WorkSessionWhereInput = {
      organizationId: organization.id,
      deletedAt: null,
      startAt: { gte: window.from, lte: window.to },
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(search
        ? {
            OR: [
              { note: { contains: search, mode: "insensitive" } },
              { user: { nickname: { contains: search, mode: "insensitive" } } },
              { user: { username: { contains: search, mode: "insensitive" } } },
              { project: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const { entries, total, groups, page } = await prisma.$transaction(
      async (tx) => {
        const total = await tx.workSession.count({ where });
        const page = Math.min(filters.page, Math.max(1, Math.ceil(total / filters.pageSize)));
        const entries = await tx.workSession.findMany({
          where,
          include,
          orderBy: [{ startAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * filters.pageSize,
          take: filters.pageSize,
        });
        const groups = await tx.workSession.groupBy({
          by: ["status"],
          where,
          _sum: { durationMinutes: true },
        });
        return { entries, total, groups, page };
      },
      { isolationLevel: "RepeatableRead" },
    );
    const totals = { completedMinutes: 0 };
    for (const group of groups) {
      const minutes = group._sum.durationMinutes ?? 0;
      if (group.status === "COMPLETED") totals.completedMinutes += minutes;
    }

    return {
      month: window.month,
      calendar,
      total,
      page,
      pageSize: filters.pageSize,
      totals,
      entries: entries.map((entry) => ({
        ...serializeSession(entry),
        username: entry.user.username,
        nickname: entry.user.nickname,
        avatarUrl: entry.user.avatarUrl,
      })),
    };
  })

  .patch("/:id", async ({ principal, params, body }) => {
    requireRole(principal, "MANAGER");

    const organization = requireOrganization(principal);
    const payload = parseInput(createSessionInputSchema, body);
    const session = await loadOrgSession(organization.id, params.id);
    const startAt = new Date(payload.startAt);
    const endAt = payload.endAt ? new Date(payload.endAt) : null;

    if (endAt && endAt.getTime() < startAt.getTime()) {
      throw invalid("The end time cannot be before the start time.");
    }

    await assertNotPaidOut(organization.id, session.startAt, startAt, endAt);

    const updated = await prisma.workSession.update({
      where: { id: session.id },
      data: {
        startAt,
        endAt,
        durationMinutes: endAt ? calculateSessionMinutes({ startAt, endAt }) : 0,
        category: payload.category,
        note: payload.note ?? null,
        projectId: payload.projectId ?? null,
        source: "ADMIN",
        status: endAt ? "COMPLETED" : "OPEN",
      },
      include,
    });

    await recordAudit({
      organizationId: organization.id,
      actorId: principal.user.id,
      action: "timesheet.edited",
      targetType: "session",
      targetId: session.id,
      metadata: { username: session.user.username },
    });

    return serializeSession(updated);
  })

  .delete("/:id", async ({ principal, params }) => {
    requireRole(principal, "MANAGER");

    const organization = requireOrganization(principal);
    const session = await loadOrgSession(organization.id, params.id);

    await assertNotPaidOut(organization.id, session.startAt);

    await prisma.workSession.update({
      where: { id: session.id },
      data: { deletedAt: new Date() },
    });

    await recordAudit({
      organizationId: organization.id,
      actorId: principal.user.id,
      action: "timesheet.deleted",
      targetType: "session",
      targetId: session.id,
      metadata: { username: session.user.username, minutes: session.durationMinutes },
    });

    return { ok: true };
  });
