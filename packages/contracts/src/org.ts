import { z } from "zod";
import {
  calendarSystemSchema,
  currencySchema,
  languageSchema,
  membershipStatusSchema,
  orgRoleSchema,
  payTypeSchema,
} from "./common";

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  timezone: z.string(),
  calendar: calendarSystemSchema,
  /** What a new member's account starts in; each person can change their own. */
  language: languageSchema,
  currency: currencySchema,
  defaultHourlyRate: z.number().nonnegative(),
  monthlyGoalHours: z.number().nonnegative(),
  requireApproval: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const updateOrganizationInputSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  calendar: calendarSystemSchema.optional(),
  language: languageSchema.optional(),
  currency: currencySchema.optional(),
  defaultHourlyRate: z.number().nonnegative().optional(),
  monthlyGoalHours: z.number().nonnegative().max(744).optional(),
  requireApproval: z.boolean().optional(),
});

export const memberSchema = z.object({
  membershipId: z.string(),
  userId: z.string(),
  username: z.string(),
  nickname: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  email: z.string().nullable(),
  role: orgRoleSchema,
  status: membershipStatusSchema,
  employeeCode: z.string().nullable(),
  jobTitle: z.string().nullable(),
  payType: payTypeSchema,
  hourlyRate: z.number().nonnegative(),
  monthlySalary: z.number().nonnegative(),
  currency: currencySchema,
  monthlyGoalHours: z.number().nonnegative(),
  joinedAt: z.string(),
  leftAt: z.string().nullable(),
  lastLoginAt: z.string().nullable(),
});

export const membersResponseSchema = z.object({
  members: z.array(memberSchema),
});

export const updateMemberInputSchema = z.object({
  role: orgRoleSchema.optional(),
  status: membershipStatusSchema.optional(),
  employeeCode: z.string().trim().max(32).nullable().optional(),
  jobTitle: z.string().trim().max(80).nullable().optional(),
  payType: payTypeSchema.optional(),
  hourlyRate: z.number().nonnegative().optional(),
  monthlySalary: z.number().nonnegative().optional(),
  currency: currencySchema.optional(),
  monthlyGoalHours: z.number().nonnegative().max(744).optional(),
});

export const resetMemberPasswordInputSchema = z.object({
  nextPassword: z.string().min(6).max(72),
});

export const inviteSchema = z.object({
  id: z.string(),
  code: z.string(),
  role: orgRoleSchema,
  label: z.string().nullable(),
  payType: payTypeSchema,
  hourlyRate: z.number().nonnegative(),
  monthlySalary: z.number().nonnegative(),
  createdByName: z.string(),
  acceptedByName: z.string().nullable(),
  acceptedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  expiresAt: z.string(),
  createdAt: z.string(),
});

export const invitesResponseSchema = z.object({
  invites: z.array(inviteSchema),
});

export const createInviteInputSchema = z.object({
  role: orgRoleSchema.default("MEMBER"),
  label: z.string().trim().max(80).nullable().optional(),
  payType: payTypeSchema.default("HOURLY"),
  hourlyRate: z.number().nonnegative().default(0),
  monthlySalary: z.number().nonnegative().default(0),
  expiresInDays: z.number().int().min(1).max(365).default(14),
});

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  archived: z.boolean(),
  totalMinutes: z.number().nonnegative().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const projectsResponseSchema = z.object({
  projects: z.array(projectSchema),
});

export const createProjectInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Expected a hex colour such as #B4213C.")
    .default("#B4213C"),
});

export const updateProjectInputSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  archived: z.boolean().optional(),
});

export const auditLogSchema = z.object({
  id: z.string(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().nullable(),
  actorName: z.string().nullable(),
  metadata: z.unknown().nullable(),
  createdAt: z.string(),
});

export const auditLogsResponseSchema = z.object({
  entries: z.array(auditLogSchema),
  total: z.number().nonnegative(),
});

export type OrganizationDto = z.infer<typeof organizationSchema>;
export type UpdateOrganizationInputDto = z.infer<typeof updateOrganizationInputSchema>;
export type MemberDto = z.infer<typeof memberSchema>;
export type MembersResponseDto = z.infer<typeof membersResponseSchema>;
export type UpdateMemberInputDto = z.infer<typeof updateMemberInputSchema>;
export type ResetMemberPasswordInputDto = z.infer<typeof resetMemberPasswordInputSchema>;
export type InviteDto = z.infer<typeof inviteSchema>;
export type InvitesResponseDto = z.infer<typeof invitesResponseSchema>;
export type CreateInviteInputDto = z.infer<typeof createInviteInputSchema>;
export type ProjectDto = z.infer<typeof projectSchema>;
export type ProjectsResponseDto = z.infer<typeof projectsResponseSchema>;
export type CreateProjectInputDto = z.infer<typeof createProjectInputSchema>;
export type UpdateProjectInputDto = z.infer<typeof updateProjectInputSchema>;
export type AuditLogDto = z.infer<typeof auditLogSchema>;
export type AuditLogsResponseDto = z.infer<typeof auditLogsResponseSchema>;
