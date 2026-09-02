import { z } from "zod";

export const currencySchema = z.enum(["IRR", "USD"]);
export const calendarSystemSchema = z.enum(["JALALI", "GREGORIAN"]);
export const workSessionCategorySchema = z.enum(["ONSITE", "REMOTE"]);

export const authUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  nickname: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const authResponseSchema = z.object({
  token: z.string().min(1),
  user: authUserSchema,
  needsProfileSetup: z.boolean(),
});

export const loginInputSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6).max(72),
});

export const sessionSchema = z.object({
  id: z.string(),
  startAt: z.string(),
  endAt: z.string().nullable(),
  durationMinutes: z.number().nonnegative(),
  category: workSessionCategorySchema,
  note: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const settingsSchema = z.object({
  hourlyRate: z.number().nonnegative(),
  currency: currencySchema,
  monthlyGoalHours: z.number().nonnegative(),
  /** The calendar dates are read in. Instants stay absolute ISO-8601. */
  calendar: calendarSystemSchema,
});

export const summarySchema = z.object({
  totalMinutes: z.number().nonnegative(),
  totalIncome: z.number().nonnegative(),
  activeSession: sessionSchema.nullable(),
  workedDays: z.number().nonnegative(),
  categoryMinutes: z.object({
    onsite: z.number().nonnegative(),
    remote: z.number().nonnegative(),
  }),
});

export const sessionsResponseSchema = z.object({
  sessions: z.array(sessionSchema),
});

export const summaryResponseSchema = z.object({
  /** `YYYY-MM` in `calendar`, so `1405-06` under Jalali. */
  month: z.string(),
  calendar: calendarSystemSchema,
  summary: summarySchema,
});

export const updateSettingsInputSchema = settingsSchema.extend({
  calendar: calendarSystemSchema.default("JALALI"),
});

export const completeProfileInputSchema = z.object({
  nickname: z.string().trim().min(1).max(80),
  avatarUrl: z.string().trim().max(600000).nullable().optional(),
});

export const clockInInputSchema = z.object({
  startAt: z.string().datetime(),
  category: workSessionCategorySchema.default("ONSITE"),
  note: z.string().trim().min(1).max(240).nullable().optional(),
});

export const clockOutInputSchema = z.object({
  endAt: z.string().datetime(),
});

export const updateSessionInputSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime().nullable(),
  category: workSessionCategorySchema.default("ONSITE"),
  note: z.string().trim().max(240).nullable(),
});

export type Currency = z.infer<typeof currencySchema>;
export type CalendarSystemDto = z.infer<typeof calendarSystemSchema>;
export type WorkSessionCategory = z.infer<typeof workSessionCategorySchema>;
export type AuthUserDto = z.infer<typeof authUserSchema>;
export type AuthResponseDto = z.infer<typeof authResponseSchema>;
export type LoginInputDto = z.infer<typeof loginInputSchema>;
export type SessionDto = z.infer<typeof sessionSchema>;
export type SettingsDto = z.infer<typeof settingsSchema>;
export type SummaryDto = z.infer<typeof summarySchema>;
export type SessionsResponseDto = z.infer<typeof sessionsResponseSchema>;
export type SummaryResponseDto = z.infer<typeof summaryResponseSchema>;
export type UpdateSettingsInputDto = z.infer<typeof updateSettingsInputSchema>;
export type CompleteProfileInputDto = z.infer<typeof completeProfileInputSchema>;
export type ClockInInputDto = z.infer<typeof clockInInputSchema>;
export type ClockOutInputDto = z.infer<typeof clockOutInputSchema>;
export type UpdateSessionInputDto = z.infer<typeof updateSessionInputSchema>;
