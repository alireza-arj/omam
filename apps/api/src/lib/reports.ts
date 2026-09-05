import type { CalendarSystem } from "@omam/calendar";
import type { Currency, MemberReportRowDto, MonthlyReportDto } from "@omam/contracts";
import { prisma } from "./prisma";
import { hoursFromMinutes, localDayKey, monthWindow } from "./time";
import { notFound } from "./errors";

type Membership = Awaited<ReturnType<typeof loadMemberships>>[number];

async function loadMemberships(organizationId: string) {
  return prisma.membership.findMany({
    where: { organizationId },
    include: { user: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * Payroll counts approved work only. Everything else is reported so a manager
 * can see what is still waiting, but it never turns into money on its own.
 */
function grossFor(membership: Membership, approvedMinutes: number) {
  if (membership.payType === "MONTHLY") {
    return membership.monthlySalary;
  }

  return Number((hoursFromMinutes(approvedMinutes) * membership.hourlyRate).toFixed(2));
}

function emptyRow(membership: Membership): MemberReportRowDto {
  return {
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
    approvedMinutes: 0,
    pendingMinutes: 0,
    rejectedMinutes: 0,
    workedDays: 0,
    onsiteMinutes: 0,
    remoteMinutes: 0,
    grossAmount: membership.payType === "MONTHLY" ? membership.monthlySalary : 0,
  };
}

export async function buildMonthlyReport(
  organizationId: string,
  monthInput: string | undefined,
  calendar: CalendarSystem,
): Promise<MonthlyReportDto> {
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });

  if (!organization) {
    throw notFound("Organization not found.");
  }

  const window = monthWindow(monthInput, calendar);
  const [memberships, sessions] = await Promise.all([
    loadMemberships(organizationId),
    prisma.workSession.findMany({
      where: {
        organizationId,
        deletedAt: null,
        startAt: { gte: window.from, lte: window.to },
      },
      select: {
        userId: true,
        startAt: true,
        durationMinutes: true,
        status: true,
        category: true,
      },
    }),
  ]);

  const rows = new Map<string, MemberReportRowDto>();
  const workedDays = new Map<string, Set<string>>();

  for (const membership of memberships) {
    rows.set(membership.userId, emptyRow(membership));
    workedDays.set(membership.userId, new Set());
  }

  for (const session of sessions) {
    const row = rows.get(session.userId);

    if (!row) {
      // A session from someone whose membership was deleted. Counting it under
      // nobody would silently change the org total, so it is skipped here and
      // surfaced by the orphan check in the members route instead.
      continue;
    }

    const minutes = session.durationMinutes;

    if (session.status === "APPROVED") {
      row.approvedMinutes += minutes;

      if (session.category === "REMOTE") {
        row.remoteMinutes += minutes;
      } else {
        row.onsiteMinutes += minutes;
      }
    } else if (session.status === "REJECTED") {
      row.rejectedMinutes += minutes;
    } else {
      row.pendingMinutes += minutes;
    }

    if (session.status !== "REJECTED") {
      workedDays.get(session.userId)?.add(localDayKey(session.startAt, calendar));
    }
  }

  const byCurrency = new Map<Currency, number>();
  let approvedMinutes = 0;
  let pendingMinutes = 0;

  const result: MemberReportRowDto[] = [];

  for (const membership of memberships) {
    const row = rows.get(membership.userId)!;

    row.workedDays = workedDays.get(membership.userId)?.size ?? 0;
    row.grossAmount = grossFor(membership, row.approvedMinutes);

    approvedMinutes += row.approvedMinutes;
    pendingMinutes += row.pendingMinutes;
    byCurrency.set(row.currency, (byCurrency.get(row.currency) ?? 0) + row.grossAmount);

    result.push(row);
  }

  result.sort((a, b) => b.approvedMinutes - a.approvedMinutes);

  return {
    month: window.month,
    calendar,
    from: window.from.toISOString(),
    to: window.to.toISOString(),
    currency: organization.currency,
    totals: {
      approvedMinutes,
      pendingMinutes,
      grossAmount: Number((byCurrency.get(organization.currency) ?? 0).toFixed(2)),
      byCurrency: [...byCurrency.entries()].map(([currency, grossAmount]) => ({
        currency,
        grossAmount: Number(grossAmount.toFixed(2)),
      })),
      memberCount: memberships.length,
      activeMemberCount: memberships.filter((entry) => entry.status === "ACTIVE").length,
    },
    rows: result,
  };
}

export { grossFor };
