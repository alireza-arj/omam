import { Elysia } from "elysia";
import { asCalendarSystem, workSegments } from "@omam/calendar";
import { createTranslator } from "@omam/i18n";
import { reportQuerySchema } from "@omam/contracts";
import { prisma } from "../lib/prisma";
import { authenticated } from "../lib/context";
import { requireOrganization, requireRole } from "../lib/auth";
import { parseInput } from "../lib/errors";
import { buildMonthlyReport, buildMemberReport, dayBuckets } from "../lib/reports";
import { csvResponse, toCsv } from "../lib/csv";
import { formatDuration, hoursFromMinutes, minutesBetween, monthWindow } from "../lib/time";

export const reportRoutes = new Elysia({ prefix: "/reports" })
  .use(authenticated)
  .get("/dashboard", async ({ principal, query }) => {
    requireRole(principal, "MANAGER");
    const organization = requireOrganization(principal);
    const filters = parseInput(reportQuerySchema, query);
    const calendar = asCalendarSystem(filters.calendar ?? organization.calendar);
    const window = monthWindow(filters.month, calendar);
    const report = await buildMonthlyReport(organization.id, window.month, calendar);
    const [running, sessions] = await Promise.all([
      prisma.workSession.findMany({
        where: { organizationId: organization.id, endAt: null, deletedAt: null },
        include: { user: true }, orderBy: { startAt: "asc" },
      }),
      prisma.workSession.findMany({
        where: { organizationId: organization.id, deletedAt: null, status: "COMPLETED",
          startAt: { lte: window.to }, endAt: { gt: window.from } },
        select: { startAt: true, endAt: true },
      }),
    ]);
    const buckets = dayBuckets(window, calendar);
    for (const session of sessions) {
      for (const segment of workSegments(session.startAt, session.endAt, window, calendar)) {
        buckets.set(segment.day, (buckets.get(segment.day) ?? 0) + segment.minutes);
      }
    }
    return {
      month: window.month, calendar, currency: organization.currency,
      memberCount: report.totals.activeMemberCount,
      monthCompletedMinutes: report.totals.completedMinutes,
      monthSessionCount: report.totals.sessionCount,
      monthGrossAmount: report.totals.grossAmount,
      activeNow: running.map((session) => ({
        userId: session.userId, username: session.user.username, nickname: session.user.nickname,
        avatarUrl: session.user.avatarUrl, startedAt: session.startAt.toISOString(),
        minutes: minutesBetween(session.startAt, new Date()),
      })),
      trend: [...buckets].map(([day, minutes]) => ({ day, minutes })),
    };
  })
  .get("/monthly", async ({ principal, query }) => {
    requireRole(principal, "MANAGER");
    const organization = requireOrganization(principal);
    const filters = parseInput(reportQuerySchema, query);
    return buildMonthlyReport(organization.id, filters.month, asCalendarSystem(filters.calendar ?? organization.calendar));
  })
  .get("/monthly.csv", async ({ principal, query }) => {
    requireRole(principal, "MANAGER");
    const organization = requireOrganization(principal);
    const filters = parseInput(reportQuerySchema, query);
    const report = await buildMonthlyReport(organization.id, filters.month, asCalendarSystem(filters.calendar ?? organization.calendar));
    const t = createTranslator(filters.language ?? organization.language);
    const rows = filters.userId ? report.rows.filter((row) => row.userId === filters.userId) : report.rows;
    const body = toCsv(
      [t("workspace.team"), t("workspace.month"), t("admin.members.code"), t("auth.username"),
        t("admin.table.name"), t("admin.members.jobTitle"), t("workspace.sessions"),
        t("workspace.minutes"), t("admin.report.completed"), t("workspace.decimalHours"),
        t("admin.report.days"), t("admin.report.onsite"), t("admin.report.remote")],
      rows.map((row) => [organization.name, report.month, row.employeeCode, row.username,
        row.nickname ?? row.username, row.jobTitle, row.sessionCount, row.completedMinutes,
        formatDuration(row.completedMinutes), hoursFromMinutes(row.completedMinutes), row.workedDays,
        hoursFromMinutes(row.onsiteMinutes), hoursFromMinutes(row.remoteMinutes)]),
    );
    return csvResponse(`omam-${organization.slug}-${report.month}.csv`, body);
  })
  .get("/members/:userId/export.csv", async ({ principal, params, query }) => {
    const organization = requireOrganization(principal);
    if (params.userId !== principal.user.id) requireRole(principal, "MANAGER");
    const filters = parseInput(reportQuerySchema, query);
    const calendar = asCalendarSystem(filters.calendar ?? organization.calendar);
    const report = await buildMemberReport(organization.id, params.userId, filters.month, calendar);
    const window = monthWindow(report.month, calendar);
    const t = createTranslator(filters.language ?? organization.language);
    return csvResponse(`omam-${organization.slug}-${report.profile.username}-${report.month}.csv`, toCsv(
      [t("workspace.team"), t("workspace.month"), t("admin.table.name"), t("workspace.start"),
        t("workspace.end"), t("workspace.minutes"), t("admin.timesheets.where"),
        t("admin.timesheets.status"), t("admin.timesheets.note")],
      report.sessions.map((session) => [organization.name, report.month, report.profile.nickname ?? report.profile.username,
        session.startAt, session.endAt, workSegments(new Date(session.startAt), session.endAt ? new Date(session.endAt) : null, window, calendar)
          .reduce((sum, segment) => sum + segment.minutes, 0), t(`category.${session.category}`), t(`status.${session.status}`), session.note]),
    ));
  })
  .get("/members/:userId", async ({ principal, params, query }) => {
    const organization = requireOrganization(principal);
    if (params.userId !== principal.user.id) requireRole(principal, "MANAGER");
    const filters = parseInput(reportQuerySchema, query);
    return buildMemberReport(organization.id, params.userId, filters.month, asCalendarSystem(filters.calendar ?? organization.calendar));
  });
