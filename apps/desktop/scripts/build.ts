import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildDesktopFonts } from "./fonts";
import { bundledLicenses } from "./licenses";

const root = resolve(import.meta.dir, "../../..");
const app = resolve(root, "apps/desktop");
const fontLicenses = await buildDesktopFonts(root, app);
const renderer = resolve(app, "renderer");
await rm(renderer, { recursive: true, force: true });
const exported = Bun.spawn(["bun", "x", "--no-install", "expo", "export", "--platform", "web", "--output-dir", renderer], {
  cwd: resolve(root, "apps/mobile"),
  env: { ...process.env, OMAM_DESKTOP_BUILD: "1", EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH: "1", EXPO_UNSTABLE_TREE_SHAKING: "1" },
  stdout: "inherit",
  stderr: "inherit",
});
if (await exported.exited !== 0) process.exit(1);
for (const file of ["register-sw.js", "sw.js", "manifest.webmanifest", "icon-512.png", "metadata.json"]) {
  await rm(resolve(renderer, file), { force: true });
}
const dist = resolve(app, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await writeFile(resolve(dist, "FONT_LICENSES.txt"), fontLicenses);
await writeFile(resolve(dist, "BUNDLED_LICENSES.txt"), await bundledLicenses(app));
for (const name of ["main", "preload"]) {
  const result = await Bun.build({ entrypoints: [resolve(app, `src/${name}.ts`)], outdir: dist, naming: `${name}.cjs`, target: "node", format: "cjs", external: ["electron"], minify: true });
  if (!result.success) { console.error(result.logs); process.exit(1); }
}
const feed = process.env.DESKTOP_UPDATE_URL ?? null;
if (feed && new URL(feed).protocol !== "https:") throw new Error("DESKTOP_UPDATE_URL must use HTTPS");
const { version } = JSON.parse(await readFile(resolve(app, "package.json"), "utf8")) as { version: string };
const sourceRevision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
await writeFile(resolve(dist, "release.json"), JSON.stringify({ updateUrl: feed, version, sourceRevision, builtAt: new Date().toISOString() }));
