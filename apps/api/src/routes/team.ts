import { Elysia } from "elysia";
import { randomInt } from "node:crypto";
import {
  createInviteInputSchema,
  resetMemberPasswordInputSchema,
  updateMemberInputSchema,
  updateOrganizationInputSchema,
  type MemberDto,
} from "@omam/contracts";
import type { Membership, Organization, User } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticated } from "../lib/context";
import {
  hashPassword,
  requireOrganization,
  requireRole,
  revokeAllSessionsForUser,
} from "../lib/auth";
import { conflict, forbidden, invalid, notFound, parseInput } from "../lib/errors";
import { recordAudit } from "../lib/audit";

/** No 0/O/1/I: these codes get read aloud and typed on a phone. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateInviteCode() {
  let code = "";

  for (let index = 0; index < 8; index += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }

  return `${code.slice(0, 4)}-${code.slice(4)}`;
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
    requireApproval: organization.requireApproval,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
  };
}

function serializeMember(membership: Membership & { user: User }): MemberDto {
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

  .get("/organization", ({ principal }) => serializeOrganization(requireOrganization(principal)))

  .patch("/organization", async ({ principal, body }) => {
    requireRole(principal, "OWNER");

    const organization = requireOrganization(principal);
    const payload = parseInput(updateOrganizationInputSchema, body);

    const updated = await prisma.organization.update({
      where: { id: organization.id },
      data: payload,
    });

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

    const updated = await prisma.membership.update({
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

    // Suspension has to reach the phone in the member's pocket, not just the
    // next login.
    if (updated.status === "SUSPENDED") {
      await revokeAllSessionsForUser(updated.userId);
    }

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

    const invite = await prisma.invite.create({
      data: {
        organizationId: organization.id,
        code: generateInviteCode(),
        role: payload.role,
        label: payload.label ?? null,
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
