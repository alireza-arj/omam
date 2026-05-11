import { z } from "zod";
export const currencySchema = z.enum(["IRR", "USD"]);
export const authUserSchema = z.object({
    id: z.string(),
    email: z.string().email(),
    createdAt: z.string(),
    updatedAt: z.string(),
});
export const authResponseSchema = z.object({
    token: z.string().min(1),
    user: authUserSchema,
});
export const loginInputSchema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(6).max(72),
});
export const sessionSchema = z.object({
    id: z.string(),
    startAt: z.string(),
    endAt: z.string().nullable(),
    durationMinutes: z.number().nonnegative(),
    note: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
});
export const settingsSchema = z.object({
    hourlyRate: z.number().nonnegative(),
    currency: currencySchema,
    monthlyGoalHours: z.number().nonnegative(),
});
export const summarySchema = z.object({
    totalMinutes: z.number().nonnegative(),
    totalIncome: z.number().nonnegative(),
    activeSession: sessionSchema.nullable(),
    workedDays: z.number().nonnegative(),
});
export const sessionsResponseSchema = z.object({
    sessions: z.array(sessionSchema),
});
export const summaryResponseSchema = z.object({
    month: z.string(),
    summary: summarySchema,
});
export const updateSettingsInputSchema = settingsSchema;
export const clockInInputSchema = z.object({
    startAt: z.string().datetime(),
    note: z.string().trim().min(1).max(240).nullable().optional(),
});
export const clockOutInputSchema = z.object({
    endAt: z.string().datetime(),
});
export const updateSessionInputSchema = z.object({
    startAt: z.string().datetime(),
    endAt: z.string().datetime().nullable(),
    note: z.string().trim().max(240).nullable(),
});
