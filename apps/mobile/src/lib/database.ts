import type { SQLiteDatabase } from "expo-sqlite";

const DATABASE_NAME = "omam.db";

/** Bump when a migration is added below. */
const SCHEMA_VERSION = 1;

export const DB_SCHEMA = `
  CREATE TABLE IF NOT EXISTS User (
    id TEXT PRIMARY KEY NOT NULL,
    username TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    nickname TEXT,
    avatarUrl TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS AppSettings (
    id TEXT PRIMARY KEY NOT NULL,
    userId TEXT UNIQUE NOT NULL,
    hourlyRate REAL DEFAULT 0,
    currency TEXT DEFAULT 'IRR',
    monthlyGoalHours REAL DEFAULT 160,
    calendar TEXT NOT NULL DEFAULT 'JALALI',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS WorkSession (
    id TEXT PRIMARY KEY NOT NULL,
    userId TEXT NOT NULL,
    startAt TEXT NOT NULL,
    endAt TEXT,
    durationMinutes INTEGER DEFAULT 0,
    category TEXT NOT NULL DEFAULT 'ONSITE',
    note TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
`;

/** Absolute instant: a date, a time and a zone. Anything else is legacy. */
const ABSOLUTE_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

async function hasColumn(db: SQLiteDatabase, table: string, column: string) {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);

  return columns.some((entry) => entry.name === column);
}

/**
 * Rewrites any timestamp that is not an absolute instant.
 *
 * Sessions recorded before the calendar work are already `toISOString()` output,
 * so this is a no-op for them. It exists so that a row written by an older build
 * as a bare `YYYY-MM-DD HH:MM:SS` — which `new Date()` reads as local time on
 * one platform and UTC on another — is pinned to a single instant before the
 * Jalali formatters start bucketing it into a month.
 */
async function normalizeLegacyTimestamps(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ id: string; startAt: string; endAt: string | null }>(
    "SELECT id, startAt, endAt FROM WorkSession",
  );

  for (const row of rows) {
    const startAt = normalizeInstant(row.startAt);
    const endAt = row.endAt === null ? null : normalizeInstant(row.endAt);

    if (startAt === row.startAt && endAt === row.endAt) {
      continue;
    }

    await db.runAsync("UPDATE WorkSession SET startAt = ?, endAt = ? WHERE id = ?", [
      startAt,
      endAt,
      row.id,
    ]);
  }
}

function normalizeInstant(value: string) {
  if (ABSOLUTE_ISO.test(value)) {
    return value;
  }

  const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T"));

  // An unparseable value is left alone: losing the row would be worse than
  // carrying a stamp the formatters render as-is.
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

/**
 * Fills in `durationMinutes` for finished sessions that were stored with a zero.
 * Reports fell back to recomputing it on the fly; the calendar work reads the
 * stored column when grouping by month, so it has to be right on old rows too.
 */
async function backfillDurations(db: SQLiteDatabase) {
  await db.runAsync(
    `UPDATE WorkSession
        SET durationMinutes = MAX(
              0,
              CAST(ROUND((julianday(endAt) - julianday(startAt)) * 1440) AS INTEGER)
            )
      WHERE endAt IS NOT NULL
        AND durationMinutes <= 0`,
  );
}

export async function initializeDatabase(db: SQLiteDatabase) {
  await db.execAsync(DB_SCHEMA);

  if (!(await hasColumn(db, "WorkSession", "category"))) {
    await db.execAsync("ALTER TABLE WorkSession ADD COLUMN category TEXT NOT NULL DEFAULT 'ONSITE'");
  }

  const { user_version: version } = (await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  )) ?? { user_version: 0 };

  if (version >= SCHEMA_VERSION) {
    return;
  }

  // v1 — the Jalali calendar. Existing installs get the setting at its default
  // and keep every session they already have: an instant is calendar-agnostic,
  // so past sessions simply start reading as Shamsi dates.
  if (!(await hasColumn(db, "AppSettings", "calendar"))) {
    await db.execAsync("ALTER TABLE AppSettings ADD COLUMN calendar TEXT NOT NULL DEFAULT 'JALALI'");
  }

  await normalizeLegacyTimestamps(db);
  await backfillDurations(db);

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

export { DATABASE_NAME };
