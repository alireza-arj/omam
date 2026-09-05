import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { errorMessage } from "../lib/ui";
import {
  currentMonth,
  displayName,
  formatDuration,
  formatMoney,
  formatTime,
} from "../lib/format";
import { PageHeader } from "./layout";
import { DayBars, MonthPicker } from "../components/controls";
import { Avatar, Card, CardHeader, EmptyState, ErrorState, Loading, Stat } from "../components/ui";

export function DashboardPage() {
  const { calendar, membership } = useSession();
  const [month, setMonth] = useState(() => currentMonth(calendar));

  const dashboard = useQuery({
    queryKey: ["dashboard", month, calendar],
    queryFn: () => api.dashboard({ month, calendar }),
    // The "on the clock" list is only useful if it keeps up with the team.
    refetchInterval: 30_000,
  });

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={membership?.organizationName}
        actions={<MonthPicker month={month} calendar={calendar} onChange={setMonth} />}
      />

      <div className="page-body">
        {dashboard.isPending ? <Loading /> : null}
        {dashboard.isError ? (
          <ErrorState message={errorMessage(dashboard.error)} onRetry={() => dashboard.refetch()} />
        ) : null}

        {dashboard.data ? (
          <>
            <Card>
              <div className="stat-grid">
                <Stat
                  label="Approved this month"
                  value={formatDuration(dashboard.data.monthApprovedMinutes)}
                />
                <Stat
                  label="Payroll so far"
                  value={formatMoney(dashboard.data.monthGrossAmount, dashboard.data.currency)}
                  hint="Approved time only"
                />
                <Stat
                  label="Waiting for review"
                  value={dashboard.data.pendingCount}
                  hint={
                    dashboard.data.pendingCount > 0 ? (
                      <Link to="/timesheets">Review now</Link>
                    ) : (
                      "Nothing in the queue"
                    )
                  }
                />
                <Stat label="Active members" value={dashboard.data.memberCount} />
              </div>
            </Card>

            <Card flush>
              <CardHeader
                title="On the clock"
                subtitle={
                  dashboard.data.activeNow.length
                    ? `${dashboard.data.activeNow.length} running now`
                    : undefined
                }
              />
              {dashboard.data.activeNow.length ? (
                <div className="table-scroll">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Started</th>
                        <th className="num">Elapsed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.data.activeNow.map((entry) => (
                        <tr key={entry.userId}>
                          <td>
                            <div className="row gap-5">
                              <Avatar name={displayName(entry)} src={entry.avatarUrl} size="sm" />
                              <Link to={`/members/${entry.userId}`}>{displayName(entry)}</Link>
                            </div>
                          </td>
                          <td className="muted">{formatTime(entry.startedAt)}</td>
                          <td className="num t-mono">{formatDuration(entry.minutes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="Nobody is clocked in" hint="Timers show up here as they start." />
              )}
            </Card>

            <Card flush>
              <CardHeader title="Approved time per day" />
              <div className="card-body">
                <DayBars days={dashboard.data.trend} />
              </div>
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}
