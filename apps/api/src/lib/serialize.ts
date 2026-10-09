import type { Project, WorkSession, Membership, User } from "@prisma/client";
import type { SessionDto, MemberDto } from "@omam/contracts";

export type SessionWithProject = WorkSession & { project?: Project | null };

export function serializeSession(session: SessionWithProject): SessionDto {
  return {
    id: session.id,
    userId: session.userId,
    organizationId: session.organizationId,
    clientId: session.clientId,
    deviceId: session.deviceId,
    deviceName: session.deviceName,
    startAt: session.startAt.toISOString(),
    endAt: session.endAt?.toISOString() ?? null,
    durationMinutes: session.durationMinutes,
    category: session.category,
    status: session.status,
    source: session.source,
    note: session.note,
    project: session.project
      ? { id: session.project.id, name: session.project.name, color: session.project.color }
      : null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export function serializeSyncSession(session: SessionWithProject) {
  return {
    ...serializeSession(session),
    deletedAt: session.deletedAt?.toISOString() ?? null,
  };
}

export function serializeMember(membership: Membership & { user: User }): MemberDto {
  return {
    membershipId: membership.id,
    userId: membership.userId,
    username: membership.user.username,
    nickname: membership.user.nickname,
    avatarUrl: membership.user.avatarUrl,
    email: membership.user.email,
    role: membership.role,
    status: membership.status,
    employeeCode: membership.employeeCode,
    jobTitle: membership.jobTitle,
    payType: membership.payType,
    hourlyRate: membership.hourlyRate,
    monthlySalary: membership.monthlySalary,
    currency: membership.currency,
    monthlyGoalHours: membership.monthlyGoalHours,
    joinedAt: membership.joinedAt.toISOString(),
    leftAt: membership.leftAt?.toISOString() ?? null,
    lastLoginAt: membership.user.lastLoginAt?.toISOString() ?? null,
  };
}
