import { type SQLiteDatabase } from "expo-sqlite";

const DATABASE_NAME = "omam.db";

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
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS WorkSession (
    id TEXT PRIMARY KEY NOT NULL,
    userId TEXT NOT NULL,
    startAt TEXT NOT NULL,
    endAt TEXT,
    durationMinutes INTEGER DEFAULT 0,
    note TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
`;

export async function initializeDatabase(db: SQLiteDatabase) {
  await db.execAsync(DB_SCHEMA);
}

export { DATABASE_NAME };
