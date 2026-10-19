const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");
const { resolve } = require("node:path");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("wasm");

if (process.env.OMAM_DESKTOP_BUILD === "1") {
  config.resolver.assetExts.push("woff2");
  const browserDatabase = resolve(__dirname, "src/providers/database-provider.web.tsx");
  const desktopDatabase = resolve(__dirname, "src/providers/database-provider.desktop.tsx");
  const fonts = resolve(__dirname, "src/design/taraz/fonts.ts");
  const desktopFonts = resolve(__dirname, "src/design/taraz/fonts.desktop.ts");
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const result = context.resolveRequest(context, moduleName, platform);
    if (result.type === "sourceFile") {
      if (result.filePath === browserDatabase) return { type: "sourceFile", filePath: desktopDatabase };
      if (result.filePath === fonts) return { type: "sourceFile", filePath: desktopFonts };
    }
    return result;
  };
}

module.exports = withUniwindConfig(config, {
  cssEntryFile: "./global.css",
  dtsFile: "./uniwind-env.d.ts",
});
