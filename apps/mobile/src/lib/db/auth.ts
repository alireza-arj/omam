import type { SQLiteDatabase } from "expo-sqlite";
import type { AuthUserDto } from "@omam/contracts";
import { hashPassword, needsRehash, verifyPassword } from "../crypto/password";
import { generateId } from "./id";

type AuthUserRow = AuthUserDto & {
  passwordHash: string;
};

export { hashPassword, needsRehash, verifyPassword };

function normalizeUsername(input: string) {
  return input.trim().toLowerCase();
}

function now() {
  return new Date().toISOString();
}

export async function getUserByUsername(db: SQLiteDatabase, username: string) {
  const normalized = normalizeUsername(username);
  return db.getFirstAsync<AuthUserRow>("SELECT * FROM User WHERE username = ?", [normalized]);
}

export async function getUserCount(db: SQLiteDatabase) {
  const result = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM User");
  return result?.count ?? 0;
}

export async function createUser(db: SQLiteDatabase, username: string, passwordHash: string) {
  const id = generateId();
  const ts = now();
  const normalized = normalizeUsername(username);

  const existing = await getUserByUsername(db, normalized);

  if (existing) {
    throw new Error("That username is already taken on this device.");
  }

  await db.runAsync(
    "INSERT INTO User (id, username, passwordHash, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
    [id, normalized, passwordHash, ts, ts],
  );

  await ensureDefaultSettings(db, id);

  return (await getUserByUsername(db, normalized))!;
}

export async function getUserById(db: SQLiteDatabase, id: string) {
  return db.getFirstAsync<AuthUserDto>(
    "SELECT id, username, nickname, avatarUrl, createdAt, updatedAt FROM User WHERE id = ?",
    [id],
  );
}

/** Rewrites a stored hash in place — used to upgrade the legacy scheme and to change a password. */
export async function updateUserPasswordHash(
  db: SQLiteDatabase,
  userId: string,
  passwordHash: string,
) {
  await db.runAsync("UPDATE User SET passwordHash = ?, updatedAt = ? WHERE id = ?", [
    passwordHash,
    now(),
    userId,
  ]);
}

/** Avatar alone, so the legacy `data:` migration cannot disturb the nickname. */
export async function updateUserAvatar(
  db: SQLiteDatabase,
  userId: string,
  avatarUrl: string | null,
) {
  await db.runAsync("UPDATE User SET avatarUrl = ?, updatedAt = ? WHERE id = ?", [
    avatarUrl,
    now(),
    userId,
  ]);

  return (await getUserById(db, userId))!;
}

export async function updateUserProfile(
  db: SQLiteDatabase,
  userId: string,
  nickname: string,
  avatarUrl: string | null,
) {
  const ts = now();
  await db.runAsync("UPDATE User SET nickname = ?, avatarUrl = ?, updatedAt = ? WHERE id = ?", [
    nickname,
    avatarUrl,
    ts,
    userId,
  ]);
  return (await getUserById(db, userId))!;
}

async function ensureDefaultSettings(db: SQLiteDatabase, userId: string) {
  const existing = await db.getFirstAsync<{ id: string }>("SELECT id FROM AppSettings WHERE userId = ?", [
    userId,
  ]);
  if (existing) return;

  const id = generateId();
  const ts = now();
  await db.runAsync(
    "INSERT INTO AppSettings (id, userId, hourlyRate, currency, monthlyGoalHours, createdAt, updatedAt) VALUES (?, ?, 0, 'IRR', 160, ?, ?)",
    [id, userId, ts, ts],
  );
}
