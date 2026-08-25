import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const publicDir = join(projectRoot, "public");
const distDir = join(projectRoot, "dist");
const indexPath = join(distDir, "index.html");

const publicFiles = ["manifest.webmanifest", "sw.js", "register-sw.js", "icon-512.png"];

if (!existsSync(indexPath)) {
  throw new Error("dist/index.html does not exist. Run expo export first.");
}

mkdirSync(distDir, { recursive: true });

for (const file of publicFiles) {
  const source = join(publicDir, file);
  const target = join(distDir, file);

  if (!existsSync(source)) {
    throw new Error(`Missing PWA asset: ${source}`);
  }

  copyFileSync(source, target);
}

const headTags = [
  '<meta name="description" content="Offline-first attendance and work session tracking." />',
  '<meta name="theme-color" content="#F5F7FA" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-title" content="Omam" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
  '<link rel="manifest" href="/manifest.webmanifest" />',
  '<link rel="apple-touch-icon" href="/icon-512.png" />',
].join("\n    ");

let html = readFileSync(indexPath, "utf8");

if (!html.includes('href="/manifest.webmanifest"')) {
  html = html.replace("</head>", `  ${headTags}\n</head>`);
}

if (!html.includes('src="/register-sw.js"')) {
  html = html.replace("</body>", '  <script src="/register-sw.js" defer></script>\n</body>');
}

writeFileSync(indexPath, html);

console.log("PWA assets injected into dist.");
