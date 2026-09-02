import { Elysia, status, t } from "elysia";
import { updateSettingsInputSchema } from "@omam/contracts";
import { prisma } from "../lib/prisma";
import {
  authenticateByBearerToken,
  ensureUserDefaultSettings,
  parseBearerToken,
} from "../lib/auth";

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

export const settingsRoutes = new Elysia({ prefix: "/settings" })
  .get("/", async ({ headers }) => {
    const userId = await requireUserId(headers.authorization);

    if (!userId) {
      return status(401, {
        message: "Unauthorized.",
      });
    }

    await ensureUserDefaultSettings(userId);

    const settings = await prisma.appSettings.findUniqueOrThrow({
      where: {
        userId,
      },
    });

    return {
      hourlyRate: settings.hourlyRate,
      currency: settings.currency,
      monthlyGoalHours: settings.monthlyGoalHours,
      calendar: settings.calendar,
    };
  })
  .patch(
    "/",
    async ({ body, headers }) => {
      const userId = await requireUserId(headers.authorization);

      if (!userId) {
        return status(401, {
          message: "Unauthorized.",
        });
      }

      const payload = updateSettingsInputSchema.parse(body);

      const settings = await prisma.appSettings.upsert({
        where: {
          userId,
        },
        update: payload,
        create: {
          userId,
          ...payload,
        },
      });

      return {
        hourlyRate: settings.hourlyRate,
        currency: settings.currency,
        monthlyGoalHours: settings.monthlyGoalHours,
        calendar: settings.calendar,
      };
    },
    {
      body: t.Object({
        hourlyRate: t.Number({ minimum: 0 }),
        currency: t.Union([t.Literal("IRR"), t.Literal("USD")]),
        monthlyGoalHours: t.Number({ minimum: 0 }),
        calendar: t.Optional(t.Union([t.Literal("JALALI"), t.Literal("GREGORIAN")])),
      }),
    },
  );
