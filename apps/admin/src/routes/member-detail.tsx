import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { translateError } from "@omam/i18n";
import { Avatar, Badge, Button, ButtonLink, Card, CardHeader, EmptyState, ErrorState, Loading, Progress, RoleBadge, StatusBadge, Table, TableScroll } from "../components/ui";
import { Icon } from "../components/icons";
import { SessionActions } from "../components/session-actions";
import { DeleteMemberModal, useCanDeleteMember } from "../components/delete-member";
import { DayBars, MonthPicker } from "../components/controls";
import { CollectionToolbar, Pagination } from "../components/collection";
import { Metric } from "./dashboard";
import { useCollection } from "../lib/collection";
import { useReportMonth } from "../lib/report-month";
import { api, downloadCsv } from "../lib/api";
import { useSession } from "../lib/session";
import { useLanguage } from "../lib/i18n";
import { useToast } from "../lib/ui";
import { displayName, formatDate, formatDateTime, formatDuration, formatTime } from "../lib/format";
import { PageHeader } from "./layout";

export function MemberDetailPage() {
  const { userId = "" } = useParams();
  const { calendar, membership } = useSession();
  const { language, t } = useLanguage();
  const toast = useToast();
  const [month, setMonth] = useReportMonth(calendar);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const canDelete = useCanDeleteMember();
  const report = useQuery({ queryKey: ["member-report", userId, month, calendar], queryFn: () => api.memberReport(userId, { month, calendar }), refetchInterval: 30_000 });
  const data = report.data;
  const collection = useCollection(data?.sessions ?? [], (session) => [formatDate(session.startAt, calendar, language), session.note, t(`category.${session.category}`), t(`status.${session.status}`)].join(" "), `${userId}:${month}`);
  async function exportCsv(detail: boolean) {
    setExporting(true);
    try {
      await downloadCsv(detail ? `/reports/members/${userId}/export.csv` : "/reports/monthly.csv", { month, calendar, language, userId }, `omam-${membership?.organizationSlug}-${data?.profile.username}-${month}${detail ? "-sessions" : ""}.csv`);
      toast(t("admin.report.exported"), "success");
    } catch (cause) { toast(translateError(cause, t), "error"); }
    finally { setExporting(false); }
  }
  return <>
    <PageHeader title={data ? displayName(data.profile) : t("workspace.profile")} subtitle={t("workspace.memberDetails")} actions={<><MonthPicker month={month} calendar={calendar} onChange={setMonth} /><Button variant="primary" loading={exporting} disabled={!data} onClick={() => exportCsv(false)}><Icon name="download" />{t("workspace.exportSummary")}</Button></>} />
    <div className="page-body">
      {report.isPending ? <Loading /> : null}
      {report.isError ? <ErrorState message={translateError(report.error, t)} onRetry={() => report.refetch()} /> : null}
      {data ? <>
        <div className="profile-grid">
          <Card className="profile-card"><div className="row gap-7"><Avatar name={displayName(data.profile)} src={data.profile.avatarUrl} size="lg" /><div className="stack gap-4"><h2 className="t-title3">{displayName(data.profile)}</h2><span className="t-caption muted"><bdi>@{data.profile.username}</bdi></span><div className="row gap-4"><RoleBadge role={data.profile.role} /><Badge tone={data.profile.status === "ACTIVE" ? "success" : "neutral"} dot>{t(data.profile.status === "ACTIVE" ? "admin.members.active" : "admin.members.suspended")}</Badge></div></div></div>
            <dl className="profile-facts">{[
              [t("admin.members.jobTitle"), data.profile.jobTitle ?? t("common.none")],
              [t("admin.members.code"), data.profile.employeeCode ?? t("common.none")],
              [t("workspace.email"), data.profile.email ?? t("workspace.noEmail")],
              [t("workspace.joined"), formatDateTime(data.profile.joinedAt, calendar, language)],
              [t("workspace.lastLogin"), data.profile.lastLoginAt ? formatDateTime(data.profile.lastLoginAt, calendar, language) : t("workspace.noLogin")],
            ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd><bdi>{value}</bdi></dd></div>)}</dl>
            <div className="row gap-4"><ButtonLink to="/members">{t("workspace.manageTeam")}</ButtonLink>{canDelete(data.profile) ? <Button variant="danger" onClick={() => setDeleting(true)}>{t("admin.members.deleteUser")}</Button> : null}</div>
          </Card>
          <div className="profile-activity stack gap-9"><div className="metric-grid report-metrics"><Metric icon="sessions" label={t("workspace.trackedHours")} value={formatDuration(data.member.completedMinutes, language)} /><Metric icon="report" label={t("workspace.completedSessions")} value={data.member.sessionCount} /><Metric icon="overview" label={t("admin.report.days")} value={data.member.workedDays} /></div>
            <Card flush><CardHeader title={t("admin.memberDetail.perDay")} subtitle={t("workspace.periodHint")} /><div className="card-body"><DayBars days={data.days} /></div></Card>
          </div>
        </div>
        <Card className="member-breakdown"><div className="stat-grid"><div className="stack gap-3"><span className="t-caption muted">{t("admin.report.onsite")}</span><bdi className="t-title3 t-mono">{formatDuration(data.member.onsiteMinutes, language)}</bdi></div><div className="stack gap-3"><span className="t-caption muted">{t("admin.report.remote")}</span><bdi className="t-title3 t-mono">{formatDuration(data.member.remoteMinutes, language)}</bdi></div><div className="stack gap-4"><div className="row between t-caption muted"><span>{t("admin.report.towardsGoal")}</span><bdi>{t("units.hoursShort", { value: data.member.monthlyGoalHours })}</bdi></div><Progress value={data.member.monthlyGoalHours ? data.member.completedMinutes / (data.member.monthlyGoalHours * 60) : 0} /></div></div></Card>
        <Card flush><CardHeader title={t("workspace.sessions")} actions={<Button variant="outline" disabled={!data.sessions.length || exporting} onClick={() => exportCsv(true)}><Icon name="download" />{t("workspace.exportSessions")}</Button>} /><CollectionToolbar search={collection.search} onSearch={collection.setSearch} />
          {collection.total ? <TableScroll><Table><Table.Content aria-label={t("workspace.sessions")} className="omam-data"><Table.Header><Table.Column isRowHeader>{t("admin.timesheets.day")}</Table.Column><Table.Column>{t("admin.timesheets.hours")}</Table.Column><Table.Column className="num">{t("admin.timesheets.duration")}</Table.Column><Table.Column>{t("admin.timesheets.where")}</Table.Column><Table.Column>{t("admin.timesheets.note")}</Table.Column><Table.Column>{t("admin.timesheets.status")}</Table.Column><Table.Column className="tight" /></Table.Header><Table.Body>{collection.rows.map((session) => <Table.Row key={session.id} id={session.id}><Table.Cell>{formatDate(session.startAt, calendar, language)}</Table.Cell><Table.Cell className="t-mono timecode muted">{formatTime(session.startAt)} – {session.endAt ? formatTime(session.endAt) : t("status.OPEN")}</Table.Cell><Table.Cell className="num t-mono">{formatDuration(session.durationMinutes, language)}</Table.Cell><Table.Cell className="muted">{t(`category.${session.category}`)}</Table.Cell><Table.Cell className="muted note-column">{session.note ?? t("common.none")}</Table.Cell><Table.Cell><StatusBadge status={session.status} /></Table.Cell><Table.Cell><SessionActions session={session} /></Table.Cell></Table.Row>)}</Table.Body></Table.Content></Table></TableScroll> : <EmptyState title={t(collection.search ? "admin.table.noResults" : "workspace.noActivity")} />}
          <Pagination {...collection} />
        </Card>
      </> : null}
    </div>
    {deleting && data ? <DeleteMemberModal member={data.profile} onClose={() => setDeleting(false)} onDeleted={() => navigate("/members", { replace: true })} /> : null}
  </>;
}
