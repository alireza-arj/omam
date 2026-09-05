const BASE = "http://localhost:3001";
let failures = 0;

async function call(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await fetch(`${BASE}${path}`, {
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

const dev = await call("POST", "/auth/register", { body: { username: "sara_dev", password: "devpass123", inviteCode: invite.json.code, nickname: "Sara" } });
check("member registered", dev.status === 200 && dev.json.membership?.role === "MEMBER", dev.json);
const devToken = dev.json.token;

check("invite cannot be reused", (await call("POST", "/auth/register", { body: { username: "other_dev", password: "devpass123", inviteCode: invite.json.code } })).status === 422);
check("member cannot list team", (await call("GET", "/team/members", { token: devToken })).status === 403);

const project = await call("POST", "/projects", { token: ownerToken, body: { name: "Omam API", color: "#B4213C" } });
check("project created", project.status === 200, project.json);

const day = (offset: number, hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const manual = await call("POST", "/sessions", { token: devToken, body: { startAt: day(2, 9), endAt: day(2, 17), category: "ONSITE", projectId: project.json.id, note: "Auth routes" } });
check("manual session 8h", manual.status === 200 && manual.json.durationMinutes === 480, manual.json);
check("manual session is PENDING", manual.json.status === "PENDING", manual.json.status);

const manual2 = await call("POST", "/sessions", { token: devToken, body: { startAt: day(1, 10), endAt: day(1, 15), category: "REMOTE" } });
check("second session 5h", manual2.json?.durationMinutes === 300, manual2.json);

check("end before start rejected", (await call("POST", "/sessions", { token: devToken, body: { startAt: day(1, 17), endAt: day(1, 9) } })).status === 422);

const clockIn = await call("POST", "/sessions/clock-in", { token: devToken, body: { startAt: new Date().toISOString(), category: "REMOTE" } });
check("clock in", clockIn.status === 200 && clockIn.json.status === "OPEN", clockIn.json);
check("double clock-in rejected", (await call("POST", "/sessions/clock-in", { token: devToken, body: { startAt: new Date().toISOString() } })).status === 409);
check("clock out", (await call("POST", `/sessions/${clockIn.json.id}/clock-out`, { token: devToken, body: { endAt: new Date(Date.now() + 3600_000).toISOString() } })).json?.durationMinutes === 60);

const sheet = await call("GET", "/timesheets", { token: ownerToken });
check("manager sees 3 entries", sheet.json?.entries?.length === 3, sheet.json?.entries?.length);
check("cross-user isolation", (await call("GET", "/sessions", { token: ownerToken })).json.sessions.length === 0);

const ids = sheet.json.entries.map((e: any) => e.id);
const bulk = await call("POST", "/timesheets/bulk-review", { token: ownerToken, body: { sessionIds: ids, action: "APPROVE" } });
check("bulk approve", bulk.json?.updated === 3, bulk.json);

const report = await call("GET", "/reports/monthly", { token: ownerToken });
const sara = report.json?.rows?.find((r: any) => r.username === "sara_dev");
check("report approved minutes = 840", sara?.approvedMinutes === 840, sara);
check("report gross = 14h * 850000", sara?.grossAmount === 14 * 850000, sara?.grossAmount);
check("report worked days = 3", sara?.workedDays === 3, sara?.workedDays);

const csv = await fetch(`${BASE}/reports/monthly.csv`, { headers: { Authorization: `Bearer ${ownerToken}` } });
check("csv export", csv.status === 200 && (await csv.text()).includes("sara_dev"));

const built = await call("POST", "/payroll/periods", { token: ownerToken, body: { month: report.json.month } });
check("payroll built", built.status === 200 && built.json.lines.length >= 1, built.json?.message);
const line = built.json.lines.find((l: any) => l.username === "sara_dev");
check("payroll net = gross", line?.netAmount === 14 * 850000, line);

const adjusted = await call("PATCH", `/payroll/lines/${line.id}`, { token: ownerToken, body: { adjustment: 1000000, adjustmentNote: "Bonus" } });
const adjustedLine = adjusted.json.lines.find((l: any) => l.username === "sara_dev");
check("adjustment applied", adjustedLine?.netAmount === 14 * 850000 + 1000000, adjustedLine?.netAmount);

const locked = await call("PATCH", `/payroll/periods/${built.json.period.id}`, { token: ownerToken, body: { status: "LOCKED" } });
check("period locked", locked.json?.period?.status === "LOCKED", locked.json?.period);

const afterLock = await call("POST", "/sessions", { token: devToken, body: { startAt: day(3, 9), endAt: day(3, 12) } });
check("locked month blocks new time", afterLock.status === 409, afterLock.json);
check("locked month blocks rebuild", (await call("POST", "/payroll/periods", { token: ownerToken, body: { month: report.json.month } })).status === 409);

const sync = await call("POST", "/sync", { token: devToken, body: { sessions: [] } });
check("sync pulls sessions", sync.status === 200 && sync.json.sessions.length === 3, sync.json?.sessions?.length);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
