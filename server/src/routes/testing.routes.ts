import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getUserIdFromToken } from '../lib/auth.js';
import { GitHubDocumentStorageService } from '../services/documents/gitHubDocumentStorage.service.js';
import {
  checkTestingAccess,
  computeRunStats,
  DEFAULT_ROLE_PERMISSIONS,
  formatCsvCell,
  getOrCreateTestingConfig,
  MasterChoiceOption,
  notifyUserSafe,
  parseJsonSafe,
  parsePositiveInt,
  recordTestingActivity,
  sendTestingAccessError,
  serializeAttachments,
  serializeConfig,
  syncRequirementTestCaseLink,
  userSelectLite,
} from '../services/testing/testingHelpers.js';

export const testingRouter = Router({ mergeParams: true });

function parseId(param: string | string[] | undefined): number {
  const str = Array.isArray(param) ? param[0] : param;
  return str ? parseInt(str, 10) : NaN;
}

const VALID_TEST_CASE_STATUSES = ['Draft', 'Ready', 'Deprecated'] as const;
const VALID_EXECUTION_STATUSES = ['Not Run', 'Passed', 'Failed', 'Blocked', 'Skipped'] as const;
const VALID_STEP_STATUSES = ['Not Run', 'Passed', 'Failed', 'Blocked'] as const;
const VALID_DEFECT_STATUSES = [
  'Open',
  'In Progress',
  'Fixed',
  'Ready for Retest',
  'Verified',
  'Closed',
  'Reopened',
] as const;
const VALID_PLAN_STATUSES = ['Draft', 'Planned', 'In Progress', 'Completed', 'Cancelled'] as const;

const PRIORITY_WEIGHT: Record<string, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

const REPO_SIZE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;

// ─── COMMON SERIALIZERS ───────────────────────────────────────────────────────

function serializeTestCase(tc: any) {
  const latestExec = Array.isArray(tc.executions) && tc.executions.length > 0 ? tc.executions[0] : null;
  return {
    id: tc.id,
    projectId: tc.projectId,
    caseKey: tc.caseKey,
    sequenceNumber: tc.sequenceNumber,
    title: tc.title,
    description: tc.description ?? null,
    preconditions: tc.preconditions ?? null,
    moduleId: tc.moduleId ?? null,
    module: tc.module || null,
    submoduleId: tc.submoduleId ?? null,
    submodule: tc.submodule || null,
    testType: tc.testType,
    priority: tc.priority,
    status: tc.status,
    assignedTesterId: tc.assignedTesterId ?? null,
    assignedTester: tc.assignedTester || null,
    labels: parseJsonSafe<string[]>(tc.labelsJson, []),
    testDataSummary: tc.testDataSummary ?? null,
    linkedRequirementId: tc.linkedRequirementId ?? null,
    linkedRequirement: tc.linkedRequirement || null,
    linkedDevTaskId: tc.linkedDevTaskId ?? null,
    linkedDevTask: tc.linkedDevTask || null,
    isArchived: Boolean(tc.isArchived),
    archivedAt: tc.archivedAt?.toISOString?.() || tc.archivedAt || null,
    createdById: tc.createdById ?? null,
    createdBy: tc.createdBy || null,
    stepsCount: tc._count?.steps ?? (tc.steps ? tc.steps.length : 0),
    executionsCount: tc._count?.executions ?? 0,
    defectsCount: tc._count?.defects ?? 0,
    latestExecutionStatus: latestExec?.status || null,
    latestExecutionAt: latestExec?.completedAt?.toISOString?.() || latestExec?.createdAt?.toISOString?.() || null,
    ...(tc.steps ? { steps: tc.steps } : {}),
    ...(tc.attachments ? { attachments: serializeAttachments(tc.attachments) } : {}),
    createdAt: tc.createdAt?.toISOString?.() || tc.createdAt,
    updatedAt: tc.updatedAt?.toISOString?.() || tc.updatedAt,
  };
}

function serializeExecution(ex: any) {
  return {
    id: ex.id,
    projectId: ex.projectId,
    testRunId: ex.testRunId,
    ...(ex.testRun
      ? {
          run: {
            id: ex.testRun.id,
            runKey: ex.testRun.runKey,
            name: ex.testRun.name,
            buildVersion: ex.testRun.buildVersion ?? null,
            environment: ex.testRun.environment ?? null,
          },
        }
      : {}),
    testCaseId: ex.testCaseId ?? null,
    caseKeySnapshot: ex.caseKeySnapshot,
    caseTitleSnapshot: ex.caseTitleSnapshot,
    testTypeSnapshot: ex.testTypeSnapshot ?? null,
    prioritySnapshot: ex.prioritySnapshot ?? null,
    executedById: ex.executedById ?? null,
    executedBy: ex.executedBy || null,
    attemptNumber: ex.attemptNumber,
    isLatest: Boolean(ex.isLatest),
    status: ex.status,
    actualResult: ex.actualResult ?? null,
    notes: ex.notes ?? null,
    startedAt: ex.startedAt?.toISOString?.() || ex.startedAt || null,
    completedAt: ex.completedAt?.toISOString?.() || ex.completedAt || null,
    steps: ex.steps || [],
    attachments: ex.attachments ? serializeAttachments(ex.attachments) : [],
    linkedDefects: (ex.defectLinks || [])
      .map((l: any) => l.defect)
      .filter(Boolean)
      .map((d: any) => ({
        id: d.id,
        defectKey: d.defectKey,
        title: d.title,
        severity: d.severity,
        status: d.status,
      })),
    createdAt: ex.createdAt?.toISOString?.() || ex.createdAt,
    updatedAt: ex.updatedAt?.toISOString?.() || ex.updatedAt,
  };
}

function serializeDefect(d: any, gitLinksCount?: number) {
  return {
    id: d.id,
    projectId: d.projectId,
    defectKey: d.defectKey,
    sequenceNumber: d.sequenceNumber,
    title: d.title,
    description: d.description ?? null,
    stepsToReproduce: d.stepsToReproduce ?? null,
    expectedResult: d.expectedResult ?? null,
    actualResult: d.actualResult ?? null,
    severity: d.severity,
    priority: d.priority,
    status: d.status,
    moduleId: d.moduleId ?? null,
    module: d.module ? { id: d.module.id, name: d.module.name, slug: d.module.slug } : null,
    submoduleId: d.submoduleId ?? null,
    submodule: d.submodule ? { id: d.submodule.id, name: d.submodule.name, slug: d.submodule.slug } : null,
    assigneeId: d.assigneeId ?? null,
    assignee: d.assignee || null,
    reporterId: d.reporterId ?? null,
    reporter: d.reporter || null,
    environment: d.environment ?? null,
    buildVersion: d.buildVersion ?? null,
    linkedTestCaseId: d.linkedTestCaseId ?? null,
    linkedTestCase: d.linkedTestCase || null,
    linkedTestRunId: d.linkedTestRunId ?? null,
    linkedTestRun: d.linkedTestRun || null,
    linkedExecutionId: d.linkedExecutionId ?? null,
    linkedDevTaskId: d.linkedDevTaskId ?? null,
    linkedDevTask: d.linkedDevTask || null,
    linkedRequirementId: d.linkedRequirementId ?? null,
    linkedRequirement: d.linkedRequirement || null,
    verifiedById: d.verifiedById ?? null,
    verifiedBy: d.verifiedBy || null,
    verifiedAt: d.verifiedAt?.toISOString?.() || d.verifiedAt || null,
    reopenCount: d.reopenCount ?? 0,
    isArchived: Boolean(d.isArchived),
    archivedAt: d.archivedAt?.toISOString?.() || d.archivedAt || null,
    attachmentsCount: d._count?.attachments ?? (d.attachments ? d.attachments.length : 0),
    gitLinksCount: gitLinksCount ?? 0,
    createdAt: d.createdAt?.toISOString?.() || d.createdAt,
    updatedAt: d.updatedAt?.toISOString?.() || d.updatedAt,
  };
}

// ─── META & OVERVIEW ──────────────────────────────────────────────────────────

testingRouter.get('/meta', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    if (Number.isNaN(projectId)) return res.status(400).json({ success: false, error: 'Invalid project ID' });
    const access = await checkTestingAccess(projectId, getUserIdFromToken(req));
    if (!access.allowed || !access.project) return sendTestingAccessError(res, access);

    const eligibleIds = Array.from(access.eligibleMemberIds);
    const [members, teams, modules, devTasks, requirements, projectDocuments, gitRepositories] = await Promise.all([
      eligibleIds.length
        ? prisma.user.findMany({ where: { id: { in: eligibleIds } }, select: userSelectLite, orderBy: { name: 'asc' } })
        : Promise.resolve([]),
      access.project.organizationId
        ? prisma.team.findMany({
            where: { organizationId: access.project.organizationId },
            select: { id: true, name: true, color: true },
            orderBy: { name: 'asc' },
          })
        : access.project.team
        ? Promise.resolve([{ id: access.project.team.id, name: access.project.team.name, color: access.project.team.color }])
        : Promise.resolve([]),
      prisma.developmentModule.findMany({
        where: { projectId, isArchived: false },
        select: {
          id: true,
          name: true,
          color: true,
          submodules: { where: { isArchived: false }, select: { id: true, name: true }, orderBy: { position: 'asc' } },
        },
        orderBy: { position: 'asc' },
      }),
      prisma.developmentTask.findMany({
        where: { projectId },
        select: { id: true, taskKey: true, title: true, status: true, priority: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.requirement.findMany({
        where: { projectId },
        select: { id: true, code: true, title: true, workflowStatus: true, priority: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.projectDocument.findMany({
        where: { projectId, deletedAt: null },
        select: {
          id: true,
          displayName: true,
          mimeType: true,
          sizeBytes: true,
          repositoryPath: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.gitRepositoryConnection.findMany({
        where: { projectId },
        select: {
          id: true,
          name: true,
          fullName: true,
          defaultBranch: true,
          webUrl: true,
          providerConnection: { select: { provider: true } },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        permissions: access.permissions,
        config: access.config,
        meta: {
          members,
          teams,
          modules,
          devTasks,
          requirements,
          projectDocuments: projectDocuments.map((d) => ({
            ...d,
            createdAt: d.createdAt.toISOString(),
          })),
          gitRepositories: gitRepositories.map((r) => ({
            id: r.id,
            name: r.name,
            fullName: r.fullName,
            defaultBranch: r.defaultBranch,
            webUrl: r.webUrl,
            provider: r.providerConnection?.provider || 'github',
          })),
        },
      },
    });
  } catch (err: any) {
    console.error('[TestingQA] /meta error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load Testing & QA metadata' });
  }
});

testingRouter.get('/overview', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    if (Number.isNaN(projectId)) return res.status(400).json({ success: false, error: 'Invalid project ID' });
    const access = await checkTestingAccess(projectId, getUserIdFromToken(req));
    if (!access.allowed) return sendTestingAccessError(res, access);

    const [
      totalTestCases,
      latestExecutions,
      defects,
      recentRunsRaw,
      upcomingPlansRaw,
      requirements,
      devTasks,
    ] = await Promise.all([
      prisma.testCase.count({ where: { projectId, isArchived: false } }),
      prisma.testExecution.findMany({
        where: { projectId, isLatest: true, testRun: { isArchived: false } },
        select: { id: true, status: true, testCaseId: true },
      }),
      prisma.qaDefect.findMany({
        where: { projectId, isArchived: false },
        include: {
          assignee: { select: userSelectLite },
          reporter: { select: userSelectLite },
          linkedTestCase: { select: { id: true, caseKey: true, title: true } },
          linkedTestRun: { select: { id: true, runKey: true, name: true } },
          linkedDevTask: { select: { id: true, taskKey: true, title: true, status: true, priority: true } },
          linkedRequirement: { select: { id: true, code: true, title: true, workflowStatus: true, priority: true } },
          _count: { select: { attachments: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.testRun.findMany({
        where: { projectId, isArchived: false },
        include: {
          testPlan: { select: { id: true, planKey: true, title: true } },
          testSuite: { select: { id: true, suiteKey: true, name: true } },
          executedBy: { select: userSelectLite },
          executions: { where: { isLatest: true }, select: { status: true } },
          _count: { select: { defects: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      prisma.testPlan.findMany({
        where: {
          projectId,
          isArchived: false,
          status: { in: ['Draft', 'Planned', 'In Progress'] },
        },
        include: {
          responsibleTester: { select: userSelectLite },
          responsibleTeam: { select: { id: true, name: true, color: true } },
          suites: true,
          cases: true,
          runs: {
            where: { isArchived: false },
            include: {
              executions: { where: { isLatest: true }, select: { status: true } },
            },
          },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        take: 6,
      }),
      prisma.requirement.findMany({
        where: { projectId },
        select: {
          id: true,
          code: true,
          title: true,
          testCases: {
            where: { isArchived: false },
            select: {
              id: true,
              executions: {
                where: { isLatest: true },
                orderBy: { updatedAt: 'desc' },
                take: 1,
                select: { status: true },
              },
            },
          },
          qaDefects: {
            where: { isArchived: false, status: { notIn: ['Verified', 'Closed'] } },
            select: { id: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      prisma.developmentTask.findMany({
        where: { projectId },
        select: {
          id: true,
          taskKey: true,
          title: true,
          status: true,
          testCases: { where: { isArchived: false }, select: { id: true } },
          qaDefects: { where: { isArchived: false }, select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
    ]);

    const execStats = computeRunStats(latestExecutions);
    const closedStatuses = new Set(['Verified', 'Closed']);
    const openDefects = defects.filter((d) => !closedStatuses.has(d.status));
    const criticalDefects = openDefects.filter((d) => d.severity === 'Critical').length;

    const sevCounts = {
      Critical: defects.filter((d) => d.severity === 'Critical').length,
      Major: defects.filter((d) => d.severity === 'Major').length,
      Moderate: defects.filter((d) => d.severity === 'Moderate').length,
      Minor: defects.filter((d) => d.severity === 'Minor').length,
    };

    const coveredReqs = requirements.filter((r) => r.testCases.length > 0);
    const coveredTasks = devTasks.filter((t) => t.testCases.length > 0);

    return res.json({
      success: true,
      data: {
        permissions: access.permissions,
        config: access.config,
        summary: {
          totalTestCases,
          passedTests: execStats.passed,
          failedTests: execStats.failed,
          notRunTests: execStats.notRun,
          blockedTests: execStats.blocked,
          skippedTests: execStats.skipped,
          openDefects: openDefects.length,
          criticalDefects,
          eligibleCompletedExecutions: execStats.eligibleCompleted,
          overallPassRate: execStats.passRate,
          overallFailRate: execStats.failRate,
          totalPlans: await prisma.testPlan.count({ where: { projectId, isArchived: false } }),
          totalRuns: await prisma.testRun.count({ where: { projectId, isArchived: false } }),
        },
        resultsByStatus: [
          { status: 'Passed', count: execStats.passed, color: '#10B981' },
          { status: 'Failed', count: execStats.failed, color: '#EF4444' },
          { status: 'Blocked', count: execStats.blocked, color: '#F59E0B' },
          { status: 'Skipped', count: execStats.skipped, color: '#6366F1' },
          { status: 'Not Run', count: execStats.notRun, color: '#71717A' },
        ],
        defectsBySeverity: [
          { severity: 'Critical', count: sevCounts.Critical, color: '#EF4444' },
          { severity: 'Major', count: sevCounts.Major, color: '#F97316' },
          { severity: 'Moderate', count: sevCounts.Moderate, color: '#F59E0B' },
          { severity: 'Minor', count: sevCounts.Minor, color: '#71717A' },
        ],
        recentRuns: recentRunsRaw.map((r) => ({
          id: r.id,
          projectId: r.projectId,
          runKey: r.runKey,
          name: r.name,
          description: r.description,
          testPlanId: r.testPlanId,
          testPlan: r.testPlan,
          testSuiteId: r.testSuiteId,
          testSuite: r.testSuite,
          buildVersion: r.buildVersion,
          environment: r.environment,
          executedById: r.executedById,
          executedBy: r.executedBy,
          startedAt: r.startedAt?.toISOString() || null,
          completedAt: r.completedAt?.toISOString() || null,
          status: r.status,
          isArchived: r.isArchived,
          stats: computeRunStats(r.executions),
          defectsCount: r._count.defects,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
        upcomingPlans: upcomingPlansRaw.map((p) => {
          const allExecs = p.runs.flatMap((run) => run.executions);
          const s = computeRunStats(allExecs);
          return {
            id: p.id,
            projectId: p.projectId,
            planKey: p.planKey,
            title: p.title,
            description: p.description,
            testingScope: p.testingScope,
            targetVersion: p.targetVersion,
            targetEnvironment: p.targetEnvironment,
            startDate: p.startDate?.toISOString() || null,
            dueDate: p.dueDate?.toISOString() || null,
            responsibleTesterId: p.responsibleTesterId,
            responsibleTester: p.responsibleTester,
            responsibleTeamId: p.responsibleTeamId,
            responsibleTeam: p.responsibleTeam,
            milestoneLabel: p.milestoneLabel,
            status: p.status,
            isArchived: p.isArchived,
            suitesCount: p.suites.length,
            directCasesCount: p.cases.length,
            uniqueCaseCount: p.cases.length,
            progress: {
              totalRuns: p.runs.length,
              totalExecutions: s.total,
              passed: s.passed,
              failed: s.failed,
              blocked: s.blocked,
              skipped: s.skipped,
              notRun: s.notRun,
              passRate: s.passRate,
            },
            defectsCount: 0,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
          };
        }),
        recentDefects: defects.slice(0, 6).map((d) => serializeDefect(d)),
        requirementCoverage: {
          totalRequirements: requirements.length,
          coveredRequirements: coveredReqs.length,
          coveragePercent:
            requirements.length > 0 ? Math.round((coveredReqs.length / requirements.length) * 100) : null,
          items: requirements.map((r) => ({
            id: r.id,
            code: r.code,
            title: r.title,
            testCasesCount: r.testCases.length,
            passedCount: r.testCases.filter((tc) => tc.executions[0]?.status === 'Passed').length,
            failedCount: r.testCases.filter((tc) => tc.executions[0]?.status === 'Failed').length,
            openDefectsCount: r.qaDefects.length,
          })),
        },
        devTaskCoverage: {
          totalDevTasks: devTasks.length,
          coveredDevTasks: coveredTasks.length,
          coveragePercent:
            devTasks.length > 0 ? Math.round((coveredTasks.length / devTasks.length) * 100) : null,
          items: devTasks.map((t) => ({
            id: t.id,
            taskKey: t.taskKey,
            title: t.title,
            status: t.status,
            testCasesCount: t.testCases.length,
            defectsCount: t.qaDefects.length,
          })),
        },
      },
    });
  } catch (err: any) {
    console.error('[TestingQA] /overview error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load Testing overview' });
  }
});

// ─── TEST CASES ───────────────────────────────────────────────────────────────

const stepInputSchema = z.object({
  id: z.number().int().positive().optional(),
  stepNumber: z.number().int().positive().optional(),
  action: z.string().trim().min(1, 'Step action is required'),
  testData: z.string().trim().optional().nullable(),
  expectedResult: z.string().trim().optional().nullable(),
});

const createTestCaseSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(300),
  description: z.string().optional().nullable(),
  preconditions: z.string().optional().nullable(),
  moduleId: z.number().int().positive().optional().nullable(),
  submoduleId: z.number().int().positive().optional().nullable(),
  testType: z.string().trim().min(1).max(60).optional().default('Functional'),
  priority: z.string().trim().min(1).max(40).optional().default('Medium'),
  status: z.enum(VALID_TEST_CASE_STATUSES).optional().default('Draft'),
  assignedTesterId: z.number().int().positive().optional().nullable(),
  labels: z.array(z.string().trim().max(40)).optional().default([]),
  testDataSummary: z.string().optional().nullable(),
  linkedRequirementId: z.number().int().positive().optional().nullable(),
  linkedDevTaskId: z.number().int().positive().optional().nullable(),
  steps: z.array(stepInputSchema).optional().default([]),
  attachmentDocumentIds: z.array(z.number().int().positive()).optional().default([]),
});

const updateTestCaseSchema = createTestCaseSchema.partial();

testingRouter.get('/test-cases', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    if (Number.isNaN(projectId)) return res.status(400).json({ success: false, error: 'Invalid project ID' });
    const access = await checkTestingAccess(projectId, getUserIdFromToken(req));
    if (!access.allowed) return sendTestingAccessError(res, access);

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const testType = typeof req.query.testType === 'string' ? req.query.testType.trim() : '';
    const priority = typeof req.query.priority === 'string' ? req.query.priority.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const testerId = parsePositiveInt(req.query.testerId);
    const linkedRequirementId = parsePositiveInt(req.query.linkedRequirementId);
    const linkedDevTaskId = parsePositiveInt(req.query.linkedDevTaskId);
    const includeArchived = req.query.includeArchived === 'true';
    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'updatedAt';
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';

    const where: any = { projectId };
    if (!includeArchived) where.isArchived = false;
    if (testType && testType !== 'all') where.testType = testType;
    if (priority && priority !== 'all') where.priority = priority;
    if (status && status !== 'all') where.status = status;
    if (testerId) where.assignedTesterId = testerId;
    if (linkedRequirementId) where.linkedRequirementId = linkedRequirementId;
    if (linkedDevTaskId) where.linkedDevTaskId = linkedDevTaskId;
    if (search) {
      where.OR = [
        { caseKey: { contains: search } },
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const orderBy: any =
      sortBy === 'title'
        ? { title: sortDir }
        : sortBy === 'createdAt'
        ? { createdAt: sortDir }
        : { updatedAt: sortDir };

    const rows = await prisma.testCase.findMany({
      where,
      include: {
        module: { select: { id: true, name: true, color: true, icon: true } },
        submodule: { select: { id: true, name: true, icon: true } },
        assignedTester: { select: userSelectLite },
        createdBy: { select: userSelectLite },
        linkedRequirement: { select: { id: true, code: true, title: true, workflowStatus: true, priority: true } },
        linkedDevTask: { select: { id: true, taskKey: true, title: true, status: true, priority: true } },
        executions: {
          where: { isLatest: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true, completedAt: true, createdAt: true },
        },
        _count: { select: { steps: true, executions: true, defects: true } },
      },
      orderBy,
    });

    if (sortBy === 'priority') {
      rows.sort((a, b) => {
        const diff = (PRIORITY_WEIGHT[a.priority] || 0) - (PRIORITY_WEIGHT[b.priority] || 0);
        return sortDir === 'asc' ? diff : -diff;
      });
    }

    return res.json({
      success: true,
      data: {
        permissions: access.permissions,
        items: rows.map(serializeTestCase),
      },
    });
  } catch (err: any) {
    console.error('[TestingQA] GET /test-cases error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load test cases' });
  }
});

async function getTestCaseDetailPayload(projectId: number, caseId: number) {
  const tc = await prisma.testCase.findFirst({
    where: { id: caseId, projectId },
    include: {
      module: { select: { id: true, name: true, color: true, icon: true } },
      submodule: { select: { id: true, name: true, icon: true } },
      assignedTester: { select: userSelectLite },
      createdBy: { select: userSelectLite },
      linkedRequirement: { select: { id: true, code: true, title: true, workflowStatus: true, priority: true } },
      linkedDevTask: { select: { id: true, taskKey: true, title: true, status: true, priority: true } },
      steps: { orderBy: { stepNumber: 'asc' } },
      attachments: { include: { document: true }, orderBy: { createdAt: 'desc' } },
      suiteCases: {
        include: { suite: { select: { id: true, suiteKey: true, name: true, status: true } } },
      },
      executions: {
        include: {
          testRun: { select: { id: true, runKey: true, name: true, buildVersion: true, environment: true } },
          executedBy: { select: userSelectLite },
          steps: { orderBy: { stepNumber: 'asc' } },
          attachments: { include: { document: true } },
          defectLinks: {
            include: { defect: { select: { id: true, defectKey: true, title: true, severity: true, status: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      defects: {
        where: { isArchived: false },
        include: {
          assignee: { select: userSelectLite },
          reporter: { select: userSelectLite },
        },
        orderBy: { createdAt: 'desc' },
      },
      activities: {
        include: { actor: { select: userSelectLite } },
        orderBy: { createdAt: 'desc' },
        take: 40,
      },
      _count: { select: { steps: true, executions: true, defects: true } },
    },
  });
  if (!tc) return null;
  const base = serializeTestCase(tc);
  return {
    ...base,
    steps: tc.steps,
    attachments: serializeAttachments(tc.attachments),
    suites: tc.suiteCases.map((sc) => sc.suite),
    executionHistory: tc.executions.map(serializeExecution),
    linkedDefects: tc.defects.map((d) => serializeDefect(d)),
    activities: tc.activities.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

testingRouter.get('/test-cases/:caseId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const caseId = parseId(req.params.caseId);
    if (Number.isNaN(projectId) || Number.isNaN(caseId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID' });
    }
    const access = await checkTestingAccess(projectId, getUserIdFromToken(req));
    if (!access.allowed) return sendTestingAccessError(res, access);

    const detail = await getTestCaseDetailPayload(projectId, caseId);
    if (!detail) return res.status(404).json({ success: false, error: 'Test case not found' });
    return res.json({ success: true, data: detail });
  } catch (err: any) {
    console.error('[TestingQA] GET /test-cases/:caseId error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load test case details' });
  }
});

testingRouter.post('/test-cases', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    if (Number.isNaN(projectId)) return res.status(400).json({ success: false, error: 'Invalid project ID' });
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed || !access.config) return sendTestingAccessError(res, access);
    if (!access.permissions.canEditTestCases) {
      return res.status(403).json({ success: false, error: 'You do not have permission to create test cases' });
    }

    const parsed = createTestCaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues[0]?.message || 'Validation failed',
      });
    }
    const data = parsed.data;

    if (data.assignedTesterId && !access.eligibleMemberIds.has(data.assignedTesterId)) {
      return res.status(400).json({ success: false, error: 'Assigned tester is not a member of this project' });
    }
    if (data.moduleId) {
      const mod = await prisma.developmentModule.findFirst({ where: { id: data.moduleId, projectId } });
      if (!mod) return res.status(400).json({ success: false, error: 'Selected module does not belong to this project' });
    }
    if (data.submoduleId) {
      const sub = await prisma.developmentSubmodule.findFirst({ where: { id: data.submoduleId, projectId } });
      if (!sub) return res.status(400).json({ success: false, error: 'Selected submodule does not belong to this project' });
    }
    if (data.linkedRequirementId) {
      const rq = await prisma.requirement.findFirst({ where: { id: data.linkedRequirementId, projectId } });
      if (!rq) return res.status(400).json({ success: false, error: 'Linked requirement does not belong to this project' });
    }
    if (data.linkedDevTaskId) {
      const dt = await prisma.developmentTask.findFirst({ where: { id: data.linkedDevTaskId, projectId } });
      if (!dt) return res.status(400).json({ success: false, error: 'Linked development task does not belong to this project' });
    }

    const created = await prisma.$transaction(async (tx) => {
      const cfg = await tx.testingConfiguration.findUnique({ where: { projectId } });
      const prefix = (cfg?.testCasePrefix || 'TC').toUpperCase();
      const maxExisting = await tx.testCase.findFirst({
        where: { projectId },
        orderBy: { sequenceNumber: 'desc' },
        select: { sequenceNumber: true },
      });
      const seq = Math.max(cfg?.testCaseNextSeq || 1, (maxExisting?.sequenceNumber || 0) + 1);
      const caseKey = `${prefix}-${String(seq).padStart(3, '0')}`;

      await tx.testingConfiguration.updateMany({
        where: { projectId },
        data: { testCaseNextSeq: seq + 1 },
      });

      const tc = await tx.testCase.create({
        data: {
          projectId,
          caseKey,
          sequenceNumber: seq,
          title: data.title,
          description: data.description ?? null,
          preconditions: data.preconditions ?? null,
          moduleId: data.moduleId ?? null,
          submoduleId: data.submoduleId ?? null,
          testType: data.testType,
          priority: data.priority,
          status: data.status,
          assignedTesterId: data.assignedTesterId ?? null,
          labelsJson: JSON.stringify(data.labels || []),
          testDataSummary: data.testDataSummary ?? null,
          linkedRequirementId: data.linkedRequirementId ?? null,
          linkedDevTaskId: data.linkedDevTaskId ?? null,
          createdById: userId,
          steps: {
            create: data.steps.map((s, idx) => ({
              stepNumber: idx + 1,
              action: s.action,
              testData: s.testData ?? null,
              expectedResult: s.expectedResult ?? null,
            })),
          },
        },
      });

      if (data.attachmentDocumentIds && data.attachmentDocumentIds.length > 0) {
        const docs = await tx.projectDocument.findMany({
          where: { id: { in: data.attachmentDocumentIds }, projectId, deletedAt: null },
          select: { id: true },
        });
        for (const doc of docs) {
          await tx.testCaseAttachment.create({
            data: { testCaseId: tc.id, documentId: doc.id, uploadedById: userId },
          });
        }
      }

      return tc;
    }, { maxWait: 20000, timeout: 30000 });

    await syncRequirementTestCaseLink(created.id, data.linkedRequirementId, userId);
    await recordTestingActivity({
      projectId,
      entityType: 'test_case',
      entityId: created.id,
      testCaseId: created.id,
      actorId: userId,
      action: 'created',
      newValue: `${created.caseKey}: ${created.title}`,
    });

    if (data.assignedTesterId) {
      await notifyUserSafe({
        recipientId: data.assignedTesterId,
        actorId: userId,
        title: `Assigned Test Case ${created.caseKey}`,
        message: `${access.user?.name || 'A teammate'} assigned test case "${created.title}" to you.`,
        data: { projectId, entityType: 'test_case', entityId: created.id },
      });
    }

    const detail = await getTestCaseDetailPayload(projectId, created.id);
    return res.status(201).json({ success: true, data: detail });
  } catch (err: any) {
    console.error('[TestingQA] POST /test-cases error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to create test case' });
  }
});

testingRouter.patch('/test-cases/:caseId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const caseId = parseId(req.params.caseId);
    if (Number.isNaN(projectId) || Number.isNaN(caseId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID' });
    }
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canEditTestCases) {
      return res.status(403).json({ success: false, error: 'You do not have permission to edit test cases' });
    }

    const existing = await prisma.testCase.findFirst({ where: { id: caseId, projectId } });
    if (!existing) return res.status(404).json({ success: false, error: 'Test case not found' });

    const parsed = updateTestCaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues[0]?.message || 'Validation failed',
      });
    }
    const data = parsed.data;

    if (data.assignedTesterId && !access.eligibleMemberIds.has(data.assignedTesterId)) {
      return res.status(400).json({ success: false, error: 'Assigned tester is not a member of this project' });
    }
    if (data.linkedRequirementId) {
      const rq = await prisma.requirement.findFirst({ where: { id: data.linkedRequirementId, projectId } });
      if (!rq) return res.status(400).json({ success: false, error: 'Linked requirement does not belong to this project' });
    }
    if (data.linkedDevTaskId) {
      const dt = await prisma.developmentTask.findFirst({ where: { id: data.linkedDevTaskId, projectId } });
      if (!dt) return res.status(400).json({ success: false, error: 'Linked development task does not belong to this project' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.testCase.update({
        where: { id: caseId },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.preconditions !== undefined && { preconditions: data.preconditions }),
          ...(data.moduleId !== undefined && { moduleId: data.moduleId }),
          ...(data.submoduleId !== undefined && { submoduleId: data.submoduleId }),
          ...(data.testType !== undefined && { testType: data.testType }),
          ...(data.priority !== undefined && { priority: data.priority }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.assignedTesterId !== undefined && { assignedTesterId: data.assignedTesterId }),
          ...(data.labels !== undefined && { labelsJson: JSON.stringify(data.labels) }),
          ...(data.testDataSummary !== undefined && { testDataSummary: data.testDataSummary }),
          ...(data.linkedRequirementId !== undefined && { linkedRequirementId: data.linkedRequirementId }),
          ...(data.linkedDevTaskId !== undefined && { linkedDevTaskId: data.linkedDevTaskId }),
        },
      });

      if (data.steps !== undefined) {
        // Replaces definition steps only; historical TestExecutionStep snapshots remain completely untouched!
        await tx.testCaseStep.deleteMany({ where: { testCaseId: caseId } });
        if (data.steps.length > 0) {
          await tx.testCaseStep.createMany({
            data: data.steps.map((s, idx) => ({
              testCaseId: caseId,
              stepNumber: idx + 1,
              action: s.action,
              testData: s.testData ?? null,
              expectedResult: s.expectedResult ?? null,
            })),
          });
        }
      }
    });

    if (data.linkedRequirementId !== undefined) {
      await syncRequirementTestCaseLink(caseId, data.linkedRequirementId, userId);
    }

    await recordTestingActivity({
      projectId,
      entityType: 'test_case',
      entityId: caseId,
      testCaseId: caseId,
      actorId: userId,
      action: 'updated',
      newValue: data.status && data.status !== existing.status ? `Status -> ${data.status}` : existing.caseKey,
    });

    const detail = await getTestCaseDetailPayload(projectId, caseId);
    return res.json({ success: true, data: detail });
  } catch (err: any) {
    console.error('[TestingQA] PATCH /test-cases/:caseId error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update test case' });
  }
});

testingRouter.post('/test-cases/:caseId/duplicate', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const caseId = parseId(req.params.caseId);
    if (Number.isNaN(projectId) || Number.isNaN(caseId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID' });
    }
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canEditTestCases) {
      return res.status(403).json({ success: false, error: 'You do not have permission to duplicate test cases' });
    }

    const source = await prisma.testCase.findFirst({
      where: { id: caseId, projectId },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
    });
    if (!source) return res.status(404).json({ success: false, error: 'Test case not found' });

    const created = await prisma.$transaction(async (tx) => {
      const cfg = await tx.testingConfiguration.findUnique({ where: { projectId } });
      const prefix = (cfg?.testCasePrefix || 'TC').toUpperCase();
      const maxExisting = await tx.testCase.findFirst({
        where: { projectId },
        orderBy: { sequenceNumber: 'desc' },
        select: { sequenceNumber: true },
      });
      const seq = Math.max(cfg?.testCaseNextSeq || 1, (maxExisting?.sequenceNumber || 0) + 1);
      const caseKey = `${prefix}-${String(seq).padStart(3, '0')}`;
      await tx.testingConfiguration.updateMany({ where: { projectId }, data: { testCaseNextSeq: seq + 1 } });

      return tx.testCase.create({
        data: {
          projectId,
          caseKey,
          sequenceNumber: seq,
          title: `${source.title} (Copy)`,
          description: source.description,
          preconditions: source.preconditions,
          moduleId: source.moduleId,
          submoduleId: source.submoduleId,
          testType: source.testType,
          priority: source.priority,
          status: 'Draft',
          assignedTesterId: source.assignedTesterId,
          labelsJson: source.labelsJson,
          testDataSummary: source.testDataSummary,
          linkedRequirementId: source.linkedRequirementId,
          linkedDevTaskId: source.linkedDevTaskId,
          createdById: userId,
          steps: {
            create: source.steps.map((s, idx) => ({
              stepNumber: idx + 1,
              action: s.action,
              testData: s.testData,
              expectedResult: s.expectedResult,
            })),
          },
        },
      });
    });

    await syncRequirementTestCaseLink(created.id, created.linkedRequirementId, userId);
    const detail = await getTestCaseDetailPayload(projectId, created.id);
    return res.status(201).json({ success: true, data: detail });
  } catch (err: any) {
    console.error('[TestingQA] duplicate test case error:', err);
    return res.status(500).json({ success: false, error: 'Failed to duplicate test case' });
  }
});

testingRouter.patch('/test-cases/:caseId/archive', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const caseId = parseId(req.params.caseId);
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canArchiveRecords) {
      return res.status(403).json({ success: false, error: 'You do not have permission to archive test cases' });
    }
    const isArchived = req.body?.isArchived !== false;
    const updated = await prisma.testCase.updateMany({
      where: { id: caseId, projectId },
      data: { isArchived, archivedAt: isArchived ? new Date() : null },
    });
    if (updated.count === 0) return res.status(404).json({ success: false, error: 'Test case not found' });

    await recordTestingActivity({
      projectId,
      entityType: 'test_case',
      entityId: caseId,
      testCaseId: caseId,
      actorId: userId,
      action: isArchived ? 'archived' : 'restored',
    });

    const detail = await getTestCaseDetailPayload(projectId, caseId);
    return res.json({ success: true, data: detail });
  } catch (err: any) {
    console.error('[TestingQA] archive test case error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update archive state' });
  }
});

testingRouter.post('/test-cases/bulk', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed) return sendTestingAccessError(res, access);

    const { caseIds, action, status } = req.body || {};
    if (!Array.isArray(caseIds) || caseIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Select at least one test case' });
    }

    if (action === 'archive' || action === 'unarchive') {
      if (!access.permissions.canArchiveRecords) {
        return res.status(403).json({ success: false, error: 'No permission to archive test cases' });
      }
      const isArchived = action === 'archive';
      const r = await prisma.testCase.updateMany({
        where: { id: { in: caseIds }, projectId },
        data: { isArchived, archivedAt: isArchived ? new Date() : null },
      });
      return res.json({ success: true, data: { updatedCount: r.count } });
    }

    if (action === 'status' && typeof status === 'string' && VALID_TEST_CASE_STATUSES.includes(status as any)) {
      if (!access.permissions.canEditTestCases) {
        return res.status(403).json({ success: false, error: 'No permission to edit test cases' });
      }
      const r = await prisma.testCase.updateMany({
        where: { id: { in: caseIds }, projectId },
        data: { status },
      });
      return res.json({ success: true, data: { updatedCount: r.count } });
    }

    return res.status(400).json({ success: false, error: 'Invalid bulk action' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Bulk action failed' });
  }
});

// ─── TEST SUITES ──────────────────────────────────────────────────────────────

function serializeSuiteSummary(s: any) {
  const latestRun = Array.isArray(s.runs) && s.runs.length > 0 ? s.runs[0] : null;
  const runStats = latestRun ? computeRunStats(latestRun.executions || []) : null;
  return {
    id: s.id,
    projectId: s.projectId,
    suiteKey: s.suiteKey,
    name: s.name,
    description: s.description ?? null,
    purpose: s.purpose ?? null,
    ownerId: s.ownerId ?? null,
    owner: s.owner || null,
    status: s.status,
    labels: parseJsonSafe<string[]>(s.labelsJson, []),
    isArchived: Boolean(s.isArchived),
    archivedAt: s.archivedAt?.toISOString?.() || null,
    createdBy: s.createdBy || null,
    totalCases: s._count?.cases ?? (s.cases ? s.cases.length : 0),
    latestRun: latestRun
      ? {
          id: latestRun.id,
          runKey: latestRun.runKey,
          name: latestRun.name,
          status: latestRun.status,
          passRate: runStats?.passRate ?? null,
          passed: runStats?.passed ?? 0,
          failed: runStats?.failed ?? 0,
          total: runStats?.total ?? 0,
          createdAt: latestRun.createdAt.toISOString(),
        }
      : null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

testingRouter.get('/test-suites', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const access = await checkTestingAccess(projectId, getUserIdFromToken(req));
    if (!access.allowed) return sendTestingAccessError(res, access);

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const includeArchived = req.query.includeArchived === 'true';

    const where: any = { projectId };
    if (!includeArchived) where.isArchived = false;
    if (status && status !== 'all') where.status = status;
    if (search) {
      where.OR = [
        { suiteKey: { contains: search } },
        { name: { contains: search } },
        { purpose: { contains: search } },
      ];
    }

    const suites = await prisma.testSuite.findMany({
      where,
      include: {
        owner: { select: userSelectLite },
        createdBy: { select: userSelectLite },
        _count: { select: { cases: true } },
        runs: {
          where: { isArchived: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { executions: { where: { isLatest: true }, select: { status: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.json({
      success: true,
      data: {
        permissions: access.permissions,
        items: suites.map(serializeSuiteSummary),
      },
    });
  } catch (err: any) {
    console.error('[TestingQA] GET /test-suites error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load test suites' });
  }
});

async function getTestSuiteDetailPayload(projectId: number, suiteId: number) {
  const s = await prisma.testSuite.findFirst({
    where: { id: suiteId, projectId },
    include: {
      owner: { select: userSelectLite },
      createdBy: { select: userSelectLite },
      cases: {
        orderBy: { position: 'asc' },
        include: {
          testCase: {
            include: {
              assignedTester: { select: userSelectLite },
              executions: { where: { isLatest: true }, orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, createdAt: true } },
              _count: { select: { steps: true, executions: true, defects: true } },
            },
          },
        },
      },
      runs: {
        where: { isArchived: false },
        orderBy: { createdAt: 'desc' },
        include: {
          executedBy: { select: userSelectLite },
          executions: { where: { isLatest: true }, select: { status: true } },
          _count: { select: { defects: true } },
        },
      },
      _count: { select: { cases: true } },
    },
  });
  if (!s) return null;

  const activities = await prisma.testingActivity.findMany({
    where: { projectId, entityType: 'test_suite', entityId: suiteId },
    include: { actor: { select: userSelectLite } },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  return {
    ...serializeSuiteSummary(s),
    cases: s.cases.map((c) => ({
      linkId: c.id,
      position: c.position,
      testCase: serializeTestCase(c.testCase),
    })),
    runs: s.runs.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      runKey: r.runKey,
      name: r.name,
      description: r.description,
      testPlanId: r.testPlanId,
      testSuiteId: r.testSuiteId,
      buildVersion: r.buildVersion,
      environment: r.environment,
      executedById: r.executedById,
      executedBy: r.executedBy,
      startedAt: r.startedAt?.toISOString() || null,
      completedAt: r.completedAt?.toISOString() || null,
      status: r.status,
      isArchived: r.isArchived,
      stats: computeRunStats(r.executions),
      defectsCount: r._count.defects,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    activities: activities.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
  };
}

testingRouter.get('/test-suites/:suiteId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const suiteId = parseId(req.params.suiteId);
    const access = await checkTestingAccess(projectId, getUserIdFromToken(req));
    if (!access.allowed) return sendTestingAccessError(res, access);

    const detail = await getTestSuiteDetailPayload(projectId, suiteId);
    if (!detail) return res.status(404).json({ success: false, error: 'Test suite not found' });
    return res.json({ success: true, data: detail });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to load test suite detail' });
  }
});

testingRouter.post('/test-suites', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canManagePlansSuites) {
      return res.status(403).json({ success: false, error: 'No permission to manage test suites' });
    }

    const schema = z.object({
      name: z.string().trim().min(1, 'Suite name is required').max(200),
      description: z.string().optional().nullable(),
      purpose: z.string().optional().nullable(),
      ownerId: z.number().int().positive().optional().nullable(),
      status: z.enum(['Draft', 'Active', 'Archived']).optional().default('Active'),
      labels: z.array(z.string().trim()).optional().default([]),
      testCaseIds: z.array(z.number().int().positive()).optional().default([]),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid suite input' });
    }
    const data = parsed.data;

    const validCaseIds = data.testCaseIds.length
      ? (
          await prisma.testCase.findMany({
            where: { id: { in: data.testCaseIds }, projectId },
            select: { id: true },
          })
        ).map((c) => c.id)
      : [];

    const validSet = new Set(validCaseIds);
    const orderedIds = Array.from(new Set(data.testCaseIds.filter((id) => validSet.has(id))));

    const created = await prisma.$transaction(async (tx) => {
      const count = await tx.testSuite.count({ where: { projectId } });
      let seq = count + 1;
      let suiteKey = `TS-${String(seq).padStart(3, '0')}`;
      while (await tx.testSuite.findUnique({ where: { projectId_suiteKey: { projectId, suiteKey } } })) {
        seq++;
        suiteKey = `TS-${String(seq).padStart(3, '0')}`;
      }
      const suite = await tx.testSuite.create({
        data: {
          projectId,
          suiteKey,
          name: data.name,
          description: data.description ?? null,
          purpose: data.purpose ?? null,
          ownerId: data.ownerId ?? userId,
          status: data.status,
          labelsJson: JSON.stringify(data.labels || []),
          createdById: userId,
        },
      });
      if (orderedIds.length > 0) {
        await tx.testSuiteCase.createMany({
          data: orderedIds.map((tcId, idx) => ({
            suiteId: suite.id,
            testCaseId: tcId,
            position: idx,
            addedById: userId,
          })),
        });
      }
      return suite;
    });

    await recordTestingActivity({
      projectId,
      entityType: 'test_suite',
      entityId: created.id,
      actorId: userId,
      action: 'created',
      newValue: `${created.suiteKey}: ${created.name}`,
    });

    const detail = await getTestSuiteDetailPayload(projectId, created.id);
    return res.status(201).json({ success: true, data: detail });
  } catch (err: any) {
    console.error('[TestingQA] POST /test-suites error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create test suite' });
  }
});

testingRouter.patch('/test-suites/:suiteId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const suiteId = parseId(req.params.suiteId);
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canManagePlansSuites) {
      return res.status(403).json({ success: false, error: 'No permission to edit test suites' });
    }

    const existing = await prisma.testSuite.findFirst({ where: { id: suiteId, projectId } });
    if (!existing) return res.status(404).json({ success: false, error: 'Test suite not found' });

    const { name, description, purpose, ownerId, status, labels } = req.body || {};
    await prisma.testSuite.update({
      where: { id: suiteId },
      data: {
        ...(typeof name === 'string' && name.trim() ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
        ...(purpose !== undefined ? { purpose: purpose || null } : {}),
        ...(ownerId !== undefined ? { ownerId: parsePositiveInt(ownerId) } : {}),
        ...(typeof status === 'string' ? { status } : {}),
        ...(Array.isArray(labels) ? { labelsJson: JSON.stringify(labels) } : {}),
      },
    });

    const detail = await getTestSuiteDetailPayload(projectId, suiteId);
    return res.json({ success: true, data: detail });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to update test suite' });
  }
});

testingRouter.put('/test-suites/:suiteId/cases', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const suiteId = parseId(req.params.suiteId);
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canManagePlansSuites) {
      return res.status(403).json({ success: false, error: 'No permission to modify test suite cases' });
    }

    const existing = await prisma.testSuite.findFirst({ where: { id: suiteId, projectId } });
    if (!existing) return res.status(404).json({ success: false, error: 'Test suite not found' });

    const rawIds: number[] = Array.isArray(req.body?.testCaseIds) ? req.body.testCaseIds : [];
    const validIds = rawIds.length
      ? (
          await prisma.testCase.findMany({
            where: { id: { in: rawIds }, projectId },
            select: { id: true },
          })
        ).map((c) => c.id)
      : [];
    const validSet = new Set(validIds);
    const orderedIds = Array.from(new Set(rawIds.filter((id) => validSet.has(id))));

    await prisma.$transaction(async (tx) => {
      // Only modifies TestSuiteCase links; original TestCase rows stay intact!
      await tx.testSuiteCase.deleteMany({ where: { suiteId } });
      if (orderedIds.length > 0) {
        await tx.testSuiteCase.createMany({
          data: orderedIds.map((tcId, idx) => ({
            suiteId,
            testCaseId: tcId,
            position: idx,
            addedById: userId,
          })),
        });
      }
    });

    await recordTestingActivity({
      projectId,
      entityType: 'test_suite',
      entityId: suiteId,
      actorId: userId,
      action: 'cases_updated',
      newValue: `${orderedIds.length} test case(s)`,
    });

    const detail = await getTestSuiteDetailPayload(projectId, suiteId);
    return res.json({ success: true, data: detail });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to update suite test cases' });
  }
});

testingRouter.post('/test-suites/:suiteId/duplicate', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const suiteId = parseId(req.params.suiteId);
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canManagePlansSuites) {
      return res.status(403).json({ success: false, error: 'No permission to duplicate test suites' });
    }

    const src = await prisma.testSuite.findFirst({
      where: { id: suiteId, projectId },
      include: { cases: { orderBy: { position: 'asc' } } },
    });
    if (!src) return res.status(404).json({ success: false, error: 'Test suite not found' });

    const created = await prisma.$transaction(async (tx) => {
      let seq = (await tx.testSuite.count({ where: { projectId } })) + 1;
      let suiteKey = `TS-${String(seq).padStart(3, '0')}`;
      while (await tx.testSuite.findUnique({ where: { projectId_suiteKey: { projectId, suiteKey } } })) {
        seq++;
        suiteKey = `TS-${String(seq).padStart(3, '0')}`;
      }
      const suite = await tx.testSuite.create({
        data: {
          projectId,
          suiteKey,
          name: `${src.name} (Copy)`,
          description: src.description,
          purpose: src.purpose,
          ownerId: userId,
          status: 'Active',
          labelsJson: src.labelsJson,
          createdById: userId,
        },
      });
      if (src.cases.length > 0) {
        await tx.testSuiteCase.createMany({
          data: src.cases.map((c, idx) => ({
            suiteId: suite.id,
            testCaseId: c.testCaseId,
            position: idx,
            addedById: userId,
          })),
        });
      }
      return suite;
    });

    const detail = await getTestSuiteDetailPayload(projectId, created.id);
    return res.status(201).json({ success: true, data: detail });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to duplicate suite' });
  }
});

testingRouter.patch('/test-suites/:suiteId/archive', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const suiteId = parseId(req.params.suiteId);
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canArchiveRecords) {
      return res.status(403).json({ success: false, error: 'No permission to archive suites' });
    }
    const isArchived = req.body?.isArchived !== false;
    const updated = await prisma.testSuite.updateMany({
      where: { id: suiteId, projectId },
      data: { isArchived, archivedAt: isArchived ? new Date() : null },
    });
    if (updated.count === 0) return res.status(404).json({ success: false, error: 'Test suite not found' });
    const detail = await getTestSuiteDetailPayload(projectId, suiteId);
    return res.json({ success: true, data: detail });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to archive suite' });
  }
});

// ─── TEST PLANS ───────────────────────────────────────────────────────────────

async function resolveUniquePlanCaseIds(planId: number): Promise<number[]> {
  const plan = await prisma.testPlan.findUnique({
    where: { id: planId },
    include: {
      suites: { include: { suite: { include: { cases: { orderBy: { position: 'asc' } } } } } },
      cases: { orderBy: { position: 'asc' } },
    },
  });
  if (!plan) return [];
  const seen = new Set<number>();
  const ordered: number[] = [];
  for (const ps of plan.suites) {
    for (const sc of ps.suite.cases) {
      if (!seen.has(sc.testCaseId)) {
        seen.add(sc.testCaseId);
        ordered.push(sc.testCaseId);
      }
    }
  }
  for (const pc of plan.cases) {
    if (!seen.has(pc.testCaseId)) {
      seen.add(pc.testCaseId);
      ordered.push(pc.testCaseId);
    }
  }
  return ordered;
}

function serializePlanSummary(p: any, uniqueCaseCount: number) {
  const execs = (p.runs || []).flatMap((r: any) => r.executions || []);
  const stats = computeRunStats(execs);
  const defectsCount = (p.runs || []).reduce((acc: number, r: any) => acc + (r._count?.defects || 0), 0);
  return {
    id: p.id,
    projectId: p.projectId,
    planKey: p.planKey,
    title: p.title,
    description: p.description ?? null,
    testingScope: p.testingScope ?? null,
    targetVersion: p.targetVersion ?? null,
    targetEnvironment: p.targetEnvironment ?? null,
    startDate: p.startDate?.toISOString?.() || null,
    dueDate: p.dueDate?.toISOString?.() || null,
    responsibleTesterId: p.responsibleTesterId ?? null,
    responsibleTester: p.responsibleTester || null,
    responsibleTeamId: p.responsibleTeamId ?? null,
    responsibleTeam: p.responsibleTeam || null,
    linkedRequirementId: p.linkedRequirementId ?? null,
    linkedRequirement: p.linkedRequirement || null,
    linkedDevTaskId: p.linkedDevTaskId ?? null,
    linkedDevTask: p.linkedDevTask || null,
    milestoneLabel: p.milestoneLabel ?? null,
    status: p.status,
    isArchived: Boolean(p.isArchived),
    archivedAt: p.archivedAt?.toISOString?.() || null,
    suitesCount: p.suites?.length || 0,
    directCasesCount: p.cases?.length || 0,
    uniqueCaseCount,
    progress: {
      totalRuns: p.runs?.length || 0,
      totalExecutions: stats.total,
      passed: stats.passed,
      failed: stats.failed,
      blocked: stats.blocked,
      skipped: stats.skipped,
      notRun: stats.notRun,
      passRate: stats.passRate,
    },
    defectsCount,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

testingRouter.get('/test-plans', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const access = await checkTestingAccess(projectId, getUserIdFromToken(req));
    if (!access.allowed) return sendTestingAccessError(res, access);

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const includeArchived = req.query.includeArchived === 'true';

    const where: any = { projectId };
    if (!includeArchived) where.isArchived = false;
    if (status && status !== 'all') where.status = status;
    if (search) {
      where.OR = [
        { planKey: { contains: search } },
        { title: { contains: search } },
        { targetVersion: { contains: search } },
      ];
    }

    const plans = await prisma.testPlan.findMany({
      where,
      include: {
        responsibleTester: { select: userSelectLite },
        responsibleTeam: { select: { id: true, name: true, color: true } },
        linkedRequirement: { select: { id: true, code: true, title: true, workflowStatus: true, priority: true } },
        linkedDevTask: { select: { id: true, taskKey: true, title: true, status: true, priority: true } },
        suites: { include: { suite: { include: { cases: { select: { testCaseId: true } } } } } },
        cases: { select: { testCaseId: true } },
        runs: {
          where: { isArchived: false },
          include: {
            executions: { where: { isLatest: true }, select: { status: true } },
            _count: { select: { defects: true } },
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
    });

    const items = plans.map((p) => {
      const uniqueIds = new Set<number>();
      for (const ps of p.suites) {
        for (const sc of ps.suite.cases) uniqueIds.add(sc.testCaseId);
      }
      for (const pc of p.cases) uniqueIds.add(pc.testCaseId);
      return serializePlanSummary(p, uniqueIds.size);
    });

    return res.json({
      success: true,
      data: { permissions: access.permissions, items },
    });
  } catch (err: any) {
    console.error('[TestingQA] GET /test-plans error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load test plans' });
  }
});

async function getTestPlanDetailPayload(projectId: number, planId: number) {
  const p = await prisma.testPlan.findFirst({
    where: { id: planId, projectId },
    include: {
      responsibleTester: { select: userSelectLite },
      responsibleTeam: { select: { id: true, name: true, color: true } },
      linkedRequirement: { select: { id: true, code: true, title: true, workflowStatus: true, priority: true } },
      linkedDevTask: { select: { id: true, taskKey: true, title: true, status: true, priority: true } },
      suites: {
        include: {
          suite: {
            include: { _count: { select: { cases: true } }, cases: { select: { testCaseId: true } } },
          },
        },
      },
      cases: {
        orderBy: { position: 'asc' },
        include: {
          testCase: {
            include: {
              assignedTester: { select: userSelectLite },
              executions: { where: { isLatest: true }, orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, createdAt: true } },
              _count: { select: { steps: true, executions: true, defects: true } },
            },
          },
        },
      },
      runs: {
        where: { isArchived: false },
        orderBy: { createdAt: 'desc' },
        include: {
          executedBy: { select: userSelectLite },
          executions: { where: { isLatest: true }, select: { status: true } },
          defects: {
            where: { isArchived: false },
            include: { assignee: { select: userSelectLite }, reporter: { select: userSelectLite } },
          },
          _count: { select: { defects: true } },
        },
      },
    },
  });
  if (!p) return null;

  const uniqueIds = new Set<number>();
  for (const ps of p.suites) {
    for (const sc of ps.suite.cases) uniqueIds.add(sc.testCaseId);
  }
  for (const pc of p.cases) uniqueIds.add(pc.testCaseId);

  const defectMap = new Map<number, any>();
  for (const r of p.runs) {
    for (const d of r.defects) defectMap.set(d.id, serializeDefect(d));
  }

  const activities = await prisma.testingActivity.findMany({
    where: { projectId, entityType: 'test_plan', entityId: planId },
    include: { actor: { select: userSelectLite } },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  return {
    ...serializePlanSummary(p, uniqueIds.size),
    suites: p.suites.map((ps) => ({
      id: ps.suite.id,
      suiteKey: ps.suite.suiteKey,
      name: ps.suite.name,
      status: ps.suite.status,
      totalCases: ps.suite._count.cases,
    })),
    cases: p.cases.map((c) => serializeTestCase(c.testCase)),
    runs: p.runs.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      runKey: r.runKey,
      name: r.name,
      description: r.description,
      testPlanId: r.testPlanId,
      testSuiteId: r.testSuiteId,
      buildVersion: r.buildVersion,
      environment: r.environment,
      executedById: r.executedById,
      executedBy: r.executedBy,
      startedAt: r.startedAt?.toISOString() || null,
      completedAt: r.completedAt?.toISOString() || null,
      status: r.status,
      isArchived: r.isArchived,
      stats: computeRunStats(r.executions),
      defectsCount: r._count.defects,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    linkedDefects: Array.from(defectMap.values()),
    activities: activities.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
  };
}

testingRouter.get('/test-plans/:planId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const planId = parseId(req.params.planId);
    const access = await checkTestingAccess(projectId, getUserIdFromToken(req));
    if (!access.allowed) return sendTestingAccessError(res, access);

    const detail = await getTestPlanDetailPayload(projectId, planId);
    if (!detail) return res.status(404).json({ success: false, error: 'Test plan not found' });
    return res.json({ success: true, data: detail });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to load test plan details' });
  }
});

const planSchema = z.object({
  title: z.string().trim().min(1, 'Plan title is required').max(250),
  description: z.string().optional().nullable(),
  testingScope: z.string().optional().nullable(),
  targetVersion: z.string().optional().nullable(),
  targetEnvironment: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  responsibleTesterId: z.number().int().positive().optional().nullable(),
  responsibleTeamId: z.number().int().positive().optional().nullable(),
  linkedRequirementId: z.number().int().positive().optional().nullable(),
  linkedDevTaskId: z.number().int().positive().optional().nullable(),
  milestoneLabel: z.string().optional().nullable(),
  status: z.enum(VALID_PLAN_STATUSES).optional().default('Draft'),
  suiteIds: z.array(z.number().int().positive()).optional().default([]),
  testCaseIds: z.array(z.number().int().positive()).optional().default([]),
});

testingRouter.post('/test-plans', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canManagePlansSuites) {
      return res.status(403).json({ success: false, error: 'No permission to create test plans' });
    }

    const parsed = planSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid plan input' });
    }
    const data = parsed.data;

    const startDateObj = data.startDate ? new Date(data.startDate) : null;
    const dueDateObj = data.dueDate ? new Date(data.dueDate) : null;
    if (startDateObj && dueDateObj && dueDateObj < startDateObj) {
      return res.status(400).json({ success: false, error: 'Due date cannot be earlier than start date' });
    }
    if (data.responsibleTesterId && !access.eligibleMemberIds.has(data.responsibleTesterId)) {
      return res.status(400).json({ success: false, error: 'Responsible tester does not belong to this project' });
    }

    const validSuiteIds = data.suiteIds.length
      ? (await prisma.testSuite.findMany({ where: { id: { in: data.suiteIds }, projectId }, select: { id: true } })).map(
          (s) => s.id
        )
      : [];
    const validCaseIds = data.testCaseIds.length
      ? (await prisma.testCase.findMany({ where: { id: { in: data.testCaseIds }, projectId }, select: { id: true } })).map(
          (c) => c.id
        )
      : [];

    const created = await prisma.$transaction(async (tx) => {
      let seq = (await tx.testPlan.count({ where: { projectId } })) + 1;
      let planKey = `TP-${String(seq).padStart(3, '0')}`;
      while (await tx.testPlan.findUnique({ where: { projectId_planKey: { projectId, planKey } } })) {
        seq++;
        planKey = `TP-${String(seq).padStart(3, '0')}`;
      }
      const plan = await tx.testPlan.create({
        data: {
          projectId,
          planKey,
          title: data.title,
          description: data.description ?? null,
          testingScope: data.testingScope ?? null,
          targetVersion: data.targetVersion ?? null,
          targetEnvironment: data.targetEnvironment ?? access.config?.defaultEnvironment ?? 'Staging',
          startDate: startDateObj,
          dueDate: dueDateObj,
          responsibleTesterId: data.responsibleTesterId ?? null,
          responsibleTeamId: data.responsibleTeamId ?? null,
          linkedRequirementId: data.linkedRequirementId ?? null,
          linkedDevTaskId: data.linkedDevTaskId ?? null,
          milestoneLabel: data.milestoneLabel ?? null,
          status: data.status,
          createdById: userId,
        },
      });
      if (validSuiteIds.length > 0) {
        await tx.testPlanSuite.createMany({
          data: validSuiteIds.map((suiteId) => ({ planId: plan.id, suiteId })),
        });
      }
      if (validCaseIds.length > 0) {
        await tx.testPlanCase.createMany({
          data: validCaseIds.map((testCaseId, idx) => ({ planId: plan.id, testCaseId, position: idx })),
        });
      }
      return plan;
    });

    await recordTestingActivity({
      projectId,
      entityType: 'test_plan',
      entityId: created.id,
      actorId: userId,
      action: 'created',
      newValue: `${created.planKey}: ${created.title}`,
    });

    if (data.responsibleTesterId) {
      await notifyUserSafe({
        recipientId: data.responsibleTesterId,
        actorId: userId,
        title: `Assigned Test Plan ${created.planKey}`,
        message: `You were assigned to test plan "${created.title}".`,
        data: { projectId, entityType: 'test_plan', entityId: created.id },
      });
    }

    if (access.config?.notifyOnPlanDueSoon && dueDateObj) {
      const hoursLeft = (dueDateObj.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursLeft > 0 && hoursLeft <= 48 && data.responsibleTesterId) {
        await notifyUserSafe({
          recipientId: data.responsibleTesterId,
          title: `Test Plan ${created.planKey} Due Soon`,
          message: `Test plan "${created.title}" is due within 48 hours.`,
          data: { projectId, entityType: 'test_plan', entityId: created.id },
        });
      }
    }

    const detail = await getTestPlanDetailPayload(projectId, created.id);
    return res.status(201).json({ success: true, data: detail });
  } catch (err: any) {
    console.error('[TestingQA] POST /test-plans error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create test plan' });
  }
});

testingRouter.patch('/test-plans/:planId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const planId = parseId(req.params.planId);
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canManagePlansSuites) {
      return res.status(403).json({ success: false, error: 'No permission to edit test plans' });
    }

    const existing = await prisma.testPlan.findFirst({ where: { id: planId, projectId } });
    if (!existing) return res.status(404).json({ success: false, error: 'Test plan not found' });

    const parsed = planSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid input' });
    }
    const data = parsed.data;

    const startDateObj =
      data.startDate !== undefined ? (data.startDate ? new Date(data.startDate) : null) : existing.startDate;
    const dueDateObj = data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : existing.dueDate;
    if (startDateObj && dueDateObj && dueDateObj < startDateObj) {
      return res.status(400).json({ success: false, error: 'Due date cannot be earlier than start date' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.testPlan.update({
        where: { id: planId },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.testingScope !== undefined && { testingScope: data.testingScope }),
          ...(data.targetVersion !== undefined && { targetVersion: data.targetVersion }),
          ...(data.targetEnvironment !== undefined && { targetEnvironment: data.targetEnvironment }),
          ...(data.startDate !== undefined && { startDate: startDateObj }),
          ...(data.dueDate !== undefined && { dueDate: dueDateObj }),
          ...(data.responsibleTesterId !== undefined && { responsibleTesterId: data.responsibleTesterId }),
          ...(data.responsibleTeamId !== undefined && { responsibleTeamId: data.responsibleTeamId }),
          ...(data.linkedRequirementId !== undefined && { linkedRequirementId: data.linkedRequirementId }),
          ...(data.linkedDevTaskId !== undefined && { linkedDevTaskId: data.linkedDevTaskId }),
          ...(data.milestoneLabel !== undefined && { milestoneLabel: data.milestoneLabel }),
          ...(data.status !== undefined && { status: data.status }),
        },
      });
      if (data.suiteIds !== undefined) {
        const validSuiteIds = data.suiteIds.length
          ? (
              await tx.testSuite.findMany({ where: { id: { in: data.suiteIds }, projectId }, select: { id: true } })
            ).map((s) => s.id)
          : [];
        await tx.testPlanSuite.deleteMany({ where: { planId } });
        if (validSuiteIds.length > 0) {
          await tx.testPlanSuite.createMany({ data: validSuiteIds.map((suiteId) => ({ planId, suiteId })) });
        }
      }
      if (data.testCaseIds !== undefined) {
        const validCaseIds = data.testCaseIds.length
          ? (
              await tx.testCase.findMany({ where: { id: { in: data.testCaseIds }, projectId }, select: { id: true } })
            ).map((c) => c.id)
          : [];
        await tx.testPlanCase.deleteMany({ where: { planId } });
        if (validCaseIds.length > 0) {
          await tx.testPlanCase.createMany({
            data: validCaseIds.map((testCaseId, idx) => ({ planId, testCaseId, position: idx })),
          });
        }
      }
    });

    const detail = await getTestPlanDetailPayload(projectId, planId);
    return res.json({ success: true, data: detail });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to update test plan' });
  }
});

testingRouter.patch('/test-plans/:planId/archive', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const planId = parseId(req.params.planId);
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canArchiveRecords) {
      return res.status(403).json({ success: false, error: 'No permission to archive test plans' });
    }
    const isArchived = req.body?.isArchived !== false;
    await prisma.testPlan.updateMany({
      where: { id: planId, projectId },
      data: { isArchived, archivedAt: isArchived ? new Date() : null },
    });
    const detail = await getTestPlanDetailPayload(projectId, planId);
    return res.json({ success: true, data: detail });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to archive test plan' });
  }
});

// ─── TEST RUNS & EXECUTIONS ───────────────────────────────────────────────────

async function createTestRunWithExecutions(params: {
  projectId: number;
  userId: number | null;
  name: string;
  description?: string | null;
  testPlanId?: number | null;
  testSuiteId?: number | null;
  testCaseIds: number[];
  buildVersion?: string | null;
  environment?: string | null;
  executedById?: number | null;
}) {
  const uniqueCaseIds = Array.from(new Set(params.testCaseIds));
  if (uniqueCaseIds.length === 0) {
    throw new Error('Select at least one test case to start a test run');
  }

  const cases = await prisma.testCase.findMany({
    where: { id: { in: uniqueCaseIds }, projectId: params.projectId },
    include: { steps: { orderBy: { stepNumber: 'asc' } } },
  });
  const caseById = new Map(cases.map((c) => [c.id, c]));
  const orderedCases = uniqueCaseIds.map((id) => caseById.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c));

  if (orderedCases.length === 0) {
    throw new Error('No valid project test cases were found for this run');
  }

  const run = await prisma.$transaction(async (tx) => {
    let seq = (await tx.testRun.count({ where: { projectId: params.projectId } })) + 1;
    let runKey = `TR-${String(seq).padStart(3, '0')}`;
    while (await tx.testRun.findUnique({ where: { projectId_runKey: { projectId: params.projectId, runKey } } })) {
      seq++;
      runKey = `TR-${String(seq).padStart(3, '0')}`;
    }

    const createdRun = await tx.testRun.create({
      data: {
        projectId: params.projectId,
        runKey,
        name: params.name,
        description: params.description ?? null,
        testPlanId: params.testPlanId ?? null,
        testSuiteId: params.testSuiteId ?? null,
        buildVersion: params.buildVersion ?? null,
        environment: params.environment ?? null,
        executedById: params.executedById ?? params.userId,
        startedAt: new Date(),
        status: 'In Progress',
        createdById: params.userId,
      },
    });

    for (const tc of orderedCases) {
      await tx.testExecution.create({
        data: {
          projectId: params.projectId,
          testRunId: createdRun.id,
          testCaseId: tc.id,
          caseKeySnapshot: tc.caseKey,
          caseTitleSnapshot: tc.title,
          testTypeSnapshot: tc.testType,
          prioritySnapshot: tc.priority,
          executedById: params.executedById ?? params.userId,
          attemptNumber: 1,
          isLatest: true,
          status: 'Not Run',
          steps: {
            create: tc.steps.map((s) => ({
              stepNumber: s.stepNumber,
              action: s.action,
              testData: s.testData,
              expectedResult: s.expectedResult,
              status: 'Not Run',
            })),
          },
        },
      });
    }

    if (params.testPlanId) {
      await tx.testPlan.updateMany({
        where: { id: params.testPlanId, projectId: params.projectId, status: { in: ['Draft', 'Planned'] } },
        data: { status: 'In Progress' },
      });
    }

    return createdRun;
  });

  return run;
}

async function getTestRunDetailPayload(projectId: number, runId: number, includeHistory = false) {
  const run = await prisma.testRun.findFirst({
    where: { id: runId, projectId },
    include: {
      testPlan: { select: { id: true, planKey: true, title: true } },
      testSuite: { select: { id: true, suiteKey: true, name: true } },
      executedBy: { select: userSelectLite },
      executions: {
        where: includeHistory ? {} : { isLatest: true },
        orderBy: [{ id: 'asc' }],
        include: {
          executedBy: { select: userSelectLite },
          steps: { orderBy: { stepNumber: 'asc' } },
          attachments: { include: { document: true }, orderBy: { createdAt: 'desc' } },
          defectLinks: {
            include: {
              defect: { select: { id: true, defectKey: true, title: true, severity: true, status: true } },
            },
          },
        },
      },
      defects: {
        where: { isArchived: false },
        include: {
          assignee: { select: userSelectLite },
          reporter: { select: userSelectLite },
          linkedTestCase: { select: { id: true, caseKey: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      _count: { select: { defects: true } },
    },
  });
  if (!run) return null;

  const latestExecs = includeHistory ? run.executions.filter((e) => e.isLatest) : run.executions;
  const allHistoryCount = await prisma.testExecution.count({ where: { testRunId: runId } });

  return {
    id: run.id,
    projectId: run.projectId,
    runKey: run.runKey,
    name: run.name,
    description: run.description,
    testPlanId: run.testPlanId,
    testPlan: run.testPlan,
    testSuiteId: run.testSuiteId,
    testSuite: run.testSuite,
    buildVersion: run.buildVersion,
    environment: run.environment,
    executedById: run.executedById,
    executedBy: run.executedBy,
    startedAt: run.startedAt?.toISOString() || null,
    completedAt: run.completedAt?.toISOString() || null,
    status: run.status,
    isArchived: run.isArchived,
    stats: computeRunStats(latestExecs),
    defectsCount: run._count.defects,
    allHistoryCount,
    executions: run.executions.map(serializeExecution),
    defects: run.defects.map((d) => serializeDefect(d)),
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}

testingRouter.post('/test-plans/:planId/start-run', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const planId = parseId(req.params.planId);
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canExecuteTests) {
      return res.status(403).json({ success: false, error: 'You do not have permission to start test runs' });
    }

    const plan = await prisma.testPlan.findFirst({ where: { id: planId, projectId } });
    if (!plan) return res.status(404).json({ success: false, error: 'Test plan not found' });

    const caseIds = await resolveUniquePlanCaseIds(planId);
    const { name, buildVersion, environment, executedById } = req.body || {};

    const run = await createTestRunWithExecutions({
      projectId,
      userId,
      name: (typeof name === 'string' && name.trim()) || `${plan.title} Run`,
      testPlanId: plan.id,
      buildVersion: buildVersion ?? plan.targetVersion ?? null,
      environment: environment ?? plan.targetEnvironment ?? access.config?.defaultEnvironment ?? 'Staging',
      executedById: parsePositiveInt(executedById) || plan.responsibleTesterId || userId,
      testCaseIds: caseIds,
    });

    await recordTestingActivity({
      projectId,
      entityType: 'test_run',
      entityId: run.id,
      actorId: userId,
      action: 'created',
      newValue: `${run.runKey} started from ${plan.planKey}`,
    });

    if (run.executedById) {
      await notifyUserSafe({
        recipientId: run.executedById,
        actorId: userId,
        title: `Test Run ${run.runKey} Assigned`,
        message: `Test run "${run.name}" is ready for execution.`,
        data: { projectId, entityType: 'test_run', entityId: run.id },
      });
    }

    const detail = await getTestRunDetailPayload(projectId, run.id);
    return res.status(201).json({ success: true, data: detail });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Failed to start run from plan' });
  }
});

testingRouter.get('/test-runs', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const access = await checkTestingAccess(projectId, getUserIdFromToken(req));
    if (!access.allowed) return sendTestingAccessError(res, access);

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const environment = typeof req.query.environment === 'string' ? req.query.environment.trim() : '';
    const planId = parsePositiveInt(req.query.planId);
    const includeArchived = req.query.includeArchived === 'true';

    const where: any = { projectId };
    if (!includeArchived) where.isArchived = false;
    if (status && status !== 'all') where.status = status;
    if (environment && environment !== 'all') where.environment = environment;
    if (planId) where.testPlanId = planId;
    if (search) {
      where.OR = [
        { runKey: { contains: search } },
        { name: { contains: search } },
        { buildVersion: { contains: search } },
      ];
    }

    const runs = await prisma.testRun.findMany({
      where,
      include: {
        testPlan: { select: { id: true, planKey: true, title: true } },
        testSuite: { select: { id: true, suiteKey: true, name: true } },
        executedBy: { select: userSelectLite },
        executions: { where: { isLatest: true }, select: { status: true } },
        _count: { select: { defects: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      data: {
        permissions: access.permissions,
        items: runs.map((r) => ({
          id: r.id,
          projectId: r.projectId,
          runKey: r.runKey,
          name: r.name,
          description: r.description,
          testPlanId: r.testPlanId,
          testPlan: r.testPlan,
          testSuiteId: r.testSuiteId,
          testSuite: r.testSuite,
          buildVersion: r.buildVersion,
          environment: r.environment,
          executedById: r.executedById,
          executedBy: r.executedBy,
          startedAt: r.startedAt?.toISOString() || null,
          completedAt: r.completedAt?.toISOString() || null,
          status: r.status,
          isArchived: r.isArchived,
          stats: computeRunStats(r.executions),
          defectsCount: r._count.defects,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to load test runs' });
  }
});

testingRouter.get('/test-runs/:runId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const runId = parseId(req.params.runId);
    const access = await checkTestingAccess(projectId, getUserIdFromToken(req));
    if (!access.allowed) return sendTestingAccessError(res, access);

    const detail = await getTestRunDetailPayload(projectId, runId, req.query.includeHistory === 'true');
    if (!detail) return res.status(404).json({ success: false, error: 'Test run not found' });
    return res.json({ success: true, data: detail });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to load test run detail' });
  }
});

testingRouter.post('/test-runs', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canExecuteTests) {
      return res.status(403).json({ success: false, error: 'No permission to create test runs' });
    }

    const { name, description, testPlanId, testSuiteId, testCaseIds, buildVersion, environment, executedById } =
      req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Test run name is required' });
    }

    const combinedIds: number[] = [];
    if (testPlanId) {
      const pIds = await resolveUniquePlanCaseIds(Number(testPlanId));
      combinedIds.push(...pIds);
    }
    if (testSuiteId) {
      const sc = await prisma.testSuiteCase.findMany({
        where: { suiteId: Number(testSuiteId), suite: { projectId } },
        orderBy: { position: 'asc' },
        select: { testCaseId: true },
      });
      combinedIds.push(...sc.map((s) => s.testCaseId));
    }
    if (Array.isArray(testCaseIds)) {
      combinedIds.push(...testCaseIds.map((id: any) => Number(id)).filter((n: number) => Number.isInteger(n) && n > 0));
    }

    const run = await createTestRunWithExecutions({
      projectId,
      userId,
      name: name.trim(),
      description: description || null,
      testPlanId: parsePositiveInt(testPlanId),
      testSuiteId: parsePositiveInt(testSuiteId),
      testCaseIds: combinedIds,
      buildVersion: buildVersion || null,
      environment: environment || access.config?.defaultEnvironment || 'Staging',
      executedById: parsePositiveInt(executedById) || userId,
    });

    if (run.executedById) {
      await notifyUserSafe({
        recipientId: run.executedById,
        actorId: userId,
        title: `Test Run ${run.runKey} Assigned`,
        message: `You were assigned to execute test run "${run.name}".`,
        data: { projectId, entityType: 'test_run', entityId: run.id },
      });
    }

    const detail = await getTestRunDetailPayload(projectId, run.id);
    return res.status(201).json({ success: true, data: detail });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Failed to create test run' });
  }
});

testingRouter.patch('/test-runs/:runId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const runId = parseId(req.params.runId);
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canExecuteTests) {
      return res.status(403).json({ success: false, error: 'No permission to update test run' });
    }

    const existing = await prisma.testRun.findFirst({
      where: { id: runId, projectId },
      include: { executions: { where: { isLatest: true }, select: { status: true } } },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Test run not found' });

    const { name, description, buildVersion, environment, status, isArchived } = req.body || {};
    const completing = status === 'Completed' && existing.status !== 'Completed';

    await prisma.testRun.update({
      where: { id: runId },
      data: {
        ...(typeof name === 'string' && name.trim() ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(buildVersion !== undefined ? { buildVersion } : {}),
        ...(environment !== undefined ? { environment } : {}),
        ...(typeof status === 'string' ? { status } : {}),
        ...(completing ? { completedAt: new Date() } : {}),
        ...(typeof isArchived === 'boolean' ? { isArchived, archivedAt: isArchived ? new Date() : null } : {}),
      },
    });

    if (completing && access.config?.notifyOnRunFailure) {
      const stats = computeRunStats(existing.executions);
      if (stats.failed > 0 && access.project?.ownerId) {
        await notifyUserSafe({
          recipientId: access.project.ownerId,
          actorId: userId,
          title: `Test Run ${existing.runKey} Completed with Failures`,
          message: `Test run "${existing.name}" completed with ${stats.failed} failed execution(s).`,
          data: { projectId, entityType: 'test_run', entityId: existing.id },
        });
      }
    }

    const detail = await getTestRunDetailPayload(projectId, runId);
    return res.json({ success: true, data: detail });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to update test run' });
  }
});

testingRouter.patch('/executions/:executionId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const executionId = parseId(req.params.executionId);
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canExecuteTests) {
      return res.status(403).json({ success: false, error: 'You do not have permission to execute tests' });
    }

    const existing = await prisma.testExecution.findFirst({
      where: { id: executionId, projectId },
      include: { testRun: true },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Execution record not found' });

    const { status, actualResult, notes, steps } = req.body || {};
    if (status && !VALID_EXECUTION_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid execution status' });
    }

    const isTerminal = status && status !== 'Not Run';

    await prisma.$transaction(async (tx) => {
      if (Array.isArray(steps)) {
        for (const s of steps) {
          if (!s?.id || !VALID_STEP_STATUSES.includes(s.status)) continue;
          await tx.testExecutionStep.updateMany({
            where: { id: Number(s.id), executionId },
            data: {
              status: s.status,
              ...(s.actualResult !== undefined ? { actualResult: s.actualResult ?? null } : {}),
              ...(s.notes !== undefined ? { notes: s.notes ?? null } : {}),
            },
          });
        }
      }

      await tx.testExecution.update({
        where: { id: executionId },
        data: {
          ...(status !== undefined ? { status } : {}),
          ...(actualResult !== undefined ? { actualResult: actualResult ?? null } : {}),
          ...(notes !== undefined ? { notes: notes ?? null } : {}),
          executedById: userId,
          startedAt: existing.startedAt || new Date(),
          ...(isTerminal ? { completedAt: new Date() } : status === 'Not Run' ? { completedAt: null } : {}),
        },
      });
    });

    await recordTestingActivity({
      projectId,
      entityType: 'test_execution',
      entityId: executionId,
      testCaseId: existing.testCaseId,
      actorId: userId,
      action: 'executed',
      field: 'status',
      previousValue: existing.status,
      newValue: status || existing.status,
    });

    const refreshed = await prisma.testExecution.findUnique({
      where: { id: executionId },
      include: {
        testRun: { select: { id: true, runKey: true, name: true, buildVersion: true, environment: true } },
        executedBy: { select: userSelectLite },
        steps: { orderBy: { stepNumber: 'asc' } },
        attachments: { include: { document: true } },
        defectLinks: {
          include: { defect: { select: { id: true, defectKey: true, title: true, severity: true, status: true } } },
        },
      },
    });
    return res.json({ success: true, data: serializeExecution(refreshed) });
  } catch (err: any) {
    console.error('[TestingQA] PATCH /executions/:executionId error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update execution record' });
  }
});

// Retest creates a brand new TestExecution row without overwriting previous history!
testingRouter.post('/test-runs/:runId/executions/:executionId/retest', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const runId = parseId(req.params.runId);
    const executionId = parseId(req.params.executionId);
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canExecuteTests) {
      return res.status(403).json({ success: false, error: 'No permission to retest executions' });
    }

    const prev = await prisma.testExecution.findFirst({
      where: { id: executionId, testRunId: runId, projectId },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
    });
    if (!prev) return res.status(404).json({ success: false, error: 'Execution record not found' });

    const created = await prisma.$transaction(async (tx) => {
      await tx.testExecution.updateMany({
        where: { testRunId: runId, testCaseId: prev.testCaseId, caseKeySnapshot: prev.caseKeySnapshot },
        data: { isLatest: false },
      });

      const currentCase = prev.testCaseId
        ? await tx.testCase.findUnique({
            where: { id: prev.testCaseId },
            include: { steps: { orderBy: { stepNumber: 'asc' } } },
          })
        : null;

      const stepTemplates =
        currentCase && currentCase.steps.length > 0
          ? currentCase.steps
          : prev.steps;

      return tx.testExecution.create({
        data: {
          projectId,
          testRunId: runId,
          testCaseId: prev.testCaseId,
          caseKeySnapshot: currentCase?.caseKey || prev.caseKeySnapshot,
          caseTitleSnapshot: currentCase?.title || prev.caseTitleSnapshot,
          testTypeSnapshot: currentCase?.testType || prev.testTypeSnapshot,
          prioritySnapshot: currentCase?.priority || prev.prioritySnapshot,
          executedById: userId,
          attemptNumber: prev.attemptNumber + 1,
          isLatest: true,
          status: 'Not Run',
          steps: {
            create: stepTemplates.map((s: any, idx: number) => ({
              stepNumber: idx + 1,
              action: s.action,
              testData: s.testData ?? null,
              expectedResult: s.expectedResult ?? null,
              status: 'Not Run',
            })),
          },
        },
        include: {
          testRun: { select: { id: true, runKey: true, name: true, buildVersion: true, environment: true } },
          executedBy: { select: userSelectLite },
          steps: { orderBy: { stepNumber: 'asc' } },
          attachments: { include: { document: true } },
          defectLinks: {
            include: { defect: { select: { id: true, defectKey: true, title: true, severity: true, status: true } } },
          },
        },
      });
    });

    await recordTestingActivity({
      projectId,
      entityType: 'test_execution',
      entityId: created.id,
      testCaseId: created.testCaseId,
      actorId: userId,
      action: 'retest_created',
      newValue: `Attempt #${created.attemptNumber}`,
    });

    return res.status(201).json({ success: true, data: serializeExecution(created) });
  } catch (err: any) {
    console.error('[TestingQA] retest error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create retest execution' });
  }
});

testingRouter.post('/executions/:executionId/link-defect', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const executionId = parseId(req.params.executionId);
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canManageDefects && !access.permissions.canExecuteTests) {
      return res.status(403).json({ success: false, error: 'No permission to link defects' });
    }

    const defectId = parsePositiveInt(req.body?.defectId);
    if (!defectId) return res.status(400).json({ success: false, error: 'Valid defectId is required' });

    const [ex, def] = await Promise.all([
      prisma.testExecution.findFirst({ where: { id: executionId, projectId } }),
      prisma.qaDefect.findFirst({ where: { id: defectId, projectId } }),
    ]);
    if (!ex || !def) return res.status(404).json({ success: false, error: 'Execution or defect not found' });

    await prisma.testExecutionDefect.upsert({
      where: { executionId_defectId: { executionId, defectId } },
      update: {},
      create: { executionId, defectId, linkedById: userId },
    });

    const refreshed = await prisma.testExecution.findUnique({
      where: { id: executionId },
      include: {
        testRun: { select: { id: true, runKey: true, name: true, buildVersion: true, environment: true } },
        executedBy: { select: userSelectLite },
        steps: { orderBy: { stepNumber: 'asc' } },
        attachments: { include: { document: true } },
        defectLinks: {
          include: { defect: { select: { id: true, defectKey: true, title: true, severity: true, status: true } } },
        },
      },
    });
    return res.json({ success: true, data: serializeExecution(refreshed) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to link defect to execution' });
  }
});

testingRouter.delete('/executions/:executionId/link-defect/:defectId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const executionId = parseId(req.params.executionId);
    const defectId = parseId(req.params.defectId);
    const access = await checkTestingAccess(projectId, getUserIdFromToken(req));
    if (!access.allowed) return sendTestingAccessError(res, access);

    await prisma.testExecutionDefect.deleteMany({
      where: { executionId, defectId, execution: { projectId } },
    });
    return res.json({ success: true, data: { unlinked: true } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to unlink defect' });
  }
});

// ─── DEFECTS ──────────────────────────────────────────────────────────────────

const createDefectSchema = z.object({
  title: z.string().trim().min(1, 'Defect title is required').max(300),
  description: z.string().optional().nullable(),
  stepsToReproduce: z.string().optional().nullable(),
  expectedResult: z.string().optional().nullable(),
  actualResult: z.string().optional().nullable(),
  severity: z.string().trim().min(1).default('Major'),
  priority: z.string().trim().min(1).default('High'),
  status: z.enum(VALID_DEFECT_STATUSES).optional().default('Open'),
  moduleId: z.number().int().positive().optional().nullable(),
  submoduleId: z.number().int().positive().optional().nullable(),
  assigneeId: z.number().int().positive().optional().nullable(),
  environment: z.string().optional().nullable(),
  buildVersion: z.string().optional().nullable(),
  linkedTestCaseId: z.number().int().positive().optional().nullable(),
  linkedTestRunId: z.number().int().positive().optional().nullable(),
  linkedExecutionId: z.number().int().positive().optional().nullable(),
  linkedDevTaskId: z.number().int().positive().optional().nullable(),
  linkedRequirementId: z.number().int().positive().optional().nullable(),
  attachmentDocumentIds: z.array(z.number().int().positive()).optional().default([]),
});

async function getDefectDetailPayload(projectId: number, defectId: number) {
  const d = await prisma.qaDefect.findFirst({
    where: { id: defectId, projectId },
    include: {
      assignee: { select: userSelectLite },
      reporter: { select: userSelectLite },
      verifiedBy: { select: userSelectLite },
      module: { select: { id: true, name: true, slug: true } },
      submodule: { select: { id: true, name: true, slug: true } },
      linkedTestCase: { select: { id: true, caseKey: true, title: true } },
      linkedTestRun: { select: { id: true, runKey: true, name: true } },
      linkedDevTask: { select: { id: true, taskKey: true, title: true, status: true, priority: true } },
      linkedRequirement: { select: { id: true, code: true, title: true, workflowStatus: true, priority: true } },
      attachments: { include: { document: true }, orderBy: { createdAt: 'desc' } },
      executionLinks: {
        include: {
          execution: {
            include: {
              testRun: { select: { id: true, runKey: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      activities: {
        include: { actor: { select: userSelectLite } },
        orderBy: { createdAt: 'desc' },
        take: 40,
      },
      _count: { select: { attachments: true } },
    },
  });
  if (!d) return null;

  const gitLinks = await prisma.gitRecordLink.findMany({
    where: { projectId, targetType: 'defect', targetId: defectId },
    include: { repository: { select: { id: true, fullName: true, webUrl: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return {
    ...serializeDefect(d, gitLinks.length),
    attachments: serializeAttachments(d.attachments),
    gitLinks: gitLinks.map((gl) => ({
      id: gl.id,
      repositoryId: gl.repositoryId,
      repositoryName: gl.repository.fullName,
      repositoryUrl: gl.repository.webUrl,
      provider: gl.provider,
      recordType: gl.recordType,
      recordNumber: gl.recordNumber ?? null,
      recordId: gl.recordId,
      recordTitle: gl.recordTitle ?? null,
      recordUrl: gl.recordUrl ?? null,
      createdAt: gl.createdAt.toISOString(),
    })),
    linkedExecutions: d.executionLinks.map((l) => ({
      id: l.execution.id,
      testRunId: l.execution.testRunId,
      runKey: l.execution.testRun.runKey,
      runName: l.execution.testRun.name,
      caseKeySnapshot: l.execution.caseKeySnapshot,
      caseTitleSnapshot: l.execution.caseTitleSnapshot,
      status: l.execution.status,
      attemptNumber: l.execution.attemptNumber,
      createdAt: l.execution.createdAt.toISOString(),
    })),
    activities: d.activities.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
  };
}

testingRouter.get('/defects', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const access = await checkTestingAccess(projectId, getUserIdFromToken(req));
    if (!access.allowed) return sendTestingAccessError(res, access);

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const severity = typeof req.query.severity === 'string' ? req.query.severity.trim() : '';
    const priority = typeof req.query.priority === 'string' ? req.query.priority.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const assigneeId = parsePositiveInt(req.query.assigneeId);
    const reporterId = parsePositiveInt(req.query.reporterId);
    const includeArchived = req.query.includeArchived === 'true';

    const where: any = { projectId };
    if (!includeArchived) where.isArchived = false;
    if (severity && severity !== 'all') where.severity = severity;
    if (priority && priority !== 'all') where.priority = priority;
    if (status && status !== 'all') {
      if (status === 'OPEN_GROUP') {
        where.status = { notIn: ['Verified', 'Closed'] };
      } else {
        where.status = status;
      }
    }
    if (assigneeId) where.assigneeId = assigneeId;
    if (reporterId) where.reporterId = reporterId;
    if (typeof req.query.startDate === 'string' && req.query.startDate) {
      where.createdAt = { ...(where.createdAt || {}), gte: new Date(req.query.startDate) };
    }
    if (typeof req.query.endDate === 'string' && req.query.endDate) {
      const end = new Date(req.query.endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt = { ...(where.createdAt || {}), lte: end };
    }
    if (search) {
      where.OR = [
        { defectKey: { contains: search } },
        { title: { contains: search } },
        { buildVersion: { contains: search } },
      ];
    }

    const defects = await prisma.qaDefect.findMany({
      where,
      include: {
        assignee: { select: userSelectLite },
        reporter: { select: userSelectLite },
        verifiedBy: { select: userSelectLite },
        module: { select: { id: true, name: true, slug: true } },
        submodule: { select: { id: true, name: true, slug: true } },
        linkedTestCase: { select: { id: true, caseKey: true, title: true } },
        linkedTestRun: { select: { id: true, runKey: true, name: true } },
        linkedDevTask: { select: { id: true, taskKey: true, title: true, status: true, priority: true } },
        linkedRequirement: { select: { id: true, code: true, title: true, workflowStatus: true, priority: true } },
        _count: { select: { attachments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const defectIds = defects.map((d) => d.id);
    const gitCounts = defectIds.length
      ? await prisma.gitRecordLink.groupBy({
          by: ['targetId'],
          where: { projectId, targetType: 'defect', targetId: { in: defectIds } },
          _count: { id: true },
        })
      : [];
    const gitCountMap = new Map(gitCounts.map((g) => [g.targetId, g._count.id]));

    return res.json({
      success: true,
      data: {
        permissions: access.permissions,
        items: defects.map((d) => serializeDefect(d, gitCountMap.get(d.id) || 0)),
      },
    });
  } catch (err: any) {
    console.error('[TestingQA] GET /defects error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load defects' });
  }
});

testingRouter.get('/defects/:defectId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const defectId = parseId(req.params.defectId);
    const access = await checkTestingAccess(projectId, getUserIdFromToken(req));
    if (!access.allowed) return sendTestingAccessError(res, access);

    const detail = await getDefectDetailPayload(projectId, defectId);
    if (!detail) return res.status(404).json({ success: false, error: 'Defect not found' });
    return res.json({ success: true, data: detail });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to load defect details' });
  }
});

testingRouter.post('/defects', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canManageDefects) {
      return res.status(403).json({ success: false, error: 'No permission to create defects' });
    }

    const parsed = createDefectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid defect input' });
    }
    const data = parsed.data;

    if (data.assigneeId && !access.eligibleMemberIds.has(data.assigneeId)) {
      return res.status(400).json({ success: false, error: 'Assigned developer does not belong to this project' });
    }
    if (data.linkedDevTaskId) {
      const dt = await prisma.developmentTask.findFirst({ where: { id: data.linkedDevTaskId, projectId } });
      if (!dt) return res.status(400).json({ success: false, error: 'Linked development task not found in project' });
    }

    const created = await prisma.$transaction(async (tx) => {
      const cfg = await tx.testingConfiguration.findUnique({ where: { projectId } });
      const prefix = (cfg?.defectPrefix || 'BUG').toUpperCase();
      const maxExisting = await tx.qaDefect.findFirst({
        where: { projectId },
        orderBy: { sequenceNumber: 'desc' },
        select: { sequenceNumber: true },
      });
      const seq = Math.max(cfg?.defectNextSeq || 1, (maxExisting?.sequenceNumber || 0) + 1);
      const defectKey = `${prefix}-${String(seq).padStart(3, '0')}`;
      await tx.testingConfiguration.updateMany({ where: { projectId }, data: { defectNextSeq: seq + 1 } });

      const defect = await tx.qaDefect.create({
        data: {
          projectId,
          defectKey,
          sequenceNumber: seq,
          title: data.title,
          description: data.description ?? null,
          stepsToReproduce: data.stepsToReproduce ?? null,
          expectedResult: data.expectedResult ?? null,
          actualResult: data.actualResult ?? null,
          severity: data.severity,
          priority: data.priority,
          status: data.status,
          moduleId: data.moduleId ?? null,
          submoduleId: data.submoduleId ?? null,
          assigneeId: data.assigneeId ?? null,
          reporterId: userId,
          environment: data.environment ?? access.config?.defaultEnvironment ?? 'Staging',
          buildVersion: data.buildVersion ?? null,
          linkedTestCaseId: data.linkedTestCaseId ?? null,
          linkedTestRunId: data.linkedTestRunId ?? null,
          linkedExecutionId: data.linkedExecutionId ?? null,
          linkedDevTaskId: data.linkedDevTaskId ?? null,
          linkedRequirementId: data.linkedRequirementId ?? null,
        },
      });

      if (data.linkedExecutionId) {
        await tx.testExecutionDefect.upsert({
          where: { executionId_defectId: { executionId: data.linkedExecutionId, defectId: defect.id } },
          update: {},
          create: { executionId: data.linkedExecutionId, defectId: defect.id, linkedById: userId },
        });
      }

      if (data.attachmentDocumentIds && data.attachmentDocumentIds.length > 0) {
        const docs = await tx.projectDocument.findMany({
          where: { id: { in: data.attachmentDocumentIds }, projectId, deletedAt: null },
          select: { id: true },
        });
        for (const doc of docs) {
          await tx.qaDefectAttachment.create({
            data: { defectId: defect.id, documentId: doc.id, uploadedById: userId },
          });
        }
      }

      return defect;
    }, { maxWait: 20000, timeout: 30000 });

    await recordTestingActivity({
      projectId,
      entityType: 'defect',
      entityId: created.id,
      defectId: created.id,
      testCaseId: created.linkedTestCaseId,
      actorId: userId,
      action: 'created',
      newValue: `${created.defectKey}: ${created.title} (${created.severity})`,
    });

    if (data.severity === 'Critical' && access.config?.notifyOnCriticalDefect && access.project?.ownerId) {
      await notifyUserSafe({
        recipientId: access.project.ownerId,
        actorId: userId,
        title: `Critical Defect ${created.defectKey}`,
        message: `${access.user?.name || 'Tester'} reported critical defect "${created.title}".`,
        data: { projectId, entityType: 'defect', entityId: created.id },
      });
    }
    if (data.assigneeId) {
      await notifyUserSafe({
        recipientId: data.assigneeId,
        actorId: userId,
        title: `Assigned Defect ${created.defectKey}`,
        message: `You were assigned defect "${created.title}" (${created.severity}).`,
        data: { projectId, entityType: 'defect', entityId: created.id },
      });
    }

    const detail = await getDefectDetailPayload(projectId, created.id);
    return res.status(201).json({ success: true, data: detail });
  } catch (err: any) {
    console.error('[TestingQA] POST /defects error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create defect' });
  }
});

testingRouter.patch('/defects/:defectId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const defectId = parseId(req.params.defectId);
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canManageDefects) {
      return res.status(403).json({ success: false, error: 'No permission to update defects' });
    }

    const existing = await prisma.qaDefect.findFirst({ where: { id: defectId, projectId } });
    if (!existing) return res.status(404).json({ success: false, error: 'Defect not found' });

    const body = req.body || {};
    if (body.assigneeId && !access.eligibleMemberIds.has(Number(body.assigneeId))) {
      return res.status(400).json({ success: false, error: 'Assignee does not belong to this project' });
    }
    if (body.linkedDevTaskId) {
      const dt = await prisma.developmentTask.findFirst({
        where: { id: Number(body.linkedDevTaskId), projectId },
      });
      if (!dt) return res.status(400).json({ success: false, error: 'Linked development task not found in project' });
    }

    const nextStatus = typeof body.status === 'string' ? body.status : existing.status;
    if (!VALID_DEFECT_STATUSES.includes(nextStatus as any)) {
      return res.status(400).json({ success: false, error: 'Invalid defect status' });
    }

    // Enforce QA Verification rule: developer "Fixed" never auto-closes to Verified/Closed;
    // transitioning back to Reopened from Fixed/Ready for Retest/Verified/Closed increments reopenCount.
    const isVerifying =
      (nextStatus === 'Verified' || nextStatus === 'Closed') &&
      existing.status !== 'Verified' &&
      existing.status !== 'Closed';
    const isReopening =
      nextStatus === 'Reopened' &&
      ['Fixed', 'Ready for Retest', 'Verified', 'Closed'].includes(existing.status);

    await prisma.qaDefect.update({
      where: { id: defectId },
      data: {
        ...(typeof body.title === 'string' && body.title.trim() ? { title: body.title.trim() } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.stepsToReproduce !== undefined ? { stepsToReproduce: body.stepsToReproduce } : {}),
        ...(body.expectedResult !== undefined ? { expectedResult: body.expectedResult } : {}),
        ...(body.actualResult !== undefined ? { actualResult: body.actualResult } : {}),
        ...(typeof body.severity === 'string' ? { severity: body.severity } : {}),
        ...(typeof body.priority === 'string' ? { priority: body.priority } : {}),
        status: nextStatus,
        ...(body.moduleId !== undefined ? { moduleId: parsePositiveInt(body.moduleId) } : {}),
        ...(body.submoduleId !== undefined ? { submoduleId: parsePositiveInt(body.submoduleId) } : {}),
        ...(body.assigneeId !== undefined ? { assigneeId: parsePositiveInt(body.assigneeId) } : {}),
        ...(body.environment !== undefined ? { environment: body.environment } : {}),
        ...(body.buildVersion !== undefined ? { buildVersion: body.buildVersion } : {}),
        ...(body.linkedTestCaseId !== undefined ? { linkedTestCaseId: parsePositiveInt(body.linkedTestCaseId) } : {}),
        ...(body.linkedDevTaskId !== undefined ? { linkedDevTaskId: parsePositiveInt(body.linkedDevTaskId) } : {}),
        ...(body.linkedRequirementId !== undefined
          ? { linkedRequirementId: parsePositiveInt(body.linkedRequirementId) }
          : {}),
        ...(isVerifying ? { verifiedById: userId, verifiedAt: new Date() } : {}),
        ...(isReopening ? { reopenCount: existing.reopenCount + 1, verifiedById: null, verifiedAt: null } : {}),
      },
    });

    if (nextStatus !== existing.status) {
      await recordTestingActivity({
        projectId,
        entityType: 'defect',
        entityId: defectId,
        defectId,
        actorId: userId,
        action: isReopening ? 'reopened' : isVerifying ? 'verified' : 'status_changed',
        field: 'status',
        previousValue: existing.status,
        newValue: nextStatus,
      });

      if (nextStatus === 'Ready for Retest' && existing.reporterId) {
        await notifyUserSafe({
          recipientId: existing.reporterId,
          actorId: userId,
          title: `Defect ${existing.defectKey} Ready for Retest`,
          message: `"${existing.title}" has been marked Ready for Retest.`,
          data: { projectId, entityType: 'defect', entityId: defectId },
        });
      }
    }

    const detail = await getDefectDetailPayload(projectId, defectId);
    return res.json({ success: true, data: detail });
  } catch (err: any) {
    console.error('[TestingQA] PATCH /defects/:defectId error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update defect' });
  }
});

testingRouter.patch('/defects/:defectId/archive', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const defectId = parseId(req.params.defectId);
    const access = await checkTestingAccess(projectId, getUserIdFromToken(req));
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canArchiveRecords) {
      return res.status(403).json({ success: false, error: 'No permission to archive defects' });
    }
    const isArchived = req.body?.isArchived !== false;
    await prisma.qaDefect.updateMany({
      where: { id: defectId, projectId },
      data: { isArchived, archivedAt: isArchived ? new Date() : null },
    });
    const detail = await getDefectDetailPayload(projectId, defectId);
    return res.json({ success: true, data: detail });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to update archive state' });
  }
});

// Link Git Issue or Merge Request to Defect (reuses GitRecordLink, zero duplication)
testingRouter.post('/defects/:defectId/link-git', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const defectId = parseId(req.params.defectId);
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canManageDefects) {
      return res.status(403).json({ success: false, error: 'No permission to link Git records to defects' });
    }

    const { repositoryId, provider, recordType, recordId, recordNumber, recordTitle, recordUrl } = req.body || {};
    const repo = await prisma.gitRepositoryConnection.findFirst({
      where: { id: Number(repositoryId), projectId },
      include: { providerConnection: { select: { provider: true } } },
    });
    const defect = await prisma.qaDefect.findFirst({ where: { id: defectId, projectId } });
    if (!repo || !defect) {
      return res.status(404).json({ success: false, error: 'Repository or defect not found in this project' });
    }

    await prisma.gitRecordLink.upsert({
      where: {
        projectId_recordId_targetType_targetId: {
          projectId,
          recordId: String(recordId),
          targetType: 'defect',
          targetId: defectId,
        },
      },
      update: {
        recordTitle: recordTitle || null,
        recordUrl: recordUrl || null,
        recordNumber: recordNumber ?? null,
      },
      create: {
        projectId,
        repositoryId: repo.id,
        provider: provider || repo.providerConnection?.provider || 'github',
        recordType: recordType || 'issue',
        recordId: String(recordId),
        recordNumber: recordNumber ?? null,
        recordTitle: recordTitle || null,
        recordUrl: recordUrl || null,
        targetType: 'defect',
        targetId: defectId,
        createdById: userId,
      },
    });

    await recordTestingActivity({
      projectId,
      entityType: 'defect',
      entityId: defectId,
      defectId,
      actorId: userId,
      action: 'git_linked',
      newValue: `${recordType || 'issue'} ${recordNumber ? `#${recordNumber}` : recordId}`,
    });

    const detail = await getDefectDetailPayload(projectId, defectId);
    return res.json({ success: true, data: detail });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to link Git record' });
  }
});

testingRouter.delete('/defects/:defectId/link-git/:linkId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const defectId = parseId(req.params.defectId);
    const linkId = parseId(req.params.linkId);
    const access = await checkTestingAccess(projectId, getUserIdFromToken(req));
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canManageDefects) {
      return res.status(403).json({ success: false, error: 'No permission to unlink Git records' });
    }

    await prisma.gitRecordLink.deleteMany({
      where: { id: linkId, projectId, targetType: 'defect', targetId: defectId },
    });
    const detail = await getDefectDetailPayload(projectId, defectId);
    return res.json({ success: true, data: detail });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to unlink Git record' });
  }
});

// ─── ATTACHMENTS (Reusing existing ProjectDocument & GitHub storage) ───────────

testingRouter.post('/attachments/upload-file', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed || !access.config) return sendTestingAccessError(res, access);
    if (!access.permissions.canEditTestCases && !access.permissions.canExecuteTests && !access.permissions.canManageDefects) {
      return res.status(403).json({ success: false, error: 'No permission to upload testing attachments' });
    }

    const { moduleId, submoduleId, files } = req.body || {};
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files provided for upload' });
    }

    const storageConn = await prisma.projectStorageConnection.findUnique({ where: { projectId } });
    if (storageConn && storageConn.connectionStatus === 'unlinked') {
      return res.status(423).json({
        success: false,
        error: 'Project document storage repository is currently unlinked. Relink it in Project Settings > Storage.',
      });
    }

    const existingDocs = await prisma.projectDocument.findMany({
      where: { projectId, deletedAt: null },
      select: { sizeBytes: true },
    });
    let usedBytes = existingDocs.reduce((a, b) => a + (b.sizeBytes || 0), 0);

    const maxBytes = access.config.maxAttachmentSizeBytes;
    const allowedTypes = access.config.allowedAttachmentTypes;
    const uploadedDocuments: any[] = [];
    const errors: Array<{ fileName: string; error: string }> = [];

    // Folder target: if submoduleId is given, folder is submodule-${submoduleId}, else module-${moduleId}, else 'test-cases'
    const targetFolder = submoduleId
      ? `submodule-${submoduleId}`
      : moduleId
      ? `module-${moduleId}`
      : 'test-cases';

    for (const file of files) {
      const name = String(file?.name || 'attachment').trim();
      const rawBase64 = file?.base64 || file?.data;
      const mimeType = String(file?.mimeType || 'application/octet-stream');
      if (!rawBase64) {
        errors.push({ fileName: name, error: 'Missing file content' });
        continue;
      }

      if (allowedTypes.length > 0 && !allowedTypes.some((t) => mimeType === t || mimeType.startsWith(t.replace('*', '')))) {
        errors.push({ fileName: name, error: `File type ${mimeType} is restricted by Testing Settings.` });
        continue;
      }

      const cleanedBase64 = String(rawBase64).replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(cleanedBase64, 'base64');
      if (buffer.length > maxBytes) {
        errors.push({
          fileName: name,
          error: `File size exceeds limit of ${(maxBytes / (1024 * 1024)).toFixed(1)} MB.`,
        });
        continue;
      }
      if (usedBytes + buffer.length > REPO_SIZE_LIMIT_BYTES) {
        errors.push({ fileName: name, error: 'Project repository size limit exceeded.' });
        continue;
      }

      try {
        const storageKey = crypto.randomUUID();
        const extension = name.split('.').pop()?.toLowerCase() || '';
        const gitResult = await GitHubDocumentStorageService.uploadDocumentFile({
          projectId,
          projectTitle: access.project?.title || 'project',
          fileName: name,
          storageKey,
          categorySlug: 'qa-evidence',
          branchName: 'main',
          pathPrefix: targetFolder,
          contentBuffer: buffer,
          uploaderName: access.user?.name || 'QA User',
        });

        const doc = await prisma.projectDocument.create({
          data: {
            organizationId: access.project?.organizationId || null,
            projectId,
            branch: gitResult.branch || 'main',
            uploadedById: userId!,
            originalName: name,
            displayName: name,
            storageKey,
            repositoryPath: gitResult.path,
            providerFileSha: gitResult.sha,
            mimeType,
            extension,
            sizeBytes: buffer.length,
            description: `Testing attachment uploaded to ${targetFolder}`,
            uploadStatus: 'uploaded',
            providerSyncStatus: 'synced',
          },
        });

        usedBytes += buffer.length;
        uploadedDocuments.push({
          id: doc.id,
          displayName: doc.displayName,
          originalName: doc.originalName,
          mimeType: doc.mimeType,
          extension: doc.extension,
          sizeBytes: doc.sizeBytes,
          branch: doc.branch,
          repositoryPath: doc.repositoryPath,
          folder: targetFolder,
        });
      } catch (err: any) {
        errors.push({ fileName: name, error: err.message || 'GitHub upload failed' });
      }
    }

    return res.status(201).json({
      success: true,
      data: {
        documents: uploadedDocuments,
        errors,
        folder: targetFolder,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to upload testing attachment file' });
  }
});

testingRouter.post('/attachments/upload', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed || !access.config) return sendTestingAccessError(res, access);

    const { entityType, entityId, files } = req.body || {};
    if (!['test_case', 'execution', 'defect'].includes(entityType) || !parsePositiveInt(entityId)) {
      return res.status(400).json({ success: false, error: 'Valid entityType and entityId required' });
    }
    const targetId = Number(entityId);

    if (entityType === 'execution' && !access.permissions.canExecuteTests) {
      return res.status(403).json({ success: false, error: 'No permission to upload test execution evidence' });
    }
    if (entityType === 'test_case' && !access.permissions.canEditTestCases) {
      return res.status(403).json({ success: false, error: 'No permission to upload test case attachments' });
    }
    if (entityType === 'defect' && !access.permissions.canManageDefects) {
      return res.status(403).json({ success: false, error: 'No permission to upload defect evidence' });
    }

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files provided' });
    }

    const storageConn = await prisma.projectStorageConnection.findUnique({ where: { projectId } });
    if (storageConn && storageConn.connectionStatus === 'unlinked') {
      return res.status(423).json({
        success: false,
        error: 'Project document storage repository is currently unlinked. Relink it in Project Settings > Storage.',
      });
    }

    const existingDocs = await prisma.projectDocument.findMany({
      where: { projectId, deletedAt: null },
      select: { sizeBytes: true },
    });
    let usedBytes = existingDocs.reduce((a, b) => a + (b.sizeBytes || 0), 0);

    const maxBytes = access.config.maxAttachmentSizeBytes;
    const allowedTypes = access.config.allowedAttachmentTypes;
    const uploadedDocuments: any[] = [];
    const errors: Array<{ fileName: string; error: string }> = [];

    for (const file of files) {
      const name = String(file?.name || 'evidence').trim();
      const rawBase64 = file?.base64 || file?.data;
      const mimeType = String(file?.mimeType || 'application/octet-stream');
      if (!rawBase64) {
        errors.push({ fileName: name, error: 'Missing file content' });
        continue;
      }

      if (allowedTypes.length > 0 && !allowedTypes.some((t) => mimeType === t || mimeType.startsWith(t.replace('*', '')))) {
        errors.push({ fileName: name, error: `File type ${mimeType} is restricted by Testing Settings.` });
        continue;
      }

      const cleanedBase64 = String(rawBase64).replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(cleanedBase64, 'base64');
      if (buffer.length > maxBytes) {
        errors.push({
          fileName: name,
          error: `File size exceeds limit of ${(maxBytes / (1024 * 1024)).toFixed(1)} MB.`,
        });
        continue;
      }
      if (usedBytes + buffer.length > REPO_SIZE_LIMIT_BYTES) {
        errors.push({ fileName: name, error: 'Project repository size limit exceeded.' });
        continue;
      }

      try {
        const storageKey = crypto.randomUUID();
        const extension = name.split('.').pop()?.toLowerCase() || '';
        const gitResult = await GitHubDocumentStorageService.uploadDocumentFile({
          projectId,
          projectTitle: access.project?.title || 'project',
          fileName: name,
          storageKey,
          categorySlug: 'qa-evidence',
          branchName: 'main',
          pathPrefix: `qa-evidence/${entityType}-${targetId}`,
          contentBuffer: buffer,
          uploaderName: access.user?.name || 'QA User',
        });

        const doc = await prisma.projectDocument.create({
          data: {
            organizationId: access.project?.organizationId || null,
            projectId,
            branch: gitResult.branch || 'main',
            uploadedById: userId!,
            originalName: name,
            displayName: name,
            storageKey,
            repositoryPath: gitResult.path,
            providerFileSha: gitResult.sha,
            mimeType,
            extension,
            sizeBytes: buffer.length,
            description: `Testing & QA evidence for ${entityType} #${targetId}`,
            uploadStatus: 'uploaded',
            providerSyncStatus: 'synced',
          },
        });

        if (entityType === 'test_case') {
          await prisma.testCaseAttachment.create({ data: { testCaseId: targetId, documentId: doc.id, uploadedById: userId } });
        } else if (entityType === 'execution') {
          await prisma.testExecutionAttachment.create({ data: { executionId: targetId, documentId: doc.id, uploadedById: userId } });
        } else {
          await prisma.qaDefectAttachment.create({ data: { defectId: targetId, documentId: doc.id, uploadedById: userId } });
        }

        usedBytes += buffer.length;
        uploadedDocuments.push(doc);
      } catch (err: any) {
        errors.push({ fileName: name, error: err?.message || 'Storage upload failed' });
      }
    }

    return res.json({ success: uploadedDocuments.length > 0, data: { documents: uploadedDocuments, errors } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Attachment upload failed' });
  }
});

testingRouter.post('/attachments/link', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed) return sendTestingAccessError(res, access);

    const { entityType, entityId, documentId } = req.body || {};
    const doc = await prisma.projectDocument.findFirst({
      where: { id: Number(documentId), projectId, deletedAt: null },
    });
    if (!doc) return res.status(404).json({ success: false, error: 'Document not found in this project' });

    const targetId = Number(entityId);
    if (entityType === 'test_case') {
      await prisma.testCaseAttachment.upsert({
        where: { testCaseId_documentId: { testCaseId: targetId, documentId: doc.id } },
        update: {},
        create: { testCaseId: targetId, documentId: doc.id, uploadedById: userId },
      });
    } else if (entityType === 'execution') {
      await prisma.testExecutionAttachment.upsert({
        where: { executionId_documentId: { executionId: targetId, documentId: doc.id } },
        update: {},
        create: { executionId: targetId, documentId: doc.id, uploadedById: userId },
      });
    } else if (entityType === 'defect') {
      await prisma.qaDefectAttachment.upsert({
        where: { defectId_documentId: { defectId: targetId, documentId: doc.id } },
        update: {},
        create: { defectId: targetId, documentId: doc.id, uploadedById: userId },
      });
    } else {
      return res.status(400).json({ success: false, error: 'Invalid entityType' });
    }
    return res.json({ success: true, data: { linked: true } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to link document' });
  }
});

testingRouter.post('/attachments/unlink', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const access = await checkTestingAccess(projectId, getUserIdFromToken(req));
    if (!access.allowed) return sendTestingAccessError(res, access);

    const { entityType, entityId, documentId } = req.body || {};
    const targetId = Number(entityId);
    const docId = Number(documentId);

    if (entityType === 'test_case') {
      await prisma.testCaseAttachment.deleteMany({ where: { testCaseId: targetId, documentId: docId } });
    } else if (entityType === 'execution') {
      await prisma.testExecutionAttachment.deleteMany({ where: { executionId: targetId, documentId: docId } });
    } else if (entityType === 'defect') {
      await prisma.qaDefectAttachment.deleteMany({ where: { defectId: targetId, documentId: docId } });
    }
    return res.json({ success: true, data: { unlinked: true } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to unlink attachment' });
  }
});

// ─── REPORTS & CSV EXPORT ─────────────────────────────────────────────────────

async function buildTestingReportPayload(projectId: number, query: Record<string, any>) {
  const startDate = typeof query.startDate === 'string' && query.startDate ? new Date(query.startDate) : null;
  const endDate = typeof query.endDate === 'string' && query.endDate ? new Date(query.endDate) : null;
  if (endDate) endDate.setHours(23, 59, 59, 999);
  const planId = parsePositiveInt(query.planId);
  const buildVersion = typeof query.buildVersion === 'string' ? query.buildVersion.trim() : '';
  const environment = typeof query.environment === 'string' ? query.environment.trim() : '';
  const testerId = parsePositiveInt(query.testerId);
  const testType = typeof query.testType === 'string' ? query.testType.trim() : '';

  const runWhere: any = { projectId, isArchived: false };
  if (planId) runWhere.testPlanId = planId;
  if (buildVersion && buildVersion !== 'all') runWhere.buildVersion = buildVersion;
  if (environment && environment !== 'all') runWhere.environment = environment;

  const execWhere: any = {
    projectId,
    isLatest: true,
    testRun: runWhere,
  };
  if (testerId) execWhere.executedById = testerId;
  if (testType && testType !== 'all') execWhere.testTypeSnapshot = testType;
  if (startDate) execWhere.createdAt = { ...(execWhere.createdAt || {}), gte: startDate };
  if (endDate) execWhere.createdAt = { ...(execWhere.createdAt || {}), lte: endDate };

  const defectWhere: any = { projectId, isArchived: false };
  if (buildVersion && buildVersion !== 'all') defectWhere.buildVersion = buildVersion;
  if (environment && environment !== 'all') defectWhere.environment = environment;
  if (startDate) defectWhere.createdAt = { ...(defectWhere.createdAt || {}), gte: startDate };
  if (endDate) defectWhere.createdAt = { ...(defectWhere.createdAt || {}), lte: endDate };

  const [executions, defects, requirements, plans, regressionSuites, allRuns] = await Promise.all([
    prisma.testExecution.findMany({
      where: execWhere,
      include: {
        executedBy: { select: userSelectLite },
        testRun: { select: { id: true, runKey: true, buildVersion: true, environment: true } },
      },
    }),
    prisma.qaDefect.findMany({ where: defectWhere }),
    prisma.requirement.findMany({
      where: { projectId },
      include: {
        testCases: {
          where: { isArchived: false },
          include: {
            executions: { where: { isLatest: true }, orderBy: { updatedAt: 'desc' }, take: 1 },
          },
        },
        qaDefects: { where: { isArchived: false } },
      },
    }),
    prisma.testPlan.findMany({
      where: { projectId, isArchived: false },
      include: {
        suites: { include: { suite: { include: { cases: true } } } },
        cases: true,
        runs: {
          where: { isArchived: false },
          include: { executions: { where: { isLatest: true }, select: { status: true } } },
        },
      },
    }),
    prisma.testSuite.findMany({
      where: {
        projectId,
        isArchived: false,
        OR: [{ purpose: { contains: 'Regression' } }, { name: { contains: 'Regression' } }],
      },
      include: {
        cases: true,
        runs: {
          where: { isArchived: false },
          include: { executions: { where: { isLatest: true }, select: { status: true } } },
        },
      },
    }),
    prisma.testRun.findMany({
      where: { projectId, isArchived: false },
      select: { buildVersion: true, environment: true, testPlanId: true },
    }),
  ]);

  const stats = computeRunStats(executions);
  const closedDefectStatuses = new Set(['Verified', 'Closed']);
  const openDefects = defects.filter((d) => !closedDefectStatuses.has(d.status));
  const criticalDefects = openDefects.filter((d) => d.severity === 'Critical').length;

  // Group by testType
  const byTypeMap = new Map<string, any[]>();
  const byPrioMap = new Map<string, any[]>();
  const byTesterMap = new Map<string, { testerId: number | null; testerName: string; rows: any[] }>();
  const byBuildMap = new Map<string, { buildVersion: string; environment: string; runIds: Set<number>; rows: any[] }>();

  for (const ex of executions) {
    const tType = ex.testTypeSnapshot || 'Unspecified';
    byTypeMap.set(tType, [...(byTypeMap.get(tType) || []), ex]);

    const prio = ex.prioritySnapshot || 'Medium';
    byPrioMap.set(prio, [...(byPrioMap.get(prio) || []), ex]);

    const tKey = String(ex.executedById || 'unassigned');
    const tEntry = byTesterMap.get(tKey) || {
      testerId: ex.executedById ?? null,
      testerName: ex.executedBy?.name || 'Unassigned',
      rows: [],
    };
    tEntry.rows.push(ex);
    byTesterMap.set(tKey, tEntry);

    const bVer = ex.testRun?.buildVersion || 'Unspecified Build';
    const env = ex.testRun?.environment || 'Unspecified Env';
    const bKey = `${bVer}::${env}`;
    const bEntry = byBuildMap.get(bKey) || { buildVersion: bVer, environment: env, runIds: new Set(), rows: [] };
    bEntry.runIds.add(ex.testRunId);
    bEntry.rows.push(ex);
    byBuildMap.set(bKey, bEntry);
  }

  // Defect trend over time by day
  const trendMap = new Map<string, { created: number; resolved: number }>();
  for (const d of defects) {
    const createdDay = d.createdAt.toISOString().slice(0, 10);
    const cur = trendMap.get(createdDay) || { created: 0, resolved: 0 };
    cur.created++;
    if (d.verifiedAt) {
      const verDay = d.verifiedAt.toISOString().slice(0, 10);
      const vEntry = trendMap.get(verDay) || { created: 0, resolved: 0 };
      vEntry.resolved++;
      trendMap.set(verDay, vEntry);
    }
    trendMap.set(createdDay, cur);
  }

  const regCasesSet = new Set<number>();
  const regExecs: any[] = [];
  let regRunsCount = 0;
  for (const s of regressionSuites) {
    for (const c of s.cases) regCasesSet.add(c.testCaseId);
    for (const r of s.runs) {
      regRunsCount++;
      regExecs.push(...r.executions);
    }
  }
  const regStats = computeRunStats(regExecs);

  return {
    formula: {
      passRateFormula: 'Passed / (Passed + Failed) × 100',
      failRateFormula: 'Failed / (Passed + Failed) × 100',
      note: 'Not Run, Blocked, and Skipped executions are excluded from the completed-execution denominator. Defects are tracked separately from failed executions because multiple test failures can reference the same defect.',
    },
    summary: {
      totalLatestExecutions: stats.total,
      passedExecutions: stats.passed,
      failedExecutions: stats.failed,
      blockedExecutions: stats.blocked,
      notRunExecutions: stats.notRun,
      skippedExecutions: stats.skipped,
      completedEligibleExecutions: stats.eligibleCompleted,
      passRate: stats.passRate,
      failRate: stats.failRate,
      totalDefects: defects.length,
      openDefects: openDefects.length,
      criticalDefects,
    },
    byTestType: Array.from(byTypeMap.entries()).map(([testTypeName, rows]) => {
      const s = computeRunStats(rows);
      return {
        testType: testTypeName,
        total: s.total,
        passed: s.passed,
        failed: s.failed,
        blocked: s.blocked,
        notRun: s.notRun,
        passRate: s.passRate,
      };
    }),
    byPriority: Array.from(byPrioMap.entries()).map(([prio, rows]) => {
      const s = computeRunStats(rows);
      return { priority: prio, total: s.total, passed: s.passed, failed: s.failed, passRate: s.passRate };
    }),
    defectsBySeverity: [
      { severity: 'Critical', count: defects.filter((d) => d.severity === 'Critical').length, color: '#EF4444' },
      { severity: 'Major', count: defects.filter((d) => d.severity === 'Major').length, color: '#F97316' },
      { severity: 'Moderate', count: defects.filter((d) => d.severity === 'Moderate').length, color: '#F59E0B' },
      { severity: 'Minor', count: defects.filter((d) => d.severity === 'Minor').length, color: '#71717A' },
    ],
    defectsByStatus: VALID_DEFECT_STATUSES.map((st) => ({
      status: st,
      count: defects.filter((d) => d.status === st).length,
    })),
    defectTrend: Array.from(trendMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, vals]) => ({ date, ...vals })),
    executionByTester: Array.from(byTesterMap.values()).map((entry) => {
      const s = computeRunStats(entry.rows);
      return {
        testerId: entry.testerId,
        testerName: entry.testerName,
        total: s.total,
        passed: s.passed,
        failed: s.failed,
        blocked: s.blocked,
        passRate: s.passRate,
      };
    }),
    requirementCoverage: requirements.map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      linkedCases: r.testCases.length,
      passed: r.testCases.filter((tc) => tc.executions[0]?.status === 'Passed').length,
      failed: r.testCases.filter((tc) => tc.executions[0]?.status === 'Failed').length,
      defects: r.qaDefects.length,
    })),
    byBuildOrRelease: Array.from(byBuildMap.values()).map((entry) => {
      const s = computeRunStats(entry.rows);
      return {
        buildVersion: entry.buildVersion,
        environment: entry.environment,
        runsCount: entry.runIds.size,
        total: s.total,
        passed: s.passed,
        failed: s.failed,
        passRate: s.passRate,
      };
    }),
    planProgress: plans.map((p) => {
      const uniqueIds = new Set<number>();
      for (const ps of p.suites) for (const sc of ps.suite.cases) uniqueIds.add(sc.testCaseId);
      for (const pc of p.cases) uniqueIds.add(pc.testCaseId);
      const s = computeRunStats(p.runs.flatMap((r) => r.executions));
      return {
        id: p.id,
        planKey: p.planKey,
        title: p.title,
        status: p.status,
        targetVersion: p.targetVersion,
        totalCases: uniqueIds.size,
        passed: s.passed,
        failed: s.failed,
        passRate: s.passRate,
      };
    }),
    regressionSummary: {
      regressionSuitesCount: regressionSuites.length,
      regressionCasesCount: regCasesSet.size,
      regressionRunsCount: regRunsCount,
      passed: regStats.passed,
      failed: regStats.failed,
      passRate: regStats.passRate,
    },
    filterChoices: {
      plans: plans.map((p) => ({ id: p.id, planKey: p.planKey, title: p.title })),
      builds: Array.from(new Set(allRuns.map((r) => r.buildVersion).filter((v): v is string => Boolean(v)))),
      environments: Array.from(new Set(allRuns.map((r) => r.environment).filter((v): v is string => Boolean(v)))),
      testers: Array.from(
        new Map(
          executions
            .filter((e) => e.executedBy)
            .map((e) => [e.executedBy!.id, e.executedBy!])
        ).values()
      ),
      testTypes: Array.from(new Set(executions.map((e) => e.testTypeSnapshot).filter((v): v is string => Boolean(v)))),
    },
  };
}

testingRouter.get('/reports', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const access = await checkTestingAccess(projectId, getUserIdFromToken(req));
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canViewReports) {
      return res.status(403).json({ success: false, error: 'You do not have permission to view Test Reports' });
    }

    const report = await buildTestingReportPayload(projectId, req.query as Record<string, any>);
    return res.json({
      success: true,
      data: {
        permissions: access.permissions,
        ...report,
      },
    });
  } catch (err: any) {
    console.error('[TestingQA] GET /reports error:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate QA report' });
  }
});

testingRouter.get('/reports/export', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const access = await checkTestingAccess(projectId, getUserIdFromToken(req));
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canViewReports) {
      return res.status(403).json({ success: false, error: 'You do not have permission to export QA reports' });
    }

    const report = await buildTestingReportPayload(projectId, req.query as Record<string, any>);
    const lines: string[] = [];
    lines.push('SECTION,METRIC,VALUE');
    lines.push(['Summary', 'Total Latest Executions', report.summary.totalLatestExecutions].map(formatCsvCell).join(','));
    lines.push(['Summary', 'Passed', report.summary.passedExecutions].map(formatCsvCell).join(','));
    lines.push(['Summary', 'Failed', report.summary.failedExecutions].map(formatCsvCell).join(','));
    lines.push(['Summary', 'Blocked', report.summary.blockedExecutions].map(formatCsvCell).join(','));
    lines.push(['Summary', 'Not Run', report.summary.notRunExecutions].map(formatCsvCell).join(','));
    lines.push(['Summary', 'Eligible Completed', report.summary.completedEligibleExecutions].map(formatCsvCell).join(','));
    lines.push(['Summary', 'Pass Rate (%)', report.summary.passRate ?? 'N/A'].map(formatCsvCell).join(','));
    lines.push(['Summary', 'Fail Rate (%)', report.summary.failRate ?? 'N/A'].map(formatCsvCell).join(','));
    lines.push(['Summary', 'Total Defects', report.summary.totalDefects].map(formatCsvCell).join(','));
    lines.push(['Summary', 'Open Defects', report.summary.openDefects].map(formatCsvCell).join(','));
    lines.push(['Summary', 'Critical Defects', report.summary.criticalDefects].map(formatCsvCell).join(','));

    lines.push('');
    lines.push('TEST TYPE,TOTAL,PASSED,FAILED,BLOCKED,NOT RUN,PASS RATE (%)');
    for (const row of report.byTestType) {
      lines.push(
        [row.testType, row.total, row.passed, row.failed, row.blocked, row.notRun, row.passRate ?? 'N/A']
          .map(formatCsvCell)
          .join(',')
      );
    }

    lines.push('');
    lines.push('REQUIREMENT CODE,TITLE,LINKED CASES,PASSED,FAILED,DEFECTS');
    for (const r of report.requirementCoverage) {
      lines.push([r.code, r.title, r.linkedCases, r.passed, r.failed, r.defects].map(formatCsvCell).join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="devflow-qa-report-${projectId}.csv"`);
    return res.send(lines.join('\n'));
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to export report CSV' });
  }
});

// ─── SETTINGS & MASTER DATA ───────────────────────────────────────────────────

testingRouter.get('/settings', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const access = await checkTestingAccess(projectId, getUserIdFromToken(req));
    if (!access.allowed || !access.config) return sendTestingAccessError(res, access);
    return res.json({
      success: true,
      data: {
        permissions: access.permissions,
        config: access.config,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to load Testing settings' });
  }
});

testingRouter.patch('/settings', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canManageSettings) {
      return res.status(403).json({ success: false, error: 'Only project admins or QA managers can edit Testing settings' });
    }

    const b = req.body || {};
    const existingCfg = await getOrCreateTestingConfig(projectId);

    const updated = await prisma.testingConfiguration.update({
      where: { projectId },
      data: {
        ...(typeof b.testCasePrefix === 'string' && b.testCasePrefix.trim()
          ? { testCasePrefix: b.testCasePrefix.trim().toUpperCase().slice(0, 12) }
          : {}),
        ...(typeof b.testCaseNextSeq === 'number' && b.testCaseNextSeq >= 1
          ? { testCaseNextSeq: Math.max(existingCfg.testCaseNextSeq, b.testCaseNextSeq) }
          : {}),
        ...(typeof b.defectPrefix === 'string' && b.defectPrefix.trim()
          ? { defectPrefix: b.defectPrefix.trim().toUpperCase().slice(0, 12) }
          : {}),
        ...(typeof b.defectNextSeq === 'number' && b.defectNextSeq >= 1
          ? { defectNextSeq: Math.max(existingCfg.defectNextSeq, b.defectNextSeq) }
          : {}),
        ...(typeof b.defaultEnvironment === 'string' && b.defaultEnvironment.trim()
          ? { defaultEnvironment: b.defaultEnvironment.trim() }
          : {}),
        ...(typeof b.maxAttachmentSizeBytes === 'number' && b.maxAttachmentSizeBytes > 0
          ? { maxAttachmentSizeBytes: b.maxAttachmentSizeBytes }
          : {}),
        ...(Array.isArray(b.allowedAttachmentTypes)
          ? { allowedAttachmentTypesJson: JSON.stringify(b.allowedAttachmentTypes) }
          : {}),
        ...(b.retentionDays !== undefined
          ? { retentionDays: b.retentionDays === null ? null : Math.max(1, Number(b.retentionDays)) }
          : {}),
        ...(typeof b.notifyOnRunFailure === 'boolean' ? { notifyOnRunFailure: b.notifyOnRunFailure } : {}),
        ...(typeof b.notifyOnCriticalDefect === 'boolean' ? { notifyOnCriticalDefect: b.notifyOnCriticalDefect } : {}),
        ...(typeof b.notifyOnPlanDueSoon === 'boolean' ? { notifyOnPlanDueSoon: b.notifyOnPlanDueSoon } : {}),
        ...(Array.isArray(b.executionStatuses) ? { executionStatusesJson: JSON.stringify(b.executionStatuses) } : {}),
        ...(b.rolePermissions && typeof b.rolePermissions === 'object'
          ? {
              permissionsJson: JSON.stringify({
                ...DEFAULT_ROLE_PERMISSIONS,
                ...b.rolePermissions,
                OWNER: DEFAULT_ROLE_PERMISSIONS.OWNER, // Owner retains full settings access cleanly
              }),
            }
          : {}),
        updatedById: userId,
      },
    });

    await recordTestingActivity({
      projectId,
      entityType: 'config',
      entityId: updated.id,
      actorId: userId,
      action: 'settings_updated',
    });

    return res.json({
      success: true,
      data: {
        permissions: access.permissions,
        config: serializeConfig(updated),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to update Testing settings' });
  }
});

const CATEGORY_COLUMN_MAP: Record<
  'testTypes' | 'priorities' | 'defectSeverities' | 'environments',
  'testTypesJson' | 'prioritiesJson' | 'defectSeveritiesJson' | 'environmentsJson'
> = {
  testTypes: 'testTypesJson',
  priorities: 'prioritiesJson',
  defectSeverities: 'defectSeveritiesJson',
  environments: 'environmentsJson',
};

testingRouter.post('/settings/master-option', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canManageSettings && !access.permissions.canEditTestCases) {
      return res.status(403).json({ success: false, error: 'No permission to add master options' });
    }

    const { category, name, color, icon } = req.body || {};
    if (!category || !(category in CATEGORY_COLUMN_MAP)) {
      return res.status(400).json({ success: false, error: 'Invalid master category' });
    }
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) return res.status(400).json({ success: false, error: 'Option name is required' });

    const cfg = await getOrCreateTestingConfig(projectId);
    const list: MasterChoiceOption[] = [...(cfg[category as keyof typeof CATEGORY_COLUMN_MAP] as MasterChoiceOption[])];

    const duplicate = list.find((o) => o.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: `"${duplicate.name}" already exists in this project's master list.`,
      });
    }

    const newItem: MasterChoiceOption = {
      name: trimmed,
      color: typeof color === 'string' && color ? color : '#8B5CF6',
      icon: typeof icon === 'string' && icon ? icon : 'circle-dot',
      isArchived: false,
    };
    list.push(newItem);

    const col = CATEGORY_COLUMN_MAP[category as keyof typeof CATEGORY_COLUMN_MAP];
    const updated = await prisma.testingConfiguration.update({
      where: { projectId },
      data: { [col]: JSON.stringify(list), updatedById: userId },
    });

    return res.status(201).json({
      success: true,
      data: {
        config: serializeConfig(updated),
        created: newItem,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to add master option' });
  }
});

testingRouter.patch('/settings/master-option/archive', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const access = await checkTestingAccess(projectId, userId);
    if (!access.allowed) return sendTestingAccessError(res, access);
    if (!access.permissions.canManageSettings) {
      return res.status(403).json({ success: false, error: 'Only admins/QA managers can archive master options' });
    }

    const { category, name, isArchived } = req.body || {};
    if (!category || !(category in CATEGORY_COLUMN_MAP) || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: 'Valid category and option name required' });
    }

    const cfg = await getOrCreateTestingConfig(projectId);
    const list: MasterChoiceOption[] = [...(cfg[category as keyof typeof CATEGORY_COLUMN_MAP] as MasterChoiceOption[])];
    const nextList = list.map((item) =>
      item.name.trim().toLowerCase() === name.trim().toLowerCase()
        ? { ...item, isArchived: Boolean(isArchived) }
        : item
    );

    const col = CATEGORY_COLUMN_MAP[category as keyof typeof CATEGORY_COLUMN_MAP];
    const updated = await prisma.testingConfiguration.update({
      where: { projectId },
      data: { [col]: JSON.stringify(nextList), updatedById: userId },
    });

    return res.json({
      success: true,
      data: { config: serializeConfig(updated) },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to archive master option' });
  }
});
