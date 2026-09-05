import { z } from "zod";
import { calendarSystemSchema, currencySchema, monthKeySchema, payTypeSchema } from "./common";
import { sessionSchema } from "./sessions";

/** One member's totals for the month the report was asked for. */
export const memberReportRowSchema = z.object({
  userId: z.string(),
  membershipId: z.string(),
  username: z.string(),
  nickname: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  employeeCode: z.string().nullable(),
  jobTitle: z.string().nullable(),
  payType: payTypeSchema,
  hourlyRate: z.number().nonnegative(),
  monthlySalary: z.number().nonnegative(),
  currency: currencySchema,
  monthlyGoalHours: z.number().nonnegative(),
  approvedMinutes: z.number().nonnegative(),
  pendingMinutes: z.number().nonnegative(),
  rejectedMinutes: z.number().nonnegative(),
  workedDays: z.number().nonnegative(),
  onsiteMinutes: z.number().nonnegative(),
  remoteMinutes: z.number().nonnegative(),
  /** Approved hours times the rate, or the fixed salary for MONTHLY members. */
  grossAmount: z.number(),
});

export const monthlyReportSchema = z.object({
  month: monthKeySchema,
  calendar: calendarSystemSchema,
  from: z.string(),
  to: z.string(),
  currency: currencySchema,
  totals: z.object({
    approvedMinutes: z.number().nonnegative(),
    pendingMinutes: z.number().nonnegative(),
    /** Sum of the rows paid in the organization's own currency. */
    grossAmount: z.number(),
    /** Every currency present in the month, so a contractor is never dropped. */
    byCurrency: z.array(z.object({ currency: currencySchema, grossAmount: z.number() })),
    memberCount: z.number().nonnegative(),
    activeMemberCount: z.number().nonnegative(),
  }),
  rows: z.array(memberReportRowSchema),
});

export const dailyBucketSchema = z.object({
  /** Day key in the report's calendar. */
  day: z.string(),
  minutes: z.number().nonnegative(),
});

export const memberDetailReportSchema = z.object({
  month: monthKeySchema,
  calendar: calendarSystemSchema,
  member: memberReportRowSchema,
  days: z.array(dailyBucketSchema),
  projects: z.array(
    z.object({
      projectId: z.string().nullable(),
      name: z.string(),
      color: z.string(),
      minutes: z.number().nonnegative(),
    }),
  ),
  sessions: z.array(sessionSchema),
});

export const reportQuerySchema = z.object({
  month: monthKeySchema.optional(),
  calendar: calendarSystemSchema.optional(),
});

export const dashboardSchema = z.object({
  month: monthKeySchema,
  calendar: calendarSystemSchema,
  currency: currencySchema,
  activeNow: z.array(
    z.object({
      userId: z.string(),
      username: z.string(),
      nickname: z.string().nullable(),
      avatarUrl: z.string().nullable(),
      startedAt: z.string(),
      minutes: z.number().nonnegative(),
    }),
  ),
  pendingCount: z.number().nonnegative(),
  memberCount: z.number().nonnegative(),
  monthApprovedMinutes: z.number().nonnegative(),
  monthGrossAmount: z.number(),
  trend: z.array(dailyBucketSchema),
});

export type MemberReportRowDto = z.infer<typeof memberReportRowSchema>;
export type MonthlyReportDto = z.infer<typeof monthlyReportSchema>;
export type DailyBucketDto = z.infer<typeof dailyBucketSchema>;
export type MemberDetailReportDto = z.infer<typeof memberDetailReportSchema>;
export type ReportQueryDto = z.infer<typeof reportQuerySchema>;
export type DashboardDto = z.infer<typeof dashboardSchema>;
