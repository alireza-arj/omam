import { z } from "zod";
import { calendarSystemSchema, currencySchema } from "./common";

export const settingsSchema = z.object({
  hourlyRate: z.number().nonnegative(),
  currency: currencySchema,
  monthlyGoalHours: z.number().nonnegative(),
  /** The calendar dates are read in. Instants stay absolute ISO-8601. */
  calendar: calendarSystemSchema,
});

export const updateSettingsInputSchema = z.object({
  hourlyRate: z.number().nonnegative(),
  currency: currencySchema,
  monthlyGoalHours: z.number().nonnegative(),
  calendar: calendarSystemSchema.default("JALALI"),
});

export type SettingsDto = z.infer<typeof settingsSchema>;
export type UpdateSettingsInputDto = z.infer<typeof updateSettingsInputSchema>;
