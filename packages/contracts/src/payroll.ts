import { z } from "zod";
import {
  calendarSystemSchema,
  currencySchema,
  monthKeySchema,
  payTypeSchema,
  payrollStatusSchema,
} from "./common";

export const payrollLineSchema = z.object({
  id: z.string(),
  userId: z.string(),
  username: z.string(),
  nickname: z.string().nullable(),
  employeeCode: z.string().nullable(),
  approvedMinutes: z.number().nonnegative(),
  pendingMinutes: z.number().nonnegative(),
  workedDays: z.number().nonnegative(),
  payType: payTypeSchema,
  hourlyRate: z.number().nonnegative(),
  monthlySalary: z.number().nonnegative(),
  currency: currencySchema,
  grossAmount: z.number(),
  adjustment: z.number(),
  adjustmentNote: z.string().nullable(),
  netAmount: z.number(),
});

export const payrollPeriodSchema = z.object({
  id: z.string(),
  month: monthKeySchema,
  calendar: calendarSystemSchema,
  from: z.string(),
  to: z.string(),
  status: payrollStatusSchema,
  note: z.string().nullable(),
  lockedAt: z.string().nullable(),
  lockedByName: z.string().nullable(),
  currency: currencySchema,
  totalGross: z.number(),
  totalNet: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const payrollPeriodDetailSchema = z.object({
  period: payrollPeriodSchema,
  lines: z.array(payrollLineSchema),
});

export const payrollPeriodsResponseSchema = z.object({
  periods: z.array(payrollPeriodSchema),
});

/**
 * Builds (or rebuilds) a DRAFT period from the approved sessions of the month.
 * A LOCKED period is never recomputed — its numbers are the record of what was
 * paid, so a later rate change must not reach back into it.
 */
export const buildPayrollInputSchema = z.object({
  month: monthKeySchema,
  calendar: calendarSystemSchema.optional(),
});

export const updatePayrollLineInputSchema = z.object({
  adjustment: z.number(),
  adjustmentNote: z.string().trim().max(240).nullable().optional(),
});

export const updatePayrollPeriodInputSchema = z.object({
  status: payrollStatusSchema.optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export type PayrollLineDto = z.infer<typeof payrollLineSchema>;
export type PayrollPeriodDto = z.infer<typeof payrollPeriodSchema>;
export type PayrollPeriodDetailDto = z.infer<typeof payrollPeriodDetailSchema>;
export type PayrollPeriodsResponseDto = z.infer<typeof payrollPeriodsResponseSchema>;
export type BuildPayrollInputDto = z.infer<typeof buildPayrollInputSchema>;
export type UpdatePayrollLineInputDto = z.infer<typeof updatePayrollLineInputSchema>;
export type UpdatePayrollPeriodInputDto = z.infer<typeof updatePayrollPeriodInputSchema>;
