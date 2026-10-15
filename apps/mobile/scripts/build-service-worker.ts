import { build } from "bun";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export async function buildServiceWorker(outdir: string, filename = "sw.js") {
  const result = await build({
    entrypoints: [join(projectRoot, "pwa/service-worker.ts")], outdir,
    naming: filename, target: "browser", minify: true,
  });
  if (!result.success) throw new AggregateError(result.logs, "Service worker build failed");
}

if (import.meta.main) await buildServiceWorker(join(projectRoot, "public"), "pwa-dev-sw.js");
