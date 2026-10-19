import "../src/lib/load-env";
import { Client } from "pg";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");
const source = process.env.DATABASE_URL;
if (!source) throw new Error("DATABASE_URL is required for the isolated smoke database");
const database = `omam_desktop_${Date.now().toString(36)}`;
const testUrl = new URL(source);
testUrl.pathname = `/${database}`;
const admin = new Client({ connectionString: source });
await admin.connect();
await admin.query(`CREATE DATABASE "${database}"`);
const port = process.env.DESKTOP_SMOKE_PORT ?? "3332";
const replicaPort = process.env.SYNC_SMOKE_REPLICA_PORT ?? "3333";
const env = { ...process.env, DATABASE_URL: testUrl.toString(), PORT: port, HOST: "127.0.0.1", TZ: "Asia/Tehran", SMOKE_API_URL: `http://127.0.0.1:${port}`, SMOKE_REPLICA_URL: `http://127.0.0.1:${replicaPort}`, SEED_OWNER_USERNAME: "owner", SEED_OWNER_PASSWORD: "changeme123" };
let server: ReturnType<typeof Bun.spawn> | undefined;
let replica: ReturnType<typeof Bun.spawn> | undefined;
async function command(args: string[]) {
  const process = Bun.spawn(args, { cwd: root, env, stdout: "inherit", stderr: "inherit" });
  if (await process.exited !== 0) throw new Error(`Smoke command failed: ${args.join(" ")}`);
}
try {
  await command(["bun", "run", "--cwd", "apps/api", "db:deploy"]);
  await command(["bun", "run", "--cwd", "apps/api", "db:seed"]);
  server = Bun.spawn(["bun", "run", "apps/api/src/index.ts"], { cwd: root, env, stdout: "inherit", stderr: "inherit" });
  replica = Bun.spawn(["bun", "run", "apps/api/src/index.ts"], { cwd: root, env: { ...env, PORT: replicaPort }, stdout: "inherit", stderr: "inherit" });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { ready = (await fetch(env.SMOKE_API_URL + "/health")).ok && (await fetch(env.SMOKE_REPLICA_URL + "/health")).ok; } catch {}
    if (ready) break;
    if (server.exitCode !== null || replica.exitCode !== null) throw new Error("The isolated smoke API stopped");
    await Bun.sleep(100);
  }
  if (!ready) throw new Error("The isolated smoke API did not start");
  await command(["bun", "run", "test:smoke"]);
  await command(["bun", "test", "apps/api/tests/notifications.test.ts"]);
  await command(["bun", "test", "apps/api/tests/sync-events.test.ts"]);
} finally {
  server?.kill();
  replica?.kill();
  if (server) await server.exited;
  if (replica) await replica.exited;
  await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await admin.end();
}
