            import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  if (users.length === 0) {
    console.log('No users found to seed organization');
    return;
  }
  const owner = users[0];

  let org = await prisma.organization.findUnique({ where: { slug: 'devflow' } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'DevFlow Inc',
        slug: 'devflow',
        description: 'Main engineering and product workspace for DevFlow platform.',
        createdById: owner.id,
      },
    });
    console.log('Created organization:', org.name, org.slug);
  }

  // Ensure all existing users belong to this org
  for (const u of users) {
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: u.id } },
      update: {},
      create: {
        organizationId: org.id,
        userId: u.id,
        role: u.id === owner.id ? 'OWNER' : (u.role === 'ADMIN' ? 'ADMIN' : 'MEMBER'),
      },
    });
  }

  // Link existing projects to this organization
  await prisma.project.updateMany({
    where: { organizationId: null },
    data: { organizationId: org.id },
  });

  // Check if team exists, if not create one
  const existingTeams = await prisma.team.findMany({ where: { organizationId: org.id } });
  if (existingTeams.length === 0) {
    const team = await prisma.team.create({
      data: {
        name: 'Core Engineering',
        description: 'Frontend, backend, and infrastructure engineers.',
        color: '#8B5CF6',
        createdById: owner.id,
        organizationId: org.id,
      },
    });

    for (const u of users.slice(0, 4)) {
      await prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: team.id, userId: u.id } },
        update: {},
        create: {
          teamId: team.id,
          userId: u.id,
          role: u.id === owner.id ? 'OWNER' : 'DEVELOPER',
        },
      });
    }
  }

  // Record seed activity if none exists
  const existingActivities = await prisma.organizationActivity.findMany({ where: { organizationId: org.id } });
  if (existingActivities.length === 0) {
    await prisma.organizationActivity.createMany({
      data: [
        {
          organizationId: org.id,
          actorId: owner.id,
          action: 'CREATED_ORGANIZATION',
          resourceType: 'ORGANIZATION',
          resourceId: org.id,
          details: JSON.stringify({ name: org.name, slug: org.slug }),
        },
        {
          organizationId: org.id,
          actorId: owner.id,
          action: 'INVITED_MEMBER',
          resourceType: 'MEMBER',
          resourceId: users[1]?.id || owner.id,
          details: JSON.stringify({ email: users[1]?.email || 'team@devflow.io', role: 'MEMBER' }),
        },
      ],
    });
  }

  console.log('✅ Seed organization completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
