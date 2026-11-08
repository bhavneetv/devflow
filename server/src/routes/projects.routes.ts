import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getProjectOverview } from '../services/projectOverview.service.js';

export const projectsRouter = Router();

const createProjectSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  identifier: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(['PLANNING', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED', 'BACKLOG', 'PENDING']).optional().default('IN_PROGRESS'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
  category: z.string().optional().default('General'),
  avatarColor: z.string().optional().default('#8B5CF6'),
  avatarIcon: z.string().optional().default('folder'),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  ownerId: z.number().int().positive('Valid ownerId is required'),
  leadId: z.number().int().positive().optional().nullable(),
  teamId: z.number().int().positive().optional().nullable(),
  memberIds: z.array(z.number().int().positive()).optional(),
  organizationId: z.number().int().positive().optional().nullable(),
  organizationSlug: z.string().optional(),
});

const userSelectFields = {
  id: true,
  name: true,
  username: true,
  email: true,
  avatarUrl: true,
  avatarColor: true,
  avatarType: true,
  avatarId: true,
  jobTitle: true,
};

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
        owner: { select: userSelectFields },
        lead: { select: userSelectFields },
        team: { select: { id: true, name: true, color: true } },
        members: {
          include: {
            user: { select: userSelectFields },
          },
        },
        tasks: {
          include: {
            assignee: { select: userSelectFields },
          },
        },
        _count: {
          select: { tasks: true, members: true },
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

// GET /api/projects/:id/overview - Get comprehensive project command center overview
projectsRouter.get('/:id/overview', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const forceIllustrative = req.query.illustrative === 'true';
    const userId = (req as any).user?.id || (req.query.userId ? parseInt(req.query.userId as string, 10) : undefined);

    const overview = await getProjectOverview(id, userId, forceIllustrative);
    if (!overview) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    res.json({ success: true, data: overview });
  } catch (error: any) {
    console.error('Failed to get project overview:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

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
        owner: { select: userSelectFields },
        lead: { select: userSelectFields },
        team: { select: { id: true, name: true, color: true, description: true } },
        members: {
          include: {
            user: { select: userSelectFields },
          },
        },
        tasks: {
          include: {
            assignee: { select: userSelectFields },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { tasks: true, members: true },
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

    // Parse dates if provided
    const startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : null;
    const endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null;

    const project = await prisma.project.create({
      data: {
        title: parsed.data.title,
        identifier: parsed.data.identifier || null,
        description: parsed.data.description || null,
        status: parsed.data.status,
        priority: parsed.data.priority,
        category: parsed.data.category || 'General',
        avatarColor: parsed.data.avatarColor || '#8B5CF6',
        avatarIcon: parsed.data.avatarIcon || 'folder',
        startDate: startDate && !isNaN(startDate.getTime()) ? startDate : null,
        endDate: endDate && !isNaN(endDate.getTime()) ? endDate : null,
        ownerId: parsed.data.ownerId,
        leadId: parsed.data.leadId || null,
        teamId: parsed.data.teamId || null,
        organizationId: finalOrgId,
        ...(parsed.data.memberIds && parsed.data.memberIds.length > 0
          ? {
              members: {
                create: parsed.data.memberIds.map((userId) => ({
                  userId,
                  role: userId === parsed.data.leadId ? 'LEAD' : 'COLLABORATOR',
                })),
              },
            }
          : {}),
      },
      include: {
        owner: { select: userSelectFields },
        lead: { select: userSelectFields },
        team: { select: { id: true, name: true, color: true } },
        members: {
          include: {
            user: { select: userSelectFields },
          },
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

    const {
      title,
      identifier,
      description,
      status,
      priority,
      category,
      avatarColor,
      avatarIcon,
      startDate,
      endDate,
      leadId,
      teamId,
      memberIds,
    } = req.body;

    // Sync project members if provided
    if (Array.isArray(memberIds)) {
      await prisma.projectMember.deleteMany({
        where: { projectId: id },
      });
      if (memberIds.length > 0) {
        await prisma.projectMember.createMany({
          data: memberIds.map((userId: number) => ({
            projectId: id,
            userId,
            role: userId === leadId ? 'LEAD' : 'COLLABORATOR',
          })),
        });
      }
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(identifier !== undefined && { identifier }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
        ...(category !== undefined && { category }),
        ...(avatarColor !== undefined && { avatarColor }),
        ...(avatarIcon !== undefined && { avatarIcon }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(leadId !== undefined && { leadId }),
        ...(teamId !== undefined && { teamId }),
      },
      include: {
        owner: { select: userSelectFields },
        lead: { select: userSelectFields },
        team: { select: { id: true, name: true, color: true } },
        members: {
          include: {
            user: { select: userSelectFields },
          },
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
