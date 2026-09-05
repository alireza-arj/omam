import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TimesheetEntryDto, WorkSessionStatus } from "@omam/contracts";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { translateError } from "@omam/i18n";
import { useLanguage } from "../lib/i18n";
import { useToast } from "../lib/ui";
import {
  currentMonth,
  displayName,
  formatDate,
  formatDuration,
  formatTime,
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
  Field,
  Loading,
  Modal,
  Select,
  StatusBadge,
  Textarea,
} from "../components/ui";

const STATUSES: (WorkSessionStatus | "ALL")[] = ["ALL", "PENDING", "APPROVED", "REJECTED", "OPEN"];

export function TimesheetsPage() {
  const { calendar } = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { language, t } = useLanguage();

  const [month, setMonth] = useState(() => currentMonth(calendar));
  const [status, setStatus] = useState<WorkSessionStatus | "ALL">("PENDING");
  const [userId, setUserId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<TimesheetEntryDto | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const members = useQuery({ queryKey: ["members"], queryFn: api.members });

  const timesheets = useQuery({
    queryKey: ["timesheets", month, calendar, status, userId],
    queryFn: () =>
      api.timesheets({
        month,
        calendar,
        ...(status === "ALL" ? {} : { status }),
        ...(userId ? { userId } : {}),
      }),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["timesheets"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["report"] });
    setSelected(new Set());
  }

  const review = useMutation({
    mutationFn: (input: { ids: string[]; action: "APPROVE" | "REJECT"; note?: string | null }) =>
      api.bulkReview({ sessionIds: input.ids, action: input.action, reviewNote: input.note ?? null }),
    onSuccess: (result, input) => {
      toast(
        t(
          input.action === "APPROVE"
            ? "admin.timesheets.approvedCount"
            : "admin.timesheets.rejectedCount",
          { count: result.updated },
        ),
        "success",
      );
      invalidate();
    },
    onError: (error) => toast(translateError(error, t), "error"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteTimesheet(id),
    onSuccess: () => {
      toast(t("admin.timesheets.deleted"), "success");
      invalidate();
    },
    onError: (error) => toast(translateError(error, t), "error"),
  });

  const entries = timesheets.data?.entries ?? [];

  /** Only closed entries can be reviewed, so a running timer never gets picked. */
  const selectableIds = useMemo(
    () => entries.filter((entry) => entry.endAt).map((entry) => entry.id),
    [entries],
  );

  const allSelected = selectableIds.length > 0 && selected.size === selectableIds.length;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  }

  return (
    <>
      <PageHeader
        title={t("admin.nav.timesheets")}
        subtitle={t("admin.timesheets.subtitle")}
        actions={<MonthPicker month={month} calendar={calendar} onChange={setMonth} />}
      />

      <div className="page-body">
        <Card>
          <div className="row gap-6 wrap">
            <Field label={t("admin.timesheets.status")}>
              <Select
                value={status}
                onChange={(event) => setStatus(event.target.value as WorkSessionStatus | "ALL")}
              >
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value === "ALL" ? t("admin.timesheets.all") : t(`status.${value}`)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t("admin.timesheets.member")}>
              <Select value={userId} onChange={(event) => setUserId(event.target.value)}>
                <option value="">{t("admin.timesheets.everyone")}</option>
                {(members.data?.members ?? []).map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {displayName(member)}
                  </option>
                ))}
              </Select>
            </Field>

            {timesheets.data ? (
              <div className="row gap-5" style={{ marginLeft: "auto" }}>
                <Badge tone="success">
                  {t("admin.timesheets.approvedTotal", {
                    value: formatDuration(timesheets.data.totals.approvedMinutes, language),
                  })}
                </Badge>
                <Badge tone="warning">
                  {t("admin.timesheets.pendingTotal", {
                    value: formatDuration(timesheets.data.totals.pendingMinutes, language),
                  })}
                </Badge>
              </div>
            ) : null}
          </div>
        </Card>

        <Card flush>
          <CardHeader
            title={t("admin.timesheets.entries", { count: entries.length })}
            subtitle={
              selected.size ? t("admin.timesheets.selected", { count: selected.size }) : undefined
            }
            actions={
              selected.size ? (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={review.isPending}
                    onClick={() => review.mutate({ ids: [...selected], action: "APPROVE" })}
                  >
                    {t("admin.timesheets.approveSelected")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => review.mutate({ ids: [...selected], action: "REJECT" })}
                  >
                    {t("admin.timesheets.rejectSelected")}
                  </Button>
                </>
              ) : null
            }
          />

          {timesheets.isPending ? <Loading /> : null}
          {timesheets.isError ? (
            <ErrorState
              message={translateError(timesheets.error, t)}
              onRetry={() => timesheets.refetch()}
            />
          ) : null}

          {timesheets.data && !entries.length ? (
            <EmptyState
              title={t("admin.timesheets.nothingHere")}
              hint={t("admin.timesheets.nothingHint")}
            />
          ) : null}

          {entries.length ? (
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th className="tight">
                      <input
                        type="checkbox"
                        aria-label={t("admin.timesheets.selectAll")}
                        checked={allSelected}
                        onChange={() =>
                          setSelected(allSelected ? new Set() : new Set(selectableIds))
                        }
                      />
                    </th>
                    <th>{t("admin.timesheets.member")}</th>
                    <th>{t("admin.timesheets.day")}</th>
                    <th>{t("admin.timesheets.hours")}</th>
                    <th className="num">{t("admin.timesheets.duration")}</th>
                    <th>{t("admin.timesheets.where")}</th>
                    <th>{t("admin.timesheets.project")}</th>
                    <th>{t("admin.timesheets.note")}</th>
                    <th>{t("admin.timesheets.status")}</th>
                    <th className="tight" />
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="tight">
                        <input
                          type="checkbox"
                          aria-label={t("admin.timesheets.select", { name: displayName(entry) })}
                          disabled={!entry.endAt}
                          checked={selected.has(entry.id)}
                          onChange={() => toggle(entry.id)}
                        />
                      </td>
                      <td>
                        <div className="row gap-5">
                          <Avatar name={displayName(entry)} src={entry.avatarUrl} size="sm" />
                          <Link to={`/members/${entry.userId}`}>{displayName(entry)}</Link>
                        </div>
                      </td>
                      <td className="muted">{formatDate(entry.startAt, calendar, language)}</td>
                      <td className="t-mono timecode muted">
                        {formatTime(entry.startAt)}
                        {entry.endAt ? ` – ${formatTime(entry.endAt)}` : ` – ${t("admin.timesheets.running")}`}
                      </td>
                      <td className="num t-mono">{formatDuration(entry.durationMinutes, language)}</td>
                      <td className="muted">{t(`category.${entry.category}`)}</td>
                      <td>
                        {entry.project ? (
                          <span className="row gap-3">
                            <span
                              className="dot"
                              style={{ color: entry.project.color }}
                              aria-hidden
                            />
                            {entry.project.name}
                          </span>
                        ) : (
                          <span className="faint">—</span>
                        )}
                      </td>
                      <td className="muted" style={{ maxWidth: 220 }}>
                        {entry.note ?? <span className="faint">—</span>}
                      </td>
                      <td>
                        <StatusBadge status={entry.status} />
                      </td>
                      <td className="tight">
                        <div className="row gap-3 end">
                          {entry.endAt && entry.status !== "APPROVED" ? (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() =>
                                review.mutate({ ids: [entry.id], action: "APPROVE" })
                              }
                            >
                              {t("admin.timesheets.approve")}
                            </Button>
                          ) : null}
                          {entry.endAt && entry.status !== "REJECTED" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setRejecting(entry);
                                setRejectNote("");
                              }}
                            >
                              {t("admin.timesheets.reject")}
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(t("admin.timesheets.confirmDelete"))) {
                                remove.mutate(entry.id);
                              }
                            }}
                          >
                            {t("common.delete")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
      </div>

      {rejecting ? (
        <Modal
          title={t("admin.timesheets.rejectTitle", { name: displayName(rejecting) })}
          onClose={() => setRejecting(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setRejecting(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="primary"
                loading={review.isPending}
                onClick={() => {
                  review.mutate({ ids: [rejecting.id], action: "REJECT", note: rejectNote || null });
                  setRejecting(null);
                }}
              >
                {t("admin.timesheets.rejectEntry")}
              </Button>
            </>
          }
        >
          <p className="t-body-sm muted">
            {t("admin.timesheets.rejectIntro")}
          </p>
          <Field label={t("admin.timesheets.reason")}>
            <Textarea
              value={rejectNote}
              onChange={(event) => setRejectNote(event.target.value)}
              placeholder={t("admin.timesheets.reasonPlaceholder")}
              maxLength={240}
            />
          </Field>
        </Modal>
      ) : null}
    </>
  );
}
