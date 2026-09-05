import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { translateError } from "@omam/i18n";
import { useLanguage } from "../lib/i18n";

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
  const { language, t } = useLanguage();
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
        title={t("admin.nav.overview")}
        subtitle={membership?.organizationName}
        actions={<MonthPicker month={month} calendar={calendar} onChange={setMonth} />}
      />

      <div className="page-body">
        {dashboard.isPending ? <Loading /> : null}
        {dashboard.isError ? (
          <ErrorState message={translateError(dashboard.error, t)} onRetry={() => dashboard.refetch()} />
        ) : null}

        {dashboard.data ? (
          <>
            <Card>
              <div className="stat-grid">
                <Stat
                  label={t("admin.dashboard.approvedThisMonth")}
                  value={formatDuration(dashboard.data.monthApprovedMinutes, language)}
                />
                <Stat
                  label={t("admin.dashboard.payrollSoFar")}
                  value={formatMoney(dashboard.data.monthGrossAmount, dashboard.data.currency, t)}
                  hint={t("admin.dashboard.approvedOnly")}
                />
                <Stat
                  label={t("admin.dashboard.waiting")}
                  value={dashboard.data.pendingCount}
                  hint={
                    dashboard.data.pendingCount > 0 ? (
                      <Link to="/timesheets">{t("admin.dashboard.reviewNow")}</Link>
                    ) : (
                      t("admin.dashboard.queueEmpty")
                    )
                  }
                />
                <Stat label={t("admin.dashboard.activeMembers")} value={dashboard.data.memberCount} />
              </div>
            </Card>

            <Card flush>
              <CardHeader
                title={t("admin.dashboard.onTheClock")}
                subtitle={
                  dashboard.data.activeNow.length
                    ? t("admin.dashboard.runningNow", { count: dashboard.data.activeNow.length })
                    : undefined
                }
              />
              {dashboard.data.activeNow.length ? (
                <div className="table-scroll">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{t("admin.dashboard.member")}</th>
                        <th>{t("admin.dashboard.started")}</th>
                        <th className="num">{t("admin.dashboard.elapsed")}</th>
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
                          <td className="num t-mono">{formatDuration(entry.minutes, language)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title={t("admin.dashboard.nobodyClockedIn")}
                  hint={t("admin.dashboard.nobodyHint")}
                />
              )}
            </Card>

            <Card flush>
              <CardHeader title={t("admin.dashboard.perDay")} />
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
