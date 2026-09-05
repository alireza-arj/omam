import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { AuthMembershipDto, AuthUserDto, OrgRole } from "@omam/contracts";
import { roleAtLeast } from "@omam/contracts";
import { DEFAULT_CALENDAR, asCalendarSystem, type CalendarSystem } from "@omam/calendar";
import { api, readToken, writeToken } from "./api";
import { useLanguage } from "./i18n";

type SessionValue = {
  user: AuthUserDto | null;
  membership: AuthMembershipDto | null;
  /** The calendar every date in the panel is read in. */
  calendar: CalendarSystem;
  isReady: boolean;
  isSigningIn: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (role: OrgRole) => boolean;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const { adoptLanguage } = useLanguage();
  const [user, setUser] = useState<AuthUserDto | null>(null);
  const [membership, setMembership] = useState<AuthMembershipDto | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const refresh = useCallback(async () => {
    if (!readToken()) {
      setUser(null);
      setMembership(null);
      return;
    }

    try {
      const result = await api.me();

      setUser(result.user);
      setMembership(result.membership);

      // The account's own language, unless this browser has already been told
      // otherwise.
      const settings = await api.settings().catch(() => null);

      if (settings) {
        adoptLanguage(settings.language);
      }
    } catch {
      writeToken(null);
      setUser(null);
      setMembership(null);
    }
  }, [adoptLanguage]);

  useEffect(() => {
    refresh().finally(() => setIsReady(true));
  }, [refresh]);

  const signIn = useCallback(async (username: string, password: string) => {
    setIsSigningIn(true);

    try {
      const result = await api.login(username, password);

      // The panel is for running the team, not for logging your own hours.
      if (!result.membership || !roleAtLeast(result.membership.role, "MANAGER")) {
        throw new Error("MANAGERS_ONLY");
      }

      writeToken(result.token);
      setUser(result.user);
      setMembership(result.membership);
      adoptLanguage(result.membership.language);
    } finally {
      setIsSigningIn(false);
    }
  }, [adoptLanguage]);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* the token is dropped either way */
    }

    writeToken(null);
    setUser(null);
    setMembership(null);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      membership,
      calendar: asCalendarSystem(membership?.calendar ?? DEFAULT_CALENDAR),
      isReady,
      isSigningIn,
      signIn,
      signOut,
      refresh,
      can: (role) => Boolean(membership && roleAtLeast(membership.role, role)),
    }),
    [isReady, isSigningIn, membership, refresh, signIn, signOut, user],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used inside SessionProvider.");
  }

  return context;
}
