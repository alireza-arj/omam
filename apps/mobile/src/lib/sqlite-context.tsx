import { createContext, useContext, useMemo, type PropsWithChildren } from "react";
import { useSQLiteContext as useExpoSQLiteContext } from "expo-sqlite";

export type SQLiteDatabase = {
  execAsync: (sql: string) => Promise<void>;
  runAsync(sql: string): Promise<{ changes: number; lastInsertRowId: number }>;
  runAsync(sql: string, params: (string | number | null)[]): Promise<{ changes: number; lastInsertRowId: number }>;
  getFirstAsync<T>(sql: string): Promise<T | null>;
  getFirstAsync<T>(sql: string, params: (string | number | null)[]): Promise<T | null>;
  getAllAsync<T>(sql: string): Promise<T[]>;
  getAllAsync<T>(sql: string, params: (string | number | null)[]): Promise<T[]>;
  runBatchAsync: (statements: { sql: string; params?: (string | number | null)[] }[]) => Promise<void>;
};

export type DatabaseQueries = Omit<SQLiteDatabase, "runBatchAsync">;

export const DatabaseContext = createContext<SQLiteDatabase | null>(null);

export function ExpoDatabaseContext({ children }: PropsWithChildren) {
  const db = useExpoSQLiteContext();
  const value = useMemo<SQLiteDatabase>(() => ({
    execAsync: (sql) => db.execAsync(sql),
    runAsync: (sql: string, params: (string | number | null)[] = []) => db.runAsync(sql, params),
    getFirstAsync: <T,>(sql: string, params: (string | number | null)[] = []) => db.getFirstAsync<T>(sql, params),
    getAllAsync: <T,>(sql: string, params: (string | number | null)[] = []) => db.getAllAsync<T>(sql, params),
    runBatchAsync: (statements) => db.withTransactionAsync(async () => { for (const statement of statements) await db.runAsync(statement.sql, statement.params ?? []); }),
  }), [db]);
  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

export function useSQLiteContext() {
  const db = useContext(DatabaseContext);
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db;
}
