import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { errorMessage } from "../lib/ui";
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
        title={member ? displayName(member) : "Member"}
        subtitle={member?.jobTitle ?? undefined}
        actions={
          <>
            <MonthPicker month={month} calendar={calendar} onChange={setMonth} />
            <Link className="btn" to="/members">
              All members
            </Link>
          </>
        }
      />

      <div className="page-body">
        {report.isPending ? <Loading /> : null}
        {report.isError ? (
          <ErrorState message={errorMessage(report.error)} onRetry={() => report.refetch()} />
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
                      ? `${formatMoney(member.monthlySalary, member.currency)} per month`
                      : `${formatMoney(member.hourlyRate, member.currency)} per hour`}
                  </span>
                </div>
              </div>

              <hr className="divider" style={{ margin: "var(--space-8) 0" }} />

              <div className="stat-grid">
                <Stat label="Approved" value={formatDuration(member.approvedMinutes)} />
                <Stat
                  label="Waiting"
                  value={formatDuration(member.pendingMinutes)}
                  hint={member.pendingMinutes ? <Link to="/timesheets">Review</Link> : undefined}
                />
                <Stat label="Worked days" value={member.workedDays} />
                <Stat
                  label="Earned"
                  value={formatMoney(member.grossAmount, member.currency)}
                  hint="Approved time only"
                />
              </div>

              {goalMinutes > 0 ? (
                <div className="stack gap-4" style={{ marginTop: "var(--space-8)" }}>
                  <div className="row between t-caption muted">
                    <span>Towards {member.monthlyGoalHours}h goal</span>
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
                <CardHeader title="Approved time per day" />
                <div className="card-body">
                  <DayBars days={report.data.days} />
                </div>
              </Card>

              <Card flush style={{ minWidth: 280 }}>
                <CardHeader title="By project" />
                <div className="card-body stack gap-6">
                  {report.data.projects.length ? (
                    report.data.projects.map((project) => (
                      <div key={project.projectId ?? "none"} className="stack gap-3">
                        <div className="row between">
                          <span className="row gap-4 t-body-sm">
                            <span className="dot" style={{ color: project.color }} aria-hidden />
                            {project.name}
                          </span>
                          <span className="t-mono muted">{formatDuration(project.minutes)}</span>
                        </div>
                        <Progress value={project.minutes / Math.max(1, member.approvedMinutes)} />
                      </div>
                    ))
                  ) : (
                    <span className="t-body-sm muted">No approved time this month.</span>
                  )}
                </div>
              </Card>
            </div>

            <Card flush>
              <CardHeader title={`${report.data.sessions.length} entries`} />
              {report.data.sessions.length ? (
                <div className="table-scroll">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Hours</th>
                        <th className="num">Duration</th>
                        <th>Where</th>
                        <th>Project</th>
                        <th>Note</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.data.sessions.map((session) => (
                        <tr key={session.id}>
                          <td className="muted">{formatDate(session.startAt, calendar)}</td>
                          <td className="t-mono muted">
                            {formatTime(session.startAt)}
                            {session.endAt ? ` – ${formatTime(session.endAt)}` : " – running"}
                          </td>
                          <td className="num t-mono">{formatDuration(session.durationMinutes)}</td>
                          <td className="muted">
                            {session.category === "REMOTE" ? "Remote" : "Onsite"}
                          </td>
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
                <EmptyState title="No time this month" />
              )}
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}
