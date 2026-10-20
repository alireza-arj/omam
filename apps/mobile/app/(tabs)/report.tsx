import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useSQLiteContext } from "../../src/lib/sqlite-context";
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Laptop,
  ListChecks,
  CircleCheck,
  Target,
  Plus,
  Wallet,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import type { SessionDto } from "@omam/contracts";
import { ReportChart } from "../../src/components/report-chart";
import { SessionItem } from "../../src/components/session-item";
import { getSessions } from "../../src/lib/db/sessions";
import {
  formatCurrency,
  formatShortMinutes,
  joinMeta,
  sessionMinutes,
} from "../../src/lib/format";
import {
  formatRangeLabel,
  getPeriodGoalHours,
  getPeriodRange,
  goalPace,
  groupSessionsByDay,
  reportPeriods,
  summarizeSessions,
  type ReportPeriod,
} from "../../src/lib/report";
import { useAttendance } from "../../src/providers/attendance-provider";
import { useAuth } from "../../src/providers/auth-provider";
import {
  Accordion,
  Card,
  Divider,
  EmptyState,
  Icon,
  IconButton,
  IconTile,
  ListRow,
  PageHeader,
  SectionHeader,
  ProgressBar,
  Screen,
  SegmentedControl,
  Stat,
  Text,
  layout,
  radius,
  space,
  useColors,
  useLanguage,
  useTabBarHeight,
  type SegmentOption,
} from "../../src/design/taraz";

const locale = "en-US";

const PERIOD_LABEL = {
  DAY: "report.periodDay",
  WEEK: "report.periodWeek",
  MONTH: "report.periodMonth",
} as const;

export default function ReportScreen() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const { sessions: monthSessions, settings, calendar } = useAttendance();
  const { language, t } = useLanguage();
  const colors = useColors();
  const tabBarHeight = useTabBarHeight();

  const periodOptions = useMemo<SegmentOption<ReportPeriod>[]>(
    () =>
      reportPeriods.map((period) => ({
        value: period,
        label: t(PERIOD_LABEL[period]),
      })),
    [t],
  );

  const openSession = useCallback((sessionId: string) => {
    router.push({ pathname: "/session/[id]", params: { id: sessionId } });
  }, []);

  const [period, setPeriod] = useState<ReportPeriod>("MONTH");
  const [offset, setOffset] = useState(0);
  const [rangeSessions, setRangeSessions] = useState<SessionDto[]>([]);

  const range = useMemo(
    () => getPeriodRange(period, offset, calendar),
    [calendar, offset, period],
  );
  const rangeLabel = useMemo(
    () => formatRangeLabel(period, range, offset, calendar, language, t),
    [calendar, language, offset, period, range, t],
  );
  const userId = user?.id;

  useEffect(() => {
    let active = true;

    if (!userId) {
      setRangeSessions([]);
      return;
    }

    getSessions(db, userId, range.from.toISOString(), range.to.toISOString())
      .then((rows) => {
        if (active) setRangeSessions(rows);
      })
      .catch(() => {
        if (active) setRangeSessions([]);
      });

    return () => {
      active = false;
    };
  }, [db, monthSessions, range.from, range.to, userId]);

  const totals = useMemo(
    () =>
      summarizeSessions(
        rangeSessions,
        settings.hourlyRate,
        period,
        range,
        calendar,
        language,
      ),
    [calendar, language, period, range, rangeSessions, settings.hourlyRate],
  );

  const sortedSessions = useMemo(
    () =>
      [...rangeSessions].sort(
        (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
      ),
    [rangeSessions],
  );
  const sessionDays = useMemo(
    () => groupSessionsByDay(sortedSessions, calendar, language, t),
    [calendar, language, sortedSessions, t],
  );
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), []);

  const goalHours = getPeriodGoalHours(period, settings.monthlyGoalHours);
  const goalRatio =
    goalHours > 0 ? Math.min(1, totals.totalMinutes / (goalHours * 60)) : 0;
  const trackedHours = Math.round(totals.totalMinutes / 60);

  const axisKeys = useMemo(() => {
    const { buckets } = totals;

    if (period !== "MONTH" || !buckets.length) return undefined;

    return [0, 7, 14, 21, buckets.length - 1].map((index) => buckets[Math.min(index, buckets.length - 1)].key);
  }, [period, totals]);

  const pace = useMemo(
    () => goalPace(monthSessions.reduce((total, session) => total + sessionMinutes(session), 0), settings.monthlyGoalHours, calendar),
    [calendar, monthSessions, settings.monthlyGoalHours],
  );

  const categoryTotal =
    totals.categoryMinutes.onsite + totals.categoryMinutes.remote;
  const onsiteShare = categoryTotal
    ? totals.categoryMinutes.onsite / categoryTotal
    : 0;
  const averageMinutes = totals.workedDays
    ? Math.round(totals.totalMinutes / totals.workedDays)
    : 0;

  function changePeriod(next: ReportPeriod) {
    setPeriod(next);
    setOffset(0);
  }

  return (
    <Screen scroll bottomInset={tabBarHeight} gap={layout.gapDefault}>
      <PageHeader
        title={t("report.title")}
        trailing={
          <IconButton
            label={t("report.addSession")}
            variant="primary"
            onPress={() => openSession("new")}
          >
            <Icon glyph={Plus} size={20} color={colors.textOnAccent} />
          </IconButton>
        }
      />

      <SegmentedControl
        options={periodOptions}
        value={period}
        onChange={changePeriod}
        size="lg"
        full
      />

      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: layout.gapDefault,
        }}
      >
        <IconButton
          label={t("report.previousPeriod")}
          round
          onPress={() => setOffset((current) => current - 1)}
        >
          <Icon glyph={ChevronLeft} size={layout.iconMd} color={colors.textTitle} directional />
        </IconButton>

        <Text
          role="label"
          tone="title"
          numberOfLines={1}
          style={{ flex: 1, textAlign: "center" }}
        >
          {rangeLabel}
        </Text>

        <IconButton
          label={t("report.nextPeriod")}
          round
          disabled={offset >= 0}
          onPress={() => setOffset((current) => Math.min(0, current + 1))}
        >
          <Icon glyph={ChevronRight} size={layout.iconMd} color={colors.textTitle} directional />
        </IconButton>
      </View>

      <View style={{ flexDirection: "row", gap: layout.gapDefault }}>
        <Stat
          mono
          label={t("report.tracked")}
          value={formatShortMinutes(totals.totalMinutes, language)}
          hint={joinMeta(
            t("report.sessionCount", { count: totals.sessionCount }),
            rangeLabel,
          )}
          glyph={Clock3}
          tone="accent"
        />
        <Stat
          mono
          label={t("report.earned")}
          value={formatCurrency(totals.totalIncome, settings.currency, t)}
          hint={t("report.billed", {
            value: numberFormatter.format(trackedHours),
          })}
          glyph={Wallet}
          tone="success"
        />
      </View>

      <Card style={{ gap: layout.gapDefault }}>
        <SectionHeader
          title={period === "DAY" ? t("report.byHour") : t("report.byDay")}
          description={joinMeta(rangeLabel, formatShortMinutes(totals.totalMinutes, language))}
        />
        <ReportChart
          buckets={totals.buckets}
          axisKeys={axisKeys}
          targetMinutes={period === "DAY" || !settings.monthlyGoalHours ? undefined : (settings.monthlyGoalHours * 60) / 30}
          formatValue={(minutes) => formatShortMinutes(minutes, language)}
        />
      </Card>

      <Card style={{ gap: layout.gapDefault }}>
        <View
          style={{
            alignItems: "baseline",
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <Text role="title3">{t("report.goal")}</Text>
          <Text role="monoLg" tone="title">
            {Math.round(goalRatio * 100)}%
          </Text>
        </View>

        <ProgressBar value={goalRatio} />

        <Text role="caption" tone="muted">
          {joinMeta(
            t("report.ofGoal", {
              value: numberFormatter.format(trackedHours),
              goal: numberFormatter.format(Math.round(goalHours)),
            }),
            period === "DAY"
              ? t("report.dailyTarget")
              : period === "WEEK"
                ? t("report.weeklyTarget")
                : t("report.monthlyTarget"),
          )}
        </Text>
      </Card>

      <Card style={{ gap: layout.gapDefault }}>
        <Text role="title3">{t("report.split")}</Text>

        <View
          style={{
            backgroundColor: colors.fillQuiet,
            borderRadius: radius.pill,
            flexDirection: "row",
            height: space[4],
            overflow: "hidden",
          }}
        >
          <View
            style={{ backgroundColor: colors.fillAccent, flex: onsiteShare }}
          />
          <View
            style={{ backgroundColor: colors.textFaint, flex: 1 - onsiteShare }}
          />
        </View>

        <View style={{ gap: layout.gapTight }}>
          <SplitRow
            glyph={Building2}
            label={t("category.ONSITE")}
            value={formatShortMinutes(totals.categoryMinutes.onsite, language)}
            swatch={colors.fillAccent}
          />
          <SplitRow
            glyph={Laptop}
            label={t("category.REMOTE")}
            value={formatShortMinutes(totals.categoryMinutes.remote, language)}
            swatch={colors.textFaint}
          />
        </View>
      </Card>

      <Card padded={false} style={{ paddingHorizontal: layout.padCard }}>
        <ListRow
          label={t("report.workedDays")}
          leading={<IconTile glyph={CalendarDays} size={layout.controlMd} />}
          trailing={
            <Text role="mono" tone="body">
              {numberFormatter.format(totals.workedDays)}
            </Text>
          }
        />
        <Divider />
        <ListRow
          label={t("report.averagePerDay")}
          hint={t("report.workedDaysOnly")}
          leading={<IconTile glyph={ListChecks} size={layout.controlMd} />}
          trailing={
            <Text role="mono" tone="body">
              {formatShortMinutes(averageMinutes, language)}
            </Text>
          }
        />
        <Divider />
        <ListRow
          label={pace.state === "reached" ? t("report.goalReached") : t("report.neededPerDay")}
          hint={
            pace.state === "behind"
              ? t("report.neededHint", { count: pace.daysLeft })
              : pace.state === "reached"
                ? t("report.goalReachedHint")
                : t("report.noGoal")
          }
          leading={<IconTile glyph={pace.state === "reached" ? CircleCheck : Target} size={layout.controlMd} tone={pace.state === "reached" ? "success" : "accent"} />}
          trailing={
            pace.state === "behind" ? (
              <Text role="label" tone="title">
                {formatShortMinutes(pace.minutesPerDay, language)}
              </Text>
            ) : null
          }
        />
      </Card>

      <View style={{ gap: layout.gapDefault }}>
        <Text role="title3">{t("common.records")}</Text>
        {sessionDays.length ? (
          sessionDays.map((day) => (
            <Card key={day.key} style={{ paddingVertical: layout.gapTight / 2 }}>
              <Accordion
                title={day.label}
                meta={joinMeta(
                  t("report.sessionCount", { count: day.sessions.length }),
                  formatShortMinutes(day.totalMinutes, language),
                )}
              >
                <View
                  style={{
                    gap: layout.gapDefault,
                    paddingBottom: layout.gapDefault,
                  }}
                >
                  {day.sessions.map((session) => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      showDate={false}
                      onPress={() => openSession(session.id)}
                    />
                  ))}
                </View>
              </Accordion>
            </Card>
          ))
        ) : (
          <Card padded={false}>
            <EmptyState
              title={t("report.emptyTitle")}
              description={t("report.emptyHint")}
              glyph={Clock3}
            />
          </Card>
        )}
      </View>

      <View style={{ height: layout.gapDefault }} />
    </Screen>
  );
}

type SplitRowProps = {
  glyph: LucideIcon;
  label: string;
  value: string;
  swatch: string;
};

function SplitRow({ glyph, label, value, swatch }: SplitRowProps) {
  const colors = useColors();

  return (
    <View
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: layout.gapTight,
      }}
    >
      <View
        style={{
          backgroundColor: swatch,
          borderRadius: radius.full,
          height: space[4],
          width: space[4],
        }}
      />
      <Icon glyph={glyph} size={layout.iconSm} color={colors.textMuted} />
      <Text role="body" tone="title" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text role="mono" tone="body">
        {value}
      </Text>
    </View>
  );
}
