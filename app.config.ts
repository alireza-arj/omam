import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Omam",
  slug: "omam",
  scheme: "omam",
  orientation: "portrait",
  userInterfaceStyle: "light",
  plugins: [
    "expo-router",
    [
      "expo-image-picker",
      {
        photosPermission: "Allow Omam to access your photos so you can choose an avatar.",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  ios: {
    supportsTablet: true,
    infoPlist: {
      NSPhotoLibraryUsageDescription: "Allow Omam to access your photos so you can choose an avatar.",
    },
  },
  android: {
    permissions: ["READ_MEDIA_IMAGES", "READ_EXTERNAL_STORAGE"],
    adaptiveIcon: {
      backgroundColor: "#08111f",
    },
  },
  web: {
    bundler: "metro",
  },
  extra: {
    router: {
      root: "apps/mobile/app",
    },
  },
};

export default config;
