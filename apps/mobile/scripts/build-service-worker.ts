import { build } from "bun";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export function precacheBuild(outdir: string) {
  const files = readdirSync(outdir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(outdir.length + 1).replaceAll("\\", "/"))
    .filter((path) => !path.endsWith(".map") && (
      path.startsWith("_expo/static/js/web/") || path.startsWith("_expo/static/css/") ||
      (path.startsWith("assets/") && extname(path) !== "") ||
      ["index.html", "favicon.ico", "manifest.webmanifest", "icon-512.png"].includes(path)
    )).sort();
  if (!files.includes("index.html") || !files.some((path) => path.startsWith("_expo/static/js/web/"))) {
    throw new Error("The PWA export is missing its HTML or web bundle");
  }
  const assets = files.map((path) => ({
    url: `/${encodeURI(path).replaceAll("#", "%23").replaceAll("?", "%3F")}`,
    integrity: `sha256-${createHash("sha256").update(readFileSync(join(outdir, path))).digest("base64")}`,
  }));
  const version = createHash("sha256").update(JSON.stringify(assets)).digest("hex").slice(0, 20);
  return { version, assets };
}

export async function buildServiceWorker(outdir: string, filename = "sw.js") {
  const manifest = filename === "sw.js" ? precacheBuild(outdir) : { version: "dev", assets: [] };
  const result = await build({
    entrypoints: [join(projectRoot, "pwa/service-worker.ts")], outdir,
    naming: filename, target: "browser", minify: true,
    define: { __PWA_BUILD__: JSON.stringify(manifest) },
  });
  if (!result.success) throw new AggregateError(result.logs, "Service worker build failed");
}

if (import.meta.main) await buildServiceWorker(join(projectRoot, "public"), "pwa-dev-sw.js");
