import "./load-env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { normalizeDatabaseUrl } from "./database-url";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set.");
}

const createPrismaClient = () => {
  const adapter = new PrismaPg({
    connectionString: normalizeDatabaseUrl(databaseUrl),
  });

  return new PrismaClient({
    adapter,
    log: ["warn", "error"],
  });
};

export const prisma =
  globalThis.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}
