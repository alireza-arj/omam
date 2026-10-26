import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildServiceWorker } from "./build-service-worker";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const publicDir = join(projectRoot, "public");
const distDir = join(projectRoot, "dist");
const indexPath = join(distDir, "index.html");
const manifest = JSON.parse(readFileSync(join(publicDir, "manifest.webmanifest"), "utf8")) as { background_color: string };
const appConfig = JSON.parse(readFileSync(join(projectRoot, "app.json"), "utf8")) as { expo: { android: { adaptiveIcon: { backgroundColor: string } } } };

const publicFiles = ["manifest.webmanifest", "register-sw.js", "icon-512.png"];

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
  `<meta name="theme-color" media="(prefers-color-scheme: light)" content="${manifest.background_color}" />`,
  `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${appConfig.expo.android.adaptiveIcon.backgroundColor}" />`,
  '<meta name="color-scheme" content="light dark" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-title" content="Tarazkar" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
  '<link rel="manifest" href="/manifest.webmanifest" />',
  '<link rel="apple-touch-icon" href="/icon-512.png" />',
].join("\n    ");

let html = readFileSync(indexPath, "utf8");
html = html.replace(
  /<meta name="viewport"[^>]*>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />',
);

if (!html.includes('href="/manifest.webmanifest"')) {
  html = html.replace("</head>", `  ${headTags}\n</head>`);
}

html = html.replace(/\s*<script src="\/register-sw.js" defer><\/script>/g, "");

writeFileSync(indexPath, html);
await buildServiceWorker(distDir);

console.log("PWA assets injected into dist.");
