import "../src/lib/load-env";
import { prisma } from "../src/lib/prisma";
import { hashPassword, normalizeUsername } from "../src/lib/auth";

/**
 * Brings up the first organization and its owner. Everyone else joins through
 * an invite code the owner issues from the admin panel, so this runs once.
 */
async function main() {
  const name = process.env.SEED_ORG_NAME?.trim() || "Omam Team";
  const slug = (process.env.SEED_ORG_SLUG?.trim() || "omam").toLowerCase();
  const username = normalizeUsername(process.env.SEED_OWNER_USERNAME?.trim() || "owner");
  const password = process.env.SEED_OWNER_PASSWORD?.trim() || "changeme123";

  const organization = await prisma.organization.upsert({
    where: { slug },
    update: {},
    create: { name, slug },
  });

  const existing = await prisma.user.findUnique({ where: { username } });

  if (existing) {
    console.log(`Owner "${username}" already exists — leaving it untouched.`);
    return;
  }

  const owner = await prisma.user.create({
    data: {
      username,
      passwordHash: await hashPassword(password),
      nickname: "Owner",
    },
  });

  await prisma.membership.create({
    data: {
      organizationId: organization.id,
      userId: owner.id,
      role: "OWNER",
      employeeCode: "001",
      jobTitle: "Team lead",
      hourlyRate: organization.defaultHourlyRate,
      currency: organization.currency,
      monthlyGoalHours: organization.monthlyGoalHours,
    },
  });

  await prisma.appSettings.create({
    data: {
      userId: owner.id,
      calendar: organization.calendar,
      currency: organization.currency,
      monthlyGoalHours: organization.monthlyGoalHours,
    },
  });

  console.log(`Seeded organization "${organization.name}" with owner "${username}".`);
  console.log("Change that password on first sign-in.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
