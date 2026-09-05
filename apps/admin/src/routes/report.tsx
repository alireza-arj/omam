import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, downloadCsv } from "../lib/api";
import { useSession } from "../lib/session";
import { errorMessage, useToast } from "../lib/ui";
import {
  currentMonth,
  displayName,
  formatDuration,
  formatHours,
  formatMoney,
  monthLabel,
} from "../lib/format";
import { PageHeader } from "./layout";
import { MonthPicker } from "../components/controls";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Loading,
  Progress,
  Stat,
} from "../components/ui";

export function ReportPage() {
  const { calendar } = useSession();
  const toast = useToast();
  const [month, setMonth] = useState(() => currentMonth(calendar));

  const report = useQuery({
    queryKey: ["report", month, calendar],
    queryFn: () => api.monthlyReport({ month, calendar }),
  });

  async function exportCsv() {
    try {
      await downloadCsv("/reports/monthly.csv", { month, calendar }, `omam-${month}.csv`);
      toast("Export downloaded.", "success");
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  }

  return (
    <>
      <PageHeader
        title="Monthly report"
        subtitle={`Everyone's hours for ${monthLabel(month, calendar)}.`}
        actions={
          <>
            <MonthPicker month={month} calendar={calendar} onChange={setMonth} />
            <Button variant="primary" onClick={exportCsv}>
              Export CSV
            </Button>
          </>
        }
      />

      <div className="page-body">
        {report.isPending ? <Loading /> : null}
        {report.isError ? (
          <ErrorState message={errorMessage(report.error)} onRetry={() => report.refetch()} />
        ) : null}

        {report.data ? (
          <>
            <Card>
              <div className="stat-grid">
                <Stat
                  label="Approved"
                  value={formatDuration(report.data.totals.approvedMinutes)}
                  hint={`${formatHours(report.data.totals.approvedMinutes)} hours`}
                />
                <Stat
                  label="Still waiting"
                  value={formatDuration(report.data.totals.pendingMinutes)}
                  hint={
                    report.data.totals.pendingMinutes > 0 ? (
                      <Link to="/timesheets">Review before payroll</Link>
                    ) : (
                      "Everything is reviewed"
                    )
                  }
                />
                <Stat
                  label="Payroll total"
                  value={formatMoney(report.data.totals.grossAmount, report.data.currency)}
                  hint={
                    report.data.totals.byCurrency.length > 1
                      ? report.data.totals.byCurrency
                          .filter((entry) => entry.currency !== report.data.currency)
                          .map((entry) => `+ ${formatMoney(entry.grossAmount, entry.currency)}`)
                          .join(" · ")
                      : undefined
                  }
                />
                <Stat label="Members" value={report.data.totals.activeMemberCount} />
              </div>
            </Card>

            <Card flush>
              <CardHeader
                title="Per member"
                subtitle="Approved time only. Pending hours never turn into pay."
              />

              {report.data.rows.length ? (
                <div className="table-scroll">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th className="num">Approved</th>
                        <th className="num">Pending</th>
                        <th className="num">Days</th>
                        <th style={{ minWidth: 140 }}>Towards goal</th>
                        <th className="num">Onsite</th>
                        <th className="num">Remote</th>
                        <th className="num">Gross</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.data.rows.map((row) => {
                        const goalMinutes = row.monthlyGoalHours * 60;

                        return (
                          <tr key={row.userId}>
                            <td>
                              <div className="row gap-5">
                                <Avatar name={displayName(row)} src={row.avatarUrl} size="sm" />
                                <div className="stack">
                                  <Link to={`/members/${row.userId}`}>{displayName(row)}</Link>
                                  <span className="t-caption faint">
                                    {row.payType === "MONTHLY"
                                      ? "Fixed monthly"
                                      : `${formatMoney(row.hourlyRate, row.currency)} / hour`}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="num t-mono">{formatDuration(row.approvedMinutes)}</td>
                            <td className="num t-mono">
                              {row.pendingMinutes ? (
                                <Badge tone="warning">{formatDuration(row.pendingMinutes)}</Badge>
                              ) : (
                                <span className="faint">—</span>
                              )}
                            </td>
                            <td className="num t-mono muted">{row.workedDays}</td>
                            <td>
                              {goalMinutes > 0 ? (
                                <div className="stack gap-3">
                                  <Progress value={row.approvedMinutes / goalMinutes} />
                                  <span className="t-caption faint">
                                    {formatHours(row.approvedMinutes)} of {row.monthlyGoalHours}h
                                  </span>
                                </div>
                              ) : (
                                <span className="faint">No goal</span>
                              )}
                            </td>
                            <td className="num t-mono muted">{formatHours(row.onsiteMinutes)}</td>
                            <td className="num t-mono muted">{formatHours(row.remoteMinutes)}</td>
                            <td className="num t-mono">{formatMoney(row.grossAmount, row.currency)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="No members yet" hint="Invite your team to start tracking." />
              )}
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}
