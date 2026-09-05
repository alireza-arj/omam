import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { translateError } from "@omam/i18n";
import { useLanguage } from "../lib/i18n";

import {
  currentMonth,
  displayName,
  formatDate,
  formatDuration,
  formatMoney,
  formatTime,
} from "../lib/format";
import { PageHeader } from "./layout";
import { DayBars, MonthPicker } from "../components/controls";
import {
  Avatar,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Loading,
  Progress,
  Stat,
  StatusBadge,
} from "../components/ui";

export function MemberDetailPage() {
  const { userId = "" } = useParams();
  const { calendar } = useSession();
  const { language, t } = useLanguage();
  const [month, setMonth] = useState(() => currentMonth(calendar));

  const report = useQuery({
    queryKey: ["member-report", userId, month, calendar],
    queryFn: () => api.memberReport(userId, { month, calendar }),
  });

  const member = report.data?.member;
  const goalMinutes = (member?.monthlyGoalHours ?? 0) * 60;

  return (
    <>
      <PageHeader
        title={member ? displayName(member) : t("admin.memberDetail.member")}
        subtitle={member?.jobTitle ?? undefined}
        actions={
          <>
            <MonthPicker month={month} calendar={calendar} onChange={setMonth} />
            <Link className="btn" to="/members">
              {t("admin.memberDetail.allMembers")}
            </Link>
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
            <Card>
              <div className="row gap-7 wrap">
                <Avatar name={displayName(member)} src={member.avatarUrl} size="lg" />
                <div className="stack gap-2 grow">
                  <span className="t-title2">{displayName(member)}</span>
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
                <Stat label={t("admin.memberDetail.approved")} value={formatDuration(member.approvedMinutes, language)} />
                <Stat
                  label={t("admin.memberDetail.waiting")}
                  value={formatDuration(member.pendingMinutes, language)}
                  hint={
                    member.pendingMinutes ? (
                      <Link to="/timesheets">{t("admin.memberDetail.review")}</Link>
                    ) : undefined
                  }
                />
                <Stat label={t("admin.memberDetail.workedDays")} value={member.workedDays} />
                <Stat
                  label={t("admin.memberDetail.earned")}
                  value={formatMoney(member.grossAmount, member.currency, t)}
                  hint={t("admin.memberDetail.approvedOnly")}
                />
              </div>

              {goalMinutes > 0 ? (
                <div className="stack gap-4" style={{ marginTop: "var(--space-8)" }}>
                  <div className="row between t-caption muted">
                    <span>{t("admin.memberDetail.towardsGoal", { goal: member.monthlyGoalHours })}</span>
                    <span className="t-mono">
                      {Math.round((member.approvedMinutes / goalMinutes) * 100)}%
                    </span>
                  </div>
                  <Progress value={member.approvedMinutes / goalMinutes} />
                </div>
              ) : null}
            </Card>

            <div className="row gap-7 wrap align-start">
              <Card flush className="grow">
                <CardHeader title={t("admin.memberDetail.perDay")} />
                <div className="card-body">
                  <DayBars days={report.data.days} />
                </div>
              </Card>

              <Card flush style={{ minWidth: 280 }}>
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
                        <Progress value={project.minutes / Math.max(1, member.approvedMinutes)} />
                      </div>
                    ))
                  ) : (
                    <span className="t-body-sm muted">{t("admin.memberDetail.noApproved")}</span>
                  )}
                </div>
              </Card>
            </div>

            <Card flush>
              <CardHeader title={t("admin.memberDetail.entries", { count: report.data.sessions.length })} />
              {report.data.sessions.length ? (
                <div className="table-scroll">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{t("admin.timesheets.day")}</th>
                        <th>{t("admin.timesheets.hours")}</th>
                        <th className="num">{t("admin.timesheets.duration")}</th>
                        <th>{t("admin.timesheets.where")}</th>
                        <th>{t("admin.timesheets.project")}</th>
                        <th>{t("admin.timesheets.note")}</th>
                        <th>{t("admin.timesheets.status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.data.sessions.map((session) => (
                        <tr key={session.id}>
                          <td className="muted">{formatDate(session.startAt, calendar, language)}</td>
                          <td className="t-mono timecode muted">
                            {formatTime(session.startAt)}
                            {session.endAt
                              ? ` – ${formatTime(session.endAt)}`
                              : ` – ${t("admin.timesheets.running")}`}
                          </td>
                          <td className="num t-mono">{formatDuration(session.durationMinutes, language)}</td>
                          <td className="muted">{t(`category.${session.category}`)}</td>
                          <td>{session.project?.name ?? <span className="faint">—</span>}</td>
                          <td className="muted" style={{ maxWidth: 260 }}>
                            {session.note ?? <span className="faint">—</span>}
                          </td>
                          <td>
                            <StatusBadge status={session.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title={t("admin.memberDetail.noTime")} />
              )}
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}
