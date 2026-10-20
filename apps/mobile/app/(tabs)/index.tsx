import { useCallback, useMemo, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Building2, Laptop, Play, Square } from "lucide-react-native";
import { dayKey, formatDayMonth, formatWeekday } from "@omam/calendar";
import { translateError } from "@omam/i18n";
import type { WorkSessionCategory } from "@omam/contracts";
import { SessionDial } from "../../src/components/session-dial";
import { formatClock, formatDurationHms, formatShortMinutes, joinMeta, sessionMinutes } from "../../src/lib/format";
import { useAttendance } from "../../src/providers/attendance-provider";
import { useAuth } from "../../src/providers/auth-provider";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  Icon,
  MotionReveal,
  Screen,
  SegmentedControl,
  Text,
  layout,
  space,
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
  const { summary, sessions, calendar, clockIn, clockOut, isMutating } = useAttendance();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { language, t } = useLanguage();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const tabBarHeight = useTabBarHeight();

  const [now, setNow] = useState(() => new Date());
  const [optimisticStartAt, setOptimisticStartAt] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<WorkSessionCategory>("ONSITE");

  // Only tick while this screen is actually on top.
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());

      const timer = setInterval(() => setNow(new Date()), 1000);

      return () => clearInterval(timer);
    }, []),
  );

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

  const todayKey = dayKey(now, calendar);
  const todayMinutes = useMemo(
    () =>
      sessions
        .filter((session) => dayKey(new Date(session.startAt), calendar) === todayKey)
        .reduce((total, session) => total + sessionMinutes(session), 0),
    [calendar, sessions, todayKey],
  );
  const runningMinutes = Math.floor(elapsedSeconds / 60);

  const timecode = isRunning ? formatDurationHms(elapsedSeconds) : formatWallClock(now);
  const contentWidth = Math.min(width - layout.padPage * 2, layout.mobileContentMaxWidth);
  const availableHeight = height - insets.top - tabBarHeight;
  const dialSize = Math.min(
    contentWidth,
    layout.todayDialMax,
    Math.max(
      layout.todayDialMin,
      Math.min(width * layout.todayDialWidthRatio, availableHeight * layout.todayDialHeightRatio),
    ),
  );

  const categoryOptions = useMemo<SegmentOption<WorkSessionCategory>[]>(
    () => [
      {
        value: "ONSITE",
        label: t("category.ONSITE"),
        icon: (active) => (
          <Icon glyph={Building2} size={layout.iconSm} color={active ? colors.textTitle : colors.textMuted} />
        ),
      },
      {
        value: "REMOTE",
        label: t("category.REMOTE"),
        icon: (active) => (
          <Icon glyph={Laptop} size={layout.iconSm} color={active ? colors.textTitle : colors.textMuted} />
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

  const name = user?.nickname?.trim() || user?.username || "";

  return (
    <Screen scroll bottomInset={tabBarHeight} gap={layout.gapLoose}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: layout.gapDefault }}>
        <Avatar uri={user?.avatarUrl} name={name} size={layout.tapMin} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text role="caption" tone="muted" numberOfLines={1}>
            {displayDate}
          </Text>
          <Text role="title3" numberOfLines={1}>
            {t("desktop.greeting", { name })}
          </Text>
        </View>
        <Badge label={isRunning ? t("today.running") : t("today.idle")} tone={isRunning ? "accent" : "neutral"} />
      </View>

      <View style={{ alignItems: "center", gap: layout.gapLoose, paddingVertical: layout.gapDefault }}>
        <SessionDial size={dialSize} isRunning={isRunning} elapsedSeconds={elapsedSeconds} currentDate={now} />
        <View style={{ alignItems: "center", gap: layout.gapTight }}>
          <Text role="monoDisplay" tone="title" style={{ textAlign: "center" }}>
            {timecode}
          </Text>
          <MotionReveal key={isRunning ? "running" : "idle"}>
            <Text role="bodySm" tone={isRunning ? "accent" : "muted"} style={{ textAlign: "center" }}>
              {isRunning && activeStartAt
                ? t("today.startedAt", { time: formatClock(activeStartAt) })
                : t("desktop.ready")}
            </Text>
          </MotionReveal>
        </View>
      </View>

      <Card style={{ gap: layout.gapDefault }}>
        <SegmentedControl
          options={categoryOptions}
          value={activeCategory}
          onChange={setSelectedCategory}
          disabled={isRunning || isMutating}
          full
        />

        <Button
          label={isRunning ? t("today.stop") : t("today.start")}
          size="lg"
          full
          loading={isMutating}
          variant={isRunning ? "secondary" : "primary"}
          onPress={handleToggle}
          icon={
            <Icon
              glyph={isRunning ? Square : Play}
              size={layout.iconSm}
              color={isRunning ? colors.textTitle : colors.textOnAccent}
              filled
            />
          }
          style={{ minHeight: layout.todayActionHeight }}
        />

        <Divider />

        <View style={{ flexDirection: "row" }}>
          <TotalCell label={t("today.todayTotal")} value={formatShortMinutes(todayMinutes + runningMinutes, language)} />
          <Divider vertical style={{ marginHorizontal: space[4] }} />
          <TotalCell label={t("today.monthTotal")} value={formatShortMinutes(summary.totalMinutes, language)} />
        </View>
      </Card>
    </Screen>
  );
}

function TotalCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2, alignItems: "center" }}>
      <Text role="caption" tone="muted" style={{ textAlign: "center" }}>
        {label}
      </Text>
      <Text role="title3" tone="title" style={{ textAlign: "center" }}>
        {value}
      </Text>
    </View>
  );
}
