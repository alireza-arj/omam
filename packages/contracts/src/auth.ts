import { z } from "zod";
import {
  calendarSystemSchema,
  currencySchema,
  languageSchema,
  orgRoleSchema,
  payTypeSchema,
} from "./common";

export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers and underscores only.");

export const passwordSchema = z.string().min(6).max(72);

export const authUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().nullable(),
  nickname: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  isSuperAdmin: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** The organization the token is scoped to, flattened for the client. */
export const authMembershipSchema = z.object({
  organizationId: z.string(),
  organizationName: z.string(),
  organizationSlug: z.string(),
  role: orgRoleSchema,
  payType: payTypeSchema,
  hourlyRate: z.number(),
  monthlySalary: z.number(),
  currency: currencySchema,
  monthlyGoalHours: z.number(),
  calendar: calendarSystemSchema,
  language: languageSchema,
  jobTitle: z.string().nullable(),
});

export const authResponseSchema = z.object({
  token: z.string().min(1),
  user: authUserSchema,
  membership: authMembershipSchema.nullable(),
  needsProfileSetup: z.boolean(),
});

export const sessionUserResponseSchema = authResponseSchema.omit({ token: true });

export const loginInputSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  deviceName: z.string().trim().max(80).optional(),
});

/** Joining a team always goes through a manager-issued invite code. */
export const registerInputSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  inviteCode: z.string().trim().min(6).max(40),
  nickname: z.string().trim().min(1).max(80).optional(),
  deviceName: z.string().trim().max(80).optional(),
});

export const completeProfileInputSchema = z.object({
  nickname: z.string().trim().min(1).max(80),
  avatarUrl: z.string().trim().max(600000).nullable().optional(),
});

export const changePasswordInputSchema = z.object({
  currentPassword: passwordSchema,
  nextPassword: passwordSchema,
});

export type AuthUserDto = z.infer<typeof authUserSchema>;
export type AuthMembershipDto = z.infer<typeof authMembershipSchema>;
export type AuthResponseDto = z.infer<typeof authResponseSchema>;
export type SessionUserResponseDto = z.infer<typeof sessionUserResponseSchema>;
export type LoginInputDto = z.infer<typeof loginInputSchema>;
export type RegisterInputDto = z.infer<typeof registerInputSchema>;
export type CompleteProfileInputDto = z.infer<typeof completeProfileInputSchema>;
export type ChangePasswordInputDto = z.infer<typeof changePasswordInputSchema>;
