import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { errorMessage } from "../lib/ui";
import { formatDate, formatTime } from "../lib/format";
import { PageHeader } from "./layout";
import { Button, Card, CardHeader, EmptyState, ErrorState, Loading } from "../components/ui";

const PAGE_SIZE = 50;

/** Rate changes and payroll locks are money decisions; this is the paper trail. */
export function AuditPage() {
  const { calendar } = useSession();
  const [page, setPage] = useState(1);

  const audit = useQuery({
    queryKey: ["audit", page],
    queryFn: () => api.audit(page, PAGE_SIZE),
  });

  const pageCount = Math.max(1, Math.ceil((audit.data?.total ?? 0) / PAGE_SIZE));

  return (
    <>
      <PageHeader title="Activity" subtitle="Every change a manager or owner made." />

      <div className="page-body">
        <Card flush>
          <CardHeader
            title={`${audit.data?.total ?? 0} entries`}
            actions={
              pageCount > 1 ? (
                <>
                  <Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    Newer
                  </Button>
                  <span className="t-caption muted">
                    {page} / {pageCount}
                  </span>
                  <Button size="sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
                    Older
                  </Button>
                </>
              ) : null
            }
          />

          {audit.isPending ? <Loading /> : null}
          {audit.isError ? (
            <ErrorState message={errorMessage(audit.error)} onRetry={() => audit.refetch()} />
          ) : null}

          {audit.data?.entries.length ? (
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Who</th>
                    <th>Action</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.data.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="muted" style={{ whiteSpace: "nowrap" }}>
                        {formatDate(entry.createdAt, calendar)} · {formatTime(entry.createdAt)}
                      </td>
                      <td>{entry.actorName ?? <span className="faint">system</span>}</td>
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
            <EmptyState title="Nothing recorded yet" />
          ) : null}
        </Card>
      </div>
    </>
  );
}
