import { describe, expect, test } from "bun:test";
import { configuredServerUrl } from "./server-url";

describe("automatic team server", () => {
  test("production web connects to its own API over HTTPS", () => {
    expect(configuredServerUrl({ platform: "web", origin: "https://omam.ir", isDevelopment: false }))
      .toBe("https://omam.ir/api");
    expect(configuredServerUrl({ platform: "web", origin: "https://www.omam.ir", isDevelopment: false, apiPort: "3010" }))
      .toBe("https://www.omam.ir/api");
  });

  test("resolves the deployment's relative API path against the web origin", () => {
    expect(configuredServerUrl({ platform: "web", origin: "https://omam.ir", isDevelopment: false, apiUrl: "/api/" }))
      .toBe("https://omam.ir/api");
  });

  test("native and packaged desktop connect to the public server", () => {
    for (const platform of ["android", "ios"]) {
      expect(configuredServerUrl({ platform, isDevelopment: false, apiPort: "3010" }))
        .toBe("https://omam.ir/api");
    }
    expect(configuredServerUrl({ platform: "web", origin: "omam://app", isDevelopment: false }))
      .toBe("https://omam.ir/api");
  });

  test("packaged apps do not send API requests to their local asset protocol", () => {
    expect(configuredServerUrl({ platform: "web", origin: "omam://app", isDevelopment: false, apiUrl: "/api" }))
      .toBe("https://omam.ir/api");
    expect(configuredServerUrl({ platform: "ios", isDevelopment: false, apiUrl: "/api" }))
      .toBe("https://omam.ir/api");
  });

  test("honors an absolute build-time API URL on every platform", () => {
    for (const platform of ["web", "android", "ios"]) {
      expect(configuredServerUrl({ platform, origin: "https://omam.ir", isDevelopment: false, apiUrl: " https://team.example.com/api/// " }))
        .toBe("https://team.example.com/api");
    }
    expect(configuredServerUrl({ platform: "web", origin: "omam://app", isDevelopment: false, apiUrl: "https://omam.ir/api/" }))
      .toBe("https://omam.ir/api");
  });

  test("keeps local API discovery limited to development", () => {
    expect(configuredServerUrl({ platform: "android", isDevelopment: true })).toBe("http://10.0.2.2:3001");
    expect(configuredServerUrl({ platform: "ios", isDevelopment: true, apiPort: "3010" })).toBe("http://localhost:3010");
    expect(configuredServerUrl({ platform: "web", origin: "http://192.168.1.100:8081", isDevelopment: true, apiPort: "3010" }))
      .toBe("http://192.168.1.100:3010");
    expect(configuredServerUrl({ platform: "android", isDevelopment: true, apiUrl: "http://192.168.1.100:3010" }))
      .toBe("http://192.168.1.100:3010");
  });
});
