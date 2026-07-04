import type { SQLiteDatabase } from "expo-sqlite";
import * as Crypto from "expo-crypto";
import type { AuthUserDto } from "@omam/contracts";

type AuthUserRow = AuthUserDto & {
  passwordHash: string;
};

function generateId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 25; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function normalizeUsername(input: string) {
  return input.trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
  const salt = generateId();
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + password);
  return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, expectedHash] = storedHash.split(":");
  if (!salt || !expectedHash) return false;
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + password);
  return hash === expectedHash;
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
