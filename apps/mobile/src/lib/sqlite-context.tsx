import { createContext, useContext } from "react";

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

export function useSQLiteContext() {
  const db = useContext(DatabaseContext);
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db;
}
