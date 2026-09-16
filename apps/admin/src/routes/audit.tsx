import { Card, EmptyState, ErrorState, Loading, Table, TableScroll } from "../components/ui";
import { Pagination } from "../components/collection";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { translateError } from "@omam/i18n";
import { useLanguage } from "../lib/i18n";

import { formatDate, formatTime } from "../lib/format";
import { auditAction, auditDetails } from "../lib/audit";
import { PageHeader } from "./layout";

const PAGE_SIZE = 50;

/** Rate changes and payroll locks are money decisions; this is the paper trail. */
export function AuditPage() {
  const { calendar } = useSession();
  const { language, t } = useLanguage();
  const [page, setPage] = useState(1);

  const audit = useQuery({
    queryKey: ["audit", page],
    queryFn: () => api.audit(page, PAGE_SIZE),
  });

  const pageCount = Math.max(1, Math.ceil((audit.data?.total ?? 0) / PAGE_SIZE));

  return (
    <>
      <PageHeader title={t("admin.nav.audit")} />

      <div className="page-body">
        <Card flush>
          {audit.isPending ? <Loading /> : null}
          {audit.isError ? (
            <ErrorState message={translateError(audit.error, t)} onRetry={() => audit.refetch()} />
          ) : null}

          {audit.data?.entries.length ? (
            <TableScroll>
              <Table>
                <Table.Content aria-label={t("common.records")} className="omam-data">
                  <Table.Header>
                    <Table.Column isRowHeader>{t("admin.audit.when")}</Table.Column>
                    <Table.Column>{t("admin.audit.who")}</Table.Column>
                    <Table.Column>{t("admin.audit.action")}</Table.Column>
                    <Table.Column>{t("admin.audit.details")}</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {audit.data.entries.map((entry) => (
                      <Table.Row id={entry.id} key={entry.id}>
                        <Table.Cell className="muted nowrap">
                          {formatDate(entry.createdAt, calendar, language)} · {formatTime(entry.createdAt)}
                        </Table.Cell>
                        <Table.Cell>
                          {entry.actorName ?? <span className="faint">{t("admin.audit.system")}</span>}
                        </Table.Cell>
                        <Table.Cell>{auditAction(entry.action, t)}</Table.Cell>
                        <Table.Cell className="t-caption">
                          <dl className="audit-details">
                            {auditDetails(entry.metadata, language, t).map((detail) => (
                              <div key={detail.key}>
                                <dt>{detail.label}:</dt>
                                <dd>
                                  <bdi>{detail.value}</bdi>
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table>
            </TableScroll>
          ) : audit.data ? (
            <EmptyState title={t("admin.audit.empty")} />
          ) : null}
          {audit.data ? (
            <Pagination
              page={page}
              pageCount={pageCount}
              pageSize={PAGE_SIZE}
              total={audit.data.total}
              setPage={setPage}
            />
          ) : null}
        </Card>
      </div>
    </>
  );
}
