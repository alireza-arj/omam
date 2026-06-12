import "./load-env";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";

const createPrismaClient = () => {
  const adapter = new PrismaLibSql({
    url: databaseUrl,
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
