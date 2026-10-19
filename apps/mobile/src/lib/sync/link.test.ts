import { afterEach, expect, mock, test } from "bun:test";
import { createHash } from "node:crypto";
import { Database, type SQLQueryBindings } from "bun:sqlite";
import type { AuthResponseDto } from "@omam/contracts";
import type { SQLiteDatabase } from "../sqlite-context";
import { DB_SCHEMA } from "../database";

const storage = new Map<string, string>();
mock.module("../storage", () => ({ default: {
  getItem: async (key: string) => storage.get(key) ?? null,
  setItem: async (key: string, value: string) => { storage.set(key, value); },
  removeItem: async (key: string) => { storage.delete(key); },
} }));
mock.module("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: async (_algorithm: string, value: string) => createHash("sha256").update(value).digest("hex"),
  randomUUID: () => crypto.randomUUID(),
  getRandomBytes: (length: number) => crypto.getRandomValues(new Uint8Array(length)),
}));
const { cacheTeamAccount, linkKey } = await import("./link");
const { createUser, getUserById } = await import("../db/auth");
const { getSettings } = await import("../db/settings");
const { readSyncState } = await import("../db/sync");
const databases: Database[] = [];
afterEach(() => { databases.splice(0).forEach((db) => db.close()); storage.clear(); });
function database() {
  const sqlite = new Database(":memory:");
  databases.push(sqlite);
  sqlite.exec(DB_SCHEMA);
  return {
    execAsync: async (sql: string) => { sqlite.exec(sql); },
    runAsync: async (sql: string, params: SQLQueryBindings[] = []) => sqlite.query(sql).run(...params),
    getFirstAsync: async (sql: string, params: SQLQueryBindings[] = []) => sqlite.query(sql).get(...params),
    getAllAsync: async (sql: string, params: SQLQueryBindings[] = []) => sqlite.query(sql).all(...params),
  } as unknown as SQLiteDatabase;
}
function auth(id = "server-user"): AuthResponseDto {
  return {
    token: "private-token", needsProfileSetup: false,
    user: { id, username: "same+name@!", nickname: null, email: null, avatarUrl: null, isSuperAdmin: false, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
    membership: { organizationId: "team", organizationName: "Team", organizationSlug: "team", role: "MEMBER", payType: "HOURLY", hourlyRate: 20, monthlySalary: 0, currency: "USD", monthlyGoalHours: 150, calendar: "GREGORIAN", language: "fa", jobTitle: null },
  };
}

test("a code signs into an isolated team identity without sending personal hours", async () => {
  const db = database();
  const personal = await createUser(db, auth().user.username, "personal-hash", "en");
  await db.runAsync("INSERT INTO WorkSession (id, userId, startAt, createdAt, updatedAt) VALUES ('personal-time', ?, '2026-01-01T09:00:00Z', '2026-01-01T09:00:00Z', '2026-01-01T09:00:00Z')", [personal.id]);
  const teamId = await cacheTeamAccount(db, "https://api.example", auth());
  expect(teamId).not.toBe(personal.id);
  expect((await getUserById(db, teamId))?.username).toBe(auth().user.username);
  expect(await readSyncState(db, personal.id)).toBeNull();
  expect(await db.getFirstAsync("SELECT organizationId FROM WorkSession WHERE id = 'personal-time'")).toEqual({ organizationId: null });
  expect(await getSettings(db, teamId)).toMatchObject({ calendar: "GREGORIAN", language: "fa", hourlyRate: 20 });
});

test("reissued codes restore the same local identity and preserve offline edits and preferences", async () => {
  const db = database();
  const first = await cacheTeamAccount(db, "https://api.example", auth());
  await db.runAsync("UPDATE User SET nickname = 'Offline edit', profileDirty = 1 WHERE id = ?", [first]);
  await db.runAsync("UPDATE AppSettings SET calendar = 'JALALI' WHERE userId = ?", [first]);
  storage.delete(linkKey(first));
  const second = await cacheTeamAccount(db, "https://api.example", { ...auth(), token: "new-private-token" });
  expect(second).toBe(first);
  expect((await getUserById(db, second))?.nickname).toBe("Offline edit");
  expect((await getSettings(db, second)).calendar).toBe("JALALI");
  expect(JSON.parse(storage.get(linkKey(second)) ?? "{}").token).toBe("new-private-token");
});

test("different servers and different server users never share a local identity", async () => {
  const db = database();
  const one = await cacheTeamAccount(db, "https://one.example", auth());
  const two = await cacheTeamAccount(db, "https://two.example", auth());
  const three = await cacheTeamAccount(db, "https://one.example", auth("other-server-user"));
  const four = await cacheTeamAccount(db, "https://one.example/API", auth());
  const five = await cacheTeamAccount(db, "https://one.example/api", auth());
  expect(new Set([one, two, three, four, five]).size).toBe(5);
});
