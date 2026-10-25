import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { translateError } from "@omam/i18n";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Loading, RoleBadge, Table, TableScroll } from "../components/ui";
import { CollectionToolbar, Pagination } from "../components/collection";
import { PAGE_SIZE } from "../lib/collection";
import { api } from "../lib/api";
import { displayName, formatDateTime } from "../lib/format";
import { useLanguage } from "../lib/i18n";
import { useSession } from "../lib/session";
import { PageHeader } from "./layout";

export function UsersPage() {
  const { user, calendar } = useSession();
  const { t, language } = useLanguage();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState({ search: "", page: 1, pageSize: PAGE_SIZE });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery({ search: search.trim(), page: 1, pageSize: PAGE_SIZE });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const users = useQuery({
    queryKey: ["users", query],
    queryFn: () => api.users(query),
    enabled: Boolean(user?.isSuperAdmin),
  });

  if (!user?.isSuperAdmin) return <Navigate to="/" replace />;

  const data = users.data;

  return <>
    <PageHeader
      title={t("users.title")}
      subtitle={t("users.hint")}
      eyebrow={t("users.scope")}
      actions={<Button onClick={() => void users.refetch()} loading={users.isFetching}>{t("users.refresh")}</Button>}
    />
    <div className="page-body">
      <Card flush>
        <CollectionToolbar search={search} onSearch={setSearch} />
        {users.isPending ? <Loading /> : null}
        {users.isError ? <ErrorState message={translateError(users.error, t)} onRetry={() => users.refetch()} /> : null}
        {data && !users.isError ? <>
          {data.total ? <TableScroll>
            <Table>
              <Table.Content aria-label={t("users.title")} className="omam-data">
                <Table.Header>
                  <Table.Column isRowHeader>{t("users.name")}</Table.Column>
                  <Table.Column>{t("workspace.email")}</Table.Column>
                  <Table.Column>{t("workspace.teams")}</Table.Column>
                  <Table.Column>{t("users.createdAt")}</Table.Column>
                  <Table.Column>{t("workspace.lastLogin")}</Table.Column>
                </Table.Header>
                <Table.Body>
                  {data.users.map((entry) => <Table.Row id={entry.id} key={entry.id}>
                    <Table.Cell>
                      <div className="row gap-5">
                        <Avatar name={displayName(entry)} src={entry.avatarUrl} size="sm" />
                        <div className="stack gap-3">
                          <span>{displayName(entry)}</span>
                          <bdi className="t-caption faint">@{entry.username}</bdi>
                          {entry.isSuperAdmin ? <Badge>{t("users.superAdmin")}</Badge> : null}
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="nowrap"><bdi>{entry.email ?? t("workspace.noEmail")}</bdi></Table.Cell>
                    <Table.Cell>
                      <div className="stack gap-5">
                        {entry.memberships.length ? entry.memberships.map((team) => <div key={team.id} className="row gap-4 wrap">
                          <span className="nowrap">{team.organizationName}</span>
                          <RoleBadge role={team.role} />
                          {team.status === "SUSPENDED" ? <Badge>{t("admin.members.suspended")}</Badge> : null}
                        </div>) : <span className="muted">{t("users.noTeam")}</span>}
                      </div>
                    </Table.Cell>
                    <Table.Cell className="t-mono timecode muted">{formatDateTime(entry.createdAt, calendar, language)}</Table.Cell>
                    <Table.Cell className="t-mono timecode muted">{entry.lastLoginAt ? formatDateTime(entry.lastLoginAt, calendar, language) : t("workspace.noLogin")}</Table.Cell>
                  </Table.Row>)}
                </Table.Body>
              </Table.Content>
            </Table>
          </TableScroll> : <EmptyState title={t(query.search ? "admin.table.noResults" : "users.empty")} hint={query.search ? t("admin.table.searchHint") : undefined} />}
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} pageCount={Math.max(1, Math.ceil(data.total / data.pageSize))} setPage={(page) => setQuery((current) => ({ ...current, page }))} />
        </> : null}
      </Card>
    </div>
  </>;
}
