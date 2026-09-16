import { afterEach, describe, expect, mock, test } from "bun:test";
import { Database, type SQLQueryBindings } from "bun:sqlite";
import type { SQLiteDatabase } from "expo-sqlite";
import { DB_SCHEMA, initializeDatabase } from "./database";
import { applyServerSessions, readSyncState, writeSyncState } from "./db/sync";

mock.module("./db/id", () => ({ generateId: () => crypto.randomUUID() }));
const { clockIn, clockOut, createSession, updateSession, getMonthlySummary } = await import("./db/sessions");

const databases: Database[] = [];
function database() {
  const sqlite = new Database(":memory:");
  databases.push(sqlite);
  const db = {
    execAsync: async (sql: string) => { sqlite.exec(sql); },
    runAsync: async (sql: string, params: SQLQueryBindings[] = []) => sqlite.query(sql).run(...params),
    getFirstAsync: async (sql: string, params: SQLQueryBindings[] = []) => sqlite.query(sql).get(...params),
    getAllAsync: async (sql: string, params: SQLQueryBindings[] = []) => sqlite.query(sql).all(...params),
  } as unknown as SQLiteDatabase;
  return { sqlite, db };
}

afterEach(() => { databases.splice(0).forEach((db) => db.close()); });

const startAt = "2026-09-06T09:00:00.000Z";
const endAt = "2026-09-06T17:00:00.000Z";

describe("time entries without approval", () => {
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
