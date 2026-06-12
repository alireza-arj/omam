import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthResponseDto, AuthUserDto, CompleteProfileInputDto } from "@omam/contracts";
import { api, setApiAuthToken } from "../lib/api";

const AUTH_TOKEN_STORAGE_KEY = "@omam:authToken";

type AuthContextValue = {
  token: string | null;
  user: AuthUserDto | null;
  isReady: boolean;
  isMutating: boolean;
  isAuthenticated: boolean;
  needsProfileSetup: boolean;
  signIn: (username: string, password: string) => Promise<AuthResponseDto>;
  signOut: () => Promise<void>;
  completeProfile: (payload: CompleteProfileInputDto) => Promise<AuthUserDto>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUserDto | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);

  useEffect(() => {
    let active = true;

    async function boot() {
      const stored = await AsyncStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

      if (!active) {
        return;
      }

      if (!stored) {
        setIsReady(true);
        return;
      }

      setToken(stored);
      setApiAuthToken(stored);

      try {
        const res = await api.me();

        if (!active) {
          return;
        }

        setUser(res.user);
        setNeedsProfileSetup(res.needsProfileSetup);
      } catch {
        await AsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);

        if (!active) {
          return;
        }

        setToken(null);
        setApiAuthToken(null);
        setUser(null);
        setNeedsProfileSetup(false);
      } finally {
        if (active) {
          setIsReady(true);
        }
      }
    }

    boot().catch(() => {
      if (active) {
        setIsReady(true);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    setIsMutating(true);

    try {
      const res = await api.login({ username, password });

      await AsyncStorage.setItem(AUTH_TOKEN_STORAGE_KEY, res.token);
      setToken(res.token);
      setApiAuthToken(res.token);
      setUser(res.user);
      setNeedsProfileSetup(res.needsProfileSetup);

      return res;
    } finally {
      setIsMutating(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsMutating(true);

    try {
      await api.logout().catch(() => undefined);
      await AsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      setToken(null);
      setUser(null);
      setNeedsProfileSetup(false);
      setApiAuthToken(null);
    } finally {
      setIsMutating(false);
    }
  }, []);

  const completeProfile = useCallback(async (payload: CompleteProfileInputDto) => {
    setIsMutating(true);

    try {
      const res = await api.completeProfile(payload);

      setUser(res.user);
      setNeedsProfileSetup(res.needsProfileSetup);

      return res.user;
    } finally {
      setIsMutating(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isReady,
      isMutating,
      isAuthenticated: Boolean(token && user),
      needsProfileSetup,
      signIn,
      signOut,
      completeProfile,
    }),
    [completeProfile, isMutating, isReady, needsProfileSetup, signIn, signOut, token, user],
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
