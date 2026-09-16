import {
  ActionMenu,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Modal,
  Stat,
  Table,
  TableScroll,
  Textarea,
} from "../components/ui";
import { CollectionToolbar, Pagination } from "../components/collection";
import { useCollection } from "../lib/collection";
import { useReportMonth } from "../lib/report-month";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PayrollLineDto } from "@omam/contracts";
import { api, downloadCsv } from "../lib/api";
import { useSession } from "../lib/session";
import { translateError } from "@omam/i18n";
import { useLanguage } from "../lib/i18n";
import { useToast } from "../lib/ui";
import { currencyLabel, displayName, formatDuration, formatMoney, monthLabel } from "../lib/format";
import { PageHeader } from "./layout";
import { MonthPicker } from "../components/controls";

const STATUS_TONE = { DRAFT: "warning", LOCKED: "info", PAID: "success" } as const;

export function PayrollPage() {
  const { calendar, can } = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { language, t } = useLanguage();

  const [month, setMonth] = useReportMonth(calendar);
  const [adjusting, setAdjusting] = useState<PayrollLineDto | null>(null);
  const [adjustment, setAdjustment] = useState(0);
  const [adjustmentNote, setAdjustmentNote] = useState("");

  const periods = useQuery({ queryKey: ["payroll-periods"], queryFn: api.payrollPeriods });

  const periodForMonth =
    periods.data?.periods.find((period) => period.month === month && period.calendar === calendar) ?? null;

  const selectedId = periodForMonth?.id ?? null;

  const detail = useQuery({
    queryKey: ["payroll-period", selectedId],
    queryFn: () => api.payrollPeriod(selectedId!),
    enabled: Boolean(selectedId),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["payroll-periods"] });
    queryClient.invalidateQueries({ queryKey: ["payroll-period"] });
  }

  const build = useMutation({
    mutationFn: () => api.buildPayroll(month, calendar),
    onSuccess: () => {
      toast(t("admin.payroll.ready", { month: monthLabel(month, calendar, language) }), "success");
      refresh();
    },
    onError: (error) => toast(translateError(error, t), "error"),
  });

  const setStatus = useMutation({
    mutationFn: (status: "DRAFT" | "LOCKED" | "PAID") => api.updatePayrollPeriod(selectedId!, { status }),
    onSuccess: (_result, status) => {
      toast(
        t(
          status === "LOCKED"
            ? "admin.payroll.locked"
            : status === "PAID"
              ? "admin.payroll.markedPaid"
              : "admin.payroll.reopened",
        ),
        "success",
      );
      refresh();
    },
    onError: (error) => toast(translateError(error, t), "error"),
  });

  const adjust = useMutation({
    mutationFn: (input: { id: string; adjustment: number; note: string | null }) =>
      api.updatePayrollLine(input.id, { adjustment: input.adjustment, adjustmentNote: input.note }),
    onSuccess: () => {
      toast(t("admin.payroll.adjustmentSaved"), "success");
      setAdjusting(null);
      refresh();
    },
    onError: (error) => toast(translateError(error, t), "error"),
  });

  const [exporting, setExporting] = useState(false);
  async function exportPayroll(path: string, query: Record<string, string>, filename: string) {
    setExporting(true);
    try {
      await downloadCsv(path, query, filename);
    } catch (error) {
      toast(translateError(error, t), "error");
    } finally {
      setExporting(false);
    }
  }
  const period = detail.data?.period ?? null;
  const isDraft = period?.status === "DRAFT";

  const collection = useCollection(
    detail.data?.lines ?? [],
    (row) => [displayName(row), row.employeeCode].join(" "),
    month,
  );

  return (
    <>
      <PageHeader
        title={t("admin.nav.payroll")}
        actions={<MonthPicker month={month} calendar={calendar} onChange={setMonth} />}
      />

      <div className="page-body">
        {periods.isError ? (
          <ErrorState message={translateError(periods.error, t)} onRetry={() => periods.refetch()} />
        ) : null}

        {periods.isPending ? <Loading /> : null}

        {periods.isSuccess && !periodForMonth ? (
          <Card>
            <EmptyState
              title={t("admin.payroll.noRun", { month: monthLabel(month, calendar, language) })}
              hint={t("admin.payroll.noRunHint")}
              action={
                <Button variant="primary" loading={build.isPending} onClick={() => build.mutate()}>
                  {t("admin.payroll.build")}
                </Button>
              }
            />
          </Card>
        ) : null}

        {detail.isPending && selectedId ? <Loading /> : null}
        {detail.isError ? (
          <ErrorState message={translateError(detail.error, t)} onRetry={() => detail.refetch()} />
        ) : null}

        {period && detail.data ? (
          <>
            <Card className="summary-card">
              <div className="row between wrap gap-7">
                <div className="stack gap-3">
                  <div className="row gap-5">
                    <Badge tone={STATUS_TONE[period.status]} dot>
                      {t(`admin.payroll.${period.status}`)}
                    </Badge>
                  </div>
                  <span className="t-caption muted">
                    {period.lockedAt && period.lockedByName
                      ? t("admin.payroll.lockedBy", { name: period.lockedByName })
                      : t("admin.payroll.draftHint")}
                  </span>
                </div>

                <div className="row gap-5 wrap">
                  {isDraft || (can("OWNER") && period.status === "LOCKED") ? (
                    <ActionMenu
                      label={t("admin.table.actions")}
                      disabled={build.isPending || setStatus.isPending}
                      items={[
                        ...(isDraft
                          ? [{ label: t("admin.payroll.rebuild"), onAction: () => build.mutate() }]
                          : []),
                        ...(can("OWNER") && period.status === "LOCKED"
                          ? [
                              {
                                label: t("admin.payroll.reopen"),
                                onAction: () => setStatus.mutate("DRAFT" as const),
                              },
                            ]
                          : []),
                      ]}
                    />
                  ) : null}
                  <Button
                    variant="ghost"
                    loading={exporting}
                    onClick={() =>
                      exportPayroll(
                        `/payroll/periods/${period.id}/export.csv`,
                        {},
                        `omam-payroll-${period.month}.csv`,
                      )
                    }
                  >
                    {t("admin.payroll.exportCsv")}
                  </Button>

                  {can("OWNER") && isDraft ? (
                    <Button
                      variant="primary"
                      loading={setStatus.isPending}
                      disabled={build.isPending}
                      onClick={() => {
                        if (confirm(t("admin.payroll.confirmLock"))) {
                          setStatus.mutate("LOCKED");
                        }
                      }}
                    >
                      {t("admin.payroll.lockMonth")}
                    </Button>
                  ) : null}

                  {can("OWNER") && period.status === "LOCKED" ? (
                    <>
                      <Button
                        variant="primary"
                        loading={setStatus.isPending}
                        onClick={() => setStatus.mutate("PAID")}
                      >
                        {t("admin.payroll.markPaid")}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>

              <hr className="divider" style={{ margin: "var(--space-8) 0" }} />

              <div className="stat-grid">
                <Stat
                  label={t("admin.payroll.gross")}
                  value={formatMoney(period.totalGross, period.currency, t)}
                />
                <Stat
                  label={t("admin.payroll.netToPay")}
                  value={formatMoney(period.totalNet, period.currency, t)}
                />
                <Stat label={t("admin.payroll.people")} value={detail.data.lines.length} />
              </div>
            </Card>

            <Card flush>
              <CollectionToolbar search={collection.search} onSearch={collection.setSearch} />
              {collection.search && !collection.total && detail.data ? (
                <EmptyState title={t("admin.table.noResults")} hint={t("admin.table.searchHint")} />
              ) : null}

              {collection.total > 0 ? (
                <TableScroll>
                  <Table>
                    <Table.Content aria-label={t("common.records")} className="omam-data">
                      <Table.Header>
                        <Table.Column isRowHeader>{t("admin.timesheets.member")}</Table.Column>
                        <Table.Column>{t("admin.members.code")}</Table.Column>
                        <Table.Column className="num">{t("admin.payroll.completed")}</Table.Column>
                        <Table.Column className="num">{t("admin.payroll.days")}</Table.Column>
                        <Table.Column className="num">{t("admin.payroll.rate")}</Table.Column>
                        <Table.Column className="num">{t("admin.payroll.gross")}</Table.Column>
                        <Table.Column className="num">{t("admin.payroll.adjustment")}</Table.Column>
                        <Table.Column className="num">{t("admin.payroll.net")}</Table.Column>
                        {isDraft ? <Table.Column className="tight" /> : null}
                      </Table.Header>
                      <Table.Body>
                        {collection.rows.map((line) => (
                          <Table.Row id={line.id} key={line.id}>
                            <Table.Cell>{displayName(line)}</Table.Cell>
                            <Table.Cell className="t-mono muted">{line.employeeCode ?? "—"}</Table.Cell>
                            <Table.Cell className="num t-mono">
                              {formatDuration(line.completedMinutes, language)}
                            </Table.Cell>
                            <Table.Cell className="num t-mono muted">{line.workedDays}</Table.Cell>
                            <Table.Cell className="num t-mono muted">
                              {line.payType === "MONTHLY"
                                ? t("admin.payroll.monthly")
                                : formatMoney(line.hourlyRate, line.currency, t)}
                            </Table.Cell>
                            <Table.Cell className="num t-mono">
                              {formatMoney(line.grossAmount, line.currency, t)}
                            </Table.Cell>
                            <Table.Cell className="num t-mono">
                              {line.adjustment ? (
                                <span title={line.adjustmentNote ?? undefined} className="muted">
                                  {formatMoney(line.adjustment, line.currency, t, true)}
                                </span>
                              ) : (
                                <span className="faint">—</span>
                              )}
                            </Table.Cell>
                            <Table.Cell className="num t-mono">
                              {formatMoney(line.netAmount, line.currency, t)}
                            </Table.Cell>
                            {isDraft ? (
                              <Table.Cell className="tight">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={build.isPending || setStatus.isPending}
                                  onClick={() => {
                                    setAdjusting(line);
                                    setAdjustment(line.adjustment);
                                    setAdjustmentNote(line.adjustmentNote ?? "");
                                  }}
                                >
                                  {t("admin.payroll.adjust")}
                                </Button>
                              </Table.Cell>
                            ) : null}
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table>
                </TableScroll>
              ) : !collection.search ? (
                <EmptyState title={t("admin.payroll.noCompleted")} hint={t("admin.payroll.noCompletedHint")} />
              ) : null}
              <Pagination {...collection} />
            </Card>
          </>
        ) : null}
      </div>

      {adjusting ? (
        <Modal
          title={t("admin.payroll.adjustTitle", { name: displayName(adjusting) })}
          onClose={() => setAdjusting(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setAdjusting(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="primary"
                loading={adjust.isPending}
                onClick={() =>
                  adjust.mutate({
                    id: adjusting.id,
                    adjustment,
                    note: adjustmentNote.trim() || null,
                  })
                }
              >
                {t("admin.payroll.saveAdjustment")}
              </Button>
            </>
          }
        >
          <p className="t-body-sm muted">
            {t("admin.payroll.adjustIntro", {
              gross: formatMoney(adjusting.grossAmount, adjusting.currency, t),
              duration: formatDuration(adjusting.completedMinutes, language),
            })}
          </p>

          <Field
            label={t("admin.payroll.adjustAmount", { currency: currencyLabel(adjusting.currency, t) })}
            hint={t("admin.payroll.adjustHint")}
          >
            <Input
              type="number"
              value={adjustment}
              onChange={(event) => setAdjustment(Number(event.target.value))}
            />
          </Field>

          <Field label={t("admin.payroll.adjustWhy")}>
            <Textarea
              value={adjustmentNote}
              onChange={(event) => setAdjustmentNote(event.target.value)}
              placeholder={t("admin.payroll.adjustPlaceholder")}
              maxLength={240}
            />
          </Field>

          <div className="row between t-label">
            <span className="muted">{t("admin.payroll.newNet")}</span>
            <span className="t-mono">
              {formatMoney(adjusting.grossAmount + adjustment, adjusting.currency, t)}
            </span>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
