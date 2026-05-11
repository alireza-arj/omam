import type {
  AuthResponseDto,
  ClockInInput,
  ClockOutInput,
  CompleteProfileInput,
  LoginInput,
  SessionDto,
  SessionsResponseDto,
  SettingsDto,
  SummaryResponseDto,
  UpdateSettingsInput,
} from "@omam/contracts";
import { NativeModules, Platform } from "react-native";

const DEFAULT_API_PORT = Number(process.env.EXPO_PUBLIC_API_PORT ?? 3010);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
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
  const scriptURL = NativeModules?.SourceCode?.scriptURL as string | undefined;

  if (scriptURL) {
    try {
      const host = new URL(scriptURL).hostname;

      if (!LOOPBACK_HOSTS.has(host) && isPrivateOrLocalHost(host)) {
        return host;
      }
    } catch {
      // Ignore invalid script URLs and use platform defaults below.
    }
  }

  if (Platform.OS === "android") {
    return "10.0.2.2";
  }

  return null;
}

function normalizeUrl(rawUrl: string) {
  const value = (() => {
    if (rawUrl.includes("://")) {
      return rawUrl;
    }

    try {
      const candidate = new URL(`http://${rawUrl}`);
      const scheme = candidate.port === "443" ? "https" : "http";
      return `${scheme}://${rawUrl}`;
    } catch {
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

function resolveAndroidEmulatorUrl(baseUrl: string) {
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
  } catch {
    return null;
  }
}

export function setApiAuthToken(token: string | null) {
  authToken = token;
}

function buildRequestInit(init?: RequestInit) {
  return {
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  } satisfies RequestInit;
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
  if (status !== 400) {
    return false;
  }

  return /plain\s+http\s+request\s+was\s+sent\s+to\s+https\s+port/i.test(body);
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

async function fetchWithAndroidFallback(baseUrl: string, path: string, init?: RequestInit) {
  const requestInit = buildRequestInit(init);
  let response: Response | null = null;

  try {
    response = await fetch(`${baseUrl}${path}`, requestInit);
    return {
      response,
      networkError: null as unknown,
    };
  } catch (error) {
    const fallbackUrl = resolveAndroidEmulatorUrl(baseUrl);

    if (fallbackUrl) {
      try {
        response = await fetch(`${fallbackUrl}${path}`, requestInit);
        return {
          response,
          networkError: null as unknown,
        };
      } catch {
        // Fall through to return original network error below.
      }
    }

    return {
      response: null,
      networkError: error,
    };
  }
}

async function request<T>(path: string, init?: RequestInit) {
  const firstAttempt = await fetchWithAndroidFallback(activeApiUrl, path, init);

  if (!firstAttempt.response) {
    const fallbackMessage =
      firstAttempt.networkError instanceof Error ? firstAttempt.networkError.message : "Unknown network error";
    throw new Error(
      `Could not reach API at ${activeApiUrl}. Set EXPO_PUBLIC_API_URL (or EXPO_PUBLIC_API_PORT) for your device if needed. (${fallbackMessage})`,
    );
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
          return undefined as T;
        }

        return (await retryAttempt.response.json()) as T;
      }
    }

    throw new Error(`${message} (HTTP ${response.status})\nAPI: ${activeApiUrl}${path}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  login(payload: LoginInput) {
    return request<AuthResponseDto>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  me() {
    return request<{ user: AuthResponseDto["user"]; needsProfileSetup: boolean }>("/auth/me");
  },
  completeProfile(payload: CompleteProfileInput) {
    return request<{ user: AuthResponseDto["user"]; needsProfileSetup: boolean }>("/auth/profile", {
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
  updateSettings(payload: UpdateSettingsInput) {
    return request<SettingsDto>("/settings", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  getSessions(from: string, to: string) {
    return request<SessionsResponseDto>(`/sessions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  },
  getSummary(month: string) {
    return request<SummaryResponseDto>(`/sessions/summary?month=${month}`);
  },
  clockIn(payload: ClockInInput) {
    return request<SessionDto>("/sessions/clock-in", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  clockOut(id: string, payload: ClockOutInput) {
    return request<SessionDto>(`/sessions/${id}/clock-out`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
