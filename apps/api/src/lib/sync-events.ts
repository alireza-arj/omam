import { Client } from "pg";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const CHANNEL = "omam_sync_changes";
const changeSchema = z.object({
  organizationId: z.string(),
  userId: z.string().optional(),
  exceptSessionId: z.string().optional(),
});
type SyncChange = z.infer<typeof changeSchema>;
const listeners = new Set<(change: SyncChange | null) => void>();
let connection: Promise<Client> | undefined;
let activeClient: Client | undefined;

async function listen() {
  if (!connection) {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    activeClient = client;
    const disconnected = () => {
      if (activeClient !== client) return;
      activeClient = undefined;
      connection = undefined;
      for (const listener of [...listeners]) listener(null);
      listeners.clear();
      void client.end().catch(() => undefined);
    };
    client.on("error", disconnected);
    client.on("end", disconnected);
    client.on("notification", (notification) => {
      if (notification.channel !== CHANNEL || !notification.payload) return;
      let payload: unknown;
      try { payload = JSON.parse(notification.payload); } catch { return; }
      const change = changeSchema.safeParse(payload);
      if (change.success) for (const listener of listeners) listener(change.data);
    });
    connection = (async () => {
      try {
        await client.connect();
        await client.query(`LISTEN ${CHANNEL}`);
        return client;
      } catch (cause) {
        disconnected();
        throw cause;
      }
    })();
  }
  await connection;
}

export async function subscribeSyncChanges(listener: (change: SyncChange | null) => void) {
  await listen();
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export async function publishSyncChange(change: SyncChange, client: Prisma.TransactionClient = prisma) {
  // PostgreSQL fans the hint out to every API replica. Session data still uses /sync.
  const payload = JSON.stringify(change);
  await client.$queryRaw`SELECT pg_notify(${CHANNEL}, ${payload})::text`;
}

export function withSyncChange<T>(change: SyncChange, operation: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    const result = await operation(tx);
    await publishSyncChange(change, tx);
    return result;
  });
}
