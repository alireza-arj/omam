import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TimesheetEntryDto, WorkSessionStatus } from "@omam/contracts";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { errorMessage, useToast } from "../lib/ui";
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
        `${result.updated} ${result.updated === 1 ? "entry" : "entries"} ${
          input.action === "APPROVE" ? "approved" : "rejected"
        }.`,
        "success",
      );
      invalidate();
    },
    onError: (error) => toast(errorMessage(error), "error"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteTimesheet(id),
    onSuccess: () => {
      toast("Entry deleted.", "success");
      invalidate();
    },
    onError: (error) => toast(errorMessage(error), "error"),
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
        title="Timesheets"
        subtitle="Review the time your team submitted before it turns into payroll."
        actions={<MonthPicker month={month} calendar={calendar} onChange={setMonth} />}
      />

      <div className="page-body">
        <Card>
          <div className="row gap-6 wrap">
            <Field label="Status">
              <Select
                value={status}
                onChange={(event) => setStatus(event.target.value as WorkSessionStatus | "ALL")}
              >
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value === "ALL" ? "All" : value.charAt(0) + value.slice(1).toLowerCase()}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Member">
              <Select value={userId} onChange={(event) => setUserId(event.target.value)}>
                <option value="">Everyone</option>
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
                  Approved {formatDuration(timesheets.data.totals.approvedMinutes)}
                </Badge>
                <Badge tone="warning">
                  Pending {formatDuration(timesheets.data.totals.pendingMinutes)}
                </Badge>
              </div>
            ) : null}
          </div>
        </Card>

        <Card flush>
          <CardHeader
            title={`${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
            subtitle={selected.size ? `${selected.size} selected` : undefined}
            actions={
              selected.size ? (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={review.isPending}
                    onClick={() => review.mutate({ ids: [...selected], action: "APPROVE" })}
                  >
                    Approve selected
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => review.mutate({ ids: [...selected], action: "REJECT" })}
                  >
                    Reject selected
                  </Button>
                </>
              ) : null
            }
          />

          {timesheets.isPending ? <Loading /> : null}
          {timesheets.isError ? (
            <ErrorState
              message={errorMessage(timesheets.error)}
              onRetry={() => timesheets.refetch()}
            />
          ) : null}

          {timesheets.data && !entries.length ? (
            <EmptyState
              title="Nothing here"
              hint="No time matches this month and filter."
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
                        aria-label="Select every entry"
                        checked={allSelected}
                        onChange={() =>
                          setSelected(allSelected ? new Set() : new Set(selectableIds))
                        }
                      />
                    </th>
                    <th>Member</th>
                    <th>Day</th>
                    <th>Hours</th>
                    <th className="num">Duration</th>
                    <th>Where</th>
                    <th>Project</th>
                    <th>Note</th>
                    <th>Status</th>
                    <th className="tight" />
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="tight">
                        <input
                          type="checkbox"
                          aria-label={`Select ${displayName(entry)}`}
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
                      <td className="muted">{formatDate(entry.startAt, calendar)}</td>
                      <td className="t-mono muted">
                        {formatTime(entry.startAt)}
                        {entry.endAt ? ` – ${formatTime(entry.endAt)}` : " – running"}
                      </td>
                      <td className="num t-mono">{formatDuration(entry.durationMinutes)}</td>
                      <td className="muted">{entry.category === "REMOTE" ? "Remote" : "Onsite"}</td>
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
                              Approve
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
                              Reject
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm("Delete this entry? It will not count towards payroll.")) {
                                remove.mutate(entry.id);
                              }
                            }}
                          >
                            Delete
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
          title={`Reject ${displayName(rejecting)}'s entry`}
          onClose={() => setRejecting(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setRejecting(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={review.isPending}
                onClick={() => {
                  review.mutate({ ids: [rejecting.id], action: "REJECT", note: rejectNote || null });
                  setRejecting(null);
                }}
              >
                Reject entry
              </Button>
            </>
          }
        >
          <p className="t-body-sm muted">
            Rejected time is kept on the record but never counts towards pay. Say why, so the member
            can fix it.
          </p>
          <Field label="Reason">
            <Textarea
              value={rejectNote}
              onChange={(event) => setRejectNote(event.target.value)}
              placeholder="Overlaps an entry already submitted."
              maxLength={240}
            />
          </Field>
        </Modal>
      ) : null}
    </>
  );
}
