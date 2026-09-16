import { Elysia } from "elysia";
import { addDays, asCalendarSystem, dayKey } from "@omam/calendar";
import { reportQuerySchema } from "@omam/contracts";
import { prisma } from "../lib/prisma";
import { authenticated } from "../lib/context";
import { requireOrganization, requireRole } from "../lib/auth";
import { notFound, parseInput } from "../lib/errors";
import { buildMonthlyReport, grossFor } from "../lib/reports";
import { serializeSession } from "../lib/serialize";
import { csvResponse, toCsv } from "../lib/csv";
import { formatDuration, hoursFromMinutes, localDayKey, minutesBetween, monthWindow } from "../lib/time";

/** Every day of the window, so a chart has no gaps where nobody worked. */
function emptyDayBuckets(from: Date, to: Date, calendar: "JALALI" | "GREGORIAN") {
  const buckets = new Map<string, number>();

  for (let cursor = from; cursor.getTime() <= to.getTime(); cursor = addDays(cursor, 1)) {
    buckets.set(dayKey(cursor, calendar), 0);
  }

  return buckets;
}

export const reportRoutes = new Elysia({ prefix: "/reports" })
  .use(authenticated)

  .get("/dashboard", async ({ principal, query }) => {
    requireRole(principal, "MANAGER");

    const organization = requireOrganization(principal);
    const filters = parseInput(reportQuerySchema, query);
    const calendar = asCalendarSystem(filters.calendar ?? organization.calendar);
    const window = monthWindow(filters.month, calendar);
    const report = await buildMonthlyReport(organization.id, window.month, calendar);

    const [running, monthSessions] = await Promise.all([
      prisma.workSession.findMany({
        where: { organizationId: organization.id, endAt: null, deletedAt: null },
        include: { user: true },
        orderBy: { startAt: "asc" },
      }),
      prisma.workSession.findMany({
        where: {
          organizationId: organization.id,
          deletedAt: null,
          status: "COMPLETED",
          startAt: { gte: window.from, lte: window.to },
        },
        select: { startAt: true, durationMinutes: true },
      }),
    ]);

    const buckets = emptyDayBuckets(window.from, window.to, calendar);

    for (const session of monthSessions) {
      const key = localDayKey(session.startAt, calendar);

      buckets.set(key, (buckets.get(key) ?? 0) + session.durationMinutes);
    }

    const now = new Date();

    return {
      month: window.month,
      calendar,
      currency: organization.currency,
      memberCount: report.totals.activeMemberCount,
      monthCompletedMinutes: report.totals.completedMinutes,
      monthGrossAmount: report.totals.grossAmount,
      activeNow: running.map((session) => ({
        userId: session.userId,
        username: session.user.username,
        nickname: session.user.nickname,
        avatarUrl: session.user.avatarUrl,
        startedAt: session.startAt.toISOString(),
        minutes: minutesBetween(session.startAt, now),
      })),
      trend: [...buckets.entries()].map(([day, minutes]) => ({ day, minutes })),
    };
  })

  .get("/monthly", async ({ principal, query }) => {
    requireRole(principal, "MANAGER");

    const organization = requireOrganization(principal);
    const filters = parseInput(reportQuerySchema, query);
    const calendar = asCalendarSystem(filters.calendar ?? organization.calendar);

    return buildMonthlyReport(organization.id, filters.month, calendar);
  })

  /** The end-of-month payroll sheet, ready for a spreadsheet. */
  .get("/monthly.csv", async ({ principal, query }) => {
    requireRole(principal, "MANAGER");

    const organization = requireOrganization(principal);
    const filters = parseInput(reportQuerySchema, query);
    const calendar = asCalendarSystem(filters.calendar ?? organization.calendar);
    const report = await buildMonthlyReport(organization.id, filters.month, calendar);

    const body = toCsv(
      [
        "Employee code",
        "Username",
        "Name",
        "Job title",
        "Pay type",
        "Rate",
        "Currency",
        "Completed hours",
        "Completed time",
        "Worked days",
        "Onsite hours",
        "Remote hours",
        "Gross amount",
      ],
      report.rows.map((row) => [
        row.employeeCode,
        row.username,
        row.nickname ?? row.username,
        row.jobTitle,
        row.payType,
        row.payType === "MONTHLY" ? row.monthlySalary : row.hourlyRate,
        row.currency,
        hoursFromMinutes(row.completedMinutes),
        formatDuration(row.completedMinutes),
        row.workedDays,
        hoursFromMinutes(row.onsiteMinutes),
        hoursFromMinutes(row.remoteMinutes),
        row.grossAmount,
      ]),
    );

    return csvResponse(`omam-${organization.slug}-${report.month}.csv`, body);
  })

  .get("/members/:userId", async ({ principal, params, query }) => {
    const organization = requireOrganization(principal);

    // A member may always read their own detail; anyone else's needs a manager.
    if (params.userId !== principal.user.id) {
      requireRole(principal, "MANAGER");
    }

    const filters = parseInput(reportQuerySchema, query);
    const calendar = asCalendarSystem(filters.calendar ?? organization.calendar);
    const window = monthWindow(filters.month, calendar);

    const membership = await prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: organization.id, userId: params.userId } },
      include: { user: true },
    });

    if (!membership) {
      throw notFound("Member not found.");
    }

    const sessions = await prisma.workSession.findMany({
      where: {
        organizationId: organization.id,
        userId: params.userId,
        deletedAt: null,
        startAt: { gte: window.from, lte: window.to },
      },
      include: { project: true },
      orderBy: { startAt: "desc" },
    });

    const buckets = emptyDayBuckets(window.from, window.to, calendar);
    const projects = new Map<string, { projectId: string | null; name: string; color: string; minutes: number }>();

    let completedMinutes = 0;
    let onsiteMinutes = 0;
    let remoteMinutes = 0;
    const workedDays = new Set<string>();

    for (const session of sessions) {
      const key = localDayKey(session.startAt, calendar);

      workedDays.add(key);

      if (session.status === "COMPLETED") {
        completedMinutes += session.durationMinutes;
        buckets.set(key, (buckets.get(key) ?? 0) + session.durationMinutes);

        if (session.category === "REMOTE") remoteMinutes += session.durationMinutes;
        else onsiteMinutes += session.durationMinutes;

        const projectKey = session.projectId ?? "none";
        const entry = projects.get(projectKey) ?? {
          projectId: session.projectId,
          name: session.project?.name ?? "Untagged",
          color: session.project?.color ?? "#8A8F98",
          minutes: 0,
        };

        entry.minutes += session.durationMinutes;
        projects.set(projectKey, entry);
      }
    }

    return {
      month: window.month,
      calendar,
      member: {
        userId: membership.userId,
        membershipId: membership.id,
        username: membership.user.username,
        nickname: membership.user.nickname,
        avatarUrl: membership.user.avatarUrl,
        employeeCode: membership.employeeCode,
        jobTitle: membership.jobTitle,
        payType: membership.payType,
        hourlyRate: membership.hourlyRate,
        monthlySalary: membership.monthlySalary,
        currency: membership.currency,
        monthlyGoalHours: membership.monthlyGoalHours,
        completedMinutes,
        workedDays: workedDays.size,
        onsiteMinutes,
        remoteMinutes,
        grossAmount: grossFor(membership, completedMinutes),
      },
      days: [...buckets.entries()].map(([day, minutes]) => ({ day, minutes })),
      projects: [...projects.values()].sort((a, b) => b.minutes - a.minutes),
      sessions: sessions.map(serializeSession),
    };
  });
