import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { translateError } from "@omam/i18n";
import { Avatar, Badge, ButtonLink, Card, CardHeader, EmptyState, ErrorState, Loading, Stat } from "../components/ui";
import { Icon, type IconName } from "../components/icons";
import { ReportTable } from "../components/report-table";
import { DayBars, MonthPicker } from "../components/controls";
import { useReportMonth, reportLink } from "../lib/report-month";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { useLanguage } from "../lib/i18n";
import { displayName, formatDuration, formatTime } from "../lib/format";
import { PageHeader } from "./layout";

export function Metric({ label, value, hint, icon }: { label: string; value: string | number; hint?: string; icon: IconName }) {
  return <Card className="metric-card"><div className="metric-top"><span className="metric-icon"><Icon name={icon} /></span></div><Stat label={label} value={value} hint={hint} /></Card>;
}

export function DashboardPage() {
  const { calendar } = useSession();
  const { language, t } = useLanguage();
  const [month, setMonth] = useReportMonth(calendar);
  const dashboard = useQuery({ queryKey: ["dashboard", month, calendar], queryFn: () => api.dashboard({ month, calendar }), refetchInterval: 30_000 });
  const report = useQuery({ queryKey: ["report", month, calendar], queryFn: () => api.monthlyReport({ month, calendar }), refetchInterval: 30_000 });
  const data = dashboard.data;
  return <>
    <PageHeader title={t("workspace.overview")} subtitle={t("workspace.overviewHint")} actions={<MonthPicker month={month} calendar={calendar} onChange={setMonth} />} />
    <div className="page-body">
      {dashboard.isPending ? <Loading /> : null}
      {dashboard.isError ? <ErrorState message={translateError(dashboard.error, t)} onRetry={() => dashboard.refetch()} /> : null}
      {data ? <>
        <div className="metric-grid">
          <Metric icon="sessions" label={t("workspace.trackedHours")} value={formatDuration(data.monthCompletedMinutes, language)} hint={t("workspace.completedSessions")} />
          <Metric icon="report" label={t("workspace.completedSessions")} value={data.monthSessionCount} />
          <Metric icon="members" label={t("admin.dashboard.activeMembers")} value={data.memberCount} />
          <Metric icon="overview" label={t("workspace.runningNow")} value={data.activeNow.length} />
        </div>
        <div className="dashboard-grid">
          <Card flush className="activity-card"><CardHeader title={t("workspace.teamActivity")} subtitle={t("workspace.periodHint")} actions={<ButtonLink to={reportLink("/report", month, calendar)}>{t("workspace.viewReport")}<Icon name="arrow" /></ButtonLink>} /><div className="card-body"><DayBars days={data.trend} /></div></Card>
          <Card flush className="live-card"><CardHeader title={t("workspace.runningNow")} actions={<Badge tone={data.activeNow.length ? "success" : "neutral"} dot>{data.activeNow.length}</Badge>} />
            {data.activeNow.length ? <div className="live-list">{data.activeNow.map((entry) => <Link className="live-member" key={entry.userId} to={reportLink(`/members/${entry.userId}`, month, calendar)}><Avatar name={displayName(entry)} src={entry.avatarUrl} size="sm" /><div className="stack grow gap-2"><span className="t-label">{displayName(entry)}</span><span className="t-caption muted">{t("admin.dashboard.started")} <bdi>{formatTime(entry.startedAt)}</bdi></span></div><span className="t-mono t-body-sm">{formatDuration(entry.minutes, language)}</span></Link>)}</div> : <EmptyState title={t("admin.dashboard.nobodyClockedIn")} action={<ButtonLink to="/members">{t("workspace.manageTeam")}</ButtonLink>} />}
          </Card>
        </div>
        <Card flush><CardHeader title={t("workspace.topMembers")} subtitle={t("workspace.reportHint")} actions={<ButtonLink to={reportLink("/report", month, calendar)}>{t("workspace.allMembers")}<Icon name="arrow" /></ButtonLink>} />
          {report.isPending ? <Loading /> : report.isError ? <ErrorState message={translateError(report.error, t)} onRetry={() => report.refetch()} /> : report.data?.rows.length ? <ReportTable rows={report.data.rows.slice(0, 5)} month={month} compact /> : <EmptyState title={t("workspace.emptyTeam")} hint={t("workspace.emptyTeamHint")} action={<ButtonLink to="/teams/invites" primary>{t("workspace.inviteMembers")}</ButtonLink>} />}
        </Card>
      </> : null}
    </div>
  </>;
}
