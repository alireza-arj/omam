import { z } from "zod";
import { calendarSystemSchema, currencySchema, languageSchema } from "./common";

export const settingsSchema = z.object({
  hourlyRate: z.number().nonnegative(),
  currency: currencySchema,
  monthlyGoalHours: z.number().nonnegative(),
  /** The calendar dates are read in. Instants stay absolute ISO-8601. */
  calendar: calendarSystemSchema,
  /** The language the interface is read in, and with it the text direction. */
  language: languageSchema,
});

export const updateSettingsInputSchema = z.object({
  hourlyRate: z.number().nonnegative(),
  currency: currencySchema,
  monthlyGoalHours: z.number().nonnegative(),
  calendar: calendarSystemSchema.default("JALALI"),
  language: languageSchema.default("en"),
});

export type SettingsDto = z.infer<typeof settingsSchema>;
export type UpdateSettingsInputDto = z.infer<typeof updateSettingsInputSchema>;
