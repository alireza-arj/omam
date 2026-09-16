import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { DEFAULT_CALENDAR, monthKey, monthRange, type CalendarSystem } from "@omam/calendar";
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
import { DEFAULT_LANGUAGE } from "@omam/i18n";
import { useLanguage } from "../design/taraz";
import { useAuth } from "./auth-provider";

const defaultSettings: SettingsDto = {
  hourlyRate: 0,
  currency: "IRR",
  monthlyGoalHours: 160,
  calendar: DEFAULT_CALENDAR,
  language: DEFAULT_LANGUAGE,
};

const defaultSummary: SummaryDto = {
  totalMinutes: 0,
  completedMinutes: 0,
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
  /** The calendar every date on screen is read in. */
  calendar: CalendarSystem;
  /** `YYYY-MM` of the month in view, in `calendar`. */
  month: string;
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
  const { setLanguage } = useLanguage();
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [settings, setSettings] = useState<SettingsDto>(defaultSettings);
  const [summary, setSummary] = useState<SummaryDto>(defaultSummary);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [month, setMonth] = useState(() => monthKey(new Date(), DEFAULT_CALENDAR));

  /**
   * Settings load first because they name the calendar, and the calendar
   * decides where the month starts — 1 Shahrivar is not 1 September.
   */
  const refresh = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setSessions([]);
      setSettings(defaultSettings);
      setSummary(defaultSummary);
      setMonth(monthKey(new Date(), DEFAULT_CALENDAR));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const userSettings = await getSettings(db, user.id);
      const currentMonth = monthKey(new Date(), userSettings.calendar);
      const range = monthRange(currentMonth, userSettings.calendar);

      const [userSessions, userSummary] = await Promise.all([
        getSessions(db, user.id, range.from.toISOString(), range.to.toISOString()),
        getMonthlySummary(db, user.id, currentMonth, userSettings.calendar),
      ]);

      // The account's own language wins over whatever the device was reading,
      // so signing in as someone else switches the interface with them.
      setLanguage(userSettings.language);
      setSettings(userSettings);
      setMonth(currentMonth);
      setSessions(userSessions);
      setSummary(userSummary);
    } finally {
      setIsLoading(false);
    }
  }, [db, isAuthenticated, setLanguage, user]);

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
      if (!user) throw new Error("NOT_AUTHENTICATED");

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
      if (!user) throw new Error("NOT_AUTHENTICATED");

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
      if (!user) throw new Error("NOT_AUTHENTICATED");

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
      if (!user) throw new Error("NOT_AUTHENTICATED");

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
      calendar: settings.calendar,
      month,
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
      month,
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
