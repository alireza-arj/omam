import { Elysia } from "elysia";
import { syncEventInputSchema } from "@omam/contracts";
import { authenticateByBearerToken, requireOrganization, type Principal } from "../lib/auth";
import { AppError, parseInput, unauthorized } from "../lib/errors";
import { subscribeSyncChanges } from "../lib/sync-events";

type Connection = {
  token: string | null;
  principal: Principal | null;
  unsubscribe?: () => void;
  timeout: ReturnType<typeof setTimeout>;
  busy: boolean;
};
const connections = new Map<string, Connection>();

export const syncEventRoutes = new Elysia({ prefix: "/sync" }).ws("/events", {
  maxPayloadLength: 4096,
  idleTimeout: 60,
  open(ws) {
    connections.set(ws.id, {
      token: null, principal: null, busy: false,
      timeout: setTimeout(() => ws.close(4401, "UNAUTHORIZED"), 10_000),
    });
  },
  async message(ws, body) {
    const connection = connections.get(ws.id);
    if (!connection || connection.busy) return;
    connection.busy = true;
    try {
      const input = parseInput(syncEventInputSchema, body);
      if (input.type === "authenticate") {
        if (connection.token) { ws.close(4400, "VALIDATION_FAILED"); return; }
        connection.token = input.token;
      }
      if (!connection.token) throw unauthorized();
      const principal = await authenticateByBearerToken(connection.token);
      if (!principal) throw unauthorized();
      const organization = requireOrganization(principal);
      if (connections.get(ws.id) !== connection) return;
      if (connection.principal && connection.principal.membership?.organizationId !== organization.id) {
        ws.close(4403, "TEAM_CHANGED");
        return;
      }
      connection.principal = principal;
      if (input.type === "authenticate") {
        const unsubscribe = await subscribeSyncChanges((change) => {
          if (!change) { ws.close(1012, "RECONNECT"); return; }
          if (change.organizationId === organization.id &&
              (!change.userId || change.userId === principal.user.id) &&
              change.exceptSessionId !== principal.sessionId) {
            ws.send({ type: "changed" });
          }
        });
        if (connections.get(ws.id) !== connection) { unsubscribe(); return; }
        connection.unsubscribe = unsubscribe;
        clearTimeout(connection.timeout);
        ws.send({ type: "ready" });
      } else {
        ws.send({ type: "pong" });
      }
    } catch (cause) {
      ws.close(cause instanceof AppError ? (cause.statusCode === 401 ? 4401 : 4403) : 1011,
        cause instanceof AppError ? cause.code : "INTERNAL_ERROR");
    } finally {
      connection.busy = false;
    }
  },
  close(ws) {
    const connection = connections.get(ws.id);
    if (!connection) return;
    clearTimeout(connection.timeout);
    connection.unsubscribe?.();
    connections.delete(ws.id);
  },
});
