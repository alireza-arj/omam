import type { CalendarSystem } from "@omam/calendar";
import type { DailyBucketDto } from "@omam/contracts";
import { currentMonth, dayNumber, formatDuration, monthLabel, shiftMonth } from "../lib/format";
import { useLanguage } from "../lib/i18n";
import { Button } from "./ui";

/** Month navigation in whichever calendar the organization reads dates in. */
export function MonthPicker({
  month,
  calendar,
  onChange,
}: {
  month: string;
  calendar: CalendarSystem;
  onChange: (month: string) => void;
}) {
  const { language, isRtl, t } = useLanguage();
  const thisMonth = currentMonth(calendar);

  return (
    <div className="month-picker">
      <div className="month-navigation">
        <Button
          variant="ghost"
          className="icon"
          aria-label={t("admin.month.previous")}
          onClick={() => onChange(shiftMonth(month, -1, calendar))}
        >
          <span aria-hidden>{isRtl ? "→" : "←"}</span>
        </Button>
        <span className="month-label" aria-live="polite">
          {monthLabel(month, calendar, language)}
        </span>
        <Button
          variant="ghost"
          className="icon"
          aria-label={t("admin.month.next")}
          disabled={month >= thisMonth}
          onClick={() => onChange(shiftMonth(month, 1, calendar))}
        >
          <span aria-hidden>{isRtl ? "←" : "→"}</span>
        </Button>
      </div>
      {month === thisMonth ? null : (
        <Button variant="ghost" onClick={() => onChange(thisMonth)}>
          {t("admin.month.thisMonth")}
        </Button>
      )}
    </div>
  );
}

/**
 * One bar per day of the month. Days with no completed time keep their slot, so
 * the shape of the month reads correctly instead of collapsing.
 */
export function DayBars({ days }: { days: DailyBucketDto[] }) {
  const { language } = useLanguage();
  const peak = Math.max(1, ...days.map((day) => day.minutes));

  return (
    <div className="stack gap-4">
      <div className="bars">
        {days.map((day) => (
          <div
            key={day.day}
            data-filled={day.minutes > 0}
            style={{ height: `${Math.max(2, (day.minutes / peak) * 100)}%` }}
            title={`${day.day} · ${formatDuration(day.minutes, language)}`}
          />
        ))}
      </div>
      <div className="row between t-caption faint">
        <span>{days.length ? dayNumber(days[0].day) : ""}</span>
        <span>{days.length ? dayNumber(days[days.length - 1].day) : ""}</span>
      </div>
    </div>
  );
}
