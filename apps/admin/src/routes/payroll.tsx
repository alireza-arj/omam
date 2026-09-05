import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PayrollLineDto } from "@omam/contracts";
import { api, downloadCsv } from "../lib/api";
import { useSession } from "../lib/session";
import { errorMessage, useToast } from "../lib/ui";
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
      toast(`Payroll for ${monthLabel(month, calendar)} is ready to review.`, "success");
      refresh();
    },
    onError: (error) => toast(errorMessage(error), "error"),
  });

  const setStatus = useMutation({
    mutationFn: (status: "DRAFT" | "LOCKED" | "PAID") =>
      api.updatePayrollPeriod(selectedId!, { status }),
    onSuccess: (_result, status) => {
      toast(
        status === "LOCKED"
          ? "Locked. The month's time can no longer be edited."
          : status === "PAID"
            ? "Marked as paid."
            : "Reopened as a draft.",
        "success",
      );
      refresh();
    },
    onError: (error) => toast(errorMessage(error), "error"),
  });

  const adjust = useMutation({
    mutationFn: (input: { id: string; adjustment: number; note: string | null }) =>
      api.updatePayrollLine(input.id, { adjustment: input.adjustment, adjustmentNote: input.note }),
    onSuccess: () => {
      toast("Adjustment saved.", "success");
      setAdjusting(null);
      refresh();
    },
    onError: (error) => toast(errorMessage(error), "error"),
  });

  const period = detail.data?.period ?? null;
  const isDraft = period?.status === "DRAFT";

  return (
    <>
      <PageHeader
        title="Payroll"
        subtitle="Turn approved hours into what each person is owed."
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
              {periodForMonth ? "Rebuild draft" : "Build payroll"}
            </Button>
          </>
        }
      />

      <div className="page-body">
        {periods.isError ? (
          <ErrorState message={errorMessage(periods.error)} onRetry={() => periods.refetch()} />
        ) : null}

        {!periodForMonth && !periods.isPending ? (
          <Card>
            <EmptyState
              title={`No payroll run for ${monthLabel(month, calendar)}`}
              hint="Building a draft totals every approved entry in the month. You can rebuild it as often as you like until you lock it."
              action={
                <Button variant="primary" loading={build.isPending} onClick={() => build.mutate()}>
                  Build payroll
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
                    <h2>{monthLabel(period.month, period.calendar)}</h2>
                    <Badge tone={STATUS_TONE[period.status]} dot>
                      {period.status.charAt(0) + period.status.slice(1).toLowerCase()}
                    </Badge>
                  </div>
                  <span className="t-caption muted">
                    {period.lockedAt && period.lockedByName
                      ? `Locked by ${period.lockedByName}.`
                      : "Draft — rebuild it whenever new time is approved."}
                  </span>
                </div>

                <div className="row gap-5 wrap">
                  <Button
                    onClick={() =>
                      downloadCsv(
                        `/payroll/periods/${period.id}/export.csv`,
                        {},
                        `omam-payroll-${period.month}.csv`,
                      ).catch((error) => toast(errorMessage(error), "error"))
                    }
                  >
                    Export CSV
                  </Button>

                  {can("OWNER") && isDraft ? (
                    <Button
                      variant="primary"
                      loading={setStatus.isPending}
                      onClick={() => {
                        if (
                          confirm(
                            "Lock this month? Nobody will be able to add or change time in it afterwards.",
                          )
                        ) {
                          setStatus.mutate("LOCKED");
                        }
                      }}
                    >
                      Lock month
                    </Button>
                  ) : null}

                  {can("OWNER") && period.status === "LOCKED" ? (
                    <>
                      <Button variant="outline" onClick={() => setStatus.mutate("DRAFT")}>
                        Reopen
                      </Button>
                      <Button variant="primary" onClick={() => setStatus.mutate("PAID")}>
                        Mark as paid
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>

              <hr className="divider" style={{ margin: "var(--space-8) 0" }} />

              <div className="stat-grid">
                <Stat label="Gross" value={formatMoney(period.totalGross, period.currency)} />
                <Stat
                  label="Net to pay"
                  value={formatMoney(period.totalNet, period.currency)}
                  hint="After adjustments"
                />
                <Stat label="People" value={detail.data.lines.length} />
              </div>
            </Card>

            <Card flush>
              <CardHeader
                title="Payslips"
                subtitle={isDraft ? "Adjust a line for a bonus, an advance or a deduction." : undefined}
              />

              {detail.data.lines.length ? (
                <div className="table-scroll">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Code</th>
                        <th className="num">Approved</th>
                        <th className="num">Days</th>
                        <th className="num">Rate</th>
                        <th className="num">Gross</th>
                        <th className="num">Adjustment</th>
                        <th className="num">Net</th>
                        {isDraft ? <th className="tight" /> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.data.lines.map((line) => (
                        <tr key={line.id}>
                          <td>{displayName(line)}</td>
                          <td className="t-mono muted">{line.employeeCode ?? "—"}</td>
                          <td className="num t-mono">{formatDuration(line.approvedMinutes)}</td>
                          <td className="num t-mono muted">{line.workedDays}</td>
                          <td className="num t-mono muted">
                            {line.payType === "MONTHLY"
                              ? "Monthly"
                              : formatMoney(line.hourlyRate, line.currency)}
                          </td>
                          <td className="num t-mono">{formatMoney(line.grossAmount, line.currency)}</td>
                          <td className="num t-mono">
                            {line.adjustment ? (
                              <span
                                title={line.adjustmentNote ?? undefined}
                                className={line.adjustment > 0 ? "accent" : "muted"}
                              >
                                {line.adjustment > 0 ? "+" : ""}
                                {formatMoney(line.adjustment, line.currency)}
                              </span>
                            ) : (
                              <span className="faint">—</span>
                            )}
                          </td>
                          <td className="num t-mono">{formatMoney(line.netAmount, line.currency)}</td>
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
                                Adjust
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
                  title="No approved time in this month"
                  hint="Approve the team's timesheets, then rebuild the draft."
                />
              )}
            </Card>
          </>
        ) : null}
      </div>

      {adjusting ? (
        <Modal
          title={`Adjust ${displayName(adjusting)}'s pay`}
          onClose={() => setAdjusting(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setAdjusting(null)}>
                Cancel
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
                Save adjustment
              </Button>
            </>
          }
        >
          <p className="t-body-sm muted">
            Gross is {formatMoney(adjusting.grossAmount, adjusting.currency)} from{" "}
            {formatDuration(adjusting.approvedMinutes)} of approved time. A negative number deducts.
          </p>

          <Field label={`Adjustment (${adjusting.currency})`}>
            <Input
              type="number"
              value={adjustment}
              onChange={(event) => setAdjustment(Number(event.target.value))}
            />
          </Field>

          <Field label="Why">
            <Textarea
              value={adjustmentNote}
              onChange={(event) => setAdjustmentNote(event.target.value)}
              placeholder="Eid bonus"
              maxLength={240}
            />
          </Field>

          <div className="row between t-label">
            <span className="muted">New net</span>
            <span className="t-mono">
              {formatMoney(adjusting.grossAmount + adjustment, adjusting.currency)}
            </span>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
