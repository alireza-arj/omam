import { Elysia } from "elysia";
import { createProjectInputSchema, updateProjectInputSchema } from "@omam/contracts";
import { prisma } from "../lib/prisma";
import { authenticated } from "../lib/context";
import { requireOrganization, requireRole } from "../lib/auth";
import { conflict, notFound, parseInput } from "../lib/errors";
import { recordAudit } from "../lib/audit";

function serializeProject(project: {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: project.id,
    name: project.name,
    color: project.color,
    archived: project.archived,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export const projectRoutes = new Elysia({ prefix: "/projects" })
  .use(authenticated)

  /** Every member needs the list to tag their own time. */
  .get("/", async ({ principal, query }) => {
    const organization = requireOrganization(principal);
    const includeArchived = query.includeArchived === "true";

    const projects = await prisma.project.findMany({
      where: { organizationId: organization.id, ...(includeArchived ? {} : { archived: false }) },
      orderBy: [{ archived: "asc" }, { name: "asc" }],
    });

    return { projects: projects.map(serializeProject) };
  })

  .post("/", async ({ principal, body }) => {
    requireRole(principal, "MANAGER");

    const organization = requireOrganization(principal);
    const payload = parseInput(createProjectInputSchema, body);

    const existing = await prisma.project.findFirst({
      where: { organizationId: organization.id, name: payload.name },
      select: { id: true },
    });

    if (existing) {
      throw conflict("A project with that name already exists.", "PROJECT_EXISTS");
    }

    const project = await prisma.project.create({
      data: { organizationId: organization.id, name: payload.name, color: payload.color },
    });

    await recordAudit({
      organizationId: organization.id,
      actorId: principal.user.id,
      action: "project.created",
      targetType: "project",
      targetId: project.id,
      metadata: { name: project.name },
    });

    return serializeProject(project);
  })

  .patch("/:id", async ({ principal, params, body }) => {
    requireRole(principal, "MANAGER");

    const organization = requireOrganization(principal);
    const payload = parseInput(updateProjectInputSchema, body);
    const project = await prisma.project.findFirst({
      where: { id: params.id, organizationId: organization.id },
    });

    if (!project) {
      throw notFound("Project not found.");
    }

    const updated = await prisma.project.update({ where: { id: project.id }, data: payload });

    await recordAudit({
      organizationId: organization.id,
      actorId: principal.user.id,
      action: "project.updated",
      targetType: "project",
      targetId: project.id,
      metadata: payload,
    });

    return serializeProject(updated);
  });
