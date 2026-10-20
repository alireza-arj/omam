import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react-native";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import {
  dayKey,
  formatFullDate,
  monthLength,
  monthNames,
  parseDayKey,
  shortWeekdayNames,
  toDate,
  toParts,
  weekStartDay,
  type CalendarSystem,
} from "@omam/calendar";
import { Button } from "./button";
import { Icon } from "./icon";
import { IconButton } from "./icon-button";
import { PickerPanel, PickerTrigger } from "./picker-field";
import { Text } from "./text";
import { useLanguage } from "../i18n";
import { useColors } from "../theme";
import { layout, radius } from "../tokens";

export type DatePickerProps = {
  label: string;
  /** `YYYY-MM-DD` in `calendar`. */
  value: string;
  onChange: (next: string) => void;
  calendar: CalendarSystem;
  hint?: string;
  /** Days after this one cannot be picked. */
  max?: Date;
};

/** A month grid in the reader's calendar — Jalali weeks start on Shanbe. */
export function DatePicker({ label, value, onChange, calendar, hint, max }: DatePickerProps) {
  const { language, t } = useLanguage();
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const selected = parseDayKey(value, calendar);
  const today = toParts(new Date(), calendar);
  const [view, setView] = useState(() => selected ?? today);

  useEffect(() => {
    if (open) setView(parseDayKey(value, calendar) ?? toParts(new Date(), calendar));
  }, [calendar, open, value]);

  const weeks = useMemo(() => {
    const first = toDate({ year: view.year, month: view.month, day: 1 }, calendar);
    if (!first) return [];
    const lead = (first.getDay() - weekStartDay(calendar) + 7) % 7;
    const length = monthLength(view.year, view.month, calendar);
    const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length }, (_, index) => index + 1)];
    while (cells.length % 7) cells.push(null);
    return Array.from({ length: cells.length / 7 }, (_, row) => cells.slice(row * 7, row * 7 + 7));
  }, [calendar, view.month, view.year]);

  const weekdays = useMemo(() => {
    const names = shortWeekdayNames(calendar, language);
    const start = weekStartDay(calendar);
    return Array.from({ length: 7 }, (_, index) => names[(start + index) % 7]);
  }, [calendar, language]);

  const maxKey = max ? dayKey(max, calendar) : null;
  const selectedDate = selected ? toDate(selected, calendar) : null;

  function shift(delta: number) {
    const absolute = view.year * 12 + (view.month - 1) + delta;
    setView({ year: Math.floor(absolute / 12), month: (absolute % 12) + 1, day: 1 });
  }

  function pick(day: number) {
    onChange(`${view.year}-${`${view.month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`);
    setOpen(false);
  }

  return (
    <View style={{ gap: layout.gapTight }}>
      <PickerTrigger
        label={label}
        value={selectedDate ? formatFullDate(selectedDate, calendar, language) : value}
        glyph={CalendarDays}
        open={open}
        onPress={() => setOpen(!open)}
      />
      {open ? (
        <PickerPanel>
      <View style={{ alignItems: "center", flexDirection: "row", gap: layout.gapDefault }}>
        <IconButton label={t("report.previousPeriod")} size="sm" round onPress={() => shift(-1)}>
          <Icon glyph={ChevronLeft} size={layout.iconMd} color={colors.textTitle} directional />
        </IconButton>
        <Text role="label" tone="title" style={{ flex: 1, textAlign: "center" }}>
          {`${monthNames(calendar, language)[view.month - 1]} ${view.year}`}
        </Text>
        <IconButton label={t("report.nextPeriod")} size="sm" round onPress={() => shift(1)}>
          <Icon glyph={ChevronRight} size={layout.iconMd} color={colors.textTitle} directional />
        </IconButton>
      </View>

      <View style={{ gap: layout.gapTight }}>
        <View style={{ flexDirection: "row" }}>
          {weekdays.map((name, index) => (
            <Text key={index} role="caption" tone="muted" style={{ flex: 1, textAlign: "center" }}>
              {name}
            </Text>
          ))}
        </View>
        {weeks.map((week, row) => (
          <View key={row} style={{ flexDirection: "row" }}>
            {week.map((day, column) => {
              if (!day) return <View key={column} style={{ flex: 1, height: layout.controlMd + 4 }} />;
              const key = `${view.year}-${`${view.month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
              const isSelected = selected?.year === view.year && selected.month === view.month && selected.day === day;
              const isToday = today.year === view.year && today.month === view.month && today.day === day;
              const disabled = maxKey !== null && key > maxKey;
              return (
                <View key={column} style={{ flex: 1, height: layout.controlMd + 4, padding: 2 }}>
                  <PressableFeedback
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected, disabled }}
                    isDisabled={disabled}
                    onPress={() => pick(day)}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: radius.md,
                      backgroundColor: isSelected ? colors.fillAccent : "transparent",
                      borderWidth: isToday && !isSelected ? 1 : 0,
                      borderColor: colors.lineAccent,
                      opacity: disabled ? 0.3 : 1,
                    }}
                  >
                    <Text role="label" color={isSelected ? colors.textOnAccent : undefined} tone={isToday ? "accent" : "title"} style={{ textAlign: "center" }}>
                      {day}
                    </Text>
                  </PressableFeedback>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <Button label={t("session.today")} variant="quiet" size="sm" full onPress={() => { onChange(dayKey(new Date(), calendar)); setOpen(false); }} />
        </PickerPanel>
      ) : hint ? <Text role="caption" tone="muted">{hint}</Text> : null}
    </View>
  );
}
