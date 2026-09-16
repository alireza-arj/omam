import type { PropsWithChildren } from "react";
import { SQLiteProvider } from "expo-sqlite";
import { DATABASE_NAME, initializeDatabase } from "../lib/database";

export function DatabaseProvider({ children }: PropsWithChildren) {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase}>
      {children}
    </SQLiteProvider>
  );
}
