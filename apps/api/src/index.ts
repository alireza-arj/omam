import "./lib/load-env";
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { networkInterfaces } from "node:os";
import { authRoutes } from "./routes/auth";
import { settingsRoutes } from "./routes/settings";
import { sessionRoutes } from "./routes/sessions";

const port = Number(process.env.PORT ?? 3001);
const hostname = process.env.HOST?.trim() || "0.0.0.0";

function resolveLanIp() {
  const interfaces = networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }

  return null;
}

const app = new Elysia()
  .use(
    cors({
      origin: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  )
  .get("/health", () => ({
    ok: true,
  }))
  .use(authRoutes)
  .use(settingsRoutes)
  .use(sessionRoutes)
  .listen({
    port,
    hostname,
  });

const resolvedPort = app.server?.port ?? port;
const lanIp = resolveLanIp();

console.log(`API is running on http://${hostname}:${resolvedPort}`);
console.log(`Local:   http://localhost:${resolvedPort}`);

if (lanIp) {
  console.log(`Network: http://${lanIp}:${resolvedPort}`);
}
