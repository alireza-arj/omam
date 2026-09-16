import { useSearchParams } from "react-router-dom";
import { monthRange, normalizeMonthKey, type CalendarSystem } from "@omam/calendar";
import { currentMonth } from "./format";

export function useReportMonth(calendar: CalendarSystem) {
  const [params, setParams] = useSearchParams();
  let month = normalizeMonthKey(
    params.get("calendar") === calendar ? (params.get("month") ?? undefined) : undefined,
    calendar,
  );
  try {
    monthRange(month, calendar);
  } catch {
    month = currentMonth(calendar);
  }
  function setMonth(next: string) {
    setParams((previous) => {
      const updated = new URLSearchParams(previous);
      updated.set("month", next);
      updated.set("calendar", calendar);
      return updated;
    });
  }
  return [month, setMonth] as const;
}

export function reportLink(
  path: string,
  month: string,
  calendar: CalendarSystem,
  extra: Record<string, string> = {},
) {
  return `${path}?${new URLSearchParams({ month, calendar, ...extra })}`;
}
