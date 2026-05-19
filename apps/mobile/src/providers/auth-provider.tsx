import { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, setApiAuthToken } from "../lib/api";

const AUTH_TOKEN_STORAGE_KEY = "@omam:authToken";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
      .then((stored) => {
        if (!active) return;
        if (stored) {
          setToken(stored);
          setApiAuthToken(stored);
        }
        setIsReady(true);
      })
      .catch(() => {
        if (active) setIsReady(true);
      });
    return () => { active = false; };
  }, []);

  const login = useCallback(async (payload) => {
    const res = await api.login(payload);
    await AsyncStorage.setItem(AUTH_TOKEN_STORAGE_KEY, res.token);
    setToken(res.token);
    setApiAuthToken(res.token);
    setUser(res.user);
    return res;
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch {}
    await AsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setApiAuthToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, isReady, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
