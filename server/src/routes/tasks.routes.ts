import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

export const tasksRouter = Router();

const createTaskSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
  status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']).optional().default('TODO'),
  projectId: z.number().int().positive('Valid projectId is required'),
  assigneeId: z.number().int().positive().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

// GET /api/tasks - List all tasks (optional filter by projectId or status)
tasksRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId, status, priority } = req.query;

    const where: any = {};
    if (projectId) where.projectId = parseInt(projectId as string, 10);
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        project: {
          select: { id: true, title: true, status: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    res.json({ success: true, data: tasks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/tasks - Create task
tasksRouter.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { dueDate, ...rest } = parsed.data;

    const task = await prisma.task.create({
      data: {
        ...rest,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: {
        project: { select: { id: true, title: true } },
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    res.status(201).json({ success: true, data: task });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

function parseId(param: string | string[] | undefined): number {
  const str = Array.isArray(param) ? param[0] : param;
  return str ? parseInt(str, 10) : NaN;
}

// PATCH /api/tasks/:id - Update task status, priority, or details
tasksRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid task ID' });
    }

    const { title, description, priority, status, assigneeId, dueDate } = req.body;

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(priority !== undefined && { priority }),
        ...(status !== undefined && { status }),
        ...(assigneeId !== undefined && { assigneeId }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      },
      include: {
        project: { select: { id: true, title: true } },
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    res.json({ success: true, data: task });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/tasks/:id - Delete task
tasksRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid task ID' });
    }

    await prisma.task.delete({ where: { id } });
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
