import type { Configuration } from "electron-builder";

const feed = process.env.DESKTOP_UPDATE_URL;
const config: Configuration = {
  appId: "com.omam.desktop",
  productName: "Tarazkar",
  directories: { output: "release" },
  files: ["dist/main.cjs", "dist/preload.cjs", "dist/release.json", "dist/*LICENSE*.txt", "renderer/**/*", "package.json", "!**/node_modules/**/*"],
  asar: true,
  compression: "maximum",
  electronLanguages: ["en", "fa"],
  artifactName: "${productName}-${version}-mac-${arch}.${ext}",
  mac: {
    target: [{ target: "dmg", arch: ["arm64"] }, { target: "zip", arch: ["arm64"] }],
    category: "public.app-category.productivity",
    icon: "../mobile/assets/brand/app-icon.png",
    hardenedRuntime: true,
    minimumSystemVersion: "12.0.0",
    notarize: Boolean(process.env.APPLE_ID || process.env.APPLE_API_KEY),
    extendInfo: { LSUIElement: true },
    entitlements: "build/entitlements.mac.plist",
    entitlementsInherit: "build/entitlements.mac.plist",
  },
  dmg: { sign: false, format: "UDBZ" },
  publish: feed ? { provider: "generic", url: feed } : null,
};
export default config;
