import type { Project, WorkSession } from "@prisma/client";
import type { SessionDto } from "@omam/contracts";

export type SessionWithProject = WorkSession & { project?: Project | null };

export function serializeSession(session: SessionWithProject): SessionDto {
  return {
    id: session.id,
    userId: session.userId,
    clientId: session.clientId,
    startAt: session.startAt.toISOString(),
    endAt: session.endAt?.toISOString() ?? null,
    durationMinutes: session.durationMinutes,
    category: session.category,
    status: session.status,
    source: session.source,
    note: session.note,
    reviewNote: session.reviewNote,
    project: session.project
      ? { id: session.project.id, name: session.project.name, color: session.project.color }
      : null,
    approvedAt: session.approvedAt?.toISOString() ?? null,
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
