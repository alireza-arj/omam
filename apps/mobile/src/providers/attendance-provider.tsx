import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { useSQLiteContext } from "expo-sqlite";
import type { SessionDto, SettingsDto, SummaryDto, UpdateSettingsInputDto } from "@omam/contracts";
import { getSessions, getMonthlySummary, clockIn as dbClockIn, clockOut as dbClockOut } from "../lib/db/sessions";
import { getSettings, upsertSettings } from "../lib/db/settings";
import { currentMonthKey } from "../lib/format";
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
};

type AttendanceContextValue = {
  sessions: SessionDto[];
  settings: SettingsDto;
  summary: SummaryDto;
  isLoading: boolean;
  isMutating: boolean;
  refresh: () => Promise<void>;
  clockIn: () => Promise<void>;
  clockOut: () => Promise<void>;
  saveSettings: (payload: UpdateSettingsInputDto) => Promise<SettingsDto>;
};

const AttendanceContext = createContext<AttendanceContextValue | null>(null);

function monthRange(month: string) {
  const [yearValue, monthValue] = month.split("-").map((part) => Number(part));
  const year = Number.isFinite(yearValue) ? yearValue : new Date().getFullYear();
  const monthIndex = Number.isFinite(monthValue) ? monthValue - 1 : new Date().getMonth();
  const from = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

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
      const range = monthRange(month);
      const userSettings = getSettings(db, user.id);
      const userSessions = getSessions(db, user.id, range.from, range.to);
      const userSummary = getMonthlySummary(db, user.id, month);

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

  const clockIn = useCallback(async () => {
    if (!user) return;

    setIsMutating(true);

    try {
      dbClockIn(db, user.id, new Date().toISOString());
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
      dbClockOut(db, summary.activeSession.id, user.id, new Date().toISOString());
      await refresh();
    } catch (error) {
      throw error instanceof Error ? error : new Error("ATTENDANCE_CLOCKOUT_FAILED");
    } finally {
      setIsMutating(false);
    }
  }, [db, refresh, summary.activeSession, user]);

  const saveSettings = useCallback(
    async (payload: UpdateSettingsInputDto) => {
      if (!user) throw new Error("Not authenticated.");

      setIsMutating(true);

      try {
        const nextSettings = upsertSettings(db, user.id, payload);
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
      saveSettings,
    }),
    [clockIn, clockOut, isLoading, isMutating, refresh, saveSettings, sessions, settings, summary],
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
