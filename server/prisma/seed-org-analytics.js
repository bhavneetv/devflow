const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Starting Organization Analytics & Audit Logs Seeder...');

  // 1. Find or verify user bhavneet.yasham@gmail.com
  let bhavneet = await prisma.user.findFirst({
    where: { email: 'bhavneet.yasham@gmail.com' },
  });

  if (!bhavneet) {
    bhavneet = await prisma.user.create({
      data: {
        email: 'bhavneet.yasham@gmail.com',
        name: 'Bhavneet Verma',
        role: 'ADMIN',
        avatarType: 'icon',
        avatarId: 'smile',
        avatarColor: '#0284C7',
        isPublicProfile: true,
        onboardingCompleted: true,
      },
    });
    console.log('Created user Bhavneet Verma:', bhavneet.id);
  } else {
    console.log('Found user Bhavneet Verma:', bhavneet.id);
  }

  // Find other users for multi-member feel
  const users = await prisma.user.findMany({ take: 6 });
  const otherUsers = users.filter((u) => u.id !== bhavneet.id);

  // 2. Find or create Organization "devflow"
  let org = await prisma.organization.findUnique({
    where: { slug: 'devflow' },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'DevFlow Inc',
        slug: 'devflow',
        description: 'Next-generation software delivery & agile issue orchestration platform. [website:https://devflow.io] [industry:Technology & Software] [contact:support@devflow.io] [location:San Francisco, CA]',
        logoUrl: 'icon:sparkles:#7C3AED',
        createdById: bhavneet.id,
      },
    });
    console.log('Created organization DevFlow Inc');
  } else {
    // Update logo and description with rich metadata
    org = await prisma.organization.update({
      where: { id: org.id },
      data: {
        logoUrl: org.logoUrl || 'icon:sparkles:#7C3AED',
        description: org.description || 'Next-generation software delivery & agile issue orchestration platform. [website:https://devflow.io] [industry:Technology & Software] [contact:support@devflow.io] [location:San Francisco, CA]',
      },
    });
    console.log('Using organization:', org.name, org.slug);
  }

  // 3. Ensure Bhavneet is OWNER of DevFlow
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: bhavneet.id,
      },
    },
    update: { role: 'OWNER' },
    create: {
      organizationId: org.id,
      userId: bhavneet.id,
      role: 'OWNER',
    },
  });

  // Ensure other users are members
  for (const u of otherUsers) {
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId: u.id,
        },
      },
      update: {},
      create: {
        organizationId: org.id,
        userId: u.id,
        role: u.role === 'ADMIN' ? 'ADMIN' : 'MEMBER',
      },
    });
  }

  // 4. Seed Teams
  const teamsToSeed = [
    { name: 'Core Engineering', color: '#8B5CF6', desc: '[key:CORE] Frontend, backend, and infrastructure engineers.' },
    { name: 'Design Systems', color: '#EC4899', desc: '[key:DS] Component libraries, Figma tokens, and UI/UX guidelines.' },
    { name: 'Platform & DevOps', color: '#06B6D4', desc: '[key:OPS] CI/CD pipelines, Kubernetes clusters, and observability.' },
    { name: 'Mobile Squad', color: '#10B981', desc: '[key:MOB] React Native mobile client for iOS and Android.' },
  ];

  const createdTeams = [];
  for (const t of teamsToSeed) {
    let team = await prisma.team.findFirst({
      where: { organizationId: org.id, name: t.name },
    });
    if (!team) {
      team = await prisma.team.create({
        data: {
          name: t.name,
          color: t.color,
          description: t.desc,
          createdById: bhavneet.id,
          organizationId: org.id,
        },
      });
      console.log('Created team:', team.name);
    }
    createdTeams.push(team);

    // Add Bhavneet and members to team
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: bhavneet.id } },
      update: { role: 'OWNER' },
      create: { teamId: team.id, userId: bhavneet.id, role: 'OWNER' },
    });

    for (const u of otherUsers.slice(0, 3)) {
      await prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: team.id, userId: u.id } },
        update: {},
        create: { teamId: team.id, userId: u.id, role: 'DEVELOPER' },
      });
    }
  }

  // 5. Seed Projects with varied statuses
  const projectsToSeed = [
    { title: 'DevFlow Web Platform v2.0', status: 'IN_PROGRESS', desc: 'Core web application revamp with React 19 and Tailwind.' },
    { title: 'Design System & Component Kit', status: 'IN_PROGRESS', desc: 'Enterprise design system with accessible dark mode primitives.' },
    { title: 'CI/CD Cloud Deployment Pipeline', status: 'COMPLETED', desc: 'Automated GitHub Actions and Docker container orchestration.' },
    { title: 'Real-time WebSocket Notifications', status: 'IN_PROGRESS', desc: 'Live event streaming for issues, sprints, and mentions.' },
    { title: 'Mobile Companion App', status: 'PLANNING', desc: 'Cross-platform mobile application for push alerts and task triage.' },
    { title: 'Enterprise Audit Logs & RBAC', status: 'COMPLETED', desc: 'Granular security auditing, activity tracking, and access policies.' },
  ];

  const createdProjects = [];
  for (const p of projectsToSeed) {
    let proj = await prisma.project.findFirst({
      where: { organizationId: org.id, title: p.title },
    });
    if (!proj) {
      proj = await prisma.project.create({
        data: {
          title: p.title,
          status: p.status,
          description: p.desc,
          ownerId: bhavneet.id,
          organizationId: org.id,
        },
      });
      console.log('Created project:', proj.title);
    } else {
      proj = await prisma.project.update({
        where: { id: proj.id },
        data: { status: p.status, description: p.desc },
      });
    }
    createdProjects.push(proj);
  }

  // 6. Seed Tasks for realistic Completion Trend and Status Breakdown
  const sampleTasks = [
    { title: 'Implement Organization Overview dashboard with custom graphs', status: 'DONE', priority: 'URGENT', projectIdx: 0, daysAgo: 1 },
    { title: 'Build rectangular metric cards with accent icon banners', status: 'DONE', priority: 'HIGH', projectIdx: 0, daysAgo: 1 },
    { title: 'Design Task Completion Trend area chart with curve smoothing', status: 'DONE', priority: 'HIGH', projectIdx: 0, daysAgo: 2 },
    { title: 'Create interactive Project Status Donut chart', status: 'DONE', priority: 'MEDIUM', projectIdx: 1, daysAgo: 2 },
    { title: 'Add Team Performance velocity comparator bars', status: 'DONE', priority: 'MEDIUM', projectIdx: 0, daysAgo: 3 },
    { title: 'Implement last 8 audit logs timeline in right detail panel', status: 'DONE', priority: 'HIGH', projectIdx: 5, daysAgo: 3 },
    { title: 'Configure custom avatar parser for icon/initials tones', status: 'DONE', priority: 'HIGH', projectIdx: 1, daysAgo: 4 },
    { title: 'Add secure ownership transfer with confirmation phrase check', status: 'DONE', priority: 'URGENT', projectIdx: 5, daysAgo: 4 },
    { title: 'Set up member role permission selectors and deactivation modal', status: 'DONE', priority: 'HIGH', projectIdx: 5, daysAgo: 5 },
    { title: 'Optimize MySQL database queries for organization dashboard', status: 'DONE', priority: 'MEDIUM', projectIdx: 2, daysAgo: 6 },
    { title: 'Refactor Tailwind styles for dark mode contrast #171A21', status: 'DONE', priority: 'LOW', projectIdx: 1, daysAgo: 7 },
    { title: 'Add WebSocket heartbeat reconnect logic for task updates', status: 'IN_PROGRESS', priority: 'HIGH', projectIdx: 3, daysAgo: 0 },
    { title: 'Implement push notifications for mobile app builds', status: 'TODO', priority: 'MEDIUM', projectIdx: 4, daysAgo: 0 },
    { title: 'Conduct penetration test on API token verification middleware', status: 'IN_REVIEW', priority: 'URGENT', projectIdx: 5, daysAgo: 0 },
    { title: 'Write integration test suite for team invitation lifecycle', status: 'IN_PROGRESS', priority: 'MEDIUM', projectIdx: 0, daysAgo: 0 },
    { title: 'Add export audit logs to CSV/JSON feature', status: 'TODO', priority: 'LOW', projectIdx: 5, daysAgo: 0 },
    { title: 'Create interactive sprint burndown widget', status: 'IN_PROGRESS', priority: 'HIGH', projectIdx: 0, daysAgo: 0 },
    { title: 'Implement keyboard shortcuts (Cmd+K) quick actions', status: 'TODO', priority: 'MEDIUM', projectIdx: 0, daysAgo: 0 },
    { title: 'Automated database backups with daily S3 glacier replication', status: 'DONE', priority: 'HIGH', projectIdx: 2, daysAgo: 8 },
    { title: 'Setup Redis cache layer for organization permissions query', status: 'DONE', priority: 'MEDIUM', projectIdx: 2, daysAgo: 9 },
    { title: 'Design Figma UI kit with typography scale & 4px spacing grid', status: 'DONE', priority: 'HIGH', projectIdx: 1, daysAgo: 10 },
    { title: 'Configure GitHub Actions CI workflow with ESLint & Prettier', status: 'DONE', priority: 'MEDIUM', projectIdx: 2, daysAgo: 11 },
    { title: 'Benchmark API gateway latency under 10k requests/min', status: 'IN_PROGRESS', priority: 'HIGH', projectIdx: 0, daysAgo: 0 },
    { title: 'Implement dark/light theme persistence in local storage', status: 'DONE', priority: 'LOW', projectIdx: 1, daysAgo: 12 },
    { title: 'Multi-organization workspace switcher with instant preview', status: 'DONE', priority: 'URGENT', projectIdx: 0, daysAgo: 5 },
    { title: 'GraphQL schema federation for microservices orchestration', status: 'IN_REVIEW', priority: 'HIGH', projectIdx: 0, daysAgo: 0 },
    { title: 'Setup Prometheus & Grafana alerts for server memory spike', status: 'TODO', priority: 'MEDIUM', projectIdx: 2, daysAgo: 0 },
    { title: 'Add audit log retention policy with automatic 90-day archive', status: 'IN_PROGRESS', priority: 'MEDIUM', projectIdx: 5, daysAgo: 0 },
  ];

  for (const t of sampleTasks) {
    const targetProject = createdProjects[t.projectIdx] || createdProjects[0];
    const existing = await prisma.task.findFirst({
      where: { projectId: targetProject.id, title: t.title },
    });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 5);

    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - (t.daysAgo || 0));

    if (!existing) {
      await prisma.task.create({
        data: {
          title: t.title,
          status: t.status,
          priority: t.priority,
          projectId: targetProject.id,
          assigneeId: bhavneet.id,
          dueDate,
          createdAt,
          updatedAt: t.status === 'DONE' ? createdAt : new Date(),
        },
      });
    }
  }
  console.log('Seeded sample tasks for metrics.');

  // 7. Seed Last 8+ Audit Logs / Activities in clean sequence
  const auditLogsToSeed = [
    {
      action: 'DEPLOYED_RELEASE',
      resourceType: 'RELEASE',
      resourceId: 24,
      details: { version: 'v2.4.0', environment: 'production', notes: 'Deployed Organization Overview & Dark Theme Analytics' },
      actorId: bhavneet.id,
      minsAgo: 15,
    },
    {
      action: 'UPDATED_ORGANIZATION',
      resourceType: 'SETTINGS',
      resourceId: org.id,
      details: { setting: 'security_policy', twoFactorRequired: true, ipRestriction: false },
      actorId: bhavneet.id,
      minsAgo: 60,
    },
    {
      action: 'CREATED_PROJECT',
      resourceType: 'PROJECT',
      resourceId: createdProjects[0]?.id || 1,
      details: { projectName: 'DevFlow Web Platform v2.0', status: 'IN_PROGRESS' },
      actorId: bhavneet.id,
      minsAgo: 180,
    },
    {
      action: 'CREATED_TEAM',
      resourceType: 'TEAM',
      resourceId: createdTeams[1]?.id || 2,
      details: { teamName: 'Design Systems', color: '#EC4899' },
      actorId: bhavneet.id,
      minsAgo: 360,
    },
    {
      action: 'ASSIGNED_ROLE',
      resourceType: 'MEMBER',
      resourceId: bhavneet.id,
      details: { targetMember: 'Bhavneet Verma', newRole: 'OWNER', updatedBy: 'System' },
      actorId: bhavneet.id,
      minsAgo: 720,
    },
    {
      action: 'INVITED_MEMBER',
      resourceType: 'MEMBER',
      resourceId: users[1]?.id || null,
      details: { email: 'sarah.connor@devflow.io', role: 'ADMIN' },
      actorId: bhavneet.id,
      minsAgo: 1440,
    },
    {
      action: 'CONFIGURED_SECURITY',
      resourceType: 'SECURITY',
      resourceId: org.id,
      details: { action: 'AUDIT_LOGGING_ENABLED', retention: '365_days' },
      actorId: bhavneet.id,
      minsAgo: 2880,
    },
    {
      action: 'CREATED_ORGANIZATION',
      resourceType: 'ORGANIZATION',
      resourceId: org.id,
      details: { name: 'DevFlow Inc', slug: 'devflow' },
      actorId: bhavneet.id,
      minsAgo: 4320,
    },
  ];

  // Clear existing activities for this org to ensure clean 8 audit logs
  await prisma.organizationActivity.deleteMany({
    where: { organizationId: org.id },
  });

  for (const log of auditLogsToSeed) {
    const timestamp = new Date(Date.now() - log.minsAgo * 60 * 1000);
    await prisma.organizationActivity.create({
      data: {
        organizationId: org.id,
        actorId: log.actorId,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        details: JSON.stringify(log.details),
        createdAt: timestamp,
      },
    });
  }

  console.log(`✅ Seeded ${auditLogsToSeed.length} high-fidelity audit log events!`);
  console.log('🎉 Seeding completed successfully!');
}

seed()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

