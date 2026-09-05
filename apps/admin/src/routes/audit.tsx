import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { translateError } from "@omam/i18n";
import { useLanguage } from "../lib/i18n";

import { formatDate, formatTime } from "../lib/format";
import { PageHeader } from "./layout";
import { Button, Card, CardHeader, EmptyState, ErrorState, Loading } from "../components/ui";

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
      <PageHeader title={t("admin.nav.audit")} subtitle={t("admin.audit.subtitle")} />

      <div className="page-body">
        <Card flush>
          <CardHeader
            title={t("admin.audit.count", { count: audit.data?.total ?? 0 })}
            actions={
              pageCount > 1 ? (
                <>
                  <Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    {t("admin.audit.newer")}
                  </Button>
                  <span className="t-caption muted">
                    {page} / {pageCount}
                  </span>
                  <Button size="sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
                    {t("admin.audit.older")}
                  </Button>
                </>
              ) : null
            }
          />

          {audit.isPending ? <Loading /> : null}
          {audit.isError ? (
            <ErrorState message={translateError(audit.error, t)} onRetry={() => audit.refetch()} />
          ) : null}

          {audit.data?.entries.length ? (
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t("admin.audit.when")}</th>
                    <th>{t("admin.audit.who")}</th>
                    <th>{t("admin.audit.action")}</th>
                    <th>{t("admin.audit.details")}</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.data.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="muted" style={{ whiteSpace: "nowrap" }}>
                        {formatDate(entry.createdAt, calendar, language)} · {formatTime(entry.createdAt)}
                      </td>
                      <td>{entry.actorName ?? <span className="faint">{t("admin.audit.system")}</span>}</td>
                      <td>
                        <span className="code">{entry.action}</span>
                      </td>
                      <td className="t-caption muted" style={{ maxWidth: 420 }}>
                        {entry.metadata && Object.keys(entry.metadata as object).length
                          ? JSON.stringify(entry.metadata)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : audit.data ? (
            <EmptyState title={t("admin.audit.empty")} />
          ) : null}
        </Card>
      </div>
    </>
  );
}
