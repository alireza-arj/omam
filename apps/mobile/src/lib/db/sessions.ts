import type { SQLiteDatabase } from "expo-sqlite";
import type { SessionDto } from "@omam/contracts";

function generateId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 25; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

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
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function getSessions(db: SQLiteDatabase, userId: string, from?: string, to?: string) {
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

  return db.getAllSync<SessionRow>(query, params).map(toSessionDto);
}

export function getActiveSession(db: SQLiteDatabase, userId: string) {
  const row = db.getFirstSync<SessionRow>(
    "SELECT * FROM WorkSession WHERE userId = ? AND endAt IS NULL ORDER BY startAt DESC",
    [userId],
  );
  return row ? toSessionDto(row) : null;
}

export function clockIn(db: SQLiteDatabase, userId: string, startAt: string, note?: string | null) {
  const active = getActiveSession(db, userId);
  if (active) {
    throw new Error("There is already an active session.");
  }

  const id = generateId();
  const ts = now();

  db.runSync(
    "INSERT INTO WorkSession (id, userId, startAt, durationMinutes, note, createdAt, updatedAt) VALUES (?, ?, ?, 0, ?, ?, ?)",
    [id, userId, startAt, note ?? null, ts, ts],
  );

  return toSessionDto(
    db.getFirstSync<SessionRow>("SELECT * FROM WorkSession WHERE id = ?", [id])!,
  );
}

export function clockOut(db: SQLiteDatabase, sessionId: string, userId: string, endAt: string) {
  const session = db.getFirstSync<SessionRow>(
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
    throw new Error("endAt cannot be before startAt.");
  }

  const durationMinutes = calculateSessionMinutes(session.startAt, endAt);
  const ts = now();

  db.runSync(
    "UPDATE WorkSession SET endAt = ?, durationMinutes = ?, updatedAt = ? WHERE id = ?",
    [endAt, durationMinutes, ts, sessionId],
  );

  return toSessionDto(
    db.getFirstSync<SessionRow>("SELECT * FROM WorkSession WHERE id = ?", [sessionId])!,
  );
}

export function updateSession(
  db: SQLiteDatabase,
  sessionId: string,
  userId: string,
  startAt: string,
  endAt: string | null,
  note: string | null,
) {
  const session = db.getFirstSync<SessionRow>(
    "SELECT * FROM WorkSession WHERE id = ? AND userId = ?",
    [sessionId, userId],
  );

  if (!session) {
    throw new Error("Session not found.");
  }

  const endDate = endAt ? new Date(endAt) : null;
  if (endDate && endDate.getTime() < new Date(startAt).getTime()) {
    throw new Error("endAt cannot be before startAt.");
  }

  const durationMinutes = endDate ? calculateSessionMinutes(startAt, endAt!) : 0;
  const ts = now();

  db.runSync(
    "UPDATE WorkSession SET startAt = ?, endAt = ?, durationMinutes = ?, note = ?, updatedAt = ? WHERE id = ?",
    [startAt, endAt, durationMinutes, note, ts, sessionId],
  );

  return toSessionDto(
    db.getFirstSync<SessionRow>("SELECT * FROM WorkSession WHERE id = ?", [sessionId])!,
  );
}

export function getMonthlySummary(
  db: SQLiteDatabase,
  userId: string,
  month: string,
): {
  totalMinutes: number;
  totalIncome: number;
  activeSession: SessionDto | null;
  workedDays: number;
} {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const from = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0)).toISOString();
  const to = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999)).toISOString();

  const sessions = db.getAllSync<SessionRow>(
    "SELECT * FROM WorkSession WHERE userId = ? AND startAt >= ? AND startAt <= ?",
    [userId, from, to],
  );

  const settings = db.getFirstSync<{ hourlyRate: number }>(
    "SELECT hourlyRate FROM AppSettings WHERE userId = ?",
    [userId],
  );

  const activeSession = getActiveSession(db, userId);

  let totalMinutes = 0;
  const workedDaysSet = new Set<string>();

  for (const session of sessions) {
    if (session.endAt) {
      totalMinutes +=
        session.durationMinutes || calculateSessionMinutes(session.startAt, session.endAt);
    }
    workedDaysSet.add(session.startAt.slice(0, 10));
  }

  const hourlyRate = settings?.hourlyRate ?? 0;

  return {
    totalMinutes,
    totalIncome: Number(((totalMinutes / 60) * hourlyRate).toFixed(2)),
    activeSession,
    workedDays: workedDaysSet.size,
  };
}
