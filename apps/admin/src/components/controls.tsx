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
  const { language, t } = useLanguage();
  const thisMonth = currentMonth(calendar);

  return (
    <div className="row gap-4">
      <Button
        variant="outline"
        size="sm"
        aria-label={t("admin.month.previous")}
        onClick={() => onChange(shiftMonth(month, -1, calendar))}
      >
        {/* The arrow points the way the reader is going, not the way the page runs. */}
        &#8592;
      </Button>
      <span className="t-title3" style={{ minWidth: 160, textAlign: "center" }}>
        {monthLabel(month, calendar, language)}
      </span>
      <Button
        variant="outline"
        size="sm"
        aria-label={t("admin.month.next")}
        disabled={month >= thisMonth}
        onClick={() => onChange(shiftMonth(month, 1, calendar))}
      >
        &#8594;
      </Button>
      {month === thisMonth ? null : (
        <Button variant="ghost" size="sm" onClick={() => onChange(thisMonth)}>
          {t("admin.month.thisMonth")}
        </Button>
      )}
    </div>
  );
}

/**
 * One bar per day of the month. Days with no approved time keep their slot, so
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
