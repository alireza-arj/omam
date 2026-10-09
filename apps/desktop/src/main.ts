import { app, BrowserWindow, ipcMain, Menu, nativeImage, net, Notification, powerMonitor, protocol, safeStorage, screen, session, Tray, type IpcMainInvokeEvent } from "electron";
import { autoUpdater } from "electron-updater";
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { desktopStorageRequestSchema, desktopTrayStateSchema, type DesktopTrayState } from "@omam/contracts";
import { createTranslator } from "@omam/i18n";
import { trayIconPng } from "./tray-icon";
import { openDesktopDatabase } from "./database";

protocol.registerSchemesAsPrivileged([{ scheme: "omam", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
if (process.env.OMAM_DESKTOP_DATA_DIR) app.setPath("userData", resolve(process.env.OMAM_DESKTOP_DATA_DIR));
if (!app.requestSingleInstanceLock()) app.quit();
else void app.whenReady().then(start).catch((error: unknown) => { console.error(error); app.quit(); });

let panel: BrowserWindow;
let tray: Tray;
let state: DesktopTrayState = { startAt: null, language: "en", isDark: false };
let updateReady = false;
let trayMenu: Menu;
let reminderKey = "";

function paintTray() {
  const elapsed = state.startAt ? Math.max(0, Math.floor((Date.now() - Date.parse(state.startAt)) / 60000)) : null;
  tray.setTitle(elapsed === null ? "" : `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`, { fontType: "monospacedDigit" });
  const t = createTranslator(state.language);
  const reminder = state.startAt ? Math.floor((Date.now() - Date.parse(state.startAt)) / (2 * 60 * 60 * 1000)) : 0;
  const key = `${state.startAt}:${reminder}`;
  if (state.startAt && reminder > 0 && key !== reminderKey) {
    reminderKey = key;
    if (Notification.isSupported()) new Notification({ title: t("today.reminderTitle"), body: t("today.reminderBody") }).show();
  }
  tray.setToolTip(t("desktop.appName"));
  trayMenu = Menu.buildFromTemplate([{ label: t("desktop.open"), click: showPanel }, { label: t("desktop.quit"), click: () => app.quit() }]);
}

function showPanel() {
  const bounds = tray.getBounds();
  const area = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y }).workArea;
  const [width, height] = panel.getSize();
  panel.setPosition(Math.round(Math.max(area.x, Math.min(bounds.x + bounds.width / 2 - width / 2, area.x + area.width - width))), Math.round(Math.min(bounds.y + bounds.height + 8, area.y + area.height - height)));
  panel.show();
  panel.focus();
  panel.webContents.send("omam:show");
}

function trusted(event: IpcMainInvokeEvent) {
  if (event.sender !== panel.webContents || event.senderFrame !== panel.webContents.mainFrame || !event.senderFrame.url.startsWith("omam://app/")) throw new Error("DESKTOP_REQUEST_REFUSED");
}

async function start() {
  app.setActivationPolicy("accessory");
  const assets = join(app.getAppPath(), "renderer");
  const compiled = join(app.getAppPath(), "dist");
  protocol.handle("omam", (request) => {
    const url = new URL(request.url);
    if (url.host !== "app") return new Response(null, { status: 403 });
    const file = resolve(assets, `.${decodeURIComponent(url.pathname)}`);
    if (!file.startsWith(assets + sep)) return new Response(null, { status: 403 });
    const target = existsSync(file) && !url.pathname.endsWith("/") ? file : join(assets, "index.html");
    return net.fetch(pathToFileURL(target).toString());
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (!details.url.startsWith("omam://app/")) { callback({ responseHeaders: details.responseHeaders }); return; }
    callback({ responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: http:; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-src 'none'"] } });
  });
  panel = new BrowserWindow({ width: 420, height: 640, show: false, frame: false, resizable: false, maximizable: false, minimizable: false, fullscreenable: false, skipTaskbar: true, transparent: true, hasShadow: true, vibrancy: "popover", visualEffectState: "active", roundedCorners: true, webPreferences: { preload: join(compiled, "preload.cjs"), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false } });
  panel.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  panel.webContents.on("will-navigate", (event, url) => { if (!url.startsWith("omam://app/")) event.preventDefault(); });
  panel.on("blur", () => panel.hide());
  panel.on("close", (event) => { event.preventDefault(); panel.hide(); });
  const icon = nativeImage.createFromBuffer(trayIconPng(), { scaleFactor: 2 });
  icon.setTemplateImage(true);
  tray = new Tray(icon.resize({ width: 18, height: 18 }));
  tray.on("click", () => { if (panel.isVisible()) panel.hide(); else showPanel(); });
  tray.on("right-click", () => tray.popUpContextMenu(trayMenu));
  paintTray();
  const clock = setInterval(paintTray, 15_000);
  mkdirSync(app.getPath("userData"), { recursive: true });
  const db = openDesktopDatabase(join(app.getPath("userData"), "omam.db"));
  const vaultPath = join(app.getPath("userData"), "vault.json");
  const vault: Record<string, string> = existsSync(vaultPath) ? JSON.parse(readFileSync(vaultPath, "utf8")) : {};
  function handle(channel: string, operation: (input: unknown) => unknown) {
    ipcMain.handle(channel, (event, input: unknown) => { trusted(event); return operation(input); });
  }
  handle("omam:database", (input) => db.execute(input));
  handle("omam:storage", (input) => {
    const request = desktopStorageRequestSchema.parse(input);
    if (!safeStorage.isEncryptionAvailable()) throw new Error("DESKTOP_KEYCHAIN_UNAVAILABLE");
    if (request.operation === "get") return vault[request.key] ? safeStorage.decryptString(Buffer.from(vault[request.key], "base64")) : null;
    if (request.operation === "set") vault[request.key] = safeStorage.encryptString(request.value ?? "").toString("base64");
    else delete vault[request.key];
    writeFileSync(vaultPath + ".tmp", JSON.stringify(vault), { mode: 0o600 });
    renameSync(vaultPath + ".tmp", vaultPath);
    return null;
  });
  handle("omam:tray", (input) => { state = desktopTrayStateSchema.parse(input); paintTray(); });
  handle("omam:hide", () => panel.hide());
  handle("omam:quit", () => app.quit());
  handle("omam:notify", (input) => {
    const copy = z.object({ title: z.string().max(160), body: z.string().max(500) }).parse(input);
    if (Notification.isSupported()) new Notification(copy).show();
  });
  const release = JSON.parse(readFileSync(join(compiled, "release.json"), "utf8")) as { updateUrl: string | null };
  if (release.updateUrl) { autoUpdater.setFeedURL({ provider: "generic", url: release.updateUrl }); autoUpdater.autoInstallOnAppQuit = false; }
  autoUpdater.on("update-downloaded", () => { updateReady = true; });
  autoUpdater.on("error", () => {});
  handle("omam:updates", async () => {
    if (!release.updateUrl || !app.isPackaged) return "disabled";
    if (updateReady) return "available";
    const result = await autoUpdater.checkForUpdates();
    return result && result.updateInfo.version !== app.getVersion() ? "downloading" : "current";
  });
  handle("omam:install-update", () => { if (updateReady) autoUpdater.quitAndInstall(); });
  if (release.updateUrl && app.isPackaged) void autoUpdater.checkForUpdates().catch(() => {});
  const updateTimer = setInterval(() => { if (release.updateUrl && app.isPackaged) void autoUpdater.checkForUpdates().catch(() => {}); }, 6 * 60 * 60 * 1000);
  app.on("second-instance", showPanel);
  app.on("activate", showPanel);
  powerMonitor.on("resume", () => panel.webContents.send("omam:show"));
  app.on("before-quit", () => { panel.removeAllListeners("close"); clearInterval(clock); clearInterval(updateTimer); db.close(); });
  app.on("window-all-closed", () => {});
  await panel.loadURL("omam://app/desktop");
  if (process.env.OMAM_DESKTOP_SHOW === "1") showPanel();
}
