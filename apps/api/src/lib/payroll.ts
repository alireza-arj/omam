import type { CalendarSystem } from "@omam/calendar";
import type { PayrollLineDto, PayrollPeriodDetailDto, PayrollPeriodDto } from "@omam/contracts";
import { prisma } from "./prisma";
import { buildMonthlyReport } from "./reports";
import { conflict, notFound } from "./errors";
import { monthWindow } from "./time";

type PeriodWithRelations = Awaited<ReturnType<typeof loadPeriod>>;

async function loadPeriod(periodId: string) {
  const period = await prisma.payrollPeriod.findUnique({
    where: { id: periodId },
    include: {
      lockedBy: true,
      lines: {
        include: { user: true, membership: true },
        orderBy: { netAmount: "desc" },
      },
    },
  });

  if (!period) {
    throw notFound("Payroll period not found.");
  }

  return period;
}

function serializeLine(
  line: PeriodWithRelations["lines"][number],
): PayrollLineDto {
  return {
    id: line.id,
    userId: line.userId,
    username: line.user.username,
    nickname: line.user.nickname,
    employeeCode: line.membership?.employeeCode ?? null,
    completedMinutes: line.completedMinutes,
    workedDays: line.workedDays,
    payType: line.payType,
    hourlyRate: line.hourlyRate,
    monthlySalary: line.monthlySalary,
    currency: line.currency,
    grossAmount: line.grossAmount,
    adjustment: line.adjustment,
    adjustmentNote: line.adjustmentNote,
    netAmount: line.netAmount,
  };
}

export function serializePeriod(period: PeriodWithRelations, currency: PayrollPeriodDto["currency"]): PayrollPeriodDto {
  const totalGross = period.lines.reduce((sum, line) => sum + line.grossAmount, 0);
  const totalNet = period.lines.reduce((sum, line) => sum + line.netAmount, 0);

  return {
    id: period.id,
    month: period.month,
    calendar: period.calendar,
    from: period.from.toISOString(),
    to: period.to.toISOString(),
    status: period.status,
    note: period.note,
    lockedAt: period.lockedAt?.toISOString() ?? null,
    lockedByName: period.lockedBy?.nickname ?? period.lockedBy?.username ?? null,
    currency,
    totalGross: Number(totalGross.toFixed(2)),
    totalNet: Number(totalNet.toFixed(2)),
    createdAt: period.createdAt.toISOString(),
    updatedAt: period.updatedAt.toISOString(),
  };
}

export async function readPeriodDetail(
  periodId: string,
  currency: PayrollPeriodDto["currency"],
): Promise<PayrollPeriodDetailDto> {
  const period = await loadPeriod(periodId);

  return {
    period: serializePeriod(period, currency),
    lines: period.lines.map(serializeLine),
  };
}

/**
 * Recomputes a DRAFT period from the month's completed sessions.
 *
 * A LOCKED or PAID period is left alone on purpose: its lines are the record
 * of what was actually paid, so a rate edited in March must not rewrite what
 * February's payslip said. Manual adjustments already entered on a draft are
 * carried over rather than reset.
 */
export async function buildPayrollPeriod(
  organizationId: string,
  monthInput: string,
  calendar: CalendarSystem,
) {
  const report = await buildMonthlyReport(organizationId, monthInput, calendar);
  const window = monthWindow(monthInput, calendar);

  const existing = await prisma.payrollPeriod.findUnique({
    where: { organizationId_month: { organizationId, month: window.month } },
    include: { lines: true },
  });

  if (existing && existing.status !== "DRAFT") {
    throw conflict(
      `Payroll for ${window.month} is ${existing.status.toLowerCase()} and cannot be rebuilt.`,
      "PAYROLL_LOCKED",
    );
  }

  const carriedAdjustments = new Map(
    (existing?.lines ?? []).map((line) => [
      line.userId,
      { adjustment: line.adjustment, adjustmentNote: line.adjustmentNote },
    ]),
  );

  return prisma.$transaction(async (tx) => {
    const period = await tx.payrollPeriod.upsert({
      where: { organizationId_month: { organizationId, month: window.month } },
      update: { calendar, from: window.from, to: window.to },
      create: {
        organizationId,
        month: window.month,
        calendar,
        from: window.from,
        to: window.to,
      },
    });

    await tx.payrollLine.deleteMany({ where: { periodId: period.id } });

    for (const row of report.rows) {
      const carried = carriedAdjustments.get(row.userId);
      const adjustment = carried?.adjustment ?? 0;

      await tx.payrollLine.create({
        data: {
          periodId: period.id,
          userId: row.userId,
          membershipId: row.membershipId,
          completedMinutes: row.completedMinutes,
          workedDays: row.workedDays,
          payType: row.payType,
          hourlyRate: row.hourlyRate,
          monthlySalary: row.monthlySalary,
          currency: row.currency,
          grossAmount: row.grossAmount,
          adjustment,
          adjustmentNote: carried?.adjustmentNote ?? null,
          netAmount: Number((row.grossAmount + adjustment).toFixed(2)),
        },
      });
    }

    return period.id;
  });
}

/** True when the month containing `date` has a payroll run that is not a draft. */
export async function isMonthLocked(organizationId: string, date: Date) {
  const period = await prisma.payrollPeriod.findFirst({
    where: {
      organizationId,
      status: { in: ["LOCKED", "PAID"] },
      from: { lte: date },
      to: { gte: date },
    },
    select: { month: true },
  });

  return period?.month ?? null;
}
