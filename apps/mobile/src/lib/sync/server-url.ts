type ServerConfig = {
  platform: string;
  origin?: string;
  isDevelopment: boolean;
  apiUrl?: string;
  apiPort?: string;
};

const PRODUCTION_API_URL = "https://omam.ir/api";

export function configuredServerUrl({ platform, origin, isDevelopment, apiUrl, apiPort }: ServerConfig) {
  const webOrigin = platform === "web" && origin && /^https?:\/\//.test(origin) ? origin : undefined;
  const explicit = apiUrl?.trim();

  if (explicit && (webOrigin || /^https?:\/\//.test(explicit))) {
    return (webOrigin ? new URL(explicit, webOrigin).toString() : explicit).replace(/\/+$/, "");
  }

  if (isDevelopment) {
    const port = apiPort?.trim() || "3001";
    if (webOrigin) {
      const url = new URL(webOrigin);
      return `${url.protocol}//${url.hostname}:${port}`;
    }
    return `http://${platform === "android" ? "10.0.2.2" : "localhost"}:${port}`;
  }

  return webOrigin ? `${webOrigin}/api` : PRODUCTION_API_URL;
}
