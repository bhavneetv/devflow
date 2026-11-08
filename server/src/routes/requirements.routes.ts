import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getUserIdFromToken } from '../lib/auth.js';
import { can } from '../services/requirementPermissions.service.js';

export const requirementsRouter = Router();

// Priority weight for sorting: CRITICAL > HIGH > MEDIUM > LOW
const PRIORITY_ORDER: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

// GET /api/requirements - List requirements with search, filters, and 8 stat cards
requirementsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const {
      projectId,
      organizationId,
      organizationSlug,
      search,
      type,
      categoryId,
      priority,
      workflowStatus,
      implementationStatus,
      authorId,
      ownerId,
      subFilter,
    } = req.query;

    const where: any = {};

    // 1. Project / Org scoping
    if (projectId) {
      where.projectId = parseInt(projectId as string, 10);
    } else if (organizationId) {
      where.project = { organizationId: parseInt(organizationId as string, 10) };
    } else if (organizationSlug) {
      where.project = {
        organization: { slug: (organizationSlug as string).toLowerCase() },
      };
    }

    // Base scope for stats (scoping without filters applied, so stats reflect overall project/org metrics)
    const baseScopeWhere = { ...where };

    // 2. Sub-filters (Project level tabs)
    if (subFilter === 'functional') {
      where.type = 'FUNCTIONAL';
    } else if (subFilter === 'non_functional') {
      where.type = {
        in: [
          'NON_FUNCTIONAL',
          'SECURITY',
          'PERFORMANCE',
          'USABILITY',
          'COMPLIANCE',
          'INTERFACE',
          'TECHNICAL',
        ],
      };
    } else if (subFilter === 'pending_approval') {
      where.workflowStatus = 'PENDING_REVIEW';
    } else if (subFilter === 'approved') {
      where.workflowStatus = 'APPROVED';
    } else if (subFilter === 'traceability') {
      // Traceability subfilter: include requirements with or without linked tasks
    }

    // 3. User & explicit filters
    if (type && subFilter !== 'functional' && subFilter !== 'non_functional') {
      where.type = type;
    }
    if (categoryId) {
      where.categoryId = parseInt(categoryId as string, 10);
    }
    if (priority) {
      where.priority = priority;
    }
    if (workflowStatus && subFilter !== 'pending_approval' && subFilter !== 'approved') {
      where.workflowStatus = workflowStatus;
    }
    if (implementationStatus) {
      where.implementationStatus = implementationStatus;
    }
    const resolvedOwnerId = ownerId || authorId;
    if (resolvedOwnerId) {
      where.authorId = parseInt(resolvedOwnerId as string, 10);
    }

    // 4. Search query (matches code, title, or summary)
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      where.OR = [
        { code: { contains: q } },
        { title: { contains: q } },
        { summary: { contains: q } },
      ];
    }

    // Fetch requirements with relations
    const requirements = await prisma.requirement.findMany({
      where,
      include: {
        project: {
          select: { id: true, title: true, status: true },
        },
        category: {
          select: { id: true, name: true, color: true, icon: true },
        },
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        submittedBy: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        reviewer: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        responsibleMember: {
          select: { id: true, name: true, email: true },
        },
        responsibleTeam: {
          select: { id: true, name: true, color: true },
        },
        links: {
          where: { targetType: 'TASK' },
          select: { id: true, targetId: true, isPrimary: true },
        },
        _count: {
          select: {
            acceptanceCriteria: true,
            versions: true,
            comments: true,
            links: true,
          },
        },
      },
      orderBy: [{ targetDate: 'asc' }, { createdAt: 'desc' }],
    });

    // Sort by Priority desc (CRITICAL > HIGH > MEDIUM > LOW), then targetDate asc
    requirements.sort((a, b) => {
      const weightA = PRIORITY_ORDER[a.priority] || 0;
      const weightB = PRIORITY_ORDER[b.priority] || 0;
      if (weightB !== weightA) {
        return weightB - weightA;
      }
      if (a.targetDate && b.targetDate) {
        return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
      }
      if (a.targetDate && !b.targetDate) return -1;
      if (!a.targetDate && b.targetDate) return 1;
      return 0;
    });

    // 5. Compute the 8 real stat cards using baseScopeWhere
    const allScopedRequirements = await prisma.requirement.findMany({
      where: baseScopeWhere,
      select: {
        id: true,
        workflowStatus: true,
        implementationStatus: true,
        targetDate: true,
        title: true,
        code: true,
        links: {
          where: { targetType: 'TASK' },
          select: { id: true },
        },
      },
    });

    const stats = {
      total: allScopedRequirements.length,
      approved: allScopedRequirements.filter((r) => r.workflowStatus === 'APPROVED').length,
      pendingReview: allScopedRequirements.filter((r) => r.workflowStatus === 'PENDING_REVIEW').length,
      rejected: allScopedRequirements.filter((r) => r.workflowStatus === 'REJECTED').length,
      draft: allScopedRequirements.filter((r) => r.workflowStatus === 'DRAFT').length,
      inProgress: allScopedRequirements.filter((r) => r.implementationStatus === 'IN_PROGRESS').length,
      completed: allScopedRequirements.filter(
        (r) => r.implementationStatus === 'IMPLEMENTED' || r.implementationStatus === 'VERIFIED'
      ).length,
      blocked: allScopedRequirements.filter((r) => r.implementationStatus === 'BLOCKED').length,
    };

    // 6. Compute widgets data
    const now = new Date();
    const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const noLinkedTasks = allScopedRequirements
      .filter((r) => r.workflowStatus === 'APPROVED' && r.links.length === 0)
      .slice(0, 5)
      .map((r) => ({ id: r.id, code: r.code, title: r.title }));

    const approachingTargetDates = allScopedRequirements
      .filter((r) => r.targetDate && new Date(r.targetDate) >= now && new Date(r.targetDate) <= twoWeeksLater)
      .slice(0, 5)
      .map((r) => ({
        id: r.id,
        code: r.code,
        title: r.title,
        targetDate: r.targetDate,
      }));

    // 7. Get categories & projects for filter dropdowns
    const categories = await prisma.requirementCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true, color: true, icon: true },
    });

    const projects = await prisma.project.findMany({
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
    });

    res.json({
      success: true,
      data: {
        items: requirements,
        stats,
        widgets: {
          noLinkedTasks,
          approachingTargetDates,
        },
        categories,
        projects,
      },
    });
  } catch (error: any) {
    console.error('Error fetching requirements:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/requirements/export - Export requirements as CSV (authorized only)
requirementsRouter.get('/export', async (req: Request, res: Response) => {
  try {
    let tokenUserId = getUserIdFromToken(req);
    if (!tokenUserId && req.query.token) {
      const token = String(req.query.token);
      const parts = token.split('_');
      for (const part of parts) {
        if (/^\d+$/.test(part)) {
          const id = parseInt(part, 10);
          if (!isNaN(id)) {
            tokenUserId = id;
            break;
          }
        }
      }
    }

    if (!tokenUserId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required to export requirements.',
      });
    }

    const { projectId, organizationId } = req.query;

    // Verify user membership in project or organization (Viewer access blocked)
    if (projectId) {
      const pId = parseInt(projectId as string, 10);
      const project = await prisma.project.findUnique({
        where: { id: pId },
        select: { id: true, organizationId: true, ownerId: true },
      });
      if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
      }

      const isProjectOwner = project.ownerId === tokenUserId;
      let hasAccess = isProjectOwner;

      if (!hasAccess && project.organizationId) {
        const orgMember = await prisma.organizationMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId: project.organizationId,
              userId: tokenUserId,
            },
          },
        });
        if (orgMember && orgMember.role !== 'VIEWER') {
          hasAccess = true;
        }
      }

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access Denied: You do not have permission to export requirements for this project.',
        });
      }
    } else if (organizationId) {
      const oId = parseInt(organizationId as string, 10);
      const orgMember = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: oId,
            userId: tokenUserId,
          },
        },
      });
      if (!orgMember || orgMember.role === 'VIEWER') {
        return res.status(403).json({
          success: false,
          error: 'Access Denied: You must be an authorized member of this organization to export requirements.',
        });
      }
    } else {
      const memberships = await prisma.organizationMember.findMany({
        where: { userId: tokenUserId },
      });
      const nonViewer = memberships.filter((m) => m.role !== 'VIEWER');
      if (nonViewer.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'Access Denied: Viewers cannot export requirement specifications.',
        });
      }
    }

    const where: any = {};
    if (projectId) where.projectId = parseInt(projectId as string, 10);
    if (organizationId) where.project = { organizationId: parseInt(organizationId as string, 10) };

    const requirements = await prisma.requirement.findMany({
      where,
      include: {
        project: { select: { title: true } },
        category: { select: { name: true } },
        author: { select: { name: true, email: true } },
      },
      orderBy: { code: 'asc' },
    });

    // Build CSV string
    const headers = [
      'ID',
      'Title',
      'Project',
      'Category',
      'Type',
      'Priority',
      'Workflow Status',
      'Implementation Status',
      'Author',
      'Target Date',
      'Current Version',
      'Created At',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = requirements.map((r) => [
      escapeCsv(r.code),
      escapeCsv(r.title),
      escapeCsv(r.project?.title || ''),
      escapeCsv(r.category?.name || 'Uncategorized'),
      escapeCsv(r.type),
      escapeCsv(r.priority),
      escapeCsv(r.workflowStatus),
      escapeCsv(r.implementationStatus),
      escapeCsv(r.author?.name || r.author?.email || ''),
      escapeCsv(r.targetDate ? new Date(r.targetDate).toISOString().split('T')[0] : ''),
      escapeCsv(`v${r.currentVersion}`),
      escapeCsv(new Date(r.createdAt).toISOString().split('T')[0]),
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="devflow-requirements-export.csv"');
    res.status(200).send(csvContent);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/requirements/categories - List all categories
requirementsRouter.get('/categories', async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.requirementCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: categories });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/requirements/next-code - Auto-generate next REQ-00X code for project (Rule 6)
requirementsRouter.get('/next-code', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.query.projectId as string, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Valid projectId is required' });
    }

    const existingReqs = await prisma.requirement.findMany({
      where: { projectId },
      select: { code: true },
    });

    let maxNumber = 0;
    for (const r of existingReqs) {
      const match = r.code.match(/REQ-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    }

    const nextNumber = maxNumber + 1;
    const nextCode = `REQ-${String(nextNumber).padStart(3, '0')}`;

    res.json({ success: true, data: { nextCode, nextNumber } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/requirements/metadata - Project members, teams, and categories for creation wizard
requirementsRouter.get('/metadata', async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId ? parseInt(req.query.projectId as string, 10) : undefined;
    let project = null;
    let organizationId: number | undefined;

    if (projectId) {
      project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, title: true, organizationId: true, ownerId: true },
      });
      if (project?.organizationId) organizationId = project.organizationId;
    }

    const categories = await prisma.requirementCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true, color: true, icon: true, defaultType: true },
      orderBy: { name: 'asc' },
    });

    let members: any[] = [];
    if (organizationId) {
      const orgMembers = await prisma.organizationMember.findMany({
        where: { organizationId },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } },
        },
      });
      members = orgMembers.map((om) => ({
        id: om.user.id,
        name: om.user.name,
        email: om.user.email,
        avatarUrl: om.user.avatarUrl,
        orgRole: om.role,
      }));
    } else {
      members = await prisma.user.findMany({
        select: { id: true, name: true, email: true, avatarUrl: true, role: true },
        take: 50,
      });
    }

    let teams: Array<{ id: number; name: string; color: string }> = [];
    if (projectId && organizationId) {
      // Find project assignees and explicit team assignments
      const taskAssignees = await prisma.task.findMany({
        where: { projectId, assigneeId: { not: null } },
        select: { assigneeId: true },
      });
      const reqMembers = await prisma.requirement.findMany({
        where: { projectId },
        select: { authorId: true, reviewerId: true, assigneeId: true, responsibleTeamId: true },
      });

      const projectUserIds = new Set<number>();
      if (project?.ownerId) projectUserIds.add(project.ownerId);
      taskAssignees.forEach((t) => {
        if (t.assigneeId) projectUserIds.add(t.assigneeId);
      });
      reqMembers.forEach((r) => {
        if (r.authorId) projectUserIds.add(r.authorId);
        if (r.reviewerId) projectUserIds.add(r.reviewerId);
        if (r.assigneeId) projectUserIds.add(r.assigneeId);
      });

      const explicitTeamIds = reqMembers
        .map((r) => r.responsibleTeamId)
        .filter((id): id is number => id !== null && id !== undefined);

      // Return only teams assigned to the selected project (joined through project-team assignment)
      teams = await prisma.team.findMany({
        where: {
          organizationId,
          OR: [
            { id: { in: explicitTeamIds } },
            { members: { some: { userId: { in: Array.from(projectUserIds) } } } },
          ],
        },
        select: { id: true, name: true, color: true },
      });
    } else if (organizationId) {
      teams = await prisma.team.findMany({
        where: { organizationId },
        select: { id: true, name: true, color: true },
      });
    }

    res.json({
      success: true,
      data: {
        project,
        categories,
        members,
        teams,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/requirements - Create requirement (Draft or Submit for Review)
const createRequirementSchema = z.object({
  projectId: z.number().int().positive('Valid projectId is required'),
  code: z.string().optional(),
  title: z.string().min(2, 'Title must be at least 2 characters'),
  summary: z.string().optional().nullable(),
  type: z
    .enum([
      'FUNCTIONAL',
      'NON_FUNCTIONAL',
      'BUSINESS',
      'TECHNICAL',
      'SECURITY',
      'PERFORMANCE',
      'USABILITY',
      'COMPLIANCE',
      'INTERFACE',
    ])
    .default('FUNCTIONAL'),
  categoryId: z.number().int().positive().optional().nullable(),
  description: z.string().optional().nullable(),
  expectedBehavior: z.string().optional().nullable(),
  preconditions: z.string().optional().nullable(),
  constraints: z.string().optional().nullable(),
  dependencies: z.string().optional().nullable(),
  businessJustification: z.string().optional().nullable(),
  referenceLinks: z.string().optional().nullable(),
  attachments: z.string().optional().nullable(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  responsibleTeamId: z.number().int().positive().optional().nullable(),
  responsibleMemberId: z.number().int().positive().optional().nullable(),
  reviewerId: z.number().int().positive().optional().nullable(),
  assigneeId: z.number().int().positive().optional().nullable(),
  collaborators: z.array(z.number()).optional(),
  targetDate: z.string().optional().nullable(),
  businessImpact: z.string().optional().nullable(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().nullable(),
  complexity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']).optional().nullable(),
  acceptanceCriteria: z
    .array(
      z.object({
        code: z.string().optional(),
        description: z.string().min(1, 'Criterion description is required'),
        verificationMethod: z.string().optional().nullable(),
      })
    )
    .optional()
    .default([]),
  action: z.enum(['SAVE_DRAFT', 'SUBMIT_FOR_REVIEW']).default('SAVE_DRAFT'),
  authorId: z.number().int().positive().optional(),
});

requirementsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = createRequirementSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const payload = parsed.data;

    // Resolve author
    const tokenUserId = getUserIdFromToken(req);
    const authorId = payload.authorId || tokenUserId || 1; // Fallback to user 1 if running locally without token

    // Check project exists
    const project = await prisma.project.findUnique({
      where: { id: payload.projectId },
      select: { id: true, title: true, organizationId: true },
    });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Rule 4: Author CANNOT approve own requirement & author cannot be designated reviewer
    if (payload.reviewerId && payload.reviewerId === authorId) {
      return res.status(400).json({
        success: false,
        error: 'Governance Rule 4: The author cannot be assigned as the reviewer of their own requirement.',
      });
    }

    // Zero-criteria guard on SUBMIT_FOR_REVIEW
    if (payload.action === 'SUBMIT_FOR_REVIEW' && payload.acceptanceCriteria.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot submit a requirement for review with zero acceptance criteria. Add at least one criterion.',
      });
    }

    // Auto-generate code if missing (Rule 6)
    let code = payload.code;
    if (!code) {
      const existingReqs = await prisma.requirement.findMany({
        where: { projectId: payload.projectId },
        select: { code: true },
      });
      let maxNumber = 0;
      for (const r of existingReqs) {
        const match = r.code.match(/REQ-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNumber) maxNumber = num;
        }
      }
      code = `REQ-${String(maxNumber + 1).padStart(3, '0')}`;
    }

    // Rule 3: Requirement NEVER auto-approves on creation
    const workflowStatus =
      payload.action === 'SUBMIT_FOR_REVIEW' ? 'PENDING_REVIEW' : 'DRAFT';
    const now = new Date();

    // Create requirement inside transaction
    const newRequirement = await prisma.$transaction(async (tx) => {
      const created = await tx.requirement.create({
        data: {
          code: code!,
          projectId: payload.projectId,
          title: payload.title,
          summary: payload.summary || null,
          type: payload.type,
          categoryId: payload.categoryId || null,
          description: payload.description || null,
          expectedBehavior: payload.expectedBehavior || null,
          preconditions: payload.preconditions || null,
          constraints: payload.constraints || null,
          dependencies: payload.dependencies || null,
          businessJustification: payload.businessJustification || null,
          referenceLinks: payload.referenceLinks || null,
          attachments: payload.attachments || null,
          priority: payload.priority,
          workflowStatus,
          implementationStatus: 'NOT_STARTED',
          authorId,
          responsibleTeamId: payload.responsibleTeamId || null,
          responsibleMemberId: payload.responsibleMemberId || null,
          reviewerId: payload.reviewerId || null,
          assigneeId: payload.assigneeId || null,
          collaborators: payload.collaborators ? JSON.stringify(payload.collaborators) : null,
          targetDate: payload.targetDate ? new Date(payload.targetDate) : null,
          businessImpact: payload.businessImpact || null,
          riskLevel: payload.riskLevel || null,
          complexity: payload.complexity || null,
          currentVersion: 1,
          submittedAt: payload.action === 'SUBMIT_FOR_REVIEW' ? now : null,
          submittedById: payload.action === 'SUBMIT_FOR_REVIEW' ? authorId : null,
        },
      });

      // Create acceptance criteria
      if (payload.acceptanceCriteria.length > 0) {
        const criteriaData = payload.acceptanceCriteria.map((ac, idx) => ({
          requirementId: created.id,
          code: ac.code || `AC-${String(idx + 1).padStart(3, '0')}`,
          description: ac.description,
          verificationMethod: ac.verificationMethod || null,
          isComplete: false,
          sortOrder: idx + 1,
        }));
        await tx.acceptanceCriterion.createMany({ data: criteriaData });
      }

      // Create initial version snapshot
      await tx.requirementVersion.create({
        data: {
          requirementId: created.id,
          versionNumber: 1,
          changedById: authorId,
          changeReason: 'Initial creation',
          snapshot: JSON.stringify({
            code: created.code,
            title: created.title,
            summary: created.summary,
            type: created.type,
            priority: created.priority,
            workflowStatus: created.workflowStatus,
            description: created.description,
            acceptanceCriteria: payload.acceptanceCriteria,
          }),
        },
      });

      return created;
    });

    // Rule 7: Every state change writes an ActivityEvent
    if (project.organizationId) {
      try {
        await prisma.organizationActivity.create({
          data: {
            organizationId: project.organizationId,
            actorId: authorId,
            action:
              payload.action === 'SUBMIT_FOR_REVIEW'
                ? 'requirement.submitted'
                : 'requirement.draft_created',
            resourceType: 'requirement',
            resourceId: newRequirement.id,
            details: JSON.stringify({
              code: newRequirement.code,
              title: newRequirement.title,
              workflowStatus: newRequirement.workflowStatus,
              projectId: newRequirement.projectId,
              projectTitle: project.title,
            }),
          },
        });
      } catch (actErr) {
        console.error('Failed to log activity event:', actErr);
      }
    }

    // Return created requirement with details
    const fullCreated = await prisma.requirement.findUnique({
      where: { id: newRequirement.id },
      include: {
        category: true,
        author: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true, email: true } },
        acceptanceCriteria: true,
      },
    });

    res.status(201).json({
      success: true,
      data: fullCreated,
      message:
        payload.action === 'SUBMIT_FOR_REVIEW'
          ? `${fullCreated?.code} submitted for review successfully.`
          : `${fullCreated?.code} saved as draft.`,
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: `A requirement with code "${req.body.code}" already exists in this project.`,
      });
    }
    console.error('Error creating requirement:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/requirements/:id - Get single requirement by ID
requirementsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid requirement ID' });
    }

    const requirement = await prisma.requirement.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, title: true, status: true, organizationId: true },
        },
        category: true,
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        submittedBy: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        reviewer: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        responsibleMember: {
          select: { id: true, name: true, email: true },
        },
        responsibleTeam: {
          select: { id: true, name: true, color: true },
        },
        acceptanceCriteria: {
          orderBy: { sortOrder: 'asc' },
        },
        versions: {
          include: {
            changedBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { versionNumber: 'desc' },
        },
        reviews: {
          include: {
            reviewer: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        dependenciesFrom: {
          include: {
            toRequirement: {
              select: { id: true, code: true, title: true, workflowStatus: true },
            },
          },
        },
        dependenciesTo: {
          include: {
            fromRequirement: {
              select: { id: true, code: true, title: true, workflowStatus: true },
            },
          },
        },
        links: {
          include: {
            task: {
              select: { id: true, title: true, status: true, priority: true },
            },
          },
        },
        comments: {
          include: {
            author: {
              select: { id: true, name: true, avatarUrl: true },
            },
            replies: {
              include: {
                author: { select: { id: true, name: true, avatarUrl: true } },
              },
            },
          },
          where: { parentId: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!requirement) {
      return res.status(404).json({ success: false, error: 'Requirement not found' });
    }

    res.json({ success: true, data: requirement });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/requirements/:id - Edit requirement (Rule 5: Approved requirement edits create new version)
requirementsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid requirement ID' });
    }

    const existing = await prisma.requirement.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, organizationId: true, title: true } },
        acceptanceCriteria: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Requirement not found' });
    }

    const tokenUserId = getUserIdFromToken(req);
    const userId = tokenUserId || req.body.userId || existing.authorId;

    const {
      currentVersion,
      forceOverwrite,
      title,
      summary,
      description,
      type,
      categoryId,
      priority,
      implementationStatus,
      expectedBehavior,
      preconditions,
      constraints,
      dependencies,
      businessJustification,
      referenceLinks,
      targetDate,
      riskLevel,
      complexity,
      responsibleTeamId,
      responsibleMemberId,
      reviewerId,
      changeReason,
      requireReReview,
    } = req.body;

    // Item 12: Conflicting-edit / Stale-version check (HTTP 409)
    if (!forceOverwrite && typeof currentVersion === 'number' && currentVersion !== existing.currentVersion) {
      return res.status(409).json({
        success: false,
        code: 'VERSION_CONFLICT',
        error: `Conflicting edit: Requirement ${existing.code} has been modified to revision v${existing.currentVersion} by another user. Your editor is on v${currentVersion}.`,
        serverVersion: existing.currentVersion,
        clientVersion: currentVersion,
      });
    }

    const isCurrentlyApproved = existing.workflowStatus === 'APPROVED';

    // Prepare update data
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (summary !== undefined) updateData.summary = summary;
    if (description !== undefined) updateData.description = description;
    if (type !== undefined) updateData.type = type;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (priority !== undefined) updateData.priority = priority;
    if (implementationStatus !== undefined) updateData.implementationStatus = implementationStatus;
    if (expectedBehavior !== undefined) updateData.expectedBehavior = expectedBehavior;
    if (preconditions !== undefined) updateData.preconditions = preconditions;
    if (constraints !== undefined) updateData.constraints = constraints;
    if (dependencies !== undefined) updateData.dependencies = dependencies;
    if (businessJustification !== undefined) updateData.businessJustification = businessJustification;
    if (referenceLinks !== undefined) updateData.referenceLinks = referenceLinks;
    if (targetDate !== undefined) updateData.targetDate = targetDate ? new Date(targetDate) : null;
    if (riskLevel !== undefined) updateData.riskLevel = riskLevel;
    if (complexity !== undefined) updateData.complexity = complexity;
    if (responsibleTeamId !== undefined) updateData.responsibleTeamId = responsibleTeamId;
    if (responsibleMemberId !== undefined) updateData.responsibleMemberId = responsibleMemberId;
    if (reviewerId !== undefined) updateData.reviewerId = reviewerId;

    let newVersionRecord: any = null;

    // Rule 5: Editing an approved requirement ALWAYS creates a NEW REVISION — never silently overwrite
    if (isCurrentlyApproved) {
      const nextVersionNumber = existing.currentVersion + 1;
      updateData.currentVersion = nextVersionNumber;

      if (requireReReview) {
        updateData.workflowStatus = 'PENDING_REVIEW';
        updateData.submittedAt = new Date();
        updateData.submittedById = userId;
      }

      const updated = await prisma.$transaction(async (tx) => {
        const reqUpdated = await tx.requirement.update({
          where: { id },
          data: updateData,
        });

        newVersionRecord = await tx.requirementVersion.create({
          data: {
            requirementId: id,
            versionNumber: nextVersionNumber,
            changedById: userId,
            changeReason: changeReason || 'Revised approved specification',
            snapshot: JSON.stringify({
              code: reqUpdated.code,
              title: reqUpdated.title,
              summary: reqUpdated.summary,
              type: reqUpdated.type,
              priority: reqUpdated.priority,
              workflowStatus: reqUpdated.workflowStatus,
              description: reqUpdated.description,
              expectedBehavior: reqUpdated.expectedBehavior,
              preconditions: reqUpdated.preconditions,
              constraints: reqUpdated.constraints,
              dependencies: reqUpdated.dependencies,
              businessJustification: reqUpdated.businessJustification,
              acceptanceCriteria: existing.acceptanceCriteria,
            }),
          },
        });

        return reqUpdated;
      });

      // Rule 7: Activity event
      if (existing.project.organizationId) {
        try {
          await prisma.organizationActivity.create({
            data: {
              organizationId: existing.project.organizationId,
              actorId: userId,
              action: 'requirement.version_created',
              resourceType: 'requirement',
              resourceId: existing.id,
              details: JSON.stringify({
                code: existing.code,
                title: updated.title,
                version: nextVersionNumber,
                changeReason: changeReason || 'Revised approved specification',
              }),
            },
          });
        } catch (e) {
          console.error(e);
        }
      }

      const refreshed = await prisma.requirement.findUnique({
        where: { id },
        include: {
          versions: {
            include: { changedBy: { select: { id: true, name: true, email: true } } },
            orderBy: { versionNumber: 'desc' },
          },
          acceptanceCriteria: true,
        },
      });

      return res.json({
        success: true,
        data: refreshed,
        newVersion: newVersionRecord,
        message: `New revision v${nextVersionNumber} created for ${existing.code}.`,
      });
    }

    // Normal edit (in Draft or Changes Requested)
    const updated = await prisma.requirement.update({
      where: { id },
      data: updateData,
      include: {
        versions: {
          include: { changedBy: { select: { id: true, name: true, email: true } } },
          orderBy: { versionNumber: 'desc' },
        },
        acceptanceCriteria: true,
      },
    });

    if (existing.project.organizationId) {
      try {
        await prisma.organizationActivity.create({
          data: {
            organizationId: existing.project.organizationId,
            actorId: userId,
            action: 'requirement.updated',
            resourceType: 'requirement',
            resourceId: existing.id,
            details: JSON.stringify({ code: existing.code, title: updated.title }),
          },
        });
      } catch (e) {
        console.error(e);
      }
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error updating requirement:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/requirements/:id/criteria - Add an acceptance criterion to a requirement
requirementsRouter.post('/:id/criteria', async (req: Request, res: Response) => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const requirementId = parseInt(rawId as string, 10);
    if (isNaN(requirementId)) {
      return res.status(400).json({ success: false, error: 'Invalid requirement ID' });
    }

    const { description, verificationMethod, code } = req.body;
    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, error: 'Criterion description is required' });
    }

    const count = await prisma.acceptanceCriterion.count({ where: { requirementId } });
    const criterionCode = code || `AC-${String(count + 1).padStart(3, '0')}`;

    const created = await prisma.acceptanceCriterion.create({
      data: {
        requirementId,
        code: criterionCode,
        description: description.trim(),
        verificationMethod: verificationMethod || null,
        isComplete: false,
        sortOrder: count + 1,
      },
    });

    res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/requirements/:id/criteria/:criterionId - Delete an acceptance criterion
requirementsRouter.delete('/:id/criteria/:criterionId', async (req: Request, res: Response) => {
  try {
    const criterionId = parseInt(req.params.criterionId as string, 10);
    if (isNaN(criterionId)) {
      return res.status(400).json({ success: false, error: 'Invalid criterion ID' });
    }

    await prisma.acceptanceCriterion.delete({ where: { id: criterionId } });
    res.json({ success: true, message: 'Criterion deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/requirements/:id/criteria/:criterionId/toggle - Toggle acceptance criterion completion
requirementsRouter.patch('/:id/criteria/:criterionId/toggle', async (req: Request, res: Response) => {
  try {
    const criterionId = parseInt(req.params.criterionId as string, 10);
    if (isNaN(criterionId)) {
      return res.status(400).json({ success: false, error: 'Invalid criterion ID' });
    }

    const current = await prisma.acceptanceCriterion.findUnique({
      where: { id: criterionId },
      include: {
        requirement: {
          select: {
            id: true,
            code: true,
            title: true,
            project: { select: { organizationId: true } },
          },
        },
      },
    });

    if (!current) {
      return res.status(404).json({ success: false, error: 'Criterion not found' });
    }

    const nextState = !current.isComplete;
    const updated = await prisma.acceptanceCriterion.update({
      where: { id: criterionId },
      data: { isComplete: nextState },
    });

    const tokenUserId = getUserIdFromToken(req);
    const actorId = tokenUserId || 1;

    if (current.requirement?.project?.organizationId) {
      try {
        await prisma.organizationActivity.create({
          data: {
            organizationId: current.requirement.project.organizationId,
            actorId,
            action: nextState ? 'requirement.criterion_completed' : 'requirement.criterion_reopened',
            resourceType: 'requirement',
            resourceId: current.requirement.id,
            details: JSON.stringify({
              code: current.requirement.code,
              title: current.requirement.title,
              criterionCode: current.code,
              description: current.description,
              isComplete: nextState,
            }),
          },
        });
      } catch (actErr) {
        console.error('Failed to log criterion toggle activity:', actErr);
      }
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/requirements/:id/submit - Submit requirement for review
requirementsRouter.post('/:id/submit', async (req: Request, res: Response) => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid requirement ID' });
    }

    const requirement = await prisma.requirement.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, title: true, organizationId: true } },
        acceptanceCriteria: true,
      },
    });

    if (!requirement) {
      return res.status(404).json({ success: false, error: 'Requirement not found' });
    }

    // Only DRAFT or CHANGES_REQUESTED can be submitted for review
    if (
      requirement.workflowStatus !== 'DRAFT' &&
      requirement.workflowStatus !== 'CHANGES_REQUESTED'
    ) {
      return res.status(400).json({
        success: false,
        error: `Cannot submit requirement with status "${requirement.workflowStatus}". Only Draft or Changes Requested requirements can be submitted.`,
      });
    }

    // Zero-criteria guard
    if (requirement.acceptanceCriteria.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot submit for review: at least one acceptance criterion is required.',
      });
    }

    const tokenUserId = getUserIdFromToken(req);
    const userId = tokenUserId || req.body.userId || requirement.authorId;

    const updated = await prisma.requirement.update({
      where: { id },
      data: {
        workflowStatus: 'PENDING_REVIEW',
        submittedAt: new Date(),
        submittedById: userId,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true, email: true } },
        acceptanceCriteria: true,
      },
    });

    // Rule 7: Activity Event
    if (requirement.project?.organizationId) {
      try {
        await prisma.organizationActivity.create({
          data: {
            organizationId: requirement.project.organizationId,
            actorId: userId,
            action: 'requirement.submitted',
            resourceType: 'requirement',
            resourceId: requirement.id,
            details: JSON.stringify({
              code: requirement.code,
              title: requirement.title,
              projectId: requirement.projectId,
              version: requirement.currentVersion,
            }),
          },
        });
      } catch (e) {
        console.error('Failed to log submission activity', e);
      }
    }

    res.json({
      success: true,
      data: updated,
      message: `${requirement.code} submitted for review successfully.`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/requirements/:id/review - Review decision (Approve, Request Changes, Reject)
requirementsRouter.post('/:id/review', async (req: Request, res: Response) => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid requirement ID' });
    }

    const { decision, checklist, comment, reviewerId: bodyReviewerId } = req.body;

    // Validate decision enum
    if (!['APPROVED', 'CHANGES_REQUESTED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid decision. Must be APPROVED, CHANGES_REQUESTED, or REJECTED.',
      });
    }

    const requirement = await prisma.requirement.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, title: true, organizationId: true } },
        acceptanceCriteria: true,
        author: { select: { id: true, name: true, email: true } },
      },
    });

    if (!requirement) {
      return res.status(404).json({ success: false, error: 'Requirement not found' });
    }

    // Must be in PENDING_REVIEW
    if (requirement.workflowStatus !== 'PENDING_REVIEW') {
      return res.status(400).json({
        success: false,
        error: `Cannot review requirement in status "${requirement.workflowStatus}". Requirement must be in PENDING_REVIEW.`,
      });
    }

    const tokenUserId = getUserIdFromToken(req);
    const reviewerId = tokenUserId || bodyReviewerId || (requirement.reviewerId ? requirement.reviewerId : 1);

    // Rule 4: Author CANNOT approve own requirement (Default governance rule - strict check)
    if (reviewerId === requirement.authorId) {
      return res.status(403).json({
        success: false,
        error: 'Governance Rule 4: The author cannot approve or review their own requirement. Another authorized team member or reviewer must conduct the review.',
      });
    }

    // Zero-criteria guard on APPROVE
    if (decision === 'APPROVED' && requirement.acceptanceCriteria.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot approve a requirement with zero acceptance criteria. At least one criterion must be verified.',
      });
    }

    // Mandatory comment on REJECTED or CHANGES_REQUESTED
    if ((decision === 'CHANGES_REQUESTED' || decision === 'REJECTED') && (!comment || !comment.trim())) {
      return res.status(400).json({
        success: false,
        error: `A comment explaining the decision is required when ${decision === 'REJECTED' ? 'rejecting' : 'requesting changes'}.`,
      });
    }

    // Determine target workflow status
    let targetStatus: 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED' = decision;
    const now = new Date();

    // Check for non-viable dependencies (REJECTED or DEPRECATED)
    let problemDeps: Array<{ id: number; code: string; title: string; workflowStatus: string }> = [];
    if (decision === 'APPROVED') {
      const outgoing = await prisma.requirementDependency.findMany({
        where: {
          fromRequirementId: id,
          toRequirement: {
            workflowStatus: {
              in: ['REJECTED', 'DEPRECATED'],
            },
          },
        },
        include: {
          toRequirement: {
            select: { id: true, code: true, title: true, workflowStatus: true },
          },
        },
      });
      problemDeps = outgoing.map((d) => ({
        id: d.toRequirement.id,
        code: d.toRequirement.code,
        title: d.toRequirement.title,
        workflowStatus: d.toRequirement.workflowStatus,
      }));
    }

    // Execute review in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create RequirementReview record
      const reviewRecord = await tx.requirementReview.create({
        data: {
          requirementId: id,
          reviewerId,
          versionNumber: requirement.currentVersion,
          decision,
          checklist: checklist ? JSON.stringify(checklist) : null,
          comment: comment ? comment.trim() : null,
        },
      });

      // 2. Update requirement status & metadata
      const updateData: any = {
        workflowStatus: targetStatus,
      };

      if (decision === 'APPROVED') {
        updateData.approvedAt = now;
        updateData.approvedById = reviewerId;
        updateData.rejectionReason = null;
      } else if (decision === 'REJECTED') {
        updateData.rejectionReason = comment ? comment.trim() : 'Rejected by reviewer';
      } else if (decision === 'CHANGES_REQUESTED') {
        updateData.rejectionReason = null;
      }

      const updatedReq = await tx.requirement.update({
        where: { id },
        data: updateData,
        include: {
          author: { select: { id: true, name: true, email: true } },
          reviewer: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true, email: true } },
          acceptanceCriteria: true,
          reviews: {
            include: { reviewer: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'desc' },
          },
          versions: {
            orderBy: { versionNumber: 'desc' },
          },
        },
      });

      return { review: reviewRecord, requirement: updatedReq };
    });

    // Rule 7: Activity Event for review decision
    if (requirement.project?.organizationId) {
      try {
        let actionType = 'requirement.reviewed';
        if (decision === 'APPROVED') actionType = 'requirement.approved';
        else if (decision === 'CHANGES_REQUESTED') actionType = 'requirement.changes_requested';
        else if (decision === 'REJECTED') actionType = 'requirement.rejected';

        await prisma.organizationActivity.create({
          data: {
            organizationId: requirement.project.organizationId,
            actorId: reviewerId,
            action: actionType,
            resourceType: 'requirement',
            resourceId: requirement.id,
            details: JSON.stringify({
              code: requirement.code,
              title: requirement.title,
              decision,
              version: requirement.currentVersion,
              comment: comment || null,
              ...(problemDeps.length > 0
                ? {
                    warning: 'Approved with non-viable dependencies (REJECTED/DEPRECATED)',
                    affectedDependencies: problemDeps.map((d) => `${d.code} (${d.workflowStatus})`),
                  }
                : {}),
            }),
          },
        });
      } catch (e) {
        console.error('Failed to log review activity', e);
      }
    }

    res.json({
      success: true,
      data: result.requirement,
      review: result.review,
      warnings: problemDeps.length > 0 ? problemDeps : undefined,
      message: `Requirement ${requirement.code} ${decision.toLowerCase().replace('_', ' ')}.`,
    });
  } catch (error: any) {
    console.error('Error conducting requirement review:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});



// POST /api/requirements/:id/links - Link a task to requirement (Rule 9: real links only)
requirementsRouter.post('/:id/links', async (req: Request, res: Response) => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const requirementId = parseInt(rawId as string, 10);
    const { taskId, isPrimary } = req.body;

    if (!taskId || isNaN(parseInt(taskId, 10))) {
      return res.status(400).json({ success: false, error: 'Valid taskId is required' });
    }

    const task = await prisma.task.findUnique({
      where: { id: parseInt(taskId, 10) },
    });
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const link = await prisma.requirementLink.upsert({
      where: {
        requirementId_targetType_targetId: {
          requirementId,
          targetType: 'TASK',
          targetId: task.id,
        },
      },
      update: {
        isPrimary: isPrimary || false,
        taskId: task.id,
      },
      create: {
        requirementId,
        targetType: 'TASK',
        targetId: task.id,
        taskId: task.id,
        isPrimary: isPrimary || false,
      },
      include: {
        task: true,
      },
    });

    res.status(201).json({ success: true, data: link });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/requirements/:id/comments - Add threaded discussion comment
requirementsRouter.post('/:id/comments', async (req: Request, res: Response) => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const requirementId = parseInt(rawId as string, 10);
    const { body, parentId, versionId, mentions, attachments, pinned } = req.body;

    if (!body || !body.trim()) {
      return res.status(400).json({ success: false, error: 'Comment body is required' });
    }

    const requirement = await prisma.requirement.findUnique({
      where: { id: requirementId },
      include: {
        project: { select: { id: true, title: true, organizationId: true } },
      },
    });

    if (!requirement) {
      return res.status(404).json({ success: false, error: 'Requirement not found' });
    }

    const tokenUserId = getUserIdFromToken(req);
    const authorId = tokenUserId || req.body.authorId || 1;

    const comment = await prisma.requirementComment.create({
      data: {
        requirementId,
        authorId,
        body: body.trim(),
        parentId: parentId ? parseInt(parentId, 10) : null,
        versionId: versionId ? parseInt(versionId, 10) : null,
        mentions: mentions ? (typeof mentions === 'string' ? mentions : JSON.stringify(mentions)) : null,
        attachments: attachments ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments)) : null,
        pinned: Boolean(pinned),
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, email: true } },
      },
    });

    // Rule 7: Activity Event for comment
    if (requirement.project?.organizationId) {
      try {
        await prisma.organizationActivity.create({
          data: {
            organizationId: requirement.project.organizationId,
            actorId: authorId,
            action: 'requirement.comment_added',
            resourceType: 'requirement',
            resourceId: requirement.id,
            details: JSON.stringify({
              code: requirement.code,
              title: requirement.title,
              commentId: comment.id,
              preview: comment.body.slice(0, 80),
              versionId: comment.versionId || null,
            }),
          },
        });
      } catch (actErr) {
        console.error('Failed to log comment activity:', actErr);
      }
    }

    res.status(201).json({ success: true, data: comment });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/requirements/:id/comments/:commentId/resolve - Toggle comment resolution
requirementsRouter.patch('/:id/comments/:commentId/resolve', async (req: Request, res: Response) => {
  try {
    const rawCommentId = Array.isArray(req.params.commentId) ? req.params.commentId[0] : req.params.commentId;
    const commentId = parseInt(rawCommentId as string, 10);
    if (isNaN(commentId)) {
      return res.status(400).json({ success: false, error: 'Invalid comment ID' });
    }

    const existing = await prisma.requirementComment.findUnique({
      where: { id: commentId },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    const updated = await prisma.requirementComment.update({
      where: { id: commentId },
      data: {
        resolvedAt: existing.resolvedAt ? null : new Date(),
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, email: true } },
      },
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/requirements/:id/comments/:commentId/pin - Toggle comment pinned state
requirementsRouter.patch('/:id/comments/:commentId/pin', async (req: Request, res: Response) => {
  try {
    const rawCommentId = Array.isArray(req.params.commentId) ? req.params.commentId[0] : req.params.commentId;
    const commentId = parseInt(rawCommentId as string, 10);
    if (isNaN(commentId)) {
      return res.status(400).json({ success: false, error: 'Invalid comment ID' });
    }

    const existing = await prisma.requirementComment.findUnique({
      where: { id: commentId },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    const updated = await prisma.requirementComment.update({
      where: { id: commentId },
      data: {
        pinned: !existing.pinned,
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, email: true } },
      },
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/requirements/:id/comments/:commentId - Delete comment
requirementsRouter.delete('/:id/comments/:commentId', async (req: Request, res: Response) => {
  try {
    const rawCommentId = Array.isArray(req.params.commentId) ? req.params.commentId[0] : req.params.commentId;
    const commentId = parseInt(rawCommentId as string, 10);
    if (isNaN(commentId)) {
      return res.status(400).json({ success: false, error: 'Invalid comment ID' });
    }

    await prisma.requirementComment.delete({ where: { id: commentId } });
    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 7: CATEGORIES, TEMPLATES & DEPENDENCIES
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/requirements/categories - Create category
requirementsRouter.post('/categories', async (req: Request, res: Response) => {
  try {
    const { name, description, icon, color, defaultType, scope, organizationId, projectId } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Category name must be at least 2 characters' });
    }

    const category = await prisma.requirementCategory.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        icon: icon || 'tag',
        color: color || '#3B82F6',
        defaultType: defaultType || 'FUNCTIONAL',
        scope: scope || 'PROJECT',
        organizationId: organizationId ? parseInt(organizationId, 10) : null,
        projectId: projectId ? parseInt(projectId, 10) : null,
        isActive: true,
      },
    });

    res.status(201).json({ success: true, data: category });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/requirements/categories/:id - Update category
requirementsRouter.put('/categories/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid category ID' });
    }

    const { name, description, icon, color, defaultType, isActive } = req.body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (defaultType !== undefined) updateData.defaultType = defaultType;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await prisma.requirementCategory.update({
      where: { id },
      data: updateData,
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/requirements/categories/:id - Delete category with mandatory requirement reassignment
requirementsRouter.delete('/categories/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid category ID' });
    }

    const reassignToCategoryId = req.body?.reassignToCategoryId || req.query?.reassignToCategoryId;

    // Count requirements assigned to this category
    const assignedCount = await prisma.requirement.count({
      where: { categoryId: id },
    });

    if (assignedCount > 0 && !reassignToCategoryId) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete category: ${assignedCount} requirements are currently assigned to this category. A reassignment category (reassignToCategoryId) is required.`,
        assignedCount,
      });
    }

    if (reassignToCategoryId) {
      const targetCatId = parseInt(reassignToCategoryId as string, 10);
      if (targetCatId === id) {
        return res.status(400).json({
          success: false,
          error: 'Cannot reassign requirements to the same category being deleted.',
        });
      }
      const targetCat = await prisma.requirementCategory.findUnique({
        where: { id: targetCatId },
      });
      if (!targetCat) {
        return res.status(400).json({
          success: false,
          error: 'Target reassignment category does not exist.',
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      if (reassignToCategoryId) {
        const targetCatId = parseInt(reassignToCategoryId as string, 10);
        await tx.requirement.updateMany({
          where: { categoryId: id },
          data: { categoryId: targetCatId },
        });
      }

      await tx.requirementCategory.delete({ where: { id } });
    });

    res.json({
      success: true,
      message: reassignToCategoryId
        ? `Category deleted. ${assignedCount} requirements reassigned.`
        : 'Category deleted successfully.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// SYSTEM DEFAULT TEMPLATES
const SYSTEM_TEMPLATES = [
  {
    id: -1,
    name: 'User Story',
    description: 'Agile persona-based user story structure with acceptance criteria prompts.',
    scope: 'SYSTEM',
    isActive: true,
    structure: JSON.stringify({
      title: 'As a [user], I want [capability] so that [benefit]',
      type: 'FUNCTIONAL',
      priority: 'MEDIUM',
      description: '### User Persona\n- **Target User**: [e.g. Workspace Administrator]\n\n### User Journey / Workflow\n1. User navigates to [View / Section]...\n2. User performs [Primary Action]...\n3. System updates state and renders [Expected Result]...',
      expectedBehavior: 'System processes input within 200ms and renders immediate visual confirmation.',
      constraints: 'Must be responsive on mobile and desktop viewports.',
      defaultAcceptanceCriteria: [
        { code: 'AC-001', description: 'Given valid user credentials and permissions, when the user triggers the action, then state persists.', verificationMethod: 'Automated Test' },
        { code: 'AC-002', description: 'Given missing or invalid input, when submitted, then actionable error feedback is presented.', verificationMethod: 'Manual Verification' },
      ],
    }),
  },
  {
    id: -2,
    name: 'Technical Specification',
    description: 'Architecture, schema, API contract, and performance requirements.',
    scope: 'SYSTEM',
    isActive: true,
    structure: JSON.stringify({
      title: 'Technical Spec: [Component / Service]',
      type: 'TECHNICAL',
      priority: 'HIGH',
      description: '### Architecture & Design\nOverview of the architectural changes and data flow.\n\n### Data Model & Persistence\nTable modifications, indexing, and migration considerations.\n\n### API Contracts\nRequest/Response schemas and status codes.',
      constraints: 'p99 latency under 100ms. Zero blocking queries.',
      defaultAcceptanceCriteria: [
        { code: 'AC-001', description: 'API contract matches OpenAPI / TypeScript typed schema definitions.', verificationMethod: 'Automated Test' },
        { code: 'AC-002', description: 'Database query execution plan verified with zero table scans.', verificationMethod: 'Code Inspection' },
      ],
    }),
  },
  {
    id: -3,
    name: 'Bug Fix Requirement',
    description: 'Root cause analysis, reproduction steps, and regression prevention.',
    scope: 'SYSTEM',
    isActive: true,
    structure: JSON.stringify({
      title: 'Fix: [Issue Description]',
      type: 'TECHNICAL',
      priority: 'HIGH',
      description: '### Steps to Reproduce\n1. Navigate to...\n2. Click...\n3. Observe error...\n\n### Root Cause Analysis\nDetailed explanation of the defect mechanism.\n\n### Patch Strategy\nProposed resolution.',
      expectedBehavior: 'Error condition no longer occurs under identical reproduction conditions.',
      defaultAcceptanceCriteria: [
        { code: 'AC-001', description: 'Automated regression test reproduces failure prior to patch and passes with patch.', verificationMethod: 'Automated Test' },
      ],
    }),
  },
  {
    id: -4,
    name: 'Compliance & Security Item',
    description: 'Regulatory audit controls, encryption standards, and retention requirements.',
    scope: 'SYSTEM',
    isActive: true,
    structure: JSON.stringify({
      title: 'Compliance: [Security Control / Regulatory Standard]',
      type: 'COMPLIANCE',
      priority: 'CRITICAL',
      description: '### Regulatory Reference\nControl ID / Regulation (SOC2 / GDPR / ISO27001): ...\n\n### Control Implementation\nSecurity measures and safeguards required.\n\n### Evidence & Audit Artifacts\nLog format, retention period, and audit verification procedure.',
      constraints: 'Audit trails must be immutable and retained for a minimum of 365 days.',
      defaultAcceptanceCriteria: [
        { code: 'AC-001', description: 'Immutable audit log event emitted for all administrative and data access actions.', verificationMethod: 'Security Audit' },
        { code: 'AC-002', description: 'Data at rest and in transit encrypted using approved cryptographic algorithms.', verificationMethod: 'Security Audit' },
      ],
    }),
  },
];

// GET /api/requirements/templates - List templates (System defaults + Custom saved)
requirementsRouter.get('/templates', async (req: Request, res: Response) => {
  try {
    const orgId = req.query.organizationId ? parseInt(req.query.organizationId as string, 10) : undefined;
    const projId = req.query.projectId ? parseInt(req.query.projectId as string, 10) : undefined;

    const where: any = { isActive: true };
    if (orgId || projId) {
      where.OR = [
        { scope: 'ORG', ...(orgId ? { organizationId: orgId } : {}) },
        { scope: 'PROJECT', ...(projId ? { projectId: projId } : {}) },
      ];
    }

    const customTemplates = await prisma.requirementTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const allTemplates = [...SYSTEM_TEMPLATES, ...customTemplates];
    res.json({ success: true, data: allTemplates });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/requirements/templates - Create custom template
requirementsRouter.post('/templates', async (req: Request, res: Response) => {
  try {
    const { name, description, structure, scope, organizationId, projectId } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Template name must be at least 2 characters' });
    }
    if (!structure) {
      return res.status(400).json({ success: false, error: 'Template structure JSON is required' });
    }

    const template = await prisma.requirementTemplate.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        structure: typeof structure === 'string' ? structure : JSON.stringify(structure),
        scope: scope || 'ORG',
        organizationId: organizationId ? parseInt(organizationId, 10) : null,
        projectId: projectId ? parseInt(projectId, 10) : null,
        isActive: true,
      },
    });

    res.status(201).json({ success: true, data: template });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// CIRCULAR DEPENDENCY DETECTION ALGORITHM (DFS)
async function detectCircularDependency(
  fromId: number,
  toId: number,
  type: string
): Promise<{ hasCycle: boolean; path?: string }> {
  // Only DEPENDS_ON and BLOCKS are directional ordering constraints
  if (type !== 'DEPENDS_ON' && type !== 'BLOCKS') {
    return { hasCycle: false };
  }

  // Direct self-dependency check
  if (fromId === toId) {
    return { hasCycle: true, path: `REQ-${fromId} -> REQ-${toId}` };
  }

  // If A DEPENDS_ON B: edge is A -> B. Cycle exists if B already reaches A.
  // If A BLOCKS B: B depends on A (B -> A). Cycle exists if A already reaches B.
  const startNode = type === 'DEPENDS_ON' ? toId : fromId;
  const targetNode = type === 'DEPENDS_ON' ? fromId : toId;

  // Fetch all existing ordering dependencies
  const allDeps = await prisma.requirementDependency.findMany({
    where: {
      type: { in: ['DEPENDS_ON', 'BLOCKS'] },
    },
    select: {
      fromRequirementId: true,
      toRequirementId: true,
      type: true,
      fromRequirement: { select: { code: true } },
      toRequirement: { select: { code: true } },
    },
  });

  const adj = new Map<number, number[]>();
  const codeMap = new Map<number, string>();

  for (const d of allDeps) {
    codeMap.set(d.fromRequirementId, d.fromRequirement.code);
    codeMap.set(d.toRequirementId, d.toRequirement.code);

    let u = d.fromRequirementId;
    let v = d.toRequirementId;
    if (d.type === 'BLOCKS') {
      u = d.toRequirementId;
      v = d.fromRequirementId;
    }

    if (!adj.has(u)) adj.set(u, []);
    adj.get(u)!.push(v);
  }

  // DFS search
  const visited = new Set<number>();
  const path: number[] = [];

  function dfs(curr: number): boolean {
    visited.add(curr);
    path.push(curr);

    if (curr === targetNode) {
      return true;
    }

    const neighbors = adj.get(curr) || [];
    for (const next of neighbors) {
      if (!visited.has(next)) {
        if (dfs(next)) return true;
      }
    }

    path.pop();
    return false;
  }

  if (dfs(startNode)) {
    const codePath = path.map((id) => codeMap.get(id) || `ID:${id}`).join(' -> ');
    return { hasCycle: true, path: codePath };
  }

  return { hasCycle: false };
}

// GET /api/requirements/:id/dependencies - Get dependency graph & links
requirementsRouter.get('/:id/dependencies', async (req: Request, res: Response) => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const requirementId = parseInt(rawId as string, 10);
    if (isNaN(requirementId)) {
      return res.status(400).json({ success: false, error: 'Invalid requirement ID' });
    }

    const outgoing = await prisma.requirementDependency.findMany({
      where: { fromRequirementId: requirementId },
      include: {
        toRequirement: {
          select: {
            id: true,
            code: true,
            title: true,
            workflowStatus: true,
            priority: true,
          },
        },
      },
    });

    const incoming = await prisma.requirementDependency.findMany({
      where: { toRequirementId: requirementId },
      include: {
        fromRequirement: {
          select: {
            id: true,
            code: true,
            title: true,
            workflowStatus: true,
            priority: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: {
        outgoing,
        incoming,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/requirements/:id/dependencies - Link requirement dependency with cycle prevention
requirementsRouter.post('/:id/dependencies', async (req: Request, res: Response) => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const fromRequirementId = parseInt(rawId as string, 10);
    const { targetRequirementId, type } = req.body;

    if (isNaN(fromRequirementId)) {
      return res.status(400).json({ success: false, error: 'Invalid requirement ID' });
    }
    const toRequirementId = parseInt(targetRequirementId, 10);
    if (isNaN(toRequirementId)) {
      return res.status(400).json({ success: false, error: 'Valid targetRequirementId is required' });
    }

    if (fromRequirementId === toRequirementId) {
      return res.status(400).json({
        success: false,
        error: 'A requirement cannot depend on or block itself.',
      });
    }

    const validTypes = ['DEPENDS_ON', 'BLOCKS', 'RELATED_TO', 'ENHANCES', 'CONFLICTS_WITH'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid dependency type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    // Verify both requirements exist
    const [fromReq, toReq] = await Promise.all([
      prisma.requirement.findUnique({
        where: { id: fromRequirementId },
        select: {
          id: true,
          code: true,
          title: true,
          projectId: true,
          project: { select: { organizationId: true } },
        },
      }),
      prisma.requirement.findUnique({
        where: { id: toRequirementId },
        select: {
          id: true,
          code: true,
          title: true,
          projectId: true,
          project: { select: { organizationId: true } },
        },
      }),
    ]);

    if (!fromReq || !toReq) {
      return res.status(404).json({ success: false, error: 'One or both requirements not found' });
    }

    // Check for circular dependencies (for ordering types)
    const cycleCheck = await detectCircularDependency(fromRequirementId, toRequirementId, type);
    if (cycleCheck.hasCycle) {
      return res.status(400).json({
        success: false,
        error: `Circular dependency detected: ${cycleCheck.path}. Requirements cannot form a circular dependency chain for ordering relationships (DEPENDS_ON, BLOCKS).`,
      });
    }

    // Upsert dependency
    const dependency = await prisma.requirementDependency.upsert({
      where: {
        fromRequirementId_toRequirementId: {
          fromRequirementId,
          toRequirementId,
        },
      },
      update: { type },
      create: {
        fromRequirementId,
        toRequirementId,
        type,
      },
      include: {
        toRequirement: {
          select: { id: true, code: true, title: true, workflowStatus: true },
        },
      },
    });

    const tokenUserId = getUserIdFromToken(req);
    const actorId = tokenUserId || 1;

    // Rule 7: Activity Event for dependency added
    const orgId = fromReq.project?.organizationId || toReq.project?.organizationId;
    if (orgId) {
      try {
        await prisma.organizationActivity.create({
          data: {
            organizationId: orgId,
            actorId,
            action: 'requirement.dependency_added',
            resourceType: 'requirement',
            resourceId: fromReq.id,
            details: JSON.stringify({
              fromCode: fromReq.code,
              fromTitle: fromReq.title,
              toCode: toReq.code,
              toTitle: toReq.title,
              type,
            }),
          },
        });
      } catch (actErr) {
        console.error('Failed to log dependency activity:', actErr);
      }
    }

    res.status(201).json({
      success: true,
      data: dependency,
      message: `Linked ${fromReq.code} ${type.toLowerCase().replace('_', ' ')} ${toReq.code}.`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 8: TRACEABILITY & REPORTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/requirements/traceability - Matrix table, tree hierarchy, and coverage metrics
requirementsRouter.get('/traceability', async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId ? parseInt(req.query.projectId as string, 10) : undefined;
    const organizationId = req.query.organizationId
      ? parseInt(req.query.organizationId as string, 10)
      : undefined;

    const where: any = {};
    if (projectId) where.projectId = projectId;
    else if (organizationId) where.project = { organizationId };

    const requirements = await prisma.requirement.findMany({
      where,
      include: {
        project: { select: { id: true, title: true } },
        acceptanceCriteria: true,
        links: {
          include: {
            task: { select: { id: true, title: true, status: true, priority: true } },
          },
        },
        dependenciesFrom: {
          include: {
            toRequirement: { select: { id: true, code: true, title: true, workflowStatus: true } },
          },
        },
      },
      orderBy: [{ priority: 'asc' }, { code: 'asc' }],
    });

    const now = new Date();

    // Build matrix rows & warning diagnostics
    const matrix = requirements.map((r) => {
      const criteriaCount = r.acceptanceCriteria.length;
      const completedCriteriaCount = r.acceptanceCriteria.filter((c) => c.isComplete).length;
      const linkedTasks = r.links.filter((l) => l.targetType === 'TASK' && l.task);
      const tasksCount = linkedTasks.length;
      const completedTasksCount = linkedTasks.filter((l) => l.task?.status === 'DONE').length;
      const testsCount = 0; // QA module integration placeholder
      const defectsCount = 0;

      const warnings: Array<{ code: string; label: string; severity: 'red' | 'amber' }> = [];

      // Warning 1: No criteria (Red)
      if (criteriaCount === 0) {
        warnings.push({ code: 'NO_CRITERIA', label: 'No Criteria', severity: 'red' });
      }

      // Warning 2: Approved with no tasks (Amber)
      if (r.workflowStatus === 'APPROVED' && tasksCount === 0) {
        warnings.push({ code: 'APPROVED_NO_TASKS', label: 'Approved Without Tasks', severity: 'amber' });
      }

      // Warning 3: Target date past but implementation not verified (Red)
      if (r.targetDate && new Date(r.targetDate) < now && r.implementationStatus !== 'VERIFIED') {
        warnings.push({ code: 'OVERDUE_UNVERIFIED', label: 'Overdue & Unverified', severity: 'red' });
      }

      // Warning 4: Blocked status (Red)
      if (r.implementationStatus === 'BLOCKED') {
        warnings.push({ code: 'BLOCKED', label: 'Implementation Blocked', severity: 'red' });
      }

      return {
        id: r.id,
        code: r.code,
        title: r.title,
        type: r.type,
        priority: r.priority,
        workflowStatus: r.workflowStatus,
        implementationStatus: r.implementationStatus,
        targetDate: r.targetDate,
        projectId: r.projectId,
        projectTitle: r.project?.title,
        criteriaCount,
        completedCriteriaCount,
        tasksCount,
        completedTasksCount,
        testsCount,
        defectsCount,
        warnings,
        isVerified:
          criteriaCount > 0 &&
          completedCriteriaCount === criteriaCount &&
          r.implementationStatus === 'VERIFIED',
      };
    });

    // Calculate Coverage Metrics
    const total = matrix.length;
    const withCriteria = matrix.filter((m) => m.criteriaCount > 0).length;
    const withTasks = matrix.filter((m) => m.tasksCount > 0).length;
    const withTests = matrix.filter((m) => m.testsCount > 0).length;
    const fullyVerified = matrix.filter((m) => m.isVerified).length;

    const coverage = {
      total,
      withCriteriaCount: withCriteria,
      withCriteriaPercent: total > 0 ? Math.round((withCriteria / total) * 100) : 0,
      withTasksCount: withTasks,
      withTasksPercent: total > 0 ? Math.round((withTasks / total) * 100) : 0,
      withTestsCount: withTests,
      withTestsPercent: total > 0 ? Math.round((withTests / total) * 100) : 0,
      fullyVerifiedCount: fullyVerified,
      fullyVerifiedPercent: total > 0 ? Math.round((fullyVerified / total) * 100) : 0,
      withWarningsCount: matrix.filter((m) => m.warnings.length > 0).length,
    };

    // Build Traceability Tree (Business/Epics -> Functional -> Criteria -> Tasks)
    const tree = requirements.map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      type: r.type,
      workflowStatus: r.workflowStatus,
      criteria: r.acceptanceCriteria.map((ac) => ({
        id: ac.id,
        code: ac.code,
        description: ac.description,
        isComplete: ac.isComplete,
      })),
      tasks: r.links
        .filter((l) => l.targetType === 'TASK' && l.task)
        .map((l) => ({
          id: l.task!.id,
          title: l.task!.title,
          status: l.task!.status,
        })),
    }));

    res.json({
      success: true,
      data: {
        matrix,
        coverage,
        tree,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/requirements/traceability/export - Export Traceability Matrix CSV
requirementsRouter.get('/traceability/export', async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId ? parseInt(req.query.projectId as string, 10) : undefined;
    const organizationId = req.query.organizationId
      ? parseInt(req.query.organizationId as string, 10)
      : undefined;

    const where: any = {};
    if (projectId) where.projectId = projectId;
    else if (organizationId) where.project = { organizationId };

    const requirements = await prisma.requirement.findMany({
      where,
      include: {
        project: { select: { title: true } },
        acceptanceCriteria: true,
        links: {
          include: { task: { select: { id: true, title: true, status: true } } },
        },
      },
      orderBy: { code: 'asc' },
    });

    const headers = [
      'Requirement ID',
      'Title',
      'Type',
      'Workflow Status',
      'Implementation Status',
      'Priority',
      'Criteria Count',
      'Completed Criteria',
      'Linked Tasks Count',
      'Linked Tasks (IDs)',
      'Linked Tests',
      'Target Date',
      'Warnings',
    ];

    const now = new Date();
    const rows = requirements.map((r) => {
      const criteriaCount = r.acceptanceCriteria.length;
      const completedCriteria = r.acceptanceCriteria.filter((c) => c.isComplete).length;
      const tasks = r.links.filter((l) => l.targetType === 'TASK' && l.task);
      const warnings: string[] = [];

      if (criteriaCount === 0) warnings.push('NO_CRITERIA');
      if (r.workflowStatus === 'APPROVED' && tasks.length === 0) warnings.push('APPROVED_NO_TASKS');
      if (r.targetDate && new Date(r.targetDate) < now && r.implementationStatus !== 'VERIFIED') {
        warnings.push('OVERDUE_UNVERIFIED');
      }

      return [
        r.code,
        `"${r.title.replace(/"/g, '""')}"`,
        r.type,
        r.workflowStatus,
        r.implementationStatus,
        r.priority,
        criteriaCount,
        completedCriteria,
        tasks.length,
        `"${tasks.map((t) => `TASK-${t.task!.id}`).join('; ')}"`,
        'QA Module Pending',
        r.targetDate ? new Date(r.targetDate).toISOString().split('T')[0] : '',
        `"${warnings.join('; ')}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="devflow-traceability-matrix.csv"');
    res.status(200).send(csvContent);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});





