export {};

const cwd = "/app/apps/api";
for (const command of [["bun", "/app/node_modules/prisma/build/index.js", "migrate", "deploy"], ["bun", "dist/seed.js"]]) {
  const child = Bun.spawn(command, { cwd, stdout: "inherit", stderr: "inherit" });
  const code = await child.exited;
  if (code !== 0) process.exit(code);
}

const api = Bun.spawn(["bun", "run", "dist/index.js"], { cwd, stdout: "inherit", stderr: "inherit" });
let ready = false;
for (let attempt = 0; attempt < 100; attempt++) {
  if (api.exitCode !== null) process.exit(api.exitCode || 1);
  try { ready = (await fetch("http://127.0.0.1:3001/health")).ok; } catch {}
  if (ready) break;
  await Bun.sleep(200);
}
if (!ready) { api.kill(); throw new Error("API_START_FAILED"); }

const nginx = Bun.spawn(["nginx", "-g", "daemon off;"], { stdout: "inherit", stderr: "inherit" });
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => { api.kill(signal); nginx.kill(signal); });
}
const code = await Promise.race([api.exited, nginx.exited]);
api.kill();
nginx.kill();
await Promise.all([api.exited, nginx.exited]);
process.exit(code || 1);
