const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("wasm");

module.exports = withNativeWind(config, {
  input: "./apps/mobile/global.css",
  configPath: "./apps/mobile/tailwind.config.js",
  typescriptEnvPath: "./apps/mobile/nativewind-env.d.ts",
});
