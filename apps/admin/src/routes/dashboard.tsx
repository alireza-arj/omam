import {
  Avatar,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Loading,
  Stat,
  Table,
  TableScroll,
} from "../components/ui";
import { useReportMonth, reportLink } from "../lib/report-month";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { translateError } from "@omam/i18n";
import { useLanguage } from "../lib/i18n";

import { displayName, formatDuration, formatMoney, formatTime } from "../lib/format";
import { PageHeader } from "./layout";
import { DayBars, MonthPicker } from "../components/controls";

export function DashboardPage() {
  const { calendar } = useSession();
  const { language, t } = useLanguage();
  const [month, setMonth] = useReportMonth(calendar);

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
        actions={<MonthPicker month={month} calendar={calendar} onChange={setMonth} />}
      />

      <div className="page-body">
        {dashboard.isPending ? <Loading /> : null}
        {dashboard.isError ? (
          <ErrorState message={translateError(dashboard.error, t)} onRetry={() => dashboard.refetch()} />
        ) : null}

        {dashboard.data ? (
          <>
            <Card className="summary-card">
              <div className="stat-grid">
                <Stat
                  label={t("admin.dashboard.completedThisMonth")}
                  value={formatDuration(dashboard.data.monthCompletedMinutes, language)}
                />
                <Stat
                  label={t("admin.dashboard.payrollSoFar")}
                  value={formatMoney(dashboard.data.monthGrossAmount, dashboard.data.currency, t)}
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
                <TableScroll>
                  <Table>
                    <Table.Content aria-label={t("common.records")} className="omam-data">
                      <Table.Header>
                        <Table.Column isRowHeader>{t("admin.dashboard.member")}</Table.Column>
                        <Table.Column>{t("admin.dashboard.started")}</Table.Column>
                        <Table.Column className="num">{t("admin.dashboard.elapsed")}</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {dashboard.data.activeNow.map((entry) => (
                          <Table.Row id={entry.userId} key={entry.userId}>
                            <Table.Cell>
                              <div className="row gap-5">
                                <Avatar name={displayName(entry)} src={entry.avatarUrl} size="sm" />
                                <Link to={reportLink(`/members/${entry.userId}`, month, calendar)}>
                                  {displayName(entry)}
                                </Link>
                              </div>
                            </Table.Cell>
                            <Table.Cell className="muted">{formatTime(entry.startedAt)}</Table.Cell>
                            <Table.Cell className="num t-mono">
                              {formatDuration(entry.minutes, language)}
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table>
                </TableScroll>
              ) : (
                <EmptyState title={t("admin.dashboard.nobodyClockedIn")} />
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
