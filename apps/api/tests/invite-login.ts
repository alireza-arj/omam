import "../src/lib/load-env";
import { strict as assert } from "node:assert";
import { authResponseSchema, authMembershipSchema, inviteSchema, memberSchema, usernameSchema } from "@omam/contracts";
import type { z } from "zod";
import { prisma } from "../src/lib/prisma";

const base = process.env.SMOKE_API_URL ?? "http://localhost:3001";
const run = Date.now().toString(36);
let checks = 0;
function check(label: string, condition: boolean) {
  assert.ok(condition, label);
  checks++;
  console.log(`  ok    ${label}`);
}
async function response(path: string, body: unknown, token?: string, method = "POST") {
  return fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
}
async function request<S extends z.ZodType>(schema: S, path: string, body: unknown, token?: string): Promise<z.infer<S>> {
  const res = await response(path, body, token);
  const json: unknown = await res.json();
  assert.equal(res.status, 200, `${path}: ${JSON.stringify(json)}`);
  return schema.parse(json);
}

try {
  for (let code = 33; code <= 126; code++) assert.ok(usernameSchema.safeParse(`u${String.fromCharCode(code)}r`).success);
  check("all printable keyboard symbols are valid in usernames", true);
  check("spaces and control characters are rejected", !usernameSchema.safeParse("first last").success && !usernameSchema.safeParse("a\nb").success);
  const personal = await request(authResponseSchema, "/auth/register", { username: `solo+${run}@!`, password: "personal123" });
  check("personal registration needs only username and password", personal.membership === null && !personal.needsProfileSetup && personal.user.nickname === null);
  const personalLogin = await request(authResponseSchema, "/auth/login", { username: personal.user.username.toUpperCase(), password: "personal123" });
  check("symbol usernames sign in case-insensitively", personalLogin.user.id === personal.user.id);

  const owner = await request(authResponseSchema, "/auth/login", { username: "owner", password: "changeme123" });
  const team = await request(authMembershipSchema, "/team/organizations", { name: `Invite login ${run}` }, owner.token);
  await request(authMembershipSchema, "/team/select", { organizationId: team.organizationId }, owner.token);
  const member = await request(memberSchema, "/team/members", { organizationId: team.organizationId, username: `team+${run}@!`, password: "member123" }, owner.token);
  const issue = () => request(inviteSchema, "/team/invites", { userId: member.userId, expiresInDays: 7 }, owner.token);
  const invite = await issue();
  const login = await request(authResponseSchema, "/auth/invite-login", { inviteCode: invite.code.toLowerCase().replace("-", "") });
  check("code alone opens the exact account created in the panel", login.user.id === member.userId && login.membership?.organizationId === team.organizationId && !login.needsProfileSetup);
  check("an invitation does not change payroll settings", login.membership?.hourlyRate === member.hourlyRate && login.membership?.role === member.role);
  check("a consumed code cannot sign in again", (await response("/auth/invite-login", { inviteCode: invite.code })).status === 422);
  check("a member cannot issue account login codes", (await response("/team/invites", { userId: member.userId }, login.token)).status === 403);
  check("a recipient outside the selected team is refused", (await response("/team/invites", { userId: personal.user.id }, owner.token)).status === 404);
  const claimed = await prisma.invite.findUniqueOrThrow({ where: { id: invite.id } });
  check("redemption is attributed to the intended user", claimed.acceptedById === member.userId && claimed.acceptedAt !== null);

  const reserved = await issue();
  check("targeted codes cannot register a different account", (await response("/auth/register", { username: `impostor_${run}`, password: "other123", inviteCode: reserved.code })).status === 422);
  check("targeted codes cannot attach to another signed-in account", (await response("/team/join", { inviteCode: reserved.code }, personal.token)).status === 422);
  check("the failed attempts leave the intended code usable", (await response("/auth/invite-login", { inviteCode: reserved.code })).status === 200);
  const revoked = await issue();
  await fetch(`${base}/team/invites/${revoked.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${owner.token}` } });
  check("revoked codes are refused", (await response("/auth/invite-login", { inviteCode: revoked.code })).status === 422);
  const expired = await issue();
  await prisma.invite.update({ where: { id: expired.id }, data: { expiresAt: new Date(0) } });
  check("expired codes are refused", (await response("/auth/invite-login", { inviteCode: expired.code })).status === 422);
  const suspended = await issue();
  await prisma.membership.update({ where: { id: member.membershipId }, data: { status: "SUSPENDED" } });
  check("codes for suspended memberships are refused", (await response("/auth/invite-login", { inviteCode: suspended.code })).status === 422);
  await prisma.membership.update({ where: { id: member.membershipId }, data: { status: "ACTIVE" } });
  const raced = await issue();
  const responses = await Promise.all([response("/auth/invite-login", { inviteCode: raced.code }), response("/auth/invite-login", { inviteCode: raced.code })]);
  check("concurrent redemption creates exactly one login", responses.filter((res) => res.status === 200).length === 1 && responses.filter((res) => res.status === 422).length === 1);
  check("invalid codes are refused", (await response("/auth/invite-login", { inviteCode: "ZZZZZZZZ" })).status === 422);
  console.log(`INVITE LOGIN PASS (${checks} checks)`);
} finally {
  await prisma.$disconnect();
}
