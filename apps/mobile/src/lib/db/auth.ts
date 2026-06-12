import type { SQLiteDatabase } from "expo-sqlite";
import * as Crypto from "expo-crypto";
import type { AuthUserDto } from "@omam/contracts";

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

export function getUserByUsername(db: SQLiteDatabase, username: string) {
  const normalized = normalizeUsername(username);
  return db.getFirstSync<{
    id: string;
    username: string;
    passwordHash: string;
    nickname: string | null;
    avatarUrl: string | null;
    createdAt: string;
    updatedAt: string;
  }>("SELECT * FROM User WHERE username = ?", [normalized]);
}

export function getUserCount(db: SQLiteDatabase) {
  const result = db.getFirstSync<{ count: number }>("SELECT COUNT(*) as count FROM User");
  return result?.count ?? 0;
}

export function createUser(db: SQLiteDatabase, username: string, passwordHash: string) {
  const id = generateId();
  const ts = now();
  const normalized = normalizeUsername(username);

  db.runSync(
    "INSERT INTO User (id, username, passwordHash, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
    [id, normalized, passwordHash, ts, ts],
  );

  ensureDefaultSettings(db, id);

  return getUserById(db, id)!;
}

export function getUserById(db: SQLiteDatabase, id: string) {
  return db.getFirstSync<AuthUserDto>(
    "SELECT id, username, nickname, avatarUrl, createdAt, updatedAt FROM User WHERE id = ?",
    [id],
  );
}

export function updateUserProfile(
  db: SQLiteDatabase,
  userId: string,
  nickname: string,
  avatarUrl: string | null,
) {
  const ts = now();
  db.runSync("UPDATE User SET nickname = ?, avatarUrl = ?, updatedAt = ? WHERE id = ?", [
    nickname,
    avatarUrl,
    ts,
    userId,
  ]);
  return getUserById(db, userId)!;
}

function ensureDefaultSettings(db: SQLiteDatabase, userId: string) {
  const existing = db.getFirstSync<{ id: string }>("SELECT id FROM AppSettings WHERE userId = ?", [
    userId,
  ]);
  if (existing) return;

  const id = generateId();
  const ts = now();
  db.runSync(
    "INSERT INTO AppSettings (id, userId, hourlyRate, currency, monthlyGoalHours, createdAt, updatedAt) VALUES (?, ?, 0, 'IRR', 160, ?, ?)",
    [id, userId, ts, ts],
  );
}
