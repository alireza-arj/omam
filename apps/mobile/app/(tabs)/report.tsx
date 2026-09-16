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
  Target,
  Wallet,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import type { SessionDto } from "@omam/contracts";
import { SessionItem } from "../../src/components/session-item";
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
  useTabBarHeight,
  type SegmentOption,
} from "../../src/design/taraz";

const locale = "en-US";
const CHART_HEIGHT = 96;

const periodOptions: SegmentOption<ReportPeriod>[] = reportPeriods.map((period) => ({
  value: period.key,
  label: period.label,
}));

export default function ReportScreen() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const { sessions: monthSessions, settings, calendar } = useAttendance();
  const colors = useColors();
  const tabBarHeight = useTabBarHeight();

  const openSession = useCallback((sessionId: string) => {
    router.push({ pathname: "/session/[id]", params: { id: sessionId } });
  }, []);

  const [period, setPeriod] = useState<ReportPeriod>("MONTH");
  const [offset, setOffset] = useState(0);
  const [rangeSessions, setRangeSessions] = useState<SessionDto[]>([]);

  const range = useMemo(() => getPeriodRange(period, offset, calendar), [calendar, offset, period]);
  const rangeLabel = useMemo(
    () => formatRangeLabel(period, range, offset, calendar),
    [calendar, offset, period, range],
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
    () => summarizeSessions(rangeSessions, settings.hourlyRate, period, range, calendar),
    [calendar, period, range, rangeSessions, settings.hourlyRate],
  );

  const sortedSessions = useMemo(
    () => [...rangeSessions].sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()),
    [rangeSessions],
  );
  const sessionDays = useMemo(
    () => groupSessionsByDay(sortedSessions, calendar),
    [calendar, sortedSessions],
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

  const requiredPerDayMinutes = useMemo(() => {
    if (period !== "MONTH" || offset !== 0 || goalHours <= 0) return null;
    const remainingGoalMinutes = goalHours * 60 - totals.totalMinutes;
    if (remainingGoalMinutes <= 0) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthEnd = new Date(range.to);
    monthEnd.setHours(0, 0, 0, 0);
    const remainingDays = Math.max(1, Math.round((monthEnd.getTime() - today.getTime()) / 86_400_000) + 1);
    return Math.ceil(remainingGoalMinutes / remainingDays);
  }, [goalHours, offset, period, range.to, totals.totalMinutes]);

  function changePeriod(next: ReportPeriod) {
    setPeriod(next);
    setOffset(0);
  }

  return (
    <Screen scroll bottomInset={tabBarHeight} gap={layout.gapDefault}>
      <PageHeader
        title="Report"
        subtitle={rangeLabel}
        trailing={
          <IconButton label="Add a session" variant="primary" onPress={() => openSession("new")}>
            <Icon glyph={Plus} size={20} color={colors.textOnAccent} />
          </IconButton>
        }
      />

      <SegmentedControl options={periodOptions} value={period} onChange={changePeriod} size="lg" full />

      <View style={{ alignItems: "center", flexDirection: "row", gap: layout.gapDefault }}>
        <IconButton label="Previous period" round onPress={() => setOffset((current) => current - 1)}>
          <Icon glyph={ChevronLeft} size={20} color={colors.textTitle} />
        </IconButton>

        <Text role="label" tone="title" numberOfLines={1} style={{ flex: 1, textAlign: "center" }}>
          {rangeLabel}
        </Text>

        <IconButton
          label="Next period"
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
          label="Tracked"
          value={formatShortMinutes(totals.totalMinutes)}
          hint={joinMeta(`${numberFormatter.format(totals.sessionCount)} sessions`, rangeLabel)}
          icon={<Icon glyph={Clock3} size={16} color={colors.textMuted} />}
        />
        <Stat
          mono
          label="Earned"
          value={formatCurrency(totals.totalIncome, settings.currency)}
          hint={`${numberFormatter.format(trackedHours)} h billed`}
          icon={<Icon glyph={Wallet} size={16} color={colors.textMuted} />}
        />
      </View>

      <Card style={{ gap: layout.gapDefault }}>
        <Text role="title3">{period === "DAY" ? "By hour" : "By day"}</Text>

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
          <Text role="title3">Goal</Text>
          <Text role="monoLg" tone="title">
            {Math.round(goalRatio * 100)}%
          </Text>
        </View>

        <ProgressBar value={goalRatio} />

        <Text role="caption" tone="muted">
          {joinMeta(
            `${numberFormatter.format(trackedHours)} of ${numberFormatter.format(Math.round(goalHours))} h`,
            period === "DAY" ? "Daily target" : period === "WEEK" ? "Weekly target" : "Monthly target",
          )}
        </Text>
      </Card>

      <Card style={{ gap: layout.gapDefault }}>
        <Text role="title3">Split</Text>

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
            label="On-site"
            value={formatShortMinutes(totals.categoryMinutes.onsite)}
            swatch={colors.fillAccent}
          />
          <SplitRow
            glyph={Laptop}
            label="Remote"
            value={formatShortMinutes(totals.categoryMinutes.remote)}
            swatch={colors.textFaint}
          />
        </View>
      </Card>

      <Card padded={false} style={{ paddingHorizontal: layout.padCard }}>
        <ListRow
          label="Worked days"
          leading={<Icon glyph={CalendarDays} size={20} color={colors.textMuted} />}
          trailing={
            <Text role="mono" tone="body">
              {numberFormatter.format(totals.workedDays)}
            </Text>
          }
        />
        <Divider inset={30} />
        <ListRow
          label="Average per day"
          hint="Worked days only"
          leading={<Icon glyph={ListChecks} size={20} color={colors.textMuted} />}
          trailing={
            <Text role="mono" tone="body">
              {formatShortMinutes(averageMinutes)}
            </Text>
          }
        />
        <Divider inset={30} />
        {requiredPerDayMinutes !== null && (
          <>
            <ListRow
              label="Required per day"
              hint={
                requiredPerDayMinutes === 0
                  ? "Goal reached"
                  : "To reach monthly goal"
              }
              leading={<Icon glyph={Target} size={20} color={colors.fillAccent} />}
              trailing={
                <Text role="mono" tone={requiredPerDayMinutes === 0 ? "accent" : "body"}>
                  {requiredPerDayMinutes === 0 ? "Done" : formatShortMinutes(requiredPerDayMinutes)}
                </Text>
              }
            />
            <Divider inset={30} />
          </>
        )}
        <ListRow
          label="Last check-in"
          leading={<Icon glyph={LogIn} size={20} color={colors.textMuted} />}
          trailing={
            <Text role="mono" tone="body">
              {latestSession ? formatClock(latestSession.startAt) : "--:--"}
            </Text>
          }
        />
        <Divider inset={30} />
        <ListRow
          label="Last check-out"
          leading={<Icon glyph={LogOut} size={20} color={colors.textMuted} />}
          trailing={
            <Text role="mono" tone={latestSession && !latestSession.endAt ? "accent" : "body"}>
              {latestSession?.endAt
                ? formatClock(latestSession.endAt)
                : latestSession
                  ? "Running"
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
                    `${day.sessions.length} ${day.sessions.length === 1 ? "session" : "sessions"}`,
                    formatShortMinutes(day.totalMinutes),
                  )}
                >
                  <View style={{ gap: layout.gapDefault, paddingBottom: layout.gapDefault }}>
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
              </Fragment>
            ))}
          </View>
        ) : (
          <EmptyState
            title="No sessions yet"
            description="Start the timer on Today, or add one with the + button."
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
