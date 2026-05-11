const PRISMA_POSTGRES_QUERY_PARAMS = new Set([
  "application_name",
  "channel_binding",
  "connect_timeout",
  "connection_limit",
  "host",
  "options",
  "pgbouncer",
  "pool_timeout",
  "schema",
  "socket_timeout",
  "sslaccept",
  "sslcert",
  "sslidentity",
  "sslmode",
  "sslpassword",
  "sslrootcert",
  "statement_cache_size",
]);

export const normalizeDatabaseUrl = (databaseUrl: string) => {
  const url = new URL(databaseUrl);

  if (url.protocol === "postgres:") {
    url.protocol = "postgresql:";
  }

  if (url.protocol === "postgresql:") {
    for (const key of [...url.searchParams.keys()]) {
      if (!PRISMA_POSTGRES_QUERY_PARAMS.has(key)) {
        url.searchParams.delete(key);
      }
    }
  }

  return url.toString();
};
