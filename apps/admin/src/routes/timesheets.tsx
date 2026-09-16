import {
  ActionMenu,
  Avatar,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Select,
  StatusBadge,
  Table,
  TableScroll,
} from "../components/ui";
import { CollectionToolbar, Pagination } from "../components/collection";
import { PAGE_SIZE } from "../lib/collection";
import { useSearchParams } from "react-router-dom";
import { useReportMonth, reportLink } from "../lib/report-month";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WorkSessionStatus } from "@omam/contracts";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { translateError } from "@omam/i18n";
import { useLanguage } from "../lib/i18n";
import { useToast } from "../lib/ui";
import { displayName, formatDate, formatDuration, formatTime } from "../lib/format";
import { PageHeader } from "./layout";
import { MonthPicker } from "../components/controls";

const STATUSES: (WorkSessionStatus | "ALL")[] = ["ALL", "COMPLETED", "OPEN"];

export function TimesheetsPage() {
  const { calendar } = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { language, t } = useLanguage();

  const [month, setMonth] = useReportMonth(calendar);
  const [status, setStatus] = useState<WorkSessionStatus | "ALL">("ALL");
  const [params, setParams] = useSearchParams();
  const userId = params.get("userId") ?? "";
  const setUserId = (value: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set("userId", value);
      else next.delete("userId");
      return next;
    });
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [requestedPage, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const members = useQuery({ queryKey: ["members"], queryFn: api.members });

  const timesheets = useQuery({
    queryKey: ["timesheets", month, calendar, status, userId, query, requestedPage],
    queryFn: () =>
      api.timesheets({
        month,
        calendar,
        search: query,
        page: requestedPage,
        pageSize: PAGE_SIZE,
        ...(status === "ALL" ? {} : { status }),
        ...(userId ? { userId } : {}),
      }),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["timesheets"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["report"] });
    queryClient.invalidateQueries({ queryKey: ["member-report"] });
  }

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteTimesheet(id),
    onSuccess: () => {
      toast(t("admin.timesheets.deleted"), "success");
      invalidate();
    },
    onError: (error) => toast(translateError(error, t), "error"),
  });

  const entries = timesheets.data?.entries ?? [];
  const collection = {
    search,
    setSearch,
    rows: entries,
    total: timesheets.data?.total ?? 0,
    page: timesheets.data?.page ?? 1,
    pageSize: PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil((timesheets.data?.total ?? 0) / PAGE_SIZE)),
    setPage: (page: number) => {
      setPage(page);
    },
  };

  return (
    <>
      <PageHeader
        title={t("admin.nav.timesheets")}
        actions={
          <MonthPicker
            month={month}
            calendar={calendar}
            onChange={(next) => {
              setMonth(next);
              setPage(1);
            }}
          />
        }
      />

      <div className="page-body">
        <Card flush>
          <CollectionToolbar
            search={collection.search}
            onSearch={(value) => {
              collection.setSearch(value);
            }}
          >
            <div className="filter-bar">
              <Field label={t("admin.timesheets.status")}>
                <Select
                  value={status}
                  onValueChange={(value) => {
                    setStatus(value as WorkSessionStatus | "ALL");
                    setPage(1);
                  }}
                >
                  {STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {value === "ALL" ? t("admin.timesheets.all") : t(`status.${value}`)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t("admin.timesheets.member")}>
                <Select
                  value={userId}
                  onValueChange={(value) => {
                    setUserId(value);
                    setPage(1);
                  }}
                >
                  <option value="">{t("admin.timesheets.everyone")}</option>
                  {(members.data?.members ?? []).map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {displayName(member)}
                    </option>
                  ))}
                </Select>
              </Field>

              {timesheets.data ? (
                <div className="filter-summary">
                  <span className="t-caption muted">
                    {t("admin.timesheets.completedTotal", {
                      value: formatDuration(timesheets.data.totals.completedMinutes, language),
                    })}
                  </span>
                </div>
              ) : null}
            </div>
          </CollectionToolbar>
          {collection.search && !collection.total && timesheets.data ? (
            <EmptyState title={t("admin.table.noResults")} hint={t("admin.table.searchHint")} />
          ) : null}

          {timesheets.isPending ? <Loading /> : null}
          {timesheets.isError ? (
            <ErrorState message={translateError(timesheets.error, t)} onRetry={() => timesheets.refetch()} />
          ) : null}

          {timesheets.data && !entries.length && !collection.search ? (
            <EmptyState title={t("admin.timesheets.nothingHere")} hint={t("admin.timesheets.nothingHint")} />
          ) : null}

          {entries.length ? (
            <TableScroll>
              <Table>
                <Table.Content aria-label={t("common.records")} className="omam-data">
                  <Table.Header>
                    <Table.Column isRowHeader>{t("admin.timesheets.member")}</Table.Column>
                    <Table.Column>{t("admin.timesheets.day")}</Table.Column>
                    <Table.Column className="num">{t("admin.timesheets.duration")}</Table.Column>
                    <Table.Column>{t("admin.timesheets.project")}</Table.Column>
                    <Table.Column>{t("admin.timesheets.note")}</Table.Column>
                    <Table.Column>{t("admin.timesheets.status")}</Table.Column>
                    <Table.Column className="tight" />
                  </Table.Header>
                  <Table.Body>
                    {collection.rows.map((entry) => (
                      <Table.Row id={entry.id} key={entry.id}>
                        <Table.Cell>
                          <div className="row gap-5">
                            <Avatar name={displayName(entry)} src={entry.avatarUrl} size="sm" />
                            <Link to={reportLink(`/members/${entry.userId}`, month, calendar)}>
                              {displayName(entry)}
                            </Link>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="stack gap-2">
                            <span>{formatDate(entry.startAt, calendar, language)}</span>
                            <span className="t-caption timecode muted">
                              {formatTime(entry.startAt)}
                              {entry.endAt
                                ? ` – ${formatTime(entry.endAt)}`
                                : ` – ${t("admin.timesheets.running")}`}
                            </span>
                          </div>
                        </Table.Cell>
                        <Table.Cell className="num t-mono">
                          {formatDuration(entry.durationMinutes, language)}
                        </Table.Cell>
                        <Table.Cell>
                          <div className="stack gap-2">
                            {entry.project ? (
                              <span className="row gap-3">
                                <span className="dot" style={{ color: entry.project.color }} aria-hidden />
                                {entry.project.name}
                              </span>
                            ) : (
                              <span className="faint">—</span>
                            )}
                            <span className="t-caption muted">{t(`category.${entry.category}`)}</span>
                          </div>
                        </Table.Cell>
                        <Table.Cell className="muted note-column">
                          {entry.note ?? <span className="faint">—</span>}
                        </Table.Cell>
                        <Table.Cell>
                          <StatusBadge status={entry.status} />
                        </Table.Cell>
                        <Table.Cell className="tight">
                          <ActionMenu
                            label={t("admin.table.actionsFor", { name: displayName(entry) })}
                            disabled={remove.isPending}
                            items={[
                              {
                                label: t("common.delete"),
                                onAction: () => {
                                  if (confirm(t("admin.timesheets.confirmDelete"))) remove.mutate(entry.id);
                                },
                              },
                            ]}
                          />
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table>
            </TableScroll>
          ) : null}
          <Pagination {...collection} />
        </Card>
      </div>

    </>
  );
}
