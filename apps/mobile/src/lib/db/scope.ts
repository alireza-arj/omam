export const TEAM_SCOPE = "organizationId IS (SELECT organizationId FROM SyncState WHERE userId = WorkSession.userId)";
