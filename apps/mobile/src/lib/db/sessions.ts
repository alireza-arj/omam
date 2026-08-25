import type { SQLiteDatabase } from "expo-sqlite";
import type { SessionDto, WorkSessionCategory } from "@omam/contracts";
import { localDayKey, localMonthRange } from "../format";
import { generateId } from "./id";

function now() {
  return new Date().toISOString();
}

function calculateSessionMinutes(startAt: string, endAt: string): number {
  return Math.max(0, Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000));
}

type SessionRow = {
  id: string;
  userId: string;
  startAt: string;
  endAt: string | null;
  durationMinutes: number;
  category: WorkSessionCategory;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

function toSessionDto(row: SessionRow): SessionDto {
  return {
    id: row.id,
    startAt: row.startAt,
    endAt: row.endAt,
    durationMinutes: row.durationMinutes,
    category: row.category,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getSessions(db: SQLiteDatabase, userId: string, from?: string, to?: string) {
  let query = "SELECT * FROM WorkSession WHERE userId = ?";
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
    "SELECT * FROM WorkSession WHERE userId = ? AND endAt IS NULL ORDER BY startAt DESC",
    [userId],
  );
  return row ? toSessionDto(row) : null;
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
    throw new Error("There is already an active session.");
  }

  const id = generateId();
  const ts = now();

  await db.runAsync(
    "INSERT INTO WorkSession (id, userId, startAt, durationMinutes, category, note, createdAt, updatedAt) VALUES (?, ?, ?, 0, ?, ?, ?, ?)",
    [id, userId, startAt, category, note ?? null, ts, ts],
  );

  const row = await db.getFirstAsync<SessionRow>("SELECT * FROM WorkSession WHERE id = ?", [id]);
  return toSessionDto(row!);
}

export async function clockOut(db: SQLiteDatabase, sessionId: string, userId: string, endAt: string) {
  const session = await db.getFirstAsync<SessionRow>(
    "SELECT * FROM WorkSession WHERE id = ? AND userId = ?",
    [sessionId, userId],
  );

  if (!session) {
    throw new Error("Session not found.");
  }

  if (session.endAt) {
    throw new Error("Session is already ended.");
  }

  const endDate = new Date(endAt);
  if (endDate.getTime() < new Date(session.startAt).getTime()) {
    throw new Error("End time cannot be before start time.");
  }

  const durationMinutes = calculateSessionMinutes(session.startAt, endAt);
  const ts = now();

  await db.runAsync(
    "UPDATE WorkSession SET endAt = ?, durationMinutes = ?, updatedAt = ? WHERE id = ?",
    [endAt, durationMinutes, ts, sessionId],
  );

  const row = await db.getFirstAsync<SessionRow>("SELECT * FROM WorkSession WHERE id = ?", [sessionId]);
  return toSessionDto(row!);
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
  const session = await db.getFirstAsync<SessionRow>(
    "SELECT * FROM WorkSession WHERE id = ? AND userId = ?",
    [sessionId, userId],
  );

  if (!session) {
    throw new Error("Session not found.");
  }

  const endDate = endAt ? new Date(endAt) : null;
  if (endDate && endDate.getTime() < new Date(startAt).getTime()) {
    throw new Error("End time cannot be before start time.");
  }

  const durationMinutes = endDate ? calculateSessionMinutes(startAt, endAt!) : 0;
  const ts = now();

  await db.runAsync(
    "UPDATE WorkSession SET startAt = ?, endAt = ?, durationMinutes = ?, category = ?, note = ?, updatedAt = ? WHERE id = ?",
    [startAt, endAt, durationMinutes, category, note, ts, sessionId],
  );

  const row = await db.getFirstAsync<SessionRow>("SELECT * FROM WorkSession WHERE id = ?", [sessionId]);
  return toSessionDto(row!);
}

export async function getSessionById(db: SQLiteDatabase, sessionId: string, userId: string) {
  const row = await db.getFirstAsync<SessionRow>(
    "SELECT * FROM WorkSession WHERE id = ? AND userId = ?",
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
    throw new Error("End time cannot be before start time.");
  }

  if (!endAt) {
    const active = await getActiveSession(db, userId);

    if (active) {
      throw new Error("There is already an active session.");
    }
  }

  const id = generateId();
  const ts = now();
  const durationMinutes = endAt ? calculateSessionMinutes(startAt, endAt) : 0;

  await db.runAsync(
    "INSERT INTO WorkSession (id, userId, startAt, endAt, durationMinutes, category, note, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, userId, startAt, endAt, durationMinutes, category, note, ts, ts],
  );

  const row = await db.getFirstAsync<SessionRow>("SELECT * FROM WorkSession WHERE id = ?", [id]);
  return toSessionDto(row!);
}

export async function deleteSession(db: SQLiteDatabase, sessionId: string, userId: string) {
  const result = await db.runAsync("DELETE FROM WorkSession WHERE id = ? AND userId = ?", [
    sessionId,
    userId,
  ]);

  if (!result.changes) {
    throw new Error("Session not found.");
  }
}

export async function getMonthlySummary(
  db: SQLiteDatabase,
  userId: string,
  month: string,
): Promise<{
  totalMinutes: number;
  totalIncome: number;
  activeSession: SessionDto | null;
  workedDays: number;
  categoryMinutes: {
    onsite: number;
    remote: number;
  };
}> {
  const range = localMonthRange(month);

  const sessions = await db.getAllAsync<SessionRow>(
    "SELECT * FROM WorkSession WHERE userId = ? AND startAt >= ? AND startAt <= ?",
    [userId, range.from.toISOString(), range.to.toISOString()],
  );

  const settings = await db.getFirstAsync<{ hourlyRate: number }>(
    "SELECT hourlyRate FROM AppSettings WHERE userId = ?",
    [userId],
  );

  const activeSession = await getActiveSession(db, userId);

  let totalMinutes = 0;
  const categoryMinutes = {
    onsite: 0,
    remote: 0,
  };
  const workedDaysSet = new Set<string>();

  for (const session of sessions) {
    if (session.endAt) {
      const minutes = session.durationMinutes || calculateSessionMinutes(session.startAt, session.endAt);
      totalMinutes += minutes;

      if (session.category === "REMOTE") {
        categoryMinutes.remote += minutes;
      } else {
        categoryMinutes.onsite += minutes;
      }
    }
    workedDaysSet.add(localDayKey(new Date(session.startAt)));
  }

  const hourlyRate = settings?.hourlyRate ?? 0;

  return {
    totalMinutes,
    totalIncome: Number(((totalMinutes / 60) * hourlyRate).toFixed(2)),
    activeSession,
    workedDays: workedDaysSet.size,
    categoryMinutes,
  };
}
