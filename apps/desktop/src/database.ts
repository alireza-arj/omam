import { DatabaseSync } from "node:sqlite";
import { desktopDatabaseRequestSchema } from "@omam/contracts";

export function openDesktopDatabase(path: string) {
  const db = new DatabaseSync(path, { allowExtension: false });
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  return {
    execute(input: unknown): unknown {
      const request = desktopDatabaseRequestSchema.parse(input);
      const refused = /\b(?:ATTACH|DETACH|VACUUM|load_extension|writable_schema|temp_store_directory|data_store_directory)\b/i;
      if ([request.sql, ...(request.statements ?? []).map((statement) => statement.sql)].some((sql) => refused.test(sql))) throw new Error("DATABASE_QUERY_REFUSED");
      if (request.operation === "batch") {
        db.exec("BEGIN IMMEDIATE");
        try { for (const statement of request.statements ?? []) db.prepare(statement.sql).run(...statement.params); db.exec("COMMIT"); }
        catch (error) { db.exec("ROLLBACK"); throw error; }
        return null;
      }
      if (request.operation === "exec") { db.exec(request.sql); return null; }
      const statement = db.prepare(request.sql);
      if (request.operation === "all") return statement.all(...request.params);
      if (request.operation === "first") return statement.get(...request.params) ?? null;
      const result = statement.run(...request.params);
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    close() { db.close(); },
  };
}
