import { z } from "zod";
import { LANGUAGES } from "@omam/i18n";

/**
 * An absolute instant. Every timestamp crossing the API is ISO-8601 with a
 * zone, so a calendar only ever decides how it is *read*.
 */
export const isoDateTime = z.string().datetime({ offset: true });

/** `YYYY-MM`, read in whichever calendar the caller names. */
export const monthKeySchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected a YYYY-MM month key.");

export const currencySchema = z.enum(["IRR", "USD", "EUR"]);
export const calendarSystemSchema = z.enum(["JALALI", "GREGORIAN"]);

/**
 * Lowercase, unlike the other enums here: these values go straight into an
 * HTML `lang` attribute and a BCP-47 tag. The list lives in `@omam/i18n`.
 */
export const languageSchema = z.enum(LANGUAGES);
export const workSessionCategorySchema = z.enum(["ONSITE", "REMOTE"]);
export const workSessionStatusSchema = z.enum(["OPEN", "COMPLETED"]);
export const workSessionSourceSchema = z.enum(["TIMER", "MANUAL", "SYNC", "ADMIN"]);
export const orgRoleSchema = z.enum(["OWNER", "MANAGER", "MEMBER"]);
export const membershipStatusSchema = z.enum(["ACTIVE", "SUSPENDED"]);
export const payTypeSchema = z.enum(["HOURLY", "MONTHLY"]);
export const payrollStatusSchema = z.enum(["DRAFT", "LOCKED", "PAID"]);

export const errorResponseSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type Currency = z.infer<typeof currencySchema>;
export type CalendarSystemDto = z.infer<typeof calendarSystemSchema>;
export type LanguageDto = z.infer<typeof languageSchema>;
export type WorkSessionCategory = z.infer<typeof workSessionCategorySchema>;
export type WorkSessionStatus = z.infer<typeof workSessionStatusSchema>;
export type WorkSessionSource = z.infer<typeof workSessionSourceSchema>;
export type OrgRole = z.infer<typeof orgRoleSchema>;
export type MembershipStatus = z.infer<typeof membershipStatusSchema>;
export type PayType = z.infer<typeof payTypeSchema>;
export type PayrollStatus = z.infer<typeof payrollStatusSchema>;
export type ErrorResponseDto = z.infer<typeof errorResponseSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;

/** OWNER outranks MANAGER outranks MEMBER. Used by every permission check. */
export const ROLE_RANK: Record<OrgRole, number> = {
  OWNER: 3,
  MANAGER: 2,
  MEMBER: 1,
};

export function roleAtLeast(role: OrgRole, minimum: OrgRole) {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
