import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import type { SessionDto, SettingsDto, SummaryDto, UpdateSettingsInputDto } from "@omam/contracts";
import { api } from "../lib/api";
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
  const { isAuthenticated } = useAuth();
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [settings, setSettings] = useState<SettingsDto>(defaultSettings);
  const [summary, setSummary] = useState<SummaryDto>(defaultSummary);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const month = useMemo(() => currentMonthKey(), []);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setSessions([]);
      setSettings(defaultSettings);
      setSummary(defaultSummary);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const range = monthRange(month);
      const [settingsResponse, sessionsResponse, summaryResponse] = await Promise.all([
        api.getSettings(),
        api.getSessions(range.from, range.to),
        api.getSummary(month),
      ]);

      setSettings(settingsResponse);
      setSessions(sessionsResponse.sessions);
      setSummary(summaryResponse.summary);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, month]);

  useEffect(() => {
    refresh().catch(() => {
      setIsLoading(false);
    });
  }, [refresh]);

  const clockIn = useCallback(async () => {
    setIsMutating(true);

    try {
      await api.clockIn({
        startAt: new Date().toISOString(),
      });
      await refresh();
    } catch (error) {
      throw error instanceof Error ? error : new Error("ATTENDANCE_CLOCKIN_FAILED");
    } finally {
      setIsMutating(false);
    }
  }, [refresh]);

  const clockOut = useCallback(async () => {
    if (!summary.activeSession) {
      return;
    }

    setIsMutating(true);

    try {
      await api.clockOut(summary.activeSession.id, {
        endAt: new Date().toISOString(),
      });
      await refresh();
    } catch (error) {
      throw error instanceof Error ? error : new Error("ATTENDANCE_CLOCKOUT_FAILED");
    } finally {
      setIsMutating(false);
    }
  }, [refresh, summary.activeSession]);

  const saveSettings = useCallback(
    async (payload: UpdateSettingsInputDto) => {
      setIsMutating(true);

      try {
        const nextSettings = await api.updateSettings(payload);

        setSettings(nextSettings);
        await refresh();

        return nextSettings;
      } catch (error) {
        throw error instanceof Error ? error : new Error("ATTENDANCE_SAVE_FAILED");
      } finally {
        setIsMutating(false);
      }
    },
    [refresh],
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
