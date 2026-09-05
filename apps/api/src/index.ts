import "./lib/load-env";
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { networkInterfaces } from "node:os";
import { prisma } from "./lib/prisma";
import { errorHandler } from "./lib/context";
import { authRoutes } from "./routes/auth";
import { settingsRoutes } from "./routes/settings";
import { sessionRoutes } from "./routes/sessions";
import { teamRoutes } from "./routes/team";
import { projectRoutes } from "./routes/projects";
import { timesheetRoutes } from "./routes/timesheets";
import { reportRoutes } from "./routes/reports";
import { payrollRoutes } from "./routes/payroll";
import { syncRoutes } from "./routes/sync";

declare const Bun: {
  serve(options: {
    port: number;
    hostname: string;
    fetch: (request: Request) => Response | Promise<Response>;
  }): { port: number };
};

const port = Number(process.env.PORT ?? 3001);
const hostname = process.env.HOST?.trim() || "0.0.0.0";

/** `*` in development; a comma-separated allow-list once it is on a server. */
function resolveCorsOrigin() {
  const configured = process.env.CORS_ORIGINS?.trim();

  if (!configured || configured === "*") {
    return true;
  }

  const allowed = configured.split(",").map((entry) => entry.trim()).filter(Boolean);

  return (request: Request) => {
    const origin = request.headers.get("origin");

    return Boolean(origin && allowed.includes(origin));
  };
}

function resolveLanIp() {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }

  return null;
}

const app = new Elysia()
  .use(errorHandler)
  .use(
    cors({
      origin: resolveCorsOrigin(),
      allowedHeaders: ["Content-Type", "Authorization"],
      exposeHeaders: ["Content-Disposition"],
    }),
  )
  .get("/health", async () => {
    await prisma.$queryRaw`SELECT 1`;

    return { ok: true, service: "omam-api", time: new Date().toISOString() };
  })
  .use(authRoutes)
  .use(settingsRoutes)
  .use(sessionRoutes)
  .use(teamRoutes)
  .use(projectRoutes)
  .use(timesheetRoutes)
  .use(reportRoutes)
  .use(payrollRoutes)
  .use(syncRoutes);

const server = Bun.serve({ port, hostname, fetch: app.fetch });
const lanIp = resolveLanIp();

console.log(`API is running on http://${hostname}:${server.port} (TZ=${process.env.TZ ?? "system"})`);
console.log(`Local:   http://localhost:${server.port}`);

if (lanIp) {
  console.log(`Network: http://${lanIp}:${server.port}`);
}

export type App = typeof app;
