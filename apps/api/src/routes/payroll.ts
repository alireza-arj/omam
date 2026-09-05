import { Elysia } from "elysia";
import { asCalendarSystem } from "@omam/calendar";
import {
  buildPayrollInputSchema,
  updatePayrollLineInputSchema,
  updatePayrollPeriodInputSchema,
} from "@omam/contracts";
import { prisma } from "../lib/prisma";
import { authenticated } from "../lib/context";
import { requireOrganization, requireRole } from "../lib/auth";
import { conflict, notFound, parseInput } from "../lib/errors";
import { buildPayrollPeriod, readPeriodDetail, serializePeriod } from "../lib/payroll";
import { csvResponse, toCsv } from "../lib/csv";
import { formatDuration, hoursFromMinutes } from "../lib/time";
import { recordAudit } from "../lib/audit";

async function loadPeriodForOrg(organizationId: string, periodId: string) {
  const period = await prisma.payrollPeriod.findFirst({
    where: { id: periodId, organizationId },
    select: { id: true, status: true, month: true },
  });

  if (!period) {
    throw notFound("Payroll period not found.");
  }

  return period;
}

export const payrollRoutes = new Elysia({ prefix: "/payroll" })
  .use(authenticated)

  .get("/periods", async ({ principal }) => {
    requireRole(principal, "MANAGER");

    const organization = requireOrganization(principal);
    const periods = await prisma.payrollPeriod.findMany({
      where: { organizationId: organization.id },
      include: { lockedBy: true, lines: { include: { user: true, membership: true } } },
      orderBy: { month: "desc" },
    });

    return { periods: periods.map((period) => serializePeriod(period, organization.currency)) };
  })

  /** Builds or rebuilds the draft for a month from its approved sessions. */
  .post("/periods", async ({ principal, body }) => {
    requireRole(principal, "MANAGER");

    const organization = requireOrganization(principal);
    const payload = parseInput(buildPayrollInputSchema, body);
    const calendar = asCalendarSystem(payload.calendar ?? organization.calendar);

    const periodId = await buildPayrollPeriod(organization.id, payload.month, calendar);

    await recordAudit({
      organizationId: organization.id,
      actorId: principal.user.id,
      action: "payroll.built",
      targetType: "payroll_period",
      targetId: periodId,
      metadata: { month: payload.month },
    });

    return readPeriodDetail(periodId, organization.currency);
  })

  .get("/periods/:id", async ({ principal, params }) => {
    requireRole(principal, "MANAGER");

    const organization = requireOrganization(principal);

    await loadPeriodForOrg(organization.id, params.id);

    return readPeriodDetail(params.id, organization.currency);
  })

  .patch("/periods/:id", async ({ principal, params, body }) => {
    requireRole(principal, "OWNER");

    const organization = requireOrganization(principal);
    const payload = parseInput(updatePayrollPeriodInputSchema, body);
    const period = await loadPeriodForOrg(organization.id, params.id);

    if (payload.status === "DRAFT" && period.status === "PAID") {
      throw conflict("A paid period cannot be reopened.", "PAYROLL_PAID");
    }

    const locking = payload.status === "LOCKED" && period.status !== "LOCKED";

    await prisma.payrollPeriod.update({
      where: { id: period.id },
      data: {
        ...(payload.status ? { status: payload.status } : {}),
        ...(payload.note !== undefined ? { note: payload.note } : {}),
        ...(locking ? { lockedAt: new Date(), lockedById: principal.user.id } : {}),
        ...(payload.status === "DRAFT" ? { lockedAt: null, lockedById: null } : {}),
      },
    });

    await recordAudit({
      organizationId: organization.id,
      actorId: principal.user.id,
      action: `payroll.${(payload.status ?? "updated").toLowerCase()}`,
      targetType: "payroll_period",
      targetId: period.id,
      metadata: { month: period.month, status: payload.status },
    });

    return readPeriodDetail(period.id, organization.currency);
  })

  /** A bonus, a deduction, an advance — anything the hours do not express. */
  .patch("/lines/:id", async ({ principal, params, body }) => {
    requireRole(principal, "MANAGER");

    const organization = requireOrganization(principal);
    const payload = parseInput(updatePayrollLineInputSchema, body);

    const line = await prisma.payrollLine.findFirst({
      where: { id: params.id, period: { organizationId: organization.id } },
      include: { period: true, user: true },
    });

    if (!line) {
      throw notFound("Payroll line not found.");
    }

    if (line.period.status !== "DRAFT") {
      throw conflict("That payroll period is closed.", "PAYROLL_LOCKED");
    }

    await prisma.payrollLine.update({
      where: { id: line.id },
      data: {
        adjustment: payload.adjustment,
        adjustmentNote: payload.adjustmentNote ?? null,
        netAmount: Number((line.grossAmount + payload.adjustment).toFixed(2)),
      },
    });

    await recordAudit({
      organizationId: organization.id,
      actorId: principal.user.id,
      action: "payroll.line_adjusted",
      targetType: "payroll_line",
      targetId: line.id,
      metadata: {
        username: line.user.username,
        adjustment: payload.adjustment,
        note: payload.adjustmentNote ?? null,
      },
    });

    return readPeriodDetail(line.periodId, organization.currency);
  })

  .get("/periods/:id/export.csv", async ({ principal, params }) => {
    requireRole(principal, "MANAGER");

    const organization = requireOrganization(principal);

    await loadPeriodForOrg(organization.id, params.id);

    const detail = await readPeriodDetail(params.id, organization.currency);

    const body = toCsv(
      [
        "Employee code",
        "Username",
        "Name",
        "Pay type",
        "Rate",
        "Approved hours",
        "Approved time",
        "Worked days",
        "Currency",
        "Gross",
        "Adjustment",
        "Adjustment note",
        "Net",
      ],
      detail.lines.map((line) => [
        line.employeeCode,
        line.username,
        line.nickname ?? line.username,
        line.payType,
        line.payType === "MONTHLY" ? line.monthlySalary : line.hourlyRate,
        hoursFromMinutes(line.approvedMinutes),
        formatDuration(line.approvedMinutes),
        line.workedDays,
        line.currency,
        line.grossAmount,
        line.adjustment,
        line.adjustmentNote,
        line.netAmount,
      ]),
    );

    return csvResponse(`omam-payroll-${detail.period.month}.csv`, body);
  });
