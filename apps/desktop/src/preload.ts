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
};
contextBridge.exposeInMainWorld("omamDesktop", api);
