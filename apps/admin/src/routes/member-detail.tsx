import {
  Avatar,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Loading,
  Progress,
  Stat,
  StatusBadge,
  Table,
  TableScroll,
} from "../components/ui";
import { CollectionToolbar, Pagination } from "../components/collection";
import { useCollection } from "../lib/collection";
import { useReportMonth } from "../lib/report-month";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { translateError } from "@omam/i18n";
import { useLanguage } from "../lib/i18n";

import { displayName, formatDate, formatDuration, formatMoney, formatTime } from "../lib/format";
import { PageHeader } from "./layout";
import { DayBars, MonthPicker } from "../components/controls";

export function MemberDetailPage() {
  const { userId = "" } = useParams();
  const { calendar } = useSession();
  const { language, t } = useLanguage();
  const [month, setMonth] = useReportMonth(calendar);

  const report = useQuery({
    queryKey: ["member-report", userId, month, calendar],
    queryFn: () => api.memberReport(userId, { month, calendar }),
  });

  const member = report.data?.member;
  const goalMinutes = (member?.monthlyGoalHours ?? 0) * 60;

  const collection = useCollection(
    report.data?.sessions ?? [],
    (row) =>
      [
        row.note,
        row.project?.name,
        t(`category.${row.category}`),
        formatDate(row.startAt, calendar, language),
      ].join(" "),
    `${month}:${userId}`,
  );

  return (
    <>
      <PageHeader
        title={member ? displayName(member) : t("admin.memberDetail.member")}
        subtitle={member?.jobTitle ?? undefined}
        actions={
          <>
            <MonthPicker month={month} calendar={calendar} onChange={setMonth} />
            <ButtonLink to="/members">{t("admin.memberDetail.allMembers")}</ButtonLink>
          </>
        }
      />

      <div className="page-body">
        {report.isPending ? <Loading /> : null}
        {report.isError ? (
          <ErrorState message={translateError(report.error, t)} onRetry={() => report.refetch()} />
        ) : null}

        {report.data && member ? (
          <>
            <Card className="summary-card">
              <div className="row gap-7 wrap">
                <Avatar name={displayName(member)} src={member.avatarUrl} size="lg" />
                <div className="stack gap-2 grow">
                  <span className="t-body-sm muted">
                    @{member.username}
                    {member.employeeCode ? ` · ${member.employeeCode}` : ""} ·{" "}
                    {member.payType === "MONTHLY"
                      ? t("payType.perMonth", {
                          amount: formatMoney(member.monthlySalary, member.currency, t),
                        })
                      : t("payType.perHour", {
                          amount: formatMoney(member.hourlyRate, member.currency, t),
                        })}
                  </span>
                </div>
              </div>

              <hr className="divider" style={{ margin: "var(--space-8) 0" }} />

              <div className="stat-grid">
                <Stat
                  label={t("admin.memberDetail.completed")}
                  value={formatDuration(member.completedMinutes, language)}
                />
                <Stat label={t("admin.memberDetail.workedDays")} value={member.workedDays} />
                <Stat
                  label={t("admin.memberDetail.earned")}
                  value={formatMoney(member.grossAmount, member.currency, t)}
                />
              </div>

              {goalMinutes > 0 ? (
                <div className="goal-summary stack gap-4">
                  <div className="row between t-caption muted">
                    <span>{t("admin.memberDetail.towardsGoal", { goal: member.monthlyGoalHours })}</span>
                    <span className="t-mono">
                      {Math.round((member.completedMinutes / goalMinutes) * 100)}%
                    </span>
                  </div>
                  <Progress value={member.completedMinutes / goalMinutes} />
                </div>
              ) : null}
            </Card>

            <div className="detail-grid">
              <Card flush className="grow">
                <CardHeader title={t("admin.memberDetail.perDay")} />
                <div className="card-body">
                  <DayBars days={report.data.days} />
                </div>
              </Card>

              <Card flush>
                <CardHeader title={t("admin.memberDetail.byProject")} />
                <div className="card-body stack gap-6">
                  {report.data.projects.length ? (
                    report.data.projects.map((project) => (
                      <div key={project.projectId ?? "none"} className="stack gap-3">
                        <div className="row between">
                          <span className="row gap-4 t-body-sm">
                            <span className="dot" style={{ color: project.color }} aria-hidden />
                            {/* The API names an untagged bucket in English; the panel says it. */}
                            {project.projectId ? project.name : t("admin.memberDetail.untagged")}
                          </span>
                          <span className="t-mono muted">{formatDuration(project.minutes, language)}</span>
                        </div>
                        <Progress value={project.minutes / Math.max(1, member.completedMinutes)} />
                      </div>
                    ))
                  ) : (
                    <span className="t-body-sm muted">{t("admin.memberDetail.noCompleted")}</span>
                  )}
                </div>
              </Card>
            </div>

            <Card flush>
              <CollectionToolbar search={collection.search} onSearch={collection.setSearch} />
              {collection.search && !collection.total && report.data ? (
                <EmptyState title={t("admin.table.noResults")} hint={t("admin.table.searchHint")} />
              ) : null}
              {collection.total > 0 ? (
                <TableScroll>
                  <Table>
                    <Table.Content aria-label={t("common.records")} className="omam-data">
                      <Table.Header>
                        <Table.Column isRowHeader>{t("admin.timesheets.day")}</Table.Column>
                        <Table.Column>{t("admin.timesheets.hours")}</Table.Column>
                        <Table.Column className="num">{t("admin.timesheets.duration")}</Table.Column>
                        <Table.Column>{t("admin.timesheets.where")}</Table.Column>
                        <Table.Column>{t("admin.timesheets.project")}</Table.Column>
                        <Table.Column>{t("admin.timesheets.note")}</Table.Column>
                        <Table.Column>{t("admin.timesheets.status")}</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {collection.rows.map((session) => (
                          <Table.Row id={session.id} key={session.id}>
                            <Table.Cell className="muted">
                              {formatDate(session.startAt, calendar, language)}
                            </Table.Cell>
                            <Table.Cell className="t-mono timecode muted">
                              {formatTime(session.startAt)}
                              {session.endAt
                                ? ` – ${formatTime(session.endAt)}`
                                : ` – ${t("admin.timesheets.running")}`}
                            </Table.Cell>
                            <Table.Cell className="num t-mono">
                              {formatDuration(session.durationMinutes, language)}
                            </Table.Cell>
                            <Table.Cell className="muted">{t(`category.${session.category}`)}</Table.Cell>
                            <Table.Cell>
                              {session.project?.name ?? <span className="faint">—</span>}
                            </Table.Cell>
                            <Table.Cell className="muted note-column">
                              {session.note ?? <span className="faint">—</span>}
                            </Table.Cell>
                            <Table.Cell>
                              <StatusBadge status={session.status} />
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table>
                </TableScroll>
              ) : !collection.search ? (
                <EmptyState title={t("admin.memberDetail.noTime")} />
              ) : null}
              <Pagination {...collection} />
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}
