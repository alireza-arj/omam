import { z } from "zod";
export declare const currencySchema: z.ZodEnum<{
    IRR: "IRR";
    USD: "USD";
}>;
export declare const authUserSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const authResponseSchema: z.ZodObject<{
    token: z.ZodString;
    user: z.ZodObject<{
        id: z.ZodString;
        email: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const loginInputSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export declare const sessionSchema: z.ZodObject<{
    id: z.ZodString;
    startAt: z.ZodString;
    endAt: z.ZodNullable<z.ZodString>;
    durationMinutes: z.ZodNumber;
    note: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const settingsSchema: z.ZodObject<{
    hourlyRate: z.ZodNumber;
    currency: z.ZodEnum<{
        IRR: "IRR";
        USD: "USD";
    }>;
    monthlyGoalHours: z.ZodNumber;
}, z.core.$strip>;
export declare const summarySchema: z.ZodObject<{
    totalMinutes: z.ZodNumber;
    totalIncome: z.ZodNumber;
    activeSession: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        startAt: z.ZodString;
        endAt: z.ZodNullable<z.ZodString>;
        durationMinutes: z.ZodNumber;
        note: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>>;
    workedDays: z.ZodNumber;
}, z.core.$strip>;
export declare const sessionsResponseSchema: z.ZodObject<{
    sessions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        startAt: z.ZodString;
        endAt: z.ZodNullable<z.ZodString>;
        durationMinutes: z.ZodNumber;
        note: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const summaryResponseSchema: z.ZodObject<{
    month: z.ZodString;
    summary: z.ZodObject<{
        totalMinutes: z.ZodNumber;
        totalIncome: z.ZodNumber;
        activeSession: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            startAt: z.ZodString;
            endAt: z.ZodNullable<z.ZodString>;
            durationMinutes: z.ZodNumber;
            note: z.ZodNullable<z.ZodString>;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
        }, z.core.$strip>>;
        workedDays: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const updateSettingsInputSchema: z.ZodObject<{
    hourlyRate: z.ZodNumber;
    currency: z.ZodEnum<{
        IRR: "IRR";
        USD: "USD";
    }>;
    monthlyGoalHours: z.ZodNumber;
}, z.core.$strip>;
export declare const clockInInputSchema: z.ZodObject<{
    startAt: z.ZodString;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const clockOutInputSchema: z.ZodObject<{
    endAt: z.ZodString;
}, z.core.$strip>;
export declare const updateSessionInputSchema: z.ZodObject<{
    startAt: z.ZodString;
    endAt: z.ZodNullable<z.ZodString>;
    note: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type AuthUserDto = z.infer<typeof authUserSchema>;
export type AuthResponseDto = z.infer<typeof authResponseSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type SessionDto = z.infer<typeof sessionSchema>;
export type SettingsDto = z.infer<typeof settingsSchema>;
export type SummaryDto = z.infer<typeof summarySchema>;
export type SessionsResponseDto = z.infer<typeof sessionsResponseSchema>;
export type SummaryResponseDto = z.infer<typeof summaryResponseSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>;
export type ClockInInput = z.infer<typeof clockInInputSchema>;
export type ClockOutInput = z.infer<typeof clockOutInputSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionInputSchema>;
