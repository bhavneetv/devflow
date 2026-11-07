import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export const seedRouter = Router();

export async function runDatabaseSeed() {
  console.log('🌱 Starting comprehensive database seed for admin@gmail.com...');

  // Clear existing in reverse order of dependencies
  await prisma.organizationActivity.deleteMany().catch(() => {});
  await prisma.organizationInvitation.deleteMany().catch(() => {});
  await prisma.organizationMember.deleteMany().catch(() => {});
  await prisma.teamMessage.deleteMany().catch(() => {});
  await prisma.teamConversation.deleteMany().catch(() => {});
  await prisma.teamMemberPermission.deleteMany().catch(() => {});
  await prisma.teamMember.deleteMany().catch(() => {});
  await prisma.teamInvitation.deleteMany().catch(() => {});
  await prisma.team.deleteMany().catch(() => {});
  await prisma.task.deleteMany().catch(() => {});
  await prisma.project.deleteMany().catch(() => {});
  await prisma.organization.deleteMany().catch(() => {});
  await prisma.user.deleteMany().catch(() => {});

  // 1. Primary Admin User: admi
  const admin = await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@gmail.com',
      username: 'admin',
      role: 'ADMIN',
      onboardingCompleted: true,
      avatarType: 'initials',
      avatarColor: '#6366F1',
      accentColor: '#6366F1',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      jobTitle: 'Lead Administrator & Staff Architect',
      company: 'DevFlow Core',
      bio: 'DevFlow Administrator & Principal System Architect.',
      isPublicProfile: true,
      phoneNumber: '+1 (555) 019-2831',
      country: 'US',
    },
  });

  // 2. Supporting Teammates
  const alice = await prisma.user.create({
    data: {
      name: 'Alice Johnson',
      email: 'alice@devflow.io',
      username: 'alice.johnson',
      role: 'ADMIN',
      onboardingCompleted: true,
      avatarType: 'initials',
      avatarColor: '#10B981',
      accentColor: '#10B981',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      jobTitle: 'DevOps & Infrastructure Lead',
      company: 'DevFlow',
      bio: 'Cloud architecture and MySQL replication lead.',
    },
  });

  const bob = await prisma.user.create({
    data: {
      name: 'Bob Smith',
      email: 'bob@devflow.io',
      username: 'bob.smith',
      role: 'MEMBER',
      onboardingCompleted: true,
      avatarType: 'initials',
      avatarColor: '#F59E0B',
      accentColor: '#F59E0B',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      jobTitle: 'Senior Backend Engineer',
      company: 'DevFlow',
      bio: 'Express API, TypeScript, and microservices.',
    },
  });

  const charlie = await prisma.user.create({
    data: {
      name: 'Charlie Davis',
      email: 'charlie@devflow.io',
      username: 'charlie.davis',
      role: 'MEMBER',
      onboardingCompleted: true,
      avatarType: 'initials',
      avatarColor: '#A855F7',
      accentColor: '#A855F7',
      avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150',
      jobTitle: 'Staff UI/UX Engineer',
      company: 'DevFlow',
      bio: 'Design systems, Linear navigation, and SVG layouts.',
    },
  });

  const elena = await prisma.user.create({
    data: {
      name: 'Elena Rostova',
      email: 'elena@devflow.io',
      username: 'elena.rostova',
      role: 'MEMBER',
      onboardingCompleted: true,
      avatarType: 'initials',
      avatarColor: '#EC4899',
      accentColor: '#EC4899',
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
      jobTitle: 'Security & Reliability Specialist',
      company: 'DevFlow',
      bio: 'Application security, token rotation, and penetration testing.',
    },
  });

  // 3. Organization: DevFlow Core
  const org = await prisma.organization.create({
    data: {
      name: 'DevFlow Core',
      slug: 'devflow-core',
      description: 'Primary engineering workspace for cloud microservices, design systems, and platform infrastructure.',
      createdById: admin.id,
      members: {
        create: [
          { userId: admin.id, role: 'OWNER' },
          { userId: alice.id, role: 'ADMIN' },
          { userId: bob.id, role: 'MEMBER' },
          { userId: charlie.id, role: 'MEMBER' },
          { userId: elena.id, role: 'MEMBER' },
        ],
      },
    },
  });

  // 4. Teams (Squads)
  const teamEngineering = await prisma.team.create({
    data: {
      name: 'Engineering',
      description: 'Core product engineering & API service delivery.',
      color: '#6366F1',
      createdById: admin.id,
      organizationId: org.id,
      members: {
        create: [
          { userId: admin.id, role: 'OWNER' },
          { userId: bob.id, role: 'DEVELOPER' },
          { userId: charlie.id, role: 'FRONTEND_DEVELOPER' },
        ],
      },
    },
  });

  const teamCore = await prisma.team.create({
    data: {
      name: 'DevFlow Core',
      description: 'Platform infrastructure, database schemas, and microservices.',
      color: '#10B981',
      createdById: admin.id,
      organizationId: org.id,
      members: {
        create: [
          { userId: admin.id, role: 'OWNER' },
          { userId: alice.id, role: 'ADMIN' },
          { userId: bob.id, role: 'BACKEND_DEVELOPER' },
        ],
      },
    },
  });

  const teamDesign = await prisma.team.create({
    data: {
      name: 'Design Systems',
      description: 'UI/UX components, design tokens, and accessible interfaces.',
      color: '#A855F7',
      createdById: admin.id,
      organizationId: org.id,
      members: {
        create: [
          { userId: admin.id, role: 'OWNER' },
          { userId: charlie.id, role: 'DESIGNER' },
        ],
      },
    },
  });

  const teamSecurity = await prisma.team.create({
    data: {
      name: 'Cloud Ops',
      description: 'CI/CD automation, cloud deployment, and vulnerability mitigation.',
      color: '#F59E0B',
      createdById: admin.id,
      organizationId: org.id,
      members: {
        create: [
          { userId: admin.id, role: 'OWNER' },
          { userId: alice.id, role: 'DEVELOPER' },
          { userId: elena.id, role: 'TESTER' },
        ],
      },
    },
  });

  // 5. Projects
  const p1 = await prisma.project.create({
    data: {
      title: 'DevFlow Cloud Platform v2',
      description: 'Migrating backend architecture to microservices with event-driven notifications.',
      status: 'IN_PROGRESS',
      ownerId: admin.id,
      organizationId: org.id,
    },
  });

  const p2 = await prisma.project.create({
    data: {
      title: 'Backend Architecture Sync',
      description: 'Prisma schema and MySQL database synchronization on TiDB Cloud.',
      status: 'IN_PROGRESS',
      ownerId: admin.id,
      organizationId: org.id,
    },
  });

  const p3 = await prisma.project.create({
    data: {
      title: 'Mobile App Redesign',
      description: 'Modernizing mobile experience with dark mode and offline sync capabilities.',
      status: 'PLANNING',
      ownerId: bob.id,
      organizationId: org.id,
    },
  });

  const p4 = await prisma.project.create({
    data: {
      title: 'Enterprise Security Audit',
      description: 'Zero-trust RBAC permissions, token refresh rotation, and dependency audit.',
      status: 'COMPLETED',
      ownerId: admin.id,
      organizationId: org.id,
    },
  });

  const p5 = await prisma.project.create({
    data: {
      title: 'Design System & Tree Navigation',
      description: 'Pixel-perfect linear navigation tree lines, collapsible squads, and color themes.',
      status: 'IN_PROGRESS',
      ownerId: charlie.id,
      organizationId: org.id,
    },
  });

  // 6. Tasks for admin@gmail.com and teammates (with dates for Gantt & Calendar)
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  await prisma.task.createMany({
    data: [
      // Tasks assigned to admin@gmail.com
      {
        title: 'Configure Prisma with TiDB Cloud schema',
        description: 'Set up schema models, relational indexes, and initial migrations for MySQL on TiDB Cloud.',
        priority: 'URGENT',
        status: 'DONE',
        projectId: p1.id,
        assigneeId: admin.id,
        dueDate: new Date(now + 2 * day),
        createdAt: new Date(now - 4 * day),
      },
      {
        title: 'Implement Express REST API with TypeScript and Zod validation',
        description: 'Create CRUD endpoints for users, projects, and tasks with strict Zod validation.',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        projectId: p1.id,
        assigneeId: admin.id,
        dueDate: new Date(now + 5 * day),
        createdAt: new Date(now - 2 * day),
      },
      {
        title: 'Build multi-view Gantt, Board, and Calendar engine in My Tasks',
        description: 'Implement Kanban Board, interactive Gantt timeline, monthly Calendar, and List Table views.',
        priority: 'HIGH',
        status: 'IN_REVIEW',
        projectId: p1.id,
        assigneeId: admin.id,
        dueDate: new Date(now + 3 * day),
        createdAt: new Date(now - 3 * day),
      },
      {
        title: 'Audit log cryptographic ledger verification & SHA-256 checks',
        description: 'Verify sequential block hashing and immutable event tamper detection for organization audit logs.',
        priority: 'MEDIUM',
        status: 'DONE',
        projectId: p4.id,
        assigneeId: admin.id,
        dueDate: new Date(now + 1 * day),
        createdAt: new Date(now - 5 * day),
      },
      {
        title: 'Redis cluster TTL timeout synchronization & token rotation',
        description: 'Double check token refresh rotation timeout on Redis cluster during rolling deployments.',
        priority: 'URGENT',
        status: 'TODO',
        projectId: p2.id,
        assigneeId: admin.id,
        dueDate: new Date(now + 7 * day),
        createdAt: new Date(now - 1 * day),
      },
      {
        title: 'Webhook dispatcher and real-time event pipeline optimization',
        description: 'Scale WebSocket notification hub and Slack/Discord webhook broadcasts across active squads.',
        priority: 'MEDIUM',
        status: 'IN_PROGRESS',
        projectId: p1.id,
        assigneeId: admin.id,
        dueDate: new Date(now + 8 * day),
        createdAt: new Date(now - 2 * day),
      },
      {
        title: 'Optimize database connection pooling on port 4000',
        description: 'Tune connection pool limits and idle timeout thresholds for cloud cluster.',
        priority: 'LOW',
        status: 'TODO',
        projectId: p2.id,
        assigneeId: admin.id,
        dueDate: new Date(now + 10 * day),
        createdAt: new Date(now - 1 * day),
      },

      // Tasks assigned to teammates
      {
        title: 'Prisma schema and MySQL database synchronization completed',
        description: 'Database schema migration scripts and seed datasets tested on cloud replica.',
        priority: 'MEDIUM',
        status: 'DONE',
        projectId: p2.id,
        assigneeId: alice.id,
        dueDate: new Date(now + 3 * day),
      },
      {
        title: 'Design UI mockups and Linear tree line navigation',
        description: 'Refactor navigation tree line indentation with pixel-perfect SVG guides and persistent state.',
        priority: 'URGENT',
        status: 'IN_PROGRESS',
        projectId: p5.id,
        assigneeId: charlie.id,
        dueDate: new Date(now + 4 * day),
      },
      {
        title: 'Automated CI Security Alert: Vulnerability patched in Axios',
        description: 'Dependabot bump axios from 1.6.2 to 1.7.4 passed all test suites.',
        priority: 'LOW',
        status: 'DONE',
        projectId: p4.id,
        assigneeId: elena.id,
        dueDate: new Date(now - 1 * day),
      },
      {
        title: 'Mobile navigation gestures and offline draft persistence',
        description: 'Add swipe gestures and IndexedDB synchronization for mobile task tracking.',
        priority: 'HIGH',
        status: 'TODO',
        projectId: p3.id,
        assigneeId: bob.id,
        dueDate: new Date(now + 12 * day),
      },
    ],
  });

  // 7. Organization Activity Logs
  await prisma.organizationActivity.createMany({
    data: [
      {
        organizationId: org.id,
        actorId: admin.id,
        action: 'INITIALIZE',
        resourceType: 'ORGANIZATION',
        resourceId: org.id,
        details: JSON.stringify({ name: org.name, slug: org.slug, initializedBy: 'admin@gmail.com' }),
        createdAt: new Date(now - 3 * day),
      },
      {
        organizationId: org.id,
        actorId: admin.id,
        action: 'CREATE',
        resourceType: 'PROJECT',
        resourceId: p1.id,
        details: JSON.stringify({ title: p1.title, status: p1.status }),
        createdAt: new Date(now - 2 * day),
      },
      {
        organizationId: org.id,
        actorId: alice.id,
        action: 'UPDATE',
        resourceType: 'DATABASE',
        resourceId: 4000,
        details: JSON.stringify({ target: 'TiDB Cloud', status: 'SYNCHRONIZED' }),
        createdAt: new Date(now - 1 * day),
      },
      {
        organizationId: org.id,
        actorId: admin.id,
        action: 'LOGIN',
        resourceType: 'AUTH_SESSION',
        details: JSON.stringify({ email: 'admin@gmail.com', method: 'CREDENTIALS' }),
        createdAt: new Date(now - 2 * 60 * 60 * 1000),
      },
    ],
  });

  console.log('✅ Database successfully seeded for admin@gmail.com!');

  return {
    usersCount: 5,
    projectsCount: 5,
    tasksCount: 11,
    teamsCount: 4,
    organization: org.name,
    adminAccount: 'admin@gmail.com',
  };
}

seedRouter.post('/', async (_req: Request, res: Response) => {
  try {
    const summary = await runDatabaseSeed();
    res.json({
      success: true,
      message: 'Demo database seeded successfully for admin@gmail.com!',
      summary,
    });
  } catch (error: any) {
    console.error('Seed error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

