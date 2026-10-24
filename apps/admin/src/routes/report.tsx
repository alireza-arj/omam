import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { translateError } from "@omam/i18n";
import { Button, Card, CardHeader, EmptyState, ErrorState, Loading, Select } from "../components/ui";
import { Icon } from "../components/icons";
import { Metric } from "./dashboard";
import { ReportTable } from "../components/report-table";
import { CollectionToolbar, Pagination } from "../components/collection";
import { useCollection } from "../lib/collection";
import { useReportMonth } from "../lib/report-month";
import { api, downloadCsv } from "../lib/api";
import { useSession } from "../lib/session";
import { useLanguage } from "../lib/i18n";
import { displayName, formatDuration } from "../lib/format";
import { PageHeader } from "./layout";
import { MonthPicker } from "../components/controls";

export function ReportPage() {
  const { calendar, membership } = useSession();
  const { language, t } = useLanguage();
  const [month, setMonth] = useReportMonth(calendar);
  const report = useQuery({ queryKey: ["report", month, calendar], queryFn: () => api.monthlyReport({ month, calendar }), refetchInterval: 30_000 });
  const [sort, setSort] = useState("completed");
  const [exporting, setExporting] = useState(false);
  const sortedRows = [...(report.data?.rows ?? [])].sort((a, b) => sort === "completed" ? b.completedMinutes - a.completedMinutes : sort === "days" ? b.workedDays - a.workedDays : displayName(a).localeCompare(displayName(b), language));
  const collection = useCollection(sortedRows, (row) => [displayName(row), row.username, row.employeeCode].join(" "), `${month}:${sort}`);
  async function exportCsv() {
    setExporting(true);
    try { await downloadCsv("/reports/monthly.csv", { month, calendar, language }, `omam-${membership?.organizationSlug}-${month}.csv`); }
    catch { return; }
    finally { setExporting(false); }
  }
  return <>
    <PageHeader title={t("workspace.monthlyReport")} subtitle={t("workspace.reportHint")} actions={<><MonthPicker month={month} calendar={calendar} onChange={setMonth} /><Button variant="primary" loading={exporting} disabled={!report.data?.rows.length} onClick={exportCsv}><Icon name="download" />{t("workspace.exportSummary")}</Button></>} />
    <div className="page-body">
      {report.isPending ? <Loading /> : null}
      {report.isError ? <ErrorState message={translateError(report.error, t)} onRetry={() => report.refetch()} /> : null}
      {report.data ? <>
        <div className="metric-grid report-metrics"><Metric icon="sessions" label={t("workspace.trackedHours")} value={formatDuration(report.data.totals.completedMinutes, language)} /><Metric icon="report" label={t("workspace.completedSessions")} value={report.data.totals.sessionCount} /><Metric icon="members" label={t("workspace.members")} value={report.data.totals.memberCount} /></div>
        <Card flush><CardHeader title={t("workspace.reportFor", { team: membership?.organizationName ?? "" })} subtitle={t("workspace.periodHint")} />
          <CollectionToolbar search={collection.search} onSearch={collection.setSearch}><div className="collection-sort"><Select aria-label={t("admin.table.sort")} value={sort} onValueChange={setSort}><option value="completed">{t("admin.table.completed")}</option><option value="name">{t("admin.table.name")}</option><option value="days">{t("admin.table.days")}</option></Select></div></CollectionToolbar>
          {collection.total > 0 ? <ReportTable rows={collection.rows} month={month} /> : <EmptyState title={t(collection.search ? "admin.table.noResults" : "admin.report.noMembers")} hint={t(collection.search ? "admin.table.searchHint" : "workspace.emptyTeamHint")} />}
          <Pagination {...collection} />
        </Card>
      </> : null}
    </div>
  </>;
}
