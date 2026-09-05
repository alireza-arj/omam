import { Elysia } from "elysia";
import {
  changePasswordInputSchema,
  completeProfileInputSchema,
  loginInputSchema,
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

function needsProfileSetup(nickname: string | null) {
  return !nickname?.trim();
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

    const token = await createAuthSession(user.id, payload.deviceName);

    return {
      token,
      user: serializeUser(user),
      membership: membership ? serializeMembership(membership) : null,
      needsProfileSetup: needsProfileSetup(user.nickname),
    };
  })

  /** Joining a team always goes through a manager-issued invite code. */
  .post("/register", async ({ body }) => {
    const payload = parseInput(registerInputSchema, body);
    const username = normalizeUsername(payload.username);
    const code = payload.inviteCode.trim().toUpperCase();

    const invite = await prisma.invite.findUnique({
      where: { code },
      include: { organization: true },
    });

    if (!invite || invite.revokedAt || invite.acceptedAt) {
      throw invalid("That invite code is not valid.");
    }

    if (invite.expiresAt.getTime() <= Date.now()) {
      throw invalid("That invite code has expired.");
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

      await tx.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date(), acceptedById: created.id },
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
    const token = await createAuthSession(user.id, payload.deviceName);

    return {
      token,
      user: serializeUser(user),
      membership: membership ? serializeMembership(membership) : null,
      needsProfileSetup: needsProfileSetup(user.nickname),
    };
  })

  .use(authenticated)

  .get("/me", ({ principal }) => ({
    user: serializeUser(principal.user),
    membership: principal.membership ? serializeMembership(principal.membership) : null,
    needsProfileSetup: needsProfileSetup(principal.user.nickname),
  }))

  .patch("/profile", async ({ principal, body }) => {
    const payload = parseInput(completeProfileInputSchema, body);
    const nextAvatar = payload.avatarUrl?.trim() || null;

    if (nextAvatar && !/^(data:image\/|https?:\/\/)/i.test(nextAvatar)) {
      throw invalid("Avatar must be an image data URL or an HTTP URL.");
    }

    const updated = await prisma.user.update({
      where: { id: principal.user.id },
      data: { nickname: payload.nickname.trim(), avatarUrl: nextAvatar },
    });

    return {
      user: serializeUser(updated),
      membership: principal.membership ? serializeMembership(principal.membership) : null,
      needsProfileSetup: needsProfileSetup(updated.nickname),
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

    return { token: await createAuthSession(principal.user.id, "password-change") };
  })

  .post("/logout", async ({ headers, set }) => {
    const token = parseBearerToken(headers.authorization);

    if (token) {
      await revokeAuthSession(token);
    }

    set.status = 204;

    return null;
  });
