import type { SQLiteDatabase } from "../sqlite-context";
import { dayKey, monthRange, workSegments, type CalendarSystem } from "@omam/calendar";
import type {
  SessionDto,
  WorkSessionCategory,
  WorkSessionSource,
  WorkSessionStatus,
} from "@omam/contracts";
import { generateId } from "./id";
import { TEAM_SCOPE } from "./scope";

function now() {
  return new Date().toISOString();
}

function calculateSessionMinutes(startAt: string, endAt: string): number {
  return Math.max(0, Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000));
}

export type SessionRow = {
  id: string;
  userId: string;
  organizationId: string | null;
  deviceId: string | null;
  deviceName: string | null;
  startAt: string;
  endAt: string | null;
  durationMinutes: number;
  category: WorkSessionCategory;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  remoteId: string | null;
  status: WorkSessionStatus;
  source: WorkSessionSource;
  projectId: string | null;
  projectName: string | null;
  projectColor: string | null;
  dirty: number;
  deletedAt: string | null;
  syncedAt: string | null;
};

/**
 * The local row id doubles as the `clientId` the server keys a pushed session
 * on, which is what makes a repeated push idempotent.
 */
export function toSessionDto(row: SessionRow): SessionDto {
  return {
    id: row.id,
    userId: row.userId,
    organizationId: row.organizationId,
    clientId: row.id,
    deviceId: row.deviceId,
    deviceName: row.deviceName,
    startAt: row.startAt,
    endAt: row.endAt,
    durationMinutes: row.durationMinutes,
    category: row.category,
    status: row.status,
    source: row.source,
    note: row.note,
    project: row.projectId
      ? {
          id: row.projectId,
          name: row.projectName ?? "Project",
          color: row.projectColor ?? "#B4213C",
        }
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Deleted rows stay until the server has seen the deletion. */
const LIVE = "deletedAt IS NULL";

async function assertEditable(db: SQLiteDatabase, userId: string, startAt: string, endAt: string | null) {
  const locked = await db.getFirstAsync<{ month: string }>(
    `SELECT month FROM LockedPeriod WHERE organizationId = (SELECT organizationId FROM SyncState WHERE userId = ?)
      AND fromAt ${endAt && endAt > startAt ? "<" : "<="} ? AND toAt >= ? LIMIT 1`, [userId, endAt ?? startAt, startAt]);
  if (locked) throw new Error("PAYROLL_LOCKED");
}

export async function getSessions(db: SQLiteDatabase, userId: string, from?: string, to?: string) {
  let query = `SELECT * FROM WorkSession WHERE userId = ? AND ${LIVE} AND ${TEAM_SCOPE}`;
  const params: (string | number)[] = [userId];

  if (from) {
    query += " AND (endAt > ? OR (endAt IS NULL AND startAt >= ?))";
    params.push(from, from);
  }
  if (to) {
    query += " AND startAt <= ?";
    params.push(to);
  }

  query += " ORDER BY startAt DESC";

  const rows = await db.getAllAsync<SessionRow>(query, params);
  return rows.map(toSessionDto);
}

export async function getActiveSession(db: SQLiteDatabase, userId: string) {
  const row = await db.getFirstAsync<SessionRow>(
    `SELECT * FROM WorkSession WHERE userId = ? AND endAt IS NULL AND ${LIVE} AND ${TEAM_SCOPE} ORDER BY startAt DESC`,
    [userId],
  );
  return row ? toSessionDto(row) : null;
}

async function readSession(db: SQLiteDatabase, id: string) {
  return (await db.getFirstAsync<SessionRow>("SELECT * FROM WorkSession WHERE id = ?", [id]))!;
}

async function requireOwnSession(db: SQLiteDatabase, sessionId: string, userId: string) {
  const row = await db.getFirstAsync<SessionRow>(
    `SELECT * FROM WorkSession WHERE id = ? AND userId = ? AND ${LIVE} AND ${TEAM_SCOPE}`,
    [sessionId, userId],
  );

  if (!row) {
    throw new Error("SESSION_NOT_FOUND");
  }

  return row;
}

export async function clockIn(
  db: SQLiteDatabase,
  userId: string,
  startAt: string,
  category: WorkSessionCategory,
  note?: string | null,
) {
  const active = await getActiveSession(db, userId);
  if (active) {
    throw new Error("SESSION_ACTIVE");
  }

  await assertEditable(db, userId, startAt, null);
  const id = generateId();
  const ts = now();

  await db.runAsync(
    "INSERT INTO WorkSession (id, userId, organizationId, deviceId, deviceName, startAt, durationMinutes, category, note, createdAt, updatedAt, status, source, dirty) VALUES (?, ?, (SELECT organizationId FROM SyncState WHERE userId = ?), (SELECT id FROM AppDevice LIMIT 1), (SELECT name FROM AppDevice LIMIT 1), ?, 0, ?, ?, ?, ?, 'OPEN', 'TIMER', 1)",
    [id, userId, userId, startAt, category, note ?? null, ts, ts],
  );

  return toSessionDto(await readSession(db, id));
}

export async function clockOut(db: SQLiteDatabase, sessionId: string, userId: string, endAt: string) {
  const session = await requireOwnSession(db, sessionId, userId);

  if (session.endAt) {
    throw new Error("SESSION_ALREADY_ENDED");
  }

  await assertEditable(db, userId, session.startAt, endAt);
  const endDate = new Date(endAt);
  if (endDate.getTime() < new Date(session.startAt).getTime()) {
    throw new Error("END_BEFORE_START");
  }

  await db.runAsync(
    "UPDATE WorkSession SET endAt = ?, durationMinutes = ?, updatedAt = ?, status = 'COMPLETED', dirty = 1, syncError = NULL WHERE id = ?",
    [endAt, calculateSessionMinutes(session.startAt, endAt), now(), sessionId],
  );

  return toSessionDto(await readSession(db, sessionId));
}

export async function updateSession(
  db: SQLiteDatabase,
  sessionId: string,
  userId: string,
  startAt: string,
  endAt: string | null,
  category: WorkSessionCategory,
  note: string | null,
) {
  const session = await requireOwnSession(db, sessionId, userId);

  await assertEditable(db, userId, session.startAt, session.endAt);
  await assertEditable(db, userId, startAt, endAt);
  const endDate = endAt ? new Date(endAt) : null;
  if (endDate && endDate.getTime() < new Date(startAt).getTime()) {
    throw new Error("END_BEFORE_START");
  }

  await db.runAsync(
    "UPDATE WorkSession SET startAt = ?, endAt = ?, durationMinutes = ?, category = ?, note = ?, updatedAt = ?, status = ?, dirty = 1, syncError = NULL WHERE id = ?",
    [
      startAt,
      endAt,
      endDate ? calculateSessionMinutes(startAt, endAt!) : 0,
      category,
      note,
      now(),
      endAt ? "COMPLETED" : "OPEN",
      sessionId,
    ],
  );

  return toSessionDto(await readSession(db, sessionId));
}

export async function getSessionById(db: SQLiteDatabase, sessionId: string, userId: string) {
  const row = await db.getFirstAsync<SessionRow>(
    `SELECT * FROM WorkSession WHERE id = ? AND userId = ? AND ${LIVE} AND ${TEAM_SCOPE}`,
    [sessionId, userId],
  );

  return row ? toSessionDto(row) : null;
}

export async function createSession(
  db: SQLiteDatabase,
  userId: string,
  startAt: string,
  endAt: string | null,
  category: WorkSessionCategory,
  note: string | null,
) {
  await assertEditable(db, userId, startAt, endAt);
  const endDate = endAt ? new Date(endAt) : null;

  if (endDate && endDate.getTime() < new Date(startAt).getTime()) {
    throw new Error("END_BEFORE_START");
  }

  if (!endAt) {
    const active = await getActiveSession(db, userId);

    if (active) {
      throw new Error("SESSION_ACTIVE");
    }
  }

  const id = generateId();
  const ts = now();

  await db.runAsync(
    "INSERT INTO WorkSession (id, userId, organizationId, deviceId, deviceName, startAt, endAt, durationMinutes, category, note, createdAt, updatedAt, status, source, dirty) VALUES (?, ?, (SELECT organizationId FROM SyncState WHERE userId = ?), (SELECT id FROM AppDevice LIMIT 1), (SELECT name FROM AppDevice LIMIT 1), ?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL', 1)",
    [
      id,
      userId,
      userId,
      startAt,
      endAt,
      endAt ? calculateSessionMinutes(startAt, endAt) : 0,
      category,
      note,
      ts,
      ts,
      endAt ? "COMPLETED" : "OPEN",
    ],
  );

  return toSessionDto(await readSession(db, id));
}

/**
 * Soft delete. A row removed outright would be invisible to the sync, which
 * would then pull the server's copy straight back onto the device.
 */
export async function deleteSession(db: SQLiteDatabase, sessionId: string, userId: string) {
  const session = await requireOwnSession(db, sessionId, userId);
  await assertEditable(db, userId, session.startAt, session.endAt);
  const ts = now();

  await db.runAsync(
    "UPDATE WorkSession SET deletedAt = ?, updatedAt = ?, dirty = 1, syncError = NULL WHERE id = ?",
    [ts, ts, sessionId],
  );
}

export type SessionConflict = { sessions: SessionDto[] };

export async function getSessionConflicts(db: SQLiteDatabase, userId: string): Promise<SessionConflict[]> {
  const rejected = await db.getAllAsync<SessionRow>(`SELECT * FROM WorkSession WHERE userId = ? AND syncError = 'SESSION_CONFLICT' AND ${LIVE} AND ${TEAM_SCOPE}`, [userId]);
  const conflicts: SessionConflict[] = [];
  for (const incoming of rejected) {
    const overlapping = await db.getAllAsync<SessionRow>(
      `SELECT * FROM WorkSession WHERE userId = ? AND id != ? AND ${LIVE} AND ${TEAM_SCOPE}
       AND (endAt IS NULL OR endAt > ?) AND (? IS NULL OR startAt < ?)
       AND (deviceId IS NULL OR ? IS NULL OR deviceId != ?)
       AND (source = 'TIMER' OR endAt IS NULL) ORDER BY startAt`,
      [userId, incoming.id, incoming.startAt, incoming.endAt, incoming.endAt, incoming.deviceId, incoming.deviceId],
    );
    if (overlapping.length) conflicts.push({ sessions: [incoming, ...overlapping].map(toSessionDto) });
    else await db.runAsync("UPDATE WorkSession SET syncError = NULL WHERE id = ?", [incoming.id]);
  }
  return conflicts;
}

export async function resolveSessionConflict(db: SQLiteDatabase, userId: string, conflict: SessionConflict, keepId: string) {
  if (!conflict.sessions.some((session) => session.id === keepId)) throw new Error("SESSION_NOT_FOUND");
  const rows = await Promise.all(conflict.sessions.map((session) => requireOwnSession(db, session.id, userId)));
  for (const row of rows) await assertEditable(db, userId, row.startAt, row.endAt);
  const stamp = now();
  await db.runBatchAsync(rows.map((row) => ({
    sql: row.id === keepId
      ? "UPDATE WorkSession SET dirty = 1, syncError = NULL, updatedAt = ? WHERE id = ?"
      : "UPDATE WorkSession SET deletedAt = ?, updatedAt = ?, dirty = 1, syncError = NULL WHERE id = ?",
    params: row.id === keepId ? [stamp, row.id] : [stamp, stamp, row.id],
  })));
}

export async function getMonthlySummary(
  db: SQLiteDatabase,
  userId: string,
  month: string,
  calendar: CalendarSystem,
): Promise<{
  totalMinutes: number;
  completedMinutes: number;
  totalIncome: number;
  activeSession: SessionDto | null;
  workedDays: number;
  categoryMinutes: {
    onsite: number;
    remote: number;
  };
}> {
  const range = monthRange(month, calendar);

  const sessions = await db.getAllAsync<SessionRow>(
    `SELECT * FROM WorkSession WHERE userId = ? AND (endAt > ? OR (endAt IS NULL AND startAt >= ?)) AND startAt <= ? AND ${LIVE} AND ${TEAM_SCOPE}`,
    [userId, range.from.toISOString(), range.from.toISOString(), range.to.toISOString()],
  );

  const settings = await db.getFirstAsync<{ hourlyRate: number }>(
    "SELECT hourlyRate FROM AppSettings WHERE userId = ?",
    [userId],
  );

  const activeSession = await getActiveSession(db, userId);

  let totalMinutes = 0;
  let completedMinutes = 0;
  const categoryMinutes = {
    onsite: 0,
    remote: 0,
  };
  const workedDaysSet = new Set<string>();

  for (const session of sessions) {
    if (!session.endAt) {
      continue;
    }

    const segments = workSegments(new Date(session.startAt), new Date(session.endAt), range, calendar);
    const minutes = segments.reduce((sum, segment) => sum + segment.minutes, 0);
    for (const segment of segments) if (segment.minutes > 0) workedDaysSet.add(segment.day);

    totalMinutes += minutes;

    if (session.status === "COMPLETED") {
      completedMinutes += minutes;
    }

    if (session.category === "REMOTE") {
      categoryMinutes.remote += minutes;
    } else {
      categoryMinutes.onsite += minutes;
    }
  }

  const hourlyRate = settings?.hourlyRate ?? 0;

  return {
    totalMinutes,
    completedMinutes,
    totalIncome: Number(((totalMinutes / 60) * hourlyRate).toFixed(2)),
    activeSession,
    workedDays: workedDaysSet.size,
    categoryMinutes,
  };
}
