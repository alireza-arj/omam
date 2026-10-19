import { Platform } from "react-native";
import { configuredServerUrl } from "./server-url";
import type { Translator } from "@omam/i18n";
import type { AuthResponseDto, AuthMembershipDto, SessionUserResponseDto, TeamsResponseDto, CompleteProfileInputDto, SyncRequestDto, SyncResponseDto, PushConfigurationDto, PushSubscriptionInputDto } from "@omam/contracts";

export function resolveServerUrl() {
  return configuredServerUrl({
    platform: Platform.OS,
    origin: typeof window !== "undefined" ? window.location.origin : undefined,
    isDevelopment: __DEV__,
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    apiPort: process.env.EXPO_PUBLIC_API_PORT,
  });
}

export class SyncError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
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
        ? "SERVER_TIMEOUT"
        : "SERVER_UNREACHABLE",
    );
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const detail = payload as { message?: string; code?: string } | null;

    throw new SyncError(detail?.code ?? "REQUEST_FAILED", response.status, detail?.code);
  }

  return payload as T;
}

export function signInWithInvite(baseUrl: string, inviteCode: string, t: Translator) {
  return call<AuthResponseDto>(baseUrl, "/auth/invite-login", t, {
    method: "POST", body: { inviteCode, deviceName: `${Platform.OS} app` },
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

export const serverTeams = (baseUrl: string, token: string, t: Translator) =>
  call<TeamsResponseDto>(baseUrl, "/team/organizations", t, { token });
export const selectServerTeam = (baseUrl: string, token: string, organizationId: string, t: Translator) =>
  call<AuthMembershipDto>(baseUrl, "/team/select", t, { method: "POST", token, body: { organizationId } });
export const updateServerProfile = (baseUrl: string, token: string, body: CompleteProfileInputDto, t: Translator) =>
  call<SessionUserResponseDto>(baseUrl, "/auth/profile", t, { method: "PATCH", token, body });
export const changeServerPassword = (baseUrl: string, token: string, currentPassword: string, nextPassword: string, t: Translator) =>
  call<{ token: string }>(baseUrl, "/auth/change-password", t, { method: "POST", token, body: { currentPassword, nextPassword } });

export const serverPushConfiguration = (baseUrl: string, token: string, t: Translator) =>
  call<PushConfigurationDto>(baseUrl, "/notifications/configuration", t, { token });
export const saveServerPushSubscription = (baseUrl: string, token: string, body: PushSubscriptionInputDto, t: Translator) =>
  call<{ ok: true }>(baseUrl, "/notifications/subscription", t, { method: "POST", token, body });
export const removeServerPushSubscription = (baseUrl: string, token: string, endpoint: string, t: Translator) =>
  call<{ ok: true }>(baseUrl, "/notifications/subscription", t, { method: "DELETE", token, body: { endpoint } });
