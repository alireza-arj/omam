import { NativeModules, Platform } from "react-native";
const DEFAULT_API_PORT = Number(process.env.EXPO_PUBLIC_API_PORT ?? 3010);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
let authToken = null;
function trimTrailingSlash(value) {
    return value.replace(/\/+$/, "");
}
function isPrivateOrLocalHost(host) {
    if (!host) {
        return false;
    }
    if (LOOPBACK_HOSTS.has(host) || host.endsWith(".local")) {
        return true;
    }
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!ipv4) {
        return false;
    }
    const [a, b, c, d] = ipv4.slice(1).map((part) => Number(part));
    const parts = [a, b, c, d];
    if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
        return false;
    }
    if (a === 10 || a === 127) {
        return true;
    }
    if (a === 192 && b === 168) {
        return true;
    }
    if (a === 172 && b >= 16 && b <= 31) {
        return true;
    }
    return false;
}
function resolveMetroHost() {
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (scriptURL) {
        try {
            const host = new URL(scriptURL).hostname;
            if (!LOOPBACK_HOSTS.has(host) && isPrivateOrLocalHost(host)) {
                return host;
            }
        }
        catch {
            // Ignore invalid script URLs and use platform defaults below.
        }
    }
    if (Platform.OS === "android") {
        return "10.0.2.2";
    }
    return null;
}
function normalizeUrl(rawUrl) {
    const value = (() => {
        if (rawUrl.includes("://")) {
            return rawUrl;
        }
        try {
            const candidate = new URL(`http://${rawUrl}`);
            const scheme = candidate.port === "443" ? "https" : "http";
            return `${scheme}://${rawUrl}`;
        }
        catch {
            return `http://${rawUrl}`;
        }
    })();
    const url = new URL(value);
    if (Platform.OS !== "web" && LOOPBACK_HOSTS.has(url.hostname)) {
        const metroHost = resolveMetroHost();
        if (metroHost) {
            url.hostname = metroHost;
        }
    }
    return trimTrailingSlash(url.toString());
}
function resolveApiUrl() {
    const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
    if (fromEnv) {
        try {
            return normalizeUrl(fromEnv);
        }
        catch {
            return trimTrailingSlash(fromEnv);
        }
    }
    if (Platform.OS === "web" && typeof window !== "undefined") {
        return `http://${window.location.hostname}:${DEFAULT_API_PORT}`;
    }
    const metroHost = resolveMetroHost();
    if (metroHost) {
        return `http://${metroHost}:${DEFAULT_API_PORT}`;
    }
    return `http://127.0.0.1:${DEFAULT_API_PORT}`;
}
const API_URL = resolveApiUrl();
let activeApiUrl = API_URL;
function resolveAndroidEmulatorUrl(baseUrl) {
    if (Platform.OS !== "android") {
        return null;
    }
    try {
        const url = new URL(baseUrl);
        if (url.hostname === "10.0.2.2") {
            return null;
        }
        url.hostname = "10.0.2.2";
        return trimTrailingSlash(url.toString());
    }
    catch {
        return null;
    }
}
export function setApiAuthToken(token) {
    authToken = token;
}
function buildRequestInit(init) {
    return {
        headers: {
            "Content-Type": "application/json",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            ...(init?.headers ?? {}),
        },
        ...init,
    };
}
function toHttpsUrl(baseUrl) {
    try {
        const url = new URL(baseUrl);
        if (url.protocol !== "http:") {
            return null;
        }
        url.protocol = "https:";
        if (url.port === "80") {
            url.port = "443";
        }
        return trimTrailingSlash(url.toString());
    }
    catch {
        return null;
    }
}
function isHttpToHttpsPortMismatch(status, body) {
    if (status !== 400) {
        return false;
    }
    return /plain\s+http\s+request\s+was\s+sent\s+to\s+https\s+port/i.test(body);
}
async function parseErrorMessage(response) {
    const body = await response.text();
    if (!body) {
        return {
            message: `Request failed with status ${response.status}`,
            body,
        };
    }
    try {
        const parsed = JSON.parse(body);
        return {
            message: parsed.message ?? parsed.error ?? body,
            body,
        };
    }
    catch {
        return {
            message: body,
            body,
        };
    }
}
async function fetchWithAndroidFallback(baseUrl, path, init) {
    const requestInit = buildRequestInit(init);
    let response = null;
    try {
        response = await fetch(`${baseUrl}${path}`, requestInit);
        return {
            response,
            networkError: null,
        };
    }
    catch (error) {
        const fallbackUrl = resolveAndroidEmulatorUrl(baseUrl);
        if (fallbackUrl) {
            try {
                response = await fetch(`${fallbackUrl}${path}`, requestInit);
                return {
                    response,
                    networkError: null,
                };
            }
            catch {
                // Fall through to return original network error below.
            }
        }
        return {
            response: null,
            networkError: error,
        };
    }
}
async function request(path, init) {
    const firstAttempt = await fetchWithAndroidFallback(activeApiUrl, path, init);
    if (!firstAttempt.response) {
        const fallbackMessage = firstAttempt.networkError instanceof Error ? firstAttempt.networkError.message : "Unknown network error";
        throw new Error(`Could not reach API at ${activeApiUrl}. Set EXPO_PUBLIC_API_URL (or EXPO_PUBLIC_API_PORT) for your device if needed. (${fallbackMessage})`);
    }
    const response = firstAttempt.response;
    if (!response.ok) {
        const { message, body } = await parseErrorMessage(response);
        const httpsUrl = toHttpsUrl(activeApiUrl);
        if (httpsUrl && httpsUrl !== activeApiUrl && isHttpToHttpsPortMismatch(response.status, body)) {
            const retryAttempt = await fetchWithAndroidFallback(httpsUrl, path, init);
            if (retryAttempt.response) {
                if (!retryAttempt.response.ok) {
                    const retryError = await parseErrorMessage(retryAttempt.response);
                    throw new Error(`${retryError.message} (HTTP ${retryAttempt.response.status})\nAPI: ${httpsUrl}${path}`);
                }
                activeApiUrl = httpsUrl;
                if (retryAttempt.response.status === 204) {
                    return undefined;
                }
                return (await retryAttempt.response.json());
            }
        }
        throw new Error(`${message} (HTTP ${response.status})\nAPI: ${activeApiUrl}${path}`);
    }
    if (response.status === 204) {
        return undefined;
    }
    return (await response.json());
}
export const api = {
    login(payload) {
        return request("/auth/login", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },
    me() {
        return request("/auth/me");
    },
    completeProfile(payload) {
        return request("/auth/profile", {
            method: "PATCH",
            body: JSON.stringify(payload),
        });
    },
    logout() {
        return request("/auth/logout", {
            method: "POST",
        });
    },
    getSettings() {
        return request("/settings");
    },
    updateSettings(payload) {
        return request("/settings", {
            method: "PATCH",
            body: JSON.stringify(payload),
        });
    },
    getSessions(from, to) {
        return request(`/sessions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    },
    getSummary(month) {
        return request(`/sessions/summary?month=${month}`);
    },
    clockIn(payload) {
        return request("/sessions/clock-in", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },
    clockOut(id, payload) {
        return request(`/sessions/${id}/clock-out`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },
};
