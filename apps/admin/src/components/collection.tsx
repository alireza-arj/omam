import type { ReactNode } from "react";
import { useT } from "../lib/i18n";
import { Button, Input } from "./ui";

export function CollectionToolbar({
  search,
  onSearch,
  children,
}: {
  search: string;
  onSearch: (value: string) => void;
  children?: ReactNode;
}) {
  const t = useT();
  return (
    <div className="collection-toolbar">
      <div className="collection-search">
        <Input
          type="search"
          maxLength={120}
          aria-label={t("admin.table.search")}
          placeholder={t("admin.table.search")}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>
      {children}
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  setPage,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  setPage: (page: number) => void;
}) {
  const t = useT();
  if (!total) return null;
  return (
    <div className="collection-footer">
      <span className="t-caption muted" role="status">
        {t("admin.table.range", {
          from: (page - 1) * pageSize + 1,
          to: Math.min(page * pageSize, total),
          total,
        })}
      </span>
      {pageCount > 1 ? (
        <nav className="row gap-4" aria-label={t("admin.table.pages")}>
          <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
            {t("admin.table.previous")}
          </Button>
          <span className="t-caption timecode muted">
            {page} / {pageCount}
          </span>
          <Button variant="ghost" size="sm" disabled={page === pageCount} onClick={() => setPage(page + 1)}>
            {t("admin.table.next")}
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
