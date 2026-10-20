import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, resolve } from "node:path";
import { compress } from "wawoff2";

export async function buildDesktopFonts(root: string, app: string) {
  const directory = resolve(app, "build/fonts");
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  const source = await readFile(resolve(root, "apps/mobile/src/design/taraz/fonts.desktop.ts"), "utf8");
  const imports = new Bun.Transpiler({ loader: "ts" }).scanImports(source).filter((entry) => entry.path.endsWith(".woff2"));
  const families: Record<string, string> = { Figtree: "figtree", PublicSans: "public-sans", IBMPlexMono: "ibm-plex-mono", Estedad: "estedad" };
  const require = createRequire(import.meta.url);
  const licenses = new Map<string, string>();
  let originalBytes = 0;
  let compressedBytes = 0;
  for (const entry of imports) {
    const name = basename(entry.path, ".woff2");
    const [family, weight] = name.split("_");
    if (!family || !weight || !families[family]) throw new Error(`Unknown desktop font: ${name}`);
    const packageName = `@expo-google-fonts/${families[family]}`;
    const packageDirectory = dirname(require.resolve(`${packageName}/package.json`));
    const original = await readFile(resolve(packageDirectory, weight, `${name}.ttf`));
    const compressed = await compress(original);
    await writeFile(resolve(directory, `${name}.woff2`), compressed);
    originalBytes += original.byteLength;
    compressedBytes += compressed.byteLength;
    if (!licenses.has(packageName)) licenses.set(packageName, await readFile(resolve(packageDirectory, "LICENSE_FONT"), "utf8"));
  }
  console.log(`Desktop fonts: ${originalBytes} → ${compressedBytes} bytes (${imports.length} faces)`);
  return [...licenses].map(([name, license]) => `${name}\n\n${license}`).join("\n\n");
}
