import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDesktopDatabase } from "./database";

test("persists a running session across database restarts and binds untrusted values", () => {
  const directory = mkdtempSync(join(tmpdir(), "omam-db-"));
  const path = join(directory, "omam.db");
  try {
    let db = openDesktopDatabase(path);
    db.execute({ operation: "exec", sql: "CREATE TABLE WorkSession (id TEXT PRIMARY KEY, startAt TEXT, note TEXT)" });
    db.execute({ operation: "run", sql: "INSERT INTO WorkSession VALUES (?, ?, ?)", params: ["session", "2026-10-01T09:00:00.000Z", "'); DROP TABLE WorkSession; --"] });
    db.close();
    db = openDesktopDatabase(path);
    assert.deepEqual({ ...(db.execute({ operation: "first", sql: "SELECT * FROM WorkSession" }) as Record<string, unknown>) }, { id: "session", startAt: "2026-10-01T09:00:00.000Z", note: "'); DROP TABLE WorkSession; --" });
    db.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("rolls back every deletion when one statement in a conflict resolution fails", () => {
  const db = openDesktopDatabase(":memory:");
  try {
    db.execute({ operation: "exec", sql: "CREATE TABLE WorkSession (id TEXT PRIMARY KEY, deletedAt TEXT); INSERT INTO WorkSession VALUES ('phone', NULL), ('mac', NULL)" });
    assert.throws(() => db.execute({ operation: "batch", statements: [
      { sql: "UPDATE WorkSession SET deletedAt = 'deleted' WHERE id = 'phone'" },
      { sql: "UPDATE Missing SET deletedAt = 'deleted'" },
    ] }));
    assert.equal((db.execute({ operation: "first", sql: "SELECT count(*) AS count FROM WorkSession WHERE deletedAt IS NULL" }) as { count: number }).count, 2);
  } finally { db.close(); }
});

test("refuses filesystem attachment, extension loading and invalid IPC payloads", () => {
  const db = openDesktopDatabase(":memory:");
  try {
    for (const sql of ["ATTACH DATABASE '/tmp/other.db' AS other", "SELECT load_extension('/tmp/module')", "PRAGMA writable_schema = 1"]) assert.throws(() => db.execute({ operation: "exec", sql }), /DATABASE_QUERY_REFUSED/);
    assert.throws(() => db.execute({ operation: "shell", sql: "SELECT 1" }));
    assert.throws(() => db.execute({ operation: "run", sql: "SELECT ?", params: [Number.NaN] }));
  } finally { db.close(); }
});
