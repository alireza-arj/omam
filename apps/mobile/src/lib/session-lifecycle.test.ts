import { afterEach, describe, expect, mock, test } from "bun:test";
import { Database, type SQLQueryBindings } from "bun:sqlite";
import type { SQLiteDatabase } from "./sqlite-context";
import { DB_SCHEMA, initializeDatabase } from "./database";
import { applyServerSessions, readSyncState, writeSyncState, collectDirty, markPushed, countRejected } from "./db/sync";

mock.module("./db/id", () => ({ generateId: () => crypto.randomUUID() }));
const { clockIn, clockOut, createSession, updateSession, deleteSession, getSessions, getMonthlySummary, getSessionConflicts, resolveSessionConflict } = await import("./db/sessions");

const databases: Database[] = [];
function database() {
  const sqlite = new Database(":memory:");
  databases.push(sqlite);
  const db = {
    execAsync: async (sql: string) => { sqlite.exec(sql); },
    runAsync: async (sql: string, params: SQLQueryBindings[] = []) => sqlite.query(sql).run(...params),
    getFirstAsync: async (sql: string, params: SQLQueryBindings[] = []) => sqlite.query(sql).get(...params),
    getAllAsync: async (sql: string, params: SQLQueryBindings[] = []) => sqlite.query(sql).all(...params),
    runBatchAsync: async (statements: { sql: string; params?: SQLQueryBindings[] }[]) => {
      sqlite.transaction(() => { for (const statement of statements) sqlite.query(statement.sql).run(...(statement.params ?? [])); })();
    },
  } as unknown as SQLiteDatabase;
  return { sqlite, db };
}

afterEach(() => { databases.splice(0).forEach((db) => db.close()); });

const startAt = "2026-09-06T09:00:00.000Z";
const endAt = "2026-09-06T17:00:00.000Z";

describe("time entries without approval", () => {
  test("resolves two device timers atomically, queues deletion first, and preserves the winner's start", async () => {
    const { db } = database();
    await initializeDatabase(db, "Mac", "mac-device");
    const mac = await clockIn(db, "user", startAt, "REMOTE");
    expect(mac.deviceId).toBe("mac-device");
    expect(mac.deviceName).toBe("Mac");
    await applyServerSessions(db, "user", [{ ...mac, id: "phone-server", clientId: "phone", deviceId: "phone-device", deviceName: "iPhone" }]);
    await db.runAsync("UPDATE WorkSession SET syncError = 'SESSION_CONFLICT' WHERE id = ?", [mac.id]);
    const [conflict] = await getSessionConflicts(db, "user");
    expect(conflict?.sessions).toHaveLength(2);
    await resolveSessionConflict(db, "user", conflict!, "phone");
    expect((await getSessions(db, "user")).map((row) => row.id)).toEqual(["phone"]);
    const queued = await collectDirty(db, "user");
    expect(queued.map((row) => row.clientId)).toEqual([mac.id, "phone"]);
    expect(queued[0]?.deletedAt).toBeTruthy();
    expect(queued[1]?.startAt).toBe(startAt);
    expect(queued[1]?.deletedAt).toBeNull();
  });

  test("cannot resolve a conflict by deleting a payroll-locked session", async () => {
    const { db } = database();
    await initializeDatabase(db);
    await writeSyncState(db, "user", { organizationId: "team" });
    const mac = await clockIn(db, "user", startAt, "REMOTE");
    await applyServerSessions(db, "user", [{ ...mac, id: "phone-server", clientId: "phone", deviceId: "phone-device", deviceName: "iPhone" }]);
    await db.runAsync("UPDATE WorkSession SET syncError = 'SESSION_CONFLICT' WHERE id = ?", [mac.id]);
    const [conflict] = await getSessionConflicts(db, "user");
    await db.runAsync("INSERT INTO LockedPeriod VALUES ('team', '2026-09', '2026-09-01T00:00:00.000Z', '2026-09-30T23:59:59.999Z')");
    await expect(resolveSessionConflict(db, "user", conflict!, "phone")).rejects.toThrow("PAYROLL_LOCKED");
    expect(await getSessions(db, "user")).toHaveLength(2);
    expect(await countRejected(db, "user")).toBe(1);
  });

  test("isolates local reads, edits, and queued changes by selected team", async () => {
    const { db } = database();
    await initializeDatabase(db);
    await writeSyncState(db, "user", { organizationId: "team-a" });
    const a = await createSession(db, "user", startAt, endAt, "ONSITE", null);
    await writeSyncState(db, "user", { organizationId: "team-b" });
    const b = await createSession(db, "user", startAt, endAt, "REMOTE", null);
    expect((await getSessions(db, "user")).map((row) => row.id)).toEqual([b.id]);
    expect((await collectDirty(db, "user")).map((row) => row.clientId)).toEqual([b.id]);
    await expect(deleteSession(db, a.id, "user")).rejects.toThrow("SESSION_NOT_FOUND");
    await writeSyncState(db, "user", { organizationId: "team-a" });
    expect((await getSessions(db, "user")).map((row) => row.id)).toEqual([a.id]);
  });
  test("refuses local edits to any part of a locked month", async () => {
    const { db } = database();
    await initializeDatabase(db);
    await writeSyncState(db, "user", { organizationId: "team" });
    const row = await createSession(db, "user", startAt, endAt, "ONSITE", null);
    await db.runAsync("INSERT INTO LockedPeriod VALUES ('team', '2026-09', '2026-09-01T00:00:00.000Z', '2026-09-30T23:59:59.999Z')");
    await expect(deleteSession(db, row.id, "user")).rejects.toThrow("PAYROLL_LOCKED");
    await expect(updateSession(db, row.id, "user", startAt, endAt, "REMOTE", null)).rejects.toThrow("PAYROLL_LOCKED");
    await expect(createSession(db, "user", "2026-08-31T23:00:00.000Z", startAt, "ONSITE", null)).rejects.toThrow("PAYROLL_LOCKED");
  });
  test("preserves a concurrent edit, honors server deletion, and keeps rejected rows out of the backlog", async () => {
    const { db } = database();
    await initializeDatabase(db);
    const row = await createSession(db, "user", startAt, endAt, "ONSITE", null);
    const queued = await collectDirty(db, "user");
    await db.runAsync("UPDATE WorkSession SET updatedAt = '2030-01-01T00:00:00.000Z' WHERE id = ?", [row.id]);
    await markPushed(db, [{ clientId: row.id, serverId: "remote", outcome: "applied", reason: null }], queued);
    expect(await collectDirty(db, "user")).toHaveLength(1);
    const snapshot = await collectDirty(db, "user");
    await markPushed(db, [{ clientId: row.id, serverId: null, outcome: "rejected", reason: "PAYROLL_LOCKED" }], snapshot);
    expect(await collectDirty(db, "user")).toHaveLength(0);
    expect(await countRejected(db, "user")).toBe(1);
    await applyServerSessions(db, "user", [{ ...row, id: "remote", clientId: row.id, deletedAt: endAt, updatedAt: endAt }]);
    expect(await getSessions(db, "user")).toHaveLength(0);
  });
  test("upgrades every legacy status while preserving history, dirty state and deletions", async () => {
    const { sqlite, db } = database();
    sqlite.exec(DB_SCHEMA.replace("    legacyReviewStatus TEXT,\n", ""));
    sqlite.exec("ALTER TABLE WorkSession ADD COLUMN reviewNote TEXT; PRAGMA user_version = 3");
    for (const status of ["PENDING", "APPROVED", "REJECTED", "OPEN"]) {
      sqlite.query(`INSERT INTO WorkSession
        (id, userId, startAt, endAt, durationMinutes, createdAt, updatedAt, status, reviewNote, dirty, deletedAt)
        VALUES (?, 'user', ?, ?, ?, ?, ?, ?, 'Historical note', 1, ?)`)
        .run(status, startAt, status === "OPEN" ? null : endAt, status === "OPEN" ? 0 : 480,
          startAt, endAt, status, status === "REJECTED" ? endAt : null);
    }
    await initializeDatabase(db);
    const rows = sqlite.query("SELECT * FROM WorkSession ORDER BY id").all() as {
      id: string; status: string; legacyReviewStatus: string | null; reviewNote: string;
      dirty: number; updatedAt: string; durationMinutes: number; deletedAt: string | null;
    }[];
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.status).toBe(row.id === "OPEN" ? "OPEN" : "COMPLETED");
      expect(row.legacyReviewStatus).toBe(row.id === "OPEN" ? null : row.id);
      expect(row.reviewNote).toBe("Historical note");
      expect(row.dirty).toBe(1);
      expect(row.updatedAt).toBe(endAt);
      expect(row.durationMinutes).toBe(row.id === "OPEN" ? 0 : 480);
      expect(row.deletedAt).toBe(row.id === "REJECTED" ? endAt : null);
    }
    await initializeDatabase(db);
    expect(sqlite.query("SELECT * FROM WorkSession ORDER BY id").all()).toEqual(rows);
  });

  test("manual entries and subsequent edits are immediately completed", async () => {
    const { db } = database();
    await initializeDatabase(db);
    const session = await createSession(db, "user", startAt, endAt, "ONSITE", null);
    expect(session.status).toBe("COMPLETED");
    const edited = await updateSession(db, session.id, "user", startAt, "2026-09-06T18:00:00.000Z", "REMOTE", "Edited");
    expect(edited.status).toBe("COMPLETED");
    expect(edited.durationMinutes).toBe(540);
    const summary = await getMonthlySummary(db, "user", "2026-09", "GREGORIAN");
    expect(summary.completedMinutes).toBe(540);
    expect(edited).not.toHaveProperty("reviewNote");
    expect(edited).not.toHaveProperty("approvedAt");
  });

  test("stopping a running timer completes it without a network request", async () => {
    const { db } = database();
    await initializeDatabase(db);
    const running = await clockIn(db, "user", startAt, "REMOTE");
    expect(running.status).toBe("OPEN");
    const finished = await clockOut(db, running.id, "user", endAt);
    expect(finished.status).toBe("COMPLETED");
    expect(finished.durationMinutes).toBe(480);
  });

  test("sync stores organization and completed sessions without approval fields", async () => {
    const { db } = database();
    await initializeDatabase(db);
    await writeSyncState(db, "user", { serverUserId: "server-user", organizationName: "Team" });
    expect((await readSyncState(db, "user"))?.organizationName).toBe("Team");
    await applyServerSessions(db, "user", [{
      id: "server-session", userId: "server-user", clientId: "local-session", startAt, endAt,
      durationMinutes: 480, category: "ONSITE", status: "COMPLETED", source: "SYNC",
      note: "Recorded", project: null, createdAt: startAt, updatedAt: endAt, deletedAt: null,
    }]);
    const summary = await getMonthlySummary(db, "user", "2026-09", "GREGORIAN");
    expect(summary.completedMinutes).toBe(480);
  });
});
