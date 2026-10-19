import { Elysia } from "elysia";
import { asCalendarSystem, workSegments } from "@omam/calendar";
import {
  clockInInputSchema,
  clockOutInputSchema,
  createSessionInputSchema,
  sessionListQuerySchema,
  summaryQuerySchema,
  updateSessionInputSchema,
} from "@omam/contracts";
import { prisma } from "../lib/prisma";
import { authenticated } from "../lib/context";
import { requireOrganization } from "../lib/auth";
import { conflict, invalid, notFound, parseInput } from "../lib/errors";
import { serializeSession } from "../lib/serialize";
import { calculateSessionMinutes, hoursFromMinutes, monthWindow } from "../lib/time";
import { isSessionLocked } from "../lib/payroll";
import { withSyncChange } from "../lib/sync-events";

const includeProject = { project: true } as const;

/**
 * A session inside a locked payroll month is history — editing it would change
 * a total that has already been paid out.
 */
async function assertMonthEditable(organizationId: string, startAt: Date, endAt: Date | null = null) {
  const lockedMonth = await isSessionLocked(organizationId, startAt, endAt);
  if (lockedMonth) throw conflict("This month is locked.", "PAYROLL_LOCKED");
}

async function assertProjectBelongs(organizationId: string, projectId: string | null | undefined) {
  if (!projectId) return null;

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId },
    select: { id: true },
  });

  if (!project) {
    throw invalid("That project does not belong to this organization.");
  }

  return project.id;
}

function assertOrder(startAt: Date, endAt: Date | null) {
  if (endAt && endAt.getTime() < startAt.getTime()) {
    throw invalid("The end time cannot be before the start time.");
  }
}

async function ownSession(userId: string, organizationId: string, id: string) {
  const session = await prisma.workSession.findFirst({
    where: { id, userId, organizationId, deletedAt: null },
    include: includeProject,
  });

  if (!session) {
    throw notFound("Session not found.");
  }

  return session;
}

export const sessionRoutes = new Elysia({ prefix: "/sessions" })
  .use(authenticated)

  .get("/", async ({ principal, query }) => {
    const organization = requireOrganization(principal);
    const filters = parseInput(sessionListQuerySchema, query);

    const sessions = await prisma.workSession.findMany({
      where: {
        userId: principal.user.id,
        organizationId: organization.id,
        deletedAt: null,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.from || filters.to
          ? {
              startAt: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(filters.to) } : {}),
              },
            }
          : {}),
      },
      include: includeProject,
      orderBy: { startAt: "desc" },
    });

    return { sessions: sessions.map(serializeSession) };
  })

  .post("/clock-in", async ({ principal, body }) => {
    const organization = requireOrganization(principal);
    const payload = parseInput(clockInInputSchema, body);

    const active = await prisma.workSession.findFirst({
      where: { organizationId: organization.id, userId: principal.user.id, endAt: null, deletedAt: null },
    });

    if (active) {
      throw conflict("There is already an active session.", "SESSION_ACTIVE");
    }

    const startAt = new Date(payload.startAt);

    await assertMonthEditable(organization.id, startAt);

    const session = await withSyncChange({ organizationId: organization.id, userId: principal.user.id }, async (tx) => tx.workSession.create({
      data: {
        organizationId: organization.id,
        userId: principal.user.id,
        projectId: await assertProjectBelongs(organization.id, payload.projectId),
        startAt,
        category: payload.category,
        note: payload.note ?? null,
        status: "OPEN",
        source: "TIMER",
      },
      include: includeProject,
    }));

    return serializeSession(session);
  })

  .post("/:id/clock-out", async ({ principal, params, body }) => {
    const organization = requireOrganization(principal);
    const payload = parseInput(clockOutInputSchema, body);
    const session = await ownSession(principal.user.id, organization.id, params.id);

    if (session.endAt) {
      throw conflict("That session is already closed.", "SESSION_CLOSED");
    }

    const endAt = new Date(payload.endAt);

    assertOrder(session.startAt, endAt);
    await assertMonthEditable(organization.id, session.startAt, endAt);

    const updated = await withSyncChange({ organizationId: organization.id, userId: principal.user.id }, async (tx) => tx.workSession.update({
      where: { id: session.id },
      data: {
        endAt,
        durationMinutes: calculateSessionMinutes({ startAt: session.startAt, endAt }),
        status: "COMPLETED",
      },
      include: includeProject,
    }));

    return serializeSession(updated);
  })

  .post("/", async ({ principal, body }) => {
    const organization = requireOrganization(principal);
    const payload = parseInput(createSessionInputSchema, body);
    const startAt = new Date(payload.startAt);
    const endAt = payload.endAt ? new Date(payload.endAt) : null;

    assertOrder(startAt, endAt);
    await assertMonthEditable(organization.id, startAt, endAt);

    if (!endAt) {
      const active = await prisma.workSession.findFirst({
        where: { organizationId: organization.id, userId: principal.user.id, endAt: null, deletedAt: null },
      });

      if (active) {
        throw conflict("There is already an active session.", "SESSION_ACTIVE");
      }
    }

    const session = await withSyncChange({ organizationId: organization.id, userId: principal.user.id }, async (tx) => tx.workSession.create({
      data: {
        organizationId: organization.id,
        userId: principal.user.id,
        projectId: await assertProjectBelongs(organization.id, payload.projectId),
        startAt,
        endAt,
        durationMinutes: endAt ? calculateSessionMinutes({ startAt, endAt }) : 0,
        category: payload.category,
        note: payload.note ?? null,
        source: "MANUAL",
        status: endAt ? "COMPLETED" : "OPEN",
      },
      include: includeProject,
    }));

    return serializeSession(session);
  })

  .patch("/:id", async ({ principal, params, body }) => {
    const organization = requireOrganization(principal);
    const payload = parseInput(updateSessionInputSchema, body);
    const session = await ownSession(principal.user.id, organization.id, params.id);
    const startAt = new Date(payload.startAt);
    const endAt = payload.endAt ? new Date(payload.endAt) : null;

    assertOrder(startAt, endAt);
    await assertMonthEditable(organization.id, session.startAt, session.endAt);
    await assertMonthEditable(organization.id, startAt, endAt);

    if (!endAt && await prisma.workSession.findFirst({ where: { organizationId: organization.id, userId: principal.user.id, endAt: null, deletedAt: null, id: { not: session.id } } })) {
      throw conflict("There is already an active session.", "SESSION_ACTIVE");
    }

    const updated = await withSyncChange({ organizationId: organization.id, userId: principal.user.id }, async (tx) => tx.workSession.update({
      where: { id: session.id },
      data: {
        startAt,
        endAt,
        durationMinutes: endAt ? calculateSessionMinutes({ startAt, endAt }) : 0,
        category: payload.category,
        note: payload.note ?? null,
        projectId: await assertProjectBelongs(organization.id, payload.projectId),
        status: endAt ? "COMPLETED" : "OPEN",
      },
      include: includeProject,
    }));

    return serializeSession(updated);
  })

  .delete("/:id", async ({ principal, params, set }) => {
    const organization = requireOrganization(principal);
    const session = await ownSession(principal.user.id, organization.id, params.id);

    await assertMonthEditable(organization.id, session.startAt, session.endAt);

    // Soft delete: a hard one is invisible to an offline device, which would
    // push the row straight back on its next sync.
    await withSyncChange({ organizationId: organization.id, userId: principal.user.id }, async (tx) => tx.workSession.update({
      where: { id: session.id },
      data: { deletedAt: new Date() },
    }));

    set.status = 204;

    return null;
  })

  .get("/summary", async ({ principal, query }) => {
    const organization = requireOrganization(principal);
    const filters = parseInput(summaryQuerySchema, query);
    const settings = await prisma.appSettings.findUnique({
      where: { userId: principal.user.id },
    });

    const calendar = asCalendarSystem(
      filters.calendar ?? settings?.calendar ?? organization.calendar,
    );
    const window = monthWindow(filters.month, calendar);

    const [sessions, activeSession] = await Promise.all([
      prisma.workSession.findMany({
        where: {
          userId: principal.user.id,
          organizationId: organization.id,
          deletedAt: null,
          startAt: { lte: window.to },
          endAt: { gt: window.from },
          status: "COMPLETED",
        },
        include: includeProject,
      }),
      prisma.workSession.findFirst({
        where: { organizationId: organization.id, userId: principal.user.id, endAt: null, deletedAt: null },
        include: includeProject,
        orderBy: { startAt: "desc" },
      }),
    ]);

    const categoryMinutes = { onsite: 0, remote: 0 };
    const workedDays = new Set<string>();
    let totalMinutes = 0;
    let completedMinutes = 0;

    for (const session of sessions) {
      const segments = workSegments(session.startAt, session.endAt, window, calendar);
      const minutes = segments.reduce((sum, segment) => sum + segment.minutes, 0);
      for (const segment of segments) if (segment.minutes > 0) workedDays.add(segment.day);
      totalMinutes += minutes;
      completedMinutes += minutes;

      if (session.category === "REMOTE") {
        categoryMinutes.remote += minutes;
      } else {
        categoryMinutes.onsite += minutes;
      }
    }

    // The member's own rate drives the figure they see; payroll uses the rate
    // the manager set on the membership, which may differ.
    const hourlyRate = settings?.hourlyRate ?? 0;

    return {
      month: window.month,
      calendar,
      summary: {
        totalMinutes,
        completedMinutes,
        totalIncome: Number((hoursFromMinutes(totalMinutes) * hourlyRate).toFixed(2)),
        activeSession: activeSession ? serializeSession(activeSession) : null,
        workedDays: workedDays.size,
        categoryMinutes,
      },
    };
  });
