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
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSQLiteContext } from "expo-sqlite";
import type { AuthResponseDto } from "@omam/contracts";
import {
  applyServerSessions,
  clearSyncState,
  collectDirty,
  countPending,
  markPushed,
  readSyncState,
  writeSyncState,
} from "../lib/db/sync";
import { pushAndPull, registerOnServer, resolveServerUrl, signInToServer } from "../lib/sync/client";
import { useLanguage } from "../design/taraz";
import { useAttendance } from "./attendance-provider";
import { useAuth } from "./auth-provider";

/** Per local account, so two people sharing a device keep separate tokens. */
const linkKey = (localUserId: string) => `@omam:sync:${localUserId}`;

type StoredLink = {
  token: string;
  serverUrl: string;
};

export type SyncStatus = {
  isLinked: boolean;
  serverUrl: string | null;
  serverUsername: string | null;
  organizationName: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  pendingCount: number;
  /** Rows the server refused, usually because their month is already paid. */
  rejectedCount: number;
};

type SyncContextValue = SyncStatus & {
  isReady: boolean;
  isSyncing: boolean;
  isLinking: boolean;
  signInAndLink: (input: { serverUrl: string; username: string; password: string }) => Promise<void>;
  joinWithInvite: (input: {
    serverUrl: string;
    username: string;
    password: string;
    inviteCode: string;
    nickname?: string;
  }) => Promise<void>;
  unlink: () => Promise<void>;
  syncNow: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

const EMPTY: SyncStatus = {
  isLinked: false,
  serverUrl: null,
  serverUsername: null,
  organizationName: null,
  lastSyncAt: null,
  lastError: null,
  pendingCount: 0,
  rejectedCount: 0,
};

/** How often a linked device looks for work to push. */
const SYNC_INTERVAL_MS = 60_000;

export function SyncProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const { refresh } = useAttendance();
  const { t } = useLanguage();

  const [status, setStatus] = useState<SyncStatus>(EMPTY);
  const [isReady, setIsReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  const link = useRef<StoredLink | null>(null);
  // A sync already in flight must not be started a second time by the timer.
  const inFlight = useRef(false);

  const readStatus = useCallback(async () => {
    if (!user) {
      link.current = null;
      setStatus(EMPTY);
      return EMPTY;
    }

    const [stored, state, pendingCount] = await Promise.all([
      AsyncStorage.getItem(linkKey(user.id)),
      readSyncState(db, user.id),
      countPending(db, user.id),
    ]);

    link.current = stored ? (JSON.parse(stored) as StoredLink) : null;

    const next: SyncStatus = {
      isLinked: Boolean(link.current && state?.serverUserId),
      serverUrl: link.current?.serverUrl ?? null,
      serverUsername: state?.serverUsername ?? null,
      organizationName: state?.organizationName ?? null,
      lastSyncAt: state?.lastSyncAt ?? null,
      lastError: state?.lastError ?? null,
      pendingCount,
      rejectedCount: 0,
    };

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

      await AsyncStorage.setItem(
        linkKey(user.id),
        JSON.stringify({ token: auth.token, serverUrl } satisfies StoredLink),
      );

      await writeSyncState(db, user.id, {
        serverUserId: auth.user.id,
        serverUsername: auth.user.username,
        organizationName: auth.membership.organizationName,
        lastError: null,
      });

      await readStatus();
    },
    [db, readStatus, t, user],
  );

  const runSync = useCallback(async () => {
    if (!user || !link.current || inFlight.current) {
      return;
    }

    const { token, serverUrl } = link.current;

    inFlight.current = true;
    setIsSyncing(true);

    try {
      const state = await readSyncState(db, user.id);
      const sessions = await collectDirty(db, user.id);
      const response = await pushAndPull(
        serverUrl,
        token,
        { since: state?.cursor ?? null, sessions },
        t,
      );

      await markPushed(db, response.results);
      await applyServerSessions(db, user.id, response.sessions);

      await writeSyncState(db, user.id, {
        cursor: response.serverTime,
        lastSyncAt: new Date().toISOString(),
        organizationName: response.organization?.name ?? null,
        lastError: null,
      });

      const next = await readStatus();

      setStatus({
        ...next,
        rejectedCount: response.results.filter((entry) => entry.outcome === "rejected").length,
      });

      await refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("team.syncFailed");

      // A revoked or expired token means the account was suspended or the
      // password was reset; the link is dead and has to be made again.
      if (cause instanceof Error && "status" in cause && cause.status === 401) {
        await AsyncStorage.removeItem(linkKey(user.id));
        link.current = null;
      }

      await writeSyncState(db, user.id, { lastError: message });
      await readStatus();
    } finally {
      inFlight.current = false;
      setIsSyncing(false);
    }
  }, [db, readStatus, refresh, t, user]);

  const signInAndLink = useCallback<SyncContextValue["signInAndLink"]>(
    async (input) => {
      setIsLinking(true);

      try {
        const serverUrl = resolveServerUrl(input.serverUrl);

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
        const serverUrl = resolveServerUrl(input.serverUrl);
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

  const unlink = useCallback(async () => {
    if (!user) return;

    await AsyncStorage.removeItem(linkKey(user.id));
    await clearSyncState(db, user.id);
    link.current = null;
    await readStatus();
  }, [db, readStatus, user]);

  // Push on a timer and whenever the app comes back to the foreground, so a
  // manager's view is never more than a minute behind an active device.
  useEffect(() => {
    if (!status.isLinked) {
      return;
    }

    const timer = setInterval(() => {
      runSync().catch(() => undefined);
    }, SYNC_INTERVAL_MS);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        runSync().catch(() => undefined);
      }
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [runSync, status.isLinked]);

  const value = useMemo<SyncContextValue>(
    () => ({
      ...status,
      isReady,
      isSyncing,
      isLinking,
      signInAndLink,
      joinWithInvite,
      unlink,
      syncNow: runSync,
    }),
    [isLinking, isReady, isSyncing, joinWithInvite, runSync, signInAndLink, status, unlink],
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
