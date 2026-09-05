import { Elysia } from "elysia";
import { asCalendarSystem } from "@omam/calendar";
import {
  bulkReviewInputSchema,
  createSessionInputSchema,
  reviewSessionInputSchema,
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

/** Review and edit of anyone's time. Everything here is manager-only. */
export const timesheetRoutes = new Elysia({ prefix: "/timesheets" })
  .use(authenticated)

  .get("/", async ({ principal, query }) => {
    requireRole(principal, "MANAGER");

    const organization = requireOrganization(principal);
    const filters = parseInput(timesheetQuerySchema, query);
    const calendar = asCalendarSystem(filters.calendar ?? organization.calendar);
    const window = monthWindow(filters.month, calendar);

    const entries = await prisma.workSession.findMany({
      where: {
        organizationId: organization.id,
        deletedAt: null,
        startAt: { gte: window.from, lte: window.to },
        ...(filters.userId ? { userId: filters.userId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
      },
      include,
      orderBy: { startAt: "desc" },
      take: 2000,
    });

    const totals = { approvedMinutes: 0, pendingMinutes: 0, rejectedMinutes: 0 };

    for (const entry of entries) {
      if (entry.status === "APPROVED") totals.approvedMinutes += entry.durationMinutes;
      else if (entry.status === "REJECTED") totals.rejectedMinutes += entry.durationMinutes;
      else totals.pendingMinutes += entry.durationMinutes;
    }

    return {
      month: window.month,
      calendar,
      totals,
      entries: entries.map((entry) => ({
        ...serializeSession(entry),
        username: entry.user.username,
        nickname: entry.user.nickname,
        avatarUrl: entry.user.avatarUrl,
      })),
    };
  })

  .post("/:id/approve", async ({ principal, params, body }) => {
    requireRole(principal, "MANAGER");

    const organization = requireOrganization(principal);
    const payload = parseInput(reviewSessionInputSchema, body ?? {});
    const session = await loadOrgSession(organization.id, params.id);

    if (!session.endAt) {
      throw invalid("A running session cannot be approved yet.");
    }

    await assertNotPaidOut(organization.id, session.startAt);

    const updated = await prisma.workSession.update({
      where: { id: session.id },
      data: {
        status: "APPROVED",
        approvedById: principal.user.id,
        approvedAt: new Date(),
        reviewNote: payload.reviewNote ?? null,
      },
      include,
    });

    await recordAudit({
      organizationId: organization.id,
      actorId: principal.user.id,
      action: "timesheet.approved",
      targetType: "session",
      targetId: session.id,
      metadata: { username: session.user.username, minutes: session.durationMinutes },
    });

    return serializeSession(updated);
  })

  .post("/:id/reject", async ({ principal, params, body }) => {
    requireRole(principal, "MANAGER");

    const organization = requireOrganization(principal);
    const payload = parseInput(reviewSessionInputSchema, body ?? {});
    const session = await loadOrgSession(organization.id, params.id);

    await assertNotPaidOut(organization.id, session.startAt);

    const updated = await prisma.workSession.update({
      where: { id: session.id },
      data: {
        status: "REJECTED",
        approvedById: principal.user.id,
        approvedAt: new Date(),
        reviewNote: payload.reviewNote ?? null,
      },
      include,
    });

    await recordAudit({
      organizationId: organization.id,
      actorId: principal.user.id,
      action: "timesheet.rejected",
      targetType: "session",
      targetId: session.id,
      metadata: { username: session.user.username, reason: payload.reviewNote ?? null },
    });

    return serializeSession(updated);
  })

  /** One approval for a whole month of one member — the common case. */
  .post("/bulk-review", async ({ principal, body }) => {
    requireRole(principal, "MANAGER");

    const organization = requireOrganization(principal);
    const payload = parseInput(bulkReviewInputSchema, body);

    const sessions = await prisma.workSession.findMany({
      where: {
        id: { in: payload.sessionIds },
        organizationId: organization.id,
        deletedAt: null,
        endAt: { not: null },
      },
      select: { id: true, startAt: true },
    });

    if (!sessions.length) {
      throw invalid("None of those sessions can be reviewed.");
    }

    for (const session of sessions) {
      await assertNotPaidOut(organization.id, session.startAt);
    }

    const status = payload.action === "APPROVE" ? "APPROVED" : "REJECTED";

    const result = await prisma.workSession.updateMany({
      where: { id: { in: sessions.map((session) => session.id) } },
      data: {
        status,
        approvedById: principal.user.id,
        approvedAt: new Date(),
        reviewNote: payload.reviewNote ?? null,
      },
    });

    await recordAudit({
      organizationId: organization.id,
      actorId: principal.user.id,
      action: `timesheet.bulk_${payload.action.toLowerCase()}`,
      targetType: "session",
      metadata: { count: result.count },
    });

    return { updated: result.count, status };
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
        // A manager's edit stands as reviewed; re-queuing their own change
        // would leave the entry waiting on themselves.
        status: endAt ? "APPROVED" : "OPEN",
        approvedById: endAt ? principal.user.id : null,
        approvedAt: endAt ? new Date() : null,
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
