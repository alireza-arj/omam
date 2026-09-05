import type { SQLiteDatabase } from "expo-sqlite";
import { dayKey, monthRange, type CalendarSystem } from "@omam/calendar";
import type {
  SessionDto,
  WorkSessionCategory,
  WorkSessionSource,
  WorkSessionStatus,
} from "@omam/contracts";
import { generateId } from "./id";

function now() {
  return new Date().toISOString();
}

function calculateSessionMinutes(startAt: string, endAt: string): number {
  return Math.max(0, Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000));
}

export type SessionRow = {
  id: string;
  userId: string;
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
  reviewNote: string | null;
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
    clientId: row.id,
    startAt: row.startAt,
    endAt: row.endAt,
    durationMinutes: row.durationMinutes,
    category: row.category,
    status: row.status,
    source: row.source,
    note: row.note,
    reviewNote: row.reviewNote,
    project: row.projectId
      ? {
          id: row.projectId,
          name: row.projectName ?? "Project",
          color: row.projectColor ?? "#B4213C",
        }
      : null,
    approvedAt: null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Deleted rows stay until the server has seen the deletion. */
const LIVE = "deletedAt IS NULL";

export async function getSessions(db: SQLiteDatabase, userId: string, from?: string, to?: string) {
  let query = `SELECT * FROM WorkSession WHERE userId = ? AND ${LIVE}`;
  const params: (string | number)[] = [userId];

  if (from) {
    query += " AND startAt >= ?";
    params.push(from);
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
    `SELECT * FROM WorkSession WHERE userId = ? AND endAt IS NULL AND ${LIVE} ORDER BY startAt DESC`,
    [userId],
  );
  return row ? toSessionDto(row) : null;
}

async function readSession(db: SQLiteDatabase, id: string) {
  return (await db.getFirstAsync<SessionRow>("SELECT * FROM WorkSession WHERE id = ?", [id]))!;
}

async function requireOwnSession(db: SQLiteDatabase, sessionId: string, userId: string) {
  const row = await db.getFirstAsync<SessionRow>(
    `SELECT * FROM WorkSession WHERE id = ? AND userId = ? AND ${LIVE}`,
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

  const id = generateId();
  const ts = now();

  await db.runAsync(
    "INSERT INTO WorkSession (id, userId, startAt, durationMinutes, category, note, createdAt, updatedAt, status, source, dirty) VALUES (?, ?, ?, 0, ?, ?, ?, ?, 'OPEN', 'TIMER', 1)",
    [id, userId, startAt, category, note ?? null, ts, ts],
  );

  return toSessionDto(await readSession(db, id));
}

export async function clockOut(db: SQLiteDatabase, sessionId: string, userId: string, endAt: string) {
  const session = await requireOwnSession(db, sessionId, userId);

  if (session.endAt) {
    throw new Error("SESSION_ALREADY_ENDED");
  }

  const endDate = new Date(endAt);
  if (endDate.getTime() < new Date(session.startAt).getTime()) {
    throw new Error("END_BEFORE_START");
  }

  await db.runAsync(
    "UPDATE WorkSession SET endAt = ?, durationMinutes = ?, updatedAt = ?, status = 'PENDING', dirty = 1 WHERE id = ?",
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

  const endDate = endAt ? new Date(endAt) : null;
  if (endDate && endDate.getTime() < new Date(startAt).getTime()) {
    throw new Error("END_BEFORE_START");
  }

  await db.runAsync(
    "UPDATE WorkSession SET startAt = ?, endAt = ?, durationMinutes = ?, category = ?, note = ?, updatedAt = ?, status = ?, dirty = 1 WHERE id = ?",
    [
      startAt,
      endAt,
      endDate ? calculateSessionMinutes(startAt, endAt!) : 0,
      category,
      note,
      now(),
      // An edit puts approved time back in the queue; the server applies the
      // same rule, so the two agree without a round trip.
      endAt ? "PENDING" : "OPEN",
      sessionId,
    ],
  );

  return toSessionDto(await readSession(db, sessionId));
}

export async function getSessionById(db: SQLiteDatabase, sessionId: string, userId: string) {
  const row = await db.getFirstAsync<SessionRow>(
    `SELECT * FROM WorkSession WHERE id = ? AND userId = ? AND ${LIVE}`,
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
    "INSERT INTO WorkSession (id, userId, startAt, endAt, durationMinutes, category, note, createdAt, updatedAt, status, source, dirty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL', 1)",
    [
      id,
      userId,
      startAt,
      endAt,
      endAt ? calculateSessionMinutes(startAt, endAt) : 0,
      category,
      note,
      ts,
      ts,
      endAt ? "PENDING" : "OPEN",
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
  const ts = now();

  // A row the server has never seen has nothing to tell it about.
  if (!session.remoteId && !session.syncedAt) {
    await db.runAsync("DELETE FROM WorkSession WHERE id = ?", [sessionId]);
    return;
  }

  await db.runAsync(
    "UPDATE WorkSession SET deletedAt = ?, updatedAt = ?, dirty = 1 WHERE id = ?",
    [ts, ts, sessionId],
  );
}

export async function getMonthlySummary(
  db: SQLiteDatabase,
  userId: string,
  month: string,
  calendar: CalendarSystem,
): Promise<{
  totalMinutes: number;
  approvedMinutes: number;
  pendingMinutes: number;
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
    `SELECT * FROM WorkSession WHERE userId = ? AND startAt >= ? AND startAt <= ? AND ${LIVE}`,
    [userId, range.from.toISOString(), range.to.toISOString()],
  );

  const settings = await db.getFirstAsync<{ hourlyRate: number }>(
    "SELECT hourlyRate FROM AppSettings WHERE userId = ?",
    [userId],
  );

  const activeSession = await getActiveSession(db, userId);

  let totalMinutes = 0;
  let approvedMinutes = 0;
  let pendingMinutes = 0;
  const categoryMinutes = {
    onsite: 0,
    remote: 0,
  };
  const workedDaysSet = new Set<string>();

  for (const session of sessions) {
    if (session.status === "REJECTED") {
      continue;
    }

    workedDaysSet.add(dayKey(new Date(session.startAt), calendar));

    if (!session.endAt) {
      continue;
    }

    const minutes =
      session.durationMinutes || calculateSessionMinutes(session.startAt, session.endAt);

    totalMinutes += minutes;

    if (session.status === "APPROVED") {
      approvedMinutes += minutes;
    } else {
      pendingMinutes += minutes;
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
    approvedMinutes,
    pendingMinutes,
    totalIncome: Number(((totalMinutes / 60) * hourlyRate).toFixed(2)),
    activeSession,
    workedDays: workedDaysSet.size,
    categoryMinutes,
  };
}
