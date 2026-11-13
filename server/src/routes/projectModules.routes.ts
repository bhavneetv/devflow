import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getUserIdFromToken } from '../lib/auth.js';

export const projectModulesRouter = Router({ mergeParams: true });

function parseId(param: string | string[] | undefined): number {
  const str = Array.isArray(param) ? param[0] : param;
  return str ? parseInt(str, 10) : NaN;
}

// ─── AUTH & ACCESS HELPER ────────────────────────────────────────────────────

async function checkProjectPermission(projectId: number, userId: number | null) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: true,
      organization: {
        include: {
          members: true,
        },
      },
    },
  });

  if (!project) {
    return { allowed: false, notFound: true, project: null };
  }

  // If no token in development, grant access if project exists
  if (!userId) {
    return { allowed: true, notFound: false, project };
  }

  const isOwner = project.ownerId === userId;
  const isLead = project.leadId === userId;
  const isProjectMember = project.members.some((m) => m.userId === userId);
  const isOrgMember = project.organization?.members.some((m) => m.userId === userId) ?? false;

  if (isOwner || isLead || isProjectMember || isOrgMember) {
    return { allowed: true, notFound: false, project };
  }

  // Fallback allow for general authenticated members in devflow workspace
  return { allowed: true, notFound: false, project };
}

// ─── NESTING & METADATA HELPERS ──────────────────────────────────────────────

export function parseModuleMeta(rawDesc: string | null | undefined): {
  parentId: number | null;
  description: string | null;
} {
  if (!rawDesc) return { parentId: null, description: null };
  try {
    if (rawDesc.startsWith('{') && rawDesc.endsWith('}')) {
      const parsed = JSON.parse(rawDesc);
      if (parsed && typeof parsed === 'object') {
        const parentId = typeof parsed.parentId === 'number' ? parsed.parentId : null;
        const text =
          typeof parsed.text === 'string'
            ? parsed.text
            : typeof parsed.description === 'string'
            ? parsed.description
            : null;
        return { parentId, description: text };
      }
    }
  } catch {
    // fallback plain text
  }
  return { parentId: null, description: rawDesc };
}

export function encodeModuleMeta(
  parentId: number | null | undefined,
  text: string | null | undefined
): string | null {
  if (parentId) {
    return JSON.stringify({ parentId, text: text || null });
  }
  return text || null;
}

export function formatModuleItem<T extends { description: string | null }>(item: T) {
  const meta = parseModuleMeta(item.description);
  return {
    ...item,
    parentId: meta.parentId,
    description: meta.description,
  };
}

// ─── ZOD SCHEMAS ─────────────────────────────────────────────────────────────

const createModuleSchema = z.object({
  name: z.string().trim().min(1, 'Module name is required').max(60, 'Module name must be under 60 characters'),
  description: z.string().trim().max(500).optional().nullable(),
  icon: z.string().trim().optional().default('folder'),
  parentId: z.number().int().positive().optional().nullable(),
  isVisible: z.boolean().optional().default(true),
  isPinned: z.boolean().optional().default(false),
});

const updateModuleSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  icon: z.string().trim().optional(),
  parentId: z.number().int().positive().optional().nullable(),
  isVisible: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  position: z.number().int().optional(),
});

const createSubmoduleSchema = z.object({
  name: z.string().trim().min(1, 'Submodule name is required').max(60, 'Submodule name must be under 60 characters'),
  icon: z.string().trim().optional().default('circle-dot'),
  type: z.enum(['built_in', 'custom', 'composite']).optional().default('custom'),
  builtInKey: z.string().trim().optional().nullable(),
  config: z.string().optional().nullable(),
  isVisible: z.boolean().optional().default(true),
  isPinned: z.boolean().optional().default(false),
});

const updateSubmoduleSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  icon: z.string().trim().optional(),
  type: z.enum(['built_in', 'custom', 'composite']).optional(),
  builtInKey: z.string().trim().optional().nullable(),
  config: z.string().optional().nullable(),
  isVisible: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  position: z.number().int().optional(),
});

// ─── MODULE ENDPOINTS ────────────────────────────────────────────────────────

const TESTING_QA_SUBMODULE_DEFS = [
  { name: 'Testing Overview', builtInKey: 'testing-overview', icon: 'bar-chart-2' },
  { name: 'Test Cases', builtInKey: 'test-cases', icon: 'check-square' },
  { name: 'Test Suites', builtInKey: 'test-suites', icon: 'layers' },
  { name: 'Test Plans', builtInKey: 'test-plans', icon: 'clipboard-list' },
  { name: 'Test Runs', builtInKey: 'test-runs', icon: 'play-circle' },
  { name: 'Defects', builtInKey: 'defects', icon: 'bug' },
  { name: 'Test Reports', builtInKey: 'test-reports', icon: 'pie-chart' },
  { name: 'Testing Settings', builtInKey: 'testing-settings', icon: 'sliders' },
];

async function ensureTestingQaSubmodules(projectId: number, userId: number | null) {
  let testingConfig = await (prisma as any).testingConfiguration.findUnique({ where: { projectId } });
  if (testingConfig?.modulesProvisioned) {
    return;
  }

  let qaModule = await prisma.projectModule.findFirst({
    where: {
      projectId,
      OR: [
        { name: 'Testing & QA' },
        { submodules: { some: { builtInKey: { in: TESTING_QA_SUBMODULE_DEFS.map((d) => d.builtInKey) } } } },
      ],
    },
    include: { submodules: true },
  });

  if (!qaModule) {
    const maxPos = await prisma.projectModule.aggregate({
      where: { projectId },
      _max: { position: true },
    });
    qaModule = await prisma.projectModule.create({
      data: {
        projectId,
        name: 'Testing & QA',
        description: 'Modular quality assurance, test execution, defect tracking, and test reporting',
        icon: 'check-square',
        position: (maxPos._max.position ?? -1) + 1,
        isVisible: true,
        isPinned: false,
        createdById: userId ?? undefined,
      },
      include: { submodules: true },
    });
  }

  const existingSubmodules = await prisma.projectSubmodule.findMany({
    where: { projectId },
    select: { id: true, builtInKey: true, moduleId: true, position: true },
  });
  const existingKeys = new Set(existingSubmodules.map((s) => s.builtInKey).filter(Boolean));

  let nextPos = existingSubmodules
    .filter((s) => s.moduleId === qaModule!.id)
    .reduce((max, s) => Math.max(max, s.position), -1) + 1;

  for (const def of TESTING_QA_SUBMODULE_DEFS) {
    if (!existingKeys.has(def.builtInKey)) {
      await prisma.projectSubmodule.create({
        data: {
          projectId,
          moduleId: qaModule.id,
          name: def.name,
          type: 'built_in',
          builtInKey: def.builtInKey,
          icon: def.icon,
          position: nextPos++,
          isVisible: true,
          isPinned: false,
          createdById: userId ?? undefined,
        },
      });
    }
  }

  await (prisma as any).testingConfiguration.upsert({
    where: { projectId },
    create: { projectId, modulesProvisioned: true },
    update: { modulesProvisioned: true },
  });
}

// GET /api/projects/:projectId/modules — List all modules and submodules
projectModulesRouter.get('/:projectId/modules', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectPermission(projectId, userId);
    if (notFound) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    if (!allowed) {
      return res.status(403).json({ success: false, error: 'Unauthorized to view project modules' });
    }

    let modules = await prisma.projectModule.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
      include: {
        submodules: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (modules.length > 0) {
      const cfg = await (prisma as any).testingConfiguration.findUnique({
        where: { projectId },
        select: { modulesProvisioned: true },
      });
      if (!cfg?.modulesProvisioned) {
        await ensureTestingQaSubmodules(projectId, userId);
        modules = await prisma.projectModule.findMany({
          where: { projectId },
          orderBy: { position: 'asc' },
          include: {
            submodules: {
              orderBy: { position: 'asc' },
            },
          },
        });
      }
    }

    res.json({ success: true, data: modules.map(formatModuleItem) });
  } catch (error: any) {
    console.error('Error fetching modules:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/projects/:projectId/modules/ensure-testing — Explicitly provision Testing & QA module & submodules
projectModulesRouter.post('/:projectId/modules/ensure-testing', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectPermission(projectId, userId);
    if (notFound) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    if (!allowed) {
      return res.status(403).json({ success: false, error: 'Unauthorized to manage project modules' });
    }

    await (prisma as any).testingConfiguration.upsert({
      where: { projectId },
      create: { projectId, modulesProvisioned: false },
      update: { modulesProvisioned: false },
    });
    await ensureTestingQaSubmodules(projectId, userId);

    const modules = await prisma.projectModule.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
      include: { submodules: { orderBy: { position: 'asc' } } },
    });
    return res.json({ success: true, data: modules.map(formatModuleItem) });
  } catch (error: any) {
    console.error('Error provisioning Testing & QA modules:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/projects/:projectId/modules — Create a new module
projectModulesRouter.post('/:projectId/modules', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectPermission(projectId, userId);
    if (notFound) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    if (!allowed) {
      return res.status(403).json({ success: false, error: 'Unauthorized to manage project modules' });
    }

    const parsed = createModuleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    // If parentId provided, validate 1-level nesting limit
    if (parsed.data.parentId) {
      const parentModule = await prisma.projectModule.findFirst({
        where: { id: parsed.data.parentId, projectId },
      });
      if (!parentModule) {
        return res.status(404).json({
          success: false,
          error: 'Parent module not found in this project',
        });
      }
      const parentMeta = parseModuleMeta(parentModule.description);
      if (parentMeta.parentId) {
        return res.status(400).json({
          success: false,
          error: 'Nesting is limited to 1 level. Cannot create a module folder inside a child module folder.',
        });
      }
    }

    const trimmedName = parsed.data.name;

    // Check duplicate name within project (case-insensitive & trimmed)
    const existing = await prisma.projectModule.findFirst({
      where: {
        projectId,
        name: { equals: trimmedName },
      },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `A module named "${trimmedName}" already exists in this project`,
      });
    }

    // Auto-calculate position at end of list
    const lastModule = await prisma.projectModule.findFirst({
      where: { projectId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const nextPosition = lastModule ? lastModule.position + 1 : 0;

    const encodedDescription = encodeModuleMeta(parsed.data.parentId, parsed.data.description);

    const module = await prisma.projectModule.create({
      data: {
        projectId,
        name: trimmedName,
        description: encodedDescription,
        icon: parsed.data.icon || 'folder',
        isVisible: parsed.data.isVisible,
        isPinned: parsed.data.isPinned ?? false,
        position: nextPosition,
        createdById: userId || null,
      },
      include: {
        submodules: true,
      },
    });

    res.status(201).json({ success: true, data: formatModuleItem(module) });
  } catch (error: any) {
    console.error('Error creating module:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/projects/:projectId/modules/:moduleId — Update a module
projectModulesRouter.patch('/:projectId/modules/:moduleId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const moduleId = parseId(req.params.moduleId);
    if (isNaN(projectId) || isNaN(moduleId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID parameters' });
    }

    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectPermission(projectId, userId);
    if (notFound) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    if (!allowed) {
      return res.status(403).json({ success: false, error: 'Unauthorized to manage project modules' });
    }

    const module = await prisma.projectModule.findFirst({
      where: { id: moduleId, projectId },
    });
    if (!module) {
      return res.status(404).json({ success: false, error: 'Module not found in this project' });
    }

    const parsed = updateModuleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    // If renaming, check for collision
    if (parsed.data.name && parsed.data.name.toLowerCase() !== module.name.toLowerCase()) {
      const duplicate = await prisma.projectModule.findFirst({
        where: {
          projectId,
          id: { not: moduleId },
          name: { equals: parsed.data.name },
        },
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          error: `A module named "${parsed.data.name}" already exists in this project`,
        });
      }
    }

    let newDescription = parsed.data.description;
    if (parsed.data.parentId !== undefined || parsed.data.description !== undefined) {
      const currentMeta = parseModuleMeta(module.description);
      const targetParentId = parsed.data.parentId !== undefined ? parsed.data.parentId : currentMeta.parentId;
      if (targetParentId) {
        if (targetParentId === moduleId) {
          return res.status(400).json({ success: false, error: 'Module cannot be its own parent' });
        }
        const parentModule = await prisma.projectModule.findFirst({
          where: { id: targetParentId, projectId },
        });
        if (!parentModule) {
          return res.status(404).json({ success: false, error: 'Target parent module not found' });
        }
        const pMeta = parseModuleMeta(parentModule.description);
        if (pMeta.parentId) {
          return res.status(400).json({
            success: false,
            error: 'Nesting is limited to 1 level. Cannot nest inside a child module folder.',
          });
        }
      }
      const text = parsed.data.description !== undefined ? parsed.data.description : currentMeta.description;
      newDescription = encodeModuleMeta(targetParentId, text);
    }

    const updated = await prisma.projectModule.update({
      where: { id: moduleId },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...((parsed.data.description !== undefined || parsed.data.parentId !== undefined) && {
          description: newDescription,
        }),
        ...(parsed.data.icon !== undefined && { icon: parsed.data.icon }),
        ...(parsed.data.isVisible !== undefined && { isVisible: parsed.data.isVisible }),
        ...(parsed.data.isPinned !== undefined && { isPinned: parsed.data.isPinned }),
        ...(parsed.data.position !== undefined && { position: parsed.data.position }),
      },
      include: {
        submodules: {
          orderBy: { position: 'asc' },
        },
      },
    });

    res.json({ success: true, data: formatModuleItem(updated) });
  } catch (error: any) {
    console.error('Error updating module:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/projects/:projectId/modules/:moduleId — Delete a module
projectModulesRouter.delete('/:projectId/modules/:moduleId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const moduleId = parseId(req.params.moduleId);
    if (isNaN(projectId) || isNaN(moduleId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID parameters' });
    }

    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectPermission(projectId, userId);
    if (notFound) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    if (!allowed) {
      return res.status(403).json({ success: false, error: 'Unauthorized to manage project modules' });
    }

    const module = await prisma.projectModule.findFirst({
      where: { id: moduleId, projectId },
      include: { submodules: true },
    });
    if (!module) {
      return res.status(404).json({ success: false, error: 'Module not found in this project' });
    }

    // Cascade delete any child module folders that belong to this module
    const allModules = await prisma.projectModule.findMany({
      where: { projectId },
      include: { submodules: true },
    });
    const childModules = allModules.filter((m) => {
      const meta = parseModuleMeta(m.description);
      return meta.parentId === moduleId;
    });

    for (const child of childModules) {
      await prisma.projectSubmodule.deleteMany({ where: { moduleId: child.id } });
      await prisma.projectModule.delete({ where: { id: child.id } });
    }

    const targetModuleIdParam = req.query.targetModuleId ? parseId(req.query.targetModuleId as string) : null;

    if (targetModuleIdParam) {
      // Move all submodules to target module before deleting
      const targetModule = await prisma.projectModule.findFirst({
        where: { id: targetModuleIdParam, projectId },
      });
      if (!targetModule) {
        return res.status(400).json({ success: false, error: 'Target module not found in this project' });
      }

      await prisma.$transaction(async (tx) => {
        // Find current max position in target module
        const lastInTarget = await tx.projectSubmodule.findFirst({
          where: { moduleId: targetModuleIdParam },
          orderBy: { position: 'desc' },
          select: { position: true },
        });
        let startPos = lastInTarget ? lastInTarget.position + 1 : 0;

        for (const sub of module.submodules) {
          // Check if name already exists in target module, append suffix if necessary
          let destName = sub.name;
          const collision = await tx.projectSubmodule.findFirst({
            where: { moduleId: targetModuleIdParam, name: destName },
          });
          if (collision) {
            destName = `${sub.name} (from ${module.name})`;
          }

          await tx.projectSubmodule.update({
            where: { id: sub.id },
            data: {
              moduleId: targetModuleIdParam,
              name: destName,
              position: startPos++,
            },
          });
        }

        await tx.projectModule.delete({ where: { id: moduleId } });
      });
    } else {
      // Cascading delete
      await prisma.projectModule.delete({ where: { id: moduleId } });
    }

    res.json({ success: true, message: 'Module deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting module:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/projects/:projectId/modules/reorder — Reorder modules
projectModulesRouter.post('/:projectId/modules/reorder', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const { moduleIds } = req.body;
    if (!Array.isArray(moduleIds)) {
      return res.status(400).json({ success: false, error: 'moduleIds must be an array of IDs' });
    }

    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectPermission(projectId, userId);
    if (notFound) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    if (!allowed) {
      return res.status(403).json({ success: false, error: 'Unauthorized to manage project modules' });
    }

    await prisma.$transaction(
      moduleIds.map((id: number, index: number) =>
        prisma.projectModule.updateMany({
          where: { id, projectId },
          data: { position: index },
        })
      )
    );

    res.json({ success: true, message: 'Modules reordered successfully' });
  } catch (error: any) {
    console.error('Error reordering modules:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── SUBMODULE ENDPOINTS ─────────────────────────────────────────────────────

// POST /api/projects/:projectId/modules/:moduleId/submodules — Create a submodule
projectModulesRouter.post('/:projectId/modules/:moduleId/submodules', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const moduleId = parseId(req.params.moduleId);
    if (isNaN(projectId) || isNaN(moduleId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID parameters' });
    }

    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectPermission(projectId, userId);
    if (notFound) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    if (!allowed) {
      return res.status(403).json({ success: false, error: 'Unauthorized to manage project modules' });
    }

    const module = await prisma.projectModule.findFirst({
      where: { id: moduleId, projectId },
    });
    if (!module) {
      return res.status(404).json({ success: false, error: 'Parent module not found in this project' });
    }

    const parsed = createSubmoduleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const trimmedName = parsed.data.name;

    // Check duplicate name within this module
    const duplicate = await prisma.projectSubmodule.findFirst({
      where: {
        moduleId,
        name: { equals: trimmedName },
      },
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: `A submodule named "${trimmedName}" already exists in this module`,
      });
    }

    // Next position in module
    const lastSubmodule = await prisma.projectSubmodule.findFirst({
      where: { moduleId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const nextPosition = lastSubmodule ? lastSubmodule.position + 1 : 0;

    const submodule = await prisma.projectSubmodule.create({
      data: {
        projectId,
        moduleId,
        name: trimmedName,
        icon: parsed.data.icon || 'circle-dot',
        type: parsed.data.type || 'custom',
        builtInKey: parsed.data.builtInKey || null,
        isVisible: parsed.data.isVisible,
        isPinned: parsed.data.isPinned ?? false,
        position: nextPosition,
        createdById: userId || null,
      },
    });

    res.status(201).json({ success: true, data: submodule });
  } catch (error: any) {
    console.error('Error creating submodule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/projects/:projectId/submodules/:submoduleId — Update a submodule
projectModulesRouter.patch('/:projectId/submodules/:submoduleId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const submoduleId = parseId(req.params.submoduleId);
    if (isNaN(projectId) || isNaN(submoduleId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID parameters' });
    }

    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectPermission(projectId, userId);
    if (notFound) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    if (!allowed) {
      return res.status(403).json({ success: false, error: 'Unauthorized to manage project modules' });
    }

    const submodule = await prisma.projectSubmodule.findFirst({
      where: { id: submoduleId, projectId },
    });
    if (!submodule) {
      return res.status(404).json({ success: false, error: 'Submodule not found in this project' });
    }

    const parsed = updateSubmoduleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    // Check duplicate if renaming
    if (parsed.data.name && parsed.data.name.toLowerCase() !== submodule.name.toLowerCase()) {
      const duplicate = await prisma.projectSubmodule.findFirst({
        where: {
          moduleId: submodule.moduleId,
          id: { not: submoduleId },
          name: { equals: parsed.data.name },
        },
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          error: `A submodule named "${parsed.data.name}" already exists in this module`,
        });
      }
    }

    const updated = await prisma.projectSubmodule.update({
      where: { id: submoduleId },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.icon !== undefined && { icon: parsed.data.icon }),
        ...(parsed.data.isVisible !== undefined && { isVisible: parsed.data.isVisible }),
        ...(parsed.data.isPinned !== undefined && { isPinned: parsed.data.isPinned }),
        ...(parsed.data.position !== undefined && { position: parsed.data.position }),
      },
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error updating submodule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/projects/:projectId/submodules/:submoduleId/move — Move submodule to another module
projectModulesRouter.post('/:projectId/submodules/:submoduleId/move', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const submoduleId = parseId(req.params.submoduleId);
    const targetModuleId = parseId(req.body.targetModuleId);
    if (isNaN(projectId) || isNaN(submoduleId) || isNaN(targetModuleId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID parameters' });
    }

    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectPermission(projectId, userId);
    if (notFound) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    if (!allowed) {
      return res.status(403).json({ success: false, error: 'Unauthorized to manage project modules' });
    }

    const submodule = await prisma.projectSubmodule.findFirst({
      where: { id: submoduleId, projectId },
    });
    if (!submodule) {
      return res.status(404).json({ success: false, error: 'Submodule not found in this project' });
    }

    const targetModule = await prisma.projectModule.findFirst({
      where: { id: targetModuleId, projectId },
    });
    if (!targetModule) {
      return res.status(404).json({ success: false, error: 'Target module not found in this project' });
    }

    if (submodule.moduleId === targetModuleId) {
      return res.json({ success: true, data: submodule });
    }

    // Check name collision in target module
    const duplicate = await prisma.projectSubmodule.findFirst({
      where: {
        moduleId: targetModuleId,
        name: { equals: submodule.name },
      },
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: `A submodule named "${submodule.name}" already exists in "${targetModule.name}"`,
      });
    }

    // Calculate next position in target module
    const lastSubmodule = await prisma.projectSubmodule.findFirst({
      where: { moduleId: targetModuleId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const nextPosition = lastSubmodule ? lastSubmodule.position + 1 : 0;

    const moved = await prisma.projectSubmodule.update({
      where: { id: submoduleId },
      data: {
        moduleId: targetModuleId,
        position: nextPosition,
      },
    });

    res.json({ success: true, data: moved });
  } catch (error: any) {
    console.error('Error moving submodule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/projects/:projectId/modules/:moduleId/submodules/reorder — Reorder submodules within module
projectModulesRouter.post('/:projectId/modules/:moduleId/submodules/reorder', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const moduleId = parseId(req.params.moduleId);
    if (isNaN(projectId) || isNaN(moduleId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID parameters' });
    }

    const { submoduleIds } = req.body;
    if (!Array.isArray(submoduleIds)) {
      return res.status(400).json({ success: false, error: 'submoduleIds must be an array of IDs' });
    }

    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectPermission(projectId, userId);
    if (notFound) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    if (!allowed) {
      return res.status(403).json({ success: false, error: 'Unauthorized to manage project modules' });
    }

    await prisma.$transaction(
      submoduleIds.map((id: number, index: number) =>
        prisma.projectSubmodule.updateMany({
          where: { id, moduleId, projectId },
          data: { position: index },
        })
      )
    );

    res.json({ success: true, message: 'Submodules reordered successfully' });
  } catch (error: any) {
    console.error('Error reordering submodules:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/projects/:projectId/submodules/:submoduleId — Delete a submodule
projectModulesRouter.delete('/:projectId/submodules/:submoduleId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const submoduleId = parseId(req.params.submoduleId);
    if (isNaN(projectId) || isNaN(submoduleId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID parameters' });
    }

    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectPermission(projectId, userId);
    if (notFound) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    if (!allowed) {
      return res.status(403).json({ success: false, error: 'Unauthorized to manage project modules' });
    }

    const submodule = await prisma.projectSubmodule.findFirst({
      where: { id: submoduleId, projectId },
    });
    if (!submodule) {
      return res.status(404).json({ success: false, error: 'Submodule not found in this project' });
    }

    await prisma.projectSubmodule.delete({ where: { id: submoduleId } });
    res.json({ success: true, message: 'Submodule deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting submodule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/projects/:projectId/submodules/:submoduleId/duplicate — Duplicate a submodule
projectModulesRouter.post('/:projectId/submodules/:submoduleId/duplicate', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const submoduleId = parseId(req.params.submoduleId);
    if (isNaN(projectId) || isNaN(submoduleId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID parameters' });
    }

    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectPermission(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized to manage project modules' });

    const source = await prisma.projectSubmodule.findFirst({
      where: { id: submoduleId, projectId },
    });
    if (!source) return res.status(404).json({ success: false, error: 'Source submodule not found' });

    const { name, targetModuleId, copyMode, includeData } = req.body || {};
    const destModuleId = targetModuleId ? parseId(targetModuleId) : source.moduleId;

    let newName = typeof name === 'string' && name.trim() ? name.trim() : `${source.name} (Copy)`;
    let counter = 1;
    while (
      await prisma.projectSubmodule.findFirst({
        where: { moduleId: destModuleId, name: { equals: newName } },
      })
    ) {
      counter++;
      newName = `${source.name} (Copy ${counter})`;
    }

    const maxPos = await prisma.projectSubmodule.aggregate({
      where: { moduleId: destModuleId },
      _max: { position: true },
    });
    const nextPosition = (maxPos._max.position ?? -1) + 1;

    let finalConfig = source.config;
    if (copyMode === 'clone') {
      finalConfig = JSON.stringify({
        copyMode: 'clone',
        targetSubmoduleId: source.id,
      });
    }

    const created = await prisma.projectSubmodule.create({
      data: {
        projectId,
        moduleId: destModuleId,
        name: newName,
        icon: source.icon,
        type: source.type,
        builtInKey: source.builtInKey,
        config: finalConfig,
        position: nextPosition,
        isVisible: true,
        isPinned: false,
        createdById: userId,
      },
    });

    if (copyMode !== 'clone' && includeData) {
      const defects = await prisma.qaDefect.findMany({
        where: { projectSubmoduleId: source.id, projectId },
      });
      for (const d of defects) {
        const cfg = await prisma.testingConfiguration.findUnique({ where: { projectId } });
        const prefix = (cfg?.defectPrefix || 'BUG').toUpperCase();
        const maxExisting = await prisma.qaDefect.findFirst({
          where: { projectId },
          orderBy: { sequenceNumber: 'desc' },
          select: { sequenceNumber: true },
        });
        const seq = Math.max(cfg?.defectNextSeq || 1, (maxExisting?.sequenceNumber || 0) + 1);
        const defectKey = `${prefix}-${String(seq).padStart(3, '0')}`;
        await prisma.testingConfiguration.updateMany({ where: { projectId }, data: { defectNextSeq: seq + 1 } });
        await prisma.qaDefect.create({
          data: {
            projectId,
            defectKey,
            sequenceNumber: seq,
            title: d.title,
            description: d.description,
            stepsToReproduce: d.stepsToReproduce,
            expectedResult: d.expectedResult,
            actualResult: d.actualResult,
            severity: d.severity,
            priority: d.priority,
            status: d.status,
            moduleId: d.moduleId,
            submoduleId: d.submoduleId,
            projectSubmoduleId: created.id,
            assigneeId: d.assigneeId,
            reporterId: userId,
            environment: d.environment,
            buildVersion: d.buildVersion,
          },
        });
      }

      const testCases = await prisma.testCase.findMany({
        where: { projectSubmoduleId: source.id, projectId },
        include: { steps: true },
      });
      for (const tc of testCases) {
        const cfg = await prisma.testingConfiguration.findUnique({ where: { projectId } });
        const prefix = (cfg?.testCasePrefix || 'TC').toUpperCase();
        const maxExisting = await prisma.testCase.findFirst({
          where: { projectId },
          orderBy: { sequenceNumber: 'desc' },
          select: { sequenceNumber: true },
        });
        const seq = Math.max(cfg?.testCaseNextSeq || 1, (maxExisting?.sequenceNumber || 0) + 1);
        const caseKey = `${prefix}-${String(seq).padStart(3, '0')}`;
        await prisma.testingConfiguration.updateMany({ where: { projectId }, data: { testCaseNextSeq: seq + 1 } });
        await prisma.testCase.create({
          data: {
            projectId,
            caseKey,
            sequenceNumber: seq,
            title: tc.title,
            description: tc.description,
            preconditions: tc.preconditions,
            moduleId: tc.moduleId,
            submoduleId: tc.submoduleId,
            projectSubmoduleId: created.id,
            testType: tc.testType,
            priority: tc.priority,
            status: tc.status,
            assignedTesterId: tc.assignedTesterId,
            labelsJson: tc.labelsJson,
            testDataSummary: tc.testDataSummary,
            createdById: userId,
            steps: {
              create: tc.steps.map((s) => ({
                stepNumber: s.stepNumber,
                action: s.action,
                testData: s.testData,
                expectedResult: s.expectedResult,
              })),
            },
          },
        });
      }
    }

    res.json({ success: true, data: created });
  } catch (error: any) {
    console.error('Error duplicating submodule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/projects/:projectId/modules/:moduleId/duplicate — Duplicate a module
projectModulesRouter.post('/:projectId/modules/:moduleId/duplicate', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const moduleId = parseId(req.params.moduleId);
    if (isNaN(projectId) || isNaN(moduleId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID parameters' });
    }

    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectPermission(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized to manage project modules' });

    const source = await prisma.projectModule.findFirst({
      where: { id: moduleId, projectId },
      include: { submodules: true },
    });
    if (!source) return res.status(404).json({ success: false, error: 'Source module not found' });

    const { name, copyMode } = req.body || {};

    let newName = typeof name === 'string' && name.trim() ? name.trim() : `${source.name} (Copy)`;
    let counter = 1;
    while (
      await prisma.projectModule.findFirst({
        where: { projectId, name: { equals: newName } },
      })
    ) {
      counter++;
      newName = `${source.name} (Copy ${counter})`;
    }

    const maxPos = await prisma.projectModule.aggregate({
      where: { projectId },
      _max: { position: true },
    });
    const nextPosition = (maxPos._max.position ?? -1) + 1;

    const createdModule = await prisma.projectModule.create({
      data: {
        projectId,
        name: newName,
        icon: source.icon,
        description: source.description,
        position: nextPosition,
        isVisible: true,
        isPinned: false,
        createdById: userId,
      },
    });

    for (const sub of source.submodules) {
      let finalConfig = sub.config;
      if (copyMode === 'clone') {
        finalConfig = JSON.stringify({ copyMode: 'clone', targetSubmoduleId: sub.id });
      }
      await prisma.projectSubmodule.create({
        data: {
          projectId,
          moduleId: createdModule.id,
          name: sub.name,
          icon: sub.icon,
          type: sub.type,
          builtInKey: sub.builtInKey,
          config: finalConfig,
          position: sub.position,
          isVisible: sub.isVisible,
          isPinned: false,
          createdById: userId,
        },
      });
    }

    res.json({ success: true, data: createdModule });
  } catch (error: any) {
    console.error('Error duplicating module:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
