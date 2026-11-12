import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { createNotification } from '../../routes/notifications.routes.js';

export const userSelectLite = {
  id: true,
  name: true,
  username: true,
  email: true,
  avatarUrl: true,
  avatarColor: true,
  avatarType: true,
  avatarId: true,
  jobTitle: true,
} as const;

export interface MasterChoiceOption {
  name: string;
  color: string;
  icon: string;
  isArchived?: boolean;
}

export interface RolePermissionRule {
  canViewTesting: boolean;
  canEditTestCases: boolean;
  canExecuteTests: boolean;
  canManageDefects: boolean;
  canManagePlansSuites: boolean;
  canManageSettings: boolean;
  canViewReports: boolean;
  canArchiveRecords: boolean;
}

export const DEFAULT_TEST_TYPES: MasterChoiceOption[] = [
  { name: 'Functional', color: '#3B82F6', icon: 'check-square', isArchived: false },
  { name: 'UI', color: '#EC4899', icon: 'layers', isArchived: false },
  { name: 'API', color: '#8B5CF6', icon: 'code', isArchived: false },
  { name: 'Integration', color: '#06B6D4', icon: 'git-fork', isArchived: false },
  { name: 'Regression', color: '#F59E0B', icon: 'rotate-ccw', isArchived: false },
  { name: 'Security', color: '#EF4444', icon: 'shield-check', isArchived: false },
  { name: 'Performance', color: '#10B981', icon: 'zap', isArchived: false },
];

export const DEFAULT_PRIORITIES: MasterChoiceOption[] = [
  { name: 'Critical', color: '#EF4444', icon: 'alert-circle', isArchived: false },
  { name: 'High', color: '#F59E0B', icon: 'flame', isArchived: false },
  { name: 'Medium', color: '#3B82F6', icon: 'circle-dot', isArchived: false },
  { name: 'Low', color: '#71717A', icon: 'clock', isArchived: false },
];

export const DEFAULT_DEFECT_SEVERITIES: MasterChoiceOption[] = [
  { name: 'Critical', color: '#EF4444', icon: 'alert-circle', isArchived: false },
  { name: 'Major', color: '#F97316', icon: 'bug', isArchived: false },
  { name: 'Moderate', color: '#F59E0B', icon: 'alert-circle', isArchived: false },
  { name: 'Minor', color: '#71717A', icon: 'circle-dot', isArchived: false },
];

export const DEFAULT_ENVIRONMENTS: MasterChoiceOption[] = [
  { name: 'Local', color: '#71717A', icon: 'terminal', isArchived: false },
  { name: 'QA', color: '#06B6D4', icon: 'shield-check', isArchived: false },
  { name: 'Staging', color: '#8B5CF6', icon: 'layers', isArchived: false },
  { name: 'UAT', color: '#F59E0B', icon: 'users', isArchived: false },
  { name: 'Production', color: '#10B981', icon: 'globe', isArchived: false },
];

export const DEFAULT_EXECUTION_STATUSES: MasterChoiceOption[] = [
  { name: 'Not Run', color: '#71717A', icon: 'circle-dot', isArchived: false },
  { name: 'Passed', color: '#10B981', icon: 'check-square', isArchived: false },
  { name: 'Failed', color: '#EF4444', icon: 'alert-circle', isArchived: false },
  { name: 'Blocked', color: '#F59E0B', icon: 'shield', isArchived: false },
  { name: 'Skipped', color: '#6366F1', icon: 'clock', isArchived: false },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, RolePermissionRule> = {
  OWNER: {
    canViewTesting: true,
    canEditTestCases: true,
    canExecuteTests: true,
    canManageDefects: true,
    canManagePlansSuites: true,
    canManageSettings: true,
    canViewReports: true,
    canArchiveRecords: true,
  },
  MANAGER: {
    canViewTesting: true,
    canEditTestCases: true,
    canExecuteTests: true,
    canManageDefects: true,
    canManagePlansSuites: true,
    canManageSettings: true,
    canViewReports: true,
    canArchiveRecords: true,
  },
  MEMBER: {
    canViewTesting: true,
    canEditTestCases: true,
    canExecuteTests: true,
    canManageDefects: true,
    canManagePlansSuites: true,
    canManageSettings: false,
    canViewReports: true,
    canArchiveRecords: false,
  },
  VIEWER: {
    canViewTesting: true,
    canEditTestCases: false,
    canExecuteTests: false,
    canManageDefects: false,
    canManagePlansSuites: false,
    canManageSettings: false,
    canViewReports: true,
    canArchiveRecords: false,
  },
};

export function parseJsonSafe<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function getOrCreateTestingConfig(projectId: number) {
  let row = await prisma.testingConfiguration.findUnique({ where: { projectId } });
  if (!row) {
    row = await prisma.testingConfiguration.create({
      data: {
        projectId,
        testCasePrefix: 'TC',
        testCaseNextSeq: 1,
        defectPrefix: 'BUG',
        defectNextSeq: 1,
        defaultEnvironment: 'Staging',
        maxAttachmentSizeBytes: 26214400,
        allowedAttachmentTypesJson: JSON.stringify([
          'image/png',
          'image/jpeg',
          'image/webp',
          'application/pdf',
          'text/plain',
          'text/csv',
          'application/json',
        ]),
        testTypesJson: JSON.stringify(DEFAULT_TEST_TYPES),
        prioritiesJson: JSON.stringify(DEFAULT_PRIORITIES),
        defectSeveritiesJson: JSON.stringify(DEFAULT_DEFECT_SEVERITIES),
        environmentsJson: JSON.stringify(DEFAULT_ENVIRONMENTS),
        executionStatusesJson: JSON.stringify(DEFAULT_EXECUTION_STATUSES),
        permissionsJson: JSON.stringify(DEFAULT_ROLE_PERMISSIONS),
      },
    });
  }
  return serializeConfig(row);
}

export function serializeConfig(row: any) {
  return {
    id: row.id,
    projectId: row.projectId,
    testCasePrefix: row.testCasePrefix || 'TC',
    testCaseNextSeq: row.testCaseNextSeq || 1,
    defectPrefix: row.defectPrefix || 'BUG',
    defectNextSeq: row.defectNextSeq || 1,
    defaultEnvironment: row.defaultEnvironment || 'Staging',
    maxAttachmentSizeBytes: row.maxAttachmentSizeBytes || 26214400,
    allowedAttachmentTypes: parseJsonSafe<string[]>(row.allowedAttachmentTypesJson, [
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/json',
    ]),
    retentionDays: row.retentionDays ?? null,
    notifyOnRunFailure: row.notifyOnRunFailure ?? true,
    notifyOnCriticalDefect: row.notifyOnCriticalDefect ?? true,
    notifyOnPlanDueSoon: row.notifyOnPlanDueSoon ?? true,
    testTypes: parseJsonSafe<MasterChoiceOption[]>(row.testTypesJson, DEFAULT_TEST_TYPES),
    priorities: parseJsonSafe<MasterChoiceOption[]>(row.prioritiesJson, DEFAULT_PRIORITIES),
    defectSeverities: parseJsonSafe<MasterChoiceOption[]>(
      row.defectSeveritiesJson,
      DEFAULT_DEFECT_SEVERITIES
    ),
    environments: parseJsonSafe<MasterChoiceOption[]>(row.environmentsJson, DEFAULT_ENVIRONMENTS),
    executionStatuses: parseJsonSafe<MasterChoiceOption[]>(
      row.executionStatusesJson,
      DEFAULT_EXECUTION_STATUSES
    ),
    rolePermissions: parseJsonSafe<Record<string, RolePermissionRule>>(
      row.permissionsJson,
      DEFAULT_ROLE_PERMISSIONS
    ),
    modulesProvisioned: Boolean(row.modulesProvisioned),
    updatedAt: row.updatedAt?.toISOString?.() || row.updatedAt,
  };
}

export async function checkTestingAccess(projectId: number, userId: number | null) {
  if (!userId) {
    return {
      allowed: false,
      unauthorized: true,
      notFound: false,
      forbidden: false,
      project: null,
      user: null,
      config: null as ReturnType<typeof serializeConfig> | null,
      permissions: {
        role: 'NONE',
        canViewTesting: false,
        canEditTestCases: false,
        canExecuteTests: false,
        canManageDefects: false,
        canManagePlansSuites: false,
        canManageSettings: false,
        canViewReports: false,
        canArchiveRecords: false,
      },
      eligibleMemberIds: new Set<number>(),
    };
  }

  const [user, project] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { ...userSelectLite, role: true },
    }),
    prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: { select: userSelectLite },
        lead: { select: userSelectLite },
        members: { include: { user: { select: userSelectLite } } },
        team: {
          include: {
            members: { include: { user: { select: userSelectLite } } },
          },
        },
        organization: {
          include: {
            members: { include: { user: { select: userSelectLite } } },
            teams: { include: { members: { include: { user: { select: userSelectLite } } } } },
          },
        },
      },
    }),
  ]);

  if (!user) {
    return {
      allowed: false,
      unauthorized: true,
      notFound: false,
      forbidden: false,
      project: null,
      user: null,
      config: null,
      permissions: {
        role: 'NONE',
        canViewTesting: false,
        canEditTestCases: false,
        canExecuteTests: false,
        canManageDefects: false,
        canManagePlansSuites: false,
        canManageSettings: false,
        canViewReports: false,
        canArchiveRecords: false,
      },
      eligibleMemberIds: new Set<number>(),
    };
  }

  if (!project) {
    return {
      allowed: false,
      unauthorized: false,
      notFound: true,
      forbidden: false,
      project: null,
      user,
      config: null,
      permissions: {
        role: 'NONE',
        canViewTesting: false,
        canEditTestCases: false,
        canExecuteTests: false,
        canManageDefects: false,
        canManagePlansSuites: false,
        canManageSettings: false,
        canViewReports: false,
        canArchiveRecords: false,
      },
      eligibleMemberIds: new Set<number>(),
    };
  }

  const isGlobalAdmin = user.role === 'ADMIN';
  const isOwner = project.ownerId === userId;
  const isLead = project.leadId === userId;
  const pm = project.members.find((m) => m.userId === userId);
  const om = project.organization?.members.find((m) => m.userId === userId);
  const tm = project.team?.members.find((m) => m.userId === userId);

  const isMember = isGlobalAdmin || isOwner || isLead || Boolean(pm) || Boolean(om) || Boolean(tm);
  if (!isMember) {
    return {
      allowed: false,
      unauthorized: false,
      notFound: false,
      forbidden: true,
      project,
      user,
      config: null,
      permissions: {
        role: 'NONE',
        canViewTesting: false,
        canEditTestCases: false,
        canExecuteTests: false,
        canManageDefects: false,
        canManagePlansSuites: false,
        canManageSettings: false,
        canViewReports: false,
        canArchiveRecords: false,
      },
      eligibleMemberIds: new Set<number>(),
    };
  }

  const config = await getOrCreateTestingConfig(projectId);

  const pmRole = (pm?.role || '').toUpperCase();
  const omRole = (om?.role || '').toUpperCase();
  const tmRole = (tm?.role || '').toUpperCase();

  const isManager =
    isGlobalAdmin ||
    isOwner ||
    isLead ||
    ['ADMIN', 'OWNER', 'LEAD', 'MANAGER', 'PROJECT_MANAGER', 'QA_MANAGER'].includes(pmRole) ||
    ['OWNER', 'ADMIN'].includes(omRole) ||
    ['OWNER', 'ADMIN', 'PROJECT_MANAGER'].includes(tmRole);

  const isViewerOnly =
    !isManager &&
    ((pm && pmRole === 'VIEWER') ||
      (!pm && !tm && om && omRole === 'VIEWER') ||
      (!pm && !om && tm && tmRole === 'VIEWER') ||
      user.role === 'VIEWER');

  const roleKey: 'OWNER' | 'MANAGER' | 'MEMBER' | 'VIEWER' = isOwner
    ? 'OWNER'
    : isManager
    ? 'MANAGER'
    : isViewerOnly
    ? 'VIEWER'
    : 'MEMBER';

  const rule =
    config.rolePermissions[roleKey] ||
    DEFAULT_ROLE_PERMISSIONS[roleKey] ||
    DEFAULT_ROLE_PERMISSIONS.MEMBER;

  const permissions = {
    role: roleKey,
    canViewTesting: rule.canViewTesting ?? true,
    canEditTestCases: rule.canEditTestCases ?? roleKey !== 'VIEWER',
    canExecuteTests: rule.canExecuteTests ?? roleKey !== 'VIEWER',
    canManageDefects: rule.canManageDefects ?? roleKey !== 'VIEWER',
    canManagePlansSuites: rule.canManagePlansSuites ?? roleKey !== 'VIEWER',
    canManageSettings:
      roleKey === 'OWNER' ? true : (rule.canManageSettings ?? roleKey === 'MANAGER'),
    canViewReports: rule.canViewReports ?? true,
    canArchiveRecords: rule.canArchiveRecords ?? (roleKey === 'OWNER' || roleKey === 'MANAGER'),
  };

  if (!permissions.canViewTesting) {
    return {
      allowed: false,
      unauthorized: false,
      notFound: false,
      forbidden: true,
      project,
      user,
      config,
      permissions,
      eligibleMemberIds: new Set<number>(),
    };
  }

  const eligibleMemberIds = new Set<number>();
  if (project.owner?.id) eligibleMemberIds.add(project.owner.id);
  if (project.lead?.id) eligibleMemberIds.add(project.lead.id);
  for (const m of project.members) eligibleMemberIds.add(m.userId);
  for (const m of project.team?.members || []) eligibleMemberIds.add(m.userId);
  for (const m of project.organization?.members || []) eligibleMemberIds.add(m.userId);
  for (const t of project.organization?.teams || []) {
    for (const tmItem of t.members || []) eligibleMemberIds.add(tmItem.userId);
  }

  return {
    allowed: true,
    unauthorized: false,
    notFound: false,
    forbidden: false,
    project,
    user,
    config,
    permissions,
    eligibleMemberIds,
  };
}

export function sendTestingAccessError(res: Response, access: Awaited<ReturnType<typeof checkTestingAccess>>) {
  if (access.unauthorized) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  if (access.notFound) {
    return res.status(404).json({ success: false, error: 'Project not found' });
  }
  return res.status(403).json({
    success: false,
    error: 'You do not have permission to access Testing & QA for this project',
  });
}

export function parsePositiveInt(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  const n = parseInt(String(val), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function recordTestingActivity(params: {
  projectId: number;
  entityType: string;
  entityId: number;
  testCaseId?: number | null;
  defectId?: number | null;
  actorId?: number | null;
  action: string;
  field?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  metadata?: Record<string, any> | null;
}) {
  try {
    await prisma.testingActivity.create({
      data: {
        projectId: params.projectId,
        entityType: params.entityType,
        entityId: params.entityId,
        testCaseId: params.testCaseId ?? null,
        defectId: params.defectId ?? null,
        actorId: params.actorId ?? null,
        action: params.action,
        field: params.field ?? null,
        previousValue: params.previousValue ?? null,
        newValue: params.newValue ?? null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  } catch (err) {
    console.warn('[TestingQA] Failed to record activity:', err);
  }
}

export async function syncRequirementTestCaseLink(
  testCaseId: number,
  newRequirementId: number | null | undefined,
  actorId?: number | null
) {
  await prisma.requirementTestCase.deleteMany({ where: { testCaseId } });
  await prisma.requirementLink.deleteMany({
    where: { targetType: 'TEST', targetId: testCaseId },
  });

  if (newRequirementId) {
    await prisma.requirementTestCase.upsert({
      where: {
        requirementId_testCaseId: {
          requirementId: newRequirementId,
          testCaseId,
        },
      },
      update: {},
      create: {
        requirementId: newRequirementId,
        testCaseId,
      },
    });
    await prisma.requirementLink.upsert({
      where: {
        requirementId_targetType_targetId: {
          requirementId: newRequirementId,
          targetType: 'TEST',
          targetId: testCaseId,
        },
      },
      update: {},
      create: {
        requirementId: newRequirementId,
        targetType: 'TEST',
        targetId: testCaseId,
        isPrimary: true,
      },
    });
  }
}

export function computeRunStats(executions: Array<{ status: string }>) {
  let passed = 0;
  let failed = 0;
  let blocked = 0;
  let skipped = 0;
  let notRun = 0;

  for (const ex of executions) {
    switch (ex.status) {
      case 'Passed':
        passed++;
        break;
      case 'Failed':
        failed++;
        break;
      case 'Blocked':
        blocked++;
        break;
      case 'Skipped':
        skipped++;
        break;
      default:
        notRun++;
        break;
    }
  }

  // Pass/Fail rate excludes Not Run, Blocked (and Skipped) from completed eligible denominator
  const eligibleCompleted = passed + failed;
  const passRate = eligibleCompleted > 0 ? Math.round((passed / eligibleCompleted) * 100) : null;
  const failRate = eligibleCompleted > 0 ? Math.round((failed / eligibleCompleted) * 100) : null;

  return {
    total: executions.length,
    passed,
    failed,
    blocked,
    skipped,
    notRun,
    eligibleCompleted,
    passRate,
    failRate,
  };
}

export async function notifyUserSafe(params: {
  recipientId: number | null | undefined;
  actorId?: number | null;
  title: string;
  message: string;
  data?: Record<string, any>;
}) {
  if (!params.recipientId) return;
  if (params.actorId && params.recipientId === params.actorId) return;
  await createNotification({
    recipientId: params.recipientId,
    type: 'SYSTEM',
    title: params.title,
    message: params.message,
    data: params.data,
  });
}

export function serializeAttachments(rows: any[]) {
  return (rows || [])
    .filter((a) => a.document && !a.document.deletedAt)
    .map((a) => ({
      linkId: a.id,
      documentId: a.documentId,
      displayName: a.document.displayName,
      originalName: a.document.originalName,
      mimeType: a.document.mimeType,
      sizeBytes: a.document.sizeBytes,
      repositoryPath: a.document.repositoryPath,
      branch: a.document.branch || null,
      uploadedById: a.uploadedById ?? null,
      createdAt: a.createdAt?.toISOString?.() || a.createdAt,
    }));
}

export function formatCsvCell(val: unknown): string {
  const s = val === null || val === undefined ? '' : String(val);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
