import { Elysia, status, t } from "elysia";
import {
  clockInInputSchema,
  clockOutInputSchema,
  updateSessionInputSchema,
  type WorkSessionCategory,
} from "@omam/contracts";
import { prisma } from "../lib/prisma";
import {
  calculateSessionMinutes,
  endOfMonth,
  normalizeMonth,
  startOfMonth,
} from "../lib/time";
import { authenticateByBearerToken, parseBearerToken } from "../lib/auth";

function serializeSession(session: {
  id: string;
  startAt: Date;
  endAt: Date | null;
  durationMinutes: number;
  category: WorkSessionCategory;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...session,
    startAt: session.startAt.toISOString(),
    endAt: session.endAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

async function requireUserId(authorizationHeader: string | undefined) {
  const token = parseBearerToken(authorizationHeader);

  if (!token) {
    return null;
  }

  const auth = await authenticateByBearerToken(token);

  if (!auth) {
    return null;
  }

  return auth.user.id;
}

export const sessionRoutes = new Elysia({ prefix: "/sessions" })
  .get(
    "/",
    async ({ query, headers }) => {
      const userId = await requireUserId(headers.authorization);

      if (!userId) {
        return status(401, {
          message: "Unauthorized.",
        });
      }

      const from = query.from ? new Date(query.from) : undefined;
      const to = query.to ? new Date(query.to) : undefined;
      const startAtFilter =
        from || to
          ? {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            }
          : undefined;

      const sessions = await prisma.workSession.findMany({
        where: {
          userId,
          ...(startAtFilter
            ? {
                startAt: startAtFilter,
              }
            : {}),
        },
        orderBy: {
          startAt: "desc",
        },
      });

      return {
        sessions: sessions.map(serializeSession),
      };
    },
    {
      query: t.Object({
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/clock-in",
    async ({ body, headers }) => {
      const userId = await requireUserId(headers.authorization);

      if (!userId) {
        return status(401, {
          message: "Unauthorized.",
        });
      }

      const activeSession = await prisma.workSession.findFirst({
        where: {
          userId,
          endAt: null,
        },
      });

      if (activeSession) {
        return status(409, {
          message: "There is already an active session.",
        });
      }

      const payload = clockInInputSchema.parse(body);

      const session = await prisma.workSession.create({
        data: {
          userId,
          startAt: new Date(payload.startAt),
          durationMinutes: 0,
          category: payload.category,
          note: payload.note ?? null,
        },
      });

      return serializeSession(session);
    },
    {
      body: t.Object({
        startAt: t.String(),
        category: t.Optional(t.Union([t.Literal("ONSITE"), t.Literal("REMOTE")])),
        note: t.Optional(t.Nullable(t.String())),
      }),
    },
  )
  .post(
    "/:id/clock-out",
    async ({ body, params, headers }) => {
      const userId = await requireUserId(headers.authorization);

      if (!userId) {
        return status(401, {
          message: "Unauthorized.",
        });
      }

      const payload = clockOutInputSchema.parse(body);
      const session = await prisma.workSession.findFirst({
        where: {
          id: params.id,
          userId,
        },
      });

      if (!session) {
        return status(404, {
          message: "Session not found.",
        });
      }

      if (session.endAt) {
        return status(409, {
          message: "Session is already ended.",
        });
      }

      const endAt = new Date(payload.endAt);
      if (endAt.getTime() < session.startAt.getTime()) {
        return status(422, {
          message: "endAt cannot be before startAt.",
        });
      }

      const updated = await prisma.workSession.update({
        where: {
          id: params.id,
        },
        data: {
          endAt,
          durationMinutes: calculateSessionMinutes({
            startAt: session.startAt,
            endAt,
          }),
        },
      });

      return serializeSession(updated);
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        endAt: t.String(),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ body, params, headers }) => {
      const userId = await requireUserId(headers.authorization);

      if (!userId) {
        return status(401, {
          message: "Unauthorized.",
        });
      }

      const payload = updateSessionInputSchema.parse(body);

      const session = await prisma.workSession.findFirst({
        where: {
          id: params.id,
          userId,
        },
      });

      if (!session) {
        return status(404, {
          message: "Session not found.",
        });
      }

      const startAt = new Date(payload.startAt);
      const endAt = payload.endAt ? new Date(payload.endAt) : null;

      if (endAt && endAt.getTime() < startAt.getTime()) {
        return status(422, {
          message: "endAt cannot be before startAt.",
        });
      }

      const updated = await prisma.workSession.update({
        where: {
          id: params.id,
        },
        data: {
          startAt,
          endAt,
          durationMinutes: endAt
            ? calculateSessionMinutes({
                startAt,
                endAt,
              })
            : 0,
          category: payload.category,
          note: payload.note,
        },
      });

      return serializeSession(updated);
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        startAt: t.String(),
        endAt: t.Nullable(t.String()),
        category: t.Optional(t.Union([t.Literal("ONSITE"), t.Literal("REMOTE")])),
        note: t.Nullable(t.String()),
      }),
    },
  )
  .get(
    "/summary",
    async ({ query, headers }) => {
      const userId = await requireUserId(headers.authorization);

      if (!userId) {
        return status(401, {
          message: "Unauthorized.",
        });
      }

      const month = normalizeMonth(query.month);
      const from = startOfMonth(month);
      const to = endOfMonth(month);

      const [sessions, settings, activeSession] = await Promise.all([
        prisma.workSession.findMany({
          where: {
            userId,
            startAt: {
              gte: from,
              lte: to,
            },
          },
        }),
        prisma.appSettings.findUnique({
          where: {
            userId,
          },
        }),
        prisma.workSession.findFirst({
          where: {
            userId,
            endAt: null,
          },
          orderBy: {
            startAt: "desc",
          },
        }),
      ]);

      const categoryMinutes = {
        onsite: 0,
        remote: 0,
      };

      const totalMinutes = sessions.reduce((sum, session) => {
        if (!session.endAt) {
          return sum;
        }

        const minutes =
          session.durationMinutes ||
          calculateSessionMinutes({
            startAt: session.startAt,
            endAt: session.endAt,
          });

        if (session.category === "REMOTE") {
          categoryMinutes.remote += minutes;
        } else {
          categoryMinutes.onsite += minutes;
        }

        return sum + minutes;
      }, 0);
      const workedDays = new Set(
        sessions.map((session) => session.startAt.toISOString().slice(0, 10)),
      ).size;
      const hourlyRate = settings?.hourlyRate ?? 0;

      return {
        month,
        summary: {
          totalMinutes,
          totalIncome: Number(((totalMinutes / 60) * hourlyRate).toFixed(2)),
          activeSession: activeSession ? serializeSession(activeSession) : null,
          workedDays,
          categoryMinutes,
        },
      };
    },
    {
      query: t.Object({
        month: t.Optional(t.String()),
      }),
    },
  );
