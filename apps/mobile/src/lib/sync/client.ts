import { Platform } from "react-native";
import type { Translator } from "@omam/i18n";
import type { AuthResponseDto, SyncRequestDto, SyncResponseDto } from "@omam/contracts";

/**
 * Where the team server lives.
 *
 * The address the member types wins, because a deployed team server is not
 * something the bundle can guess. The env values are the convenience path for
 * running the API next to Metro during development.
 */
export function resolveServerUrl(stored: string | null | undefined) {
  const explicit = stored?.trim() || process.env.EXPO_PUBLIC_API_URL?.trim();

  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  const port = process.env.EXPO_PUBLIC_API_PORT?.trim() || "3001";

  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:${port}`;
  }

  return `http://${Platform.OS === "android" ? "10.0.2.2" : "localhost"}:${port}`;
}

export class SyncError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "SyncError";
  }
}

/** A phone on a flaky connection must fail in seconds, not hang the screen. */
const TIMEOUT_MS = 15_000;

async function call<T>(
  baseUrl: string,
  path: string,
  t: Translator,
  options: { method?: string; token?: string | null; body?: unknown } = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      signal: controller.signal,
      headers: {
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch (cause) {
    throw new SyncError(
      cause instanceof Error && cause.name === "AbortError"
        ? t("team.timedOut")
        : t("team.unreachable"),
    );
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const detail = payload as { message?: string } | null;

    throw new SyncError(detail?.message ?? t("team.rejected"), response.status);
  }

  return payload as T;
}

export function signInToServer(
  baseUrl: string,
  username: string,
  password: string,
  t: Translator,
) {
  return call<AuthResponseDto>(baseUrl, "/auth/login", t, {
    method: "POST",
    body: { username, password, deviceName: `${Platform.OS} app` },
  });
}

export function registerOnServer(
  baseUrl: string,
  input: { username: string; password: string; inviteCode: string; nickname?: string },
  t: Translator,
) {
  return call<AuthResponseDto>(baseUrl, "/auth/register", t, {
    method: "POST",
    body: { ...input, deviceName: `${Platform.OS} app` },
  });
}

export function pushAndPull(
  baseUrl: string,
  token: string,
  body: SyncRequestDto,
  t: Translator,
) {
  return call<SyncResponseDto>(baseUrl, "/sync", t, { method: "POST", token, body });
}
