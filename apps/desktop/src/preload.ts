import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi } from "@omam/contracts";

const api: DesktopApi = {
  deviceName: "Mac",
  database: (request) => ipcRenderer.invoke("omam:database", request),
  storage: (request) => ipcRenderer.invoke("omam:storage", request),
  setTrayState: (state) => ipcRenderer.invoke("omam:tray", state),
  hide: () => ipcRenderer.invoke("omam:hide"),
  quit: () => ipcRenderer.invoke("omam:quit"),
  checkUpdates: () => ipcRenderer.invoke("omam:updates"),
  installUpdate: () => ipcRenderer.invoke("omam:install-update"),
  onShow: (listener) => {
    const handler = () => listener();
    ipcRenderer.on("omam:show", handler);
    return () => { ipcRenderer.removeListener("omam:show", handler); };
  },
  onVisibilityChange: (listener) => {
    let active = true;
    let changed = false;
    const notify = (visible: unknown) => { if (active && typeof visible === "boolean") listener(visible); };
    const handler = (_event: Electron.IpcRendererEvent, visible: unknown) => { changed = true; notify(visible); };
    ipcRenderer.on("omam:visibility", handler);
    void ipcRenderer.invoke("omam:visibility").then((visible: unknown) => { if (!changed) notify(visible); }).catch(() => {});
    return () => { active = false; ipcRenderer.removeListener("omam:visibility", handler); };
  },
};
contextBridge.exposeInMainWorld("omamDesktop", api);
