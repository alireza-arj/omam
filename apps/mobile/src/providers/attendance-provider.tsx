import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { useSQLiteContext } from "expo-sqlite";
import type { SessionDto, SettingsDto, SummaryDto, UpdateSettingsInputDto, WorkSessionCategory } from "@omam/contracts";
import {
  getSessions,
  getMonthlySummary,
  clockIn as dbClockIn,
  clockOut as dbClockOut,
  createSession as dbCreateSession,
  deleteSession as dbDeleteSession,
  updateSession as dbUpdateSession,
} from "../lib/db/sessions";
import { getSettings, upsertSettings } from "../lib/db/settings";
import { currentMonthKey, localMonthRange } from "../lib/format";
import { useAuth } from "./auth-provider";

const defaultSettings: SettingsDto = {
  hourlyRate: 0,
  currency: "IRR",
  monthlyGoalHours: 160,
};

const defaultSummary: SummaryDto = {
  totalMinutes: 0,
  totalIncome: 0,
  activeSession: null,
  workedDays: 0,
  categoryMinutes: {
    onsite: 0,
    remote: 0,
  },
};

/** The editable shape of a session, shared by manual entry and editing. */
export type SessionInput = {
  startAt: string;
  endAt: string | null;
  category: WorkSessionCategory;
  note: string | null;
};

type AttendanceContextValue = {
  sessions: SessionDto[];
  settings: SettingsDto;
  summary: SummaryDto;
  isLoading: boolean;
  isMutating: boolean;
  refresh: () => Promise<void>;
  clockIn: (category: WorkSessionCategory) => Promise<void>;
  clockOut: () => Promise<void>;
  createSession: (input: SessionInput) => Promise<void>;
  updateSession: (sessionId: string, input: SessionInput) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  saveSettings: (payload: UpdateSettingsInputDto) => Promise<SettingsDto>;
};

const AttendanceContext = createContext<AttendanceContextValue | null>(null);

export function AttendanceProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const { user, isAuthenticated } = useAuth();
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [settings, setSettings] = useState<SettingsDto>(defaultSettings);
  const [summary, setSummary] = useState<SummaryDto>(defaultSummary);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const month = useMemo(() => currentMonthKey(), []);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setSessions([]);
      setSettings(defaultSettings);
      setSummary(defaultSummary);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const range = localMonthRange(month);
      const [userSettings, userSessions, userSummary] = await Promise.all([
        getSettings(db, user.id),
        getSessions(db, user.id, range.from.toISOString(), range.to.toISOString()),
        getMonthlySummary(db, user.id, month),
      ]);

      setSettings(userSettings);
      setSessions(userSessions);
      setSummary(userSummary);
    } finally {
      setIsLoading(false);
    }
  }, [db, isAuthenticated, month, user]);

  useEffect(() => {
    refresh().catch(() => {
      setIsLoading(false);
    });
  }, [refresh]);

  const clockIn = useCallback(async (category: WorkSessionCategory) => {
    if (!user) return;

    setIsMutating(true);

    try {
      await dbClockIn(db, user.id, new Date().toISOString(), category);
      await refresh();
    } catch (error) {
      throw error instanceof Error ? error : new Error("ATTENDANCE_CLOCKIN_FAILED");
    } finally {
      setIsMutating(false);
    }
  }, [db, refresh, user]);

  const clockOut = useCallback(async () => {
    if (!summary.activeSession || !user) return;

    setIsMutating(true);

    try {
      await dbClockOut(db, summary.activeSession.id, user.id, new Date().toISOString());
      await refresh();
    } catch (error) {
      throw error instanceof Error ? error : new Error("ATTENDANCE_CLOCKOUT_FAILED");
    } finally {
      setIsMutating(false);
    }
  }, [db, refresh, summary.activeSession, user]);

  const createSession = useCallback(
    async (input: SessionInput) => {
      if (!user) throw new Error("Not authenticated.");

      setIsMutating(true);

      try {
        await dbCreateSession(db, user.id, input.startAt, input.endAt, input.category, input.note);
        await refresh();
      } finally {
        setIsMutating(false);
      }
    },
    [db, refresh, user],
  );

  const updateSession = useCallback(
    async (sessionId: string, input: SessionInput) => {
      if (!user) throw new Error("Not authenticated.");

      setIsMutating(true);

      try {
        await dbUpdateSession(
          db,
          sessionId,
          user.id,
          input.startAt,
          input.endAt,
          input.category,
          input.note,
        );
        await refresh();
      } finally {
        setIsMutating(false);
      }
    },
    [db, refresh, user],
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      if (!user) throw new Error("Not authenticated.");

      setIsMutating(true);

      try {
        await dbDeleteSession(db, sessionId, user.id);
        await refresh();
      } finally {
        setIsMutating(false);
      }
    },
    [db, refresh, user],
  );

  const saveSettings = useCallback(
    async (payload: UpdateSettingsInputDto) => {
      if (!user) throw new Error("Not authenticated.");

      setIsMutating(true);

      try {
        const nextSettings = await upsertSettings(db, user.id, payload);
        setSettings(nextSettings);
        await refresh();
        return nextSettings;
      } catch (error) {
        throw error instanceof Error ? error : new Error("ATTENDANCE_SAVE_FAILED");
      } finally {
        setIsMutating(false);
      }
    },
    [db, refresh, user],
  );

  const value = useMemo<AttendanceContextValue>(
    () => ({
      sessions,
      settings,
      summary,
      isLoading,
      isMutating,
      refresh,
      clockIn,
      clockOut,
      createSession,
      updateSession,
      deleteSession,
      saveSettings,
    }),
    [
      clockIn,
      clockOut,
      createSession,
      deleteSession,
      isLoading,
      isMutating,
      refresh,
      saveSettings,
      sessions,
      settings,
      summary,
      updateSession,
    ],
  );

  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>;
}

export function useAttendance() {
  const ctx = useContext(AttendanceContext);

  if (!ctx) {
    throw new Error("useAttendance must be used within AttendanceProvider");
  }

  return ctx;
}
