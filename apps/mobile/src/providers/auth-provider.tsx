import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthResponseDto, CompleteProfileInput } from "@omam/contracts";
import { api, setApiAuthToken } from "../lib/api";

const AUTH_TOKEN_STORAGE_KEY = "@omam:auth-token";

type AuthContextValue = {
  user: AuthResponseDto["user"] | null;
  needsProfileSetup: boolean;
  isReady: boolean;
  isAuthenticated: boolean;
  isMutating: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  completeProfile: (payload: CompleteProfileInput) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthResponseDto["user"] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  useEffect(() => {
    let active = true;

    async function boot() {
      const storedToken = await AsyncStorage.getItem(AUTH_TOKEN_STORAGE_KEY).catch(() => null);

      if (!active) {
        return;
      }

      if (!storedToken) {
        setApiAuthToken(null);
        setToken(null);
        setUser(null);
        setNeedsProfileSetup(false);
        setIsReady(true);
        return;
      }

      setApiAuthToken(storedToken);

      try {
        const response = await api.me();

        if (!active) {
          return;
        }

        setToken(storedToken);
        setUser(response.user);
        setNeedsProfileSetup(response.needsProfileSetup);
      } catch {
        if (!active) {
          return;
        }

        await AsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY).catch(() => undefined);
        setApiAuthToken(null);
        setToken(null);
        setUser(null);
        setNeedsProfileSetup(false);
      } finally {
        if (active) {
          setIsReady(true);
        }
      }
    }

    boot().catch(async () => {
      if (!active) {
        return;
      }

      await AsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY).catch(() => undefined);
      setApiAuthToken(null);
      setToken(null);
      setUser(null);
      setNeedsProfileSetup(false);
      setIsReady(true);
    });

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    setIsMutating(true);

    try {
      const response = await api.login({
        username: username.trim(),
        password,
      });

      setApiAuthToken(response.token);
      setToken(response.token);
      setUser(response.user);
      setNeedsProfileSetup(response.needsProfileSetup);
      await AsyncStorage.setItem(AUTH_TOKEN_STORAGE_KEY, response.token).catch(() => undefined);
    } finally {
      setIsMutating(false);
    }
  }, []);

  const completeProfile = useCallback(async (payload: CompleteProfileInput) => {
    setIsMutating(true);

    try {
      const response = await api.completeProfile(payload);
      setUser(response.user);
      setNeedsProfileSetup(response.needsProfileSetup);
    } finally {
      setIsMutating(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsMutating(true);

    try {
      if (token) {
        await api.logout().catch(() => undefined);
      }

      await AsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY).catch(() => undefined);
      setApiAuthToken(null);
      setToken(null);
      setUser(null);
      setNeedsProfileSetup(false);
    } finally {
      setIsMutating(false);
    }
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      needsProfileSetup,
      isReady,
      isAuthenticated: Boolean(user && token),
      isMutating,
      signIn,
      completeProfile,
      signOut,
    }),
    [completeProfile, isMutating, isReady, needsProfileSetup, signIn, signOut, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
