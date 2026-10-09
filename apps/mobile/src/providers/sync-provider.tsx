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
import { AppState } from "react-native";
import AsyncStorage from "../lib/storage";
import { useSQLiteContext } from "../lib/sqlite-context";
import type { AuthResponseDto, AuthMembershipDto } from "@omam/contracts";
import {
  applyServerSessions,
  clearSyncState,
  collectDirty,
  countPending,
  countRejected,
  markPushed,
  readSyncState,
  writeSyncState,
} from "../lib/db/sync";
import { pushAndPull, registerOnServer, resolveServerUrl, signInToServer, serverTeams, selectServerTeam, joinServerTeam, updateServerProfile } from "../lib/sync/client";
import { avatarForServer } from "../lib/avatar";
import { linkKey, storeTeamAuth, activateTeam, type StoredLink } from "../lib/sync/link";
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
  signInAndLink: (input: { username: string; password: string }) => Promise<void>;
  joinWithInvite: (input: {
    username: string;
    password: string;
    inviteCode: string;
    nickname?: string;
  }) => Promise<void>;
  unlink: () => Promise<void>;
  syncNow: () => Promise<void>;
  teams: AuthMembershipDto[];
  selectTeam: (organizationId: string) => Promise<void>;
  joinTeam: (inviteCode: string) => Promise<void>;
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

/** How often a linked device looks for work to push. */
const SYNC_INTERVAL_MS = 2_000;

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
  const membershipsAt = useRef(0);
  const [teams, setTeams] = useState<AuthMembershipDto[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  const link = useRef<StoredLink | null>(null);
  // A sync already in flight must not be started a second time by the timer.
  const inFlight = useRef(false);
  const switchingTeam = useRef(false);
  const currentUserId = useRef(user?.id);
  currentUserId.current = user?.id;

  const readStatus = useCallback(async () => {
    if (!user) {
      link.current = null;
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

    if (currentUserId.current !== user.id) return EMPTY;
    setConflicts(await getSessionConflicts(db, user.id));
    setStatus(next);

    return next;
  }, [db, user]);

  useEffect(() => {
    readStatus().finally(() => setIsReady(true));
  }, [readStatus]);

  const adoptAuth = useCallback(
    async (serverUrl: string, auth: AuthResponseDto) => {
      if (!user) {
        throw new Error(t("team.signInFirst"));
      }

      if (!auth.membership) {
        throw new Error(t("team.noTeam"));
      }

      await storeTeamAuth(db, user.id, serverUrl, auth);
      await readStatus();
    },
    [db, readStatus, t, user],
  );

  const runSync = useCallback(async (duringSwitch = false) => {
    if (!user || !link.current || inFlight.current || resolving.current || (switchingTeam.current && !duringSwitch)) {
      return;
    }

    inFlight.current = true;
    setIsSyncing(true);
    let finish = () => {};
    syncDone.current = new Promise<void>((resolve) => { finish = resolve; });

    try {
      const stored = await AsyncStorage.getItem(linkKey(user.id));
      if (!stored) return;
      link.current = JSON.parse(stored) as StoredLink;
      const { token, serverUrl } = link.current;
      const state = await readSyncState(db, user.id);
      const sessions = await collectDirty(db, user.id);
      const response = await pushAndPull(
        serverUrl,
        token,
        { since: state?.organizationId ? state.cursor : null, sessions },
        t,
      );
      if (currentUserId.current !== user.id) return;

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

      if (Date.now() - membershipsAt.current > 60_000) {
        const memberships = await serverTeams(serverUrl, token, t);
        if (currentUserId.current !== user.id) return;
        setTeams(memberships.memberships);
        membershipsAt.current = Date.now();
      }
      await readStatus();

      if (sessions.length || response.sessions.length || !state?.lastSyncAt) await refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "REQUEST_FAILED";

      // A revoked or expired token means the account was suspended or the
      // password was reset; the link is dead and has to be made again.
      if (cause instanceof Error && "status" in cause && cause.status === 401) {
        await AsyncStorage.removeItem(linkKey(user.id));
        link.current = null;
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
    await runSync();
  }, [db, readStatus, refresh, runSync, user]);

  const signInAndLink = useCallback<SyncContextValue["signInAndLink"]>(
    async (input) => {
      setIsLinking(true);

      try {
        const serverUrl = resolveServerUrl();

        await adoptAuth(
          serverUrl,
          await signInToServer(serverUrl, input.username, input.password, t),
        );
        await runSync();
      } finally {
        setIsLinking(false);
      }
    },
    [adoptAuth, runSync, t],
  );

  const joinWithInvite = useCallback<SyncContextValue["joinWithInvite"]>(
    async (input) => {
      setIsLinking(true);

      try {
        const serverUrl = resolveServerUrl();
        const auth = await registerOnServer(
          serverUrl,
          {
            username: input.username,
            password: input.password,
            inviteCode: input.inviteCode,
            nickname: input.nickname,
          },
          t,
        );

        await adoptAuth(serverUrl, auth);
        await runSync();
      } finally {
        setIsLinking(false);
      }
    },
    [adoptAuth, runSync, t],
  );

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
    } finally { switchingTeam.current = false; setIsLinking(false); }
  }, [db, readStatus, refresh, runSync, t, user]);

  const joinTeam = useCallback(async (inviteCode: string) => {
    if (!user || !link.current) throw new Error("NOT_AUTHENTICATED");
    if (await getActiveSession(db, user.id)) throw new Error("TEAM_SWITCH_ACTIVE");
    const membership = await joinServerTeam(link.current.serverUrl, link.current.token, inviteCode, t);
    await selectTeam(membership.organizationId);
  }, [db, selectTeam, t, user]);

  const unlink = useCallback(async () => {
    if (!user) return;

    await AsyncStorage.removeItem(linkKey(user.id));
    await clearSyncState(db, user.id);
    link.current = null;
    await readStatus();
  }, [db, readStatus, user]);

  // Local edits push immediately; incremental pulls keep online devices within seconds.
  useEffect(() => {
    if (!status.isLinked) {
      return;
    }

    void runSync().catch(() => undefined);
    const timer = setInterval(() => {
      runSync().catch(() => undefined);
    }, SYNC_INTERVAL_MS);

    const unsubscribe = onAttendanceChanged(() => { void runSync().catch(() => undefined); });
    const shown = getDesktopBridge()?.onShow(() => { void runSync().catch(() => undefined); });
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        runSync().catch(() => undefined);
      }
    });

    return () => {
      clearInterval(timer);
      unsubscribe();
      shown?.();
      subscription.remove();
    };
  }, [runSync, status.isLinked]);

  const value = useMemo<SyncContextValue>(
    () => ({
      ...status,
      conflicts, isResolvingConflict, resolveConflict,
      isReady,
      isSyncing,
      isLinking,
      signInAndLink,
      joinWithInvite,
      unlink,
      syncNow: runSync,
      teams, selectTeam, joinTeam,
    }),
    [conflicts, isResolvingConflict, resolveConflict, isLinking, isReady, isSyncing, joinWithInvite, runSync, signInAndLink, status, unlink, teams, selectTeam, joinTeam],
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
