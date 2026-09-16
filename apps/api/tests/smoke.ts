/**
 * Drives the whole product against a running API: sign in, invite, track time,
 * report on it, run payroll, lock the month, and sync an offline
 * device through all of it.
 *
 * Every run makes its own member and project, and hands back the month it
 * locked, so it can be run repeatedly against the same development database.
 */
const BASE = process.env.SMOKE_API_URL ?? "http://localhost:3001";
let failures = 0;

/** Keeps each run's fixtures distinct so the test can be run again. */
const RUN = Date.now().toString(36);
const DEV_USERNAME = `dev_${RUN}`;

async function call(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; query?: string } = {},
) {
  const res = await fetch(`${BASE}${path}${opts.query ?? ""}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json, text };
}

function check(label: string, ok: boolean, detail?: unknown) {
  if (!ok) { failures += 1; console.log(`  FAIL  ${label}`, detail ?? ""); }
  else console.log(`  ok    ${label}`);
}

const owner = await call("POST", "/auth/login", { body: { username: "owner", password: "changeme123" } });
check("owner login", owner.status === 200 && !!owner.json.token, owner.json);
const ownerToken = owner.json.token;
check("owner is OWNER", owner.json.membership?.role === "OWNER", owner.json.membership);

check("bad password rejected", (await call("POST", "/auth/login", { body: { username: "owner", password: "wrongpass" } })).status === 401);
check("no token is 401", (await call("GET", "/team/members")).status === 401);

const invite = await call("POST", "/team/invites", { token: ownerToken, body: { role: "MEMBER", label: "Backend dev", hourlyRate: 850000, expiresInDays: 7 } });
check("invite created", invite.status === 200 && !!invite.json.code, invite.json);

const dev = await call("POST", "/auth/register", { body: { username: DEV_USERNAME, password: "devpass123", inviteCode: invite.json.code, nickname: "Sara" } });
check("member registered", dev.status === 200 && dev.json.membership?.role === "MEMBER", dev.json);
const devToken = dev.json.token;

check("invite cannot be reused", (await call("POST", "/auth/register", { body: { username: `other_${RUN}`, password: "devpass123", inviteCode: invite.json.code } })).status === 422);
check("member cannot list team", (await call("GET", "/team/members", { token: devToken })).status === 403);

const project = await call("POST", "/projects", { token: ownerToken, body: { name: `Omam API ${RUN}`, color: "#B4213C" } });
check("project created", project.status === 200, project.json);

const day = (offset: number, hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const manual = await call("POST", "/sessions", { token: devToken, body: { startAt: day(2, 9), endAt: day(2, 17), category: "ONSITE", projectId: project.json.id, note: "Auth routes" } });
check("manual session 8h", manual.status === 200 && manual.json.durationMinutes === 480, manual.json);
check("manual session is COMPLETED", manual.json.status === "COMPLETED", manual.json.status);

const manual2 = await call("POST", "/sessions", { token: devToken, body: { startAt: day(1, 10), endAt: day(1, 15), category: "REMOTE" } });
check("second session 5h", manual2.json?.durationMinutes === 300, manual2.json);

check("end before start rejected", (await call("POST", "/sessions", { token: devToken, body: { startAt: day(1, 17), endAt: day(1, 9) } })).status === 422);

const clockIn = await call("POST", "/sessions/clock-in", { token: devToken, body: { startAt: new Date().toISOString(), category: "REMOTE" } });
check("clock in", clockIn.status === 200 && clockIn.json.status === "OPEN", clockIn.json);
check("double clock-in rejected", (await call("POST", "/sessions/clock-in", { token: devToken, body: { startAt: new Date().toISOString() } })).status === 409);
check("clock out", (await call("POST", `/sessions/${clockIn.json.id}/clock-out`, { token: devToken, body: { endAt: new Date(Date.now() + 3600_000).toISOString() } })).json?.durationMinutes === 60);

const devUserId = dev.json.user.id;
const sheet = await call("GET", "/timesheets", { token: ownerToken, query: `?userId=${devUserId}` });
check("manager sees 3 entries", sheet.json?.entries?.length === 3, sheet.json?.entries?.length);
const firstPage = await call("GET", "/timesheets", { token: ownerToken, query: `?userId=${devUserId}&pageSize=1` });
const secondPage = await call("GET", "/timesheets", { token: ownerToken, query: `?userId=${devUserId}&pageSize=1&page=2` });
check("timesheets return total and one page", firstPage.json.total === 3 && firstPage.json.entries.length === 1 && firstPage.json.pageSize === 1);
check("timesheet pages do not overlap", firstPage.json.entries[0].id !== secondPage.json.entries[0].id);
check("timesheet totals span all pages", firstPage.json.totals.completedMinutes === 840 && secondPage.json.totals.completedMinutes === 840);
check("invalid page rejected", (await call("GET", "/timesheets", { token: ownerToken, query: "?page=0" })).status === 422);
const searched = await call("GET", "/timesheets", { token: ownerToken, query: `?userId=${devUserId}&search=${DEV_USERNAME}` });
check("timesheet search includes member names", searched.json.total === 3);
const beyondPage = await call("GET", "/timesheets", { token: ownerToken, query: `?userId=${devUserId}&pageSize=1&page=999` });
check("out-of-range page clamps to final page", beyondPage.json.page === 3 && beyondPage.json.entries.length === 1);

// `/sessions` is the member's own list, so a manager must never see time that
// belongs to someone else in it.
const ownerOwnSessions = (await call("GET", "/sessions", { token: ownerToken })).json.sessions;
check(
  "cross-user isolation",
  ownerOwnSessions.every((s: any) => s.userId !== devUserId),
  ownerOwnSessions.length,
);

check("approval endpoint removed", (await call("POST", `/timesheets/${manual.json.id}/approve`, { token: ownerToken, body: {} })).status === 404);
check("rejection endpoint removed", (await call("POST", `/timesheets/${manual.json.id}/reject`, { token: ownerToken, body: {} })).status === 404);
check("bulk review endpoint removed", (await call("POST", "/timesheets/bulk-review", { token: ownerToken, body: {} })).status === 404);

const report = await call("GET", "/reports/monthly", { token: ownerToken });
const sara = report.json?.rows?.find((r: any) => r.username === DEV_USERNAME);
check("report completed minutes = 840", sara?.completedMinutes === 840, sara);
check("report gross = 14h * 850000", sara?.grossAmount === 14 * 850000, sara?.grossAmount);
check("report worked days = 3", sara?.workedDays === 3, sara?.workedDays);

const csv = await fetch(`${BASE}/reports/monthly.csv`, { headers: { Authorization: `Bearer ${ownerToken}` } });
check("csv export", csv.status === 200 && (await csv.text()).includes(DEV_USERNAME));

const built = await call("POST", "/payroll/periods", { token: ownerToken, body: { month: report.json.month } });
check("payroll built", built.status === 200 && built.json.lines.length >= 1, built.json?.message);
const line = built.json.lines.find((l: any) => l.username === DEV_USERNAME);
check("payroll net = gross", line?.netAmount === 14 * 850000, line);

const adjusted = await call("PATCH", `/payroll/lines/${line.id}`, { token: ownerToken, body: { adjustment: 1000000, adjustmentNote: "Bonus" } });
const adjustedLine = adjusted.json.lines.find((l: any) => l.username === DEV_USERNAME);
check("adjustment applied", adjustedLine?.netAmount === 14 * 850000 + 1000000, adjustedLine?.netAmount);

const locked = await call("PATCH", `/payroll/periods/${built.json.period.id}`, { token: ownerToken, body: { status: "LOCKED" } });
check("period locked", locked.json?.period?.status === "LOCKED", locked.json?.period);

const afterLock = await call("POST", "/sessions", { token: devToken, body: { startAt: day(3, 9), endAt: day(3, 12) } });
check("locked month blocks new time", afterLock.status === 409, afterLock.json);
check("locked month blocks member edits", (await call("PATCH", `/sessions/${manual.json.id}`, { token: devToken, body: { startAt: day(2, 9), endAt: day(2, 18) } })).status === 409);
check("locked month blocks manager edits", (await call("PATCH", `/timesheets/${manual.json.id}`, { token: ownerToken, body: { startAt: day(2, 9), endAt: day(2, 18) } })).status === 409);
check("locked month blocks deletion", (await call("DELETE", `/sessions/${manual.json.id}`, { token: devToken })).status === 409);
check("locked month blocks rebuild", (await call("POST", "/payroll/periods", { token: ownerToken, body: { month: report.json.month } })).status === 409);

const sync = await call("POST", "/sync", { token: devToken, body: { sessions: [] } });
check("sync pulls sessions", sync.status === 200 && sync.json.sessions.length === 3, sync.json?.sessions?.length);

// ── offline device round trip ──────────────────────────────────────────────
// The month above is locked, so the device works in the month before it.
const past = (dayOfMonth: number, hour: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  d.setDate(dayOfMonth);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const offline = {
  clientId: "device-row-1",
  startAt: past(10, 9),
  endAt: past(10, 13),
  category: "ONSITE" as const,
  note: "Worked offline",
  updatedAt: new Date().toISOString(),
};

const push1 = await call("POST", "/sync", { token: devToken, body: { since: sync.json.serverTime, sessions: [offline] } });
check("sync push creates a row", push1.json?.results?.[0]?.outcome === "applied", push1.json?.results);
check("pushed row comes back", push1.json.sessions.some((s: any) => s.clientId === offline.clientId), push1.json?.sessions?.length);
check("pushed row is 4h", push1.json.sessions.find((s: any) => s.clientId === offline.clientId)?.durationMinutes === 240);

const replay = await call("POST", "/sync", { token: devToken, body: { since: push1.json.serverTime, sessions: [offline] } });
check("re-pushing the same row is idempotent", replay.json?.results?.[0]?.serverId === push1.json.results[0].serverId, replay.json?.results);

const stale = await call("POST", "/sync", {
  token: devToken,
  body: { sessions: [{ ...offline, note: "stale edit", updatedAt: new Date(Date.now() - 86_400_000).toISOString() }] },
});
check("an older client edit is skipped", stale.json?.results?.[0]?.outcome === "skipped", stale.json?.results);

const serverId = push1.json.results[0].serverId;

const reEdit = await call("POST", "/sync", {
  token: devToken,
  body: { sessions: [{ ...offline, endAt: past(10, 14), updatedAt: new Date().toISOString() }] },
});
const reEdited = reEdit.json.sessions.find((s: any) => s.clientId === offline.clientId);
check("editing completed time keeps it completed", reEdited?.status === "COMPLETED", reEdited?.status);
check("edited duration is 5h", reEdited?.durationMinutes === 300, reEdited?.durationMinutes);

const removed = await call("POST", "/sync", {
  token: devToken,
  body: { sessions: [{ ...offline, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] },
});
check("a local delete reaches the server", removed.json?.results?.[0]?.outcome === "applied", removed.json?.results);
check(
  "the deletion comes back so other devices drop it",
  removed.json.sessions.find((s: any) => s.clientId === offline.clientId)?.deletedAt !== null,
);
check(
  "deleted time leaves the timesheet",
  !(await call("GET", "/timesheets", { token: ownerToken, query: `?userId=${devUserId}` })).json.entries.some(
    (e: any) => e.id === serverId,
  ),
);

const editable = await call("POST", "/sessions", { token: devToken, body: { startAt: past(12, 9), endAt: past(12, 11) } });
const edited = await call("PATCH", `/sessions/${editable.json.id}`, { token: devToken, body: { startAt: past(12, 9), endAt: past(12, 12) } });
check("member edits need no approval", edited.json?.status === "COMPLETED" && edited.json?.durationMinutes === 180, edited.json);
check("approval metadata absent from session response", !("reviewNote" in edited.json) && !("approvedAt" in edited.json));
const reopened = await call("PATCH", `/sessions/${editable.json.id}`, { token: devToken, body: { startAt: past(12, 9), endAt: null } });
check("reopened session is OPEN", reopened.json?.status === "OPEN" && reopened.json?.durationMinutes === 0, reopened.json);
const managerEdited = await call("PATCH", `/timesheets/${editable.json.id}`, { token: ownerToken, body: { startAt: past(12, 9), endAt: past(12, 12) } });
check("manager edits produce completed time", managerEdited.json?.status === "COMPLETED", managerEdited.json);

const lockedPush = await call("POST", "/sync", {
  token: devToken,
  body: { sessions: [{ ...offline, clientId: "device-row-2", startAt: day(5, 9), endAt: day(5, 12), updatedAt: new Date().toISOString() }] },
});
check("a locked month refuses a pushed row", lockedPush.json?.results?.[0]?.outcome === "rejected", lockedPush.json?.results);

await call("PATCH", `/payroll/periods/${built.json.period.id}`, {
  token: ownerToken,
  body: { status: "DRAFT" },
});

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
