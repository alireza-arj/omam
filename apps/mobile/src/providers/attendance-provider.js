import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, startTransition, useContext, useEffect, useState, } from "react";
import * as Haptics from "expo-haptics";
import { api } from "../lib/api";
import { currentMonthKey } from "../lib/format";
const defaultSettings = {
    hourlyRate: 0,
    currency: "IRR",
    monthlyGoalHours: 160,
};
const defaultSummary = {
    totalMinutes: 0,
    totalIncome: 0,
    activeSession: null,
    workedDays: 0,
};
const AttendanceContext = createContext(null);
function toError(error, fallbackMessage) {
    if (error instanceof Error) {
        return error;
    }
    if (typeof error === "string" && error.trim()) {
        return new Error(error);
    }
    return new Error(fallbackMessage);
}
function monthRange(month) {
    const from = new Date(`${month}-01T00:00:00.000Z`);
    const [year, monthIndex] = month.split("-").map(Number);
    const to = new Date(Date.UTC(year, monthIndex, 0, 23, 59, 59, 999));
    return {
        from: from.toISOString(),
        to: to.toISOString(),
    };
}
export function AttendanceProvider({ children }) {
    const [month] = useState(currentMonthKey);
    const [sessions, setSessions] = useState([]);
    const [settings, setSettings] = useState(defaultSettings);
    const [summary, setSummary] = useState(defaultSummary);
    const [isLoading, setIsLoading] = useState(true);
    const [isMutating, setIsMutating] = useState(false);
    async function refresh() {
        const range = monthRange(month);
        const [nextSettings, nextSessions, nextSummary] = await Promise.all([
            api.getSettings(),
            api.getSessions(range.from, range.to),
            api.getSummary(month),
        ]);
        startTransition(() => {
            setSettings(nextSettings);
            setSessions(nextSessions.sessions);
            setSummary(nextSummary.summary);
            setIsLoading(false);
        });
    }
    useEffect(() => {
        refresh().catch((error) => {
            console.error(error);
            setIsLoading(false);
        });
    }, []);
    async function clockIn(note) {
        setIsMutating(true);
        try {
            await api.clockIn({
                startAt: new Date().toISOString(),
                note: note?.trim() ? note.trim() : null,
            });
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
            await refresh();
        }
        catch (error) {
            throw toError(error, "ATTENDANCE_CLOCKIN_FAILED");
        }
        finally {
            setIsMutating(false);
        }
    }
    async function clockOut() {
        if (!summary.activeSession) {
            return;
        }
        setIsMutating(true);
        try {
            await api.clockOut(summary.activeSession.id, {
                endAt: new Date().toISOString(),
            });
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
            await refresh();
        }
        catch (error) {
            throw toError(error, "ATTENDANCE_CLOCKOUT_FAILED");
        }
        finally {
            setIsMutating(false);
        }
    }
    async function saveSettings(next) {
        setIsMutating(true);
        try {
            const updated = await api.updateSettings(next);
            setSettings(updated);
            await refresh();
        }
        catch (error) {
            throw toError(error, "ATTENDANCE_SAVE_FAILED");
        }
        finally {
            setIsMutating(false);
        }
    }
    return (_jsx(AttendanceContext.Provider, { value: {
            month,
            sessions,
            settings,
            summary,
            isLoading,
            isMutating,
            refresh,
            clockIn,
            clockOut,
            saveSettings,
        }, children: children }));
}
export function useAttendance() {
    const context = useContext(AttendanceContext);
    if (!context) {
        throw new Error("useAttendance must be used inside AttendanceProvider");
    }
    return context;
}
