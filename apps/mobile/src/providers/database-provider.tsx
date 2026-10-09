import { Platform } from "react-native";
import { generateId } from "../lib/db/id";
import type { PropsWithChildren } from "react";
import { SQLiteProvider } from "expo-sqlite";
import { ExpoDatabaseContext } from "../lib/sqlite-context";
import { DATABASE_NAME, initializeDatabase } from "../lib/database";

export function DatabaseProvider({ children }: PropsWithChildren) {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={(db) => initializeDatabase(db, Platform.OS === "ios" ? "iPhone" : "Android", generateId())}>
      <ExpoDatabaseContext>{children}</ExpoDatabaseContext>
    </SQLiteProvider>
  );
}
