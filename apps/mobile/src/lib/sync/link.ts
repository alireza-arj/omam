import AsyncStorage from "../storage";
import type { SQLiteDatabase } from "../sqlite-context";
import type { AuthResponseDto, AuthMembershipDto } from "@omam/contracts";
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
