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

/** A home-screen app always fills the screen, so its height is the screen's, not the short viewport iOS reports. */
const appHeightScript = `(function(){if(navigator.standalone!==true)return;var r=document.documentElement;function f(){var p=matchMedia("(orientation: portrait)").matches;r.style.setProperty("--app-height",Math.max(innerHeight,p?Math.max(screen.width,screen.height):Math.min(screen.width,screen.height))+"px")}f();addEventListener("resize",f);addEventListener("orientationchange",f)})();`;

const publicFiles = ["manifest.webmanifest", "register-sw.js", "icon-512.png"];

if (!existsSync(indexPath)) {
  throw new Error("dist/index.html does not exist. Run expo export first.");
}

mkdirSync(distDir, { recursive: true });

await buildServiceWorker(distDir);

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
  `<script>${appHeightScript}</script>`,
].join("\n    ");

let html = readFileSync(indexPath, "utf8");
html = html.replace(
  /<meta name="viewport"[^>]*>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />',
);

if (!html.includes('href="/manifest.webmanifest"')) {
  html = html.replace("</head>", `  ${headTags}\n</head>`);
}

if (!html.includes('src="/register-sw.js"')) {
  html = html.replace("</body>", '  <script src="/register-sw.js" defer></script>\n</body>');
}

writeFileSync(indexPath, html);

console.log("PWA assets injected into dist.");
