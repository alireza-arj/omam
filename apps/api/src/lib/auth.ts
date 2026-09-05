import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Membership, Organization, User } from "@prisma/client";
import type { AuthMembershipDto, AuthUserDto, OrgRole } from "@omam/contracts";
import { ROLE_RANK } from "@omam/contracts";
import { prisma } from "./prisma";
import { forbidden, unauthorized } from "./errors";

const scrypt = promisify(scryptCallback);
const SCRYPT_KEY_LENGTH = 64;
const SESSION_DURATION_DAYS = 365;

export function normalizeUsername(input: string) {
  return input.trim().toLowerCase();
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;

  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [salt, expectedHex] = storedHash.split(":");

  if (!salt || !expectedHex) {
    return false;
  }

  const derived = (await scrypt(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");

  if (derived.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(derived, expected);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function serializeUser(user: User): AuthUserDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    isSuperAdmin: user.isSuperAdmin,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function serializeMembership(
  membership: Membership & { organization: Organization },
): AuthMembershipDto {
  return {
    organizationId: membership.organizationId,
    organizationName: membership.organization.name,
    organizationSlug: membership.organization.slug,
    role: membership.role,
    payType: membership.payType,
    hourlyRate: membership.hourlyRate,
    monthlySalary: membership.monthlySalary,
    currency: membership.currency,
    monthlyGoalHours: membership.monthlyGoalHours,
    calendar: membership.organization.calendar,
    requireApproval: membership.organization.requireApproval,
    jobTitle: membership.jobTitle,
  };
}

export async function createAuthSession(userId: string, deviceName?: string) {
  const token = randomBytes(32).toString("base64url");

  await prisma.authSession.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      deviceName: deviceName?.trim() || null,
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  return token;
}

export function parseBearerToken(authorizationHeader: string | undefined) {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim() || null;
}

export type Principal = {
  sessionId: string;
  user: User;
  /** The single organization this account belongs to, if any. */
  membership: (Membership & { organization: Organization }) | null;
};

export async function authenticateByBearerToken(token: string): Promise<Principal | null> {
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          memberships: {
            where: { status: "ACTIVE" },
            include: { organization: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  const { memberships, ...user } = session.user;

  // Touch at most once a minute: a sync-heavy client would otherwise write on
  // every request just to move this column a few seconds.
  if (!session.lastUsedAt || Date.now() - session.lastUsedAt.getTime() > 60_000) {
    await prisma.authSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });
  }

  return {
    sessionId: session.id,
    user,
    membership: memberships[0] ?? null,
  };
}

export async function revokeAuthSession(token: string) {
  await prisma.authSession.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessionsForUser(userId: string) {
  await prisma.authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function ensureUserDefaultSettings(userId: string, calendar?: "JALALI" | "GREGORIAN") {
  await prisma.appSettings.upsert({
    where: { userId },
    update: {},
    create: { userId, ...(calendar ? { calendar } : {}) },
  });
}

/** Throws unless the principal holds `minimum` or better in its organization. */
export function requireRole(principal: Principal, minimum: OrgRole) {
  if (principal.user.isSuperAdmin) {
    return;
  }

  if (!principal.membership) {
    throw forbidden("This account does not belong to an organization.");
  }

  if (ROLE_RANK[principal.membership.role] < ROLE_RANK[minimum]) {
    throw forbidden(`This action needs the ${minimum.toLowerCase()} role.`);
  }
}

/** The organization the request acts on, or a 403 when the account has none. */
export function requireOrganization(principal: Principal) {
  if (!principal.membership) {
    throw forbidden("This account does not belong to an organization.");
  }

  return principal.membership.organization;
}

export async function principalFromHeader(authorization: string | undefined) {
  const token = parseBearerToken(authorization);

  if (!token) {
    throw unauthorized();
  }

  const principal = await authenticateByBearerToken(token);

  if (!principal) {
    throw unauthorized();
  }

  return principal;
}
