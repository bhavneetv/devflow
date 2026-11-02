import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export const seedRouter = Router();

export async function runDatabaseSeed() {
  // Clear existing in reverse order of dependencies
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  // Create demo users
  const alice = await prisma.user.create({
    data: {
      name: 'Alice Johnson',
      email: 'alice@devflow.io',
      role: 'ADMIN',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    },
  });

  const bob = await prisma.user.create({
    data: {
      name: 'Bob Smith',
      email: 'bob@devflow.io',
      role: 'MEMBER',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    },
  });

  const charlie = await prisma.user.create({
    data: {
      name: 'Charlie Davis',
      email: 'charlie@devflow.io',
      role: 'MEMBER',
      avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150',
    },
  });

  // Create demo projects
  const p1 = await prisma.project.create({
    data: {
      title: 'DevFlow Cloud Platform v2',
      description: 'Migrating backend architecture to microservices with event-driven notifications.',
      status: 'IN_PROGRESS',
      ownerId: alice.id,
    },
  });

  const p2 = await prisma.project.create({
    data: {
      title: 'Mobile App Redesign',
      description: 'Modernizing mobile experience with dark mode and offline sync capabilities.',
      status: 'PLANNING',
      ownerId: bob.id,
    },
  });

  // Create demo tasks
  await prisma.task.createMany({
    data: [
      {
        title: 'Configure Prisma with MySQL schema',
        description: 'Set up schema models, indexes, and initial migrations for XAMPP MySQL.',
        priority: 'URGENT',
        status: 'DONE',
        projectId: p1.id,
        assigneeId: alice.id,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      },
      {
        title: 'Implement Express REST API with TypeScript',
        description: 'Create CRUD endpoints for users, projects, and tasks with Zod validation.',
        priority: 'HIGH',
        status: 'DONE',
        projectId: p1.id,
        assigneeId: bob.id,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
      {
        title: 'Connect React Frontend to Node API',
        description: 'Build dashboard widgets with live status ping and relational data explorer.',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        projectId: p1.id,
        assigneeId: charlie.id,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      },
      {
        title: 'Design UI mockups in Figma',
        description: 'Complete high-fidelity mockups for navigation and task management board.',
        priority: 'MEDIUM',
        status: 'TODO',
        projectId: p2.id,
        assigneeId: bob.id,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  return {
    usersCount: 3,
    projectsCount: 2,
    tasksCount: 4,
  };
}

seedRouter.post('/', async (_req: Request, res: Response) => {
  try {
    const summary = await runDatabaseSeed();
    res.json({
      success: true,
      message: 'Demo database seeded successfully!',
      summary,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
