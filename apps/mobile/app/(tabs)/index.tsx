import { useCallback, useMemo, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import { Building2, Laptop, Play, Square } from "lucide-react-native";
import { formatDayMonth, formatWeekday } from "@omam/calendar";
import { translateError } from "@omam/i18n";
import type { WorkSessionCategory } from "@omam/contracts";
import { SessionDial } from "../../src/components/session-dial";
import { formatDurationHms, joinMeta } from "../../src/lib/format";
import { useAttendance } from "../../src/providers/attendance-provider";
import {
  Button,
  Icon,
  Screen,
  SegmentedControl,
  Text,
  layout,
  useColors,
  useTabBarHeight,
  useLanguage,
  useToast,
  type SegmentOption,
} from "../../src/design/taraz";

const locale = "en-US";

/* Module scope — the clock re-renders every second and must not rebuild this. */
const twoDigits = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false });

function formatWallClock(date: Date) {
  return `${twoDigits.format(date.getHours())}:${twoDigits.format(date.getMinutes())}:${twoDigits.format(date.getSeconds())}`;
}

export default function TodayScreen() {
  const { summary, calendar, clockIn, clockOut, isMutating } = useAttendance();
  const { showToast } = useToast();
  const { language, t } = useLanguage();
  const { width } = useWindowDimensions();
  const colors = useColors();
  const tabBarHeight = useTabBarHeight();

  const [now, setNow] = useState(() => new Date());
  const [optimisticStartAt, setOptimisticStartAt] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<WorkSessionCategory>("ONSITE");

  // Only tick while this screen is actually on top. It used to run for the
  // life of the app, re-rendering Today once a second behind the other tabs.
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());

      const timer = setInterval(() => setNow(new Date()), 1000);

      return () => clearInterval(timer);
    }, []),
  );

  // Plain arithmetic and a name lookup — cheap enough to run every tick.
  const displayDate = joinMeta(
    formatWeekday(now, calendar, language),
    formatDayMonth(now, calendar, language),
  );

  const activeStartAt = summary.activeSession?.startAt ?? optimisticStartAt;
  const activeCategory = summary.activeSession?.category ?? selectedCategory;
  const isRunning = Boolean(activeStartAt);
  const elapsedSeconds = activeStartAt
    ? Math.max(0, Math.floor((now.getTime() - new Date(activeStartAt).getTime()) / 1000))
    : 0;

  const timecode = isRunning ? formatDurationHms(elapsedSeconds) : formatWallClock(now);
  const dialSize = useMemo(() => Math.min(Math.max(width * 0.72, 232), 300), [width]);

  const categoryOptions = useMemo<SegmentOption<WorkSessionCategory>[]>(
    () => [
      {
        value: "ONSITE",
        label: t("category.ONSITE"),
        icon: (active) => (
          <Icon glyph={Building2} size={16} color={active ? colors.textTitle : colors.textMuted} />
        ),
      },
      {
        value: "REMOTE",
        label: t("category.REMOTE"),
        icon: (active) => (
          <Icon glyph={Laptop} size={16} color={active ? colors.textTitle : colors.textMuted} />
        ),
      },
    ],
    [colors.textMuted, colors.textTitle, t],
  );

  async function handleToggle() {
    try {
      if (summary.activeSession) {
        setOptimisticStartAt(null);
        await clockOut();

        return;
      }

      setOptimisticStartAt(new Date().toISOString());
      await clockIn(selectedCategory);
    } catch (error) {
      if (!summary.activeSession) {
        setOptimisticStartAt(null);
      }

      showToast({
        title: t("today.failedTitle"),
        description: translateError(error, t),
        tone: "error",
      });
    }
  }

  return (
    <Screen scroll center bottomInset={tabBarHeight} gap={layout.gapSection}>
      <View style={{ alignItems: "center", gap: 2 }}>
        <Text role="overline" tone="muted">
          {displayDate}
        </Text>
        <Text role="monoDisplay" tone="title">
          {timecode}
        </Text>
        <Text role="caption" tone="muted">
          {isRunning ? t("today.running") : t("today.idle")}
        </Text>
      </View>

      <SessionDial
        size={dialSize}
        isRunning={isRunning}
        elapsedSeconds={elapsedSeconds}
        currentDate={now}
      />

      <View style={{ alignItems: "center", gap: layout.gapLoose }}>
        <SegmentedControl
          options={categoryOptions}
          value={activeCategory}
          onChange={setSelectedCategory}
          disabled={isRunning || isMutating}
          size="lg"
        />

        <Button
          label={isMutating ? t("common.saving") : isRunning ? t("today.stop") : t("today.start")}
          size="lg"
          pill
          loading={isMutating}
          variant={isRunning ? "secondary" : "primary"}
          onPress={handleToggle}
          icon={
            <Icon
              glyph={isRunning ? Square : Play}
              size={18}
              color={isRunning ? colors.textTitle : colors.textOnAccent}
              filled
            />
          }
          style={{ minWidth: 184 }}
        />
      </View>
    </Screen>
  );
}
