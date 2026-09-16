import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  Progress,
  Select,
  Stat,
  Table,
  TableScroll,
} from "../components/ui";
import { CollectionToolbar, Pagination } from "../components/collection";
import { useCollection } from "../lib/collection";
import { useReportMonth, reportLink } from "../lib/report-month";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, downloadCsv } from "../lib/api";
import { useSession } from "../lib/session";
import { translateError } from "@omam/i18n";
import { useLanguage } from "../lib/i18n";
import { useToast } from "../lib/ui";
import { displayName, formatDuration, formatHours, formatMoney } from "../lib/format";
import { PageHeader } from "./layout";
import { MonthPicker } from "../components/controls";

export function ReportPage() {
  const { calendar } = useSession();
  const toast = useToast();
  const { language, t } = useLanguage();
  const [month, setMonth] = useReportMonth(calendar);

  const report = useQuery({
    queryKey: ["report", month, calendar],
    queryFn: () => api.monthlyReport({ month, calendar }),
  });

  const [sort, setSort] = useState("name");
  const [exporting, setExporting] = useState(false);
  const sortedRows = [...(report.data?.rows ?? [])].sort((a, b) => {
    if (sort === "completed") return b.completedMinutes - a.completedMinutes;
    if (sort === "days") return b.workedDays - a.workedDays;
    return displayName(a).localeCompare(displayName(b), language);
  });
  const collection = useCollection(
    sortedRows,
    (row) => [displayName(row), row.username].join(" "),
    `${month}:${sort}`,
  );

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadCsv("/reports/monthly.csv", { month, calendar }, `omam-${month}.csv`);
      toast(t("admin.report.exported"), "success");
    } catch (error) {
      toast(translateError(error, t), "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t("admin.nav.report")}
        actions={
          <>
            <MonthPicker month={month} calendar={calendar} onChange={setMonth} />
            <Button
              variant="primary"
              loading={exporting}
              disabled={!report.data?.rows.length}
              onClick={exportCsv}
            >
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
            <Card className="summary-card">
              <div className="stat-grid">
                <Stat
                  label={t("admin.report.completed")}
                  value={formatDuration(report.data.totals.completedMinutes, language)}
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
              <CollectionToolbar search={collection.search} onSearch={collection.setSearch}>
                <div className="collection-sort">
                  <Select aria-label={t("admin.table.sort")} value={sort} onValueChange={setSort}>
                    <option value="name">{t("admin.table.name")}</option>
                    <option value="completed">{t("admin.table.completed")}</option>
                    <option value="days">{t("admin.table.days")}</option>
                  </Select>
                </div>
              </CollectionToolbar>
              {collection.search && !collection.total && report.data ? (
                <EmptyState title={t("admin.table.noResults")} hint={t("admin.table.searchHint")} />
              ) : null}

              {collection.total > 0 ? (
                <TableScroll>
                  <Table>
                    <Table.Content aria-label={t("common.records")} className="omam-data">
                      <Table.Header>
                        <Table.Column isRowHeader>{t("admin.timesheets.member")}</Table.Column>
                        <Table.Column className="num">{t("admin.report.completed")}</Table.Column>
                        <Table.Column className="num">{t("admin.report.days")}</Table.Column>
                        <Table.Column className="goal-column">{t("admin.report.towardsGoal")}</Table.Column>
                        <Table.Column className="num">{t("admin.report.onsite")}</Table.Column>
                        <Table.Column className="num">{t("admin.report.remote")}</Table.Column>
                        <Table.Column className="num">{t("admin.report.gross")}</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {collection.rows.map((row) => {
                          const goalMinutes = row.monthlyGoalHours * 60;

                          return (
                            <Table.Row id={row.userId} key={row.userId}>
                              <Table.Cell>
                                <div className="row gap-5">
                                  <Avatar name={displayName(row)} src={row.avatarUrl} size="sm" />
                                  <div className="stack">
                                    <Link to={reportLink(`/members/${row.userId}`, month, calendar)}>
                                      {displayName(row)}
                                    </Link>
                                    <span className="t-caption faint">
                                      {row.payType === "MONTHLY"
                                        ? t("payType.MONTHLY")
                                        : t("payType.perHour", {
                                            amount: formatMoney(row.hourlyRate, row.currency, t),
                                          })}
                                    </span>
                                  </div>
                                </div>
                              </Table.Cell>
                              <Table.Cell className="num t-mono">
                                {formatDuration(row.completedMinutes, language)}
                              </Table.Cell>
                              <Table.Cell className="num t-mono muted">{row.workedDays}</Table.Cell>
                              <Table.Cell>
                                {goalMinutes > 0 ? (
                                  <div className="stack gap-3">
                                    <Progress value={row.completedMinutes / goalMinutes} />
                                    <span className="t-caption faint">
                                      {t("admin.report.ofGoal", {
                                        value: formatHours(row.completedMinutes),
                                        goal: row.monthlyGoalHours,
                                      })}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="faint">{t("admin.report.noGoal")}</span>
                                )}
                              </Table.Cell>
                              <Table.Cell className="num t-mono muted">
                                {formatDuration(row.onsiteMinutes, language)}
                              </Table.Cell>
                              <Table.Cell className="num t-mono muted">
                                {formatDuration(row.remoteMinutes, language)}
                              </Table.Cell>
                              <Table.Cell className="num t-mono">
                                {formatMoney(row.grossAmount, row.currency, t)}
                              </Table.Cell>
                            </Table.Row>
                          );
                        })}
                      </Table.Body>
                    </Table.Content>
                  </Table>
                </TableScroll>
              ) : !collection.search ? (
                <EmptyState title={t("admin.report.noMembers")} hint={t("admin.report.noMembersHint")} />
              ) : null}
              <Pagination {...collection} />
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}
