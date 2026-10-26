import { test as base, chromium, expect, type BrowserContext, type Page } from "@playwright/test";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { startupTokens } from "../src/design/taraz/startup-tokens";
import { getPngInfo } from "@expo/image-utils";

const dist = resolve(__dirname, "../dist");
type Deployment = { revision: string; failWasm: boolean; unavailable: boolean };
const mime: Record<string, string> = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".wasm": "application/wasm",
  ".ttf": "font/ttf", ".png": "image/png", ".ico": "image/x-icon", ".m4a": "audio/mp4", ".webmanifest": "application/manifest+json",
};

const test = base.extend<{ deployment: Deployment; appUrl: string }>({
  deployment: async ({}, use) => { await use({ revision: "", failWasm: false, unavailable: false }); },
  appUrl: async ({ deployment }, use) => {
    const server = createServer(async (request, response) => {
      const path = new URL(request.url ?? "/", "http://localhost").pathname;
      response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      response.setHeader("Cache-Control", "no-store");
      if (deployment.unavailable) { response.writeHead(503).end(); return; }
      if (deployment.failWasm && path.endsWith(".wasm")) { response.writeHead(503).end(); return; }
      if (path.startsWith("/api/")) { response.writeHead(200, { "Content-Type": "application/json" }).end('{"private":true}'); return; }
      const file = resolve(dist, `.${decodeURIComponent(path)}`);
      if (!file.startsWith(`${dist}${sep}`) && file !== dist) { response.writeHead(403).end(); return; }
      try {
        let content: Buffer | string = await readFile(extname(file) ? file : resolve(dist, "index.html"));
        if (path === "/sw.js" && deployment.revision) {
          content = content.toString().replace(/version:"[a-f0-9]+"/, `version:"${deployment.revision}"`);
        }
        response.writeHead(200, { "Content-Type": mime[extname(file)] ?? (extname(file) ? "application/octet-stream" : "text/html") }).end(content);
      } catch { response.writeHead(404).end(); }
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    try { await use(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); }
    finally { server.closeAllConnections(); await new Promise<void>((done) => server.close(() => done())); }
  },
});

async function createAccount(page: Page, appUrl: string) {
  await page.goto(appUrl);
  await page.getByRole("button", { name: "Create a new account", exact: true }).click();
  await page.getByPlaceholder("hassan_dev", { exact: true }).fill("offline_user");
  await page.getByPlaceholder("At least 6 characters", { exact: true }).fill("offline-pass");
  await page.getByPlaceholder("Repeat your password", { exact: true }).fill("offline-pass");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  await page.goto(`${appUrl}/profile`);
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await waitForOffline(page);
  await expect(page.getByText("Offline access", { exact: true })).toHaveCount(0);
}

async function waitForOffline(page: Page) {
  await expect.poll(() => page.evaluate(async () => {
    const worker = (await navigator.serviceWorker.getRegistration())?.active;
    if (!worker) return false;
    return new Promise<boolean>((resolve) => {
      const channel = new MessageChannel();
      const finish = (ready: boolean) => { clearTimeout(timeout); channel.port1.close(); resolve(ready); };
      const timeout = setTimeout(() => finish(false), 1_000);
      channel.port1.onmessage = (event: MessageEvent<{ type?: string; ready?: boolean }>) => {
        finish(event.data.type === "OFFLINE_STATUS" && event.data.ready === true);
      };
      worker.postMessage({ type: "GET_OFFLINE_STATUS" }, [channel.port2]);
    });
  }), { timeout: 15_000 }).toBe(true);
}

async function cacheKeys(page: Page) {
  return page.evaluate(async () => {
    const keys = await caches.keys();
    return keys.filter((key) => key.startsWith("tarazkar-pwa-"));
  });
}

for (const preference of [
  { system: "light", saved: null, language: "en", background: "rgb(245, 247, 250)" },
  { system: "dark", saved: null, language: "en", background: "rgb(11, 14, 18)" },
  { system: "dark", saved: "light", language: "fa", background: "rgb(245, 247, 250)" },
  { system: "light", saved: "dark", language: "fa", background: "rgb(11, 14, 18)" },
] as const) {
  test(`the logo paints before JavaScript: ${preference.system}, saved ${preference.saved}, ${preference.language}`, async ({ page, appUrl }, testInfo) => {
    await page.emulateMedia({ colorScheme: preference.system });
    await page.addInitScript(({ saved, language }) => {
      if (saved) localStorage.setItem("taraz.theme-mode", saved);
      localStorage.setItem("taraz.language", language);
    }, preference);
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/_expo/static/js/web/*.js", async (route) => { await held; await route.continue(); });
    try {
      await page.goto(appUrl, { waitUntil: "commit" });
      const splash = page.locator("#startup-splash");
      await expect(splash).toBeVisible();
      await expect(splash).toHaveCSS("background-color", preference.background);
      await expect(page.locator("html")).toHaveAttribute("lang", preference.language);
      await expect(page.getByRole("progressbar", { name: preference.language === "fa" ? "ترازکار — در حال بارگذاری" : "Tarazkar — Loading" })).toBeVisible();
      const logo = splash.locator(`span[lang="${preference.language}"] svg`);
      await expect(logo).toHaveCSS("width", `${startupTokens.logoSize}px`);
      await expect(logo).toHaveCSS("height", `${startupTokens.logoSize}px`);
      await expect(logo.locator("rect")).not.toHaveCSS("fill", preference.background);
      await page.screenshot({ path: testInfo.outputPath("startup.png") });
    } finally { release(); }
    await expect(page.getByRole("button", { name: preference.language === "fa" ? "ورود" : "Sign in", exact: true })).toBeVisible();
    await expect(page.locator("#startup-splash")).toHaveCount(0);
    await expect(page.getByTestId("startup-splash")).toHaveCount(0);
  });
}

test("the React startup keeps the logo visible while fonts load", async ({ page, appUrl }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/*.ttf", async (route) => { await held; await route.continue(); });
  try {
    await page.goto(appUrl, { waitUntil: "commit" });
    await expect(page.getByTestId("startup-splash")).toBeVisible();
    await expect(page.getByTestId("startup-splash").locator("svg")).toBeVisible();
    await expect(page.getByTestId("startup-splash").locator("rect")).not.toHaveCSS("fill", "rgb(11, 14, 18)");
    await expect(page.locator("#startup-splash")).toHaveCount(0);
  } finally { release(); }
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByTestId("startup-splash")).toHaveCount(0);
});

test("iOS startup images have the declared pixel dimensions", async ({ page, appUrl }) => {
  await page.goto(appUrl);
  const links = await page.locator('link[rel="apple-touch-startup-image"]').evaluateAll((elements) =>
    elements.map((element) => ({ href: element.getAttribute("href")!, media: element.getAttribute("media")! })),
  );
  expect(links.length).toBeGreaterThan(0);
  for (const scheme of ["light", "dark"]) {
    const link = links.find((value) => value.href.endsWith(`${scheme}-1170x2532.png`))!;
    expect(link.media).toContain(`prefers-color-scheme: ${scheme}`);
    const response = await page.request.get(`${appUrl}${link.href}`);
    expect(response.ok()).toBe(true);
    const png = await response.body();
    expect(png.readUInt32BE(16)).toBe(1170);
    expect(png.readUInt32BE(20)).toBe(2532);
    const { data, width, height } = await getPngInfo(resolve(dist, `.${link.href}`));
    const tilePixel = (Math.floor(height / 2) * width + Math.floor(width / 2 + startupTokens.logoSize * 3 * 0.4)) * 4;
    expect(data.subarray(tilePixel, tilePixel + 3)).not.toEqual(data.subarray(0, 3));
  }
});

test("cold offline startup preserves login, a running timer, all routes, fonts and local writes", async ({ page, context, appUrl }, testInfo) => {
  const errors: string[] = [];
  context.on("page", (opened) => opened.on("pageerror", (error) => errors.push(error.message)));
  page.on("pageerror", (error) => errors.push(error.message));
  await createAccount(page, appUrl);
  const assets = await page.evaluate(async () => {
    const key = (await caches.keys()).find((key) => key.startsWith("tarazkar-pwa-v4-"))!;
    return (await (await caches.open(key)).keys()).map((request) => request.url);
  });
  expect(assets.some((url) => url.endsWith(".wasm"))).toBe(true);
  expect(assets.filter((url) => url.endsWith(".ttf"))).toHaveLength(15);
  expect(assets.some((url) => url.includes("/worker-"))).toBe(true);
  expect(assets.some((url) => url.endsWith("/assets/startup/light-1170x2532.png"))).toBe(true);
  await page.evaluate(async () => {
    const key = (await caches.keys()).find((key) => key.startsWith("tarazkar-pwa-v4-"))!;
    await (await caches.open(key)).delete("/icon-512.png");
  });
  await page.reload();
  await waitForOffline(page);
  expect(await page.evaluate(async () => Boolean(await caches.match("/icon-512.png")))).toBe(true);
  await page.evaluate(() => fetch("/api/private"));
  expect(assets.some((url) => url.includes("/api/"))).toBe(false);
  await page.goto(appUrl);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop", exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Stop", exact: true })).toBeVisible();
  await page.close();
  const cold = await context.newPage();
  await (await context.newCDPSession(cold)).send("Network.setCacheDisabled", { cacheDisabled: true });
  await cold.goto(appUrl);
  await expect(cold.getByRole("button", { name: "Stop", exact: true })).toBeVisible();
  await cold.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(cold.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  const rangedAsset = assets.find((url) => url.endsWith(".m4a")) ?? assets.find((url) => url.endsWith(".ttf"))!;
  expect(await cold.evaluate(async (url) => {
    const response = await fetch(url, { headers: { Range: "bytes=0-1" } });
    return { status: response.status, bytes: (await response.arrayBuffer()).byteLength };
  }, rangedAsset)).toEqual({ status: 206, bytes: 2 });
  await cold.goto(`${appUrl}/session/new`);
  await expect(cold.getByText("New session", { exact: true })).toBeVisible();
  await cold.reload();
  await expect(cold.getByPlaceholder("What did you work on?", { exact: true })).toBeVisible();
  await cold.goto(`${appUrl}/report`);
  await expect(cold.getByText("Report", { exact: true }).first()).toBeVisible();
  await cold.goto(`${appUrl}/profile`);
  await cold.getByRole("tab", { name: "Profile", exact: true }).click();
  await waitForOffline(cold);
  await cold.getByPlaceholder("Hassan", { exact: true }).fill("Offline saved");
  await cold.getByText("Save profile", { exact: true }).click();
  await cold.reload();
  await cold.getByRole("tab", { name: "Profile", exact: true }).click();
  await expect(cold.getByPlaceholder("Hassan", { exact: true })).toHaveValue("Offline saved");
  await cold.getByText("فارسی", { exact: true }).click();
  await expect(cold.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(cold.getByText("دسترسی آفلاین", { exact: true })).toHaveCount(0);
  expect(await cold.evaluate(() => document.fonts.check('16px "Estedad_400Regular"'))).toBe(true);
  await cold.screenshot({ path: testInfo.outputPath("offline-persian.png"), fullPage: true });
  expect(errors).toEqual([]);
});

test("a partial update keeps the working version; a complete update waits for every window to close", async ({ page, context, appUrl, deployment }) => {
  await createAccount(page, appUrl);
  const oldKeys = await cacheKeys(page);
  await page.goto(appUrl);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop", exact: true })).toBeVisible();
  deployment.revision = "broken";
  deployment.failWasm = true;
  await page.evaluate(async () => {
    const registration = (await navigator.serviceWorker.getRegistration())!;
    const failed = new Promise<void>((resolve) => registration.addEventListener("updatefound", () => {
      const worker = registration.installing!;
      worker.addEventListener("statechange", () => { if (worker.state === "redundant") resolve(); });
    }, { once: true }));
    await registration.update();
    await failed;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Stop", exact: true })).toBeVisible();
  await context.setOffline(false);
  deployment.revision = "complete";
  deployment.failWasm = false;
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update(); });
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting?.state)).toBe("installed");
  expect(await cacheKeys(page)).toEqual(expect.arrayContaining(oldKeys));
  await page.goto(`${appUrl}/profile`);
  await waitForOffline(page);
  await context.setOffline(true);
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto(appUrl);
  await expect(reopened.getByRole("button", { name: "Stop", exact: true })).toBeVisible();
  await expect.poll(() => cacheKeys(reopened)).toEqual(["tarazkar-pwa-v4-complete"]);
});

test("offline login and the timer survive a complete browser process restart", async ({ appUrl, deployment }) => {
  const profile = await mkdtemp(resolve(tmpdir(), "omam-pwa-browser-"));
  let browser: BrowserContext | undefined;
  const options = { executablePath: process.env.PWA_CHROMIUM_EXECUTABLE, viewport: { width: 390, height: 844 } };
  try {
    browser = await chromium.launchPersistentContext(profile, options);
    let page = browser.pages()[0]!;
    await createAccount(page, appUrl);
    await page.goto(appUrl);
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.getByRole("button", { name: "Stop", exact: true })).toBeVisible();
    await browser.close();
    browser = undefined;
    deployment.unavailable = true;
    browser = await chromium.launchPersistentContext(profile, options);
    await browser.setOffline(true);
    page = browser.pages()[0]!;
    await (await browser.newCDPSession(page)).send("Network.setCacheDisabled", { cacheDisabled: true });
    await page.goto(appUrl);
    await expect(page.getByRole("button", { name: "Stop", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Stop", exact: true }).click();
    await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  } finally {
    await browser?.close();
    await rm(profile, { recursive: true, force: true });
  }
});
