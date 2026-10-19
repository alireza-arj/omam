import { Elysia } from "elysia";
import { randomInt, randomUUID } from "node:crypto";
import {
  createInviteInputSchema,
  createMemberInputSchema,
  createOrganizationInputSchema,
  selectOrganizationInputSchema,
  joinTeamInputSchema,
  resetMemberPasswordInputSchema,
  updateMemberInputSchema,
  updateOrganizationInputSchema,
  type MemberDto,
} from "@omam/contracts";
import { Prisma } from "@prisma/client";
import type { Membership, Organization, User } from "@prisma/client";
import { serializeMember } from "../lib/serialize";
import { prisma } from "../lib/prisma";
import { authenticated } from "../lib/context";
import {
  hashPassword,
  normalizeUsername,
  requireOrganization,
  requireRole,
  revokeAllSessionsForUser,
  serializeMembership,
} from "../lib/auth";
import { AppError, conflict, forbidden, invalid, notFound, parseInput } from "../lib/errors";
import { recordAudit } from "../lib/audit";
import { withSyncChange } from "../lib/sync-events";

/** No 0/O/1/I: these codes get read aloud and typed on a phone. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateInviteCode() {
  let code = "";

  for (let index = 0; index < 8; index += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }

  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** The constraint a P2002 violation names, lower-cased, however Prisma reports it. */
function uniqueTarget(error: Prisma.PrismaClientKnownRequestError) {
  const meta = error.meta as
    | {
        target?: unknown;
        driverAdapterError?: { cause?: { constraint?: { index?: string; fields?: string[] } } };
      }
    | undefined;
  const target = meta?.target;
  const constraint = meta?.driverAdapterError?.cause?.constraint;

  return [
    Array.isArray(target) ? target.join(",") : typeof target === "string" ? target : "",
    constraint?.index ?? "",
    ...(constraint?.fields ?? []),
  ]
    .join(",")
    .toLowerCase();
}

function serializeOrganization(organization: Organization) {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    timezone: organization.timezone,
    calendar: organization.calendar,
    language: organization.language,
    currency: organization.currency,
    defaultHourlyRate: organization.defaultHourlyRate,
    monthlyGoalHours: organization.monthlyGoalHours,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
  };
}


async function loadMembership(organizationId: string, membershipId: string) {
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId },
    include: { user: true },
  });

  if (!membership) {
    throw notFound("Member not found.");
  }

  return membership;
}

/** The team must never end up with nobody who can administer it. */
async function assertNotLastOwner(organizationId: string, membership: Membership) {
  if (membership.role !== "OWNER") {
    return;
  }

  const owners = await prisma.membership.count({
    where: { organizationId, role: "OWNER", status: "ACTIVE" },
  });

  if (owners <= 1) {
    throw conflict("The team needs at least one active owner.", "LAST_OWNER");
  }
}

export const teamRoutes = new Elysia({ prefix: "/team" })
  .use(authenticated)

  .get("/organizations", async ({ principal }) => ({
    memberships: (await prisma.membership.findMany({
      where: { userId: principal.user.id, status: "ACTIVE" },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    })).map(serializeMembership),
  }))

  .post("/organizations", async ({ principal, body }) => {
    requireRole(principal, "MANAGER");
    const payload = parseInput(createOrganizationInputSchema, body);
    const membership = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { ...payload, slug: `team-${randomUUID().slice(0, 12)}` },
      });
      return tx.membership.create({
        data: { organizationId: organization.id, userId: principal.user.id, role: "OWNER" },
        include: { organization: true },
      });
    });
    await recordAudit({ organizationId: membership.organizationId, actorId: principal.user.id,
      action: "organization.created", targetType: "organization", targetId: membership.organizationId });
    return serializeMembership(membership);
  })

  .post("/select", async ({ principal, body }) => {
    const payload = parseInput(selectOrganizationInputSchema, body);
    const membership = await prisma.membership.findFirst({
      where: { userId: principal.user.id, organizationId: payload.organizationId, status: "ACTIVE" },
      include: { organization: true },
    });
    if (!membership) throw forbidden("You do not belong to this team.");
    await prisma.authSession.update({ where: { id: principal.sessionId }, data: { organizationId: membership.organizationId } });
    return serializeMembership(membership);
  })

  .post("/join", async ({ principal, body }) => {
    const payload = parseInput(joinTeamInputSchema, body);
    const invite = await prisma.invite.findUnique({ where: { code: payload.inviteCode.toUpperCase() }, include: { organization: true } });
    if (!invite || invite.userId || invite.revokedAt || invite.acceptedAt || invite.expiresAt <= new Date()) {
      throw new AppError(422, "That invite code is not valid.", "INVALID_INVITE");
    }
    const membership = await prisma.$transaction(async (tx) => {
      const claimed = await tx.invite.updateMany({
        where: { id: invite.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { acceptedAt: new Date(), acceptedById: principal.user.id },
      });
      if (!claimed.count) throw conflict("That invite has already been used.", "INVALID_INVITE");
      const existing = await tx.membership.findUnique({ where: { organizationId_userId: { organizationId: invite.organizationId, userId: principal.user.id } } });
      if (existing) throw conflict("This account already belongs to this team.", "ALREADY_IN_TEAM");
      return tx.membership.create({
        data: { organizationId: invite.organizationId, userId: principal.user.id, role: invite.role,
          payType: invite.payType, hourlyRate: invite.hourlyRate, monthlySalary: invite.monthlySalary,
          currency: invite.organization.currency, monthlyGoalHours: invite.organization.monthlyGoalHours },
        include: { organization: true },
      });
    });
    await recordAudit({ organizationId: membership.organizationId, actorId: principal.user.id,
      action: "member.joined", targetType: "membership", targetId: membership.id });
    return serializeMembership(membership);
  })

  .get("/organization", ({ principal }) => serializeOrganization(requireOrganization(principal)))

  .patch("/organization", async ({ principal, body }) => {
    requireRole(principal, "OWNER");

    const organization = requireOrganization(principal);
    const payload = parseInput(updateOrganizationInputSchema, body);

    const updated = await withSyncChange({ organizationId: organization.id }, (tx) => tx.organization.update({
      where: { id: organization.id },
      data: payload,
    }));

    await recordAudit({
      organizationId: organization.id,
      actorId: principal.user.id,
      action: "organization.updated",
      targetType: "organization",
      targetId: organization.id,
      metadata: payload,
    });

    return serializeOrganization(updated);
  })

  .get("/members", async ({ principal }) => {
    requireRole(principal, "MANAGER");

    const organization = requireOrganization(principal);
    const members = await prisma.membership.findMany({
      where: { organizationId: organization.id },
      include: { user: true },
      orderBy: [{ status: "asc" }, { role: "asc" }, { createdAt: "asc" }],
    });

    return { members: members.map(serializeMember) };
  })

  .post("/members", async ({ principal, body }) => {
    requireRole(principal, "MANAGER");

    const organization = requireOrganization(principal);
    const payload = parseInput(createMemberInputSchema, body);
    const isOwner = principal.user.isSuperAdmin || principal.membership?.role === "OWNER";

    if (payload.organizationId !== organization.id) {
      throw conflict("The selected team changed. Reload and try again.", "TEAM_CHANGED");
    }

    if (payload.role !== "MEMBER" && !isOwner) {
      throw forbidden("Only an owner can add a manager.");
    }

    const username = normalizeUsername(payload.username);

    if (await prisma.user.findUnique({ where: { username }, select: { id: true } })) {
      throw conflict("That username is already taken.", "USERNAME_TAKEN");
    }

    if (payload.employeeCode) {
      const clash = await prisma.membership.findFirst({
        where: { organizationId: organization.id, employeeCode: payload.employeeCode },
        select: { id: true },
      });

      if (clash) {
        throw conflict("That employee code is already in use.", "EMPLOYEE_CODE_TAKEN");
      }
    }

    const passwordHash = await hashPassword(payload.password);
    const monthlyGoalHours = payload.monthlyGoalHours ?? organization.monthlyGoalHours;

    let membership: Membership & { user: User };
    try {
      membership = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { username, passwordHash, nickname: payload.nickname?.trim() || null },
        });

        await tx.appSettings.create({
          data: {
            userId: created.id,
            calendar: organization.calendar,
            language: organization.language,
            currency: organization.currency,
            monthlyGoalHours,
          },
        });

        return tx.membership.create({
          data: {
            organizationId: organization.id,
            userId: created.id,
            role: payload.role,
            employeeCode: payload.employeeCode ?? null,
            jobTitle: payload.jobTitle ?? null,
            hourlyRate: organization.defaultHourlyRate,
            currency: organization.currency,
            monthlyGoalHours,
          },
          include: { user: true },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = uniqueTarget(error);

        if (target.includes("employeecode")) {
          throw conflict("That employee code is already in use.", "EMPLOYEE_CODE_TAKEN");
        }

        if (target.includes("username")) {
          throw conflict("That username is already taken.", "USERNAME_TAKEN");
        }
      }

      throw error;
    }

    await recordAudit({
      organizationId: organization.id,
      actorId: principal.user.id,
      action: "member.created",
      targetType: "membership",
      targetId: membership.id,
      metadata: { username, role: membership.role },
    });

    return serializeMember(membership);
  })

  .patch("/members/:membershipId", async ({ principal, params, body }) => {
    requireRole(principal, "MANAGER");

    const organization = requireOrganization(principal);
    const payload = parseInput(updateMemberInputSchema, body);
    const membership = await loadMembership(organization.id, params.membershipId);
    const isOwner = principal.user.isSuperAdmin || principal.membership?.role === "OWNER";

    if (membership.role === "OWNER" && !isOwner) {
      throw forbidden("Only an owner can edit another owner.");
    }

    if (payload.role && payload.role !== membership.role) {
      if (!isOwner) {
        throw forbidden("Only an owner can change roles.");
      }

      if (membership.role === "OWNER") {
        await assertNotLastOwner(organization.id, membership);
      }
    }

    if (payload.status === "SUSPENDED" && membership.status === "ACTIVE") {
      await assertNotLastOwner(organization.id, membership);
    }

    if (payload.employeeCode) {
      const clash = await prisma.membership.findFirst({
        where: {
          organizationId: organization.id,
          employeeCode: payload.employeeCode,
          id: { not: membership.id },
        },
        select: { id: true },
      });

      if (clash) {
        throw conflict("That employee code is already in use.", "EMPLOYEE_CODE_TAKEN");
      }
    }

    const updated = await withSyncChange({ organizationId: organization.id, userId: membership.userId }, async (tx) => {
      const updated = await tx.membership.update({
        where: { id: membership.id },
        data: {
          ...payload,
          ...(payload.status === "SUSPENDED" && membership.status === "ACTIVE"
            ? { leftAt: new Date() }
            : {}),
          ...(payload.status === "ACTIVE" ? { leftAt: null } : {}),
        },
        include: { user: true },
      });
      if (updated.status === "SUSPENDED") {
        await tx.authSession.updateMany({
          where: { userId: updated.userId, organizationId: organization.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return updated;
    });

    await recordAudit({
      organizationId: organization.id,
      actorId: principal.user.id,
      action: "member.updated",
      targetType: "membership",
      targetId: membership.id,
      metadata: { username: membership.user.username, changes: payload },
    });

    return serializeMember(updated);
  })

  .post("/members/:membershipId/reset-password", async ({ principal, params, body }) => {
    requireRole(principal, "MANAGER");

    const organization = requireOrganization(principal);
    const payload = parseInput(resetMemberPasswordInputSchema, body);
    const membership = await loadMembership(organization.id, params.membershipId);
    const isOwner = principal.user.isSuperAdmin || principal.membership?.role === "OWNER";

    if (membership.role === "OWNER" && !isOwner) {
      throw forbidden("Only an owner can reset an owner's password.");
    }

    await prisma.user.update({
      where: { id: membership.userId },
      data: { passwordHash: await hashPassword(payload.nextPassword) },
    });

    await revokeAllSessionsForUser(membership.userId);

    await recordAudit({
      organizationId: organization.id,
      actorId: principal.user.id,
      action: "member.password_reset",
      targetType: "membership",
      targetId: membership.id,
      metadata: { username: membership.user.username },
    });

    return { ok: true };
  })

  .get("/invites", async ({ principal }) => {
    requireRole(principal, "MANAGER");

    const organization = requireOrganization(principal);
    const invites = await prisma.invite.findMany({
      where: { organizationId: organization.id },
      include: { createdBy: true, acceptedBy: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return {
      invites: invites.map((invite) => ({
        id: invite.id,
        userId: invite.userId,
        code: invite.code,
        role: invite.role,
        label: invite.label,
        payType: invite.payType,
        hourlyRate: invite.hourlyRate,
        monthlySalary: invite.monthlySalary,
        createdByName: invite.createdBy.nickname ?? invite.createdBy.username,
        acceptedByName: invite.acceptedBy?.nickname ?? invite.acceptedBy?.username ?? null,
        acceptedAt: invite.acceptedAt?.toISOString() ?? null,
        revokedAt: invite.revokedAt?.toISOString() ?? null,
        expiresAt: invite.expiresAt.toISOString(),
        createdAt: invite.createdAt.toISOString(),
      })),
    };
  })

  .post("/invites", async ({ principal, body }) => {
    requireRole(principal, "MANAGER");

    const organization = requireOrganization(principal);
    const payload = parseInput(createInviteInputSchema, body);
    const isOwner = principal.user.isSuperAdmin || principal.membership?.role === "OWNER";

    if (payload.role !== "MEMBER" && !isOwner) {
      throw forbidden("Only an owner can invite a manager or an owner.");
    }

    const recipient = payload.userId ? await prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: organization.id, userId: payload.userId } },
      include: { user: true },
    }) : null;
    if (payload.userId && (!recipient || recipient.status !== "ACTIVE")) throw notFound("Member not found.");
    if (recipient && recipient.role !== "MEMBER" && !isOwner) throw forbidden("Only an owner can issue codes for a manager or owner.");

    const invite = await prisma.invite.create({
      data: {
        organizationId: organization.id,
        code: generateInviteCode(),
        userId: recipient?.userId,
        role: recipient?.role ?? payload.role,
        label: recipient?.user.username ?? payload.label ?? null,
        payType: payload.payType,
        hourlyRate: payload.hourlyRate || organization.defaultHourlyRate,
        monthlySalary: payload.monthlySalary,
        createdById: principal.user.id,
        expiresAt: new Date(Date.now() + payload.expiresInDays * 24 * 60 * 60 * 1000),
      },
      include: { createdBy: true },
    });

    await recordAudit({
      organizationId: organization.id,
      actorId: principal.user.id,
      action: "invite.created",
      targetType: "invite",
      targetId: invite.id,
      metadata: { role: invite.role, label: invite.label },
    });

    return {
      id: invite.id,
      userId: invite.userId,
      code: invite.code,
      role: invite.role,
      label: invite.label,
      payType: invite.payType,
      hourlyRate: invite.hourlyRate,
      monthlySalary: invite.monthlySalary,
      createdByName: invite.createdBy.nickname ?? invite.createdBy.username,
      acceptedByName: null,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: invite.expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
    };
  })

  .delete("/invites/:id", async ({ principal, params }) => {
    requireRole(principal, "MANAGER");

    const organization = requireOrganization(principal);
    const invite = await prisma.invite.findFirst({
      where: { id: params.id, organizationId: organization.id },
    });

    if (!invite) {
      throw notFound("Invite not found.");
    }

    if (invite.acceptedAt) {
      throw invalid("That invite has already been used.");
    }

    await prisma.invite.update({ where: { id: invite.id }, data: { revokedAt: new Date() } });

    await recordAudit({
      organizationId: organization.id,
      actorId: principal.user.id,
      action: "invite.revoked",
      targetType: "invite",
      targetId: invite.id,
    });

    return { ok: true };
  })

  .get("/audit", async ({ principal, query }) => {
    requireRole(principal, "MANAGER");

    const organization = requireOrganization(principal);
    const take = Math.min(Number(query.pageSize ?? 50) || 50, 200);
    const page = Math.max(Number(query.page ?? 1) || 1, 1);

    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { organizationId: organization.id },
        include: { actor: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * take,
        take,
      }),
      prisma.auditLog.count({ where: { organizationId: organization.id } }),
    ]);

    return {
      total,
      entries: entries.map((entry) => ({
        id: entry.id,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        actorName: entry.actor?.nickname ?? entry.actor?.username ?? null,
        metadata: entry.metadata,
        createdAt: entry.createdAt.toISOString(),
      })),
    };
  });
