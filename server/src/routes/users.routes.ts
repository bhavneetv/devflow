import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

export const usersRouter = Router();

const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).optional().default('MEMBER'),
  avatarUrl: z.string().url().optional().or(z.literal('')),
});

// GET /api/users - List all users
usersRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { projects: true, assignedTasks: true },
        },
      },
    });
    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

function parseId(param: string | string[] | undefined): number {
  const str = Array.isArray(param) ? param[0] : param;
  return str ? parseInt(str, 10) : NaN;
}

// GET /api/users/:id - Get user by ID
usersRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        projects: true,
        assignedTasks: {
          include: { project: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/users - Create new user
usersRouter.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'User with this email already exists',
      });
    }

    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        avatarUrl: parsed.data.avatarUrl || null,
      },
    });

    res.status(201).json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/users/:id - Delete user
usersRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
