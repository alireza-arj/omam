import { useMemo, useState } from "react";

export const PAGE_SIZE = 25;

export function searchText(value: string) {
  return value.normalize("NFKC").replace(/ي/g, "ی").replace(/ك/g, "ک").toLocaleLowerCase().trim();
}

export function pageSlice<T>(rows: readonly T[], requestedPage: number, pageSize = PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.max(1, Math.min(requestedPage, pageCount));
  return {
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageCount,
    total: rows.length,
    pageSize,
  };
}

export function useCollection<T>(rows: readonly T[], text: (row: T) => string, scope = "") {
  const [search, setSearchValue] = useState("");
  const [pagination, setPagination] = useState({ scope, search, page: 1 });
  const filtered = useMemo(() => {
    const query = searchText(search);
    return query ? rows.filter((row) => searchText(text(row)).includes(query)) : rows;
  }, [rows, text, search]);
  const requestedPage = pagination.scope === scope && pagination.search === search ? pagination.page : 1;
  const result = pageSlice(filtered, requestedPage);
  return {
    ...result,
    search,
    setSearch: setSearchValue,
    setPage: (page: number) => setPagination({ scope, search, page }),
  };
}
