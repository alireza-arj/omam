import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { conflict } from "./errors";

export async function syncTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 }); }
    catch (cause) {
      const prismaConflict = cause instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(cause.code);
      const driverCause = cause instanceof Error ? cause.cause : undefined;
      const adapterConflict = typeof driverCause === "object" && driverCause !== null && "originalCode" in driverCause && ["40001", "23505"].includes(String(driverCause.originalCode));
      if (!prismaConflict && !adapterConflict) throw cause;
    }
  }
  throw conflict("Try syncing again.", "SYNC_BUSY");
}
