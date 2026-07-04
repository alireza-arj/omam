import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSQLiteContext } from "expo-sqlite";
import type { AuthUserDto, CompleteProfileInputDto } from "@omam/contracts";
import {
  getUserByUsername,
  getUserCount,
  createUser,
  hashPassword,
  verifyPassword,
  updateUserProfile,
} from "../lib/db/auth";

const AUTH_STORAGE_KEY = "@omam:loggedIn";

type AuthContextValue = {
  user: AuthUserDto | null;
  isReady: boolean;
  isMutating: boolean;
  isAuthenticated: boolean;
  needsProfileSetup: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  completeProfile: (payload: CompleteProfileInputDto) => Promise<AuthUserDto>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const [user, setUser] = useState<AuthUserDto | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);

  useEffect(() => {
    let active = true;

    async function boot() {
      const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);

      if (!active) return;

      if (!stored) {
        setIsReady(true);
        return;
      }

      try {
        const parsed = JSON.parse(stored) as { userId: string };
        const found = await db.getFirstAsync<AuthUserDto>(
          "SELECT id, username, nickname, avatarUrl, createdAt, updatedAt FROM User WHERE id = ?",
          [parsed.userId],
        );

        if (!active) return;

        if (found) {
          setUser(found);
          setNeedsProfileSetup(!found.nickname?.trim());
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
  }, [db]);

  const signIn = useCallback(
    async (username: string, password: string) => {
      setIsMutating(true);

      try {
        const userCount = await getUserCount(db);
        let found = await getUserByUsername(db, username);

        if (!found && userCount === 0) {
          const passwordHash = await hashPassword(password);
          found = await createUser(db, username, passwordHash) as unknown as typeof found;
        }

        if (!found) {
          throw new Error("Invalid username or password.");
        }

        const valid = await verifyPassword(password, found.passwordHash);
        if (!valid) {
          throw new Error("Invalid username or password.");
        }

        const authUser: AuthUserDto = {
          id: found.id,
          username: found.username,
          nickname: found.nickname,
          avatarUrl: found.avatarUrl,
          createdAt: found.createdAt,
          updatedAt: found.updatedAt,
        };

        await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ userId: authUser.id }));
        setUser(authUser);
        setNeedsProfileSetup(!authUser.nickname?.trim());
      } finally {
        setIsMutating(false);
      }
    },
    [db],
  );

  const signOut = useCallback(async () => {
    setIsMutating(true);

    try {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      setUser(null);
      setNeedsProfileSetup(false);
    } finally {
      setIsMutating(false);
    }
  }, []);

  const completeProfile = useCallback(
    async (payload: CompleteProfileInputDto) => {
      setIsMutating(true);

      try {
        if (!user) {
          throw new Error("Not authenticated.");
        }

        const nextAvatar = payload.avatarUrl?.trim() || null;
        const isDataAvatar = nextAvatar ? nextAvatar.startsWith("data:image/") : false;
        const isHttpAvatar = nextAvatar ? /^https?:\/\//i.test(nextAvatar) : false;

        if (nextAvatar && !isDataAvatar && !isHttpAvatar) {
          throw new Error("Avatar must be a valid image data URL or HTTP URL.");
        }

        const updated = await updateUserProfile(db, user.id, payload.nickname.trim(), nextAvatar);

        setUser(updated);
        setNeedsProfileSetup(!updated.nickname?.trim());

        return updated;
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
      signIn,
      signOut,
      completeProfile,
    }),
    [isMutating, isReady, needsProfileSetup, signIn, signOut, user, completeProfile],
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
