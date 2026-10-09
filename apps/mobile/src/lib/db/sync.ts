import { TEAM_SCOPE } from "./scope";
import type { SQLiteDatabase } from "../sqlite-context";
import type { SyncPushResultDto, SyncResponseDto, SyncSessionInputDto } from "@omam/contracts";

export type SyncStateRow = {
  userId: string;
  serverUserId: string | null;
  serverUsername: string | null;
  organizationName: string | null;
  organizationId: string | null;
  cursor: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
};

/** One push carries at most this many rows, so a long backlog drains in batches. */
export const PUSH_BATCH_SIZE = 200;

export async function readSyncState(db: SQLiteDatabase, userId: string) {
  return db.getFirstAsync<SyncStateRow>("SELECT * FROM SyncState WHERE userId = ?", [userId]);
}

export async function writeSyncState(
  db: SQLiteDatabase,
  userId: string,
  patch: Partial<Omit<SyncStateRow, "userId">>,
) {
  const existing = await readSyncState(db, userId);
  const next = {
    serverUserId: patch.serverUserId ?? existing?.serverUserId ?? null,
    serverUsername: patch.serverUsername ?? existing?.serverUsername ?? null,
    organizationName: patch.organizationName ?? existing?.organizationName ?? null,
    organizationId: patch.organizationId !== undefined ? patch.organizationId : (existing?.organizationId ?? null),
    cursor: patch.cursor !== undefined ? patch.cursor : (existing?.cursor ?? null),
    lastSyncAt: patch.lastSyncAt !== undefined ? patch.lastSyncAt : (existing?.lastSyncAt ?? null),
    lastError: patch.lastError !== undefined ? patch.lastError : (existing?.lastError ?? null),
  };

  await db.runAsync(
    `INSERT INTO SyncState (userId, serverUserId, serverUsername, organizationName, organizationId, cursor, lastSyncAt, lastError)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(userId) DO UPDATE SET
       serverUserId = excluded.serverUserId,
       serverUsername = excluded.serverUsername,
       organizationName = excluded.organizationName,
       organizationId = excluded.organizationId,
       cursor = excluded.cursor,
       lastSyncAt = excluded.lastSyncAt,
       lastError = excluded.lastError`,
    [
      userId,
      next.serverUserId,
      next.serverUsername,
      next.organizationName,
      next.organizationId,
      next.cursor,
      next.lastSyncAt,
      next.lastError,
    ],
  );

  return next;
}

export async function clearSyncState(db: SQLiteDatabase, userId: string) {
  await db.runAsync("DELETE FROM SyncState WHERE userId = ?", [userId]);

}

export async function countPending(db: SQLiteDatabase, userId: string) {
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM WorkSession WHERE userId = ? AND dirty = 1 AND syncError IS NULL AND ${TEAM_SCOPE}`,
    [userId],
  );

  return result?.count ?? 0;
}

export async function countRejected(db: SQLiteDatabase, userId: string) {
  const result = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM WorkSession WHERE userId = ? AND syncError IS NOT NULL AND ${TEAM_SCOPE}`, [userId]);
  return result?.count ?? 0;
}

type DirtyRow = {
  id: string;
  deviceId: string | null;
  deviceName: string | null;
  source: SyncSessionInputDto["source"];
  startAt: string;
  endAt: string | null;
  category: "ONSITE" | "REMOTE";
  note: string | null;
  projectId: string | null;
  deletedAt: string | null;
  updatedAt: string;
};

export async function collectDirty(
  db: SQLiteDatabase,
  userId: string,
): Promise<SyncSessionInputDto[]> {
  const rows = await db.getAllAsync<DirtyRow>(
    `SELECT id, deviceId, deviceName, source, startAt, endAt, category, note, projectId, deletedAt, updatedAt
       FROM WorkSession
      WHERE userId = ? AND dirty = 1 AND syncError IS NULL AND ${TEAM_SCOPE}
      ORDER BY CASE WHEN deletedAt IS NOT NULL THEN 0 ELSE 1 END, updatedAt ASC
      LIMIT ?`,
    [userId, PUSH_BATCH_SIZE],
  );

  return rows.map((row) => ({
    clientId: row.id,
    deviceId: row.deviceId,
    deviceName: row.deviceName,
    source: row.source,
    startAt: row.startAt,
    endAt: row.endAt,
    category: row.category,
    note: row.note,
    projectId: row.projectId,
    deletedAt: row.deletedAt,
    updatedAt: row.updatedAt,
  }));
}

/**
 * Clears the dirty flag on rows the server took. A `skipped` row keeps its flag
 * cleared too — the server's copy is newer, and the pull in the same response
 * overwrites the local one — while a `rejected` row stays dirty so the member
 * can see it never landed.
 */
export async function markPushed(db: SQLiteDatabase, results: SyncPushResultDto[], pushed: SyncSessionInputDto[] = []) {
  const now = new Date().toISOString();

  for (const result of results) {
    if (result.outcome === "rejected") {
      const snapshot = pushed.find((row) => row.clientId === result.clientId);
      if (snapshot) await db.runAsync("UPDATE WorkSession SET syncError = ? WHERE id = ? AND updatedAt = ?", [result.reason ?? "REQUEST_FAILED", result.clientId, snapshot.updatedAt]);
      continue;
    }

    const snapshot = pushed.find((row) => row.clientId === result.clientId);
    await db.runAsync(
      `UPDATE WorkSession SET dirty = 0, syncError = NULL, syncedAt = ?, remoteId = COALESCE(?, remoteId) WHERE id = ?${snapshot ? " AND updatedAt = ?" : ""}`,
      snapshot ? [now, result.serverId, result.clientId, snapshot.updatedAt] : [now, result.serverId, result.clientId],
    );
  }
}

/**
 * Writes the server's version of each changed row onto the device.
 *
 * A row the member edited again while the request was in flight is left alone:
 * it is still dirty and newer, so the next push carries it instead of the
 * server's older copy silently winning.
 */
export async function applyServerSessions(
  db: SQLiteDatabase,
  userId: string,
  sessions: SyncResponseDto["sessions"],
  authoritativeIds: string[] = [],
  pushed: SyncSessionInputDto[] = [],
) {
  const now = new Date().toISOString();

  for (const session of sessions) {
    const localId = session.clientId ?? session.id;

    const existing = await db.getFirstAsync<{
      id: string;
      dirty: number;
      updatedAt: string;
    }>("SELECT id, dirty, updatedAt FROM WorkSession WHERE userId = ? AND (id = ? OR remoteId = ?)", [
      userId,
      localId,
      session.id,
    ]);

    if (session.deletedAt) {
      if (existing) await db.runAsync("DELETE FROM WorkSession WHERE id = ?", [existing.id]);
      continue;
    }

    if (
      existing &&
      !authoritativeIds.includes(session.id) &&
      existing.dirty === 1 &&
      (new Date(existing.updatedAt).getTime() > new Date(session.updatedAt).getTime() ||
        pushed.some((snapshot) => snapshot.clientId === localId && snapshot.updatedAt !== existing.updatedAt))
    ) {
      continue;
    }

    const values = [
      session.organizationId ?? null,
      session.deviceId ?? null,
      session.deviceName ?? null,
      session.startAt,
      session.endAt,
      session.durationMinutes,
      session.category,
      session.note,
      session.status,
      session.source,
      session.project?.id ?? null,
      session.project?.name ?? null,
      session.project?.color ?? null,
      session.id,
      session.updatedAt,
      now,
    ];

    if (existing) {
      await db.runAsync(
        `UPDATE WorkSession
            SET organizationId = ?, deviceId = ?, deviceName = ?, startAt = ?, endAt = ?, durationMinutes = ?, category = ?, note = ?,
                status = ?, source = ?, projectId = ?, projectName = ?,
                projectColor = ?, remoteId = ?, updatedAt = ?, syncedAt = ?, dirty = 0,
                deletedAt = NULL, syncError = NULL
          WHERE id = ?`,
        [...values, existing.id],
      );
      continue;
    }

    await db.runAsync(
      `INSERT INTO WorkSession
         (id, userId, organizationId, deviceId, deviceName, startAt, endAt, durationMinutes, category, note, status, source,
          projectId, projectName, projectColor, remoteId, updatedAt, syncedAt,
          createdAt, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [localId, userId, ...values, session.createdAt],
    );
  }
}
