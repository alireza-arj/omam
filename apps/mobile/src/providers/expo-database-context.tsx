import { useMemo, type PropsWithChildren } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { DatabaseContext, type SQLiteDatabase } from "../lib/sqlite-context";

export function ExpoDatabaseContext({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const value = useMemo<SQLiteDatabase>(() => ({
    execAsync: (sql) => db.execAsync(sql),
    runAsync: (sql: string, params: (string | number | null)[] = []) => db.runAsync(sql, params),
    getFirstAsync: <T,>(sql: string, params: (string | number | null)[] = []) => db.getFirstAsync<T>(sql, params),
    getAllAsync: <T,>(sql: string, params: (string | number | null)[] = []) => db.getAllAsync<T>(sql, params),
    runBatchAsync: (statements) => db.withTransactionAsync(async () => { for (const statement of statements) await db.runAsync(statement.sql, statement.params ?? []); }),
  }), [db]);
  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}
