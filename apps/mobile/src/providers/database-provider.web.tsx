import { Component, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from "react";
import { SQLiteProvider } from "expo-sqlite";
import { Button, Card, Screen, Spinner, Text, layout, useLanguage } from "../design/taraz";
import { DATABASE_NAME, initializeDatabase } from "../lib/database";
import { getBrowserDatabaseAccess, isDatabaseAccessConflict } from "../lib/browser-database-access";

function DatabaseNotice({ state }: { state: "loading" | "waiting" | "unavailable" | "conflict" }) {
  const { t } = useLanguage();
  if (state === "loading") return <Screen center><Spinner /></Screen>;
  const waiting = state === "waiting" || state === "conflict";
  return (
    <Screen scroll center>
      <Card style={{ width: "100%", maxWidth: layout.startupMaxWidth, gap: layout.gapLoose }}>
        <Text role="title2" accessibilityRole="header">{t(waiting ? "database.openElsewhere" : "common.startupFailed")}</Text>
        <Text role="bodySm" tone="muted">
          {t(state === "waiting" ? "database.waitingHint" : state === "conflict" ? "database.retryHint" : "database.unavailableHint")}
        </Text>
        {state === "waiting" ? null : <Button label={t("common.retry")} onPress={() => window.location.reload()} />}
      </Card>
    </Screen>
  );
}

class DatabaseErrorBoundary extends Component<PropsWithChildren, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      if (isDatabaseAccessConflict(this.state.error)) return <DatabaseNotice state="conflict" />;
      throw this.state.error;
    }
    return this.props.children;
  }
}

export function DatabaseProvider({ children }: PropsWithChildren) {
  const [access] = useState(getBrowserDatabaseAccess);
  const status = useSyncExternalStore(access.subscribe, access.getSnapshot, () => "loading" as const);
  useEffect(() => { access.start(); }, [access]);

  if (status !== "ready") return <DatabaseNotice state={status} />;
  return (
    <DatabaseErrorBoundary>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase} useSuspense>
        {children}
      </SQLiteProvider>
    </DatabaseErrorBoundary>
  );
}
