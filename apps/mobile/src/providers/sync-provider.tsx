import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { onAttendanceChanged } from "../lib/attendance-events";
import { getDesktopBridge } from "../lib/desktop";
import { getSessionConflicts, resolveSessionConflict, type SessionConflict } from "../lib/db/sessions";
import { AppState, Platform } from "react-native";
import AsyncStorage from "../lib/storage";
import { useSQLiteContext } from "../lib/sqlite-context";
import type { AuthMembershipDto } from "@omam/contracts";
import {
  applyServerSessions,
  collectDirty,
  countPending,
  countRejected,
  markPushed,
  readSyncState,
  writeSyncState,
} from "../lib/db/sync";
import { pushAndPull, serverTeams, selectServerTeam, updateServerProfile } from "../lib/sync/client";
import { createSyncQueue, type SyncQueue } from "../lib/sync/queue";
import { connectSyncEvents } from "../lib/sync/events";
import { avatarForServer } from "../lib/avatar";
import { linkKey, activateTeam, type StoredLink } from "../lib/sync/link";
import { getActiveSession } from "../lib/db/sessions";
import { useLanguage } from "../design/taraz";
import { useAttendance } from "./attendance-provider";
import { useAuth } from "./auth-provider";

export type SyncStatus = {
  isLinked: boolean;
  serverUrl: string | null;
  serverUsername: string | null;
  organizationName: string | null;
  organizationId: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  pendingCount: number;
  /** Rows the server refused, usually because their month is already paid. */
  rejectedCount: number;
};

type SyncContextValue = SyncStatus & {
  conflicts: SessionConflict[];
  isResolvingConflict: boolean;
  resolveConflict: (conflict: SessionConflict, keepId: string) => Promise<void>;
  isReady: boolean;
  isSyncing: boolean;
  isLinking: boolean;
  unlink: () => Promise<void>;
  syncNow: () => Promise<void>;
  teams: AuthMembershipDto[];
  selectTeam: (organizationId: string) => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

const EMPTY: SyncStatus = {
  isLinked: false,
  serverUrl: null,
  serverUsername: null,
  organizationName: null,
  organizationId: null,
  lastSyncAt: null,
  lastError: null,
  pendingCount: 0,
  rejectedCount: 0,
};

export function SyncProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const { refresh } = useAttendance();
  const { t } = useLanguage();

  const [status, setStatus] = useState<SyncStatus>(EMPTY);
  const [conflicts, setConflicts] = useState<SessionConflict[]>([]);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const resolving = useRef(false);
  const syncDone = useRef(Promise.resolve());
  const [teams, setTeams] = useState<AuthMembershipDto[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  const link = useRef<StoredLink | null>(null);
  const [connection, setConnection] = useState<StoredLink | null>(null);
  const queue = useRef<SyncQueue | null>(null);
  const inFlight = useRef(false);
  const switchingTeam = useRef(false);
  const currentUserId = useRef(user?.id);
  currentUserId.current = user?.id;

  const readStatus = useCallback(async () => {
    if (!user) {
      link.current = null;
      setConnection(null);
      setStatus(EMPTY);
      setTeams([]);
      setConflicts([]);
      return EMPTY;
    }

    const [stored, state, pendingCount, rejectedCount] = await Promise.all([
      AsyncStorage.getItem(linkKey(user.id)),
      readSyncState(db, user.id),
      countPending(db, user.id),
      countRejected(db, user.id),
    ]);

    if (currentUserId.current !== user.id) return EMPTY;
    link.current = stored ? (JSON.parse(stored) as StoredLink) : null;

    const next: SyncStatus = {
      isLinked: Boolean(link.current && state?.serverUserId),
      serverUrl: link.current?.serverUrl ?? null,
      serverUsername: state?.serverUsername ?? null,
      organizationName: state?.organizationName ?? null,
      organizationId: state?.organizationId ?? null,
      lastSyncAt: state?.lastSyncAt ?? null,
      lastError: state?.lastError ?? null,
      pendingCount,
      rejectedCount,
    };

    const nextLink = link.current;
    setConnection((previous) => previous?.token === nextLink?.token && previous?.serverUrl === nextLink?.serverUrl ? previous : nextLink);
    const nextConflicts = await getSessionConflicts(db, user.id);
    if (currentUserId.current !== user.id) return EMPTY;
    setConflicts(nextConflicts);
    setStatus(next);

    return next;
  }, [db, user]);

  useEffect(() => {
    readStatus().finally(() => setIsReady(true));
  }, [readStatus]);

  const runSync = useCallback(async (duringSwitch = false) => {
    if (!user || !link.current || resolving.current || (switchingTeam.current && !duringSwitch)) {
      return false;
    }
    if (inFlight.current) { await syncDone.current; return true; }

    inFlight.current = true;
    setIsSyncing(true);
    let finish = () => {};
    syncDone.current = new Promise<void>((resolve) => { finish = resolve; });
    let attemptedToken: string | undefined;

    try {
      const stored = await AsyncStorage.getItem(linkKey(user.id));
      if (!stored) return false;
      link.current = JSON.parse(stored) as StoredLink;
      const { token, serverUrl } = link.current;
      attemptedToken = token;
      const state = await readSyncState(db, user.id);
      const sessions = await collectDirty(db, user.id);
      const response = await pushAndPull(
        serverUrl,
        token,
        { since: state?.organizationId ? state.cursor : null, sessions },
        t,
      );
      if (currentUserId.current !== user.id || !link.current) return false;

      await markPushed(db, response.results, sessions);
      if (response.organization) {
        if (!state?.organizationId) {
          await db.runAsync("UPDATE WorkSession SET organizationId = ? WHERE userId = ? AND organizationId IS NULL", [response.organization.id, user.id]);
        }
        await db.runAsync("DELETE FROM LockedPeriod WHERE organizationId = ?", [response.organization.id]);
        for (const period of response.lockedPeriods ?? []) {
          await db.runAsync("INSERT INTO LockedPeriod (organizationId, month, fromAt, toAt) VALUES (?, ?, ?, ?)", [response.organization.id, period.month, period.from, period.to]);
        }
      }
      await applyServerSessions(db, user.id, response.sessions, response.results.filter((entry) => entry.reason === "PAYROLL_LOCKED" && entry.serverId).map((entry) => entry.serverId!), sessions);

      await writeSyncState(db, user.id, {
        cursor: response.serverTime,
        lastSyncAt: new Date().toISOString(),
        organizationName: response.organization?.name ?? null,
        organizationId: response.organization?.id ?? state?.organizationId,
        lastError: null,
      });

      const profile = await db.getFirstAsync<{ nickname: string | null; avatarUrl: string | null; updatedAt: string }>("SELECT nickname, avatarUrl, updatedAt FROM User WHERE id = ? AND profileDirty = 1", [user.id]);
      if (profile?.nickname) {
        await updateServerProfile(serverUrl, token, { nickname: profile.nickname, avatarUrl: await avatarForServer(profile.avatarUrl) }, t);
        await db.runAsync("UPDATE User SET profileDirty = 0 WHERE id = ? AND updatedAt = ?", [user.id, profile.updatedAt]);
      }

      const memberships = await serverTeams(serverUrl, token, t);
      if (currentUserId.current !== user.id) return false;
      setTeams(memberships.memberships);
      await readStatus();

      if (sessions.length || response.sessions.length || !state?.lastSyncAt) await refresh();
      return (await countPending(db, user.id)) > 0;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "REQUEST_FAILED";

      // A revoked or expired token means the account was suspended or the
      // password was reset; the link is dead and has to be made again.
      if (cause instanceof Error && "status" in cause && cause.status === 401) {
        const current = await AsyncStorage.getItem(linkKey(user.id));
        if (current && (JSON.parse(current) as StoredLink).token === attemptedToken) {
          await AsyncStorage.removeItem(linkKey(user.id));
          link.current = null;
        }
      }

      await writeSyncState(db, user.id, { lastError: message });
      await readStatus();
      throw cause;
    } finally {
      inFlight.current = false;
      setIsSyncing(false);
      finish();
    }
  }, [db, readStatus, refresh, t, user]);

  const latestSync = useRef(runSync);
  latestSync.current = runSync;
  const syncNow = useCallback(async () => {
    if (queue.current) await queue.current.request();
    else await latestSync.current();
  }, []);

  const resolveConflict = useCallback(async (conflict: SessionConflict, keepId: string) => {
    if (!user || resolving.current) return;
    resolving.current = true;
    setIsResolvingConflict(true);
    try {
      await syncDone.current;
      await resolveSessionConflict(db, user.id, conflict, keepId);
      await readStatus();
      await refresh();
    } finally { resolving.current = false; setIsResolvingConflict(false); }
    await syncNow();
  }, [db, readStatus, refresh, syncNow, user]);

  const selectTeam = useCallback(async (organizationId: string) => {
    if (!user || !link.current || inFlight.current || switchingTeam.current) throw new Error("REQUEST_FAILED");
    if (await getActiveSession(db, user.id)) throw new Error("TEAM_SWITCH_ACTIVE");
    switchingTeam.current = true;
    setIsLinking(true);
    try {
      do { await runSync(true); } while (await countPending(db, user.id) > 0);
      const membership = await selectServerTeam(link.current.serverUrl, link.current.token, organizationId, t);
      await activateTeam(db, user.id, membership);
      await readStatus();
      await refresh();
      await runSync(true);
    } finally {
      switchingTeam.current = false;
      setIsLinking(false);
      void syncNow().catch(() => undefined);
    }
  }, [db, readStatus, refresh, runSync, syncNow, t, user]);

  const unlink = useCallback(async () => {
    if (!user) return;

    await AsyncStorage.removeItem(linkKey(user.id));
    link.current = null;
    await readStatus();
  }, [db, readStatus, user]);

  useEffect(() => {
    if (!status.isLinked || !connection) return;
    let events: ReturnType<typeof connectSyncEvents> | undefined;
    let activeQueue: SyncQueue | undefined;
    const request = () => { void activeQueue?.request().catch(() => undefined); };
    const start = () => {
      if (activeQueue) return;
      activeQueue = createSyncQueue(() => latestSync.current());
      queue.current = activeQueue;
      request();
      events = connectSyncEvents({ serverUrl: connection.serverUrl, token: connection.token, onSyncNeeded: request });
    };
    const stop = () => {
      events?.close();
      activeQueue?.stop();
      if (queue.current === activeQueue) queue.current = null;
      activeQueue = undefined;
    };
    const resume = () => { start(); events?.reconnect(); request(); };
    if (Platform.OS === "web" || AppState.currentState === "active" || AppState.currentState === null) start();
    const unsubscribe = onAttendanceChanged(request);
    const shown = getDesktopBridge()?.onShow(resume);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") resume();
      else if (Platform.OS !== "web") stop();
    });
    const visible = () => { if (document.visibilityState === "visible") resume(); };
    if (Platform.OS === "web") {
      window.addEventListener("online", resume);
      document.addEventListener("visibilitychange", visible);
    }

    return () => {
      stop();
      unsubscribe();
      shown?.();
      subscription.remove();
      if (Platform.OS === "web") {
        window.removeEventListener("online", resume);
        document.removeEventListener("visibilitychange", visible);
      }
    };
  }, [connection, status.isLinked, status.organizationId, user?.id]);

  const value = useMemo<SyncContextValue>(
    () => ({
      ...status,
      conflicts, isResolvingConflict, resolveConflict,
      isReady,
      isSyncing,
      isLinking,
      unlink,
      syncNow,
      teams, selectTeam,
    }),
    [conflicts, isResolvingConflict, resolveConflict, isLinking, isReady, isSyncing, syncNow, status, unlink, teams, selectTeam],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const context = useContext(SyncContext);

  if (!context) {
    throw new Error("useSync must be used within SyncProvider");
  }

  return context;
}
