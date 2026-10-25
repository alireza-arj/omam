import { strict as assert } from "node:assert";
import { isDeepStrictEqual } from "node:util";
import { authResponseSchema, usersResponseSchema } from "@omam/contracts";
import { hashPassword } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";

const base = process.env.SMOKE_API_URL ?? "http://localhost:3001";
const run = Date.now().toString(36);
const password = "directorypass123";
let checks = 0;
let systemAdminId: string | null = null;

function check(label: string, condition: boolean) {
  assert.ok(condition, label);
  checks++;
  console.log(`  ok    ${label}`);
}

function get(path: string, token?: string) {
  return fetch(`${base}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
}

async function login(username: string) {
  const response = await fetch(`${base}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(response.status, 200);
  return authResponseSchema.parse(await response.json());
}

async function directory(token: string, query = "") {
  const response = await get(`/users${query}`, token);
  assert.equal(response.status, 200);
  const raw: unknown = await response.json();
  const parsed = usersResponseSchema.parse(raw);
  check("directory responses contain only public account fields", isDeepStrictEqual(raw, parsed));
  return parsed;
}

try {
  const passwordHash = await hashPassword(password);
  const admin = await prisma.user.create({ data: { username: `sys_${run}`, passwordHash, isSuperAdmin: true } });
  systemAdminId = admin.id;
  const unattached = await prisma.user.create({ data: {
    username: `solo_${run}`, passwordHash, nickname: `Directory name ${run}`, email: `solo_${run}@example.com`,
  } });
  const firstTeam = await prisma.organization.create({ data: { name: `Directory A ${run}`, slug: `dir-a-${run}` } });
  const secondTeam = await prisma.organization.create({ data: { name: `Directory B ${run}`, slug: `dir-b-${run}` } });
  const multi = await prisma.user.create({ data: {
    username: `multi_${run}`, passwordHash,
    memberships: { create: [
      { organizationId: firstTeam.id, role: "MEMBER" },
      { organizationId: secondTeam.id, role: "MEMBER", status: "SUSPENDED" },
    ] },
  } });
  await prisma.user.createMany({ data: Array.from({ length: 27 }, (_, index) => ({
    username: `page_${run}_${index}`, passwordHash,
  })) });

  const adminLogin = await login(admin.username);
  check("a system administrator can sign in without a team", adminLogin.user.isSuperAdmin && adminLogin.membership === null);
  check("anonymous requests cannot list users", (await get("/users")).status === 401);
  check("an ordinary account without a team cannot list users", (await get("/users", (await login(unattached.username)).token)).status === 403);

  for (const role of ["OWNER", "MANAGER", "MEMBER"] as const) {
    const account = await prisma.user.create({ data: {
      username: `dir_${role.toLowerCase()}_${run}`, passwordHash,
      memberships: { create: { organizationId: firstTeam.id, role } },
    } });
    check(`${role} cannot read the global directory`, (await get("/users", (await login(account.username)).token)).status === 403);
  }

  const all = await directory(adminLogin.token);
  check("the directory total counts every account across teams", all.total === await prisma.user.count());
  check("the directory is paginated", all.users.length === 25 && all.pageSize === 25);
  const ids = new Set<string>();
  for (let page = 1; page <= Math.ceil(all.total / all.pageSize); page++) {
    for (const user of (await directory(adminLogin.token, `?page=${page}`)).users) {
      check("pagination never repeats an account", !ids.has(user.id));
      ids.add(user.id);
    }
  }
  check("every account is reachable through pagination", ids.size === all.total && ids.has(unattached.id) && ids.has(multi.id));

  const byTeam = await directory(adminLogin.token, `?search=${encodeURIComponent(secondTeam.name.toUpperCase())}`);
  check("team search includes suspended memberships and deduplicates users", byTeam.total === 1 && byTeam.users[0]?.id === multi.id && byTeam.users[0].memberships.length === 2);
  for (const search of [unattached.username.toUpperCase(), unattached.nickname!, unattached.email!]) {
    const result = await directory(adminLogin.token, `?search=${encodeURIComponent(search)}`);
    check("account search finds users without teams", result.total === 1 && result.users[0]?.id === unattached.id && result.users[0].memberships.length === 0);
  }
  const empty = await directory(adminLogin.token, `?search=missing_${run}`);
  check("an empty search result is valid", empty.total === 0 && empty.users.length === 0 && empty.page === 1);
  const last = await directory(adminLogin.token, "?page=1000000&pageSize=100");
  check("out-of-range pages are clamped", last.page === Math.max(1, Math.ceil(last.total / 100)) && last.users.length > 0);
  for (const query of ["page=0", "page=no", "pageSize=101", "pageSize=-1", `search=${"x".repeat(121)}`]) {
    check("invalid directory queries are rejected", (await get(`/users?${query}`, adminLogin.token)).status === 422);
  }
  console.log(`USER DIRECTORY PASS (${checks} checks)`);
} finally {
  if (systemAdminId) await prisma.user.deleteMany({ where: { id: systemAdminId } });
  await prisma.$disconnect();
}
