import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PayrollLineDto } from "@omam/contracts";
import { api, downloadCsv } from "../lib/api";
import { useSession } from "../lib/session";
import { translateError } from "@omam/i18n";
import { useLanguage } from "../lib/i18n";
import { useToast } from "../lib/ui";
import { currentMonth, displayName, formatDuration, formatMoney, monthLabel } from "../lib/format";
import { PageHeader } from "./layout";
import { MonthPicker } from "../components/controls";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Modal,
  Stat,
  Textarea,
} from "../components/ui";

const STATUS_TONE = { DRAFT: "warning", LOCKED: "info", PAID: "success" } as const;

export function PayrollPage() {
  const { calendar, can } = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { language, t } = useLanguage();

  const [month, setMonth] = useState(() => currentMonth(calendar));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<PayrollLineDto | null>(null);
  const [adjustment, setAdjustment] = useState(0);
  const [adjustmentNote, setAdjustmentNote] = useState("");

  const periods = useQuery({ queryKey: ["payroll-periods"], queryFn: api.payrollPeriods });

  const periodForMonth = periods.data?.periods.find((period) => period.month === month) ?? null;

  // Following the month picker keeps one mental model: pick a month, see its run.
  useEffect(() => {
    setSelectedId(periodForMonth?.id ?? null);
  }, [periodForMonth?.id]);

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
    onSuccess: (result) => {
      setSelectedId(result.period.id);
      toast(t("admin.payroll.ready", { month: monthLabel(month, calendar, language) }), "success");
      refresh();
    },
    onError: (error) => toast(translateError(error, t), "error"),
  });

  const setStatus = useMutation({
    mutationFn: (status: "DRAFT" | "LOCKED" | "PAID") =>
      api.updatePayrollPeriod(selectedId!, { status }),
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

  const period = detail.data?.period ?? null;
  const isDraft = period?.status === "DRAFT";

  return (
    <>
      <PageHeader
        title={t("admin.nav.payroll")}
        subtitle={t("admin.payroll.subtitle")}
        actions={
          <>
            <MonthPicker month={month} calendar={calendar} onChange={setMonth} />
            <Button
              variant="primary"
              loading={build.isPending}
              /* A locked run is the record of what was paid; it is never rebuilt. */
              disabled={Boolean(periodForMonth) && periodForMonth?.status !== "DRAFT"}
              onClick={() => build.mutate()}
            >
              {periodForMonth ? t("admin.payroll.rebuild") : t("admin.payroll.build")}
            </Button>
          </>
        }
      />

      <div className="page-body">
        {periods.isError ? (
          <ErrorState message={translateError(periods.error, t)} onRetry={() => periods.refetch()} />
        ) : null}

        {!periodForMonth && !periods.isPending ? (
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

        {period && detail.data ? (
          <>
            <Card>
              <div className="row between wrap gap-7">
                <div className="stack gap-3">
                  <div className="row gap-5">
                    <h2>{monthLabel(period.month, period.calendar, language)}</h2>
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
                  <Button
                    onClick={() =>
                      downloadCsv(
                        `/payroll/periods/${period.id}/export.csv`,
                        {},
                        `omam-payroll-${period.month}.csv`,
                      ).catch((error) => toast(translateError(error, t), "error"))
                    }
                  >
                    {t("admin.payroll.exportCsv")}
                  </Button>

                  {can("OWNER") && isDraft ? (
                    <Button
                      variant="primary"
                      loading={setStatus.isPending}
                      onClick={() => {
                        if (
                          confirm(t("admin.payroll.confirmLock"))
                        ) {
                          setStatus.mutate("LOCKED");
                        }
                      }}
                    >
                      {t("admin.payroll.lockMonth")}
                    </Button>
                  ) : null}

                  {can("OWNER") && period.status === "LOCKED" ? (
                    <>
                      <Button variant="outline" onClick={() => setStatus.mutate("DRAFT")}>
                        {t("admin.payroll.reopen")}
                      </Button>
                      <Button variant="primary" onClick={() => setStatus.mutate("PAID")}>
                        {t("admin.payroll.markPaid")}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>

              <hr className="divider" style={{ margin: "var(--space-8) 0" }} />

              <div className="stat-grid">
                <Stat label={t("admin.payroll.gross")} value={formatMoney(period.totalGross, period.currency, t)} />
                <Stat
                  label={t("admin.payroll.netToPay")}
                  value={formatMoney(period.totalNet, period.currency, t)}
                  hint={t("admin.payroll.afterAdjustments")}
                />
                <Stat label={t("admin.payroll.people")} value={detail.data.lines.length} />
              </div>
            </Card>

            <Card flush>
              <CardHeader
                title={t("admin.payroll.payslips")}
                subtitle={isDraft ? t("admin.payroll.payslipsHint") : undefined}
              />

              {detail.data.lines.length ? (
                <div className="table-scroll">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{t("admin.timesheets.member")}</th>
                        <th>{t("admin.members.code")}</th>
                        <th className="num">{t("admin.payroll.approved")}</th>
                        <th className="num">{t("admin.payroll.days")}</th>
                        <th className="num">{t("admin.payroll.rate")}</th>
                        <th className="num">{t("admin.payroll.gross")}</th>
                        <th className="num">{t("admin.payroll.adjustment")}</th>
                        <th className="num">{t("admin.payroll.net")}</th>
                        {isDraft ? <th className="tight" /> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.data.lines.map((line) => (
                        <tr key={line.id}>
                          <td>{displayName(line)}</td>
                          <td className="t-mono muted">{line.employeeCode ?? "—"}</td>
                          <td className="num t-mono">{formatDuration(line.approvedMinutes, language)}</td>
                          <td className="num t-mono muted">{line.workedDays}</td>
                          <td className="num t-mono muted">
                            {line.payType === "MONTHLY"
                              ? t("admin.payroll.monthly")
                              : formatMoney(line.hourlyRate, line.currency, t)}
                          </td>
                          <td className="num t-mono">{formatMoney(line.grossAmount, line.currency, t)}</td>
                          <td className="num t-mono">
                            {line.adjustment ? (
                              <span
                                title={line.adjustmentNote ?? undefined}
                                className={line.adjustment > 0 ? "accent" : "muted"}
                              >
                                {line.adjustment > 0 ? "+" : ""}
                                {formatMoney(line.adjustment, line.currency, t)}
                              </span>
                            ) : (
                              <span className="faint">—</span>
                            )}
                          </td>
                          <td className="num t-mono">{formatMoney(line.netAmount, line.currency, t)}</td>
                          {isDraft ? (
                            <td className="tight">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setAdjusting(line);
                                  setAdjustment(line.adjustment);
                                  setAdjustmentNote(line.adjustmentNote ?? "");
                                }}
                              >
                                {t("admin.payroll.adjust")}
                              </Button>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title={t("admin.payroll.noApproved")}
                  hint={t("admin.payroll.noApprovedHint")}
                />
              )}
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
              duration: formatDuration(adjusting.approvedMinutes, language),
            })}
          </p>

          <Field label={t("admin.payroll.adjustAmount", { currency: adjusting.currency })}>
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
