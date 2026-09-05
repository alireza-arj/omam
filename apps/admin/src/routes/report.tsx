import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, downloadCsv } from "../lib/api";
import { useSession } from "../lib/session";
import { translateError } from "@omam/i18n";
import { useLanguage } from "../lib/i18n";
import { useToast } from "../lib/ui";
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
  const { language, t } = useLanguage();
  const [month, setMonth] = useState(() => currentMonth(calendar));

  const report = useQuery({
    queryKey: ["report", month, calendar],
    queryFn: () => api.monthlyReport({ month, calendar }),
  });

  async function exportCsv() {
    try {
      await downloadCsv("/reports/monthly.csv", { month, calendar }, `omam-${month}.csv`);
      toast(t("admin.report.exported"), "success");
    } catch (error) {
      toast(translateError(error, t), "error");
    }
  }

  return (
    <>
      <PageHeader
        title={t("admin.nav.report")}
        subtitle={t("admin.report.subtitle", { month: monthLabel(month, calendar, language) })}
        actions={
          <>
            <MonthPicker month={month} calendar={calendar} onChange={setMonth} />
            <Button variant="primary" onClick={exportCsv}>
              {t("admin.report.exportCsv")}
            </Button>
          </>
        }
      />

      <div className="page-body">
        {report.isPending ? <Loading /> : null}
        {report.isError ? (
          <ErrorState message={translateError(report.error, t)} onRetry={() => report.refetch()} />
        ) : null}

        {report.data ? (
          <>
            <Card>
              <div className="stat-grid">
                <Stat
                  label={t("admin.report.approved")}
                  value={formatDuration(report.data.totals.approvedMinutes, language)}
                  hint={t("admin.report.approvedHours", {
                    value: formatHours(report.data.totals.approvedMinutes),
                  })}
                />
                <Stat
                  label={t("admin.report.stillWaiting")}
                  value={formatDuration(report.data.totals.pendingMinutes, language)}
                  hint={
                    report.data.totals.pendingMinutes > 0 ? (
                      <Link to="/timesheets">{t("admin.report.reviewBeforePayroll")}</Link>
                    ) : (
                      t("admin.report.allReviewed")
                    )
                  }
                />
                <Stat
                  label={t("admin.report.payrollTotal")}
                  value={formatMoney(report.data.totals.grossAmount, report.data.currency, t)}
                  hint={
                    report.data.totals.byCurrency.length > 1
                      ? report.data.totals.byCurrency
                          .filter((entry) => entry.currency !== report.data.currency)
                          .map((entry) => `+ ${formatMoney(entry.grossAmount, entry.currency, t)}`)
                          .join(" · ")
                      : undefined
                  }
                />
                <Stat label={t("admin.report.members")} value={report.data.totals.activeMemberCount} />
              </div>
            </Card>

            <Card flush>
              <CardHeader
                title={t("admin.report.perMember")}
                subtitle={t("admin.report.perMemberHint")}
              />

              {report.data.rows.length ? (
                <div className="table-scroll">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{t("admin.timesheets.member")}</th>
                        <th className="num">{t("admin.report.approved")}</th>
                        <th className="num">{t("admin.report.pending")}</th>
                        <th className="num">{t("admin.report.days")}</th>
                        <th style={{ minWidth: 140 }}>{t("admin.report.towardsGoal")}</th>
                        <th className="num">{t("admin.report.onsite")}</th>
                        <th className="num">{t("admin.report.remote")}</th>
                        <th className="num">{t("admin.report.gross")}</th>
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
                                      ? t("payType.MONTHLY")
                                      : t("payType.perHour", {
                                          amount: formatMoney(row.hourlyRate, row.currency, t),
                                        })}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="num t-mono">{formatDuration(row.approvedMinutes, language)}</td>
                            <td className="num t-mono">
                              {row.pendingMinutes ? (
                                <Badge tone="warning">{formatDuration(row.pendingMinutes, language)}</Badge>
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
                                    {t("admin.report.ofGoal", {
                                      value: formatHours(row.approvedMinutes),
                                      goal: row.monthlyGoalHours,
                                    })}
                                  </span>
                                </div>
                              ) : (
                                <span className="faint">{t("admin.report.noGoal")}</span>
                              )}
                            </td>
                            <td className="num t-mono muted">{formatHours(row.onsiteMinutes)}</td>
                            <td className="num t-mono muted">{formatHours(row.remoteMinutes)}</td>
                            <td className="num t-mono">{formatMoney(row.grossAmount, row.currency, t)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title={t("admin.report.noMembers")}
                  hint={t("admin.report.noMembersHint")}
                />
              )}
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}
