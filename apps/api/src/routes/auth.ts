import { Elysia } from "elysia";
import {
  changePasswordInputSchema,
  completeProfileInputSchema,
  loginInputSchema,
  inviteLoginInputSchema,
  registerInputSchema,
} from "@omam/contracts";
import { prisma } from "../lib/prisma";
import {
  createAuthSession,
  ensureUserDefaultSettings,
  hashPassword,
  normalizeUsername,
  parseBearerToken,
  revokeAllSessionsForUser,
  revokeAuthSession,
  serializeMembership,
  serializeUser,
  verifyPassword,
} from "../lib/auth";
import { authenticated } from "../lib/context";
import { AppError, conflict, invalid, parseInput, unauthorized } from "../lib/errors";
import { recordAudit } from "../lib/audit";

/** Identical for an unknown username and a wrong password, on purpose. */
const INVALID_CREDENTIALS = "Invalid username or password.";

async function loadMembership(userId: string) {
  return prisma.membership.findFirst({
    where: { userId, status: "ACTIVE" },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
}

export const authRoutes = new Elysia({ prefix: "/auth" })
  .post("/login", async ({ body }) => {
    const payload = parseInput(loginInputSchema, body);
    const username = normalizeUsername(payload.username);
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user || !(await verifyPassword(payload.password, user.passwordHash))) {
      throw unauthorized(INVALID_CREDENTIALS);
    }

    const membership = await loadMembership(user.id);

    await ensureUserDefaultSettings(user.id, {
      calendar: membership?.organization.calendar,
      language: membership?.organization.language,
    });
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const token = await createAuthSession(user.id, payload.deviceName, membership?.organizationId);

    return {
      token,
      user: serializeUser(user),
      membership: membership ? serializeMembership(membership) : null,
      needsProfileSetup: false,
    };
  })

  .post("/invite-login", async ({ body }) => {
    const payload = parseInput(inviteLoginInputSchema, body);
    const code = `${payload.inviteCode.slice(0, 4)}-${payload.inviteCode.slice(4)}`;
    const result = await prisma.$transaction(async (tx) => {
      const invite = await tx.invite.findUnique({ where: { code } });
      if (!invite?.userId || invite.revokedAt || invite.acceptedAt || invite.expiresAt <= new Date()) {
        throw new AppError(422, "INVALID_INVITE", "INVALID_INVITE");
      }
      const membership = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId: invite.organizationId, userId: invite.userId } },
        include: { organization: true, user: true },
      });
      if (!membership || membership.status !== "ACTIVE") throw new AppError(422, "INVALID_INVITE", "INVALID_INVITE");
      const claimed = await tx.invite.updateMany({
        where: { id: invite.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { acceptedAt: new Date(), acceptedById: membership.userId },
      });
      if (!claimed.count) throw new AppError(422, "INVALID_INVITE", "INVALID_INVITE");
      await tx.user.update({ where: { id: membership.userId }, data: { lastLoginAt: new Date() } });
      const token = await createAuthSession(membership.userId, payload.deviceName, membership.organizationId, tx);
      await tx.auditLog.create({ data: { organizationId: membership.organizationId, actorId: membership.userId,
        action: "member.invite_login", targetType: "user", targetId: membership.userId } });
      return { membership, token };
    });
    return { token: result.token, user: serializeUser(result.membership.user), membership: serializeMembership(result.membership), needsProfileSetup: false };
  })

  /** Joining a team always goes through a manager-issued invite code. */
  .post("/register", async ({ body }) => {
    const payload = parseInput(registerInputSchema, body);
    const username = normalizeUsername(payload.username);
    if (!payload.inviteCode) {
      if (await prisma.user.findUnique({ where: { username } })) throw conflict("USERNAME_TAKEN", "USERNAME_TAKEN");
      const user = await prisma.user.create({ data: { username, passwordHash: await hashPassword(payload.password) } });
      await ensureUserDefaultSettings(user.id);
      return { token: await createAuthSession(user.id, payload.deviceName), user: serializeUser(user), membership: null, needsProfileSetup: false };
    }
    const code = payload.inviteCode.trim().toUpperCase();

    const invite = await prisma.invite.findUnique({
      where: { code },
      include: { organization: true },
    });

    if (!invite || invite.userId || invite.revokedAt || invite.acceptedAt) {
      throw new AppError(422, "That invite code is not valid.", "INVALID_INVITE");
    }

    if (invite.expiresAt.getTime() <= Date.now()) {
      throw new AppError(422, "That invite code has expired.", "INVALID_INVITE");
    }

    if (await prisma.user.findUnique({ where: { username } })) {
      throw conflict("That username is already taken.", "USERNAME_TAKEN");
    }

    const passwordHash = await hashPassword(payload.password);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username,
          passwordHash,
          nickname: payload.nickname?.trim() || null,
          lastLoginAt: new Date(),
        },
      });

      const claimed = await tx.invite.updateMany({
        where: { id: invite.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { acceptedAt: new Date(), acceptedById: created.id },
      });
      if (!claimed.count) throw new AppError(422, "That invite code is not valid.", "INVALID_INVITE");

      await tx.membership.create({
        data: {
          organizationId: invite.organizationId,
          userId: created.id,
          role: invite.role,
          payType: invite.payType,
          hourlyRate: invite.hourlyRate || invite.organization.defaultHourlyRate,
          monthlySalary: invite.monthlySalary,
          currency: invite.organization.currency,
          monthlyGoalHours: invite.organization.monthlyGoalHours,
        },
      });

      await tx.appSettings.create({
        data: {
          userId: created.id,
          calendar: invite.organization.calendar,
          language: invite.organization.language,
          currency: invite.organization.currency,
          monthlyGoalHours: invite.organization.monthlyGoalHours,
        },
      });

      return created;
    });

    await recordAudit({
      organizationId: invite.organizationId,
      actorId: user.id,
      action: "member.joined",
      targetType: "user",
      targetId: user.id,
      metadata: { username, role: invite.role, inviteId: invite.id },
    });

    const membership = await loadMembership(user.id);
    const token = await createAuthSession(user.id, payload.deviceName, membership?.organizationId);

    return {
      token,
      user: serializeUser(user),
      membership: membership ? serializeMembership(membership) : null,
      needsProfileSetup: false,
    };
  })

  .use(authenticated)

  .get("/me", ({ principal }) => ({
    user: serializeUser(principal.user),
    membership: principal.membership ? serializeMembership(principal.membership) : null,
    needsProfileSetup: false,
  }))

  .patch("/profile", async ({ principal, body }) => {
    const payload = parseInput(completeProfileInputSchema, body);
    const nextAvatar = payload.avatarUrl?.trim() || null;

    if (nextAvatar && !/^(data:image\/|https?:\/\/)/i.test(nextAvatar)) {
      throw invalid("Avatar must be an image data URL or an HTTP URL.");
    }

    const updated = await prisma.user.update({
      where: { id: principal.user.id },
      data: { nickname: payload.nickname.trim(), ...(payload.avatarUrl !== undefined ? { avatarUrl: nextAvatar } : {}) },
    });

    return {
      user: serializeUser(updated),
      membership: principal.membership ? serializeMembership(principal.membership) : null,
      needsProfileSetup: false,
    };
  })

  .post("/change-password", async ({ principal, body }) => {
    const payload = parseInput(changePasswordInputSchema, body);

    if (!(await verifyPassword(payload.currentPassword, principal.user.passwordHash))) {
      throw new AppError(422, "Current password is incorrect.", "WRONG_PASSWORD");
    }

    await prisma.user.update({
      where: { id: principal.user.id },
      data: { passwordHash: await hashPassword(payload.nextPassword) },
    });

    // Every other device holds a token minted against the old password.
    await revokeAllSessionsForUser(principal.user.id);

    return { token: await createAuthSession(principal.user.id, "password-change", principal.membership?.organizationId) };
  })

  .post("/logout", async ({ headers, set }) => {
    const token = parseBearerToken(headers.authorization);

    if (token) {
      await revokeAuthSession(token);
    }

    set.status = 204;

    return null;
  });
