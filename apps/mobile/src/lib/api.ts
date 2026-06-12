import { NativeModules, Platform } from "react-native";
import type {
  AuthResponseDto,
  ClockInInputDto,
  ClockOutInputDto,
  CompleteProfileInputDto,
  SessionsResponseDto,
  SettingsDto,
  SummaryResponseDto,
  UpdateSettingsInputDto,
} from "@omam/contracts";

const DEFAULT_API_PORT = Number(process.env.EXPO_PUBLIC_API_PORT ?? 3001);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

type MeResponseDto = Pick<AuthResponseDto, "user" | "needsProfileSetup">;

type NativeSourceCodeModule = {
  SourceCode?: {
    scriptURL?: string;
  };
};

let authToken: string | null = null;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function isPrivateOrLocalHost(host: string) {
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

  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

function resolveMetroHost() {
  const scriptURL = (NativeModules as NativeSourceCodeModule)?.SourceCode?.scriptURL;

  if (scriptURL) {
    try {
      const host = new URL(scriptURL).hostname;

      if (!LOOPBACK_HOSTS.has(host) && isPrivateOrLocalHost(host)) {
        return host;
      }
    } catch {
      return null;
    }
  }

  if (Platform.OS === "android") {
    return "10.0.2.2";
  }

  return null;
}

function normalizeUrl(rawUrl: string) {
  const value = rawUrl.includes("://") ? rawUrl : `http://${rawUrl}`;
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
    } catch {
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

function replaceUrlHost(baseUrl: string, host: string) {
  try {
    const url = new URL(baseUrl);

    if (url.hostname === host) {
      return null;
    }

    url.hostname = host;
    return trimTrailingSlash(url.toString());
  } catch {
    return null;
  }
}

function resolveFallbackUrls(baseUrl: string) {
  const fallbackUrls: string[] = [];

  try {
    const url = new URL(baseUrl);

    if (isPrivateOrLocalHost(url.hostname)) {
      const metroHost = resolveMetroHost();
      const metroUrl = metroHost ? replaceUrlHost(baseUrl, metroHost) : null;

      if (metroUrl) {
        fallbackUrls.push(metroUrl);
      }
    }
  } catch {
    return fallbackUrls;
  }

  if (Platform.OS === "android") {
    const emulatorUrl = replaceUrlHost(baseUrl, "10.0.2.2");

    if (emulatorUrl) {
      fallbackUrls.push(emulatorUrl);
    }
  }

  return [...new Set(fallbackUrls)];
}

export function setApiAuthToken(token: string | null) {
  authToken = token;
}

function buildRequestInit(init?: RequestInit): RequestInit {
  return {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(init?.headers ?? {}),
    },
  };
}

function toHttpsUrl(baseUrl: string) {
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
  } catch {
    return null;
  }
}

function isHttpToHttpsPortMismatch(status: number, body: string) {
  return status === 400 && /plain\s+http\s+request\s+was\s+sent\s+to\s+https\s+port/i.test(body);
}

async function parseErrorMessage(response: Response) {
  const body = await response.text();

  if (!body) {
    return {
      message: `Request failed with status ${response.status}`,
      body,
    };
  }

  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string };

    return {
      message: parsed.message ?? parsed.error ?? body,
      body,
    };
  } catch {
    return {
      message: body,
      body,
    };
  }
}

async function fetchWithLocalFallback(baseUrl: string, path: string, init?: RequestInit) {
  const requestInit = buildRequestInit(init);

  try {
    const response = await fetch(`${baseUrl}${path}`, requestInit);

    return {
      response,
      networkError: null,
    };
  } catch (error) {
    for (const fallbackUrl of resolveFallbackUrls(baseUrl)) {
      try {
        const response = await fetch(`${fallbackUrl}${path}`, requestInit);
        activeApiUrl = fallbackUrl;

        return {
          response,
          networkError: null,
        };
      } catch {
        // Try the next local fallback before returning the original network error.
      }
    }

    return {
      response: null,
      networkError: error,
    };
  }
}

async function request<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  const firstAttempt = await fetchWithLocalFallback(activeApiUrl, path, init);

  if (!firstAttempt.response) {
    const fallbackMessage = firstAttempt.networkError instanceof Error ? firstAttempt.networkError.message : "Unknown network error";

    throw new Error(
      `Could not reach API at ${activeApiUrl}. Set EXPO_PUBLIC_API_URL or EXPO_PUBLIC_API_PORT if needed. (${fallbackMessage})`,
    );
  }

  const response = firstAttempt.response;

  if (!response.ok) {
    const { message, body } = await parseErrorMessage(response);
    const httpsUrl = toHttpsUrl(activeApiUrl);

    if (httpsUrl && httpsUrl !== activeApiUrl && isHttpToHttpsPortMismatch(response.status, body)) {
      const retryAttempt = await fetchWithLocalFallback(httpsUrl, path, init);

      if (retryAttempt.response?.ok) {
        activeApiUrl = httpsUrl;

        if (retryAttempt.response.status === 204) {
          return undefined as TResponse;
        }

        return (await retryAttempt.response.json()) as TResponse;
      }
    }

    throw new Error(`${message} (HTTP ${response.status})\nAPI: ${activeApiUrl}${path}`);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

export const api = {
  login(payload: { username: string; password: string }) {
    return request<AuthResponseDto>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  me() {
    return request<MeResponseDto>("/auth/me");
  },
  completeProfile(payload: CompleteProfileInputDto) {
    return request<MeResponseDto>("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  logout() {
    return request<void>("/auth/logout", {
      method: "POST",
    });
  },
  getSettings() {
    return request<SettingsDto>("/settings");
  },
  updateSettings(payload: UpdateSettingsInputDto) {
    return request<SettingsDto>("/settings", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  getSessions(from: string, to: string) {
    return request<SessionsResponseDto>(`/sessions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  },
  getSummary(month: string) {
    return request<SummaryResponseDto>(`/sessions/summary?month=${encodeURIComponent(month)}`);
  },
  clockIn(payload: ClockInInputDto) {
    return request<SessionsResponseDto["sessions"][number]>("/sessions/clock-in", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  clockOut(id: string, payload: ClockOutInputDto) {
    return request<SessionsResponseDto["sessions"][number]>(`/sessions/${encodeURIComponent(id)}/clock-out`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
