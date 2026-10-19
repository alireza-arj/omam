import { z } from "zod";
import { isoDateTime, workSessionCategorySchema, workSessionSourceSchema } from "./common";
import { sessionSchema } from "./sessions";
import { settingsSchema } from "./settings";

/**
 * A row as the offline app holds it. `clientId` is the local primary key and
 * the idempotency key: pushing the same row twice updates it rather than
 * creating a second one.
 */
export const syncSessionInputSchema = z.object({
  clientId: z.string().min(1).max(64),
  deviceId: z.string().max(64).nullable().optional(),
  deviceName: z.string().max(80).nullable().optional(),
  source: workSessionSourceSchema.optional(),
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
  conflicts: z.array(z.object({ clientId: z.string(), sessionIds: z.array(z.string()) })).optional(),
  settings: settingsSchema,
  organization: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable(),
  lockedPeriods: z.array(z.object({ month: z.string(), from: z.string(), to: z.string() })).optional(),
});

export type SyncSessionInputDto = z.infer<typeof syncSessionInputSchema>;
export type SyncPushResultDto = z.infer<typeof syncPushResultSchema>;
export type SyncRequestDto = z.infer<typeof syncRequestSchema>;
export type SyncResponseDto = z.infer<typeof syncResponseSchema>;

export const syncEventInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("authenticate"), token: z.string().min(1).max(512) }),
  z.object({ type: z.literal("ping") }),
]);

export const syncEventSchema = z.object({ type: z.enum(["ready", "changed", "pong"]) });
export type SyncEventDto = z.infer<typeof syncEventSchema>;
