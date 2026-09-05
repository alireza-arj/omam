import { prisma } from "./prisma";

/**
 * Records an administrative action. Payroll and rate changes are money
 * decisions, so who made them has to survive the change itself.
 */
export async function recordAudit(entry: {
  organizationId: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      organizationId: entry.organizationId,
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      metadata: (entry.metadata ?? {}) as object,
    },
  });
}
