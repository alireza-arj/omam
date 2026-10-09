import type { DesktopApi } from "@omam/contracts";

export function getDesktopBridge(): DesktopApi | undefined {
  return (globalThis as typeof globalThis & { omamDesktop?: DesktopApi }).omamDesktop;
}

export function isDesktop() {
  return Boolean(getDesktopBridge());
}
