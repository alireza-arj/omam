import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");
const app = resolve(root, "apps/desktop");
const exported = Bun.spawn(["bun", "run", "--cwd", "apps/mobile", "build:web"], { cwd: root, stdout: "inherit", stderr: "inherit" });
if (await exported.exited !== 0) process.exit(1);
await rm(resolve(app, "renderer"), { recursive: true, force: true });
await cp(resolve(root, "apps/mobile/dist"), resolve(app, "renderer"), { recursive: true });
const htmlPath = resolve(app, "renderer/index.html");
const html = await readFile(htmlPath, "utf8");
await writeFile(htmlPath, html.replace(/<script[^>]*src=["']\/register-sw\.js["'][^>]*><\/script>/g, ""));
await mkdir(resolve(app, "dist"), { recursive: true });
for (const name of ["main", "preload"]) {
  const result = await Bun.build({ entrypoints: [resolve(app, `src/${name}.ts`)], outdir: resolve(app, "dist"), naming: `${name}.cjs`, target: "node", format: "cjs", external: ["electron", "electron-updater"], minify: false });
  if (!result.success) { console.error(result.logs); process.exit(1); }
}
const feed = process.env.DESKTOP_UPDATE_URL ?? null;
if (feed && new URL(feed).protocol !== "https:") throw new Error("DESKTOP_UPDATE_URL must use HTTPS");
await writeFile(resolve(app, "dist/release.json"), JSON.stringify({ updateUrl: feed }));
