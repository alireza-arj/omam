import * as Crypto from "expo-crypto";
import AsyncStorage from "../storage";
import type { SQLiteDatabase } from "../sqlite-context";
import type { AuthResponseDto, AuthMembershipDto } from "@omam/contracts";
import { createUser, getUserById, getUserByUsername, hashPassword, updateUserProfile } from "../db/auth";
import { upsertSettings } from "../db/settings";
import { readSyncState, writeSyncState } from "../db/sync";

export const linkKey = (userId: string) => `@omam:sync:${userId}`;
export type StoredLink = { token: string; serverUrl: string };

export async function activateTeam(db: SQLiteDatabase, userId: string, membership: AuthMembershipDto, serverUserId?: string, serverUsername?: string) {
  const previous = await readSyncState(db, userId);
  if (serverUserId && previous?.serverUserId && previous.serverUserId !== serverUserId) throw new Error("TEAM_MISMATCH");
  if (!previous?.organizationId) {
    await db.runAsync("UPDATE WorkSession SET organizationId = ? WHERE userId = ? AND organizationId IS NULL", [membership.organizationId, userId]);
  }
  await writeSyncState(db, userId, {
    organizationId: membership.organizationId, organizationName: membership.organizationName,
    ...(serverUserId ? { serverUserId, serverUsername } : {}),
    ...(previous?.organizationId !== membership.organizationId ? { cursor: null, lastSyncAt: null } : {}),
    lastError: null,
  });
}

export async function storeTeamAuth(db: SQLiteDatabase, userId: string, serverUrl: string, auth: AuthResponseDto) {
  if (!auth.membership) throw new Error("TEAM_REQUIRED");
  await activateTeam(db, userId, auth.membership, auth.user.id, auth.user.username);
  await AsyncStorage.setItem(linkKey(userId), JSON.stringify({ token: auth.token, serverUrl } satisfies StoredLink));
}

export async function cacheTeamAccount(db: SQLiteDatabase, serverUrl: string, auth: AuthResponseDto) {
  if (!auth.membership) throw new Error("TEAM_REQUIRED");
  const candidates = await db.getAllAsync<{ userId: string }>(
    "SELECT userId FROM SyncState WHERE serverUserId = ?", [auth.user.id],
  );
  let localId: string | undefined;
  for (const candidate of candidates) {
    const stored = await AsyncStorage.getItem(linkKey(candidate.userId));
    if (stored && (JSON.parse(stored) as StoredLink).serverUrl === serverUrl) localId = candidate.userId;
  }
  const identity = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify([serverUrl, auth.user.id]));
  const storageUsername = `@team:${identity}`;
  const existing = localId ? await getUserById(db, localId) : await getUserByUsername(db, storageUsername);
  const local = existing ?? await createUser(db, storageUsername, await hashPassword(auth.token), auth.membership.language);
  if (!existing) {
    await upsertSettings(db, local.id, {
      hourlyRate: auth.membership.hourlyRate, currency: auth.membership.currency,
      monthlyGoalHours: auth.membership.monthlyGoalHours, calendar: auth.membership.calendar, language: auth.membership.language,
    });
  }
  await storeTeamAuth(db, local.id, serverUrl, auth);
  const pending = await db.getFirstAsync<{ profileDirty: number }>("SELECT profileDirty FROM User WHERE id = ?", [local.id]);
  if (!pending?.profileDirty) await updateUserProfile(db, local.id, auth.user.nickname, auth.user.avatarUrl);
  return local.id;
}
