import { z } from "zod";
import { isoDateTime, workSessionCategorySchema } from "./common";
import { sessionSchema } from "./sessions";
import { settingsSchema } from "./settings";

/**
 * A row as the offline app holds it. `clientId` is the local primary key and
 * the idempotency key: pushing the same row twice updates it rather than
 * creating a second one.
 */
export const syncSessionInputSchema = z.object({
  clientId: z.string().min(1).max(64),
  startAt: isoDateTime,
  endAt: isoDateTime.nullable(),
  category: workSessionCategorySchema.default("ONSITE"),
  note: z.string().trim().max(240).nullable().optional(),
  projectId: z.string().nullable().optional(),
  /** Set when the row was deleted locally; the server soft-deletes to match. */
  deletedAt: isoDateTime.nullable().optional(),
  /** The client's own last-write stamp, used to resolve a conflict. */
  updatedAt: isoDateTime,
});

export const syncPushResultSchema = z.object({
  clientId: z.string(),
  serverId: z.string().nullable(),
  /**
   * `applied` — the server took the client's version.
   * `skipped` — the server's copy is newer and the client should adopt it.
   * `rejected` — the row is locked by payroll and cannot change.
   */
  outcome: z.enum(["applied", "skipped", "rejected"]),
  reason: z.string().nullable(),
});

export const syncRequestSchema = z.object({
  /** Server stamp from the previous sync. Omit for a full pull. */
  since: isoDateTime.nullable().optional(),
  sessions: z.array(syncSessionInputSchema).max(500).default([]),
});

export const syncResponseSchema = z.object({
  /** Pass this back as `since` on the next sync. */
  serverTime: z.string(),
  results: z.array(syncPushResultSchema),
  /** Every server row that changed since `since`, deletions included. */
  sessions: z.array(sessionSchema.extend({ deletedAt: z.string().nullable() })),
  settings: settingsSchema,
  organization: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable(),
});

export type SyncSessionInputDto = z.infer<typeof syncSessionInputSchema>;
export type SyncPushResultDto = z.infer<typeof syncPushResultSchema>;
export type SyncRequestDto = z.infer<typeof syncRequestSchema>;
export type SyncResponseDto = z.infer<typeof syncResponseSchema>;
