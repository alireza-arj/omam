import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSQLiteContext } from "expo-sqlite";
import type { SQLiteDatabase } from "expo-sqlite";
import type { AuthUserDto, CompleteProfileInputDto } from "@omam/contracts";
import {
  getUserByUsername,
  getUserById,
  getUserCount,
  createUser,
  hashPassword,
  needsRehash,
  updateUserAvatar,
  updateUserPasswordHash,
  updateUserProfile,
  verifyPassword,
} from "../lib/db/auth";
import { discardAvatar, isValidAvatarValue, migrateAvatar } from "../lib/avatar";

const AUTH_STORAGE_KEY = "@omam:loggedIn";

/** Deliberately identical for an unknown username and a wrong password. */
const INVALID_CREDENTIALS = "Invalid username or password.";

type AuthContextValue = {
  user: AuthUserDto | null;
  isReady: boolean;
  isMutating: boolean;
  isAuthenticated: boolean;
  needsProfileSetup: boolean;
  /** False on a fresh install, so the entry screen can open in sign-up mode. */
  hasAccounts: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  completeProfile: (payload: CompleteProfileInputDto) => Promise<AuthUserDto>;
  changePassword: (currentPassword: string, nextPassword: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Reads a user, moving a legacy base64 avatar out to a file on the way. The
 * rewrite happens once per account; afterwards the column already holds a URI.
 */
async function readUser(db: SQLiteDatabase, userId: string): Promise<AuthUserDto | null> {
  const found = await getUserById(db, userId);

  if (!found) {
    return null;
  }

  const migrated = migrateAvatar(found.avatarUrl);

  if (migrated === found.avatarUrl) {
    return found;
  }

  return updateUserAvatar(db, userId, migrated);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const [user, setUser] = useState<AuthUserDto | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [hasAccounts, setHasAccounts] = useState(true);

  const adopt = useCallback((next: AuthUserDto) => {
    setUser(next);
    setNeedsProfileSetup(!next.nickname?.trim());
  }, []);

  const refreshAccountCount = useCallback(async () => {
    setHasAccounts((await getUserCount(db)) > 0);
  }, [db]);

  useEffect(() => {
    let active = true;

    async function boot() {
      const count = await getUserCount(db);

      if (!active) return;

      setHasAccounts(count > 0);

      const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);

      if (!active) return;

      if (!stored) {
        setIsReady(true);
        return;
      }

      try {
        const parsed = JSON.parse(stored) as { userId: string };
        const found = await readUser(db, parsed.userId);

        if (!active) return;

        if (found) {
          adopt(found);
        } else {
          await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
        }
      } catch {
        await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      } finally {
        if (active) setIsReady(true);
      }
    }

    boot().catch(() => {
      if (active) setIsReady(true);
    });

    return () => {
      active = false;
    };
  }, [adopt, db]);

  const startSession = useCallback(
    async (userId: string) => {
      const loaded = await readUser(db, userId);

      if (!loaded) {
        throw new Error(INVALID_CREDENTIALS);
      }

      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ userId: loaded.id }));
      adopt(loaded);
    },
    [adopt, db],
  );

  const signIn = useCallback(
    async (username: string, password: string) => {
      setIsMutating(true);

      try {
        const found = await getUserByUsername(db, username);

        if (!found) {
          throw new Error(INVALID_CREDENTIALS);
        }

        if (!(await verifyPassword(password, found.passwordHash))) {
          throw new Error(INVALID_CREDENTIALS);
        }

        // The plaintext is only in hand here, so this is the one chance to
        // lift an account off the old single-round SHA-256 scheme.
        if (needsRehash(found.passwordHash)) {
          await updateUserPasswordHash(db, found.id, await hashPassword(password));
        }

        await startSession(found.id);
      } finally {
        setIsMutating(false);
      }
    },
    [db, startSession],
  );

  const signUp = useCallback(
    async (username: string, password: string) => {
      setIsMutating(true);

      try {
        const created = await createUser(db, username, await hashPassword(password));

        await startSession(created.id);
        await refreshAccountCount();
      } finally {
        setIsMutating(false);
      }
    },
    [db, refreshAccountCount, startSession],
  );

  const signOut = useCallback(async () => {
    setIsMutating(true);

    try {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      setUser(null);
      setNeedsProfileSetup(false);
      await refreshAccountCount();
    } finally {
      setIsMutating(false);
    }
  }, [refreshAccountCount]);

  const completeProfile = useCallback(
    async (payload: CompleteProfileInputDto) => {
      setIsMutating(true);

      try {
        if (!user) {
          throw new Error("Not authenticated.");
        }

        const nextAvatar = payload.avatarUrl?.trim() || null;

        if (nextAvatar && !isValidAvatarValue(nextAvatar)) {
          throw new Error("Avatar must be a stored image or an HTTP URL.");
        }

        const previousAvatar = user.avatarUrl;
        const updated = await updateUserProfile(db, user.id, payload.nickname.trim(), nextAvatar);

        if (previousAvatar && previousAvatar !== nextAvatar) {
          discardAvatar(previousAvatar);
        }

        adopt(updated);

        return updated;
      } finally {
        setIsMutating(false);
      }
    },
    [adopt, db, user],
  );

  const changePassword = useCallback(
    async (currentPassword: string, nextPassword: string) => {
      setIsMutating(true);

      try {
        if (!user) {
          throw new Error("Not authenticated.");
        }

        const found = await getUserByUsername(db, user.username);

        if (!found || !(await verifyPassword(currentPassword, found.passwordHash))) {
          throw new Error("Current password is incorrect.");
        }

        await updateUserPasswordHash(db, user.id, await hashPassword(nextPassword));
      } finally {
        setIsMutating(false);
      }
    },
    [db, user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isReady,
      isMutating,
      isAuthenticated: Boolean(user),
      needsProfileSetup,
      hasAccounts,
      signIn,
      signUp,
      signOut,
      completeProfile,
      changePassword,
    }),
    [
      changePassword,
      completeProfile,
      hasAccounts,
      isMutating,
      isReady,
      needsProfileSetup,
      signIn,
      signOut,
      signUp,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return ctx;
}
