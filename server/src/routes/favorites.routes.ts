import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getUserIdFromToken } from '../lib/auth.js';

export const favoritesRouter = Router();

// GET /api/favorites — list user's favorites
favoritesRouter.get('/', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  let orgId: number | undefined;
  if (req.query.organizationId) {
    const parsed = parseInt(req.query.organizationId as string, 10);
    if (!isNaN(parsed)) orgId = parsed;
  } else if (req.query.organizationSlug) {
    const org = await prisma.organization.findUnique({
      where: { slug: (req.query.organizationSlug as string).toLowerCase() },
      select: { id: true },
    });
    if (org) orgId = org.id;
  }

  try {
    const allFavorites = await prisma.userFavorite.findMany({
      where: {
        userId,
        ...(orgId !== undefined ? { organizationId: orgId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    const projectIds = allFavorites.filter((f) => f.resourceType === 'PROJECT').map((f) => f.resourceId);
    const teamIds = allFavorites.filter((f) => f.resourceType === 'TEAM').map((f) => f.resourceId);

    const [projects, teams] = await Promise.all([
      projectIds.length > 0
        ? prisma.project.findMany({
            where: { id: { in: projectIds } },
            select: {
              id: true,
              title: true,
              identifier: true,
              status: true,
              priority: true,
              category: true,
              avatarColor: true,
              avatarIcon: true,
              organizationId: true,
            },
          })
        : [],
      teamIds.length > 0
        ? prisma.team.findMany({
            where: { id: { in: teamIds } },
            include: {
              _count: { select: { members: true } },
            },
          })
        : [],
    ]);

    return res.json({
      success: true,
      data: {
        raw: allFavorites,
        projects: projects.map((p) => ({
          ...p,
          isFavorite: true,
        })),
        teams: teams.map((t) => ({
          id: t.id,
          name: t.name,
          color: t.color,
          description: t.description,
          organizationId: t.organizationId,
          memberCount: t._count.members,
          isFavorite: true,
        })),
        favoriteProjectIds: projectIds,
        favoriteTeamIds: teamIds,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch favorites' });
  }
});

const toggleFavoriteSchema = z.object({
  resourceType: z.enum(['PROJECT', 'TEAM']),
  resourceId: z.number().int().positive(),
  organizationId: z.number().int().positive().optional(),
});

// POST /api/favorites/toggle — Toggle favorite status for a project or team
favoritesRouter.post('/toggle', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const parsed = toggleFavoriteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Validation failed' });
  }

  const { resourceType, resourceId } = parsed.data;
  let finalOrgId = parsed.data.organizationId;

  try {
    // If organizationId not provided, auto-lookup from project or team
    if (!finalOrgId) {
      if (resourceType === 'PROJECT') {
        const proj = await prisma.project.findUnique({ where: { id: resourceId }, select: { organizationId: true } });
        if (proj?.organizationId) finalOrgId = proj.organizationId;
      } else if (resourceType === 'TEAM') {
        const team = await prisma.team.findUnique({ where: { id: resourceId }, select: { organizationId: true } });
        if (team?.organizationId) finalOrgId = team.organizationId;
      }
    }

    const existing = await prisma.userFavorite.findUnique({
      where: {
        userId_resourceType_resourceId: {
          userId,
          resourceType,
          resourceId,
        },
      },
    });

    if (existing) {
      await prisma.userFavorite.delete({
        where: { id: existing.id },
      });
      return res.json({
        success: true,
        isFavorite: false,
        resourceType,
        resourceId,
        message: `Removed from favorites`,
      });
    } else {
      const created = await prisma.userFavorite.create({
        data: {
          userId,
          resourceType,
          resourceId,
          organizationId: finalOrgId || null,
        },
      });
      return res.status(201).json({
        success: true,
        isFavorite: true,
        resourceType,
        resourceId,
        data: created,
        message: `Added to favorites`,
      });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to toggle favorite' });
  }
});

