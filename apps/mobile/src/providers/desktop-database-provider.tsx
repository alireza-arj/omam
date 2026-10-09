import { useEffect, useState, type PropsWithChildren } from "react";
import { getDesktopBridge } from "../lib/desktop";
import { initializeDatabase } from "../lib/database";
import { DatabaseContext, type SQLiteDatabase } from "../lib/sqlite-context";
import { Screen, Spinner, Text, useLanguage } from "../design/taraz";

let initialized: Promise<SQLiteDatabase> | undefined;

function openDatabase() {
  return initialized ??= (async () => {
    const bridge = getDesktopBridge();
    if (!bridge) throw new Error("DATABASE_UNAVAILABLE");
    const db: SQLiteDatabase = {
      execAsync: (sql) => bridge.database({ operation: "exec", sql }).then(() => {}),
      runBatchAsync: (statements) => bridge.database({ operation: "batch", statements }).then(() => {}),
      runAsync: (sql: string, params: (string | number | null)[] = []) => bridge.database({ operation: "run", sql, params }) as ReturnType<SQLiteDatabase["runAsync"]>,
      getFirstAsync: <T,>(sql: string, params?: (string | number | null)[]) => bridge.database({ operation: "first", sql, params }) as Promise<T | null>,
      getAllAsync: <T,>(sql: string, params?: (string | number | null)[]) => bridge.database({ operation: "all", sql, params }) as Promise<T[]>,
    };
    await initializeDatabase(db, bridge.deviceName);
    return db;
  })().catch((error: unknown) => { initialized = undefined; throw error; });
}

export function DesktopDatabaseProvider({ children }: PropsWithChildren) {
  const [db, setDb] = useState<SQLiteDatabase>();
  const [failed, setFailed] = useState(false);
  const { t } = useLanguage();
  useEffect(() => {
    let active = true;
    void openDatabase().then((value) => { if (active) setDb(value); }, () => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  if (!db) return <Screen center>{failed ? <Text>{t("common.startupFailed")}</Text> : <Spinner />}</Screen>;
  return <DatabaseContext.Provider value={db}>{children}</DatabaseContext.Provider>;
}
