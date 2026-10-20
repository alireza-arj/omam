import { useEffect, useState } from "react";
import { ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { Clock3 } from "lucide-react-native";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { Button } from "./button";
import { PickerPanel, PickerTrigger } from "./picker-field";
import { Text } from "./text";
import { useLanguage } from "../i18n";
import { useColors } from "../theme";
import { layout, radius } from "../tokens";

export type TimePickerProps = {
  label: string;
  /** `HH:MM`, or empty when `clearLabel` allows it. */
  value: string;
  onChange: (next: string) => void;
  /** Offers an empty value — an end time for a session still running. */
  clearLabel?: string;
  emptyText?: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = Array.from({ length: 12 }, (_, step) => step * 5);
const pad = (value: number) => `${value}`.padStart(2, "0");

/** The field. Two of them often share a row, so the panel is placed by the form — see `TimePickerPanel`. */
export function TimePicker({ label, value, emptyText, open, onOpenChange, style }: Pick<TimePickerProps, "label" | "value" | "emptyText" | "open" | "onOpenChange"> & { style?: StyleProp<ViewStyle> }) {
  return (
    <PickerTrigger label={label} value={value} placeholder={emptyText} glyph={Clock3} numeric open={open} onPress={() => onOpenChange(!open)} style={style} />
  );
}

/**
 * Hour and minute grids rather than wheels: the same taps on web and native.
 * Minutes step by five, but a recorded `12:26` keeps its own cell so opening
 * and saving never rounds a timer-made session.
 */
export function TimePickerPanel({ value, onChange, clearLabel, open, onOpenChange }: Pick<TimePickerProps, "value" | "onChange" | "clearLabel" | "open" | "onOpenChange">) {
  const { t } = useLanguage();
  const setOpen = onOpenChange;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  const [hour, setHour] = useState(match ? Number(match[1]) : 9);
  const [minute, setMinute] = useState(match ? Number(match[2]) : 0);

  useEffect(() => {
    if (!open) return;
    const next = /^(\d{1,2}):(\d{2})$/.exec(value);
    setHour(next ? Number(next[1]) : new Date().getHours());
    setMinute(next ? Number(next[2]) : 0);
  }, [open, value]);

  if (!open) return null;

  return (
    <PickerPanel>
      <View style={{ gap: layout.gapTight }}>
        <Text role="label" tone="muted">{t("session.hour")}</Text>
        <Grid values={HOURS} columns={6} selected={hour} onSelect={setHour} />
      </View>
      <View style={{ gap: layout.gapTight }}>
        <Text role="label" tone="muted">{t("session.minute")}</Text>
        <Grid values={MINUTES.includes(minute) ? MINUTES : [...MINUTES, minute].sort((a, b) => a - b)} columns={6} selected={minute} onSelect={setMinute} />
      </View>

      <View style={{ flexDirection: "row", gap: layout.gapDefault }}>
        {clearLabel ? (
          <Button label={clearLabel} variant="quiet" style={{ flex: 1 }} onPress={() => { onChange(""); setOpen(false); }} />
        ) : null}
        <Button label={`${t("common.save")} · ${pad(hour)}:${pad(minute)}`} style={{ flex: 1 }} onPress={() => { onChange(`${pad(hour)}:${pad(minute)}`); setOpen(false); }} />
      </View>
    </PickerPanel>
  );
}

function Grid({ values, columns, selected, onSelect }: { values: number[]; columns: number; selected: number; onSelect: (next: number) => void }) {
  const colors = useColors();
  const rows = Array.from({ length: Math.ceil(values.length / columns) }, (_, row) => values.slice(row * columns, row * columns + columns));

  return (
    <ScrollView scrollEnabled={false} contentContainerStyle={{ gap: 4, direction: "ltr" }}>
      {rows.map((row, index) => (
        <View key={index} style={{ flexDirection: "row", gap: 4 }}>
          {row.map((entry) => {
            const active = entry === selected;
            return (
              <PressableFeedback
                key={entry}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onSelect(entry)}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: layout.controlMd,
                  borderRadius: radius.md,
                  backgroundColor: active ? colors.fillAccent : colors.fillQuiet,
                }}
              >
                <Text role="mono" color={active ? colors.textOnAccent : colors.textTitle} style={{ textAlign: "center" }}>
                  {pad(entry)}
                </Text>
              </PressableFeedback>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}
