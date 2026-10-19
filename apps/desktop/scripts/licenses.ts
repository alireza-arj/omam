import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

export async function bundledLicenses(app: string) {
  const visited = new Set<string>();
  const notices: string[] = [];
  async function visit(name: string, from: string) {
    const require = createRequire(from);
    let manifest: string;
    try { manifest = require.resolve(`${name}/package.json`); }
    catch {
      let directory = dirname(require.resolve(name));
      while (!(await Bun.file(resolve(directory, "package.json")).exists())) {
        const parent = dirname(directory);
        if (parent === directory) throw new Error(`Missing package metadata: ${name}`);
        directory = parent;
      }
      manifest = resolve(directory, "package.json");
    }
    if (visited.has(manifest)) return;
    visited.add(manifest);
    const metadata = JSON.parse(await readFile(manifest, "utf8")) as { name: string; version: string; dependencies?: Record<string, string> };
    const directory = dirname(manifest);
    for (const file of await readdir(directory)) {
      if (/^(?:licen[sc]e|notice)(?:\.[a-z]+)?$/i.test(file)) notices.push(`${metadata.name} ${metadata.version}\n\n${await readFile(resolve(directory, file), "utf8")}`);
    }
    for (const dependency of Object.keys(metadata.dependencies ?? {})) await visit(dependency, manifest);
  }
  for (const name of ["electron-updater", "@omam/contracts"]) await visit(name, resolve(app, "package.json"));
  return notices.join("\n\n");
}
