import { z } from "zod";
import { authUserSchema } from "./auth";
import { membershipStatusSchema, orgRoleSchema } from "./common";

export const usersQuerySchema = z.object({
  search: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const directoryUserSchema = authUserSchema.omit({ updatedAt: true }).extend({
  lastLoginAt: z.string().nullable(),
  memberships: z.array(z.object({
    id: z.string(),
    organizationId: z.string(),
    organizationName: z.string(),
    role: orgRoleSchema,
    status: membershipStatusSchema,
  })),
});

export const usersResponseSchema = z.object({
  users: z.array(directoryUserSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export type UsersQueryDto = z.infer<typeof usersQuerySchema>;
export type UsersResponseDto = z.infer<typeof usersResponseSchema>;
