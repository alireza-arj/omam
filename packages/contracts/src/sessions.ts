import { z } from "zod";
import {
  calendarSystemSchema,
  isoDateTime,
  monthKeySchema,
  workSessionCategorySchema,
  workSessionSourceSchema,
  workSessionStatusSchema,
} from "./common";

export const sessionProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
});

export const sessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  clientId: z.string().nullable(),
  startAt: z.string(),
  endAt: z.string().nullable(),
  durationMinutes: z.number().nonnegative(),
  category: workSessionCategorySchema,
  status: workSessionStatusSchema,
  source: workSessionSourceSchema,
  note: z.string().nullable(),
  reviewNote: z.string().nullable(),
  project: sessionProjectSchema.nullable(),
  approvedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const sessionsResponseSchema = z.object({
  sessions: z.array(sessionSchema),
});

export const summarySchema = z.object({
  totalMinutes: z.number().nonnegative(),
  approvedMinutes: z.number().nonnegative(),
  pendingMinutes: z.number().nonnegative(),
  totalIncome: z.number().nonnegative(),
  activeSession: sessionSchema.nullable(),
  workedDays: z.number().nonnegative(),
  categoryMinutes: z.object({
    onsite: z.number().nonnegative(),
    remote: z.number().nonnegative(),
  }),
});

export const summaryResponseSchema = z.object({
  /** `YYYY-MM` in `calendar`, so `1405-06` under Jalali. */
  month: monthKeySchema,
  calendar: calendarSystemSchema,
  summary: summarySchema,
});

export const clockInInputSchema = z.object({
  startAt: isoDateTime,
  category: workSessionCategorySchema.default("ONSITE"),
  projectId: z.string().nullable().optional(),
  note: z.string().trim().min(1).max(240).nullable().optional(),
});

export const clockOutInputSchema = z.object({
  endAt: isoDateTime,
});

export const createSessionInputSchema = z.object({
  startAt: isoDateTime,
  endAt: isoDateTime.nullable(),
  category: workSessionCategorySchema.default("ONSITE"),
  projectId: z.string().nullable().optional(),
  note: z.string().trim().max(240).nullable().optional(),
});

export const updateSessionInputSchema = createSessionInputSchema;

export const sessionListQuerySchema = z.object({
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
  status: workSessionStatusSchema.optional(),
  projectId: z.string().optional(),
});

export const summaryQuerySchema = z.object({
  month: monthKeySchema.optional(),
  calendar: calendarSystemSchema.optional(),
});

export type SessionProjectDto = z.infer<typeof sessionProjectSchema>;
export type SessionDto = z.infer<typeof sessionSchema>;
export type SessionsResponseDto = z.infer<typeof sessionsResponseSchema>;
export type SummaryDto = z.infer<typeof summarySchema>;
export type SummaryResponseDto = z.infer<typeof summaryResponseSchema>;
export type ClockInInputDto = z.infer<typeof clockInInputSchema>;
export type ClockOutInputDto = z.infer<typeof clockOutInputSchema>;
export type CreateSessionInputDto = z.infer<typeof createSessionInputSchema>;
export type UpdateSessionInputDto = z.infer<typeof updateSessionInputSchema>;
export type SessionListQueryDto = z.infer<typeof sessionListQuerySchema>;

/** Manager-side review of another member's time. */
export const reviewSessionInputSchema = z.object({
  reviewNote: z.string().trim().max(240).nullable().optional(),
});

export const bulkReviewInputSchema = z.object({
  sessionIds: z.array(z.string()).min(1).max(500),
  action: z.enum(["APPROVE", "REJECT"]),
  reviewNote: z.string().trim().max(240).nullable().optional(),
});

export const timesheetQuerySchema = z.object({
  month: monthKeySchema.optional(),
  calendar: calendarSystemSchema.optional(),
  userId: z.string().optional(),
  status: workSessionStatusSchema.optional(),
  projectId: z.string().optional(),
});

export const timesheetEntrySchema = sessionSchema.extend({
  username: z.string(),
  nickname: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

export const timesheetResponseSchema = z.object({
  month: monthKeySchema,
  calendar: calendarSystemSchema,
  entries: z.array(timesheetEntrySchema),
  totals: z.object({
    approvedMinutes: z.number().nonnegative(),
    pendingMinutes: z.number().nonnegative(),
    rejectedMinutes: z.number().nonnegative(),
  }),
});

export type ReviewSessionInputDto = z.infer<typeof reviewSessionInputSchema>;
export type BulkReviewInputDto = z.infer<typeof bulkReviewInputSchema>;
export type TimesheetQueryDto = z.infer<typeof timesheetQuerySchema>;
export type TimesheetEntryDto = z.infer<typeof timesheetEntrySchema>;
export type TimesheetResponseDto = z.infer<typeof timesheetResponseSchema>;
