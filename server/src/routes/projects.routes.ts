import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

export const projectsRouter = Router();

const createProjectSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  description: z.string().optional(),
  status: z.enum(['PLANNING', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED']).optional().default('IN_PROGRESS'),
  ownerId: z.number().int().positive('Valid ownerId is required'),
  organizationId: z.number().int().positive().optional(),
  organizationSlug: z.string().optional(),
});

// GET /api/projects - List all projects (with optional organization filter)
projectsRouter.get('/', async (req: Request, res: Response) => {
  try {
    let orgFilterId: number | undefined;
    if (req.query.organizationId) {
      const parsedId = parseInt(req.query.organizationId as string, 10);
      if (!isNaN(parsedId)) orgFilterId = parsedId;
    } else if (req.query.organizationSlug) {
      const org = await prisma.organization.findUnique({
        where: { slug: (req.query.organizationSlug as string).toLowerCase() },
        select: { id: true },
      });
      if (org) orgFilterId = org.id;
    }

    const projects = await prisma.project.findMany({
      where: orgFilterId !== undefined ? { organizationId: orgFilterId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        tasks: {
          include: {
            assignee: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        _count: {
          select: { tasks: true },
        },
      },
    });
    res.json({ success: true, data: projects });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

function parseId(param: string | string[] | undefined): number {
  const str = Array.isArray(param) ? param[0] : param;
  return str ? parseInt(str, 10) : NaN;
}

// GET /api/projects/:id - Get project by ID
projectsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        tasks: {
          include: {
            assignee: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    res.json({ success: true, data: project });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/projects - Create project
projectsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    // Verify owner exists
    const owner = await prisma.user.findUnique({
      where: { id: parsed.data.ownerId },
    });
    if (!owner) {
      return res.status(400).json({
        success: false,
        error: `Owner with ID ${parsed.data.ownerId} does not exist`,
      });
    }

    let finalOrgId: number | null = parsed.data.organizationId || null;
    if (!finalOrgId && parsed.data.organizationSlug) {
      const org = await prisma.organization.findUnique({
        where: { slug: parsed.data.organizationSlug.toLowerCase() },
        select: { id: true },
      });
      if (org) finalOrgId = org.id;
    }

    const project = await prisma.project.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        status: parsed.data.status,
        ownerId: parsed.data.ownerId,
        organizationId: finalOrgId,
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    if (finalOrgId) {
      try {
        await prisma.organizationActivity.create({
          data: {
            organizationId: finalOrgId,
            actorId: parsed.data.ownerId,
            action: 'CREATED_PROJECT',
            resourceType: 'PROJECT',
            resourceId: project.id,
            details: JSON.stringify({ title: project.title, status: project.status }),
          },
        });
      } catch (err) {
        console.error('Failed to record org activity for project creation:', err);
      }
    }

    res.status(201).json({ success: true, data: project });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/projects/:id - Update project
projectsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const { title, description, status } = req.body;
    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    res.json({ success: true, data: project });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/projects/:id - Delete project
projectsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    await prisma.project.delete({ where: { id } });
    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
