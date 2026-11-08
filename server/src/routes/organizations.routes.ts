import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { getUserIdFromToken } from '../lib/auth.js';
import { sendOrganizationInvitationEmail, sendInvitationDecisionEmail, sendOrgJoinRequestEmail } from '../lib/email.service.js';
import { createNotification } from './notifications.routes.js';

export const organizationsRouter = Router();

// ─── Helpers & Permission Checks ─────────────────────────────────────────────

export const ORG_ROLE_HIERARCHY: Record<string, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

export function canManageOrgRole(actorRole: string, targetRole: string): boolean {
  return (ORG_ROLE_HIERARCHY[actorRole] ?? 0) > (ORG_ROLE_HIERARCHY[targetRole] ?? 0);
}

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

/**
 * Resolves an organization by numeric ID or unique slug.
 */
async function resolveOrganization(slugOrId: string) {
  if (/^\d+$/.test(slugOrId)) {
    const id = parseInt(slugOrId, 10);
    return prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            members: true,
            teams: true,
            projects: true,
            invitations: { where: { status: 'PENDING' } },
          },
        },
      },
    });
  }
  return prisma.organization.findUnique({
    where: { slug: slugOrId.toLowerCase() },
    include: {
      _count: {
        select: {
          members: true,
          teams: true,
          projects: true,
          invitations: { where: { status: 'PENDING' } },
        },
      },
    },
  });
}

/**
 * Gets the caller's membership in the target organization.
 */
async function getCallerOrgMembership(organizationId: number, userId: number) {
  return prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
  });
}

/**
 * Helper to record organization audit activity.
 */
async function recordOrgActivity(params: {
  organizationId: number;
  actorId?: number | null;
  action: string;
  resourceType: string;
  resourceId?: number | null;
  details?: Record<string, any>;
}) {
  try {
    await prisma.organizationActivity.create({
      data: {
        organizationId: params.organizationId,
        actorId: params.actorId || null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId || null,
        details: params.details ? JSON.stringify(params.details) : null,
      },
    });
  } catch (err) {
    console.error('Failed to record organization activity:', err);
  }
}

// ─── Input Validation Schemas ───────────────────────────────────────────────

const createOrgSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(64),
  slug: z
    .string()
    .trim()
    .min(2, 'Slug must be at least 2 characters')
    .max(48)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may only contain lowercase letters, numbers, and hyphens'),
  description: z.string().trim().max(500).optional(),
  logoUrl: z.string().max(2000).optional(),
  initialInvites: z
    .array(
      z.object({
        email: z.string().email(),
        role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).optional().default('MEMBER'),
      })
    )
    .optional(),
});

const updateOrgSchema = z.object({
  name: z.string().trim().min(2).max(64).optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  description: z.string().trim().max(500).optional(),
  logoUrl: z.string().max(2000).optional(),
});

const inviteMemberSchema = z.object({
  email: z.string().email('Valid email address is required'),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).optional().default('MEMBER'),
});

const changeRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
});

const transferOwnershipSchema = z.object({
  targetUserId: z.number().int().positive('Valid target user ID is required'),
});

// ─── Endpoints ─────────────────────────────────────────────────────────────

// GET /api/organizations/check-slug/:slug — Check slug uniqueness & format
organizationsRouter.get('/check-slug/:slug', async (req: Request, res: Response) => {
  const slug = getParam(req.params.slug);
  const normalized = slug.toLowerCase().trim();

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) || normalized.length < 2 || normalized.length > 48) {
    return res.json({
      success: true,
      available: false,
      error: 'Slug must be 2-48 characters, lowercase alphanumeric with hyphens',
    });
  }

  const existing = await prisma.organization.findUnique({
    where: { slug: normalized },
    select: { id: true },
  });

  return res.json({
    success: true,
    available: !existing,
    slug: normalized,
  });
});

// GET /api/organizations — List all organizations caller belongs to
organizationsRouter.get('/', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const memberships = await prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: {
          include: {
            _count: {
              select: {
                members: true,
                teams: true,
                projects: true,
              },
            },
            createdBy: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const organizations = memberships.map((m) => ({
      ...m.organization,
      currentUserRole: m.role,
      joinedAt: m.joinedAt,
      isOwner: m.role === 'OWNER',
    }));

    return res.json({ success: true, data: organizations });
  } catch (err: any) {
    console.error('List organizations error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to list organizations' });
  }
});

// POST /api/organizations — Create new organization
organizationsRouter.post('/', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const parsed = createOrgSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: parsed.error.issues[0]?.message || 'Validation failed',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const { name, slug, description, logoUrl, initialInvites } = parsed.data;

  // Verify slug uniqueness
  const existing = await prisma.organization.findUnique({ where: { slug } });
  if (existing) {
    return res.status(409).json({ success: false, error: 'An organization with this slug already exists' });
  }

  try {
    const creator = await prisma.user.findUnique({ where: { id: userId } });
    if (!creator) return res.status(404).json({ success: false, error: 'User not found' });

    // Execute in transaction
    const newOrg = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name,
          slug,
          description: description || null,
          logoUrl: logoUrl || null,
          createdById: userId,
          members: {
            create: {
              userId,
              role: 'OWNER',
            },
          },
        },
      });

      // Process initial invitations if any
      if (initialInvites && initialInvites.length > 0) {
        for (const inv of initialInvites) {
          if (inv.email.toLowerCase() === creator.email.toLowerCase()) continue;
          const token = crypto.randomBytes(32).toString('hex');
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

          await tx.organizationInvitation.create({
            data: {
              organizationId: org.id,
              invitedById: userId,
              invitedEmail: inv.email.toLowerCase(),
              assignedRole: inv.role,
              invitationToken: token,
              expiresAt,
            },
          });
        }
      }

      return org;
    });

    await recordOrgActivity({
      organizationId: newOrg.id,
      actorId: userId,
      action: 'CREATED_ORGANIZATION',
      resourceType: 'ORGANIZATION',
      resourceId: newOrg.id,
      details: { name: newOrg.name, slug: newOrg.slug },
    });

    return res.status(201).json({
      success: true,
      data: {
        ...newOrg,
        currentUserRole: 'OWNER',
      },
    });
  } catch (err: any) {
    console.error('Create organization error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to create organization' });
  }
});

// GET /api/organizations/:slugOrId — Get organization overview and details
organizationsRouter.get('/:slugOrId', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const slugOrId = getParam(req.params.slugOrId);
  const org = await resolveOrganization(slugOrId);
  if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

  const membership = await getCallerOrgMembership(org.id, userId);
  if (!membership) {
    return res.status(403).json({ success: false, error: 'Access denied: You are not a member of this organization' });
  }

  return res.json({
    success: true,
    data: {
      ...org,
      currentUserRole: membership.role,
      joinedAt: membership.joinedAt,
      isOwner: membership.role === 'OWNER',
    },
  });
});

// GET /api/organizations/:slugOrId/overview — Aggregated organization dashboard metrics
organizationsRouter.get('/:slugOrId/overview', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const slugOrId = getParam(req.params.slugOrId);
  const org = await resolveOrganization(slugOrId);
  if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

  const membership = await getCallerOrgMembership(org.id, userId);
  if (!membership) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  try {
    const [
      membersCount,
      members,
      teams,
      projects,
      openTasksCount,
      completedTasksCount,
      recentActivities,
      allTasks,
    ] = await Promise.all([
      prisma.organizationMember.count({ where: { organizationId: org.id } }),
      prisma.organizationMember.findMany({
        where: { organizationId: org.id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              avatarColor: true,
              avatarId: true,
              avatarType: true,
            },
          },
        },
        take: 10,
      }),
      prisma.team.findMany({
        where: { organizationId: org.id },
        include: {
          _count: { select: { members: true } },
          createdBy: { select: { id: true, name: true, avatarUrl: true } },
          members: {
            take: 5,
            include: { user: { select: { id: true, name: true, avatarUrl: true, avatarColor: true, avatarId: true, avatarType: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.findMany({
        where: { organizationId: org.id },
        include: {
          owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
          _count: { select: { tasks: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 12,
      }),
      prisma.task.count({
        where: {
          project: { organizationId: org.id },
          status: { in: ['TODO', 'IN_PROGRESS', 'IN_REVIEW'] },
        },
      }),
      prisma.task.count({
        where: {
          project: { organizationId: org.id },
          status: 'DONE',
        },
      }),
      prisma.organizationActivity.findMany({
        where: { organizationId: org.id },
        include: {
          actor: { select: { id: true, name: true, email: true, avatarUrl: true, avatarColor: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 16,
      }),
      prisma.task.findMany({
        where: { project: { organizationId: org.id } },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
          updatedAt: true,
          projectId: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
    ]);

    const projectStatusCounts = {
      IN_PROGRESS: projects.filter((p) => p.status === 'IN_PROGRESS').length,
      COMPLETED: projects.filter((p) => p.status === 'COMPLETED').length,
      PLANNING: projects.filter((p) => p.status === 'PLANNING').length,
      ARCHIVED: projects.filter((p) => p.status === 'ARCHIVED').length,
    };

    return res.json({
      success: true,
      data: {
        organization: {
          ...org,
          currentUserRole: membership.role,
        },
        currentRole: membership.role,
        summary: {
          totalMembers: membersCount,
          totalTeams: teams.length,
          totalProjects: projects.length,
          openIssues: openTasksCount,
          completedIssues: completedTasksCount,
          totalTasks: openTasksCount + completedTasksCount,
        },
        stats: {
          totalMembers: membersCount,
          totalTeams: teams.length,
          totalProjects: projects.length,
          openIssues: openTasksCount,
          completedIssues: completedTasksCount,
        },
        projectStatusCounts,
        members,
        teams,
        projects,
        recentActivities,
        allTasks,
      },
    });
  } catch (err: any) {
    console.error('Organization overview error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to load organization overview' });
  }
});

// PATCH /api/organizations/:slugOrId — Update organization details
organizationsRouter.patch('/:slugOrId', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const slugOrId = getParam(req.params.slugOrId);
  const org = await resolveOrganization(slugOrId);
  if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

  const membership = await getCallerOrgMembership(org.id, userId);
  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
    return res.status(403).json({ success: false, error: 'Only organization Owners and Admins can update settings' });
  }

  const parsed = updateOrgSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid input' });
  }

  const { name, slug, description, logoUrl } = parsed.data;

  // If changing slug, check uniqueness
  if (slug && slug !== org.slug) {
    const conflict = await prisma.organization.findUnique({ where: { slug } });
    if (conflict) {
      return res.status(409).json({ success: false, error: 'An organization with this slug already exists' });
    }
  }

  try {
    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(description !== undefined && { description }),
        ...(logoUrl !== undefined && { logoUrl }),
      },
    });

    await recordOrgActivity({
      organizationId: org.id,
      actorId: userId,
      action: 'UPDATED_SETTINGS',
      resourceType: 'ORGANIZATION',
      resourceId: org.id,
      details: { changes: parsed.data },
    });

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to update organization' });
  }
});

// DELETE /api/organizations/:slugOrId — Delete organization (Owner only)
organizationsRouter.delete('/:slugOrId', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const slugOrId = getParam(req.params.slugOrId);
  const org = await resolveOrganization(slugOrId);
  if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

  const membership = await getCallerOrgMembership(org.id, userId);
  if (!membership || membership.role !== 'OWNER') {
    return res.status(403).json({ success: false, error: 'Only the organization Owner can delete this organization' });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Unlink teams and projects
      await tx.team.updateMany({
        where: { organizationId: org.id },
        data: { organizationId: null },
      });
      await tx.project.updateMany({
        where: { organizationId: org.id },
        data: { organizationId: null },
      });
      // Delete organization (cascades members, invitations, activities)
      await tx.organization.delete({
        where: { id: org.id },
      });
    });

    return res.json({ success: true, message: 'Organization deleted successfully' });
  } catch (err: any) {
    console.error('Delete organization error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to delete organization' });
  }
});

// POST /api/organizations/:slugOrId/transfer-ownership — Transfer ownership
organizationsRouter.post('/:slugOrId/transfer-ownership', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const slugOrId = getParam(req.params.slugOrId);
  const org = await resolveOrganization(slugOrId);
  if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

  const membership = await getCallerOrgMembership(org.id, userId);
  if (!membership || membership.role !== 'OWNER') {
    return res.status(403).json({ success: false, error: 'Only the current Owner can transfer organization ownership' });
  }

  const parsed = transferOwnershipSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
  }

  const { targetUserId } = parsed.data;
  if (targetUserId === userId) {
    return res.status(400).json({ success: false, error: 'You are already the owner of this organization' });
  }

  const targetMembership = await getCallerOrgMembership(org.id, targetUserId);
  if (!targetMembership) {
    return res.status(404).json({ success: false, error: 'Target user is not a member of this organization' });
  }

  try {
    await prisma.$transaction([
      prisma.organizationMember.update({
        where: { organizationId_userId: { organizationId: org.id, userId: targetUserId } },
        data: { role: 'OWNER' },
      }),
      prisma.organizationMember.update({
        where: { organizationId_userId: { organizationId: org.id, userId } },
        data: { role: 'ADMIN' },
      }),
      prisma.organization.update({
        where: { id: org.id },
        data: { createdById: targetUserId },
      }),
    ]);

    await recordOrgActivity({
      organizationId: org.id,
      actorId: userId,
      action: 'TRANSFERRED_OWNERSHIP',
      resourceType: 'ORGANIZATION',
      resourceId: org.id,
      details: { previousOwnerId: userId, newOwnerId: targetUserId },
    });

    return res.json({ success: true, message: 'Ownership transferred successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to transfer ownership' });
  }
});

// ─── Members & Invitations Endpoints ─────────────────────────────────────────

// GET /api/organizations/:slugOrId/members — List organization members
organizationsRouter.get('/:slugOrId/members', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const slugOrId = getParam(req.params.slugOrId);
  const org = await resolveOrganization(slugOrId);
  if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

  const callerMembership = await getCallerOrgMembership(org.id, userId);
  if (!callerMembership) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  try {
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: org.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            avatarColor: true,
            avatarId: true,
            avatarType: true,
            role: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return res.json({
      success: true,
      data: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.user,
        isSelf: m.userId === userId,
        canManage: ['OWNER', 'ADMIN'].includes(callerMembership.role) && m.role !== 'OWNER',
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch members' });
  }
});

// PATCH /api/organizations/:slugOrId/members/:memberId/role — Change member role
organizationsRouter.patch('/:slugOrId/members/:memberId/role', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const slugOrId = getParam(req.params.slugOrId);
  const memberId = getParam(req.params.memberId);
  const org = await resolveOrganization(slugOrId);
  if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

  const callerMembership = await getCallerOrgMembership(org.id, userId);
  if (!callerMembership || !['OWNER', 'ADMIN'].includes(callerMembership.role)) {
    return res.status(403).json({ success: false, error: 'Only Owners and Admins can change member roles' });
  }

  const parsed = changeRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
  }

  const targetMemberId = parseInt(memberId, 10);
  const targetMember = await prisma.organizationMember.findFirst({
    where: {
      organizationId: org.id,
      OR: [{ id: targetMemberId }, { userId: targetMemberId }],
    },
  });

  if (!targetMember) {
    return res.status(404).json({ success: false, error: 'Member not found in organization' });
  }

  if (targetMember.role === 'OWNER') {
    return res.status(400).json({ success: false, error: 'Cannot change role of the organization Owner. Transfer ownership first.' });
  }

  if (callerMembership.role === 'ADMIN' && targetMember.role === 'ADMIN' && targetMember.userId !== userId) {
    return res.status(403).json({ success: false, error: 'Admins cannot change roles of other Admins' });
  }

  try {
    const updated = await prisma.organizationMember.update({
      where: { id: targetMember.id },
      data: { role: parsed.data.role },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    await recordOrgActivity({
      organizationId: org.id,
      actorId: userId,
      action: 'UPDATED_MEMBER_ROLE',
      resourceType: 'MEMBER',
      resourceId: targetMember.userId,
      details: { newRole: parsed.data.role, targetName: updated.user.name },
    });

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to change role' });
  }
});

// DELETE /api/organizations/:slugOrId/members/:memberId — Remove member or leave
organizationsRouter.delete('/:slugOrId/members/:memberId', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const slugOrId = getParam(req.params.slugOrId);
  const memberId = getParam(req.params.memberId);
  const org = await resolveOrganization(slugOrId);
  if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

  const callerMembership = await getCallerOrgMembership(org.id, userId);
  if (!callerMembership) return res.status(403).json({ success: false, error: 'Access denied' });

  const targetMemberId = parseInt(memberId, 10);
  const targetMember = await prisma.organizationMember.findFirst({
    where: {
      organizationId: org.id,
      OR: [{ id: targetMemberId }, { userId: targetMemberId }],
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (!targetMember) {
    return res.status(404).json({ success: false, error: 'Member not found in organization' });
  }

  const isSelf = targetMember.userId === userId;
  const canRemove = ['OWNER', 'ADMIN'].includes(callerMembership.role) && targetMember.role !== 'OWNER';

  if (!isSelf && !canRemove) {
    return res.status(403).json({ success: false, error: 'You do not have permission to remove this member' });
  }

  if (targetMember.role === 'OWNER') {
    return res.status(400).json({ success: false, error: 'The Owner cannot leave the organization without transferring ownership first' });
  }

  try {
    await prisma.organizationMember.delete({ where: { id: targetMember.id } });

    await recordOrgActivity({
      organizationId: org.id,
      actorId: userId,
      action: isSelf ? 'LEFT_ORGANIZATION' : 'REMOVED_MEMBER',
      resourceType: 'MEMBER',
      resourceId: targetMember.userId,
      details: { memberName: targetMember.user.name, isSelf },
    });

    return res.json({ success: true, message: isSelf ? 'You left the organization' : 'Member removed' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to remove member' });
  }
});

// GET /api/organizations/:slugOrId/invitations — List pending invitations
organizationsRouter.get('/:slugOrId/invitations', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const slugOrId = getParam(req.params.slugOrId);
  const org = await resolveOrganization(slugOrId);
  if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

  const callerMembership = await getCallerOrgMembership(org.id, userId);
  if (!callerMembership) return res.status(403).json({ success: false, error: 'Access denied' });

  try {
    const invitations = await prisma.organizationInvitation.findMany({
      where: { organizationId: org.id, status: 'PENDING' },
      include: {
        invitedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: invitations });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to list invitations' });
  }
});

// POST /api/organizations/:slugOrId/invitations — Send organization invitation
organizationsRouter.post('/:slugOrId/invitations', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const slugOrId = getParam(req.params.slugOrId);
  const org = await resolveOrganization(slugOrId);
  if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

  const callerMembership = await getCallerOrgMembership(org.id, userId);
  if (!callerMembership || !['OWNER', 'ADMIN'].includes(callerMembership.role)) {
    return res.status(403).json({ success: false, error: 'Only Owners and Admins can invite new members' });
  }

  const parsed = inviteMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
  }

  const { email, role } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  // Check if user is already a member
  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) {
    const existingMember = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: org.id, userId: existingUser.id } },
    });
    if (existingMember) {
      return res.status(400).json({ success: false, error: 'User is already a member of this organization' });
    }
  }

  // Check if pending invitation exists
  const pendingInvite = await prisma.organizationInvitation.findFirst({
    where: { organizationId: org.id, invitedEmail: normalizedEmail, status: 'PENDING' },
  });
  if (pendingInvite) {
    return res.status(400).json({ success: false, error: 'A pending invitation has already been sent to this email' });
  }

  try {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await prisma.organizationInvitation.create({
      data: {
        organizationId: org.id,
        invitedById: userId,
        invitedEmail: normalizedEmail,
        assignedRole: role,
        invitationToken: token,
        expiresAt,
      },
      include: {
        invitedBy: { select: { id: true, name: true, email: true } },
      },
    });

    await recordOrgActivity({
      organizationId: org.id,
      actorId: userId,
      action: 'INVITED_MEMBER',
      resourceType: 'INVITATION',
      resourceId: invitation.id,
      details: { email: normalizedEmail, role },
    });

    const origin = req.get('origin') || process.env.CORS_ORIGIN || 'http://localhost:5173';
    const inviteLink = `${origin}/organizations/join/${token}`;

    // 1. Dispatch Email
    sendOrganizationInvitationEmail({
      toEmail: normalizedEmail,
      organizationName: org.name,
      inviterName: callerMembership.user.name || callerMembership.user.email,
      assignedRole: role,
      inviteLink,
      message: (req.body as any).message,
    }).catch((err) => console.warn('Background sendOrganizationInvitationEmail error:', err));

    // 2. If the user already has an account, immediately create in-app notification
    if (existingUser) {
      await createNotification({
        recipientId: existingUser.id,
        type: 'ORGANIZATION_INVITATION',
        title: `Invitation to join ${org.name}`,
        message: `${callerMembership.user.name || 'An admin'} invited you to join ${org.name} as a ${role}.`,
        data: {
          token,
          invitationId: invitation.id,
          organizationId: org.id,
          organizationName: org.name,
          organizationSlug: org.slug,
          role,
          inviterName: callerMembership.user.name || callerMembership.user.email,
        },
        relatedInvitationId: invitation.id,
        relatedOrganizationId: org.id,
      });
    }

    return res.status(201).json({ success: true, data: invitation, inviteLink });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to send invitation' });
  }
});

// GET /api/organizations/join/:token — Preview organization invitation details
organizationsRouter.get('/join/:token', async (req: Request, res: Response) => {
  const token = getParam(req.params.token);
  try {
    const invitation = await prisma.organizationInvitation.findUnique({
      where: { invitationToken: token },
      include: {
        organization: { select: { id: true, name: true, slug: true, description: true, logoUrl: true } },
        invitedBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    if (!invitation) {
      return res.status(404).json({ success: false, error: 'Invitation not found' });
    }

    if (invitation.status !== 'PENDING') {
      return res.status(410).json({ success: false, error: `This invitation has already been ${invitation.status.toLowerCase()}`, status: invitation.status });
    }

    if (new Date() > invitation.expiresAt) {
      await prisma.organizationInvitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } });
      return res.status(410).json({ success: false, error: 'This invitation has expired', status: 'EXPIRED' });
    }

    return res.json({ success: true, data: invitation });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/organizations/:slugOrId/invitations/:invitationId — Cancel invitation
organizationsRouter.delete('/:slugOrId/invitations/:invitationId', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const slugOrId = getParam(req.params.slugOrId);
  const invitationId = getParam(req.params.invitationId);
  const org = await resolveOrganization(slugOrId);
  if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

  const callerMembership = await getCallerOrgMembership(org.id, userId);
  if (!callerMembership || !['OWNER', 'ADMIN'].includes(callerMembership.role)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  const id = parseInt(invitationId, 10);
  try {
    await prisma.organizationInvitation.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    return res.json({ success: true, message: 'Invitation cancelled' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to cancel invitation' });
  }
});

// POST /api/organizations/join/:token — Accept organization invitation
organizationsRouter.post('/join/:token', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Authentication required to accept invitation' });

  const token = getParam(req.params.token);
  const invitation = await prisma.organizationInvitation.findUnique({
    where: { invitationToken: token },
    include: {
      organization: true,
      invitedBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!invitation || invitation.status !== 'PENDING') {
    return res.status(404).json({ success: false, error: 'Invalid or expired invitation' });
  }

  if (new Date() > invitation.expiresAt) {
    await prisma.organizationInvitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } });
    return res.status(410).json({ success: false, error: 'This invitation has expired' });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  // Strictly verify email match
  if (user.email.toLowerCase() !== invitation.invitedEmail.toLowerCase()) {
    return res.status(403).json({
      success: false,
      error: `This invitation was sent to ${invitation.invitedEmail}. Please log in with that account.`,
    });
  }

  try {
    await prisma.$transaction([
      prisma.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: invitation.organizationId, userId } },
        update: { role: invitation.assignedRole },
        create: {
          organizationId: invitation.organizationId,
          userId,
          role: invitation.assignedRole,
        },
      }),
      prisma.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      }),
      prisma.notification.updateMany({
        where: {
          recipientId: userId,
          type: 'ORGANIZATION_INVITATION',
          relatedInvitationId: invitation.id,
        },
        data: { isRead: true },
      }),
    ]);

    await recordOrgActivity({
      organizationId: invitation.organizationId,
      actorId: userId,
      action: 'JOINED_ORGANIZATION',
      resourceType: 'MEMBER',
      resourceId: userId,
      details: { role: invitation.assignedRole },
    });

    if (invitation.invitedBy?.email) {
      sendInvitationDecisionEmail({
        toEmail: invitation.invitedBy.email,
        userName: user.name || user.email,
        targetName: invitation.organization.name,
        type: 'ORGANIZATION',
        decision: 'ACCEPTED',
        role: invitation.assignedRole,
      }).catch((e) => console.warn('Background decision email error:', e));
    }

    return res.json({
      success: true,
      data: {
        organization: invitation.organization,
        role: invitation.assignedRole,
      },
      message: `You have successfully joined ${invitation.organization.name}`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to join organization' });
  }
});

// POST /api/organizations/join/:token/decline — Decline organization invitation
organizationsRouter.post('/join/:token/decline', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });

  const token = getParam(req.params.token);
  const invitation = await prisma.organizationInvitation.findUnique({
    where: { invitationToken: token },
    include: {
      organization: true,
      invitedBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!invitation || invitation.status !== 'PENDING') {
    return res.status(404).json({ success: false, error: 'Invitation not found or already processed' });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.email.toLowerCase() !== invitation.invitedEmail.toLowerCase()) {
    return res.status(403).json({ success: false, error: 'Email mismatch' });
  }

  try {
    await prisma.$transaction([
      prisma.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: 'DECLINED' },
      }),
      prisma.notification.updateMany({
        where: {
          recipientId: userId,
          type: 'ORGANIZATION_INVITATION',
          relatedInvitationId: invitation.id,
        },
        data: { isRead: true },
      }),
    ]);

    if (invitation.invitedBy?.email) {
      sendInvitationDecisionEmail({
        toEmail: invitation.invitedBy.email,
        userName: user.name || user.email,
        targetName: invitation.organization.name,
        type: 'ORGANIZATION',
        decision: 'DECLINED',
      }).catch((e) => console.warn('Background decision email error:', e));
    }

    return res.json({ success: true, message: 'Invitation declined' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/organizations/:slugOrId/join-request — Request to join an organization
organizationsRouter.post('/:slugOrId/join-request', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const slugOrId = getParam(req.params.slugOrId);
  const org = await resolveOrganization(slugOrId);
  if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

  // Check if caller is already a member
  const existingMembership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId } },
  });
  if (existingMembership) {
    return res.status(400).json({ success: false, error: 'You are already a member of this organization' });
  }

  // Requester details
  const requester = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!requester) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  const message = (req.body?.message as string | undefined)?.trim() || undefined;

  // Find all Org Owners and Admins to notify
  const adminMembers = await prisma.organizationMember.findMany({
    where: {
      organizationId: org.id,
      role: { in: ['OWNER', 'ADMIN'] },
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (adminMembers.length === 0) {
    return res.status(400).json({ success: false, error: 'No administrators found for this organization' });
  }

  // For each admin, create in-app notification and dispatch email
  await Promise.all(
    adminMembers.map(async (admin) => {
      const existingNotification = await prisma.notification.findFirst({
        where: {
          recipientId: admin.userId,
          type: 'ORGANIZATION_JOIN_REQUEST',
          relatedOrganizationId: org.id,
          isRead: false,
        },
      });

      if (!existingNotification) {
        await createNotification({
          recipientId: admin.userId,
          type: 'ORGANIZATION_JOIN_REQUEST',
          title: `Join request for ${org.name}`,
          message: `${requester.name || requester.email} has requested to join ${org.name}.`,
          data: {
            requesterId: requester.id,
            requesterName: requester.name || requester.email,
            requesterEmail: requester.email,
            orgId: org.id,
            orgName: org.name,
            orgSlug: org.slug,
            message,
          },
          relatedOrganizationId: org.id,
        });
      }

      if (admin.user?.email) {
        const origin = req.get('origin') || process.env.CORS_ORIGIN || 'http://localhost:5173';
        const inboxLink = `${origin}/inbox`;
        sendOrgJoinRequestEmail({
          toEmail: admin.user.email,
          adminName: admin.user.name || admin.user.email,
          requesterName: requester.name || requester.email,
          requesterEmail: requester.email,
          organizationName: org.name,
          inboxLink,
          message,
        }).catch((err) => console.warn('Background sendOrgJoinRequestEmail error:', err));
      }
    })
  );

  await recordOrgActivity({
    organizationId: org.id,
    actorId: userId,
    action: 'REQUESTED_TO_JOIN',
    resourceType: 'ORGANIZATION',
    resourceId: org.id,
    details: { requesterEmail: requester.email, message },
  });

  return res.status(200).json({
    success: true,
    message: `Your request to join ${org.name} has been sent to the workspace administrators.`,
  });
});

// ─── Scoped Teams, Projects & Activity Endpoints ────────────────────────────

// GET /api/organizations/:slugOrId/teams — List organization teams
organizationsRouter.get('/:slugOrId/teams', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const slugOrId = getParam(req.params.slugOrId);
  const org = await resolveOrganization(slugOrId);
  if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

  const callerMembership = await getCallerOrgMembership(org.id, userId);
  if (!callerMembership) return res.status(403).json({ success: false, error: 'Access denied' });

  try {
    const teams = await prisma.team.findMany({
      where: { organizationId: org.id },
      include: {
        _count: { select: { members: true, invitations: { where: { status: 'PENDING' } } } },
        createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true, avatarColor: true, avatarId: true, avatarType: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: teams });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to list organization teams' });
  }
});

// GET /api/organizations/:slugOrId/projects — List organization projects
organizationsRouter.get('/:slugOrId/projects', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const slugOrId = getParam(req.params.slugOrId);
  const org = await resolveOrganization(slugOrId);
  if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

  const callerMembership = await getCallerOrgMembership(org.id, userId);
  if (!callerMembership) return res.status(403).json({ success: false, error: 'Access denied' });

  try {
    const projects = await prisma.project.findMany({
      where: { organizationId: org.id },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        tasks: {
          include: { assignee: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        },
        _count: { select: { tasks: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.json({ success: true, data: projects });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to list organization projects' });
  }
});

// GET /api/organizations/:slugOrId/activity — List organization activity with filters
organizationsRouter.get('/:slugOrId/activity', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const slugOrId = getParam(req.params.slugOrId);
  const org = await resolveOrganization(slugOrId);
  if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

  const callerMembership = await getCallerOrgMembership(org.id, userId);
  if (!callerMembership) return res.status(403).json({ success: false, error: 'Access denied' });

  const filter = getParam(req.query.filter as any) || 'all';

  const whereClause: any = { organizationId: org.id };
  if (filter === 'members') {
    whereClause.resourceType = { in: ['MEMBER', 'INVITATION'] };
  } else if (filter === 'teams') {
    whereClause.resourceType = 'TEAM';
  } else if (filter === 'projects') {
    whereClause.resourceType = 'PROJECT';
  } else if (filter === 'settings') {
    whereClause.resourceType = 'ORGANIZATION';
  }

  try {
    const activities = await prisma.organizationActivity.findMany({
      where: whereClause,
      include: {
        actor: { select: { id: true, name: true, email: true, avatarUrl: true, avatarColor: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return res.json({ success: true, data: activities });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to list activity' });
  }
});

// GET /api/organizations/:slugOrId/overview — Aggregated organization dashboard overview
organizationsRouter.get('/:slugOrId/overview', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const slugOrId = getParam(req.params.slugOrId);
  const org = await resolveOrganization(slugOrId);
  if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

  const callerMembership = await getCallerOrgMembership(org.id, userId);
  if (!callerMembership) return res.status(403).json({ success: false, error: 'Access denied' });

  try {
    const [totalMembers, totalTeams, totalProjects, openIssues, rawTeams, rawProjects, recentActivity] = await Promise.all([
      prisma.organizationMember.count({ where: { organizationId: org.id } }),
      prisma.team.count({ where: { organizationId: org.id } }),
      prisma.project.count({ where: { organizationId: org.id } }),
      prisma.task.count({
        where: {
          project: { organizationId: org.id },
          status: { not: 'DONE' },
        },
      }),
      prisma.team.findMany({
        where: { organizationId: org.id },
        include: {
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      prisma.project.findMany({
        where: { organizationId: org.id },
        include: {
          owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 6,
      }),
      prisma.organizationActivity.findMany({
        where: { organizationId: org.id },
        include: {
          actor: { select: { id: true, name: true, email: true, avatarUrl: true, avatarColor: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

    const formattedTeams = rawTeams.map((t) => ({
      id: t.id,
      name: t.name,
      identifier: t.name.slice(0, 3).toUpperCase(),
      color: t.color,
      icon: null,
      memberCount: t._count?.members || 0,
      projectCount: 0,
    }));

    const formattedProjects = rawProjects.map((p) => ({
      id: p.id,
      name: p.title,
      description: p.description,
      status: p.status,
      teamName: null,
      owner: p.owner,
      updatedAt: p.updatedAt.toISOString(),
    }));

    const stats = {
      totalMembers,
      totalTeams,
      totalProjects,
      openIssues,
    };

    return res.json({
      success: true,
      data: {
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          description: org.description,
          logoUrl: org.logoUrl,
          createdAt: org.createdAt.toISOString(),
          currentUserRole: callerMembership.role,
        },
        currentRole: callerMembership.role,
        stats,
        summary: stats,
        teams: formattedTeams,
        projects: formattedProjects,
        recentActivity,
        recentActivities: recentActivity,
      },
    });
  } catch (err: any) {
    console.error('Organization overview error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to load organization overview' });
  }
});

