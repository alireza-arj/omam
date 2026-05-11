import { Elysia, status, t } from "elysia";
import { completeProfileInputSchema, loginInputSchema } from "@omam/contracts";
import { prisma } from "../lib/prisma";
import {
  authenticateByBearerToken,
  createAuthSession,
  ensureUserDefaultSettings,
  hashPassword,
  normalizeUsername,
  parseBearerToken,
  revokeAuthSession,
  verifyPassword,
} from "../lib/auth";

function toAuthPayload(user: {
  id: string;
  username: string;
  nickname: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function needsProfileSetup(user: { nickname: string | null }) {
  return !user.nickname?.trim();
}

export const authRoutes = new Elysia({ prefix: "/auth" })
  .post(
    "/login",
    async ({ body }) => {
      const payload = loginInputSchema.parse(body);
      const username = normalizeUsername(payload.username);

      const userCount = await prisma.user.count();
      let user = await prisma.user.findUnique({
        where: {
          username,
        },
      });

      if (!user && userCount === 0) {
        user = await prisma.user.create({
          data: {
            username,
            passwordHash: await hashPassword(payload.password),
          },
        });

        await ensureUserDefaultSettings(user.id);
      }

      if (!user) {
        return status(401, {
          message: "Invalid username or password.",
        });
      }

      const isValid = await verifyPassword(payload.password, user.passwordHash);

      if (!isValid) {
        return status(401, {
          message: "Invalid username or password.",
        });
      }

      await ensureUserDefaultSettings(user.id);
      const token = await createAuthSession(user.id);

      return {
        token,
        user: toAuthPayload(user),
        needsProfileSetup: needsProfileSetup(user),
      };
    },
    {
      body: t.Object({
        username: t.String({ minLength: 3, maxLength: 32 }),
        password: t.String({ minLength: 6, maxLength: 72 }),
      }),
    },
  )
  .get("/me", async ({ headers }) => {
    const token = parseBearerToken(headers.authorization);

    if (!token) {
      return status(401, {
        message: "Unauthorized.",
      });
    }

    const auth = await authenticateByBearerToken(token);

    if (!auth) {
      return status(401, {
        message: "Unauthorized.",
      });
    }

    return {
      user: auth.user,
      needsProfileSetup: needsProfileSetup(auth.user),
    };
  })
  .patch(
    "/profile",
    async ({ headers, body }) => {
      const token = parseBearerToken(headers.authorization);

      if (!token) {
        return status(401, {
          message: "Unauthorized.",
        });
      }

      const auth = await authenticateByBearerToken(token);

      if (!auth) {
        return status(401, {
          message: "Unauthorized.",
        });
      }

      const payload = completeProfileInputSchema.parse(body);
      const nextAvatar = payload.avatarUrl?.trim() || null;
      const isDataAvatar = nextAvatar ? nextAvatar.startsWith("data:image/") : false;
      const isHttpAvatar = nextAvatar ? /^https?:\/\//i.test(nextAvatar) : false;

      if (nextAvatar && !isDataAvatar && !isHttpAvatar) {
        return status(400, {
          message: "Avatar must be a valid image data URL or HTTP URL.",
        });
      }

      const updated = await prisma.user.update({
        where: {
          id: auth.user.id,
        },
        data: {
          nickname: payload.nickname.trim(),
          avatarUrl: nextAvatar,
        },
      });

      return {
        user: toAuthPayload(updated),
        needsProfileSetup: needsProfileSetup(updated),
      };
    },
    {
      body: t.Object({
        nickname: t.String({ minLength: 2, maxLength: 32 }),
        avatarUrl: t.Optional(t.Nullable(t.String({ maxLength: 600000 }))),
      }),
    },
  )
  .post("/logout", async ({ headers }) => {
    const token = parseBearerToken(headers.authorization);

    if (!token) {
      return status(204);
    }

    await revokeAuthSession(token);

    return status(204);
  });
