import { strict as assert } from "node:assert";
import {
  authResponseSchema, authMembershipSchema, teamsResponseSchema, inviteSchema,
  sessionSchema, monthlyReportSchema, memberDetailReportSchema, syncResponseSchema,
  sessionsResponseSchema,
} from "@omam/contracts";
import type { z } from "zod";

const base = process.env.SMOKE_API_URL ?? "http://localhost:3001";
const run = Date.now().toString(36);
let checks = 0;
function check(label: string, condition: boolean) {
  assert.ok(condition, label);
  checks++;
  console.log(`  ok    ${label}`);
}
async function response(method: string, path: string, token?: string, body?: unknown) {
  return fetch(`${base}${path}`, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function request<S extends z.ZodType>(schema: S, method: string, path: string, token?: string, body?: unknown): Promise<z.infer<S>> {
  const res = await response(method, path, token, body);
  const json: unknown = await res.json();
  assert.equal(res.status, 200, `${method} ${path}: ${JSON.stringify(json)}`);
  return schema.parse(json);
}
const owner = await request(authResponseSchema, "POST", "/auth/login", undefined, { username: "owner", password: "changeme123" });
const otherDevice = await request(authResponseSchema, "POST", "/auth/login", undefined, { username: "owner", password: "changeme123" });
const a = await request(authMembershipSchema, "POST", "/team/organizations", owner.token, { name: `Team A ${run}`, calendar: "GREGORIAN", language: "en" });
const b = await request(authMembershipSchema, "POST", "/team/organizations", owner.token, { name: `Team B ${run}`, calendar: "GREGORIAN", language: "en" });
await request(authMembershipSchema, "POST", "/team/select", owner.token, { organizationId: a.organizationId });
const otherMe = await request(authResponseSchema.omit({ token: true }), "GET", "/auth/me", otherDevice.token);
check("team selection is scoped to a device token", otherMe.membership?.organizationId === otherDevice.membership?.organizationId);
const inviteA = await request(inviteSchema, "POST", "/team/invites", owner.token, { role: "MEMBER", expiresInDays: 7 });
const member = await request(authResponseSchema, "POST", "/auth/register", undefined, { username: `teams_${run}`, password: "testpass123", nickname: "Team tester", inviteCode: inviteA.code });
check("new member receives the invited team", member.membership?.organizationId === a.organizationId);
check("member cannot create teams", (await response("POST", "/team/organizations", member.token, { name: "Forbidden team" })).status === 403);
check("member cannot view manager reports", (await response("GET", "/reports/monthly", member.token)).status === 403);
const empty = await request(monthlyReportSchema, "GET", "/reports/monthly?month=2026-06&calendar=GREGORIAN", owner.token);
const boundary = Date.parse(empty.from);
const startAt = new Date(boundary - 60 * 60_000).toISOString();
const endAt = new Date(boundary + 120 * 60_000).toISOString();
const entry = await request(sessionSchema, "POST", "/sessions", member.token, { startAt, endAt, category: "REMOTE", note: "=not-a-formula" });
const report = await request(monthlyReportSchema, "GET", "/reports/monthly?month=2026-06&calendar=GREGORIAN", owner.token);
const row = report.rows.find((item) => item.userId === member.user.id);
check("monthly report clips the previous month's time", row?.completedMinutes === 120 && row.sessionCount === 1 && row.workedDays === 1);
const previous = await request(monthlyReportSchema, "GET", "/reports/monthly?month=2026-05&calendar=GREGORIAN", owner.token);
check("the previous month gets the remaining hour", previous.rows.find((item) => item.userId === member.user.id)?.completedMinutes === 60);
const detail = await request(memberDetailReportSchema, "GET", `/reports/members/${member.user.id}?month=2026-06&calendar=GREGORIAN`, owner.token);
check("member profile, sessions, and daily report agree", detail.member.completedMinutes === 120 && detail.profile.userId === member.user.id && detail.sessions.length === 1 && detail.days.reduce((sum, day) => sum + day.minutes, 0) === 120);
const csv = await response("GET", `/reports/members/${member.user.id}/export.csv?month=2026-06&calendar=GREGORIAN&language=fa`, owner.token);
const csvText = await csv.text();
check("Persian CSV exports exact minutes and escapes spreadsheet formulas", csv.status === 200 && csvText.includes('"120"') && csvText.includes("'=not-a-formula"));
const endEdited = new Date(boundary + 150 * 60_000).toISOString();
await request(sessionSchema, "PATCH", `/timesheets/${entry.id}`, owner.token, { startAt, endAt: endEdited, category: "ONSITE", note: "Manager edit" });
const pulled = await request(syncResponseSchema, "POST", "/sync", member.token, { since: null, sessions: [] });
check("manager edits reach web and native through sync", pulled.sessions.find((item) => item.id === entry.id)?.note === "Manager edit");
await request(authMembershipSchema, "POST", "/team/select", owner.token, { organizationId: b.organizationId });
const inviteB = await request(inviteSchema, "POST", "/team/invites", owner.token, { role: "MEMBER", expiresInDays: 7 });
const joined = await request(authMembershipSchema, "POST", "/team/join", member.token, { inviteCode: inviteB.code });
check("an existing account can join another team", joined.organizationId === b.organizationId);
const teams = await request(teamsResponseSchema, "GET", "/team/organizations", member.token);
check("both memberships share the same account", teams.memberships.length === 2);
await request(authMembershipSchema, "POST", "/team/select", member.token, { organizationId: b.organizationId });
const sessionsB = await request(sessionsResponseSchema, "GET", "/sessions", member.token);
check("selecting another team isolates sessions", sessionsB.sessions.length === 0);
check("cross-team edit is refused", (await response("PATCH", `/sessions/${entry.id}`, member.token, { startAt, endAt })).status === 404);
check("manager cannot delete another team's session", (await response("DELETE", `/timesheets/${entry.id}`, owner.token)).status === 404);
const foreign = await request(syncResponseSchema, "POST", "/sync", member.token, { sessions: [{ clientId: "foreign-placeholder", startAt, endAt, updatedAt: endAt }] });
check("new team time is attributed to the selected team", foreign.sessions[0]?.organizationId === b.organizationId);
await request(authMembershipSchema, "POST", "/team/select", member.token, { organizationId: a.organizationId });
const wrongTeam = await request(syncResponseSchema, "POST", "/sync", member.token, { sessions: [{ clientId: "foreign-placeholder", startAt, endAt, updatedAt: new Date().toISOString() }] });
check("a client id cannot migrate time between teams", wrongTeam.results[0]?.reason === "TEAM_MISMATCH");
await request(authMembershipSchema, "POST", "/team/select", owner.token, { organizationId: a.organizationId });
const syncEntry = await request(syncResponseSchema, "POST", "/sync", member.token, { sessions: [{ clientId: `delete-${run}`, startAt, endAt, updatedAt: new Date().toISOString() }] });
const synchronized = syncEntry.sessions.find((item) => item.clientId === `delete-${run}`)!;
assert.equal((await response("DELETE", `/timesheets/${synchronized.id}`, owner.token)).status, 200);
const resurrection = await request(syncResponseSchema, "POST", "/sync", member.token, { since: new Date(Date.now() + 60_000).toISOString(), sessions: [{ clientId: synchronized.clientId!, startAt, endAt, updatedAt: "2030-01-01T00:00:00.000Z" }] });
check("deleted sessions cannot be resurrected by offline clients", resurrection.results[0]?.reason === "SESSION_DELETED" && !!resurrection.sessions.find((item) => item.id === synchronized.id)?.deletedAt);
const reuse = await response("POST", "/team/join", member.token, { inviteCode: inviteB.code });
check("joining cannot reuse an accepted invite", reuse.status === 422);
console.log(`TEAM WORKFLOWS PASS (${checks} checks)`);
