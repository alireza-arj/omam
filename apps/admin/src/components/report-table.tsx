import { Link } from "react-router-dom";
import type { MemberReportRowDto } from "@omam/contracts";
import { Avatar, Progress, Table, TableScroll } from "./ui";
import { useLanguage } from "../lib/i18n";
import { displayName, formatDuration } from "../lib/format";
import { reportLink } from "../lib/report-month";
import { useSession } from "../lib/session";

export function ReportTable({ rows, month, compact = false }: { rows: MemberReportRowDto[]; month: string; compact?: boolean }) {
  const { calendar } = useSession();
  const { t, language } = useLanguage();
  return <TableScroll><Table><Table.Content aria-label={t("workspace.monthlyReport")} className="omam-data">
    <Table.Header>
      <Table.Column isRowHeader>{t("workspace.members")}</Table.Column>
      <Table.Column className="num">{t("workspace.trackedHours")}</Table.Column>
      <Table.Column className="num">{t("workspace.sessions")}</Table.Column>
      <Table.Column className="num">{t("admin.report.days")}</Table.Column>
      <Table.Column className="goal-column">{t("admin.report.towardsGoal")}</Table.Column>
      {!compact ? <Table.Column className="num">{t("admin.report.onsite")}</Table.Column> : null}
      {!compact ? <Table.Column className="num">{t("admin.report.remote")}</Table.Column> : null}
    </Table.Header>
    <Table.Body>{rows.map((row) => <Table.Row id={row.userId} key={row.userId}>
      <Table.Cell><div className="row gap-6"><Avatar name={displayName(row)} src={row.avatarUrl} size="sm" /><div className="stack gap-2"><Link to={reportLink(`/members/${row.userId}`, month, calendar)}>{displayName(row)}</Link><span className="t-caption muted">{row.jobTitle ?? `@${row.username}`}</span></div></div></Table.Cell>
      <Table.Cell className="num t-mono">{formatDuration(row.completedMinutes, language)}</Table.Cell>
      <Table.Cell className="num t-mono muted">{row.sessionCount}</Table.Cell>
      <Table.Cell className="num t-mono muted">{row.workedDays}</Table.Cell>
      <Table.Cell>{row.monthlyGoalHours > 0 ? <div className="stack gap-3"><div className="row between"><span className="t-caption muted">{t("units.hoursShort", { value: row.monthlyGoalHours })}</span><span className="t-caption t-mono">{Math.round(row.completedMinutes / (row.monthlyGoalHours * 60) * 100)}%</span></div><Progress value={row.completedMinutes / (row.monthlyGoalHours * 60)} /></div> : <span className="muted">{t("admin.report.noGoal")}</span>}</Table.Cell>
      {!compact ? <Table.Cell className="num t-mono muted">{formatDuration(row.onsiteMinutes, language)}</Table.Cell> : null}
      {!compact ? <Table.Cell className="num t-mono muted">{formatDuration(row.remoteMinutes, language)}</Table.Cell> : null}
    </Table.Row>)}</Table.Body>
  </Table.Content></Table></TableScroll>;
}
