import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getUserIdFromToken } from '../lib/auth.js';
import { GitHubDocumentStorageService } from '../services/documents/gitHubDocumentStorage.service.js';

export const developmentRouter = Router({ mergeParams: true });

// ─── CONSTANTS & DEFAULTS ─────────────────────────────────────────────────────

const DEFAULT_TASK_TYPES = [
  'Development',
  'Research',
  'Feature',
  'Bug',
  'Improvement',
  'Documentation',
  'Testing',
  'Technical Debt',
];
const DEFAULT_STATUSES = ['Not Started', 'In Progress', 'In Review', 'Blocked', 'Completed'];
const PRIORITY_LEVELS = ['Critical', 'High', 'Medium', 'Low'] as const;
const REPO_SIZE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB GitHub repository soft limit
const PRIORITY_RANK: Record<string, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

interface MasterChoiceItem {
  name: string;
  icon: string;
  color: string;
  isEnd?: boolean;
}

const DEFAULT_PRIORITY_ITEMS: MasterChoiceItem[] = [
  { name: 'Critical', icon: 'Flame', color: '#EF4444' },
  { name: 'High', icon: 'ArrowUp', color: '#F97316' },
  { name: 'Medium', icon: 'Minus', color: '#F59E0B' },
  { name: 'Low', icon: 'ArrowDown', color: '#3B82F6' },
];

const DEFAULT_STATUS_ITEMS: MasterChoiceItem[] = [
  { name: 'Not Started', icon: 'Circle', color: '#71717A', isEnd: false },
  { name: 'In Progress', icon: 'Zap', color: '#3B82F6', isEnd: false },
  { name: 'In Review', icon: 'Eye', color: '#8B5CF6', isEnd: false },
  { name: 'Blocked', icon: 'AlertTriangle', color: '#EF4444', isEnd: false },
  { name: 'Completed', icon: 'CheckCircle2', color: '#10B981', isEnd: true },
];

function parseTeamIconFromDescription(desc?: string | null): string {
  if (!desc) return 'Users';
  const match = desc.match(/^\[icon:([^\]]+)\]/);
  return match?.[1]?.trim() || 'Users';
}

const STATUS_COLORS: Record<string, string> = {
  'Not Started': '#71717A',
  'In Progress': '#3B82F6',
  'In Review': '#8B5CF6',
  Blocked: '#EF4444',
  Completed: '#10B981',
};

const PRIORITY_COLORS: Record<string, string> = {
  Critical: '#EF4444',
  High: '#F97316',
  Medium: '#F59E0B',
  Low: '#3B82F6',
};

const TYPE_COLORS: Record<string, string> = {
  Task: '#6366F1',
  Feature: '#10B981',
  Bug: '#EF4444',
  Improvement: '#3B82F6',
  'Technical Debt': '#F59E0B',
};

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

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function parseId(param: string | string[] | undefined): number {
  const str = Array.isArray(param) ? param[0] : param;
  return str ? parseInt(str, 10) : NaN;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

function parseJsonStringArray(raw: string | null | undefined, fallback: string[] = []): string[] {
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((v) => String(v).trim()).filter(Boolean);
    }
  } catch {
    // ignore malformed JSON
  }
  return fallback;
}

function parseJsonIntArray(raw: string | null | undefined): number[] {
  if (!raw || typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return Array.from(
        new Set(
          parsed
            .map((v) => (typeof v === 'number' ? v : parseInt(String(v), 10)))
            .filter((n) => Number.isInteger(n) && n > 0)
        )
      );
    }
  } catch {
    // ignore malformed JSON
  }
  return [];
}

function buildEndStatusSet(statusItems: MasterChoiceItem[]): Set<string> {
  const set = new Set<string>(['completed']);
  for (const s of statusItems) {
    if (s.isEnd) {
      set.add(s.name.trim().toLowerCase());
    }
  }
  return set;
}

function buildTeamLookup(assigneeGroups?: AssigneeGroups): Map<number, AssigneeTeamGroup> {
  const map = new Map<number, AssigneeTeamGroup>();
  if (!assigneeGroups) return map;
  for (const t of [...(assigneeGroups.teams || []), ...(assigneeGroups.allTeams || [])]) {
    if (!map.has(t.id)) map.set(t.id, t);
  }
  return map;
}

function parseDateOnly(raw: string | null | undefined): Date | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (isoMatch) {
    const d = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function toDateKey(d: Date | string | null | undefined): string | null {
  if (!rawIsValid(d)) return null;
  const dateObj = d instanceof Date ? d : new Date(d as string);
  if (Number.isNaN(dateObj.getTime())) return null;
  return dateObj.toISOString().slice(0, 10);
}

function rawIsValid(d: Date | string | null | undefined): boolean {
  return d !== null && d !== undefined && d !== '';
}

function getTodayAndSoonKeys(): { todayKey: string; soonKey: string } {
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const soonUtc = new Date(todayUtc.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    todayKey: todayUtc.toISOString().slice(0, 10),
    soonKey: soonUtc.toISOString().slice(0, 10),
  };
}

function isCompletedStatus(status: string, endStatuses?: Set<string>): boolean {
  const key = status.trim().toLowerCase();
  return endStatuses ? endStatuses.has(key) : key === 'completed';
}

function computeDateFlags(
  status: string,
  dueDate: Date | null | undefined,
  todayKey: string,
  soonKey: string,
  endStatuses?: Set<string>
) {
  const dueKey = toDateKey(dueDate);
  if (!dueKey || isCompletedStatus(status, endStatuses)) {
    return { isOverdue: false, isDueSoon: false };
  }
  return {
    isOverdue: dueKey < todayKey,
    isDueSoon: dueKey >= todayKey && dueKey <= soonKey,
  };
}

// ─── AUTH, RBAC & ELIGIBLE PROJECT MEMBERS ────────────────────────────────────

interface EligibleMember {
  id: number;
  name: string;
  username: string | null;
  email: string | null;
  avatarUrl: string | null;
  avatarColor: string | null;
  avatarType: string | null;
  avatarId: string | null;
  jobTitle: string | null;
  projectRole: string;
}

interface AssigneeTeamGroup {
  id: number;
  name: string;
  color: string;
  icon: string;
  memberIds: number[];
  memberCount: number;
}

interface AssigneeGroups {
  teams: AssigneeTeamGroup[];
  projectMembers: EligibleMember[];
  allTeams: AssigneeTeamGroup[];
  orgMembers: EligibleMember[];
}

const EMPTY_ASSIGNEE_GROUPS: AssigneeGroups = {
  teams: [],
  projectMembers: [],
  allTeams: [],
  orgMembers: [],
};

async function checkDevelopmentAccess(projectId: number, userId: number | null) {
  if (!userId) {
    return {
      allowed: false,
      unauthorized: true,
      notFound: false,
      forbidden: false,
      project: null,
      user: null,
      canEditTasks: false,
      canManageMasters: false,
      role: 'NONE',
      eligibleMembers: [] as EligibleMember[],
      eligibleMemberIds: new Set<number>(),
      assigneeGroups: EMPTY_ASSIGNEE_GROUPS,
    };
  }

  const [user, project] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { ...userSelectFields, role: true },
    }),
    prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: { select: userSelectFields },
        lead: { select: userSelectFields },
        members: { include: { user: { select: userSelectFields } } },
        team: {
          include: {
            members: { include: { user: { select: userSelectFields } } },
          },
        },
        organization: {
          include: {
            members: { include: { user: { select: userSelectFields } } },
            teams: {
              include: {
                members: { include: { user: { select: userSelectFields } } },
              },
            },
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
      canEditTasks: false,
      canManageMasters: false,
      role: 'NONE',
      eligibleMembers: [] as EligibleMember[],
      eligibleMemberIds: new Set<number>(),
      assigneeGroups: EMPTY_ASSIGNEE_GROUPS,
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
      canEditTasks: false,
      canManageMasters: false,
      role: 'NONE',
      eligibleMembers: [] as EligibleMember[],
      eligibleMemberIds: new Set<number>(),
      assigneeGroups: EMPTY_ASSIGNEE_GROUPS,
    };
  }

  const isGlobalAdmin = user.role === 'ADMIN';
  const isOwner = project.ownerId === userId;
  const isLead = project.leadId === userId;
  const projectMembership = project.members.find((m) => m.userId === userId);
  const orgMembership = project.organization?.members.find((m) => m.userId === userId);
  const teamMembership = project.team?.members.find((m) => m.userId === userId);

  const isMember =
    isGlobalAdmin ||
    isOwner ||
    isLead ||
    Boolean(projectMembership) ||
    Boolean(orgMembership) ||
    Boolean(teamMembership);

  if (!isMember) {
    return {
      allowed: false,
      unauthorized: false,
      notFound: false,
      forbidden: true,
      project,
      user,
      canEditTasks: false,
      canManageMasters: false,
      role: 'NONE',
      eligibleMembers: [] as EligibleMember[],
      eligibleMemberIds: new Set<number>(),
      assigneeGroups: EMPTY_ASSIGNEE_GROUPS,
    };
  }

  const pmRole = (projectMembership?.role || '').toUpperCase();
  const orgRole = (orgMembership?.role || '').toUpperCase();
  const teamRole = (teamMembership?.role || '').toUpperCase();

  const canManageMasters =
    isGlobalAdmin ||
    isOwner ||
    isLead ||
    ['ADMIN', 'OWNER', 'LEAD', 'MANAGER', 'PROJECT_MANAGER'].includes(pmRole) ||
    ['OWNER', 'ADMIN'].includes(orgRole) ||
    ['OWNER', 'ADMIN', 'PROJECT_MANAGER'].includes(teamRole);

  const isViewerOnly =
    !canManageMasters &&
    ((projectMembership && pmRole === 'VIEWER') ||
      (!projectMembership && !teamMembership && orgMembership && orgRole === 'VIEWER') ||
      (!projectMembership && !orgMembership && teamMembership && teamRole === 'VIEWER') ||
      user.role === 'VIEWER');

  const canEditTasks = !isViewerOnly;
  const effectiveRole = isOwner
    ? 'OWNER'
    : isLead
    ? 'LEAD'
    : canManageMasters
    ? 'MANAGER'
    : isViewerOnly
    ? 'VIEWER'
    : 'MEMBER';

  // Build deduplicated list of eligible project members for assignee picker & validation
  const toEligibleMember = (u: any, roleLabel: string): EligibleMember | null => {
    if (!u || !u.id) return null;
    return {
      id: u.id,
      name: u.name,
      username: u.username ?? null,
      email: u.email ?? null,
      avatarUrl: u.avatarUrl ?? null,
      avatarColor: u.avatarColor ?? null,
      avatarType: u.avatarType ?? null,
      avatarId: u.avatarId ?? null,
      jobTitle: u.jobTitle ?? null,
      projectRole: roleLabel,
    };
  };

  const memberMap = new Map<number, EligibleMember>();
  const addEligible = (u: any, roleLabel: string) => {
    const entry = toEligibleMember(u, roleLabel);
    if (entry && !memberMap.has(entry.id)) {
      memberMap.set(entry.id, entry);
    }
  };

  // Grouped assignee lists in display order:
  // 1) teams assigned to project, 2) members linked to project, 3) all teams, 4) all org/eligible members
  const mapTeamEntry = (t: any): AssigneeTeamGroup => {
    const teamMemberIds: number[] = Array.from(
      new Set<number>(
        ((t.members || []) as any[])
          .map((tm: any) => Number(tm.user?.id || tm.userId))
          .filter((id: number) => Number.isFinite(id) && id > 0)
      )
    );
    return {
      id: t.id,
      name: t.name,
      color: t.color || '#8B5CF6',
      icon: parseTeamIconFromDescription(t.description),
      memberIds: teamMemberIds,
      memberCount: teamMemberIds.length,
    };
  };

  const teamsGroup: AssigneeTeamGroup[] = [];
  if (project.team) {
    teamsGroup.push(mapTeamEntry(project.team));
    for (const tm of project.team.members) addEligible(tm.user, tm.role || 'Team Member');
  }

  const allTeamsGroup: AssigneeTeamGroup[] = [];
  if (project.organization?.teams) {
    for (const ot of project.organization.teams) {
      if (project.team && ot.id === project.team.id) continue;
      allTeamsGroup.push(mapTeamEntry(ot));
      for (const tm of ot.members || []) addEligible(tm.user, tm.role || 'Team Member');
    }
    allTeamsGroup.sort((a, b) => a.name.localeCompare(b.name));
  }

  const projectMemberMap = new Map<number, EligibleMember>();
  const addProjectMember = (u: any, roleLabel: string) => {
    const entry = toEligibleMember(u, roleLabel);
    if (entry && !projectMemberMap.has(entry.id)) {
      projectMemberMap.set(entry.id, entry);
    }
    addEligible(u, roleLabel);
  };

  addProjectMember(project.owner, 'Owner');
  if (project.lead) addProjectMember(project.lead, 'Lead');
  for (const pm of project.members) addProjectMember(pm.user, pm.role || 'Member');

  const orgMemberMap = new Map<number, EligibleMember>();
  if (project.organization) {
    for (const om of project.organization.members) {
      addEligible(om.user, om.role || 'Org Member');
      if (projectMemberMap.has(om.userId)) continue;
      const entry = toEligibleMember(om.user, om.role || 'Org Member');
      if (entry && !orgMemberMap.has(entry.id)) {
        orgMemberMap.set(entry.id, entry);
      }
    }
  }
  // Ensure any team member not in org.members or projectMembers still appears in All Members
  for (const m of memberMap.values()) {
    if (!projectMemberMap.has(m.id) && !orgMemberMap.has(m.id)) {
      orgMemberMap.set(m.id, m);
    }
  }

  const assigneeGroups: AssigneeGroups = {
    teams: teamsGroup,
    projectMembers: Array.from(projectMemberMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    allTeams: allTeamsGroup,
    orgMembers: Array.from(orgMemberMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
  };

  return {
    allowed: true,
    unauthorized: false,
    notFound: false,
    forbidden: false,
    project,
    user,
    canEditTasks,
    canManageMasters,
    role: effectiveRole,
    eligibleMembers: Array.from(memberMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    eligibleMemberIds: new Set(memberMap.keys()),
    assigneeGroups,
  };
}

function sendAccessError(res: Response, access: Awaited<ReturnType<typeof checkDevelopmentAccess>>) {
  if (access.unauthorized) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  if (access.notFound) {
    return res.status(404).json({ success: false, error: 'Project not found' });
  }
  return res.status(403).json({ success: false, error: 'You do not have access to this project' });
}

// ─── CONFIG & SERIALIZERS ─────────────────────────────────────────────────────

function normalizeChoiceItems(
  rawMetaItems: unknown,
  names: string[],
  defaults: MasterChoiceItem[],
  fallbackIcon: string,
  fallbackColor: string
): MasterChoiceItem[] {
  const defaultMap = new Map(defaults.map((d) => [d.name.toLowerCase(), d]));
  const metaMap = new Map<string, Partial<MasterChoiceItem>>();
  if (Array.isArray(rawMetaItems)) {
    for (const item of rawMetaItems) {
      if (item && typeof item === 'object' && typeof (item as any).name === 'string') {
        const cleanName = (item as any).name.trim();
        if (cleanName) {
          metaMap.set(cleanName.toLowerCase(), {
            name: cleanName,
            icon: typeof (item as any).icon === 'string' && (item as any).icon.trim() ? (item as any).icon.trim() : undefined,
            color: typeof (item as any).color === 'string' && (item as any).color.trim() ? (item as any).color.trim() : undefined,
            isEnd: typeof (item as any).isEnd === 'boolean' ? (item as any).isEnd : undefined,
          });
        }
      }
    }
  }

  return names.map((name) => {
    const key = name.toLowerCase();
    const meta = metaMap.get(key);
    const def = defaultMap.get(key);
    const isCompletedCore = key === 'completed';
    return {
      name,
      icon: meta?.icon || def?.icon || fallbackIcon,
      color: meta?.color || def?.color || fallbackColor,
      isEnd: isCompletedCore ? true : Boolean(meta?.isEnd ?? def?.isEnd ?? false),
    };
  });
}

async function getOrBuildProjectConfig(projectId: number) {
  const row = await prisma.developmentProjectConfig.findUnique({ where: { projectId } });
  const taskPrefix = (row?.taskPrefix || 'DEV').trim().toUpperCase() || 'DEV';
  const taskTypes = parseJsonStringArray(row?.customTaskTypesJson, [...DEFAULT_TASK_TYPES]);
  const statuses = parseJsonStringArray(row?.customStatusesJson, [...DEFAULT_STATUSES]);
  if (!statuses.some((s) => s.toLowerCase() === 'completed')) {
    statuses.push('Completed');
  }
  const priorities = parseJsonStringArray(row?.customPrioritiesJson, [...PRIORITY_LEVELS]);
  const defaultEffortUnit =
    row?.defaultEffortUnit === 'story_points' ? 'story_points' : ('hours' as const);

  let parsedMeta: { priorities?: unknown; statuses?: unknown } = {};
  if (row?.customMasterMetaJson) {
    try {
      const obj = JSON.parse(row.customMasterMetaJson);
      if (obj && typeof obj === 'object') parsedMeta = obj;
    } catch {
      // ignore invalid meta json
    }
  }

  const finalPriorities = priorities.length > 0 ? priorities : [...PRIORITY_LEVELS];
  const priorityItems = normalizeChoiceItems(
    parsedMeta.priorities,
    finalPriorities,
    DEFAULT_PRIORITY_ITEMS,
    'Flag',
    '#F59E0B'
  );
  const statusItems = normalizeChoiceItems(
    parsedMeta.statuses,
    statuses,
    DEFAULT_STATUS_ITEMS,
    'Circle',
    '#71717A'
  );

  const taskTypeSet = new Set<string>(['Development', 'Research', ...taskTypes]);
  return {
    taskPrefix,
    taskTypes: taskTypeSet.size > 0 ? Array.from(taskTypeSet) : [...DEFAULT_TASK_TYPES],
    statuses,
    priorities: finalPriorities,
    priorityItems,
    statusItems,
    defaultEffortUnit,
  };
}

function serializeTask(
  task: any,
  todayKey?: string,
  soonKey?: string,
  opts?: {
    teamById?: Map<number, AssigneeTeamGroup>;
    endStatuses?: Set<string>;
  }
) {
  const keys = todayKey && soonKey ? { todayKey, soonKey } : getTodayAndSoonKeys();
  const flags = computeDateFlags(
    task.status,
    task.dueDate,
    keys.todayKey,
    keys.soonKey,
    opts?.endStatuses
  );
  const teamIds = parseJsonIntArray(task.teamIdsJson);
  const assignedTeams = opts?.teamById
    ? teamIds.map((id) => opts.teamById!.get(id)).filter((t): t is AssigneeTeamGroup => Boolean(t))
    : [];

  return {
    id: task.id,
    projectId: task.projectId,
    taskKey: task.taskKey,
    sequenceNumber: task.sequenceNumber,
    title: task.title,
    description: task.description ?? null,
    taskType: task.taskType,
    moduleId: task.moduleId,
    module: task.module
      ? {
          id: task.module.id,
          name: task.module.name,
          color: task.module.color ?? null,
          icon: task.module.icon ?? null,
          isArchived: Boolean(task.module.isArchived),
        }
      : null,
    submoduleId: task.submoduleId,
    submodule: task.submodule
      ? {
          id: task.submodule.id,
          name: task.submodule.name,
          moduleId: task.submodule.moduleId,
          icon: task.submodule.icon ?? null,
          isArchived: Boolean(task.submodule.isArchived),
        }
      : null,
    priority: task.priority,
    status: task.status,
    startDate: toDateKey(task.startDate),
    dueDate: toDateKey(task.dueDate),
    estimatedEffort: task.estimatedEffort ?? null,
    effortUnit: task.effortUnit === 'story_points' ? 'story_points' : 'hours',
    actualEffort: task.actualEffort ?? null,
    labels: parseJsonStringArray(task.labelsJson, []),
    teamIds,
    assignedTeams,
    position: task.position ?? 0,
    createdById: task.createdById,
    createdBy: task.createdBy,
    assignees: (task.assignees || []).map((a: any) => a.user).filter(Boolean),
    attachments: task.attachments
      ? task.attachments.map((att: any) => ({
          id: att.id,
          taskId: att.taskId,
          projectId: att.projectId,
          documentId: att.documentId ?? null,
          fileName: att.fileName,
          fileUrl: att.fileUrl ?? null,
          fileSize: att.fileSize ?? null,
          mimeType: att.mimeType ?? null,
          uploadedBy: att.uploadedBy ?? null,
          document: att.document ?? null,
          createdAt: att.createdAt?.toISOString?.() || att.createdAt,
        }))
      : undefined,
    commentCount: task._count?.comments ?? 0,
    attachmentCount: task._count?.attachments ?? task.attachments?.length ?? 0,
    isOverdue: flags.isOverdue,
    isDueSoon: flags.isDueSoon,
    isEndStatus: isCompletedStatus(task.status, opts?.endStatuses),
    gitCommit: task.gitCommitSha
      ? {
          sha: task.gitCommitSha,
          shortSha: task.gitCommitSha.slice(0, 7),
          message: task.gitCommitMessage ?? null,
          url: task.gitCommitUrl ?? null,
          repoName: task.gitCommitRepoName ?? null,
          author: task.gitCommitAuthor ?? null,
          committedAt: task.gitCommitDate ? task.gitCommitDate.toISOString() : null,
        }
      : null,
    startedAt: task.startedAt ? task.startedAt.toISOString() : null,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

const taskBaseInclude = {
  module: {
    select: { id: true, name: true, color: true, icon: true, isArchived: true },
  },
  submodule: {
    select: { id: true, name: true, moduleId: true, icon: true, isArchived: true },
  },
  createdBy: { select: userSelectFields },
  assignees: {
    include: { user: { select: userSelectFields } },
    orderBy: { id: 'asc' as const },
  },
  _count: {
    select: { comments: true, attachments: true },
  },
};

// ─── SCHEMAS ──────────────────────────────────────────────────────────────────

const createModuleSchema = z.object({
  name: z.string().trim().min(1, 'Module name is required').max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  icon: z.string().trim().max(60).optional().nullable(),
  color: z.string().trim().max(30).optional().nullable(),
});

const updateModuleSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  icon: z.string().trim().max(60).optional().nullable(),
  color: z.string().trim().max(30).optional().nullable(),
  isArchived: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

const createSubmoduleSchema = z.object({
  moduleId: z.number().int().positive('Parent module is required'),
  name: z.string().trim().min(1, 'Submodule name is required').max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  icon: z.string().trim().max(60).optional().nullable(),
});

const updateSubmoduleSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  moduleId: z.number().int().positive().optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  icon: z.string().trim().max(60).optional().nullable(),
  isArchived: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

const reorderSchema = z.object({
  orderedIds: z.array(z.number().int().positive()).min(1),
});

const migrateSubmoduleSchema = z.object({
  targetSubmoduleId: z.number().int().positive(),
  archiveSource: z.boolean().optional().default(true),
});

const masterChoiceItemSchema = z.object({
  name: z.string().trim().min(1).max(50),
  icon: z.string().trim().min(1).max(40).optional().default('Circle'),
  color: z.string().trim().min(3).max(30).optional().default('#10B981'),
  isEnd: z.boolean().optional(),
});

const gitCommitSchema = z.object({
  sha: z.string().trim().min(4, 'Commit SHA must be at least 4 characters').max(80),
  message: z.string().trim().max(500).optional().nullable(),
  url: z.string().trim().max(1000).optional().nullable(),
  repoName: z.string().trim().max(255).optional().nullable(),
  author: z.string().trim().max(120).optional().nullable(),
  committedAt: z.string().trim().optional().nullable(),
});

function buildGitCommitFields(commit: z.infer<typeof gitCommitSchema> | null) {
  if (!commit) {
    return {
      gitCommitSha: null,
      gitCommitMessage: null,
      gitCommitUrl: null,
      gitCommitRepoName: null,
      gitCommitAuthor: null,
      gitCommitDate: null,
    };
  }
  const parsedDate = commit.committedAt ? new Date(commit.committedAt) : null;
  return {
    gitCommitSha: commit.sha,
    gitCommitMessage: commit.message ?? null,
    gitCommitUrl: commit.url ?? null,
    gitCommitRepoName: commit.repoName ?? null,
    gitCommitAuthor: commit.author ?? null,
    gitCommitDate: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null,
  };
}

const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255),
  description: z.string().max(20000).optional().nullable(),
  taskType: z.string().trim().min(1).max(60).optional().default('Development'),
  moduleId: z.number().int().positive('Module is required'),
  submoduleId: z.number().int().positive('Submodule is required'),
  assigneeIds: z.array(z.number().int().positive()).optional().default([]),
  teamIds: z.array(z.number().int().positive()).optional().default([]),
  priority: z.string().trim().min(1).max(60).optional().default('Medium'),
  status: z.string().trim().min(1).max(60).optional().default('Not Started'),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  estimatedEffort: z.number().min(0).max(100000).optional().nullable(),
  effortUnit: z.enum(['hours', 'story_points']).optional(),
  actualEffort: z.number().min(0).max(100000).optional().nullable(),
  labels: z.array(z.string().trim().min(1).max(40)).max(25).optional().default([]),
  attachmentDocumentIds: z.array(z.number().int().positive()).optional().default([]),
  externalAttachments: z
    .array(
      z.object({
        fileName: z.string().trim().min(1).max(255),
        fileUrl: z.string().trim().min(1).max(2000),
        mimeType: z.string().trim().max(120).optional(),
        fileSize: z.number().int().min(0).optional(),
      })
    )
    .optional()
    .default([]),
  gitCommit: gitCommitSchema.optional().nullable(),
});

const updateTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').max(255).optional(),
  description: z.string().max(20000).optional().nullable(),
  taskType: z.string().trim().min(1).max(60).optional(),
  moduleId: z.number().int().positive().optional(),
  submoduleId: z.number().int().positive().optional(),
  assigneeIds: z.array(z.number().int().positive()).optional(),
  teamIds: z.array(z.number().int().positive()).optional(),
  priority: z.string().trim().min(1).max(60).optional(),
  status: z.string().trim().min(1).max(60).optional(),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  estimatedEffort: z.number().min(0).max(100000).optional().nullable(),
  effortUnit: z.enum(['hours', 'story_points']).optional(),
  actualEffort: z.number().min(0).max(100000).optional().nullable(),
  labels: z.array(z.string().trim().min(1).max(40)).max(25).optional(),
  gitCommit: gitCommitSchema.optional().nullable(),
});

const updateConfigSchema = z.object({
  taskPrefix: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .regex(/^[A-Za-z0-9]+$/, 'Prefix must be alphanumeric')
    .optional(),
  taskTypes: z.array(z.string().trim().min(1).max(50)).min(1).max(20).optional(),
  statuses: z.array(z.string().trim().min(1).max(50)).min(1).max(25).optional(),
  priorities: z.array(z.string().trim().min(1).max(50)).min(1).max(25).optional(),
  statusItems: z.array(masterChoiceItemSchema).min(1).max(25).optional(),
  priorityItems: z.array(masterChoiceItemSchema).min(1).max(25).optional(),
  defaultEffortUnit: z.enum(['hours', 'story_points']).optional(),
});

// ─── DASHBOARD & ANALYTICS ────────────────────────────────────────────────────

developmentRouter.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const userId = getUserIdFromToken(req);
    const access = await checkDevelopmentAccess(projectId, userId);
    if (!access.allowed || !access.project) {
      return sendAccessError(res, access);
    }

    const filterModuleId = req.query.moduleId ? parseInt(String(req.query.moduleId), 10) : NaN;
    const filterStartDate = parseDateOnly(typeof req.query.startDate === 'string' ? req.query.startDate : null);
    const filterEndDate = parseDateOnly(typeof req.query.endDate === 'string' ? req.query.endDate : null);

    const taskWhere: any = { projectId };
    if (!Number.isNaN(filterModuleId) && filterModuleId > 0) {
      taskWhere.moduleId = filterModuleId;
    }
    if (filterStartDate || filterEndDate) {
      // Match tasks created or due within requested date range so date filter scopes work items reliably
      const endOfRange = filterEndDate ? new Date(filterEndDate.getTime() + 86399999) : null;
      taskWhere.OR = [
        {
          dueDate: {
            ...(filterStartDate ? { gte: filterStartDate } : {}),
            ...(endOfRange ? { lte: endOfRange } : {}),
          },
        },
        {
          dueDate: null,
          createdAt: {
            ...(filterStartDate ? { gte: filterStartDate } : {}),
            ...(endOfRange ? { lte: endOfRange } : {}),
          },
        },
      ];
    }

    const [config, allModules, tasks] = await Promise.all([
      getOrBuildProjectConfig(projectId),
      prisma.developmentModule.findMany({
        where: { projectId },
        include: {
          submodules: {
            orderBy: [{ position: 'asc' }, { id: 'asc' }],
          },
        },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      }),
      prisma.developmentTask.findMany({
        where: taskWhere,
        include: {
          ...taskBaseInclude,
          activities: {
            where: { action: 'status_changed' },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { createdAt: true },
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      }),
    ]);

    const { todayKey, soonKey } = getTodayAndSoonKeys();
    const endStatusSet = buildEndStatusSet(config.statusItems);
    const teamById = buildTeamLookup(access.assigneeGroups);
    const serializedTasks = tasks.map((t) =>
      serializeTask(t, todayKey, soonKey, { teamById, endStatuses: endStatusSet })
    );

    const totalWorkItems = serializedTasks.length;
    let completedCount = 0;
    let inProgressCount = 0;
    let notStartedCount = 0;
    let inReviewCount = 0;
    let blockedCount = 0;
    let overdueCount = 0;
    let dueSoonCount = 0;
    let unassignedCount = 0;

    const statusCounts = new Map<string, number>();
    const priorityCounts = new Map<string, number>();
    const typeCounts = new Map<string, number>();
    const workloadMap = new Map<
      number,
      { user: any; activeCount: number; completedCount: number; overdueCount: number; totalAssigned: number }
    >();

    // Pre-populate eligible members at 0 so managers see full team workload distribution clearly
    for (const member of access.eligibleMembers) {
      workloadMap.set(member.id, {
        user: member,
        activeCount: 0,
        completedCount: 0,
        overdueCount: 0,
        totalAssigned: 0,
      });
    }

    const nowMs = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    let completedLast7d = 0;
    let completedPrev7d = 0;
    let createdLast7d = 0;

    for (const task of serializedTasks) {
      const stLower = task.status.trim().toLowerCase();
      if (isCompletedStatus(task.status, endStatusSet)) completedCount++;
      else if (stLower === 'in progress') inProgressCount++;
      else if (stLower === 'not started') notStartedCount++;
      else if (stLower === 'in review') inReviewCount++;
      else if (stLower === 'blocked') blockedCount++;

      if (task.isOverdue) overdueCount++;
      if (task.isDueSoon) dueSoonCount++;
      if (task.assignees.length === 0) unassignedCount++;

      statusCounts.set(task.status, (statusCounts.get(task.status) || 0) + 1);
      priorityCounts.set(task.priority, (priorityCounts.get(task.priority) || 0) + 1);
      typeCounts.set(task.taskType, (typeCounts.get(task.taskType) || 0) + 1);

      const createdAge = nowMs - new Date(task.createdAt).getTime();
      if (createdAge >= 0 && createdAge <= sevenDaysMs) {
        createdLast7d++;
      }
      if (task.completedAt) {
        const compAge = nowMs - new Date(task.completedAt).getTime();
        if (compAge >= 0 && compAge <= sevenDaysMs) completedLast7d++;
        else if (compAge > sevenDaysMs && compAge <= sevenDaysMs * 2) completedPrev7d++;
      }

      for (const assignee of task.assignees) {
        let entry = workloadMap.get(assignee.id);
        if (!entry) {
          entry = {
            user: assignee,
            activeCount: 0,
            completedCount: 0,
            overdueCount: 0,
            totalAssigned: 0,
          };
          workloadMap.set(assignee.id, entry);
        }
        entry.totalAssigned++;
        if (isCompletedStatus(task.status, endStatusSet)) {
          entry.completedCount++;
        } else {
          entry.activeCount++;
        }
        if (task.isOverdue) {
          entry.overdueCount++;
        }
      }
    }

    const completionRate = totalWorkItems > 0 ? Math.round((completedCount / totalWorkItems) * 100) : 0;
    const recentCompletedDelta =
      completedLast7d > 0 || completedPrev7d > 0 ? completedLast7d - completedPrev7d : null;

    const teamWorkload = Array.from(workloadMap.values())
      .filter((w) => w.totalAssigned > 0 || w.activeCount > 0)
      .sort((a, b) => b.activeCount - a.activeCount || b.totalAssigned - a.totalAssigned);

    // Status, Priority, Type breakdowns
    const statusItemMap = new Map(config.statusItems.map((s) => [s.name.toLowerCase(), s]));
    const allStatusesOrdered = Array.from(new Set([...config.statuses, ...statusCounts.keys()]));
    const byStatus = allStatusesOrdered.map((st) => {
      const count = statusCounts.get(st) || 0;
      const meta = statusItemMap.get(st.toLowerCase());
      return {
        key: st,
        label: st,
        count,
        percentage: totalWorkItems > 0 ? Math.round((count / totalWorkItems) * 100) : 0,
        color: meta?.color || STATUS_COLORS[st] || '#6366F1',
      };
    });

    const priorityItemMap = new Map(config.priorityItems.map((p) => [p.name.toLowerCase(), p]));
    const allPrioritiesOrdered = Array.from(new Set([...config.priorities, ...priorityCounts.keys()]));
    const byPriority = allPrioritiesOrdered.map((p) => {
      const count = priorityCounts.get(p) || 0;
      const meta = priorityItemMap.get(p.toLowerCase());
      return {
        key: p,
        label: p,
        count,
        percentage: totalWorkItems > 0 ? Math.round((count / totalWorkItems) * 100) : 0,
        color: meta?.color || PRIORITY_COLORS[p] || '#F59E0B',
      };
    });

    // Real 14-day Created vs Completed trend from database tasks
    const dailyTrendMap = new Map<string, { created: number; completed: number }>();
    const dayKeys: string[] = [];
    for (let offset = 13; offset >= 0; offset--) {
      const d = new Date(Date.now() - offset * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dayKeys.push(key);
      dailyTrendMap.set(key, { created: 0, completed: 0 });
    }
    for (const task of serializedTasks) {
      const createdKey = task.createdAt ? String(task.createdAt).slice(0, 10) : '';
      if (createdKey && dailyTrendMap.has(createdKey)) {
        dailyTrendMap.get(createdKey)!.created += 1;
      }
      const compKey = task.completedAt ? String(task.completedAt).slice(0, 10) : '';
      if (compKey && dailyTrendMap.has(compKey)) {
        dailyTrendMap.get(compKey)!.completed += 1;
      }
    }
    const dailyTrend = dayKeys.map((dateKey) => {
      const d = new Date(`${dateKey}T00:00:00Z`);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      const stats = dailyTrendMap.get(dateKey)!;
      return {
        date: dateKey,
        label,
        created: stats.created,
        completed: stats.completed,
      };
    });

    const allTypesOrdered = Array.from(new Set([...config.taskTypes, ...typeCounts.keys()]));
    const byTaskType = allTypesOrdered.map((tt) => {
      const count = typeCounts.get(tt) || 0;
      return {
        key: tt,
        label: tt,
        count,
        percentage: totalWorkItems > 0 ? Math.round((count / totalWorkItems) * 100) : 0,
        color: TYPE_COLORS[tt] || '#8B5CF6',
      };
    });

    // Progress by Module and Submodule
    const filteredModules = !Number.isNaN(filterModuleId) && filterModuleId > 0
      ? allModules.filter((m) => m.id === filterModuleId)
      : allModules;

    const moduleProgress = filteredModules
      .map((mod) => {
        const modTasks = serializedTasks.filter((t) => t.moduleId === mod.id);
        const modTotal = modTasks.length;
        const modCompleted = modTasks.filter((t) => isCompletedStatus(t.status, endStatusSet)).length;
        const modInProgress = modTasks.filter((t) => t.status.toLowerCase() === 'in progress').length;
        const modOverdue = modTasks.filter((t) => t.isOverdue).length;

        const submodules = mod.submodules
          .map((sub) => {
            const subTasks = modTasks.filter((t) => t.submoduleId === sub.id);
            const subTotal = subTasks.length;
            const subCompleted = subTasks.filter((t) => isCompletedStatus(t.status, endStatusSet)).length;
            const subInProgress = subTasks.filter((t) => t.status.toLowerCase() === 'in progress').length;
            const subOverdue = subTasks.filter((t) => t.isOverdue).length;
            return {
              id: sub.id,
              name: sub.name,
              isArchived: sub.isArchived,
              totalTasks: subTotal,
              completedTasks: subCompleted,
              inProgressTasks: subInProgress,
              overdueTasks: subOverdue,
              completionRate: subTotal > 0 ? Math.round((subCompleted / subTotal) * 100) : 0,
            };
          })
          .filter((s) => !s.isArchived || s.totalTasks > 0);

        return {
          id: mod.id,
          name: mod.name,
          color: mod.color ?? null,
          isArchived: mod.isArchived,
          totalTasks: modTotal,
          completedTasks: modCompleted,
          inProgressTasks: modInProgress,
          overdueTasks: modOverdue,
          completionRate: modTotal > 0 ? Math.round((modCompleted / modTotal) * 100) : 0,
          submodules,
        };
      })
      .filter((m) => !m.isArchived || m.totalTasks > 0);

    // Planned vs Actual time comparison (planned from task assignment/start -> due, actual from first status transition -> end status)
    const plannedVsActualItems = tasks.map((rawTask) => {
      const ser = serializedTasks.find((s) => s.id === rawTask.id)!;
      const isEnded = isCompletedStatus(rawTask.status, endStatusSet);
      const startKey = toDateKey(rawTask.startDate);
      const createdKey = toDateKey(rawTask.createdAt);
      const plannedStartMs =
        rawTask.startDate && startKey && createdKey && startKey !== createdKey
          ? new Date(rawTask.startDate).getTime()
          : rawTask.createdAt.getTime();
      const plannedEndSource = rawTask.dueDate || rawTask.startDate || rawTask.createdAt;
      const plannedEndMs =
        new Date(plannedEndSource).getTime() + (rawTask.dueDate || rawTask.startDate ? 24 * 60 * 60 * 1000 - 1 : 0);
      const plannedHours = Math.max(0.5, +((Math.max(plannedEndMs, plannedStartMs) - plannedStartMs) / 3600000).toFixed(1));

      const fallbackFirstMove = (rawTask as any).activities?.[0]?.createdAt ?? null;
      const actualStartDateObj =
        rawTask.startedAt || fallbackFirstMove || (isEnded ? rawTask.completedAt || rawTask.updatedAt : null);
      const actualEndDateObj = isEnded ? rawTask.completedAt || rawTask.updatedAt : null;

      let actualHours: number | null = null;
      if (actualStartDateObj) {
        const endMs = actualEndDateObj ? new Date(actualEndDateObj).getTime() : nowMs;
        actualHours = Math.max(0.1, +((Math.max(endMs, new Date(actualStartDateObj).getTime()) - new Date(actualStartDateObj).getTime()) / 3600000).toFixed(1));
      }

      const varianceHours =
        actualEndDateObj && actualHours !== null ? +(actualHours - plannedHours).toFixed(1) : null;

      let outcome: 'ahead' | 'on_time' | 'delayed' | 'in_progress' | 'not_started' = 'not_started';
      if (actualEndDateObj) {
        if (new Date(actualEndDateObj).getTime() > plannedEndMs) {
          outcome = 'delayed';
        } else if (varianceHours !== null && varianceHours < -1) {
          outcome = 'ahead';
        } else {
          outcome = 'on_time';
        }
      } else if (actualStartDateObj) {
        outcome = nowMs > plannedEndMs ? 'delayed' : 'in_progress';
      }

      return {
        id: rawTask.id,
        taskKey: rawTask.taskKey,
        title: rawTask.title,
        status: rawTask.status,
        isEndStatus: isEnded,
        plannedStartAt: new Date(plannedStartMs).toISOString(),
        plannedEndAt: new Date(plannedEndMs).toISOString(),
        actualStartAt: actualStartDateObj ? new Date(actualStartDateObj).toISOString() : null,
        actualEndAt: actualEndDateObj ? new Date(actualEndDateObj).toISOString() : null,
        plannedHours,
        actualHours,
        varianceHours,
        outcome,
      };
    });

    const completedWithActual = plannedVsActualItems.filter((i) => i.isEndStatus && i.actualHours !== null);
    const totalPlannedHours = +plannedVsActualItems.reduce((s, i) => s + i.plannedHours, 0).toFixed(1);
    const totalActualHours = +completedWithActual.reduce((s, i) => s + (i.actualHours || 0), 0).toFixed(1);
    const plannedVsActual = {
      summary: {
        totalTracked: plannedVsActualItems.length,
        completedTracked: completedWithActual.length,
        aheadOrOnTimeCount: completedWithActual.filter((i) => i.outcome === 'ahead' || i.outcome === 'on_time').length,
        delayedCount: plannedVsActualItems.filter((i) => i.outcome === 'delayed').length,
        inProgressCount: plannedVsActualItems.filter((i) => i.outcome === 'in_progress').length,
        avgPlannedHours:
          plannedVsActualItems.length > 0
            ? +(totalPlannedHours / plannedVsActualItems.length).toFixed(1)
            : 0,
        avgActualHours:
          completedWithActual.length > 0
            ? +(totalActualHours / completedWithActual.length).toFixed(1)
            : 0,
        totalPlannedHours,
        totalActualHours,
      },
      items: plannedVsActualItems.slice(0, 12),
    };

    const overdueTasks = serializedTasks
      .filter((t) => t.isOverdue)
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

    const dueSoonTasks = serializedTasks
      .filter((t) => t.isDueSoon)
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

    return res.json({
      success: true,
      data: {
        projectMeta: {
          id: access.project.id,
          title: access.project.title,
          identifier: access.project.identifier ?? null,
          status: access.project.status,
          lead: access.project.lead ?? access.project.owner ?? null,
          startDate: toDateKey(access.project.startDate),
          endDate: toDateKey(access.project.endDate),
        },
        permissions: {
          canEditTasks: access.canEditTasks,
          canManageMasters: access.canManageMasters,
          role: access.role,
        },
        config,
        eligibleMembers: access.eligibleMembers,
        assigneeGroups: access.assigneeGroups,
        metrics: {
          totalWorkItems,
          completedCount,
          inProgressCount,
          notStartedCount,
          inReviewCount,
          blockedCount,
          overdueCount,
          dueSoonCount,
          completionRate,
          unassignedCount,
          recentCompletedDelta,
          recentCreatedCount: createdLast7d,
          teamWorkload,
        },
        analytics: {
          byStatus,
          byPriority,
          byTaskType,
          moduleProgress,
          dailyTrend,
          plannedVsActual,
          recentlyUpdatedTasks: serializedTasks.slice(0, 8),
          overdueTasks: overdueTasks.slice(0, 10),
          dueSoonTasks: dueSoonTasks.slice(0, 10),
        },
      },
    });
  } catch (error: any) {
    console.error('[DevManagement] Failed to load dashboard:', error);
    return res.status(500).json({ success: false, error: 'Failed to load development dashboard' });
  }
});

// ─── SETTINGS (PREFIX / TYPES / STATUSES / PRIORITIES / EFFORT UNIT) ────────

developmentRouter.get('/settings', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const userId = getUserIdFromToken(req);
    const access = await checkDevelopmentAccess(projectId, userId);
    if (!access.allowed) return sendAccessError(res, access);

    const config = await getOrBuildProjectConfig(projectId);
    return res.json({ success: true, data: config });
  } catch (error: any) {
    console.error('[DevManagement] Failed to load settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to load development settings' });
  }
});

developmentRouter.put('/settings', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const userId = getUserIdFromToken(req);
    const access = await checkDevelopmentAccess(projectId, userId);
    if (!access.allowed) return sendAccessError(res, access);
    if (!access.canManageMasters) {
      return res.status(403).json({ success: false, error: 'Only project admins or leads can update development settings' });
    }

    const parsed = updateConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues[0]?.message || 'Validation failed',
      });
    }

    const existing = await getOrBuildProjectConfig(projectId);
    const nextPrefix = parsed.data.taskPrefix ? parsed.data.taskPrefix.toUpperCase() : existing.taskPrefix;
    const nextTypes = parsed.data.taskTypes || existing.taskTypes;

    const dedupeItems = (items: MasterChoiceItem[]): MasterChoiceItem[] => {
      const seen = new Set<string>();
      const out: MasterChoiceItem[] = [];
      for (const item of items) {
        const cleanName = item.name.trim();
        const key = cleanName.toLowerCase();
        if (!cleanName || seen.has(key)) continue;
        seen.add(key);
        out.push({
          name: cleanName,
          icon: item.icon || 'Circle',
          color: item.color || '#10B981',
          ...(typeof item.isEnd === 'boolean' || key === 'completed'
            ? { isEnd: key === 'completed' ? true : Boolean(item.isEnd) }
            : {}),
        });
      }
      return out;
    };

    let nextStatusItems: MasterChoiceItem[] = existing.statusItems;
    if (parsed.data.statusItems) {
      nextStatusItems = dedupeItems(parsed.data.statusItems);
    } else if (parsed.data.statuses) {
      nextStatusItems = normalizeChoiceItems(
        existing.statusItems,
        parsed.data.statuses,
        DEFAULT_STATUS_ITEMS,
        'Circle',
        '#71717A'
      );
    }
    if (!nextStatusItems.some((s) => s.name.toLowerCase() === 'completed')) {
      nextStatusItems.push({ name: 'Completed', icon: 'CheckCircle2', color: '#10B981', isEnd: true });
    }
    const nextStatuses = nextStatusItems.map((s) => s.name);

    let nextPriorityItems: MasterChoiceItem[] = existing.priorityItems;
    if (parsed.data.priorityItems) {
      nextPriorityItems = dedupeItems(parsed.data.priorityItems);
    } else if (parsed.data.priorities) {
      nextPriorityItems = normalizeChoiceItems(
        existing.priorityItems,
        parsed.data.priorities,
        DEFAULT_PRIORITY_ITEMS,
        'Flag',
        '#F59E0B'
      );
    }
    const nextPriorities = nextPriorityItems.map((p) => p.name);
    const nextUnit = parsed.data.defaultEffortUnit || existing.defaultEffortUnit;

    const masterMetaJson = JSON.stringify({
      priorities: nextPriorityItems,
      statuses: nextStatusItems,
    });

    await prisma.developmentProjectConfig.upsert({
      where: { projectId },
      create: {
        projectId,
        taskPrefix: nextPrefix,
        customTaskTypesJson: JSON.stringify(nextTypes),
        customStatusesJson: JSON.stringify(nextStatuses),
        customPrioritiesJson: JSON.stringify(nextPriorities),
        customMasterMetaJson: masterMetaJson,
        defaultEffortUnit: nextUnit,
        updatedById: userId!,
      },
      update: {
        taskPrefix: nextPrefix,
        customTaskTypesJson: JSON.stringify(nextTypes),
        customStatusesJson: JSON.stringify(nextStatuses),
        customPrioritiesJson: JSON.stringify(nextPriorities),
        customMasterMetaJson: masterMetaJson,
        defaultEffortUnit: nextUnit,
        updatedById: userId!,
      },
    });

    const updated = await getOrBuildProjectConfig(projectId);
    return res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[DevManagement] Failed to update settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

// ─── MODULE & SUBMODULE MASTERS ──────────────────────────────────────────────

async function fetchMastersWithCounts(projectId: number, includeArchived: boolean) {
  const [modules, taskAggs] = await Promise.all([
    prisma.developmentModule.findMany({
      where: {
        projectId,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      include: {
        submodules: {
          where: includeArchived ? {} : { isArchived: false },
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    }),
    prisma.developmentTask.findMany({
      where: { projectId },
      select: { moduleId: true, submoduleId: true, status: true },
    }),
  ]);

  return modules.map((mod) => {
    const modTasks = taskAggs.filter((t) => t.moduleId === mod.id);
    const modCompleted = modTasks.filter((t) => isCompletedStatus(t.status)).length;
    return {
      ...mod,
      archivedAt: mod.archivedAt ? mod.archivedAt.toISOString() : null,
      createdAt: mod.createdAt.toISOString(),
      updatedAt: mod.updatedAt.toISOString(),
      taskCount: modTasks.length,
      activeTaskCount: modTasks.length - modCompleted,
      completedTaskCount: modCompleted,
      submodules: mod.submodules.map((sub) => {
        const subTasks = modTasks.filter((t) => t.submoduleId === sub.id);
        const subCompleted = subTasks.filter((t) => isCompletedStatus(t.status)).length;
        return {
          ...sub,
          archivedAt: sub.archivedAt ? sub.archivedAt.toISOString() : null,
          createdAt: sub.createdAt.toISOString(),
          updatedAt: sub.updatedAt.toISOString(),
          taskCount: subTasks.length,
          activeTaskCount: subTasks.length - subCompleted,
          completedTaskCount: subCompleted,
        };
      }),
    };
  });
}

developmentRouter.get('/masters/modules', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const userId = getUserIdFromToken(req);
    const access = await checkDevelopmentAccess(projectId, userId);
    if (!access.allowed) return sendAccessError(res, access);

    const includeArchived = req.query.includeArchived === 'true';
    const data = await fetchMastersWithCounts(projectId, includeArchived);
    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('[DevManagement] Failed to list modules:', error);
    return res.status(500).json({ success: false, error: 'Failed to load development modules' });
  }
});

developmentRouter.post('/masters/modules', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const userId = getUserIdFromToken(req);
    const access = await checkDevelopmentAccess(projectId, userId);
    if (!access.allowed) return sendAccessError(res, access);
    if (!access.canManageMasters) {
      return res.status(403).json({ success: false, error: 'Only project admins or leads can create master modules' });
    }

    const parsed = createModuleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues[0]?.message || 'Validation failed',
      });
    }

    const name = parsed.data.name.trim();
    const slug = slugify(name);

    const existing = await prisma.developmentModule.findMany({
      where: { projectId },
      select: { id: true, name: true, slug: true, isArchived: true, position: true },
    });

    const duplicate = existing.find(
      (m) => m.name.trim().toLowerCase() === name.toLowerCase() || m.slug === slug
    );
    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: duplicate.isArchived
          ? `Module "${duplicate.name}" already exists in archive. Restore it from Manage Masters instead.`
          : `Module "${duplicate.name}" already exists in this project.`,
      });
    }

    const maxPos = existing.reduce((max, m) => Math.max(max, m.position), -1);
    const created = await prisma.developmentModule.create({
      data: {
        projectId,
        name,
        slug,
        description: parsed.data.description ?? null,
        icon: parsed.data.icon || 'Layers',
        color: parsed.data.color || '#6366F1',
        position: maxPos + 1,
        createdById: userId!,
      },
    });

    await prisma.developmentTaskActivity.create({
      data: {
        projectId,
        actorId: userId!,
        action: 'module_created',
        field: 'module',
        newValue: created.name,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        ...created,
        archivedAt: null,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        taskCount: 0,
        activeTaskCount: 0,
        completedTaskCount: 0,
        submodules: [],
      },
    });
  } catch (error: any) {
    console.error('[DevManagement] Failed to create module:', error);
    return res.status(500).json({ success: false, error: 'Failed to create development module' });
  }
});

developmentRouter.patch('/masters/modules/:moduleId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const moduleId = parseId(req.params.moduleId);
    if (Number.isNaN(projectId) || Number.isNaN(moduleId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID parameter' });
    }

    const userId = getUserIdFromToken(req);
    const access = await checkDevelopmentAccess(projectId, userId);
    if (!access.allowed) return sendAccessError(res, access);
    if (!access.canManageMasters) {
      return res.status(403).json({ success: false, error: 'Only project admins or leads can update master modules' });
    }

    const parsed = updateModuleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues[0]?.message || 'Validation failed',
      });
    }

    const mod = await prisma.developmentModule.findFirst({
      where: { id: moduleId, projectId },
    });
    if (!mod) {
      return res.status(404).json({ success: false, error: 'Development module not found' });
    }

    const updates: any = {};
    if (parsed.data.name !== undefined) {
      const nextName = parsed.data.name.trim();
      const nextSlug = slugify(nextName);
      const siblings = await prisma.developmentModule.findMany({
        where: { projectId, id: { not: moduleId } },
        select: { name: true, slug: true },
      });
      const dup = siblings.find(
        (s) => s.name.trim().toLowerCase() === nextName.toLowerCase() || s.slug === nextSlug
      );
      if (dup) {
        return res.status(409).json({ success: false, error: `Module "${dup.name}" already exists` });
      }
      updates.name = nextName;
      updates.slug = nextSlug;
    }
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.icon !== undefined) updates.icon = parsed.data.icon;
    if (parsed.data.color !== undefined) updates.color = parsed.data.color;
    if (parsed.data.position !== undefined) updates.position = parsed.data.position;
    if (parsed.data.isArchived !== undefined) {
      updates.isArchived = parsed.data.isArchived;
      updates.archivedAt = parsed.data.isArchived ? new Date() : null;
    }

    const updated = await prisma.developmentModule.update({
      where: { id: moduleId },
      data: updates,
    });

    await prisma.developmentTaskActivity.create({
      data: {
        projectId,
        actorId: userId!,
        action:
          parsed.data.isArchived !== undefined
            ? parsed.data.isArchived
              ? 'module_archived'
              : 'module_restored'
            : 'module_updated',
        field: 'module',
        previousValue: mod.name,
        newValue: updated.name,
      },
    });

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[DevManagement] Failed to update module:', error);
    return res.status(500).json({ success: false, error: 'Failed to update development module' });
  }
});

developmentRouter.post('/masters/modules/reorder', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const userId = getUserIdFromToken(req);
    const access = await checkDevelopmentAccess(projectId, userId);
    if (!access.allowed) return sendAccessError(res, access);
    if (!access.canManageMasters) {
      return res.status(403).json({ success: false, error: 'Only project admins or leads can reorder modules' });
    }

    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid orderedIds array' });
    }

    const existingIds = new Set(
      (await prisma.developmentModule.findMany({ where: { projectId }, select: { id: true } })).map((m) => m.id)
    );
    const validIds = parsed.data.orderedIds.filter((id) => existingIds.has(id));

    await prisma.$transaction(
      validIds.map((id, idx) =>
        prisma.developmentModule.update({ where: { id }, data: { position: idx } })
      )
    );

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[DevManagement] Failed to reorder modules:', error);
    return res.status(500).json({ success: false, error: 'Failed to reorder modules' });
  }
});

developmentRouter.delete('/masters/modules/:moduleId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const moduleId = parseId(req.params.moduleId);
    if (Number.isNaN(projectId) || Number.isNaN(moduleId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID parameter' });
    }

    const userId = getUserIdFromToken(req);
    const access = await checkDevelopmentAccess(projectId, userId);
    if (!access.allowed) return sendAccessError(res, access);
    if (!access.canManageMasters) {
      return res.status(403).json({ success: false, error: 'Only project admins or leads can manage master deletion' });
    }

    const [mod, taskCount] = await Promise.all([
      prisma.developmentModule.findFirst({ where: { id: moduleId, projectId } }),
      prisma.developmentTask.count({ where: { projectId, moduleId } }),
    ]);
    if (!mod) {
      return res.status(404).json({ success: false, error: 'Development module not found' });
    }
    if (taskCount > 0) {
      return res.status(409).json({
        success: false,
        error: `Module "${mod.name}" is referenced by ${taskCount} work item(s). Archive it or migrate its tasks before removing.`,
      });
    }

    await prisma.developmentModule.delete({ where: { id: moduleId } });
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[DevManagement] Failed to delete module:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete module' });
  }
});

developmentRouter.post('/masters/submodules', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const userId = getUserIdFromToken(req);
    const access = await checkDevelopmentAccess(projectId, userId);
    if (!access.allowed) return sendAccessError(res, access);
    if (!access.canManageMasters) {
      return res.status(403).json({ success: false, error: 'Only project admins or leads can create master submodules' });
    }

    const parsed = createSubmoduleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues[0]?.message || 'Validation failed',
      });
    }

    const parentModule = await prisma.developmentModule.findFirst({
      where: { id: parsed.data.moduleId, projectId },
    });
    if (!parentModule) {
      return res.status(404).json({ success: false, error: 'Parent development module not found in this project' });
    }
    if (parentModule.isArchived) {
      return res.status(400).json({ success: false, error: 'Cannot add a submodule to an archived module' });
    }

    const name = parsed.data.name.trim();
    const slug = slugify(name);

    const existingSubs = await prisma.developmentSubmodule.findMany({
      where: { moduleId: parentModule.id, projectId },
      select: { id: true, name: true, slug: true, isArchived: true, position: true },
    });

    const duplicate = existingSubs.find(
      (s) => s.name.trim().toLowerCase() === name.toLowerCase() || s.slug === slug
    );
    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: duplicate.isArchived
          ? `Submodule "${duplicate.name}" already exists in archive under "${parentModule.name}".`
          : `Submodule "${duplicate.name}" already exists under "${parentModule.name}".`,
      });
    }

    const maxPos = existingSubs.reduce((max, s) => Math.max(max, s.position), -1);
    const created = await prisma.developmentSubmodule.create({
      data: {
        projectId,
        moduleId: parentModule.id,
        name,
        slug,
        description: parsed.data.description ?? null,
        icon: parsed.data.icon || 'GitCommitHorizontal',
        position: maxPos + 1,
        createdById: userId!,
      },
    });

    await prisma.developmentTaskActivity.create({
      data: {
        projectId,
        actorId: userId!,
        action: 'submodule_created',
        field: 'submodule',
        newValue: `${parentModule.name} / ${created.name}`,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        ...created,
        archivedAt: null,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        taskCount: 0,
        activeTaskCount: 0,
        completedTaskCount: 0,
      },
    });
  } catch (error: any) {
    console.error('[DevManagement] Failed to create submodule:', error);
    return res.status(500).json({ success: false, error: 'Failed to create development submodule' });
  }
});

developmentRouter.patch('/masters/submodules/:submoduleId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const submoduleId = parseId(req.params.submoduleId);
    if (Number.isNaN(projectId) || Number.isNaN(submoduleId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID parameter' });
    }

    const userId = getUserIdFromToken(req);
    const access = await checkDevelopmentAccess(projectId, userId);
    if (!access.allowed) return sendAccessError(res, access);
    if (!access.canManageMasters) {
      return res.status(403).json({ success: false, error: 'Only project admins or leads can update master submodules' });
    }

    const parsed = updateSubmoduleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues[0]?.message || 'Validation failed',
      });
    }

    const existingSub = await prisma.developmentSubmodule.findFirst({
      where: { id: submoduleId, projectId },
    });
    if (!existingSub) {
      return res.status(404).json({ success: false, error: 'Development submodule not found' });
    }

    const targetModuleId = parsed.data.moduleId ?? existingSub.moduleId;
    if (targetModuleId !== existingSub.moduleId) {
      const targetMod = await prisma.developmentModule.findFirst({
        where: { id: targetModuleId, projectId },
      });
      if (!targetMod) {
        return res.status(404).json({ success: false, error: 'Destination module not found in this project' });
      }
      if (targetMod.isArchived) {
        return res.status(400).json({ success: false, error: 'Cannot move a submodule to an archived module' });
      }
    }

    const nextName = parsed.data.name !== undefined ? parsed.data.name.trim() : existingSub.name;
    const nextSlug = slugify(nextName);

    const siblingsInTarget = await prisma.developmentSubmodule.findMany({
      where: { moduleId: targetModuleId, id: { not: submoduleId } },
      select: { name: true, slug: true },
    });
    const dup = siblingsInTarget.find(
      (s) => s.name.trim().toLowerCase() === nextName.toLowerCase() || s.slug === nextSlug
    );
    if (dup) {
      return res.status(409).json({
        success: false,
        error: `Submodule "${dup.name}" already exists in the target module.`,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const subUpdated = await tx.developmentSubmodule.update({
        where: { id: submoduleId },
        data: {
          name: nextName,
          slug: nextSlug,
          moduleId: targetModuleId,
          ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
          ...(parsed.data.icon !== undefined ? { icon: parsed.data.icon } : {}),
          ...(parsed.data.position !== undefined ? { position: parsed.data.position } : {}),
          ...(parsed.data.isArchived !== undefined
            ? { isArchived: parsed.data.isArchived, archivedAt: parsed.data.isArchived ? new Date() : null }
            : {}),
        },
      });

      // Keep tasks consistent when moving a submodule to a different parent module
      if (targetModuleId !== existingSub.moduleId) {
        await tx.developmentTask.updateMany({
          where: { projectId, submoduleId },
          data: { moduleId: targetModuleId },
        });
      }

      return subUpdated;
    });

    await prisma.developmentTaskActivity.create({
      data: {
        projectId,
        actorId: userId!,
        action:
          targetModuleId !== existingSub.moduleId
            ? 'submodule_moved'
            : parsed.data.isArchived !== undefined
            ? parsed.data.isArchived
              ? 'submodule_archived'
              : 'submodule_restored'
            : 'submodule_updated',
        field: 'submodule',
        previousValue: existingSub.name,
        newValue: updated.name,
      },
    });

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[DevManagement] Failed to update submodule:', error);
    return res.status(500).json({ success: false, error: 'Failed to update development submodule' });
  }
});

developmentRouter.post('/masters/submodules/reorder', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const userId = getUserIdFromToken(req);
    const access = await checkDevelopmentAccess(projectId, userId);
    if (!access.allowed) return sendAccessError(res, access);
    if (!access.canManageMasters) {
      return res.status(403).json({ success: false, error: 'Only project admins or leads can reorder submodules' });
    }

    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid orderedIds array' });
    }

    const existingIds = new Set(
      (await prisma.developmentSubmodule.findMany({ where: { projectId }, select: { id: true } })).map((s) => s.id)
    );
    const validIds = parsed.data.orderedIds.filter((id) => existingIds.has(id));

    await prisma.$transaction(
      validIds.map((id, idx) =>
        prisma.developmentSubmodule.update({ where: { id }, data: { position: idx } })
      )
    );

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[DevManagement] Failed to reorder submodules:', error);
    return res.status(500).json({ success: false, error: 'Failed to reorder submodules' });
  }
});

developmentRouter.post('/masters/submodules/:submoduleId/migrate', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const submoduleId = parseId(req.params.submoduleId);
    if (Number.isNaN(projectId) || Number.isNaN(submoduleId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID parameter' });
    }

    const userId = getUserIdFromToken(req);
    const access = await checkDevelopmentAccess(projectId, userId);
    if (!access.allowed) return sendAccessError(res, access);
    if (!access.canManageMasters) {
      return res.status(403).json({ success: false, error: 'Only project admins or leads can migrate master records' });
    }

    const parsed = migrateSubmoduleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid migration payload' });
    }

    if (parsed.data.targetSubmoduleId === submoduleId) {
      return res.status(400).json({ success: false, error: 'Source and destination submodules cannot be the same' });
    }

    const [sourceSub, targetSub] = await Promise.all([
      prisma.developmentSubmodule.findFirst({ where: { id: submoduleId, projectId } }),
      prisma.developmentSubmodule.findFirst({
        where: { id: parsed.data.targetSubmoduleId, projectId },
        include: { module: true },
      }),
    ]);

    if (!sourceSub || !targetSub) {
      return res.status(404).json({ success: false, error: 'Source or target submodule not found in this project' });
    }
    if (targetSub.isArchived || targetSub.module.isArchived) {
      return res.status(400).json({ success: false, error: 'Cannot migrate tasks to an archived module or submodule' });
    }

    const migratedCount = await prisma.$transaction(async (tx) => {
      const updatedTasks = await tx.developmentTask.updateMany({
        where: { projectId, submoduleId },
        data: {
          moduleId: targetSub.moduleId,
          submoduleId: targetSub.id,
        },
      });
      if (parsed.data.archiveSource) {
        await tx.developmentSubmodule.update({
          where: { id: submoduleId },
          data: { isArchived: true, archivedAt: new Date() },
        });
      }
      await tx.developmentTaskActivity.create({
        data: {
          projectId,
          actorId: userId!,
          action: 'submodule_tasks_migrated',
          field: 'submodule',
          previousValue: sourceSub.name,
          newValue: `${targetSub.module.name} / ${targetSub.name}`,
          metadata: JSON.stringify({ migratedCount: updatedTasks.count }),
        },
      });
      return updatedTasks.count;
    });

    return res.json({ success: true, data: { migratedCount } });
  } catch (error: any) {
    console.error('[DevManagement] Failed to migrate submodule tasks:', error);
    return res.status(500).json({ success: false, error: 'Failed to migrate submodule tasks' });
  }
});

developmentRouter.delete('/masters/submodules/:submoduleId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const submoduleId = parseId(req.params.submoduleId);
    if (Number.isNaN(projectId) || Number.isNaN(submoduleId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID parameter' });
    }

    const userId = getUserIdFromToken(req);
    const access = await checkDevelopmentAccess(projectId, userId);
    if (!access.allowed) return sendAccessError(res, access);
    if (!access.canManageMasters) {
      return res.status(403).json({ success: false, error: 'Only project admins or leads can manage master deletion' });
    }

    const [sub, taskCount] = await Promise.all([
      prisma.developmentSubmodule.findFirst({ where: { id: submoduleId, projectId } }),
      prisma.developmentTask.count({ where: { projectId, submoduleId } }),
    ]);
    if (!sub) {
      return res.status(404).json({ success: false, error: 'Development submodule not found' });
    }
    if (taskCount > 0) {
      return res.status(409).json({
        success: false,
        error: `Submodule "${sub.name}" is referenced by ${taskCount} work item(s). Archive it or migrate its tasks first.`,
      });
    }

    await prisma.developmentSubmodule.delete({ where: { id: submoduleId } });
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[DevManagement] Failed to delete submodule:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete submodule' });
  }
});

// ─── TASKS LIST, CREATE, DETAIL, UPDATE, DELETE ──────────────────────────────

developmentRouter.get('/tasks', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const userId = getUserIdFromToken(req);
    const access = await checkDevelopmentAccess(projectId, userId);
    if (!access.allowed) return sendAccessError(res, access);

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const moduleId = req.query.moduleId ? parseInt(String(req.query.moduleId), 10) : NaN;
    const submoduleId = req.query.submoduleId ? parseInt(String(req.query.submoduleId), 10) : NaN;
    const rawAssignee = typeof req.query.assigneeId === 'string' ? req.query.assigneeId.trim() : '';
    const priority = typeof req.query.priority === 'string' ? req.query.priority.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const taskType = typeof req.query.taskType === 'string' ? req.query.taskType.trim() : '';
    const metric = typeof req.query.metric === 'string' ? req.query.metric.trim() : '';
    const startDateFilter = parseDateOnly(typeof req.query.startDate === 'string' ? req.query.startDate : null);
    const endDateFilter = parseDateOnly(typeof req.query.endDate === 'string' ? req.query.endDate : null);
    const rawTzOffset =
      req.query.tzOffsetMinutes !== undefined ? parseInt(String(req.query.tzOffsetMinutes), 10) : 0;
    const tzOffsetMinutes = Number.isNaN(rawTzOffset) ? 0 : Math.min(840, Math.max(-840, rawTzOffset));
    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(1000, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));

    const where: any = { projectId };
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { taskKey: { contains: search } },
        { description: { contains: search } },
        { labelsJson: { contains: search } },
      ];
    }
    if (!Number.isNaN(moduleId) && moduleId > 0) where.moduleId = moduleId;
    if (!Number.isNaN(submoduleId) && submoduleId > 0) where.submoduleId = submoduleId;
    if (rawAssignee === 'unassigned') {
      where.assignees = { none: {} };
    } else if (rawAssignee) {
      const aId = parseInt(rawAssignee, 10);
      if (!Number.isNaN(aId) && aId > 0) {
        where.assignees = { some: { userId: aId } };
      }
    }
    if (priority) where.priority = priority;
    if (status) where.status = status;
    if (taskType) where.taskType = taskType;

    const config = await getOrBuildProjectConfig(projectId);
    const endStatusSet = buildEndStatusSet(config.statusItems);
    const teamById = buildTeamLookup(access.assigneeGroups);
    const endStatusNames = config.statusItems
      .filter((s) => s.isEnd || s.name.trim().toLowerCase() === 'completed')
      .map((s) => s.name);

    const { todayKey, soonKey } = getTodayAndSoonKeys();
    const todayDate = new Date(`${todayKey}T00:00:00.000Z`);
    const soonDate = new Date(`${soonKey}T00:00:00.000Z`);

    if (metric === 'overdue') {
      where.status = { notIn: endStatusNames.length > 0 ? endStatusNames : ['Completed'] };
      where.dueDate = { lt: todayDate };
    } else if (metric === 'due_soon') {
      where.status = { notIn: endStatusNames.length > 0 ? endStatusNames : ['Completed'] };
      where.dueDate = { gte: todayDate, lte: soonDate };
    } else if (startDateFilter || endDateFilter) {
      const rangeStart = startDateFilter
        ? new Date(startDateFilter.getTime() + tzOffsetMinutes * 60 * 1000)
        : undefined;
      const rangeEnd = endDateFilter
        ? new Date(endDateFilter.getTime() + (24 * 60 * 60 * 1000 - 1) + tzOffsetMinutes * 60 * 1000)
        : undefined;
      where.createdAt = {
        ...(rangeStart ? { gte: rangeStart } : {}),
        ...(rangeEnd ? { lte: rangeEnd } : {}),
      };
    }

    // Priority, dueDate (nulls last), and title (case-insensitive) use deterministic sorting
    if (sortBy === 'priority' || sortBy === 'dueDate' || sortBy === 'title') {
      const allMatching = await prisma.developmentTask.findMany({
        where,
        include: taskBaseInclude,
      });
      allMatching.sort((a, b) => {
        if (sortBy === 'priority') {
          const diff = (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2);
          if (diff !== 0) return sortOrder === 'asc' ? diff : -diff;
          return b.id - a.id;
        }
        if (sortBy === 'title') {
          const diff = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
          if (diff !== 0) return sortOrder === 'asc' ? diff : -diff;
          return b.id - a.id;
        }
        const aTime = a.dueDate ? new Date(a.dueDate).getTime() : null;
        const bTime = b.dueDate ? new Date(b.dueDate).getTime() : null;
        if (aTime === null && bTime === null) return b.id - a.id;
        if (aTime === null) return 1;
        if (bTime === null) return -1;
        const diff = aTime - bTime;
        if (diff !== 0) return sortOrder === 'asc' ? diff : -diff;
        return b.id - a.id;
      });
      const total = allMatching.length;
      const paged = allMatching.slice((page - 1) * limit, page * limit);
      return res.json({
        success: true,
        data: {
          items: paged.map((t) => serializeTask(t, todayKey, soonKey, { teamById, endStatuses: endStatusSet })),
          pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        },
      });
    }

    const orderByMap: Record<string, any> = {
      createdAt: [{ createdAt: sortOrder }, { id: sortOrder }],
      updatedAt: [{ updatedAt: sortOrder }, { id: 'desc' }],
      title: [{ title: sortOrder }, { id: 'desc' }],
      sequenceNumber: [{ sequenceNumber: sortOrder }],
    };

    const [total, items] = await Promise.all([
      prisma.developmentTask.count({ where }),
      prisma.developmentTask.findMany({
        where,
        include: taskBaseInclude,
        orderBy: orderByMap[sortBy] || orderByMap.createdAt,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return res.json({
      success: true,
      data: {
        items: items.map((t) => serializeTask(t, todayKey, soonKey, { teamById, endStatuses: endStatusSet })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      },
    });
  } catch (error: any) {
    console.error('[DevManagement] Failed to list tasks:', error);
    return res.status(500).json({ success: false, error: 'Failed to load development tasks' });
  }
});

developmentRouter.post('/tasks', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const userId = getUserIdFromToken(req);
    const access = await checkDevelopmentAccess(projectId, userId);
    if (!access.allowed) return sendAccessError(res, access);
    if (!access.canEditTasks) {
      return res.status(403).json({ success: false, error: 'Viewers cannot create development tasks' });
    }

    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues[0]?.message || 'Validation failed',
      });
    }

    const input = parsed.data;
    const config = await getOrBuildProjectConfig(projectId);

    // Validate Module & Submodule relationship within same project
    const [mod, sub] = await Promise.all([
      prisma.developmentModule.findFirst({ where: { id: input.moduleId, projectId } }),
      prisma.developmentSubmodule.findFirst({ where: { id: input.submoduleId, projectId } }),
    ]);

    if (!mod) {
      return res.status(400).json({ success: false, error: 'Selected module does not belong to this project' });
    }
    if (mod.isArchived) {
      return res.status(400).json({ success: false, error: 'Cannot assign a new task to an archived module' });
    }
    if (!sub || sub.moduleId !== mod.id) {
      return res.status(400).json({
        success: false,
        error: 'Selected submodule does not belong to the selected module',
      });
    }
    if (sub.isArchived) {
      return res.status(400).json({ success: false, error: 'Cannot assign a new task to an archived submodule' });
    }

    // Validate assignees belong to active project
    const uniqueAssigneeIds = Array.from(new Set(input.assigneeIds || []));
    const invalidAssignee = uniqueAssigneeIds.find((aid) => !access.eligibleMemberIds.has(aid));
    if (invalidAssignee !== undefined) {
      return res.status(400).json({
        success: false,
        error: 'All assigned users must belong to the active project',
      });
    }

    // Validate dates
    const startDate = parseDateOnly(input.startDate);
    const dueDate = parseDateOnly(input.dueDate);
    if (input.startDate && !startDate) {
      return res.status(400).json({ success: false, error: 'Invalid start date format' });
    }
    if (input.dueDate && !dueDate) {
      return res.status(400).json({ success: false, error: 'Invalid due date format' });
    }
    if (startDate && dueDate && dueDate.getTime() < startDate.getTime()) {
      return res.status(400).json({ success: false, error: 'Due date cannot be earlier than start date' });
    }

    // Validate linked ProjectDocuments
    const uniqueDocIds = Array.from(new Set(input.attachmentDocumentIds || []));
    const linkedDocs =
      uniqueDocIds.length > 0
        ? await prisma.projectDocument.findMany({
            where: { id: { in: uniqueDocIds }, projectId, deletedAt: null },
          })
        : [];
    if (linkedDocs.length !== uniqueDocIds.length) {
      return res.status(400).json({
        success: false,
        error: 'One or more attached project documents were not found in this project',
      });
    }

    const dedupedLabels = Array.from(
      new Set((input.labels || []).map((l) => l.trim()).filter(Boolean))
    );
    const statusValue = input.status || config.statuses[0] || 'Not Started';
    const effortUnit = input.effortUnit || config.defaultEffortUnit;
    const endStatusSet = buildEndStatusSet(config.statusItems);
    const teamById = buildTeamLookup(access.assigneeGroups);
    const uniqueTeamIds = Array.from(new Set(input.teamIds || [])).filter((tid) => teamById.has(tid));
    const initialStatus = (config.statuses[0] || 'Not Started').trim().toLowerCase();
    const isInitialEnd = isCompletedStatus(statusValue, endStatusSet);
    const createdTimestamp = new Date();
    const initialStartedAt =
      isInitialEnd || statusValue.trim().toLowerCase() !== initialStatus ? createdTimestamp : null;

    // Create task with transactional sequential key generation and P2002 collision retry
    let createdTask: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        createdTask = await prisma.$transaction(async (tx) => {
          const latest = await tx.developmentTask.findFirst({
            where: { projectId },
            orderBy: { sequenceNumber: 'desc' },
            select: { sequenceNumber: true },
          });
          const nextSeq = (latest?.sequenceNumber || 0) + 1;
          const taskKey = `${config.taskPrefix}-${String(nextSeq).padStart(3, '0')}`;

          const task = await tx.developmentTask.create({
            data: {
              projectId,
              taskKey,
              sequenceNumber: nextSeq,
              title: input.title,
              description: input.description ?? null,
              taskType: input.taskType,
              moduleId: mod.id,
              submoduleId: sub.id,
              priority: input.priority,
              status: statusValue,
              startDate,
              dueDate,
              estimatedEffort: input.estimatedEffort ?? null,
              effortUnit,
              actualEffort: input.actualEffort ?? null,
              labelsJson: dedupedLabels.length > 0 ? JSON.stringify(dedupedLabels) : null,
              teamIdsJson: uniqueTeamIds.length > 0 ? JSON.stringify(uniqueTeamIds) : null,
              ...(input.gitCommit ? buildGitCommitFields(input.gitCommit) : {}),
              createdById: userId!,
              startedAt: initialStartedAt,
              completedAt: isInitialEnd ? createdTimestamp : null,
              assignees: {
                create: uniqueAssigneeIds.map((uid) => ({
                  userId: uid,
                  assignedById: userId!,
                })),
              },
              attachments: {
                create: [
                  ...linkedDocs.map((doc) => ({
                    projectId,
                    documentId: doc.id,
                    fileName: doc.displayName || doc.originalName,
                    fileSize: doc.sizeBytes,
                    mimeType: doc.mimeType,
                    uploadedById: userId!,
                  })),
                  ...(input.externalAttachments || []).map((ext) => ({
                    projectId,
                    fileName: ext.fileName,
                    fileUrl: ext.fileUrl,
                    mimeType: ext.mimeType ?? null,
                    fileSize: ext.fileSize ?? null,
                    uploadedById: userId!,
                  })),
                ],
              },
            },
            include: {
              ...taskBaseInclude,
              attachments: {
                include: {
                  uploadedBy: { select: userSelectFields },
                  document: {
                    select: {
                      id: true,
                      displayName: true,
                      originalName: true,
                      mimeType: true,
                      extension: true,
                      sizeBytes: true,
                    },
                  },
                },
              },
            },
          });

          await tx.developmentTaskActivity.create({
            data: {
              projectId,
              taskId: task.id,
              actorId: userId!,
              action: 'created',
              newValue: `${task.taskKey} · ${task.title}`,
            },
          });

          return task;
        });
        break;
      } catch (err: any) {
        if (err?.code === 'P2002' && attempt < 2) continue;
        throw err;
      }
    }

    return res.status(201).json({
      success: true,
      data: serializeTask(createdTask, undefined, undefined, { teamById, endStatuses: endStatusSet }),
    });
  } catch (error: any) {
    console.error('[DevManagement] Failed to create task:', error);
    return res.status(500).json({ success: false, error: 'Failed to create development task' });
  }
});

developmentRouter.get('/tasks/:taskId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const taskId = parseId(req.params.taskId);
    if (Number.isNaN(projectId) || Number.isNaN(taskId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID parameter' });
    }

    const userId = getUserIdFromToken(req);
    const access = await checkDevelopmentAccess(projectId, userId);
    if (!access.allowed) return sendAccessError(res, access);

    const [task, config] = await Promise.all([
      prisma.developmentTask.findFirst({
        where: { id: taskId, projectId },
        include: {
          ...taskBaseInclude,
          attachments: {
            include: {
              uploadedBy: { select: userSelectFields },
              document: {
                select: {
                  id: true,
                  displayName: true,
                  originalName: true,
                  mimeType: true,
                  extension: true,
                  sizeBytes: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          comments: {
            include: { author: { select: userSelectFields } },
            orderBy: { createdAt: 'asc' },
          },
          activities: {
            include: { actor: { select: userSelectFields } },
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
        },
      }),
      getOrBuildProjectConfig(projectId),
    ]);

    if (!task) {
      return res.status(404).json({ success: false, error: 'Development task not found' });
    }

    const endStatusSet = buildEndStatusSet(config.statusItems);
    const teamById = buildTeamLookup(access.assigneeGroups);
    const serialized = serializeTask(task, undefined, undefined, {
      teamById,
      endStatuses: endStatusSet,
    });
    const firstStatusChangeActivity = [...task.activities]
      .reverse()
      .find((a) => a.action === 'status_changed');
    const resolvedStartedAt =
      serialized.startedAt ||
      (firstStatusChangeActivity
        ? firstStatusChangeActivity.createdAt.toISOString()
        : serialized.completedAt);

    return res.json({
      success: true,
      data: {
        ...serialized,
        startedAt: resolvedStartedAt,
        comments: task.comments.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        })),
        activities: task.activities.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        })),
      },
    });
  } catch (error: any) {
    console.error('[DevManagement] Failed to load task detail:', error);
    return res.status(500).json({ success: false, error: 'Failed to load task details' });
  }
});

developmentRouter.patch('/tasks/:taskId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const taskId = parseId(req.params.taskId);
    if (Number.isNaN(projectId) || Number.isNaN(taskId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID parameter' });
    }

    const userId = getUserIdFromToken(req);
    const access = await checkDevelopmentAccess(projectId, userId);
    if (!access.allowed) return sendAccessError(res, access);
    if (!access.canEditTasks) {
      return res.status(403).json({ success: false, error: 'Viewers cannot modify development tasks' });
    }

    const parsed = updateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues[0]?.message || 'Validation failed',
      });
    }

    const existing = await prisma.developmentTask.findFirst({
      where: { id: taskId, projectId },
      include: {
        module: { select: { id: true, name: true } },
        submodule: { select: { id: true, name: true } },
        assignees: { include: { user: { select: { id: true, name: true } } } },
      },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Development task not found' });
    }

    const input = parsed.data;

    // Validate Module / Submodule if either changed
    const nextModuleId = input.moduleId ?? existing.moduleId;
    const nextSubmoduleId = input.submoduleId ?? existing.submoduleId;
    let nextModuleName = existing.module.name;
    let nextSubmoduleName = existing.submodule.name;

    if (input.moduleId !== undefined || input.submoduleId !== undefined) {
      const [mod, sub] = await Promise.all([
        prisma.developmentModule.findFirst({ where: { id: nextModuleId, projectId } }),
        prisma.developmentSubmodule.findFirst({ where: { id: nextSubmoduleId, projectId } }),
      ]);
      if (!mod) {
        return res.status(400).json({ success: false, error: 'Selected module does not belong to this project' });
      }
      if (!sub || sub.moduleId !== mod.id) {
        return res.status(400).json({
          success: false,
          error: 'Selected submodule does not belong to the selected module',
        });
      }
      if (input.moduleId !== undefined && input.moduleId !== existing.moduleId && mod.isArchived) {
        return res.status(400).json({ success: false, error: 'Cannot move task to an archived module' });
      }
      if (input.submoduleId !== undefined && input.submoduleId !== existing.submoduleId && sub.isArchived) {
        return res.status(400).json({ success: false, error: 'Cannot move task to an archived submodule' });
      }
      nextModuleName = mod.name;
      nextSubmoduleName = sub.name;
    }

    // Validate assignees if provided
    let uniqueAssigneeIds: number[] | undefined;
    if (input.assigneeIds !== undefined) {
      uniqueAssigneeIds = Array.from(new Set(input.assigneeIds));
      const invalidAssignee = uniqueAssigneeIds.find((aid) => !access.eligibleMemberIds.has(aid));
      if (invalidAssignee !== undefined) {
        return res.status(400).json({
          success: false,
          error: 'All assigned users must belong to the active project',
        });
      }
    }

    // Validate dates
    const nextStartDate =
      input.startDate === undefined ? existing.startDate : parseDateOnly(input.startDate);
    const nextDueDate =
      input.dueDate === undefined ? existing.dueDate : parseDateOnly(input.dueDate);
    if (input.startDate && !nextStartDate) {
      return res.status(400).json({ success: false, error: 'Invalid start date format' });
    }
    if (input.dueDate && !nextDueDate) {
      return res.status(400).json({ success: false, error: 'Invalid due date format' });
    }
    if (nextStartDate && nextDueDate && nextDueDate.getTime() < nextStartDate.getTime()) {
      return res.status(400).json({ success: false, error: 'Due date cannot be earlier than start date' });
    }

    // Track activity logs
    const activityEntries: { field: string; action: string; prev: string | null; next: string | null }[] = [];
    if (input.status !== undefined && input.status !== existing.status) {
      activityEntries.push({
        field: 'status',
        action: 'status_changed',
        prev: existing.status,
        next: input.status,
      });
    }
    if (input.priority !== undefined && input.priority !== existing.priority) {
      activityEntries.push({
        field: 'priority',
        action: 'priority_changed',
        prev: existing.priority,
        next: input.priority,
      });
    }
    if (input.title !== undefined && input.title !== existing.title) {
      activityEntries.push({
        field: 'title',
        action: 'updated',
        prev: existing.title,
        next: input.title,
      });
    }
    if (input.moduleId !== undefined && input.moduleId !== existing.moduleId) {
      activityEntries.push({
        field: 'module',
        action: 'updated',
        prev: existing.module.name,
        next: nextModuleName,
      });
    }
    if (input.submoduleId !== undefined && input.submoduleId !== existing.submoduleId) {
      activityEntries.push({
        field: 'submodule',
        action: 'updated',
        prev: existing.submodule.name,
        next: nextSubmoduleName,
      });
    }
    if (input.dueDate !== undefined && toDateKey(nextDueDate) !== toDateKey(existing.dueDate)) {
      activityEntries.push({
        field: 'dueDate',
        action: 'updated',
        prev: toDateKey(existing.dueDate) || 'None',
        next: toDateKey(nextDueDate) || 'None',
      });
    }

    const config = await getOrBuildProjectConfig(projectId);
    const endStatusSet = buildEndStatusSet(config.statusItems);
    const teamById = buildTeamLookup(access.assigneeGroups);

    const updated = await prisma.$transaction(async (tx) => {
      if (uniqueAssigneeIds !== undefined) {
        const prevNames = existing.assignees.map((a) => a.user.name).sort().join(', ');
        await tx.developmentTaskAssignee.deleteMany({ where: { taskId } });
        if (uniqueAssigneeIds.length > 0) {
          await tx.developmentTaskAssignee.createMany({
            data: uniqueAssigneeIds.map((uid) => ({
              taskId,
              userId: uid,
              assignedById: userId!,
            })),
          });
        }
        const nextNames = access.eligibleMembers
          .filter((m) => uniqueAssigneeIds!.includes(m.id))
          .map((m) => m.name)
          .sort()
          .join(', ');
        if (prevNames !== nextNames) {
          activityEntries.push({
            field: 'assignees',
            action: 'assignees_changed',
            prev: prevNames || 'Unassigned',
            next: nextNames || 'Unassigned',
          });
        }
      }

      const updateData: any = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.taskType !== undefined) updateData.taskType = input.taskType;
      if (input.moduleId !== undefined) updateData.moduleId = nextModuleId;
      if (input.submoduleId !== undefined) updateData.submoduleId = nextSubmoduleId;
      if (input.priority !== undefined) updateData.priority = input.priority;
      if (input.status !== undefined) {
        updateData.status = input.status;
        const nextIsEnd = isCompletedStatus(input.status, endStatusSet);
        const now = new Date();
        if (input.status !== existing.status && !existing.startedAt) {
          updateData.startedAt = now;
        }
        if (nextIsEnd && !existing.completedAt) {
          updateData.completedAt = now;
          if (!existing.startedAt && !updateData.startedAt) {
            updateData.startedAt = now;
          }
        } else if (!nextIsEnd) {
          updateData.completedAt = null;
        }
      }
      if (input.teamIds !== undefined) {
        const validTeamIds = Array.from(new Set(input.teamIds)).filter((tid) => teamById.has(tid));
        updateData.teamIdsJson = validTeamIds.length > 0 ? JSON.stringify(validTeamIds) : null;
      }
      if (input.startDate !== undefined) updateData.startDate = nextStartDate;
      if (input.dueDate !== undefined) updateData.dueDate = nextDueDate;
      if (input.estimatedEffort !== undefined) updateData.estimatedEffort = input.estimatedEffort;
      if (input.effortUnit !== undefined) updateData.effortUnit = input.effortUnit;
      if (input.actualEffort !== undefined) updateData.actualEffort = input.actualEffort;
      if (input.labels !== undefined) {
        const cleanLabels = Array.from(new Set(input.labels.map((l) => l.trim()).filter(Boolean)));
        updateData.labelsJson = cleanLabels.length > 0 ? JSON.stringify(cleanLabels) : null;
      }
      if (input.gitCommit !== undefined) {
        Object.assign(updateData, buildGitCommitFields(input.gitCommit ?? null));
        if (input.gitCommit && input.gitCommit.sha !== existing.gitCommitSha) {
          activityEntries.push({
            field: 'git_commit',
            action: 'git_commit_linked',
            prev: existing.gitCommitSha ? existing.gitCommitSha.slice(0, 7) : null,
            next: `${input.gitCommit.sha.slice(0, 7)}${
              input.gitCommit.message ? ` · ${input.gitCommit.message}` : ''
            }`,
          });
        } else if (input.gitCommit === null && existing.gitCommitSha) {
          activityEntries.push({
            field: 'git_commit',
            action: 'git_commit_unlinked',
            prev: existing.gitCommitSha.slice(0, 7),
            next: null,
          });
        }
      }

      const taskRow = await tx.developmentTask.update({
        where: { id: taskId },
        data: updateData,
        include: {
          ...taskBaseInclude,
          attachments: {
            include: {
              uploadedBy: { select: userSelectFields },
              document: {
                select: {
                  id: true,
                  displayName: true,
                  originalName: true,
                  mimeType: true,
                  extension: true,
                  sizeBytes: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (activityEntries.length > 0) {
        await tx.developmentTaskActivity.createMany({
          data: activityEntries.map((entry) => ({
            projectId,
            taskId,
            actorId: userId!,
            action: entry.action,
            field: entry.field,
            previousValue: entry.prev,
            newValue: entry.next,
          })),
        });
      }

      return taskRow;
    });

    return res.json({
      success: true,
      data: serializeTask(updated, undefined, undefined, { teamById, endStatuses: endStatusSet }),
    });
  } catch (error: any) {
    console.error('[DevManagement] Failed to update task:', error);
    return res.status(500).json({ success: false, error: 'Failed to update development task' });
  }
});

developmentRouter.patch('/tasks/:taskId/status', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const taskId = parseId(req.params.taskId);
    if (Number.isNaN(projectId) || Number.isNaN(taskId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID parameter' });
    }

    const userId = getUserIdFromToken(req);
    const access = await checkDevelopmentAccess(projectId, userId);
    if (!access.allowed) return sendAccessError(res, access);
    if (!access.canEditTasks) {
      return res.status(403).json({ success: false, error: 'Viewers cannot update task statuses' });
    }

    const statusRaw = typeof req.body?.status === 'string' ? req.body.status.trim() : '';
    if (!statusRaw) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }

    let parsedCommit: z.infer<typeof gitCommitSchema> | null | undefined = undefined;
    if (req.body?.gitCommit !== undefined) {
      if (req.body.gitCommit === null) {
        parsedCommit = null;
      } else {
        const commitRes = gitCommitSchema.safeParse(req.body.gitCommit);
        if (!commitRes.success) {
          return res.status(400).json({
            success: false,
            error: commitRes.error.issues[0]?.message || 'Invalid git commit payload',
          });
        }
        parsedCommit = commitRes.data;
      }
    }

    const [existing, config] = await Promise.all([
      prisma.developmentTask.findFirst({ where: { id: taskId, projectId } }),
      getOrBuildProjectConfig(projectId),
    ]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Development task not found' });
    }

    const endStatusSet = buildEndStatusSet(config.statusItems);
    const teamById = buildTeamLookup(access.assigneeGroups);
    const isEnd = isCompletedStatus(statusRaw, endStatusSet);
    const statusChanged = existing.status !== statusRaw;
    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const task = await tx.developmentTask.update({
        where: { id: taskId },
        data: {
          status: statusRaw,
          startedAt: existing.startedAt || (statusChanged || isEnd ? now : null),
          completedAt: isEnd ? existing.completedAt || now : null,
          ...(parsedCommit !== undefined ? buildGitCommitFields(parsedCommit) : {}),
        },
        include: taskBaseInclude,
      });

      if (statusChanged) {
        await tx.developmentTaskActivity.create({
          data: {
            projectId,
            taskId,
            actorId: userId!,
            action: 'status_changed',
            field: 'status',
            previousValue: existing.status,
            newValue: statusRaw,
          },
        });
      }

      if (parsedCommit && parsedCommit.sha !== existing.gitCommitSha) {
        await tx.developmentTaskActivity.create({
          data: {
            projectId,
            taskId,
            actorId: userId!,
            action: 'git_commit_linked',
            field: 'git_commit',
            previousValue: existing.gitCommitSha ? existing.gitCommitSha.slice(0, 7) : null,
            newValue: `${parsedCommit.sha.slice(0, 7)}${
              parsedCommit.message ? ` · ${parsedCommit.message}` : ''
            }`,
          },
        });
      }

      return task;
    });

    return res.json({
      success: true,
      data: serializeTask(updated, undefined, undefined, { teamById, endStatuses: endStatusSet }),
    });
  } catch (error: any) {
    console.error('[DevManagement] Failed to update task status:', error);
    return res.status(500).json({ success: false, error: 'Failed to update task status' });
  }
});

developmentRouter.delete('/tasks/:taskId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const taskId = parseId(req.params.taskId);
    if (Number.isNaN(projectId) || Number.isNaN(taskId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID parameter' });
    }

    const userId = getUserIdFromToken(req);
    const access = await checkDevelopmentAccess(projectId, userId);
    if (!access.allowed) return sendAccessError(res, access);

    const existing = await prisma.developmentTask.findFirst({ where: { id: taskId, projectId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Development task not found' });
    }

    // Only creator or admin/lead/manager may delete work items
    if (!access.canManageMasters && existing.createdById !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only project admins, leads, or the task creator can delete a work item',
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.developmentTaskActivity.create({
        data: {
          projectId,
          actorId: userId!,
          action: 'deleted',
          field: 'task',
          previousValue: `${existing.taskKey} · ${existing.title}`,
        },
      });
      await tx.developmentTask.delete({ where: { id: taskId } });
    });

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[DevManagement] Failed to delete task:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete task' });
  }
});

// ─── TASK COMMENTS & ATTACHMENTS ─────────────────────────────────────────────

developmentRouter.post('/tasks/:taskId/comments', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const taskId = parseId(req.params.taskId);
    if (Number.isNaN(projectId) || Number.isNaN(taskId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID parameter' });
    }

    const userId = getUserIdFromToken(req);
    const access = await checkDevelopmentAccess(projectId, userId);
    if (!access.allowed) return sendAccessError(res, access);
    if (!access.canEditTasks) {
      return res.status(403).json({ success: false, error: 'Viewers cannot comment on tasks' });
    }

    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    if (!body) {
      return res.status(400).json({ success: false, error: 'Comment text is required' });
    }

    const task = await prisma.developmentTask.findFirst({ where: { id: taskId, projectId } });
    if (!task) {
      return res.status(404).json({ success: false, error: 'Development task not found' });
    }

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.developmentTaskComment.create({
        data: { taskId, authorId: userId!, body },
        include: { author: { select: userSelectFields } },
      });

      await tx.developmentTaskActivity.create({
        data: {
          projectId,
          taskId,
          actorId: userId!,
          action: 'comment_added',
          field: 'comment',
          newValue: body.slice(0, 140),
        },
      });

      return created;
    });

    return res.status(201).json({
      success: true,
      data: {
        ...comment,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[DevManagement] Failed to add comment:', error);
    return res.status(500).json({ success: false, error: 'Failed to add comment' });
  }
});

developmentRouter.post('/tasks/:taskId/attachments', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const taskId = parseId(req.params.taskId);
    if (Number.isNaN(projectId) || Number.isNaN(taskId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID parameter' });
    }

    const userId = getUserIdFromToken(req);
    const access = await checkDevelopmentAccess(projectId, userId);
    if (!access.allowed) return sendAccessError(res, access);
    if (!access.canEditTasks) {
      return res.status(403).json({ success: false, error: 'Viewers cannot attach files to tasks' });
    }

    const task = await prisma.developmentTask.findFirst({ where: { id: taskId, projectId } });
    if (!task) {
      return res.status(404).json({ success: false, error: 'Development task not found' });
    }

    const documentId = req.body?.documentId ? parseInt(String(req.body.documentId), 10) : NaN;
    let payload: any;

    if (!Number.isNaN(documentId) && documentId > 0) {
      const doc = await prisma.projectDocument.findFirst({
        where: { id: documentId, projectId, deletedAt: null },
      });
      if (!doc) {
        return res.status(404).json({ success: false, error: 'Project document not found' });
      }
      const alreadyLinked = await prisma.developmentTaskAttachment.findFirst({
        where: { taskId, documentId: doc.id },
      });
      if (alreadyLinked) {
        return res.status(409).json({ success: false, error: 'Document is already attached to this task' });
      }
      payload = {
        taskId,
        projectId,
        documentId: doc.id,
        fileName: doc.displayName || doc.originalName,
        fileSize: doc.sizeBytes,
        mimeType: doc.mimeType,
        uploadedById: userId!,
      };
    } else {
      const fileName = typeof req.body?.fileName === 'string' ? req.body.fileName.trim() : '';
      const fileUrl = typeof req.body?.fileUrl === 'string' ? req.body.fileUrl.trim() : '';
      if (!fileName || !fileUrl) {
        return res.status(400).json({
          success: false,
          error: 'Either a valid documentId or fileName + fileUrl is required',
        });
      }
      payload = {
        taskId,
        projectId,
        fileName,
        fileUrl,
        mimeType: typeof req.body?.mimeType === 'string' ? req.body.mimeType : null,
        fileSize: typeof req.body?.fileSize === 'number' ? req.body.fileSize : null,
        uploadedById: userId!,
      };
    }

    const attachment = await prisma.$transaction(async (tx) => {
      const created = await tx.developmentTaskAttachment.create({
        data: payload,
        include: {
          uploadedBy: { select: userSelectFields },
          document: {
            select: {
              id: true,
              displayName: true,
              originalName: true,
              mimeType: true,
              extension: true,
              sizeBytes: true,
            },
          },
        },
      });
      await tx.developmentTaskActivity.create({
        data: {
          projectId,
          taskId,
          actorId: userId!,
          action: 'attachment_added',
          field: 'attachment',
          newValue: created.fileName,
        },
      });
      return created;
    });

    return res.status(201).json({
      success: true,
      data: {
        ...attachment,
        createdAt: attachment.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[DevManagement] Failed to add attachment:', error);
    return res.status(500).json({ success: false, error: 'Failed to attach file' });
  }
});

developmentRouter.delete('/tasks/:taskId/attachments/:attId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const taskId = parseId(req.params.taskId);
    const attId = parseId(req.params.attId);
    if (Number.isNaN(projectId) || Number.isNaN(taskId) || Number.isNaN(attId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID parameter' });
    }

    const userId = getUserIdFromToken(req);
    const access = await checkDevelopmentAccess(projectId, userId);
    if (!access.allowed) return sendAccessError(res, access);
    if (!access.canEditTasks) {
      return res.status(403).json({ success: false, error: 'Viewers cannot remove attachments' });
    }

    const att = await prisma.developmentTaskAttachment.findFirst({
      where: { id: attId, taskId, projectId },
    });
    if (!att) {
      return res.status(404).json({ success: false, error: 'Attachment not found' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.developmentTaskAttachment.delete({ where: { id: attId } });
      await tx.developmentTaskActivity.create({
        data: {
          projectId,
          taskId,
          actorId: userId!,
          action: 'attachment_removed',
          field: 'attachment',
          previousValue: att.fileName,
        },
      });
    });

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[DevManagement] Failed to remove attachment:', error);
    return res.status(500).json({ success: false, error: 'Failed to remove attachment' });
  }
});

// Direct GitHub upload for development task attachments into module-{moduleId} folder on main branch
developmentRouter.post('/attachments/upload', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const userId = getUserIdFromToken(req);
    const access = await checkDevelopmentAccess(projectId, userId);
    if (!access.allowed) return sendAccessError(res, access);
    if (!access.canEditTasks) {
      return res.status(403).json({ success: false, error: 'Viewers cannot upload task attachments' });
    }

    const moduleId = req.body?.moduleId ? parseInt(String(req.body.moduleId), 10) : NaN;
    if (Number.isNaN(moduleId) || moduleId <= 0) {
      return res.status(400).json({ success: false, error: 'Application module is required before uploading attachments' });
    }

    const mod = await prisma.developmentModule.findFirst({
      where: { id: moduleId, projectId },
    });
    if (!mod) {
      return res.status(404).json({ success: false, error: 'Selected module does not belong to this project' });
    }

    const storageConn = await (prisma as any).projectStorageConnection.findUnique({
      where: { projectId },
    });
    if (storageConn && storageConn.status === 'unlinked') {
      return res.status(423).json({
        success: false,
        error:
          'Document storage repository is currently unlinked. Relink the repository in Project Settings > Storage before uploading files.',
      });
    }

    const files = req.body?.files;
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files provided for upload' });
    }

    const settings = await (prisma as any).documentModuleSettings.findUnique({
      where: { projectId },
    });
    const maxFileSize = settings?.maxFileSizeBytes || 26214400; // 25 MB default

    const existingDocsSum = await (prisma as any).projectDocument.findMany({
      where: { projectId, deletedAt: null },
      select: { sizeBytes: true },
    });
    let combinedProjectBytes = existingDocsSum.reduce((acc: number, d: any) => acc + (d.sizeBytes || 0), 0);

    const uploaderName = access.user?.name || access.user?.username || 'DevFlow User';
    const uploadedDocuments: any[] = [];
    const errors: Array<{ fileName: string; error: string }> = [];

    for (const file of files) {
      const name = String(file?.name || file?.fileName || 'attachment').trim();
      const rawBase64 = file?.base64 || file?.contentBase64 || file?.data;
      const mimeType = String(file?.mimeType || file?.type || 'application/octet-stream');

      if (!name || !rawBase64) {
        errors.push({ fileName: name || 'unknown', error: 'Missing file name or data' });
        continue;
      }

      try {
        const cleanedBase64 = String(rawBase64).replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(cleanedBase64, 'base64');
        const actualSize = buffer.length;

        if (actualSize > maxFileSize) {
          const maxMB = (maxFileSize / (1024 * 1024)).toFixed(1);
          errors.push({
            fileName: name,
            error: `File size (${(actualSize / (1024 * 1024)).toFixed(1)} MB) exceeds ${maxMB} MB limit.`,
          });
          continue;
        }

        if (combinedProjectBytes + actualSize > REPO_SIZE_LIMIT_BYTES) {
          errors.push({
            fileName: name,
            error: 'Combined repository storage would exceed the 2 GB GitHub repository limit.',
          });
          continue;
        }

        const storageKey = crypto.randomUUID();
        const extension = name.split('.').pop()?.toLowerCase() || '';

        const gitResult = await GitHubDocumentStorageService.uploadDocumentFile({
          projectId,
          projectTitle: access.project?.title || 'project',
          fileName: name,
          storageKey,
          categorySlug: 'attachments',
          branchName: 'main',
          pathPrefix: `module-${mod.id}`,
          contentBuffer: buffer,
          uploaderName,
        });

        const docRecord = await (prisma as any).projectDocument.create({
          data: {
            organizationId: access.project?.organizationId || null,
            projectId,
            submoduleId: null,
            branch: gitResult.branch || 'main',
            uploadedById: userId!,
            originalName: name,
            displayName: name,
            storageKey,
            repositoryPath: gitResult.path,
            providerFileSha: gitResult.sha,
            mimeType,
            extension,
            sizeBytes: actualSize,
            categoryId: null,
            description: `Development attachment uploaded for module ${mod.name} (ID ${mod.id})`,
            uploadStatus: 'uploaded',
            providerSyncStatus: 'synced',
          },
        });

        combinedProjectBytes += actualSize;

        await (prisma as any).documentActivity.create({
          data: {
            projectId,
            documentId: docRecord.id,
            actorId: userId!,
            action: 'upload',
            metadata: JSON.stringify({
              fileName: name,
              sizeBytes: actualSize,
              branch: gitResult.branch || 'main',
              folder: `module-${mod.id}`,
              source: 'development_task',
            }),
          },
        });

        uploadedDocuments.push({
          id: docRecord.id,
          displayName: docRecord.displayName,
          originalName: docRecord.originalName,
          mimeType: docRecord.mimeType,
          extension: docRecord.extension,
          sizeBytes: docRecord.sizeBytes,
          branch: docRecord.branch,
          repositoryPath: docRecord.repositoryPath,
        });
      } catch (fileErr: any) {
        errors.push({
          fileName: name,
          error: fileErr?.message || 'GitHub upload failed',
        });
      }
    }

    if (uploadedDocuments.length === 0 && errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: errors[0].error,
        errors,
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        documents: uploadedDocuments,
        errors,
      },
    });
  } catch (error: any) {
    console.error('[DevManagement] Failed to upload attachments:', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to upload attachments' });
  }
});

