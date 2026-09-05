import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Laptop,
  ListChecks,
  LogIn,
  LogOut,
  Plus,
  Wallet,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import type { SessionDto } from "@omam/contracts";
import { SessionItem } from "../../src/components/session-item";
import { useSync } from "../../src/providers/sync-provider";
import { getSessions } from "../../src/lib/db/sessions";
import { formatClock, formatCurrency, formatShortMinutes, joinMeta } from "../../src/lib/format";
import {
  formatRangeLabel,
  getPeriodGoalHours,
  getPeriodRange,
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
  ListRow,
  PageHeader,
  ProgressBar,
  Screen,
  SegmentedControl,
  Stat,
  Text,
  layout,
  radius,
  useColors,
  useLanguage,
  useTabBarHeight,
  type SegmentOption,
} from "../../src/design/taraz";

const locale = "en-US";
const CHART_HEIGHT = 96;

const PERIOD_LABEL = {
  DAY: "report.periodDay",
  WEEK: "report.periodWeek",
  MONTH: "report.periodMonth",
} as const;

export default function ReportScreen() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const { sessions: monthSessions, settings, calendar } = useAttendance();
  const { isLinked } = useSync();
  const { language, t } = useLanguage();
  const colors = useColors();
  const tabBarHeight = useTabBarHeight();

  const periodOptions = useMemo<SegmentOption<ReportPeriod>[]>(
    () => reportPeriods.map((period) => ({ value: period, label: t(PERIOD_LABEL[period]) })),
    [t],
  );

  const openSession = useCallback((sessionId: string) => {
    router.push({ pathname: "/session/[id]", params: { id: sessionId } });
  }, []);

  const [period, setPeriod] = useState<ReportPeriod>("MONTH");
  const [offset, setOffset] = useState(0);
  const [rangeSessions, setRangeSessions] = useState<SessionDto[]>([]);

  const range = useMemo(() => getPeriodRange(period, offset, calendar), [calendar, offset, period]);
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
    () => summarizeSessions(rangeSessions, settings.hourlyRate, period, range, calendar, language),
    [calendar, language, period, range, rangeSessions, settings.hourlyRate],
  );

  const sortedSessions = useMemo(
    () => [...rangeSessions].sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()),
    [rangeSessions],
  );
  const sessionDays = useMemo(
    () => groupSessionsByDay(sortedSessions, calendar, language, t),
    [calendar, language, sortedSessions, t],
  );
  const latestSession = sortedSessions[0];
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), []);

  const goalHours = getPeriodGoalHours(period, settings.monthlyGoalHours);
  const goalRatio = goalHours > 0 ? Math.min(1, totals.totalMinutes / (goalHours * 60)) : 0;
  const trackedHours = Math.round(totals.totalMinutes / 60);

  const peakBucketMinutes = Math.max(1, ...totals.buckets.map((bucket) => bucket.minutes));
  const labelEveryBucket = period !== "MONTH";
  const axisLabels = useMemo(() => {
    const { buckets } = totals;

    if (!buckets.length) {
      return [];
    }

    return [buckets[0], buckets[Math.floor(buckets.length / 2)], buckets[buckets.length - 1]];
  }, [totals]);

  const categoryTotal = totals.categoryMinutes.onsite + totals.categoryMinutes.remote;
  const onsiteShare = categoryTotal ? totals.categoryMinutes.onsite / categoryTotal : 0;
  const averageMinutes = totals.workedDays ? Math.round(totals.totalMinutes / totals.workedDays) : 0;

  function changePeriod(next: ReportPeriod) {
    setPeriod(next);
    setOffset(0);
  }

  return (
    <Screen scroll bottomInset={tabBarHeight} gap={layout.gapDefault}>
      <PageHeader
        title={t("report.title")}
        subtitle={rangeLabel}
        trailing={
          <IconButton label={t("report.addSession")} variant="primary" onPress={() => openSession("new")}>
            <Icon glyph={Plus} size={20} color={colors.textOnAccent} />
          </IconButton>
        }
      />

      <SegmentedControl options={periodOptions} value={period} onChange={changePeriod} size="lg" full />

      <View style={{ alignItems: "center", flexDirection: "row", gap: layout.gapDefault }}>
        <IconButton label={t("report.previousPeriod")} round onPress={() => setOffset((current) => current - 1)}>
          <Icon glyph={ChevronLeft} size={20} color={colors.textTitle} />
        </IconButton>

        <Text role="label" tone="title" numberOfLines={1} style={{ flex: 1, textAlign: "center" }}>
          {rangeLabel}
        </Text>

        <IconButton
          label={t("report.nextPeriod")}
          round
          disabled={offset >= 0}
          onPress={() => setOffset((current) => Math.min(0, current + 1))}
        >
          <Icon glyph={ChevronRight} size={20} color={colors.textTitle} />
        </IconButton>
      </View>

      <View style={{ flexDirection: "row", gap: layout.gapDefault }}>
        <Stat
          mono
          label={t("report.tracked")}
          value={formatShortMinutes(totals.totalMinutes, language)}
          hint={joinMeta(t("report.sessionCount", { count: totals.sessionCount }), rangeLabel)}
          icon={<Icon glyph={Clock3} size={16} color={colors.textMuted} />}
        />
        <Stat
          mono
          label={t("report.earned")}
          value={formatCurrency(totals.totalIncome, settings.currency, t)}
          hint={t("report.billed", { value: numberFormatter.format(trackedHours) })}
          icon={<Icon glyph={Wallet} size={16} color={colors.textMuted} />}
        />
      </View>

      <Card style={{ gap: layout.gapDefault }}>
        <Text role="title3">{period === "DAY" ? t("report.byHour") : t("report.byDay")}</Text>

        <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 2, height: CHART_HEIGHT }}>
          {totals.buckets.map((bucket) => (
            <View
              key={bucket.key}
              style={{
                backgroundColor: bucket.minutes ? colors.fillAccent : colors.fillQuiet,
                borderRadius: radius.xs,
                flex: 1,
                height: Math.max(3, Math.round((bucket.minutes / peakBucketMinutes) * CHART_HEIGHT)),
              }}
            />
          ))}
        </View>

        {labelEveryBucket ? (
          <View style={{ flexDirection: "row", gap: 2 }}>
            {totals.buckets.map((bucket) => (
              <Text
                key={bucket.key}
                role="caption"
                tone="faint"
                numberOfLines={1}
                style={{ flex: 1, textAlign: "center" }}
              >
                {bucket.label}
              </Text>
            ))}
          </View>
        ) : (
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {axisLabels.map((bucket, index) => (
              <Text key={`${bucket.key}-${index}`} role="caption" tone="faint">
                {bucket.label}
              </Text>
            ))}
          </View>
        )}
      </Card>

      <Card style={{ gap: layout.gapDefault }}>
        <View style={{ alignItems: "baseline", flexDirection: "row", justifyContent: "space-between" }}>
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
            height: 6,
            overflow: "hidden",
          }}
        >
          <View style={{ backgroundColor: colors.fillAccent, flex: onsiteShare }} />
          <View style={{ backgroundColor: colors.textFaint, flex: 1 - onsiteShare }} />
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
          leading={<Icon glyph={CalendarDays} size={20} color={colors.textMuted} />}
          trailing={
            <Text role="mono" tone="body">
              {numberFormatter.format(totals.workedDays)}
            </Text>
          }
        />
        <Divider inset={30} />
        <ListRow
          label={t("report.averagePerDay")}
          hint={t("report.workedDaysOnly")}
          leading={<Icon glyph={ListChecks} size={20} color={colors.textMuted} />}
          trailing={
            <Text role="mono" tone="body">
              {formatShortMinutes(averageMinutes, language)}
            </Text>
          }
        />
        <Divider inset={30} />
        <ListRow
          label={t("report.lastCheckIn")}
          leading={<Icon glyph={LogIn} size={20} color={colors.textMuted} />}
          trailing={
            <Text role="mono" tone="body">
              {latestSession ? formatClock(latestSession.startAt) : "--:--"}
            </Text>
          }
        />
        <Divider inset={30} />
        <ListRow
          label={t("report.lastCheckOut")}
          leading={<Icon glyph={LogOut} size={20} color={colors.textMuted} />}
          trailing={
            <Text role="mono" tone={latestSession && !latestSession.endAt ? "accent" : "body"}>
              {latestSession?.endAt
                ? formatClock(latestSession.endAt)
                : latestSession
                  ? t("status.OPEN")
                  : "--:--"}
            </Text>
          }
        />
      </Card>

      <Card padded={false}>
        {sessionDays.length ? (
          <View style={{ padding: layout.padCard }}>
            <Text role="title3" style={{ marginBottom: layout.gapTight }}>
              Sessions
            </Text>

            {sessionDays.map((day, index) => (
              <Fragment key={day.key}>
                {index ? <Divider /> : null}
                <Accordion
                  title={day.label}
                  meta={joinMeta(
                    t("report.sessionCount", { count: day.sessions.length }),
                    formatShortMinutes(day.totalMinutes, language),
                  )}
                >
                  <View style={{ gap: layout.gapDefault, paddingBottom: layout.gapDefault }}>
                    {day.sessions.map((session) => (
                      <SessionItem
                        key={session.id}
                        session={session}
                        showDate={false}
                        showStatus={isLinked}
                        onPress={() => openSession(session.id)}
                      />
                    ))}
                  </View>
                </Accordion>
              </Fragment>
            ))}
          </View>
        ) : (
          <EmptyState
            title={t("report.emptyTitle")}
            description={t("report.emptyHint")}
            icon={<Icon glyph={Clock3} size={20} color={colors.textMuted} />}
          />
        )}
      </Card>

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
    <View style={{ alignItems: "center", flexDirection: "row", gap: layout.gapTight }}>
      <View style={{ backgroundColor: swatch, borderRadius: radius.full, height: 8, width: 8 }} />
      <Icon glyph={glyph} size={16} color={colors.textMuted} />
      <Text role="body" tone="title" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text role="mono" tone="body">
        {value}
      </Text>
    </View>
  );
}
