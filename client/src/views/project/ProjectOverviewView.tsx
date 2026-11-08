import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, MotionConfig, Reorder, motion, useDragControls } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Bug,
  Calendar,
  CheckCircle,
  CheckCircle2,
  CheckSquare,
  CircleDot,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  GanttChartSquare,
  GitBranch,
  GitCommitHorizontal,
  GitFork,
  GitPullRequest,
  GripVertical,
  HeartPulse,
  Kanban,
  LayoutDashboard,
  Layers,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  Rocket,
  RotateCcw,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { apiUrl } from '../../config/api';
import { useAccentTheme } from '../../services/accentTheme.service';
import { useNavigation } from '../../context/NavigationContext';
import {
  SECTION_META,
  SIDEBAR_ITEMS,
  useProjectLayout,
  type LayoutEntry,
  type ProjectLayout,
  type SectionId,
  type SidebarItemId,
} from '../../services/projectLayout.service';

// ═════════════════════════════════════════════════════════════════════════════
// Data contract
// Every field is optional. A section with no data shows sample data and a
// "Sample" badge, the same behaviour as the organization overview.
// ═════════════════════════════════════════════════════════════════════════════

type WorkStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'BLOCKED' | 'DONE';
type Severity = 'CRITICAL' | 'MAJOR' | 'MINOR';
type TimelineKind = 'PHASE' | 'EPIC' | 'SPRINT' | 'MILESTONE';
type NodeStatus = 'COMPLETE' | 'IN_PROGRESS' | 'GAP';
type DateLike = string | Date | null | undefined;

export interface WorkItem {
  id: string | number;
  title: string;
  type?: 'TASK' | 'ISSUE' | 'DEFECT' | 'BUG';
  status?: WorkStatus | string;
  priority?: string;
  severity?: Severity;
  assigneeId?: string | number | null;
  epicId?: string | number | null;
  sprintId?: string | number | null;
  estimateHours?: number;
  createdAt?: DateLike;
  updatedAt?: DateLike;
  completedAt?: DateLike;
  dueDate?: DateLike;
}

export interface TimelineItem {
  id: string | number;
  name: string;
  kind: TimelineKind;
  status?: string;
  plannedStart?: DateLike;
  plannedEnd?: DateLike;
  actualStart?: DateLike;
  actualEnd?: DateLike;
  progress?: number;
  owner?: string;
}

export interface ProjectMember {
  id: string | number;
  name: string;
  role?: string;
  avatarUrl?: string;
  avatarColor?: string;
  capacityHours?: number;
}

export interface Commit {
  sha?: string;
  message?: string;
  author?: string;
  authorId?: string | number;
  date: DateLike;
}

export interface PullRequest {
  id: string | number;
  number?: number;
  title: string;
  author?: string;
  status: 'OPEN' | 'DRAFT' | 'MERGED' | 'CLOSED';
  ci?: 'PASS' | 'FAIL' | 'RUNNING';
  reviewers?: Array<string | number>;
  additions?: number;
  deletions?: number;
  createdAt: DateLike;
  mergedAt?: DateLike;
  url?: string;
}

export interface Release {
  id: string | number;
  version: string;
  status: 'SHIPPED' | 'SCHEDULED' | 'ROLLED_BACK';
  date: DateLike;
  items?: number;
}

export interface Traceability {
  totalRequirements: number;
  linkedRequirements: number;
  coveragePct: number;
  unlinkedCount: number;
  unverifiedCriteriaCount: number;
  chainNodes: Array<{ name: string; count: number; status: NodeStatus }>;
  warnings: Array<{ id: string; reqCode: string; message: string; severity: 'HIGH' | 'MEDIUM'; link: string }>;
}

export interface ProjectActivity {
  id: string | number;
  actor?: string;
  message: string;
  createdAt: DateLike;
}

export interface ProjectOverviewData {
  project?: {
    name?: string;
    key?: string;
    description?: string;
    status?: string;
    lead?: string;
    role?: string;
    startDate?: DateLike;
    targetDate?: DateLike;
    repoUrl?: string;
    defaultBranch?: string;
    branchCount?: number;
    currentVersion?: string;
    color?: string;
  };
  sprint?: { id: string | number; name: string; goal?: string; startDate: DateLike; endDate: DateLike };
  tasks?: WorkItem[];
  timeline?: TimelineItem[];
  members?: ProjectMember[];
  commits?: Commit[];
  pullRequests?: PullRequest[];
  releases?: Release[];
  traceability?: Traceability;
  activities?: ProjectActivity[];
}

/**
 * WIRE-UP: point this at your API, e.g.
 *   const res = await projectService.getOverview(projectId);
 *   if (!res.success || !res.data) throw new Error(res.error || 'Failed to load project');
 *   return res.data;
 * Until then the whole page shows sample data.
 */
const fetchProjectOverview = async (projectId: string): Promise<ProjectOverviewData> => {
  if (!projectId) return {};
  try {
    const res = await fetch(apiUrl(`/projects/${projectId}/overview`));
    const json = await res.json();
    if (json.success && json.data) {
      const d = json.data;
      return {
        project: d.project ? {
          name: d.project.title,
          key: d.project.key || (d.project.title ? d.project.title.substring(0, 3).toUpperCase() : 'PRJ'),
          description: d.project.description,
          status: d.project.status,
          lead: d.project.owner?.name,
          role: d.project.userRole,
          startDate: d.project.createdAt,
          color: d.project.avatarColor,
        } : undefined,
        sprint: d.stats?.activeSprint ? {
          id: d.stats.activeSprint.id || 1,
          name: d.stats.activeSprint.name,
          startDate: new Date(Date.now() - 7 * DAY),
          endDate: new Date(Date.now() + (d.stats.activeSprint.daysLeft || 7) * DAY),
        } : undefined,
        tasks: d.recentTasks?.map((t: any) => ({
          id: t.id,
          title: t.title,
          type: t.type || 'TASK',
          status: t.status,
          priority: t.priority,
          assigneeId: t.assignee?.id,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
        members: d.teamWorkload?.members?.map((m: any) => ({
          id: m.id || m.userId,
          name: m.name,
          role: m.role,
          avatarUrl: m.avatarUrl,
          capacityHours: m.capacityHours || 40,
        })),
        activities: d.activity?.map((a: any) => ({
          id: a.id,
          actor: a.user?.name || a.userName,
          message: a.message || a.action,
          createdAt: a.createdAt,
        })),
        traceability: d.traceability ? {
          totalRequirements: d.traceability.totalRequirements || 0,
          linkedRequirements: d.traceability.linkedRequirements || 0,
          coveragePct: d.traceability.coveragePct || 0,
          unlinkedCount: d.traceability.unlinkedCount || 0,
          unverifiedCriteriaCount: d.traceability.unverifiedCriteriaCount || 0,
          chainNodes: d.traceability.chainNodes || [],
          warnings: d.traceability.warnings || [],
        } : undefined,
      };
    }
  } catch (err) {
    console.warn('Could not fetch remote project overview, using sample data:', err);
  }
  return {};
};

// ═════════════════════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════════════════════

const DAY = 24 * 60 * 60 * 1000;

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const dayKey = (d: Date) => {
  const x = startOfDay(d);
  return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
};
const fmtShort = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const toDate = (v: DateLike): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const diffDays = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / DAY);
const median = (values: number[]) => {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const relative = (v: DateLike) => {
  const d = toDate(v);
  if (!d) return 'Recently';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};
const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
const isDefect = (t: WorkItem) => t.type === 'DEFECT' || t.type === 'BUG';
const isIssue = (t: WorkItem) => t.type === 'ISSUE';
const isDone = (t: WorkItem) => t.status === 'DONE';
const doneDate = (t: WorkItem) => toDate(t.completedAt || t.updatedAt);

const STATUS_META: Record<string, { label: string; color: string }> = {
  TODO: { label: 'To do', color: '#52525B' },
  IN_PROGRESS: { label: 'In progress', color: '#6366F1' },
  IN_REVIEW: { label: 'In review', color: '#06B6D4' },
  BLOCKED: { label: 'Blocked', color: '#F43F5E' },
  DONE: { label: 'Done', color: '#10B981' },
};

const PROJECT_STATUS: Record<string, { label: string; color: string }> = {
  PLANNING: { label: 'Planning', color: '#F59E0B' },
  IN_PROGRESS: { label: 'In progress', color: '#8B5CF6' },
  COMPLETED: { label: 'Completed', color: '#10B981' },
  ON_HOLD: { label: 'On hold', color: '#F43F5E' },
};

const PRIORITY_META = [
  { key: 'URGENT', label: 'Urgent', color: '#EF4444' },
  { key: 'HIGH', label: 'High', color: '#F97316' },
  { key: 'MEDIUM', label: 'Medium', color: '#FBBF24' },
  { key: 'LOW', label: 'Low', color: '#60A5FA' },
] as const;

const SEVERITY_META: Array<{ key: Severity; label: string; color: string; weight: number }> = [
  { key: 'CRITICAL', label: 'Critical', color: '#EF4444', weight: 15 },
  { key: 'MAJOR', label: 'Major', color: '#F97316', weight: 6 },
  { key: 'MINOR', label: 'Minor', color: '#FBBF24', weight: 2 },
];

const KIND_META: Record<TimelineKind, { label: string; color: string }> = {
  PHASE: { label: 'Phase', color: '#8B5CF6' },
  EPIC: { label: 'Epic', color: '#6366F1' },
  SPRINT: { label: 'Sprint', color: '#06B6D4' },
  MILESTONE: { label: 'Milestone', color: '#FBBF24' },
};

const MEMBER_COLORS = ['#8B5CF6', '#EC4899', '#06B6D4', '#10B981', '#F59E0B', '#3B82F6', '#F43F5E', '#A3E635'];

const healthBand = (score: number) =>
  score >= 75
    ? { label: 'Healthy', color: '#10B981', text: 'text-emerald-400', soft: 'bg-emerald-500/10 border-emerald-500/20' }
    : score >= 50
      ? { label: 'At risk', color: '#F59E0B', text: 'text-amber-400', soft: 'bg-amber-500/10 border-amber-500/20' }
      : { label: 'Critical', color: '#F43F5E', text: 'text-rose-400', soft: 'bg-rose-500/10 border-rose-500/20' };

// ═════════════════════════════════════════════════════════════════════════════
// Sample data, deterministic and relative to today
// ═════════════════════════════════════════════════════════════════════════════

const buildSample = (today: Date): Required<ProjectOverviewData> => {
  const at = (n: number) => addDays(today, n);
  const members: ProjectMember[] = [
    { id: 'm1', name: 'Aarav Mehta', role: 'Tech Lead', capacityHours: 40 },
    { id: 'm2', name: 'Priya Nair', role: 'Backend', capacityHours: 40 },
    { id: 'm3', name: 'Rohan Iyer', role: 'Frontend', capacityHours: 40 },
    { id: 'm4', name: 'Sara Khan', role: 'Designer', capacityHours: 32 },
    { id: 'm5', name: 'Dev Patel', role: 'Backend', capacityHours: 40 },
    { id: 'm6', name: 'Meera Joshi', role: 'QA', capacityHours: 40 },
    { id: 'm7', name: 'Kabir Singh', role: 'DevOps', capacityHours: 24 },
    { id: 'm8', name: 'Ananya Rao', role: 'Frontend', capacityHours: 40 },
  ];
  const epics = ['e1', 'e2', 'e3', 'e4'];
  const sprintId = 's-current';
  const taskTitles = ['Add audit trail to billing', 'Refactor session middleware', 'Build usage dashboard', 'Migrate invoices table', 'Webhook retry queue', 'Role matrix editor', 'Export reports to CSV', 'Search index rebuild job'];
  const issueTitles = ['Slow load on project list', 'Filters reset on refresh', 'Email digest missing links', 'Sprint total rounding off'];
  const defectTitles = ['Payment fails on retry', 'Token refresh race condition', 'Chart overflow on Safari', 'Duplicate webhook delivery'];
  const load = [0, 1, 1, 2, 0, 3, 1, 4, 2, 1, 5, 6, 2, 7, 1, 0];
  const tasks: WorkItem[] = Array.from({ length: 76 }, (_, i) => {
    const type: WorkItem['type'] = i % 6 === 0 ? 'DEFECT' : i % 5 === 0 ? 'ISSUE' : 'TASK';
    const pool = type === 'DEFECT' ? defectTitles : type === 'ISSUE' ? issueTitles : taskTitles;
    const createdAt = at(-74 + i * 0.85);
    const finished = i < 50 || i % 4 === 0;
    const open: WorkStatus = (['IN_PROGRESS', 'TODO', 'IN_REVIEW', 'TODO', 'BLOCKED', 'IN_PROGRESS'] as WorkStatus[])[i % 6];
    const status: WorkStatus = finished ? 'DONE' : open;
    const span = 3 + (i % 8) + load[i % load.length] * 2;
    const completed = at(Math.min(-1, -74 + i * 0.85 + span));
    return {
      id: `t${i}`,
      title: `${pool[i % pool.length]}${i > pool.length ? ` · ${i}` : ''}`,
      type,
      status,
      priority: PRIORITY_META[(i * 3) % 4].key,
      severity: type === 'DEFECT' ? (['MAJOR', 'CRITICAL', 'MINOR', 'MINOR', 'MAJOR'] as Severity[])[i % 5] : undefined,
      assigneeId: members[load[i % load.length]].id,
      epicId: epics[i % 4],
      sprintId: i >= 44 ? sprintId : null,
      estimateHours: 4 + (i % 4) * 3,
      createdAt,
      completedAt: finished ? completed : null,
      dueDate: finished ? at(-68 + i * 0.95 + (i % 5) * 2) : at(-3 + (i % 9) * 3),
    };
  });
  const timeline: TimelineItem[] = [
    { id: 'p1', name: 'Discovery', kind: 'PHASE', status: 'COMPLETED', plannedStart: at(-80), plannedEnd: at(-58), actualStart: at(-80), actualEnd: at(-55), progress: 100, owner: 'Sara Khan' },
    { id: 'p2', name: 'Build', kind: 'PHASE', status: 'IN_PROGRESS', plannedStart: at(-55), plannedEnd: at(28), actualStart: at(-53), progress: 62, owner: 'Aarav Mehta' },
    { id: 'p3', name: 'Launch prep', kind: 'PHASE', status: 'PLANNING', plannedStart: at(24), plannedEnd: at(58), progress: 0, owner: 'Kabir Singh' },
    { id: 'e1', name: 'Billing engine', kind: 'EPIC', status: 'IN_PROGRESS', plannedStart: at(-52), plannedEnd: at(4), actualStart: at(-52), progress: 78, owner: 'Priya Nair' },
    { id: 'e2', name: 'Access control', kind: 'EPIC', status: 'IN_PROGRESS', plannedStart: at(-40), plannedEnd: at(-3), actualStart: at(-37), progress: 71, owner: 'Dev Patel' },
    { id: 'e3', name: 'Reporting', kind: 'EPIC', status: 'IN_PROGRESS', plannedStart: at(-22), plannedEnd: at(26), actualStart: at(-20), progress: 34, owner: 'Rohan Iyer' },
    { id: 'e4', name: 'Mobile web', kind: 'EPIC', status: 'PLANNING', plannedStart: at(10), plannedEnd: at(50), progress: 0, owner: 'Ananya Rao' },
    { id: 's1', name: 'Sprint 7', kind: 'SPRINT', status: 'COMPLETED', plannedStart: at(-23), plannedEnd: at(-10), actualStart: at(-23), actualEnd: at(-10), progress: 100, owner: 'Aarav Mehta' },
    { id: sprintId, name: 'Sprint 8', kind: 'SPRINT', status: 'IN_PROGRESS', plannedStart: at(-9), plannedEnd: at(4), actualStart: at(-9), progress: 58, owner: 'Aarav Mehta' },
    { id: 's3', name: 'Sprint 9', kind: 'SPRINT', status: 'PLANNING', plannedStart: at(5), plannedEnd: at(18), progress: 0, owner: 'Aarav Mehta' },
    { id: 'ms1', name: 'Beta release', kind: 'MILESTONE', status: 'COMPLETED', plannedEnd: at(-15), actualEnd: at(-13), progress: 100 },
    { id: 'ms2', name: 'Code freeze', kind: 'MILESTONE', status: 'PLANNING', plannedEnd: at(30), progress: 0 },
    { id: 'ms3', name: 'General availability', kind: 'MILESTONE', status: 'PLANNING', plannedEnd: at(55), progress: 0 },
  ];
  const commits: Commit[] = [];
  const verbs = ['fix: guard null invoice', 'feat: add retry policy', 'chore: bump deps', 'refactor: split auth hooks', 'test: cover role matrix', 'feat: usage export'];
  for (let d = 111; d >= 0; d--) {
    const date = at(-d);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const n = weekend ? (d % 5 === 0 ? 1 : 0) : ((d * 37) % 7) + (d % 11 === 0 ? 3 : 0);
    for (let c = 0; c < n; c++) {
      const m = members[[0, 0, 1, 2, 1, 3, 4, 0, 5, 2, 6, 7, 1, 2][(d + c * 3) % 14]];
      commits.push({ sha: ((d + 11) * 7919 + c * 101).toString(16).padStart(7, '0'), message: verbs[(d + c) % verbs.length], author: m.name, authorId: m.id, date });
    }
  }
  const prTitles = ['Billing retry policy', 'Split auth hooks', 'Usage export API', 'Role matrix UI', 'Index rebuild worker', 'Fix Safari chart overflow', 'Webhook dedupe', 'Reporting filters'];
  const pullRequests: PullRequest[] = Array.from({ length: 32 }, (_, i) => {
    const open = i < 6;
    const age = open ? [1, 2, 6, 3, 8, 1][i] : 2 + i * 1.7;
    return {
      id: `pr${i}`,
      number: 482 - i,
      title: prTitles[i % prTitles.length],
      author: members[i % 8].name,
      status: open ? (i === 3 ? 'DRAFT' : 'OPEN') : i % 9 === 0 ? 'CLOSED' : 'MERGED',
      ci: open ? (['PASS', 'PASS', 'FAIL', 'RUNNING', 'PASS', 'PASS'] as const)[i] : i % 8 === 1 ? 'FAIL' : 'PASS',
      reviewers: [members[i % 3].id, members[(i * 3 + 5) % 8].id],
      additions: 40 + ((i * 83) % 420),
      deletions: 8 + ((i * 47) % 160),
      createdAt: at(-age),
      mergedAt: open ? null : at(-age + 0.6 + (i % 4) * 0.9),
    };
  });
  return {
    project: {
      name: 'Atlas Billing Platform',
      key: 'ATL',
      description: 'Usage-based billing, access control and reporting for enterprise workspaces.',
      status: 'IN_PROGRESS',
      lead: 'Aarav Mehta',
      role: 'MAINTAINER',
      startDate: at(-80),
      targetDate: at(55),
      repoUrl: 'https://github.com/example/atlas-billing',
      defaultBranch: 'main',
      branchCount: 23,
      currentVersion: 'v2.4.0',
      color: '#8B5CF6',
    },
    sprint: { id: sprintId, name: 'Sprint 8', goal: 'Ship billing retries and role matrix', startDate: at(-9), endDate: at(4) },
    tasks,
    timeline,
    members,
    commits,
    pullRequests,
    releases: [
      { id: 'r5', version: 'v2.5.0', status: 'SCHEDULED', date: at(6), items: 18 },
      { id: 'r4', version: 'v2.4.0', status: 'SHIPPED', date: at(-8), items: 24 },
      { id: 'r3', version: 'v2.3.1', status: 'SHIPPED', date: at(-19), items: 5 },
      { id: 'r2', version: 'v2.3.0', status: 'ROLLED_BACK', date: at(-24), items: 16 },
      { id: 'r1', version: 'v2.2.0', status: 'SHIPPED', date: at(-41), items: 21 },
    ],
    traceability: {
      totalRequirements: 64,
      linkedRequirements: 53,
      coveragePct: 83,
      unlinkedCount: 11,
      unverifiedCriteriaCount: 17,
      chainNodes: [
        { name: 'Req', count: 64, status: 'COMPLETE' },
        { name: 'Task', count: 76, status: 'COMPLETE' },
        { name: 'Sprint', count: 8, status: 'COMPLETE' },
        { name: 'Branch', count: 23, status: 'IN_PROGRESS' },
        { name: 'Commit', count: commits.length, status: 'IN_PROGRESS' },
        { name: 'PR', count: 32, status: 'IN_PROGRESS' },
        { name: 'Test', count: 41, status: 'GAP' },
        { name: 'Defect', count: 13, status: 'IN_PROGRESS' },
        { name: 'Release', count: 5, status: 'COMPLETE' },
      ],
      warnings: [
        { id: 'w1', reqCode: 'REQ-104', message: 'REQ-104 has no linked test cases', severity: 'HIGH', link: '#' },
        { id: 'w2', reqCode: 'REQ-118', message: 'REQ-118 is not linked to any task', severity: 'HIGH', link: '#' },
        { id: 'w3', reqCode: 'REQ-092', message: 'REQ-092 has 3 unverified acceptance criteria', severity: 'MEDIUM', link: '#' },
      ],
    },
    activities: [
      { id: 1, actor: 'Priya Nair', message: 'merged PR #477 into main', createdAt: new Date(Date.now() - 38 * 60000) },
      { id: 2, actor: 'Meera Joshi', message: 'raised a critical defect on payments', createdAt: new Date(Date.now() - 2.4 * 3600000) },
      { id: 3, actor: 'Kabir Singh', message: 'scheduled release v2.5.0', createdAt: new Date(Date.now() - 6 * 3600000) },
      { id: 4, actor: 'Aarav Mehta', message: 'moved 4 items into Sprint 8', createdAt: new Date(Date.now() - 27 * 3600000) },
      { id: 5, actor: 'Sara Khan', message: 'linked REQ-097 to the reporting epic', createdAt: new Date(Date.now() - 50 * 3600000) },
      { id: 6, actor: 'Dev Patel', message: 'closed 3 defects', createdAt: new Date(Date.now() - 74 * 3600000) },
    ],
  };
};

// ═════════════════════════════════════════════════════════════════════════════
// Building blocks (same as the organization overview)
// ═════════════════════════════════════════════════════════════════════════════

const Panel: React.FC<{
  title: string;
  icon: React.ReactNode;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ title, icon, subtitle, right, className = '', children }) => (
  <section className={`rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 shadow-xl flex flex-col min-w-0 ${className}`}>
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-[#27272A]/70">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-[15px] text-white tracking-tight truncate">{title}</h3>
        </div>
        {subtitle && <p className="text-[11.5px] text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </header>
    {children}
  </section>
);

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center p-0.5 rounded-lg bg-[#0A0B0F] border border-[#27272A]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer font-mono text-[11px] whitespace-nowrap ${value === o.value ? 'bg-[#1C1E26] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-200'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const SampleBadge: React.FC = () => (
  <span
    className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700"
    title="Not enough project data yet, showing sample data"
  >
    Sample
  </span>
);

const Ring: React.FC<{ pct: number; color: string; size?: number; stroke?: number; children?: React.ReactNode }> = ({
  pct,
  color,
  size = 56,
  stroke = 6,
  children,
}) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (clamp(pct, 0, 100) / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1F2027" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className = 'text-white' }) => (
  <div>
    <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{label}</div>
    <div className={`text-xl font-bold font-mono ${className}`}>{value}</div>
  </div>
);

const StackBar: React.FC<{ parts: Array<{ key: string; label: string; value: number; color: string }> }> = ({ parts }) => {
  const total = Math.max(1, parts.reduce((s, p) => s + p.value, 0));
  return (
    <div className="flex h-1.5 gap-[2px] rounded-full overflow-hidden bg-zinc-800">
      {parts
        .filter((p) => p.value > 0)
        .map((p, i) => (
          <motion.div
            key={p.key}
            initial={{ width: 0 }}
            animate={{ width: `${(p.value / total) * 100}%` }}
            transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
            style={{ backgroundColor: p.color }}
            title={`${p.label}: ${p.value}`}
          />
        ))}
    </div>
  );
};

const MemberAvatar: React.FC<{ member: ProjectMember; color: string; size?: number }> = ({ member, color, size = 28 }) => (
  <div
    className="rounded-full overflow-hidden shrink-0 flex items-center justify-center font-bold text-white"
    style={{ width: size, height: size, backgroundColor: member.avatarColor || color, fontSize: size * 0.36 }}
    title={member.name}
  >
    {member.avatarUrl ? <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" /> : initials(member.name)}
  </div>
);

const Legend: React.FC<{ items: Array<{ label: string; mark: React.ReactNode }> }> = ({ items }) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-400">
    {items.map((i) => (
      <span key={i.label} className="flex items-center gap-1.5">
        {i.mark}
        {i.label}
      </span>
    ))}
  </div>
);

// ─── Line chart with hover crosshair (burn-up and burndown) ───────────────────

interface LineSeries {
  name: string;
  color: string;
  values: Array<number | null>;
  dashed?: boolean;
  area?: boolean;
}

const LineChart: React.FC<{ labels: string[]; series: LineSeries[] }> = ({ labels, series }) => {
  const [hover, setHover] = useState<number | null>(null);
  const G = { w: 640, h: 275, top: 14, right: 12, bottom: 26, left: 32 };
  const innerW = G.w - G.left - G.right;
  const innerH = G.h - G.top - G.bottom;
  const raw = Math.max(4, ...series.flatMap((s) => s.values.map((v) => v ?? 0)));
  const yMax = Math.ceil(raw / 10) * 10;
  const x = (i: number) => G.left + (labels.length > 1 ? (i / (labels.length - 1)) * innerW : 0);
  const y = (v: number) => G.top + innerH - (v / yMax) * innerH;
  const path = (values: Array<number | null>) => {
    let d = '';
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'} ${x(i)} ${y(v)} `;
      pen = true;
    });
    return d;
  };
  const areaPath = (values: Array<number | null>) => {
    const idx = values.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0);
    if (idx.length === 0) return '';
    return `${path(values)} L ${x(idx[idx.length - 1])} ${y(0)} L ${x(idx[0])} ${y(0)} Z`;
  };
  const every = Math.max(1, Math.ceil(labels.length / 8));
  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    setHover(clamp(Math.round(((e.clientX - box.left) / box.width) * (labels.length - 1)), 0, labels.length - 1));
  };
  return (
    <div className="relative w-full" onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${G.w} ${G.h}`} className="w-full h-auto overflow-visible" role="img" aria-label={series.map((s) => s.name).join(', ')}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const py = G.top + innerH * f;
          return (
            <g key={f}>
              <line x1={G.left} x2={G.w - G.right} y1={py} y2={py} stroke="#1F2027" />
              <text x={G.left - 8} y={py + 3} fill="#52525B" fontSize="9" fontFamily="monospace" textAnchor="end">
                {Math.round(yMax * (1 - f))}
              </text>
            </g>
          );
        })}
        {labels.map((l, i) =>
          i % every === 0 ? (
            <text key={i} x={x(i)} y={G.h - 8} fill={hover === i ? '#E4E4E7' : '#52525B'} fontSize="9" fontFamily="monospace" textAnchor="middle">
              {l}
            </text>
          ) : null
        )}
        {series
          .filter((s) => s.area)
          .map((s) => (
            <path key={`${s.name}-area`} d={areaPath(s.values)} fill={s.color} opacity="0.12" />
          ))}
        {series.map((s) => (
          <motion.path
            key={s.name}
            d={path(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={s.dashed ? '5 5' : undefined}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          />
        ))}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={G.top} y2={G.top + innerH} stroke="#52525B" strokeDasharray="3 3" />
            {series.map((s) => {
              const v = s.values[hover];
              return v === null ? null : <circle key={s.name} cx={x(hover)} cy={y(v)} r="4" fill={s.color} stroke="#0E0F14" strokeWidth="2" />;
            })}
          </g>
        )}
        <rect x={G.left} y={G.top} width={innerW} height={innerH} fill="transparent" onPointerMove={onMove} className="cursor-crosshair" />
      </svg>
      {hover !== null && (
        <div
          className="absolute top-0 pointer-events-none p-2.5 rounded-lg bg-[#0A0B0F]/95 border border-[#27272A] shadow-xl text-[11px] space-y-1 min-w-[150px] -translate-x-1/2"
          style={{ left: `${clamp((x(hover) / G.w) * 100, 14, 86)}%` }}
        >
          <div className="font-mono text-[10px] text-zinc-400">{labels[hover]}</div>
          {series.map((s) =>
            s.values[hover] === null ? null : (
              <div key={s.name} className="flex justify-between gap-4">
                <span className="flex items-center gap-1.5 text-zinc-300">
                  <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: s.color }} />
                  {s.name}
                </span>
                <span className="font-mono font-bold text-white">{Math.round((s.values[hover] as number) * 10) / 10}</span>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

// ─── Customize drawer ─────────────────────────────────────────────────────────

function SortableRow<T extends string>({
  entry,
  label,
  hint,
  locked,
  index,
  count,
  onMove,
  onToggle,
}: {
  entry: LayoutEntry<T>;
  label: string;
  hint?: string;
  locked?: boolean;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onToggle: () => void;
}) {
  const controls = useDragControls();
  const visible = entry.visible || !!locked;
  return (
    <Reorder.Item
      value={entry}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-2 px-2 py-2 rounded-xl bg-[#111216] border border-[#27272A] list-none"
      whileDrag={{ scale: 1.02, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
    >
      <span
        onPointerDown={(e) => controls.start(e)}
        className="p-1 text-zinc-600 hover:text-zinc-300 cursor-grab active:cursor-grabbing touch-none"
        title="Drag to reorder"
      >
        <GripVertical size={14} />
      </span>
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-medium truncate ${visible ? 'text-zinc-100' : 'text-zinc-500 line-through'}`}>{label}</div>
        {hint && <div className="text-[10.5px] text-zinc-500 truncate">{hint}</div>}
      </div>
      <button type="button" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => onMove(index, index - 1)} className="p-1 rounded text-zinc-500 hover:text-white disabled:opacity-25 disabled:hover:text-zinc-500 cursor-pointer">
        <ArrowUp size={13} />
      </button>
      <button type="button" aria-label={`Move ${label} down`} disabled={index === count - 1} onClick={() => onMove(index, index + 1)} className="p-1 rounded text-zinc-500 hover:text-white disabled:opacity-25 disabled:hover:text-zinc-500 cursor-pointer">
        <ArrowDown size={13} />
      </button>
      <button
        type="button"
        aria-label={`${visible ? 'Hide' : 'Show'} ${label}`}
        disabled={locked}
        onClick={onToggle}
        title={locked ? 'Always shown' : visible ? 'Hide' : 'Show'}
        className="p-1 rounded text-zinc-400 hover:text-white disabled:opacity-25 disabled:hover:text-zinc-400 cursor-pointer"
      >
        {visible ? <Eye size={14} /> : <EyeOff size={14} />}
      </button>
    </Reorder.Item>
  );
}

function SortableList<T extends string>({
  items,
  meta,
  onChange,
}: {
  items: LayoutEntry<T>[];
  meta: (id: T) => { label: string; hint?: string; locked?: boolean };
  onChange: (next: LayoutEntry<T>[]) => void;
}) {
  const move = (from: number, to: number) => {
    const next = [...items];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onChange(next);
  };
  return (
    <Reorder.Group axis="y" values={items} onReorder={onChange} className="space-y-1.5">
      {items.map((entry, i) => {
        const m = meta(entry.id);
        return (
          <SortableRow
            key={entry.id}
            entry={entry}
            label={m.label}
            hint={m.hint}
            locked={m.locked}
            index={i}
            count={items.length}
            onMove={move}
            onToggle={() => onChange(items.map((e) => (e.id === entry.id ? { ...e, visible: !e.visible } : e)))}
          />
        );
      })}
    </Reorder.Group>
  );
}

const CustomizeDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  layout: ProjectLayout;
  update: (patch: Partial<ProjectLayout>) => void;
  reset: () => void;
  settingsHref: string;
}> = ({ open, onClose, layout, update, reset, settingsHref }) => {
  const [tab, setTab] = useState<'sidebar' | 'sections' | 'prefs'>('sidebar');
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  const prefs = layout.prefs;
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[60] bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Customize project"
            className="fixed inset-y-0 right-0 z-[61] w-full max-w-[400px] bg-[#0C0D12] border-l border-[#27272A] shadow-2xl flex flex-col text-left"
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <header className="flex items-center justify-between gap-3 p-4 border-b border-[#27272A]/70">
              <div>
                <h2 className="text-[15px] font-semibold text-white">Customize project</h2>
                <p className="text-[11.5px] text-zinc-500">Saved for this project on this browser</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg border border-[#27272A] text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer">
                <X size={14} />
              </button>
            </header>
            <div className="px-4 pt-3">
              <Segmented
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'sidebar', label: 'Sidebar' },
                  { value: 'sections', label: 'Page sections' },
                  { value: 'prefs', label: 'Preferences' },
                ]}
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {tab === 'sidebar' && (
                <>
                  <p className="text-[11.5px] text-zinc-500 mb-3">Drag to reorder project navigation. Overview and Settings can't be hidden.</p>
                  <SortableList<SidebarItemId> items={layout.sidebar} meta={(id) => SIDEBAR_ITEMS[id]} onChange={(sidebar) => update({ sidebar })} />
                </>
              )}
              {tab === 'sections' && (
                <>
                  <p className="text-[11.5px] text-zinc-500 mb-3">Choose what this page shows and in what order.</p>
                  <SortableList<SectionId> items={layout.sections} meta={(id) => SECTION_META[id]} onChange={(sections) => update({ sections })} />
                </>
              )}
              {tab === 'prefs' && (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-200">Default timeline range</span>
                    <Segmented
                      value={prefs.timelineZoom}
                      onChange={(timelineZoom) => update({ prefs: { ...prefs, timelineZoom } })}
                      options={[
                        { value: 'month', label: '2M' },
                        { value: 'quarter', label: '4M' },
                        { value: 'half', label: '6M' },
                      ]}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-200">Default delivery chart</span>
                    <Segmented
                      value={prefs.deliveryChart}
                      onChange={(deliveryChart) => update({ prefs: { ...prefs, deliveryChart } })}
                      options={[
                        { value: 'burnup', label: 'Burn-up' },
                        { value: 'burndown', label: 'Burndown' },
                      ]}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-200">Compact timeline rows</span>
                    <Segmented
                      value={prefs.compactTimeline ? 'on' : 'off'}
                      onChange={(v) => update({ prefs: { ...prefs, compactTimeline: v === 'on' } })}
                      options={[
                        { value: 'off', label: 'Off' },
                        { value: 'on', label: 'On' },
                      ]}
                    />
                  </div>
                </div>
              )}
            </div>
            <footer className="flex items-center justify-between gap-2 p-4 border-t border-[#27272A]/70">
              <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#27272A] text-zinc-300 hover:text-white text-[12px] cursor-pointer">
                <RotateCcw size={12} /> Reset to default
              </button>
              <Link to={settingsHref} className="inline-flex items-center gap-1 text-[12px] text-zinc-400 hover:text-white">
                All project settings <ArrowRight size={12} />
              </Link>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

const OverviewSkeleton: React.FC = () => (
  <div className="w-full px-4 sm:px-8 lg:px-10 pt-4 sm:pt-6 pb-16 space-y-5 animate-pulse">
    <div className="flex items-center gap-3.5 pb-5 border-b border-[#27272A]/70">
      <div className="w-12 h-12 rounded-xl bg-zinc-800/80" />
      <div className="space-y-2">
        <div className="w-56 h-7 rounded-lg bg-zinc-800/80" />
        <div className="w-72 h-4 rounded bg-zinc-800/50" />
      </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div className="lg:col-span-8 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-[118px] rounded-2xl bg-[#0E0F14]/90 border border-[#27272A]" />
          ))}
        </div>
        <div className="h-[380px] rounded-2xl bg-[#0E0F14]/95 border border-[#27272A]" />
      </div>
      <div className="lg:col-span-4 space-y-5">
        <div className="h-[250px] rounded-2xl bg-[#0E0F14]/95 border border-[#27272A]" />
        <div className="h-[250px] rounded-2xl bg-[#0E0F14]/95 border border-[#27272A]" />
      </div>
    </div>
    <div className="h-[420px] rounded-2xl bg-[#0E0F14]/95 border border-[#27272A]" />
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════
// Main view
// ═════════════════════════════════════════════════════════════════════════════

type GanttFilter = 'ALL' | TimelineKind;
type WorkFilter = 'ALL' | 'TASK' | 'ISSUE' | 'DEFECT' | 'BLOCKED';

const HEAT_WEEKS = 16;
const CHAIN_LEGEND: Array<{ key: NodeStatus; label: string; dot: string; node: string }> = [
  { key: 'COMPLETE', label: 'Complete', dot: 'bg-emerald-400', node: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  { key: 'IN_PROGRESS', label: 'In progress', dot: 'bg-indigo-400', node: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300' },
  { key: 'GAP', label: 'Gap', dot: 'bg-rose-400', node: 'border-rose-500/40 bg-rose-500/10 text-rose-300' },
];

export const ProjectOverviewView: React.FC = () => {
  const { id, projectId: paramProjectId } = useParams<{ id?: string; projectId?: string }>();
  const projectId = paramProjectId || id || '';
  const { accentColor } = useAccentTheme();
  const { setIsCreateOpen, selectProject } = useNavigation();
  const { layout, update, reset } = useProjectLayout(projectId);

  const [data, setData] = useState<ProjectOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [ganttFilter, setGanttFilter] = useState<GanttFilter>('ALL');
  const [hoveredGantt, setHoveredGantt] = useState<string | null>(null);
  const [hoveredHeat, setHoveredHeat] = useState<{ date: Date; count: number } | null>(null);
  const [hoveredDefect, setHoveredDefect] = useState<number | null>(null);
  const [hoveredMember, setHoveredMember] = useState<string | null>(null);
  const [workFilter, setWorkFilter] = useState<WorkFilter>('ALL');

  const base = `/projects/${projectId}`;
  const prefs = layout.prefs;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await fetchProjectOverview(projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error connecting to project service');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, selectProject]);

  useEffect(() => {
    load();
  }, [load]);

  const today = useMemo(() => startOfDay(new Date()), []);
  const sample = useMemo(() => buildSample(today), [today]);

  const isSample = useMemo(
    () => ({
      project: !data?.project,
      tasks: !data?.tasks?.length,
      timeline: !data?.timeline?.length,
      members: !data?.members?.length,
      commits: !data?.commits?.length,
      pullRequests: !data?.pullRequests?.length,
      releases: !data?.releases?.length,
      traceability: !data?.traceability,
      activities: !data?.activities?.length,
    }),
    [data]
  );

  const project = data?.project || sample.project;
  const sprint = data?.sprint || sample.sprint;
  const tasks = isSample.tasks ? sample.tasks : (data?.tasks as WorkItem[]);
  const timeline = isSample.timeline ? sample.timeline : (data?.timeline as TimelineItem[]);
  const members = isSample.members ? sample.members : (data?.members as ProjectMember[]);
  const commits = isSample.commits ? sample.commits : (data?.commits as Commit[]);
  const pullRequests = isSample.pullRequests ? sample.pullRequests : (data?.pullRequests as PullRequest[]);
  const releases = isSample.releases ? sample.releases : (data?.releases as Release[]);
  const traceability = data?.traceability || sample.traceability;
  const activities = isSample.activities ? sample.activities : (data?.activities as ProjectActivity[]);

  const projectStart = toDate(project.startDate) || addDays(today, -60);
  const projectEnd = toDate(project.targetDate) || addDays(today, 60);

  // ─── Task rollups ────────────────────────────────────────────────────────
  const taskStats = useMemo(() => {
    const byStatus: Record<string, number> = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, BLOCKED: 0, DONE: 0 };
    tasks.forEach((t) => {
      const s = t.status && byStatus[t.status] !== undefined ? t.status : 'TODO';
      byStatus[s]++;
    });
    const plain = tasks.filter((t) => !isDefect(t) && !isIssue(t));
    const overdue = tasks.filter((t) => {
      const due = toDate(t.dueDate);
      return due && due < today && !isDone(t);
    });
    return {
      byStatus,
      plain: plain.length,
      done: byStatus.DONE,
      total: tasks.length,
      pct: Math.round((byStatus.DONE / Math.max(tasks.length, 1)) * 100),
      overdue,
      openIssues: tasks.filter((t) => isIssue(t) && !isDone(t)).length,
    };
  }, [tasks, today]);

  // ─── Defects ─────────────────────────────────────────────────────────────
  const defects = useMemo(() => {
    const all = tasks.filter(isDefect);
    const open = all.filter((t) => !isDone(t));
    const bySeverity = SEVERITY_META.map((s) => ({
      ...s,
      value: open.filter((d) => (d.severity || 'MINOR') === s.key).length,
    }));
    const resolution = all
      .filter(isDone)
      .map((d) => {
        const c = toDate(d.createdAt);
        const u = doneDate(d);
        return c && u ? (u.getTime() - c.getTime()) / DAY : null;
      })
      .filter((v): v is number => v !== null && v >= 0);
    const weekCount = 12;
    const firstWeek = addDays(today, -(weekCount * 7) + 1);
    const weeks = Array.from({ length: weekCount }, (_, i) => {
      const from = addDays(firstWeek, i * 7);
      const to = addDays(from, 7);
      const inWeek = (d: Date | null) => !!d && d >= from && d < to;
      return {
        label: fmtShort(from),
        range: `${fmtShort(from)} – ${fmtShort(addDays(to, -1))}`,
        opened: all.filter((d) => inWeek(toDate(d.createdAt))).length,
        closed: all.filter((d) => isDone(d) && inWeek(doneDate(d))).length,
      };
    });
    const penalty = bySeverity.reduce((s, b) => s + b.value * b.weight, 0);
    return {
      all,
      open,
      bySeverity,
      mttr: median(resolution),
      weeks,
      max: Math.max(1, ...weeks.flatMap((w) => [w.opened, w.closed])),
      density: Math.round((all.length / Math.max(tasks.length, 1)) * 100),
      score: clamp(100 - penalty, 0, 100),
    };
  }, [tasks, today]);

  // ─── Git ─────────────────────────────────────────────────────────────────
  const git = useMemo(() => {
    const open = pullRequests.filter((p) => p.status === 'OPEN' || p.status === 'DRAFT');
    const last30 = addDays(today, -30);
    const merged = pullRequests.filter((p) => p.status === 'MERGED');
    const merged30 = merged.filter((p) => {
      const d = toDate(p.mergedAt);
      return d && d >= last30;
    });
    const hours = merged
      .map((p) => {
        const c = toDate(p.createdAt);
        const m = toDate(p.mergedAt);
        return c && m ? (m.getTime() - c.getTime()) / 3600000 : null;
      })
      .filter((v): v is number => v !== null && v >= 0);
    const withCi = pullRequests.filter((p) => p.ci && p.ci !== 'RUNNING');
    const ciPass = withCi.length ? Math.round((withCi.filter((p) => p.ci === 'PASS').length / withCi.length) * 100) : null;
    const stale = open.filter((p) => {
      const c = toDate(p.createdAt);
      return c && diffDays(today, startOfDay(c)) >= 5;
    });

    const counts = new Map<string, number>();
    const authors = new Map<string, number>();
    commits.forEach((c) => {
      const d = toDate(c.date);
      if (!d) return;
      counts.set(dayKey(d), (counts.get(dayKey(d)) || 0) + 1);
      const a = c.author || 'Unknown';
      authors.set(a, (authors.get(a) || 0) + 1);
    });
    const gridStart = addDays(today, -today.getDay() - (HEAT_WEEKS - 1) * 7);
    let max = 1;
    let total = 0;
    const weeks = Array.from({ length: HEAT_WEEKS }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const date = addDays(gridStart, w * 7 + d);
        const future = date > today;
        const count = future ? 0 : counts.get(dayKey(date)) || 0;
        max = Math.max(max, count);
        total += count;
        return { date, count, future };
      })
    );
    const contributors = [...authors.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n);
    return {
      open: [...open].sort((a, b) => (toDate(a.createdAt)?.getTime() || 0) - (toDate(b.createdAt)?.getTime() || 0)),
      merged30: merged30.length,
      medianHours: median(hours),
      ciPass,
      stale,
      weeks,
      max,
      total,
      contributors,
    };
  }, [pullRequests, commits, today]);

  // ─── Team potential ──────────────────────────────────────────────────────
  // No dated work yet counts as a neutral 50 for on-time.
  // Potential = 35% on-time delivery, 25% output vs top performer,
  // 20% quality (open defects assigned), 20% collaboration (reviews).
  const team = useMemo(() => {
    const raw = members.map((m, idx) => {
      const mine = tasks.filter((t) => String(t.assigneeId) === String(m.id));
      const open = mine.filter((t) => !isDone(t));
      const done = mine.filter(isDone);
      const dated = done.filter((t) => toDate(t.dueDate) && doneDate(t));
      const onTime = dated.length
        ? Math.round((dated.filter((t) => { const d = doneDate(t); const due = toDate(t.dueDate); return Boolean(d && due && d.getTime() <= addDays(due, 1).getTime()); }).length / dated.length) * 100)
        : null;
      const hours = open.reduce((s, t) => s + (t.estimateHours ?? 6), 0);
      const capacity = m.capacityHours ?? 40;
      const commitCount = commits.filter((c) => String(c.authorId) === String(m.id) || c.author === m.name).length;
      const reviews = pullRequests.filter((p) => p.reviewers?.some((r) => String(r) === String(m.id) || r === m.name)).length;
      const openDefects = open.filter(isDefect).length;
      return {
        member: m,
        color: MEMBER_COLORS[idx % MEMBER_COLORS.length],
        open: open.length,
        done: done.length,
        hours,
        capacity,
        load: Math.round((hours / Math.max(capacity, 1)) * 100),
        onTime,
        commits: commitCount,
        reviews,
        openDefects,
        output: done.length + commitCount / 5,
      };
    });
    const maxOutput = Math.max(1, ...raw.map((r) => r.output));
    const maxReviews = Math.max(1, ...raw.map((r) => r.reviews));
    return raw
      .map((r) => {
        const quality = clamp(100 - r.openDefects * 15, 0, 100);
        const potential = Math.round(
          (r.onTime ?? 50) * 0.35 + (r.output / maxOutput) * 100 * 0.25 + quality * 0.2 + (r.reviews / maxReviews) * 100 * 0.2
        );
        const capacityState =
          r.load > 100
            ? { label: 'Overloaded', cls: 'bg-rose-500/10 text-rose-300 border-rose-500/20', bar: '#F43F5E' }
            : r.load >= 70
              ? { label: 'Balanced', cls: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20', bar: '#6366F1' }
              : { label: 'Has capacity', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20', bar: '#10B981' };
        return { ...r, potential, capacityState };
      })
      .sort((a, b) => b.potential - a.potential);
  }, [members, tasks, commits, pullRequests]);

  // ─── Burn-up and burndown ────────────────────────────────────────────────
  const burnup = useMemo(() => {
    const created = tasks.map((t) => toDate(t.createdAt)).filter((d): d is Date => !!d);
    const completed = tasks.filter(isDone).map(doneDate).filter((d): d is Date => !!d);
    const scopeAt = (d: Date) => created.filter((c) => c < addDays(d, 1)).length;
    const doneAt = (d: Date) => completed.filter((c) => c < addDays(d, 1)).length;
    const history = Math.max(7, diffDays(today, projectStart));
    const scope = scopeAt(today);
    const done = doneAt(today);
    const recent = completed.filter((c) => c >= addDays(today, -28)).length;
    const perDay = recent / 28;
    const remaining = Math.max(0, scope - done);
    const finish = perDay > 0 ? addDays(today, Math.ceil(remaining / perDay)) : null;
    const chartEnd = finish && finish > projectEnd ? (diffDays(finish, projectEnd) > 60 ? addDays(projectEnd, 60) : finish) : projectEnd;
    const future = Math.max(0, diffDays(chartEnd, today));
    const step = Math.max(1, Math.ceil((history + future) / 24));
    const dates: Date[] = [];
    for (let d = history; d > 0; d -= step) dates.push(addDays(today, -d));
    const todayIndex = dates.length;
    dates.push(today);
    for (let d = step; d < future + step; d += step) dates.push(addDays(today, Math.min(d, future)));
    return {
      labels: dates.map(fmtShort),
      series: [
        { name: 'Scope', color: '#6366F1', values: dates.map((d, i) => (i <= todayIndex ? scopeAt(d) : scope)) },
        { name: 'Completed', color: '#10B981', area: true, values: dates.map((d, i) => (i <= todayIndex ? doneAt(d) : null)) },
        {
          name: 'Forecast',
          color: '#FBBF24',
          dashed: true,
          values: dates.map((d, i) => (i < todayIndex ? null : Math.min(scope, done + diffDays(d, today) * perDay))),
        },
      ] as LineSeries[],
      scope,
      done,
      perWeek: perDay * 7,
      finish,
      lateBy: finish ? diffDays(finish, projectEnd) : null,
    };
  }, [tasks, today, projectStart, projectEnd]);

  const sprintStats = useMemo(() => {
    const start = toDate(sprint.startDate) || addDays(today, -7);
    const end = toDate(sprint.endDate) || addDays(today, 7);
    const items = tasks.filter((t) => String(t.sprintId) === String(sprint.id));
    const total = items.length;
    const days = Math.max(1, diffDays(end, start));
    const dates = Array.from({ length: days + 1 }, (_, i) => addDays(start, i));
    const remainingAt = (d: Date) =>
      items.filter((t) => {
        const finished = isDone(t) ? doneDate(t) : null;
        return !finished || finished >= addDays(d, 1);
      }).length;
    const done = items.filter(isDone).length;
    const remaining = total - done;
    const elapsed = clamp(diffDays(today, start), 0, days);
    const idealNow = total - (total / days) * elapsed;
    return {
      labels: dates.map(fmtShort),
      series: [
        { name: 'Ideal', color: '#71717A', dashed: true, values: dates.map((_, i) => Math.round((total - (total / days) * i) * 10) / 10) },
        { name: 'Remaining', color: '#10B981', area: true, values: dates.map((d) => (d > today ? null : remainingAt(d))) },
      ] as LineSeries[],
      total,
      done,
      remaining,
      daysLeft: Math.max(0, diffDays(end, today)),
      pct: Math.round((done / Math.max(total, 1)) * 100),
      delta: Math.round(remaining - idealNow),
    };
  }, [tasks, sprint, today]);

  // ─── Health ──────────────────────────────────────────────────────────────
  const health = useMemo(() => {
    const totalSpan = Math.max(1, diffDays(projectEnd, projectStart));
    const elapsedPct = clamp((diffDays(today, projectStart) / totalSpan) * 100, 0, 100);
    const schedule = clamp(Math.round(100 - Math.max(0, elapsedPct - taskStats.pct) * 2.5), 0, 100);
    const delivery = clamp(
      Math.round(100 - (taskStats.overdue.length / Math.max(taskStats.total - taskStats.done, 1)) * 60 - (taskStats.byStatus.BLOCKED / Math.max(taskStats.total - taskStats.done, 1)) * 100),
      0,
      100
    );
    const code = clamp(Math.round((git.ciPass ?? 100) - git.stale.length * 6), 0, 100);
    const rows = [
      { label: 'Schedule', value: schedule, hint: `${Math.round(elapsedPct)}% of time used, ${taskStats.pct}% of work done` },
      { label: 'Delivery', value: delivery, hint: `${taskStats.overdue.length} overdue, ${taskStats.byStatus.BLOCKED} blocked` },
      { label: 'Quality', value: defects.score, hint: `${defects.open.length} open defects, weighted by severity` },
      { label: 'Code flow', value: code, hint: `${git.ciPass ?? '—'}% CI pass, ${git.stale.length} stale PRs` },
      { label: 'Traceability', value: traceability.coveragePct, hint: `${traceability.unlinkedCount} requirements unlinked` },
    ];
    const overall = Math.round(rows.reduce((s, r) => s + r.value, 0) / rows.length);
    return { rows, overall, band: healthBand(overall) };
  }, [today, projectStart, projectEnd, taskStats, git, defects, traceability]);

  // ─── Gantt ───────────────────────────────────────────────────────────────
  const ganttWindow = useMemo(() => {
    const cfg =
      prefs.timelineZoom === 'month'
        ? { before: 14, after: 46, tick: 7 }
        : prefs.timelineZoom === 'quarter'
          ? { before: 40, after: 80, tick: 14 }
          : { before: 90, after: 90, tick: 30 };
    const start = addDays(today, -cfg.before);
    const end = addDays(today, cfg.after);
    const span = end.getTime() - start.getTime();
    const ticks: Date[] = [];
    if (prefs.timelineZoom === 'half') {
      const m = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      while (m < end) {
        ticks.push(new Date(m));
        m.setMonth(m.getMonth() + 1);
      }
    } else {
      const first = new Date(start);
      first.setDate(first.getDate() + ((8 - first.getDay()) % 7));
      for (let d = first; d < end; d = addDays(d, cfg.tick)) ticks.push(d);
    }
    return { start, end, ticks, pct: (d: Date) => ((d.getTime() - start.getTime()) / span) * 100 };
  }, [prefs.timelineZoom, today]);

  const ganttRows = useMemo(() => {
    const order: TimelineKind[] = ['PHASE', 'EPIC', 'SPRINT', 'MILESTONE'];
    const rows = timeline
      .filter((t) => ganttFilter === 'ALL' || t.kind === ganttFilter)
      .map((t) => {
        const plannedEnd = toDate(t.plannedEnd) || toDate(t.actualEnd) || today;
        const plannedStart = toDate(t.plannedStart) || toDate(t.actualStart) || plannedEnd;
        const actualStart = toDate(t.actualStart);
        const actualEnd = toDate(t.actualEnd);
        const related = tasks.filter((x) => String(x.epicId) === String(t.id) || String(x.sprintId) === String(t.id));
        const progress =
          typeof t.progress === 'number'
            ? t.progress
            : related.length
              ? Math.round((related.filter(isDone).length / related.length) * 100)
              : 0;
        const finished = t.status === 'COMPLETED' || progress >= 100;
        const planning = !actualStart && !finished;
        const barStart = actualStart || plannedStart;
        const barEnd = actualEnd || (planning || plannedEnd >= today ? plannedEnd : today);
        const span = Math.max(1, plannedEnd.getTime() - plannedStart.getTime());
        const elapsed = clamp((today.getTime() - plannedStart.getTime()) / span, 0, 1) * 100;
        const overdue = !finished && plannedEnd < today;
        const atRisk = !finished && !overdue && !planning && elapsed - progress > 15;
        const state = finished
          ? { label: 'Done', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20', color: '#10B981' }
          : overdue
            ? { label: 'Overdue', cls: 'bg-rose-500/10 text-rose-300 border-rose-500/20', color: '#F43F5E' }
            : atRisk
              ? { label: 'At risk', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/20', color: '#F59E0B' }
              : planning
                ? { label: 'Planned', cls: 'bg-zinc-800 text-zinc-400 border-zinc-700', color: '#71717A' }
                : { label: 'On track', cls: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20', color: KIND_META[t.kind].color };
        return {
          id: String(t.id),
          name: t.name,
          kind: t.kind,
          owner: t.owner,
          plannedStart,
          plannedEnd,
          barStart,
          barEnd,
          progress,
          planning,
          state,
          slip: finished && actualEnd ? diffDays(actualEnd, plannedEnd) : overdue ? diffDays(today, plannedEnd) : 0,
          hasWork: related.length > 0,
          taskCount: related.filter((x) => !isDefect(x) && !isIssue(x)).length,
          issues: related.filter((x) => isIssue(x) && !isDone(x)).length,
          defects: related.filter((x) => isDefect(x) && !isDone(x)).length,
        };
      });
    rows.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.plannedStart.getTime() - b.plannedStart.getTime());
    return rows;
  }, [timeline, tasks, today, ganttFilter]);

  const ganttSummary = useMemo(
    () => ({
      onTrack: ganttRows.filter((r) => r.state.label === 'On track').length,
      atRisk: ganttRows.filter((r) => r.state.label === 'At risk').length,
      overdue: ganttRows.filter((r) => r.state.label === 'Overdue').length,
      planned: ganttRows.filter((r) => r.state.label === 'Planned').length,
      done: ganttRows.filter((r) => r.state.label === 'Done').length,
    }),
    [ganttRows]
  );

  // ─── Needs attention ─────────────────────────────────────────────────────
  const attention = useMemo(() => {
    type Row = { id: string; level: number; icon: React.ReactNode; text: string; meta: string; to: string };
    const rows: Row[] = [];
    defects.open
      .filter((d) => d.severity === 'CRITICAL')
      .slice(0, 3)
      .forEach((d) => rows.push({ id: `d${d.id}`, level: 0, icon: <Bug size={13} className="text-rose-400" />, text: d.title, meta: 'Critical defect', to: `${base}/defects` }));
    git.open
      .filter((p) => p.ci === 'FAIL')
      .forEach((p) => rows.push({ id: `c${p.id}`, level: 0, icon: <XCircle size={13} className="text-rose-400" />, text: `#${p.number ?? p.id} ${p.title}`, meta: 'CI failing', to: `${base}/repository` }));
    tasks
      .filter((t) => t.status === 'BLOCKED')
      .slice(0, 3)
      .forEach((t) => rows.push({ id: `b${t.id}`, level: 1, icon: <ShieldAlert size={13} className="text-amber-400" />, text: t.title, meta: 'Blocked', to: `${base}/board` }));
    team
      .filter((m) => m.load > 100)
      .slice(0, 2)
      .forEach((m) => rows.push({ id: `m${m.member.id}`, level: 1, icon: <UserRound size={13} className="text-amber-400" />, text: `${m.member.name} is at ${m.load}% capacity`, meta: 'Overloaded', to: `${base}/team` }));
    git.stale
      .slice(0, 2)
      .forEach((p) => rows.push({ id: `s${p.id}`, level: 2, icon: <Clock size={13} className="text-zinc-400" />, text: `#${p.number ?? p.id} ${p.title}`, meta: `Open ${relative(p.createdAt).replace(' ago', '')}`, to: `${base}/repository` }));
    return rows.sort((a, b) => a.level - b.level).slice(0, 6);
  }, [defects, git, tasks, team, base]);

  // ─── Work items table ────────────────────────────────────────────────────
  const workCounts: Record<WorkFilter, number> = {
    ALL: tasks.length,
    TASK: taskStats.plain,
    ISSUE: tasks.filter(isIssue).length,
    DEFECT: defects.all.length,
    BLOCKED: taskStats.byStatus.BLOCKED,
  };
  const workRows = useMemo(() => {
    const f = tasks.filter((t) => {
      if (workFilter === 'ALL') return !isDone(t);
      if (workFilter === 'BLOCKED') return t.status === 'BLOCKED';
      if (workFilter === 'DEFECT') return isDefect(t);
      if (workFilter === 'ISSUE') return isIssue(t);
      return !isDefect(t) && !isIssue(t);
    });
    return [...f].sort((a, b) => Number(isDone(a)) - Number(isDone(b))).slice(0, 8);
  }, [tasks, workFilter]);

  if (isLoading && !data) return <OverviewSkeleton />;

  if (error && !data) {
    return (
      <div className="p-8 max-w-xl mx-auto mt-12 bg-[#171A21] border border-red-500/30 rounded-2xl text-center space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto border border-red-500/20">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-base font-semibold text-white">Could not load project</h3>
        <p className="text-xs text-zinc-400 leading-relaxed">{error}</p>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white font-medium transition-colors cursor-pointer">
          <RefreshCw size={13} /> Try Again
        </button>
      </div>
    );
  }

  const todayPct = ganttWindow.pct(today);
  const projectStatus = PROJECT_STATUS[project.status || 'IN_PROGRESS'] || PROJECT_STATUS.IN_PROGRESS;
  const projectColor = project.color || accentColor;
  const daysLeft = diffDays(projectEnd, today);
  const statusParts = (['DONE', 'IN_REVIEW', 'IN_PROGRESS', 'TODO', 'BLOCKED'] as const).map((k) => ({
    key: k,
    label: STATUS_META[k].label,
    value: taskStats.byStatus[k],
    color: STATUS_META[k].color,
  }));
  const repoLabel = project.repoUrl?.replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/^https?:\/\//, '');
  const heatColor = (count: number, max: number) => {
    if (count === 0) return '#16171D';
    const t = count / max;
    if (t < 0.25) return '#3B1F7A';
    if (t < 0.5) return '#5B21B6';
    if (t < 0.75) return '#8B5CF6';
    return '#C4B5FD';
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Sections
  // ═══════════════════════════════════════════════════════════════════════════

  const summary = (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <div className="lg:col-span-8 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-[#0E0F14]/90 border border-[#27272A] p-4 flex items-center gap-4">
            <Ring pct={health.overall} color={health.band.color} size={68} stroke={7}>
              <span className="text-sm font-bold font-mono text-white">{health.overall}</span>
            </Ring>
            <div className="min-w-0">
              <div className="text-[10.5px] font-mono font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                <HeartPulse size={12} className={health.band.text} /> Health
              </div>
              <div className={`text-[13px] font-semibold mt-1 ${health.band.text}`}>{health.band.label}</div>
              <div className="text-[10.5px] font-mono text-zinc-500 mt-0.5">
                {daysLeft >= 0 ? `${daysLeft}d to target` : `${Math.abs(daysLeft)}d past target`}
              </div>
            </div>
          </div>

          <Link to={`${base}/board`} className="group rounded-2xl bg-[#0E0F14]/90 border border-[#27272A] hover:border-blue-500/40 p-4 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10.5px] font-mono font-semibold uppercase tracking-wider text-zinc-500">Tasks</div>
                <div className="text-3xl font-extrabold text-white font-mono tracking-tight mt-1">
                  {taskStats.pct}
                  <span className="text-base text-zinc-500">%</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <CheckSquare size={17} />
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <StackBar parts={statusParts} />
              <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                <span>{taskStats.done} done</span>
                <span>{taskStats.total - taskStats.done} open</span>
              </div>
            </div>
          </Link>

          <Link to={`${base}/defects`} className="group rounded-2xl bg-[#0E0F14]/90 border border-[#27272A] hover:border-rose-500/40 p-4 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10.5px] font-mono font-semibold uppercase tracking-wider text-zinc-500">Open defects</div>
                <div className="text-3xl font-extrabold text-white font-mono tracking-tight mt-1">{defects.open.length}</div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <Bug size={17} />
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <StackBar parts={defects.bySeverity.map((s) => ({ key: s.key, label: s.label, value: s.value, color: s.color }))} />
              <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                <span>{defects.bySeverity[0].value} critical</span>
                <span>{taskStats.openIssues} issues</span>
              </div>
            </div>
          </Link>

          <Link to={`${base}/sprints`} className="group rounded-2xl bg-[#0E0F14]/90 border border-[#27272A] hover:border-cyan-500/40 p-4 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10.5px] font-mono font-semibold uppercase tracking-wider text-zinc-500">{sprint.name}</div>
                <div className="text-3xl font-extrabold text-white font-mono tracking-tight mt-1">
                  {sprintStats.daysLeft}
                  <span className="text-base text-zinc-500">d left</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Target size={17} />
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <motion.div className="h-full rounded-full bg-cyan-500" initial={{ width: 0 }} animate={{ width: `${sprintStats.pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                <span>
                  {sprintStats.done}/{sprintStats.total} items
                </span>
                <span>{sprintStats.pct}%</span>
              </div>
            </div>
          </Link>
        </div>

        <Panel
          icon={<BarChart3 size={16} className="text-emerald-400" />}
          title={prefs.deliveryChart === 'burnup' ? 'Project Burn-up' : `${sprint.name} Burndown`}
          subtitle={prefs.deliveryChart === 'burnup' ? 'Scope against completed work, with a forecast from the last 28 days' : sprint.goal || 'Remaining items against the ideal line'}
          right={
            <div className="flex items-center gap-2">
              {isSample.tasks && <SampleBadge />}
              <Segmented
                value={prefs.deliveryChart}
                onChange={(deliveryChart) => update({ prefs: { ...prefs, deliveryChart } })}
                options={[
                  { value: 'burnup', label: 'Burn-up' },
                  { value: 'burndown', label: 'Burndown' },
                ]}
              />
            </div>
          }
        >
          {prefs.deliveryChart === 'burnup' ? (
            <>
              <div className="flex flex-wrap items-end gap-x-8 gap-y-2 mb-3">
                <Stat label="Completed" value={burnup.done} />
                <Stat label="Scope" value={burnup.scope} className="text-zinc-300" />
                <Stat label="Velocity" value={`${burnup.perWeek.toFixed(1)}/wk`} className="text-zinc-300" />
                <Stat label="Forecast finish" value={burnup.finish ? fmtShort(burnup.finish) : '—'} className="text-zinc-300" />
                {burnup.lateBy !== null && (
                  <Stat
                    label="Against target"
                    value={
                      <span className="inline-flex items-center gap-1">
                        {burnup.lateBy > 0 ? <TrendingDown size={15} /> : <TrendingUp size={15} />}
                        {burnup.lateBy > 0 ? `${burnup.lateBy}d late` : `${Math.abs(burnup.lateBy)}d early`}
                      </span>
                    }
                    className={burnup.lateBy > 0 ? 'text-amber-400' : 'text-emerald-400'}
                  />
                )}
              </div>
              <LineChart labels={burnup.labels} series={burnup.series} />
              <div className="mt-2">
                <Legend
                  items={[
                    { label: 'Completed', mark: <span className="w-3 h-0.5 rounded bg-emerald-500" /> },
                    { label: 'Scope', mark: <span className="w-3 h-0.5 rounded bg-indigo-500" /> },
                    { label: 'Forecast', mark: <span className="w-3 border-t-2 border-dashed border-amber-400" /> },
                  ]}
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-x-8 gap-y-2 mb-3">
                <Stat label="Remaining" value={sprintStats.remaining} />
                <Stat label="Done" value={sprintStats.done} className="text-zinc-300" />
                <Stat label="Days left" value={sprintStats.daysLeft} className="text-zinc-300" />
                <Stat
                  label="Against ideal"
                  value={sprintStats.delta > 0 ? `${sprintStats.delta} behind` : sprintStats.delta < 0 ? `${Math.abs(sprintStats.delta)} ahead` : 'On pace'}
                  className={sprintStats.delta > 0 ? 'text-amber-400' : 'text-emerald-400'}
                />
              </div>
              <LineChart labels={sprintStats.labels} series={sprintStats.series} />
              <div className="mt-2">
                <Legend
                  items={[
                    { label: 'Remaining', mark: <span className="w-3 h-0.5 rounded bg-emerald-500" /> },
                    { label: 'Ideal', mark: <span className="w-3 border-t-2 border-dashed border-zinc-500" /> },
                  ]}
                />
              </div>
            </>
          )}
        </Panel>
      </div>

      <div className="lg:col-span-4 space-y-5">
        <section className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl shrink-0 shadow-md flex items-center justify-center font-bold text-white text-sm font-mono" style={{ backgroundColor: projectColor }}>
              {(project.key || project.name || 'P').slice(0, 3)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-sm text-white truncate">{project.name || 'Project'}</h3>
                {project.currentVersion && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">{project.currentVersion}</span>
                )}
              </div>
              <p className="text-[11px] truncate font-mono mt-0.5" style={{ color: projectStatus.color }}>
                {projectStatus.label}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {[
              { to: `${base}/board`, icon: <Kanban size={14} />, label: 'Board', hover: 'group-hover:text-blue-400' },
              { to: `${base}/sprints`, icon: <Layers size={14} />, label: 'Sprints', hover: 'group-hover:text-violet-400' },
              { to: `${base}/repository`, icon: <GitBranch size={14} />, label: 'Repo', hover: 'group-hover:text-emerald-400' },
              { to: `${base}/settings`, icon: <Settings size={14} />, label: 'Settings', hover: 'group-hover:text-amber-400' },
            ].map((q) => (
              <Link key={q.label} to={q.to} className="group flex flex-col items-center gap-1 py-2.5 rounded-xl bg-[#111216] border border-[#27272A] hover:border-zinc-600 hover:bg-white/[0.03] transition-all">
                <span className={`text-zinc-400 transition-colors ${q.hover}`}>{q.icon}</span>
                <span className="text-[10px] text-zinc-300 font-medium">{q.label}</span>
              </Link>
            ))}
          </div>

          <dl className="space-y-2 text-xs pt-3 border-t border-[#27272A]/70">
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-zinc-500"><UserRound size={12} /> Lead</dt>
              <dd className="text-zinc-200 truncate font-medium">{project.lead || '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-zinc-500"><Calendar size={12} /> Start</dt>
              <dd className="text-zinc-300 font-mono text-[11px]">{projectStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-zinc-500"><Flag size={12} /> Target</dt>
              <dd className="text-zinc-300 font-mono text-[11px]">{projectEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-zinc-500"><GitFork size={12} /> Repository</dt>
              <dd className="truncate">
                {project.repoUrl ? (
                  <a href={project.repoUrl} target="_blank" rel="noreferrer" className="text-purple-400 hover:underline inline-flex items-center gap-1 font-mono text-[11px]">
                    {repoLabel}
                    <ExternalLink size={10} />
                  </a>
                ) : (
                  <span className="text-zinc-500 italic">Not connected</span>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-zinc-500"><GitBranch size={12} /> Branches</dt>
              <dd className="text-zinc-300 font-mono text-[11px]">
                {project.defaultBranch || 'main'}
                {project.branchCount !== undefined ? ` · ${project.branchCount}` : ''}
              </dd>
            </div>
          </dl>
        </section>

        <Panel icon={<HeartPulse size={16} className="text-violet-400" />} title="Project Health" subtitle="Average of five signals, 0–100" right={isSample.tasks ? <SampleBadge /> : undefined}>
          <div className="space-y-3">
            {health.rows.map((r, i) => {
              const b = healthBand(r.value);
              return (
                <div key={r.label} title={r.hint}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300">{r.label}</span>
                    <span className="font-mono text-[11px]">
                      <span className="text-zinc-500">{b.label} · </span>
                      <span className="text-white font-semibold">{r.value}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-[#16171D] overflow-hidden">
                    <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${r.value}%` }} transition={{ duration: 0.6, delay: i * 0.07, ease: 'easeOut' }} style={{ backgroundColor: b.color }} />
                  </div>
                  <div className="text-[10px] font-mono text-zinc-500 mt-1 truncate">{r.hint}</div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );

  const rowHeight = prefs.compactTimeline ? 'h-9' : 'h-12';
  const timelineSection = (
    <Panel
      icon={<GanttChartSquare size={16} className="text-amber-400" />}
      title="Project Plan"
      subtitle={`${fmtShort(ganttWindow.start)} – ${fmtShort(ganttWindow.end)} · bar is actual or forecast dates, fill is progress, thin line is the original plan`}
      right={
        <div className="flex flex-wrap items-center gap-2">
          {isSample.timeline && <SampleBadge />}
          <Segmented<GanttFilter>
            value={ganttFilter}
            onChange={setGanttFilter}
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'PHASE', label: 'Phases' },
              { value: 'EPIC', label: 'Epics' },
              { value: 'SPRINT', label: 'Sprints' },
              { value: 'MILESTONE', label: 'Milestones' },
            ]}
          />
          <Segmented
            value={prefs.timelineZoom}
            onChange={(timelineZoom) => update({ prefs: { ...prefs, timelineZoom } })}
            options={[
              { value: 'month', label: '2M' },
              { value: 'quarter', label: '4M' },
              { value: 'half', label: '6M' },
            ]}
          />
        </div>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2 text-[11px] font-mono">
          <span className="px-2 py-1 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">{ganttSummary.onTrack} on track</span>
          <span className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">{ganttSummary.atRisk} at risk</span>
          <span className="px-2 py-1 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/20">{ganttSummary.overdue} overdue</span>
          <span className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700">{ganttSummary.planned} planned</span>
          <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">{ganttSummary.done} done</span>
        </div>
        <Legend
          items={[
            { label: 'Progress', mark: <span className="w-4 h-2 rounded-sm bg-indigo-500" /> },
            { label: 'Original plan', mark: <span className="w-4 h-[3px] rounded bg-zinc-500" /> },
            { label: 'Not started', mark: <span className="w-4 h-2 rounded-sm border border-dashed border-zinc-500" /> },
            { label: 'Milestone', mark: <span className="w-2 h-2 rotate-45 bg-amber-400" /> },
          ]}
        />
      </div>

      <div className={`overflow-x-auto -mx-1 px-1 ${ganttRows.length <= 3 ? 'pb-24' : ''}`}>
        <div className="min-w-[860px]">
          <div className="flex items-end h-7 border-b border-[#27272A]">
            <div className="w-[230px] shrink-0 text-[10px] font-mono uppercase tracking-wider text-zinc-500 pb-1.5">Item</div>
            <div className="relative flex-1 h-full">
              {ganttWindow.ticks
                .filter((t) => Math.abs(ganttWindow.pct(t) - todayPct) > 4)
                .map((t, i) => (
                  <span key={i} className="absolute bottom-1.5 -translate-x-1/2 text-[10px] font-mono text-zinc-500 whitespace-nowrap" style={{ left: `${ganttWindow.pct(t)}%` }}>
                    {prefs.timelineZoom === 'half' ? t.toLocaleDateString('en-US', { month: 'short' }) : fmtShort(t)}
                  </span>
                ))}
              <span className="absolute bottom-1.5 -translate-x-1/2 text-[9px] font-mono font-bold px-1 rounded" style={{ left: `${todayPct}%`, backgroundColor: accentColor, color: '#0A0B10' }}>
                TODAY
              </span>
            </div>
            <div className="w-[118px] shrink-0 grid grid-cols-3 text-center pb-1.5 text-zinc-500" aria-hidden>
              <span title="Tasks" className="flex justify-center"><CheckSquare size={11} /></span>
              <span title="Open issues" className="flex justify-center"><CircleDot size={11} /></span>
              <span title="Open defects" className="flex justify-center"><Bug size={11} /></span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-[230px] right-[118px] pointer-events-none">
              {ganttWindow.ticks.map((t, i) => (
                <div key={i} className="absolute inset-y-0 w-px bg-[#1C1D23]" style={{ left: `${ganttWindow.pct(t)}%` }} />
              ))}
              <div className="absolute inset-y-0 w-[2px] z-20" style={{ left: `${todayPct}%`, backgroundColor: accentColor, boxShadow: `0 0 8px ${accentColor}80` }} />
            </div>

            {ganttRows.map((r, rowIndex) => {
              const rawL = ganttWindow.pct(r.barStart);
              const rawR = ganttWindow.pct(r.barEnd);
              const left = clamp(rawL, 0, 100);
              const width = clamp(rawR, 0, 100) - left;
              const planL = clamp(ganttWindow.pct(r.plannedStart), 0, 100);
              const planW = clamp(ganttWindow.pct(r.plannedEnd), 0, 100) - planL;
              const isMilestone = r.kind === 'MILESTONE';
              const markerPct = ganttWindow.pct(r.barEnd);
              const inRange = isMilestone ? markerPct >= 0 && markerPct <= 100 : width > 0;
              const isHover = hoveredGantt === r.id;
              const color = r.state.label === 'On track' || (isMilestone && r.state.label === 'Planned') ? KIND_META[r.kind].color : r.state.color;
              const tooltipLeft = isMilestone ? markerPct : left + width / 2;
              return (
                <div
                  key={r.id}
                  className={`flex items-center ${rowHeight} border-b border-[#1C1D23] last:border-b-0 transition-colors ${isHover ? 'bg-white/[0.02]' : ''}`}
                  style={{ position: 'relative', zIndex: isHover ? 30 : 1 }}
                  onMouseEnter={() => setHoveredGantt(r.id)}
                  onMouseLeave={() => setHoveredGantt(null)}
                >
                  <div className="w-[230px] shrink-0 pr-3 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {isMilestone ? (
                        <span className="w-2 h-2 rotate-45 shrink-0 mx-px" style={{ backgroundColor: color }} />
                      ) : (
                        <span className="w-1.5 h-6 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      )}
                      <div className="min-w-0">
                        <div className="text-[12.5px] text-white font-medium truncate flex items-center gap-1.5">
                          {r.name}
                          {(r.state.label === 'Overdue' || r.state.label === 'At risk') && (
                            <AlertTriangle size={11} className={`${r.state.label === 'Overdue' ? 'text-rose-400' : 'text-amber-400'} shrink-0`} />
                          )}
                        </div>
                        {!prefs.compactTimeline && (
                          <div className="text-[10px] font-mono text-zinc-500 truncate">
                            {KIND_META[r.kind].label}
                            {isMilestone ? ` · ${fmtShort(r.plannedEnd)}` : ` · ${fmtShort(r.plannedStart)} → ${fmtShort(r.plannedEnd)}`}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="relative flex-1 h-full">
                    {!inRange && (
                      <span className={`absolute top-1/2 -translate-y-1/2 text-[10px] font-mono text-zinc-500 ${rawR <= 0 || markerPct < 0 ? 'left-1' : 'right-1'}`}>
                        {rawR <= 0 || markerPct < 0 ? `◂ ended ${fmtShort(r.barEnd)}` : `starts ${fmtShort(r.barStart)} ▸`}
                      </span>
                    )}
                    {inRange && isMilestone && (
                      <span
                        className="absolute top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px]"
                        style={{ left: `${markerPct}%`, backgroundColor: r.state.label === 'Done' ? '#10B981' : '#FBBF24' }}
                      />
                    )}
                    {inRange && !isMilestone && (
                      <>
                        <div
                          className="absolute h-[20px] rounded-md overflow-hidden"
                          style={{
                            top: prefs.compactTimeline ? 6 : 10,
                            left: `${left}%`,
                            width: `${width}%`,
                            backgroundColor: r.planning ? 'transparent' : `${color}2E`,
                            border: `1px ${r.planning ? 'dashed' : 'solid'} ${color}${isHover ? 'CC' : '66'}`,
                          }}
                        >
                          <motion.div className="absolute inset-y-0 left-0" initial={{ width: 0 }} animate={{ width: `${r.progress}%` }} transition={{ duration: 0.7, ease: 'easeOut' }} style={{ backgroundColor: color, opacity: 0.85 }} />
                          {width > 7 && !r.planning && (
                            <span className="relative z-10 block px-2 text-[10.5px] font-semibold text-white whitespace-nowrap leading-[18px] drop-shadow">{r.progress}%</span>
                          )}
                        </div>
                        {planW > 0 && (
                          <div className="absolute h-[3px] rounded bg-zinc-500/80" style={{ top: prefs.compactTimeline ? 28 : 33, left: `${planL}%`, width: `${planW}%` }} />
                        )}
                      </>
                    )}
                    {isHover && (
                      <div
                        className={`absolute -translate-x-1/2 pointer-events-none p-2.5 rounded-lg bg-[#0A0B0F]/95 border border-[#27272A] shadow-xl text-[11px] space-y-1 w-[220px] z-40 ${rowIndex < 3 ? 'top-[calc(100%-4px)]' : 'bottom-[calc(100%-4px)]'}`}
                        style={{ left: `${clamp(tooltipLeft, 16, 84)}%` }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-white truncate">{r.name}</span>
                          <span className={`px-1.5 py-px rounded border text-[9.5px] font-mono shrink-0 ${r.state.cls}`}>{r.state.label}</span>
                        </div>
                        <div className="flex justify-between text-zinc-400">
                          <span>Planned</span>
                          <span className="font-mono text-zinc-200">{isMilestone ? fmtShort(r.plannedEnd) : `${fmtShort(r.plannedStart)} → ${fmtShort(r.plannedEnd)}`}</span>
                        </div>
                        {!r.planning && !isMilestone && (
                          <div className="flex justify-between text-zinc-400">
                            <span>Actual</span>
                            <span className="font-mono text-zinc-200">{fmtShort(r.barStart)} → {fmtShort(r.barEnd)}</span>
                          </div>
                        )}
                        {r.slip !== 0 && (
                          <div className="flex justify-between text-zinc-400">
                            <span>Slip</span>
                            <span className={`font-mono ${r.slip > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>{r.slip > 0 ? `+${r.slip}d` : `${r.slip}d`}</span>
                          </div>
                        )}
                        {r.owner && (
                          <div className="flex justify-between text-zinc-400">
                            <span>Owner</span>
                            <span className="text-zinc-200 truncate">{r.owner}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="w-[118px] shrink-0 grid grid-cols-3 text-center font-mono text-[11px]">
                    <span className="text-zinc-300" title="Tasks">{r.hasWork ? r.taskCount : '–'}</span>
                    <span className="text-zinc-300" title="Open issues">{r.hasWork ? r.issues : '–'}</span>
                    <span className={r.defects > 0 ? 'text-rose-300' : 'text-zinc-500'} title="Open defects">{r.hasWork ? r.defects : '–'}</span>
                  </div>
                </div>
              );
            })}
            {ganttRows.length === 0 && <p className="text-xs text-zinc-500 italic py-6 text-center">Nothing scheduled here yet.</p>}
          </div>
        </div>
      </div>
    </Panel>
  );

  const engineering = (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
      <Panel
        className="lg:col-span-7"
        icon={<GitCommitHorizontal size={16} className="text-violet-400" />}
        title="Commit Activity"
        subtitle={`Commits per day over the last ${HEAT_WEEKS} weeks`}
        right={isSample.commits ? <SampleBadge /> : undefined}
      >
        <div className="flex flex-wrap gap-x-8 gap-y-2 mb-4">
          <Stat label="Commits" value={git.total} />
          <Stat label="Contributors" value={git.contributors.length} className="text-zinc-300" />
          <Stat label="Merged 30d" value={git.merged30} className="text-zinc-300" />
          <Stat label="Median merge" value={git.medianHours === null ? '—' : git.medianHours >= 24 ? `${(git.medianHours / 24).toFixed(1)}d` : `${Math.round(git.medianHours)}h`} className="text-zinc-300" />
          <Stat label="CI pass" value={git.ciPass === null ? '—' : `${git.ciPass}%`} className="text-emerald-400" />
        </div>

        <div className="overflow-x-auto">
          <div className="inline-flex gap-2 min-w-full">
            <div className="flex flex-col gap-[3px] pt-4 text-[9px] font-mono text-zinc-600 shrink-0">
              {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((d, i) => (
                <span key={i} className="h-[13px] leading-[13px]">{d}</span>
              ))}
            </div>
            <div className="flex-1">
              <div className="flex gap-[3px] h-4 text-[9px] font-mono text-zinc-500">
                {git.weeks.map((w, i) => {
                  const first = w[0].date;
                  const show = i === 0 || first.getMonth() !== git.weeks[i - 1][0].date.getMonth();
                  return <span key={i} className="flex-1 min-w-[13px] whitespace-nowrap">{show ? first.toLocaleDateString('en-US', { month: 'short' }) : ''}</span>;
                })}
              </div>
              <div className="flex gap-[3px]">
                {git.weeks.map((w, wi) => (
                  <div key={wi} className="flex-1 min-w-[13px] flex flex-col gap-[3px]">
                    {w.map((c, di) => (
                      <div
                        key={di}
                        className={`h-[13px] rounded-[3px] transition-transform ${c.future ? 'opacity-0' : 'hover:scale-125 cursor-pointer'}`}
                        style={{ backgroundColor: heatColor(c.count, git.max) }}
                        onMouseEnter={() => !c.future && setHoveredHeat(c)}
                        onMouseLeave={() => setHoveredHeat(null)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 text-[10px] font-mono text-zinc-500">
          <span className="h-4">
            {hoveredHeat
              ? `${hoveredHeat.count} commit${hoveredHeat.count === 1 ? '' : 's'} on ${hoveredHeat.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
              : 'Hover a cell for details'}
          </span>
          <span className="flex items-center gap-1">
            Less
            {[0, 0.2, 0.45, 0.7, 1].map((f, i) => (
              <span key={i} className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: heatColor(f * git.max, git.max) }} />
            ))}
            More
          </span>
        </div>

        <div className="mt-4 pt-4 border-t border-[#27272A]/70">
          <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2.5">Top contributors</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {git.contributors.slice(0, 6).map((c) => (
              <div key={c.name} className="flex items-center gap-3 text-xs">
                <span className="w-[86px] text-zinc-300 truncate shrink-0">{c.name}</span>
                <div className="flex-1 h-1.5 rounded-full bg-[#16171D] overflow-hidden">
                  <motion.div className="h-full rounded-full bg-violet-500" initial={{ width: 0 }} animate={{ width: `${(c.n / git.contributors[0].n) * 100}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
                </div>
                <span className="w-7 text-right font-mono text-[11px] text-white">{c.n}</span>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel
        className="lg:col-span-5"
        icon={<GitPullRequest size={16} className="text-emerald-400" />}
        title="Open Pull Requests"
        subtitle={`${git.open.length} open, oldest first · ${git.stale.length} open 5+ days`}
        right={
          <div className="flex items-center gap-2">
            {isSample.pullRequests && <SampleBadge />}
            <Link to={`${base}/repository`} className="text-[11px] text-zinc-400 hover:text-white font-mono flex items-center gap-1">
              All <ArrowRight size={11} />
            </Link>
          </div>
        }
      >
        <div className="divide-y divide-[#1C1D23] rounded-xl border border-[#1F2027] overflow-hidden">
          {git.open.length === 0 && <p className="text-xs text-zinc-500 italic py-6 text-center">No open pull requests.</p>}
          {git.open.slice(0, 7).map((p) => {
            const row = (
              <>
                {p.ci === 'FAIL' ? (
                  <XCircle size={14} className="text-rose-400 shrink-0" aria-label="CI failing" />
                ) : p.ci === 'RUNNING' ? (
                  <Loader2 size={14} className="text-amber-400 shrink-0" aria-label="CI running" />
                ) : (
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" aria-label="CI passing" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-white truncate">{p.title}</div>
                  <div className="text-[10px] font-mono text-zinc-500 truncate">
                    #{p.number ?? p.id} · {p.author}
                    {p.status === 'DRAFT' ? ' · draft' : ''}
                  </div>
                </div>
                <div className="text-right shrink-0 font-mono text-[10px]">
                  <div className="text-zinc-400">{relative(p.createdAt)}</div>
                  <div>
                    <span className="text-emerald-400">+{p.additions ?? 0}</span> <span className="text-rose-400">−{p.deletions ?? 0}</span>
                  </div>
                </div>
              </>
            );
            const cls = 'flex items-center gap-2.5 px-3 py-2.5 bg-[#101116] hover:bg-[#14151B] transition-colors';
            return p.url ? (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className={cls}>{row}</a>
            ) : (
              <div key={p.id} className={cls}>{row}</div>
            );
          })}
        </div>
      </Panel>
    </div>
  );

  const S = { w: 400, h: 300, top: 12, right: 12, bottom: 34, left: 38 };
  const sW = S.w - S.left - S.right;
  const sH = S.h - S.top - S.bottom;
  const loadMax = Math.max(150, ...team.map((t) => t.load + 10));
  const sx = (v: number) => S.left + (clamp(v, 0, loadMax) / loadMax) * sW;
  const sy = (v: number) => S.top + sH - (clamp(v, 0, 100) / 100) * sH;
  const hoveredRow = team.find((t) => String(t.member.id) === hoveredMember);

  const teamSection = (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
      <Panel
        className="lg:col-span-5"
        icon={<Sparkles size={16} className="text-pink-400" />}
        title="Potential vs Load"
        subtitle="Who can take more on, and who needs relief"
        right={isSample.members ? <SampleBadge /> : undefined}
      >
        <div className="relative" onMouseLeave={() => setHoveredMember(null)}>
          <svg viewBox={`0 0 ${S.w} ${S.h}`} className="w-full h-auto overflow-visible" role="img" aria-label="Scatter of team member load against potential">
            <rect x={sx(0)} y={sy(100)} width={sx(70) - sx(0)} height={sy(60) - sy(100)} fill="#10B981" opacity="0.06" />
            <rect x={sx(100)} y={sy(100)} width={sx(loadMax) - sx(100)} height={sy(0) - sy(100)} fill="#F43F5E" opacity="0.06" />
            {[0, 20, 40, 60, 80, 100].map((v) => (
              <g key={v}>
                <line x1={S.left} x2={S.w - S.right} y1={sy(v)} y2={sy(v)} stroke="#1F2027" />
                <text x={S.left - 8} y={sy(v) + 3} fill="#52525B" fontSize="9" fontFamily="monospace" textAnchor="end">{v}</text>
              </g>
            ))}
            {[0, 50, 100, 150].map((v) => (
              <text key={v} x={sx(v)} y={S.h - 19} fill="#52525B" fontSize="9" fontFamily="monospace" textAnchor="middle">{v}%</text>
            ))}
            <text x={S.left + sW / 2} y={S.h - 4} fill="#71717A" fontSize="9.5" textAnchor="middle">Load (open hours / capacity)</text>
            <text transform={`translate(10 ${S.top + sH / 2}) rotate(-90)`} fill="#71717A" fontSize="9.5" textAnchor="middle">Potential</text>
            <text x={sx(0) + 6} y={sy(60) - 6} fill="#6EE7B7" fontSize="9.5" opacity="0.8">Ready for more</text>
            <text x={sx(loadMax) - 6} y={sy(0) - 6} fill="#FDA4AF" fontSize="9.5" opacity="0.8" textAnchor="end">Overloaded</text>
            <line x1={sx(100)} x2={sx(100)} y1={S.top} y2={S.top + sH} stroke="#3F3F46" strokeDasharray="3 3" />
            {team.map((t) => {
              const id = String(t.member.id);
              const active = hoveredMember === id;
              return (
                <g key={id} onMouseEnter={() => setHoveredMember(id)} className="cursor-pointer">
                  <circle cx={sx(t.load)} cy={sy(t.potential)} r={16} fill="transparent" />
                  <circle cx={sx(t.load)} cy={sy(t.potential)} r={active ? 12 : 10.5} fill={t.color} stroke="#0E0F14" strokeWidth="2" opacity={hoveredMember && !active ? 0.4 : 1} />
                  <text x={sx(t.load)} y={sy(t.potential) + 3} fill="#fff" fontSize="8.5" fontWeight="700" textAnchor="middle" pointerEvents="none">{initials(t.member.name)}</text>
                </g>
              );
            })}
          </svg>
          {hoveredRow && (
            <div
              className="absolute pointer-events-none p-2.5 rounded-lg bg-[#0A0B0F]/95 border border-[#27272A] shadow-xl text-[11px] space-y-1 min-w-[150px] -translate-x-1/2"
              style={{ left: `${clamp((sx(hoveredRow.load) / S.w) * 100, 20, 80)}%`, top: `${clamp((sy(hoveredRow.potential) / S.h) * 100 + 7, 0, 62)}%` }}
            >
              <div className="font-semibold text-white">{hoveredRow.member.name}</div>
              <div className="flex justify-between gap-4 text-zinc-400"><span>Potential</span><span className="font-mono text-white">{hoveredRow.potential}</span></div>
              <div className="flex justify-between gap-4 text-zinc-400"><span>Load</span><span className="font-mono text-white">{hoveredRow.load}%</span></div>
              <div className="flex justify-between gap-4 text-zinc-400"><span>Hours</span><span className="font-mono text-white">{hoveredRow.hours}/{hoveredRow.capacity}</span></div>
            </div>
          )}
        </div>
      </Panel>

      <Panel
        className="lg:col-span-7"
        icon={<Users size={16} className="text-blue-400" />}
        title="Team Potential"
        subtitle="Potential = 35% on-time, 25% output, 20% quality, 20% reviews"
        right={
          <Link to={`${base}/team`} className="text-[11px] text-zinc-400 hover:text-white font-mono flex items-center gap-1">
            Team <ArrowRight size={11} />
          </Link>
        }
      >
        <div className="overflow-x-auto">
          <div className="min-w-[520px]">
            <div className="grid grid-cols-[1fr_110px_120px_56px_56px_50px] gap-3 px-2 pb-2 text-[10px] font-mono uppercase tracking-wider text-zinc-600">
              <span>Member</span>
              <span>Potential</span>
              <span>Load</span>
              <span className="text-right">On-time</span>
              <span className="text-right">Done</span>
              <span className="text-right">Rev.</span>
            </div>
            <div className="space-y-0.5">
              {team.map((t, i) => {
                const id = String(t.member.id);
                return (
                  <div
                    key={id}
                    onMouseEnter={() => setHoveredMember(id)}
                    onMouseLeave={() => setHoveredMember(null)}
                    className={`grid grid-cols-[1fr_110px_120px_56px_56px_50px] gap-3 items-center px-2 py-1.5 rounded-lg transition-colors ${hoveredMember === id ? 'bg-white/[0.04]' : ''}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MemberAvatar member={t.member} color={t.color} />
                      <div className="min-w-0">
                        <div className="text-xs text-white font-medium truncate">{t.member.name}</div>
                        <div className="text-[10px] font-mono text-zinc-500 truncate">{t.member.role || 'Member'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-[#16171D] overflow-hidden">
                        <motion.div className="h-full rounded-full bg-pink-500" initial={{ width: 0 }} animate={{ width: `${t.potential}%` }} transition={{ duration: 0.6, delay: i * 0.05, ease: 'easeOut' }} />
                      </div>
                      <span className="w-6 text-right font-mono text-[11px] font-bold text-white">{t.potential}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-zinc-300">{t.load}%</span>
                        <span className="text-zinc-500 truncate">{t.capacityState.label}</span>
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-[#16171D] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${clamp(t.load, 2, 100)}%`, backgroundColor: t.capacityState.bar }} />
                      </div>
                    </div>
                    <span className="text-right font-mono text-[11px] text-zinc-300">{t.onTime === null ? '—' : `${t.onTime}%`}</span>
                    <span className="text-right font-mono text-[11px] text-zinc-300">{t.done}</span>
                    <span className="text-right font-mono text-[11px] text-zinc-300">{t.reviews}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );

  const D = { w: 640, h: 200, top: 10, right: 10, bottom: 22, left: 30 };
  const dW = D.w - D.left - D.right;
  const dMid = D.top + (D.h - D.top - D.bottom) / 2;
  const dHalf = (D.h - D.top - D.bottom) / 2;
  const dBucket = dW / defects.weeks.length;
  const dBar = Math.min(22, dBucket * 0.56);
  const dScale = (v: number) => (v / defects.max) * dHalf;

  const quality = (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
      <Panel
        className="lg:col-span-7"
        icon={<Bug size={16} className="text-rose-400" />}
        title="Defect Trend"
        subtitle="Opened above the line, closed below, per week"
        right={isSample.tasks ? <SampleBadge /> : undefined}
      >
        <div className="flex flex-wrap gap-x-8 gap-y-2 mb-3">
          <Stat label="Open" value={defects.open.length} />
          {defects.bySeverity.map((s) => (
            <Stat key={s.key} label={s.label} value={s.value} className="text-zinc-300" />
          ))}
          <Stat label="Median fix" value={defects.mttr === null ? '—' : `${defects.mttr.toFixed(1)}d`} className="text-zinc-300" />
          <Stat label="Defect share" value={`${defects.density}%`} className="text-zinc-300" />
        </div>
        <div className="relative" onMouseLeave={() => setHoveredDefect(null)}>
          <svg viewBox={`0 0 ${D.w} ${D.h}`} className="w-full h-auto overflow-visible" role="img" aria-label="Defects opened and closed per week">
            {[1, 0.5, 0, -0.5, -1].map((f) => {
              const y = dMid - f * dHalf;
              return (
                <g key={f}>
                  <line x1={D.left} x2={D.w - D.right} y1={y} y2={y} stroke={f === 0 ? '#3F3F46' : '#1F2027'} />
                  <text x={D.left - 8} y={y + 3} fill="#52525B" fontSize="9" fontFamily="monospace" textAnchor="end">{Math.abs(Math.round(defects.max * f))}</text>
                </g>
              );
            })}
            {defects.weeks.map((w, i) => {
              const cx = D.left + dBucket * i + dBucket / 2;
              const dim = hoveredDefect !== null && hoveredDefect !== i;
              return (
                <g key={i} onMouseEnter={() => setHoveredDefect(i)} className="cursor-pointer">
                  {w.opened > 0 && <rect x={cx - dBar / 2} y={dMid - dScale(w.opened) - 1} width={dBar} height={dScale(w.opened)} rx="3" fill="#F43F5E" opacity={dim ? 0.3 : 0.9} />}
                  {w.closed > 0 && <rect x={cx - dBar / 2} y={dMid + 1} width={dBar} height={dScale(w.closed)} rx="3" fill="#10B981" opacity={dim ? 0.3 : 0.9} />}
                  <rect x={D.left + dBucket * i} y={D.top} width={dBucket} height={dHalf * 2} fill="transparent" />
                  {i % 2 === 0 && (
                    <text x={cx} y={D.h - 6} fill={hoveredDefect === i ? '#E4E4E7' : '#52525B'} fontSize="9" fontFamily="monospace" textAnchor="middle">{w.label}</text>
                  )}
                </g>
              );
            })}
          </svg>
          {hoveredDefect !== null && (
            <div
              className="absolute top-0 pointer-events-none p-2.5 rounded-lg bg-[#0A0B0F]/95 border border-[#27272A] shadow-xl text-[11px] space-y-1 min-w-[140px] -translate-x-1/2"
              style={{ left: `${clamp(((D.left + dBucket * hoveredDefect + dBucket / 2) / D.w) * 100, 14, 86)}%` }}
            >
              <div className="font-mono text-[10px] text-zinc-400">{defects.weeks[hoveredDefect].range}</div>
              <div className="flex justify-between gap-4 text-zinc-300"><span>Opened</span><span className="font-mono font-bold text-white">{defects.weeks[hoveredDefect].opened}</span></div>
              <div className="flex justify-between gap-4 text-zinc-300"><span>Closed</span><span className="font-mono font-bold text-white">{defects.weeks[hoveredDefect].closed}</span></div>
            </div>
          )}
        </div>
        <div className="mt-2">
          <Legend
            items={[
              { label: 'Opened', mark: <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> },
              { label: 'Closed', mark: <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> },
            ]}
          />
        </div>
      </Panel>

      <Panel className="lg:col-span-5" icon={<AlertTriangle size={16} className="text-amber-400" />} title="Needs Attention" subtitle="Most urgent first">
        {attention.length === 0 ? (
          <p className="text-xs text-zinc-500 italic py-6 text-center">Nothing needs attention right now.</p>
        ) : (
          <div className="space-y-1">
            {attention.map((a) => (
              <Link key={a.id} to={a.to} className="group flex items-center gap-2.5 p-2 -mx-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                <span className="w-6 h-6 rounded-lg bg-[#111216] border border-[#27272A] flex items-center justify-center shrink-0">{a.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-zinc-100 truncate">{a.text}</div>
                  <div className="text-[10px] font-mono text-zinc-500">{a.meta}</div>
                </div>
                <ArrowRight size={12} className="text-zinc-600 group-hover:text-white transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );

  const work = (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <Panel
        className="lg:col-span-8"
        icon={<ListChecks size={16} className="text-indigo-400" />}
        title="Work Items"
        subtitle="Tasks, issues and defects across this project"
        right={
          <div className="flex items-center p-0.5 rounded-lg bg-[#0A0B0F] border border-[#27272A] overflow-x-auto">
            {(['ALL', 'TASK', 'ISSUE', 'DEFECT', 'BLOCKED'] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={workFilter === f}
                onClick={() => setWorkFilter(f)}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer font-mono text-[11px] flex items-center gap-1.5 whitespace-nowrap ${workFilter === f ? 'bg-[#1C1E26] text-white' : 'text-zinc-500 hover:text-zinc-200'}`}
              >
                {f === 'ALL' ? 'Open' : f[0] + f.slice(1).toLowerCase() + (f === 'BLOCKED' ? '' : 's')}
                <span className="text-[9.5px] text-zinc-500">{f === 'ALL' ? taskStats.total - taskStats.done : workCounts[f]}</span>
              </button>
            ))}
          </div>
        }
      >
        <div className="hidden sm:grid grid-cols-[1fr_72px_80px_100px_70px] gap-3 px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-zinc-600">
          <span>Item</span>
          <span>Type</span>
          <span>Priority</span>
          <span>Status</span>
          <span className="text-right">Due</span>
        </div>
        <div className="divide-y divide-[#1C1D23] rounded-xl border border-[#1F2027] overflow-hidden">
          {workRows.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-6 text-center">Nothing matches this filter.</p>
          ) : (
            workRows.map((t) => {
              const pr = PRIORITY_META.find((p) => p.key === t.priority);
              const due = toDate(t.dueDate);
              const late = due && due < today && !isDone(t);
              const meta = STATUS_META[t.status || 'TODO'] || STATUS_META.TODO;
              return (
                <div key={t.id} className="grid grid-cols-1 sm:grid-cols-[1fr_72px_80px_100px_70px] gap-2 sm:gap-3 items-center px-3 py-2.5 bg-[#101116] hover:bg-[#14151B] transition-colors text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                    <span className={`truncate ${isDone(t) ? 'text-zinc-500 line-through' : 'text-white'}`}>{t.title}</span>
                  </div>
                  <span className="text-[11px] text-zinc-400">{isDefect(t) ? 'Defect' : isIssue(t) ? 'Issue' : 'Task'}</span>
                  <span className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pr?.color || '#71717A' }} />
                    {pr?.label || t.priority || '—'}
                  </span>
                  <span className="justify-self-start px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-zinc-800 text-zinc-300 whitespace-nowrap">{meta.label}</span>
                  <span className={`sm:text-right font-mono text-[10.5px] ${late ? 'text-rose-400' : 'text-zinc-500'}`}>{due ? fmtShort(due) : '—'}</span>
                </div>
              );
            })
          )}
        </div>
      </Panel>

      <Panel
        className="lg:col-span-4"
        icon={<Rocket size={16} className="text-emerald-400" />}
        title="Releases"
        right={
          <div className="flex items-center gap-2">
            {isSample.releases && <SampleBadge />}
            <Link to={`${base}/releases`} className="text-[11px] font-mono text-zinc-400 hover:text-white flex items-center gap-1">
              All <ArrowRight size={11} />
            </Link>
          </div>
        }
      >
        <ol className="relative pl-6 space-y-3.5">
          <div className="absolute left-[9px] top-2 bottom-2 w-px bg-[#27272A]" />
          {releases.slice(0, 6).map((r) => {
            const d = toDate(r.date);
            const icon =
              r.status === 'SHIPPED' ? <CheckCircle size={11} className="text-emerald-400" /> : r.status === 'ROLLED_BACK' ? <RotateCcw size={11} className="text-rose-400" /> : <Calendar size={11} className="text-amber-400" />;
            const label = r.status === 'SHIPPED' ? 'Shipped' : r.status === 'ROLLED_BACK' ? 'Rolled back' : 'Scheduled';
            return (
              <li key={r.id} className="relative">
                <div className="absolute -left-6 top-0 w-[19px] h-[19px] rounded-full border border-[#27272A] bg-[#12131A] flex items-center justify-center z-10">{icon}</div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-semibold text-white">{r.version}</span>
                  <span className="text-[10px] font-mono text-zinc-500">{d ? fmtShort(d) : '—'}</span>
                </div>
                <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                  {label}
                  {r.items !== undefined ? ` · ${r.items} items` : ''}
                </div>
              </li>
            );
          })}
        </ol>
      </Panel>
    </div>
  );

  const traceabilitySection = (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <Panel
        className="lg:col-span-8"
        icon={<GitFork size={16} className="text-blue-400" />}
        title="Requirement Traceability"
        subtitle="From requirement through to production release"
        right={
          <div className="flex items-center gap-2">
            {isSample.traceability && <SampleBadge />}
            <Link to={`${base}/requirements/traceability`} className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-400 hover:text-white">
              Open matrix <ExternalLink size={11} />
            </Link>
          </div>
        }
      >
        <div className="flex flex-wrap gap-x-8 gap-y-2 mb-4">
          <Stat label="Specifications" value={traceability.totalRequirements} />
          <Stat label="Coverage" value={`${traceability.coveragePct}%`} className={healthBand(traceability.coveragePct).text} />
          <Stat label="Linked" value={traceability.linkedRequirements} className="text-zinc-300" />
          <Stat label="Untraced" value={traceability.unlinkedCount} className="text-amber-400" />
          <Stat label="Unverified criteria" value={traceability.unverifiedCriteriaCount} className="text-zinc-300" />
        </div>
        <div className="p-3 rounded-xl bg-[#0A0B0F] border border-[#1F2027] overflow-x-auto">
          <div className="flex items-center gap-1.5 min-w-[680px] justify-between">
            {traceability.chainNodes.map((node, i) => {
              const m = CHAIN_LEGEND.find((c) => c.key === node.status) || CHAIN_LEGEND[1];
              return (
                <React.Fragment key={node.name}>
                  <div className={`flex-1 min-w-0 px-2 py-2 rounded-xl border flex flex-col items-center ${m.node}`} title={m.label}>
                    <span className="text-[9.5px] font-mono font-semibold uppercase tracking-wider">{node.name}</span>
                    <span className="text-sm font-extrabold font-mono text-white mt-0.5">{node.count}</span>
                  </div>
                  {i < traceability.chainNodes.length - 1 && <ArrowRight size={12} className="text-zinc-600 shrink-0" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>
        <div className="mt-2.5">
          <Legend items={CHAIN_LEGEND.map((c) => ({ label: c.label, mark: <span className={`w-2 h-2 rounded-full ${c.dot}`} /> }))} />
        </div>
        {traceability.warnings.length > 0 && (
          <div className="mt-4 divide-y divide-[#1C1D23] rounded-xl border border-[#1F2027] overflow-hidden">
            {traceability.warnings.map((w) => (
              <Link key={w.id} to={w.link} className="group flex items-center justify-between gap-3 px-3 py-2.5 bg-[#101116] hover:bg-[#14151B] transition-colors text-xs">
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold border shrink-0 ${w.severity === 'HIGH' ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'}`}>{w.severity}</span>
                  <span className="text-zinc-200 truncate">{w.message}</span>
                </span>
                <span className="flex items-center gap-1 text-[11px] text-zinc-500 group-hover:text-white transition-colors shrink-0">
                  Resolve <ArrowRight size={12} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </Panel>

      <section className="lg:col-span-4 rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity size={15} className="text-blue-400" />
            <h3 className="font-semibold text-[14px] text-white">Activity</h3>
          </div>
          {isSample.activities && <SampleBadge />}
        </div>
        <ol className="relative pl-6 space-y-3.5">
          <div className="absolute left-[9px] top-2 bottom-2 w-px bg-[#27272A]" />
          {activities.slice(0, 8).map((a) => (
            <li key={a.id} className="relative">
              <div className="absolute -left-6 top-0 w-[19px] h-[19px] rounded-full border border-[#27272A] bg-[#12131A] flex items-center justify-center z-10">
                <Activity size={11} className="text-zinc-400" />
              </div>
              <p className="text-xs text-zinc-200 leading-snug line-clamp-2">
                {a.actor ? `${a.actor} ` : ''}
                {a.message}
              </p>
              <div className="mt-0.5 text-[10px] font-mono text-zinc-500">{relative(a.createdAt)}</div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );

  const sectionMap: Record<SectionId, React.ReactNode> = {
    summary,
    timeline: timelineSection,
    engineering,
    team: teamSection,
    quality,
    work,
    traceability: traceabilitySection,
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="w-full px-4 sm:px-8 lg:px-10 pt-4 sm:pt-6 pb-16 space-y-5 text-left">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#27272A]/70">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-xl shadow-md shrink-0 flex items-center justify-center font-bold text-white font-mono" style={{ backgroundColor: projectColor }}>
              {(project.key || project.name || 'P').slice(0, 3)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-[28px] font-extrabold text-white tracking-tight leading-tight truncate">{project.name || 'Project'}</h1>
                {project.key && (
                  <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold border" style={{ backgroundColor: `${accentColor}18`, borderColor: `${accentColor}40`, color: accentColor }}>
                    {project.key}
                  </span>
                )}
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider font-mono border ${health.band.soft} ${health.band.text}`}>
                  <HeartPulse size={11} /> {health.band.label}
                </span>
                {project.role && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">{project.role}</span>
                )}
                {isSample.project && <SampleBadge />}
              </div>
              {project.description && <p className="text-[13.5px] text-zinc-400 mt-1 truncate">{project.description}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {members.length > 0 && (
              <div className="flex items-center -space-x-2 select-none mr-1">
                {members.slice(0, 5).map((m, i) => (
                  <div key={m.id} className="relative rounded-full ring-2 ring-[#0C0D10] hover:z-30 hover:-translate-y-0.5 transition-transform" style={{ zIndex: 10 - i }}>
                    <MemberAvatar member={m} color={MEMBER_COLORS[i % MEMBER_COLORS.length]} />
                  </div>
                ))}
                {members.length > 5 && (
                  <div className="relative w-[28px] h-[28px] rounded-full ring-2 ring-[#0C0D10] bg-[#1E1F26] flex items-center justify-center text-[10px] font-bold font-mono text-zinc-300">+{members.length - 5}</div>
                )}
              </div>
            )}
            <Link to={`${base}/classic`} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#27272A] text-zinc-300 hover:text-white hover:bg-white/[0.06] text-[12px] font-medium transition-colors cursor-pointer" title="Switch to classic tabs view">
              <LayoutDashboard size={13} className="text-zinc-400" />
              <span className="hidden sm:inline">Classic View</span>
            </Link>
            <Link to={`${base}/settings`} className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#27272A] text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors" title="Project settings" aria-label="Project settings">
              <Settings size={14} />
            </Link>
            <button type="button" onClick={() => setCustomizeOpen(true)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#27272A] text-zinc-300 hover:text-white hover:bg-white/[0.06] text-[12px] font-medium transition-colors cursor-pointer">
              <SlidersHorizontal size={13} className="text-zinc-400" />
              <span className="hidden sm:inline">Customize</span>
            </button>
            <button type="button" onClick={() => setIsCreateOpen(true)} className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[12px] font-semibold text-[#0A0B10] transition-all hover:brightness-110 cursor-pointer" style={{ backgroundColor: accentColor, boxShadow: `0 2px 10px ${accentColor}25` }}>
              <Plus size={14} />
              <span>New Issue</span>
            </button>
          </div>
        </div>

        {layout.sections
          .filter((s: LayoutEntry<SectionId>) => s.visible)
          .map((s) => (
            <React.Fragment key={s.id}>{sectionMap[s.id]}</React.Fragment>
          ))}

        {layout.sections.every((s: LayoutEntry<SectionId>) => !s.visible) && (
          <p className="text-xs text-zinc-500 text-center py-12">
            All sections are hidden. Use Customize to bring them back.
          </p>
        )}

        <CustomizeDrawer open={customizeOpen} onClose={() => setCustomizeOpen(false)} layout={layout} update={update} reset={reset} settingsHref={`${base}/settings`} />
      </div>
    </MotionConfig>
  );
};

export default ProjectOverviewView;