import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  teams: AuthMembershipDto[];
  selectTeam: (organizationId: string) => Promise<void>;
  isSwitching: boolean;
  can: (role: OrgRole) => boolean;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [teams, setTeams] = useState<AuthMembershipDto[]>([]);
  const [isSwitching, setIsSwitching] = useState(false);
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

      const available = (await api.teams()).memberships.filter((team) => roleAtLeast(team.role, "MANAGER"));
      if (!available.length) throw new Error("MANAGERS_ONLY");
      const selected = result.membership && roleAtLeast(result.membership.role, "MANAGER") ? result.membership : await api.selectTeam(available[0].organizationId);
      setTeams(available);
      setUser(result.user);
      setMembership(selected);

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
      writeToken(result.token);
      const available = (await api.teams()).memberships.filter((team) => roleAtLeast(team.role, "MANAGER"));
      if (!available.length) { writeToken(null); throw new Error("MANAGERS_ONLY"); }
      const selected = result.membership && roleAtLeast(result.membership.role, "MANAGER") ? result.membership : await api.selectTeam(available[0].organizationId);
      queryClient.clear();
      setTeams(available);
      setUser(result.user);
      setMembership(selected);
      adoptLanguage(selected.language);
    } finally {
      setIsSigningIn(false);
    }
  }, [adoptLanguage, queryClient]);

  const selectTeam = useCallback(async (organizationId: string) => {
    setIsSwitching(true);
    try {
      await queryClient.cancelQueries();
      const selected = await api.selectTeam(organizationId);
      queryClient.clear();
      setMembership(selected);
      const available = await api.teams();
      setTeams(available.memberships.filter((team) => roleAtLeast(team.role, "MANAGER")));
    } finally { setIsSwitching(false); }
  }, [queryClient]);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* the token is dropped either way */
    }

    writeToken(null);
    setUser(null);
    setMembership(null);
    setTeams([]);
    queryClient.clear();
  }, [queryClient]);

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
      teams, selectTeam, isSwitching,
      can: (role) => Boolean(membership && roleAtLeast(membership.role, role)),
    }),
    [isReady, isSigningIn, membership, refresh, signIn, signOut, user, teams, selectTeam, isSwitching],
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
