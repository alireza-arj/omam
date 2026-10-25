import { Elysia } from "elysia";
import type { Prisma } from "@prisma/client";
import { usersQuerySchema, type UsersResponseDto } from "@omam/contracts";
import { authenticated } from "../lib/context";
import { forbidden, parseInput } from "../lib/errors";
import { prisma } from "../lib/prisma";

export const userRoutes = new Elysia({ prefix: "/users" })
  .use(authenticated)
  .get("/", async ({ principal, query }): Promise<UsersResponseDto> => {
    if (!principal.user.isSuperAdmin) throw forbidden();

    const { search, page: requestedPage, pageSize } = parseInput(usersQuerySchema, query);
    const contains = { contains: search, mode: "insensitive" as const };
    const where: Prisma.UserWhereInput = search ? {
      OR: [
        { username: contains },
        { nickname: contains },
        { email: contains },
        { memberships: { some: { organization: { name: contains } } } },
      ],
    } : {};

    return prisma.$transaction(async (tx) => {
      const total = await tx.user.count({ where });
      const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)));
      const users = await tx.user.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, username: true, nickname: true, email: true, avatarUrl: true,
          isSuperAdmin: true, createdAt: true, lastLoginAt: true,
          memberships: {
            orderBy: { createdAt: "asc" },
            select: { id: true, organizationId: true, role: true, status: true,
              organization: { select: { name: true } } },
          },
        },
      });

      return {
        users: users.map(({ memberships, createdAt, lastLoginAt, ...user }) => ({
          ...user,
          createdAt: createdAt.toISOString(),
          lastLoginAt: lastLoginAt?.toISOString() ?? null,
          memberships: memberships.map(({ organization, ...membership }) => ({
            ...membership, organizationName: organization.name,
          })),
        })),
        total, page, pageSize,
      };
    });
  });
