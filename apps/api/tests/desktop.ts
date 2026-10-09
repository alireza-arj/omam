import { z } from "zod";
import { authMembershipSchema, authResponseSchema, inviteSchema, syncResponseSchema, payrollPeriodDetailSchema, type SyncSessionInputDto } from "@omam/contracts";

const base = process.env.SMOKE_API_URL ?? "http://localhost:3001";
async function request<T extends z.ZodType>(schema: T, path: string, token: string | undefined, body: unknown): Promise<z.output<T>> {
  const response = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
  return schema.parse(await response.json());
}
function check(label: string, valid: boolean) { if (!valid) throw new Error(label); console.log(`  ok    ${label}`); }
const owner = await request(authResponseSchema, "/auth/login", undefined, { username: "owner", password: "changeme123" });
const team = await request(authMembershipSchema, "/team/organizations", owner.token, { name: `Desktop ${Date.now()}`, calendar: "GREGORIAN", language: "en" });
await request(authMembershipSchema, "/team/select", owner.token, { organizationId: team.organizationId });
const invite = await request(inviteSchema, "/team/invites", owner.token, { role: "MEMBER", expiresInDays: 7 });
const username = `desktop_${Date.now().toString(36)}`;
const member = await request(authResponseSchema, "/auth/register", undefined, { username, password: "testpass123", nickname: "Desktop tester", inviteCode: invite.code });
const mac = await request(authResponseSchema, "/auth/login", undefined, { username, password: "testpass123" });
const sync = (token: string, sessions: SyncSessionInputDto[] = [], since: string | null = null) => request(syncResponseSchema, "/sync", token, { sessions, since });
const stamp = () => new Date().toISOString();
const phoneSession: SyncSessionInputDto = { clientId: "phone-session", deviceId: "phone", deviceName: "iPhone", source: "TIMER", category: "REMOTE", startAt: "2026-07-05T09:00:00.000Z", endAt: null, updatedAt: stamp() };
await sync(member.token, [phoneSession]);
const pulled = await sync(mac.token);
check("Mac receives the same running phone session and its origin", pulled.sessions.some((session) => session.clientId === phoneSession.clientId && session.deviceName === "iPhone" && session.status === "OPEN"));
const stopped = { ...phoneSession, endAt: "2026-07-05T17:00:00.000Z", updatedAt: stamp() };
await sync(mac.token, [stopped]);
const onPhone = await sync(member.token);
check("stopping on Mac completes the same session on the phone", onPhone.sessions.some((session) => session.clientId === phoneSession.clientId && session.status === "COMPLETED" && session.durationMinutes === 480));
await sync(mac.token, [stopped]);
check("repeated pushes do not duplicate the session", (await sync(member.token)).sessions.filter((session) => session.clientId === phoneSession.clientId).length === 1);
const competing: SyncSessionInputDto = { ...stopped, clientId: "mac-session", deviceId: "mac", deviceName: "Mac", startAt: "2026-07-05T09:10:00.000Z", updatedAt: stamp() };
const overlap = await sync(mac.token, [competing], onPhone.serverTime);
check("completed offline timers from different devices produce a choice", overlap.results[0]?.reason === "SESSION_CONFLICT" && overlap.conflicts?.[0]?.sessionIds.length === 1);
check("incremental sync includes the conflicting session even if it predates the cursor", overlap.sessions.some((session) => session.clientId === phoneSession.clientId));
const resolved = await sync(mac.token, [{ ...competing, updatedAt: stamp() }, { ...stopped, deletedAt: stamp(), updatedAt: stamp() }]);
check("a resolution deletes the loser before applying the chosen session", resolved.results.every((result) => result.outcome === "applied"));
const final = await sync(member.token);
check("both devices receive the winner and the loser's tombstone", final.sessions.some((session) => session.clientId === "phone-session" && !!session.deletedAt) && final.sessions.some((session) => session.clientId === "mac-session" && !session.deletedAt));
const concurrent = await Promise.all([
  sync(member.token, [{ ...phoneSession, clientId: "parallel-phone", startAt: "2026-07-06T09:00:00.000Z", updatedAt: stamp() }]),
  sync(mac.token, [{ ...competing, clientId: "parallel-mac", startAt: "2026-07-06T09:00:00.000Z", endAt: null, updatedAt: stamp() }]),
]);
check("concurrent device starts create one running session and one recoverable conflict", concurrent.flatMap((response) => response.results).filter((result) => result.outcome === "applied").length === 1 && concurrent.flatMap((response) => response.results).filter((result) => result.reason === "SESSION_CONFLICT").length === 1);
const manualRunning = await sync(mac.token, [{ ...phoneSession, clientId: "manual-running", deviceId: "third-device", source: "MANUAL", startAt: "2026-07-06T10:00:00.000Z", updatedAt: stamp() }]);
check("a manually created running session also offers a device conflict choice", manualRunning.results[0]?.reason === "SESSION_CONFLICT");
const payroll = await request(payrollPeriodDetailSchema, "/payroll/periods", owner.token, { month: "2026-07", calendar: "GREGORIAN" });
const locked = await fetch(base + `/payroll/periods/${payroll.period.id}`, { method: "PATCH", headers: { Authorization: `Bearer ${owner.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ status: "LOCKED" }) });
check("payroll month locks", locked.ok);
const refused = await sync(mac.token, [{ ...competing, deletedAt: stamp(), updatedAt: stamp() }]);
check("conflict resolution cannot delete a session in a locked payroll month", refused.results[0]?.reason === "PAYROLL_LOCKED");
console.log("Desktop cross-device smoke checks passed.");
