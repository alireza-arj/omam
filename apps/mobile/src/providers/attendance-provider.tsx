import { createContext, useContext, useMemo } from "react";
import { useLanguage } from "./language-provider";

const AttendanceContext = createContext(null);

export function AttendanceProvider({ children }) {
  const { t } = useLanguage();

  const value = useMemo(() => ({
    // placeholder - implement attendance logic here
    t,
  }), [t]);

  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>;
}

export function useAttendance() {
  const ctx = useContext(AttendanceContext);
  if (!ctx) {
    throw new Error("useAttendance must be used within AttendanceProvider");
  }
  return ctx;
}
