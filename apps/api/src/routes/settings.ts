import { Elysia } from "elysia";
import { updateSettingsInputSchema } from "@omam/contracts";
import { prisma } from "../lib/prisma";
import { authenticated } from "../lib/context";
import { ensureUserDefaultSettings } from "../lib/auth";
import { parseInput } from "../lib/errors";

function toDto(settings: {
  hourlyRate: number;
  currency: "IRR" | "USD" | "EUR";
  monthlyGoalHours: number;
  calendar: "JALALI" | "GREGORIAN";
}) {
  return {
    hourlyRate: settings.hourlyRate,
    currency: settings.currency,
    monthlyGoalHours: settings.monthlyGoalHours,
    calendar: settings.calendar,
  };
}

export const settingsRoutes = new Elysia({ prefix: "/settings" })
  .use(authenticated)

  .get("/", async ({ principal }) => {
    await ensureUserDefaultSettings(principal.user.id);

    return toDto(
      await prisma.appSettings.findUniqueOrThrow({ where: { userId: principal.user.id } }),
    );
  })

  .patch("/", async ({ principal, body }) => {
    const payload = parseInput(updateSettingsInputSchema, body);

    const settings = await prisma.appSettings.upsert({
      where: { userId: principal.user.id },
      update: payload,
      create: { userId: principal.user.id, ...payload },
    });

    return toDto(settings);
  });
