import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowDownAZ,
  ArrowUpDown,
  Bug,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit3,
  ExternalLink,
  Flame,
  GitBranch,
  Layers,
  LayoutGrid,
  Link2,
  List,
  ListFilter,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { testingService } from '../../../services/testing.service';
import { useAccentTheme } from '../../../services/accentTheme.service';
import { useToast } from '../../../context/ToastContext';
import { confirmDeleteSwal } from '../../../lib/confirmAlert';
import { AnimatedSelect, type SelectOption } from '../../../components/settings/AnimatedSelect';
import { UserAvatar } from '../../../components/common/UserAvatar';
import { TestingPageHeader } from '../../../components/testing/TestingPageHeader';
import {
  DefectStatusBadge,
  ExecutionStatusBadge,
  TestingPriorityBadge,
  TestingSeverityBadge,
  formatTestingDate,
  formatTestingDateTime,
} from '../../../components/testing/testingBadges';
import { DefectModal } from './DefectModal';
import { DefectDrawer } from './DefectDrawer';
import type {
  QaDefectDetail,
  QaDefectItem,
  TestingConfigurationItem,
  TestingMetaData,
  TestingPermissions,
} from '../../../types/testing';

interface DefectsViewProps {
  projectId?: number;
}

export type DefectGroupBy =
  | 'none'
  | 'severity'
  | 'priority'
  | 'status'
  | 'assignee'
  | 'environment';

const GROUP_OPTIONS: Array<{
  key: DefectGroupBy;
  label: string;
  sublabel: string;
  shortLabel: string;
  icon: React.ReactNode;
}> = [
  { key: 'none', label: 'No Grouping', sublabel: 'Flat list or card view', shortLabel: 'None', icon: <List size={13} className="text-zinc-400" /> },
  { key: 'severity', label: 'Defect Severity', sublabel: 'Critical, Major, Moderate, Minor', shortLabel: 'Severity', icon: <Flame size={13} className="text-rose-400" /> },
  { key: 'priority', label: 'Priority', sublabel: 'Critical, High, Medium, Low', shortLabel: 'Priority', icon: <AlertTriangle size={13} className="text-amber-400" /> },
  { key: 'status', label: 'Lifecycle Status', sublabel: 'Open, In Progress, Fixed, Verified, Closed', shortLabel: 'Status', icon: <Clock size={13} className="text-purple-400" /> },
  { key: 'assignee', label: 'Assigned Developer', sublabel: 'Group by defect owner', shortLabel: 'Assignee', icon: <User size={13} className="text-teal-400" /> },
  { key: 'environment', label: 'Environment', sublabel: 'Staging, Production, QA, Local', shortLabel: 'Env', icon: <Server size={13} className="text-cyan-400" /> },
];

const SORT_OPTIONS: Array<{
  key: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
}> = [
  { key: 'severity:desc', label: 'Severity (Critical First)', sublabel: 'Blockers → Minor', icon: <Flame size={13} className="text-rose-400" /> },
  { key: 'severity:asc', label: 'Severity (Lowest First)', sublabel: 'Minor → Blockers', icon: <Flame size={13} className="text-amber-400" /> },
  { key: 'priority:desc', label: 'Priority (Urgent First)', sublabel: 'Critical → Low', icon: <AlertTriangle size={13} className="text-orange-400" /> },
  { key: 'priority:asc', label: 'Priority (Lowest First)', sublabel: 'Low → Critical', icon: <AlertTriangle size={13} className="text-yellow-400" /> },
  { key: 'updatedAt:desc', label: 'Recently Updated', sublabel: 'Most recent first', icon: <Clock size={13} className="text-emerald-400" /> },
  { key: 'createdAt:desc', label: 'Newest Created', sublabel: 'Latest reported', icon: <Calendar size={13} className="text-cyan-400" /> },
  { key: 'createdAt:asc', label: 'Oldest Created', sublabel: 'Earliest reported', icon: <Calendar size={13} className="text-zinc-400" /> },
  { key: 'key:asc', label: 'Defect Key (DEF-001 → )', sublabel: 'Sequential order', icon: <ArrowDownAZ size={13} className="text-sky-400" /> },
];

const DEFECT_STATUS_FILTER_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'Open', label: 'Open' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Fixed', label: 'Fixed (Pending Retest)' },
  { value: 'Ready for Retest', label: 'Ready for Retest' },
  { value: 'Verified', label: 'Verified (QA)' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Reopened', label: 'Reopened' },
];

const DEFAULT_META: TestingMetaData = {
  members: [],
  teams: [],
  modules: [],
  devTasks: [],
  requirements: [],
  projectDocuments: [],
  gitRepositories: [],
};

const DEFAULT_PERMS: TestingPermissions = {
  role: 'viewer',
  canViewTesting: true,
  canEditTestCases: false,
  canExecuteTests: false,
  canManageDefects: false,
  canManagePlansSuites: false,
  canManageSettings: false,
  canViewReports: true,
  canArchiveRecords: false,
};

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 4,
  blocker: 4,
  major: 3,
  moderate: 2,
  medium: 2,
  minor: 1,
  low: 1,
  trivial: 0.5,
};

const PRIORITY_WEIGHTS: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export const DefectsView: React.FC<DefectsViewProps> = ({ projectId: propProjectId }) => {
  const { id } = useParams<{ id: string }>();
  const projectId = propProjectId || Number(id);
  const [searchParams, setSearchParams] = useSearchParams();
  const { accentColor } = useAccentTheme();
  const { toast } = useToast();

  const [defects, setDefects] = useState<QaDefectItem[]>([]);
  const [meta, setMeta] = useState<TestingMetaData>(DEFAULT_META);
  const [config, setConfig] = useState<TestingConfigurationItem | null>(null);
  const [permissions, setPermissions] = useState<TestingPermissions>(DEFAULT_PERMS);

  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');
  const [groupBy, setGroupBy] = useState<DefectGroupBy>('none');
  const [sortValue, setSortValue] = useState('severity:desc');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Filters State
  const [search, setSearch] = useState(searchParams.get('q') || searchParams.get('search') || '');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || 'ALL');
  const [filterSeverity, setFilterSeverity] = useState(searchParams.get('severity') || 'ALL');
  const [filterPriority, setFilterPriority] = useState(searchParams.get('priority') || 'ALL');
  const [filterAssigneeId, setFilterAssigneeId] = useState(searchParams.get('assigneeId') || 'ALL');
  const [filterEnvironment, setFilterEnvironment] = useState(searchParams.get('environment') || 'ALL');
  const [filterDevTaskId, setFilterDevTaskId] = useState(searchParams.get('linkedDevTaskId') || '');
  const [filterReqId, setFilterReqId] = useState(searchParams.get('linkedRequirementId') || '');
  const [includeArchived, setIncludeArchived] = useState(searchParams.get('archived') === '1');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Popover State: Icon-only Filter & Inbuilt Sort/Group Popovers
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortGroupOpen, setIsSortGroupOpen] = useState(false);
  const [isGroupByHovered, setIsGroupByHovered] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const sortGroupRef = useRef<HTMLDivElement>(null);

  // Modal & Drawer State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDefect, setEditingDefect] = useState<QaDefectDetail | QaDefectItem | null>(null);
  const [drawerDefectId, setDrawerDefectId] = useState<number | null>(
    searchParams.get('defectId') ? Number(searchParams.get('defectId')) : null
  );

  // Close Popovers on Click Outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (filterRef.current && !filterRef.current.contains(target)) {
        setIsFilterOpen(false);
      }
      if (sortGroupRef.current && !sortGroupRef.current.contains(target)) {
        setIsSortGroupOpen(false);
        setIsGroupByHovered(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global Keyboard Shortcuts: Shift+D to log defect, Escape to close drawer/modal
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        const activeTag = (document.activeElement?.tagName || '').toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          if (permissions.canManageDefects) {
            setEditingDefect(null);
            setModalOpen(true);
          }
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [permissions.canManageDefects]);

  // Load Data
  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [metaRes, defectsRes] = await Promise.all([
        testingService.getMeta(projectId),
        testingService.listDefects(projectId, {
          search: search || undefined,
          status: filterStatus !== 'ALL' ? filterStatus : undefined,
          severity: filterSeverity !== 'ALL' ? filterSeverity : undefined,
          priority: filterPriority !== 'ALL' ? filterPriority : undefined,
          assigneeId: filterAssigneeId !== 'ALL' ? Number(filterAssigneeId) : undefined,
          includeArchived,
        }),
      ]);

      if (metaRes.success && metaRes.data) {
        setMeta(metaRes.data.meta);
        setConfig(metaRes.data.config);
        setPermissions(metaRes.data.permissions);
      }

      if (defectsRes.success && defectsRes.data) {
        setDefects(defectsRes.data.items);
      }
    } catch {
      toast.error('Failed to load defects');
    } finally {
      setLoading(false);
    }
  }, [
    projectId,
    search,
    filterStatus,
    filterSeverity,
    filterPriority,
    filterAssigneeId,
    includeArchived,
    toast,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Sync query params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (filterStatus !== 'ALL') params.set('status', filterStatus);
    if (filterSeverity !== 'ALL') params.set('severity', filterSeverity);
    if (filterPriority !== 'ALL') params.set('priority', filterPriority);
    if (filterAssigneeId !== 'ALL') params.set('assigneeId', filterAssigneeId);
    if (filterEnvironment !== 'ALL') params.set('environment', filterEnvironment);
    if (filterDevTaskId) params.set('linkedDevTaskId', filterDevTaskId);
    if (filterReqId) params.set('linkedRequirementId', filterReqId);
    if (includeArchived) params.set('archived', '1');
    if (drawerDefectId) params.set('defectId', String(drawerDefectId));
    setSearchParams(params, { replace: true });
  }, [
    search,
    filterStatus,
    filterSeverity,
    filterPriority,
    filterAssigneeId,
    filterEnvironment,
    filterDevTaskId,
    filterReqId,
    includeArchived,
    drawerDefectId,
    setSearchParams,
  ]);

  // Filtered & Sorted Defects
  const processedDefects = useMemo(() => {
    let list = [...defects];

    // Client-side additional filtering
    if (filterEnvironment !== 'ALL') {
      list = list.filter((d) => d.environment === filterEnvironment);
    }
    if (filterDevTaskId) {
      list = list.filter((d) => String(d.linkedDevTaskId) === filterDevTaskId);
    }
    if (filterReqId) {
      list = list.filter((d) => String(d.linkedRequirementId) === filterReqId);
    }

    // Sorting
    list.sort((a, b) => {
      switch (sortValue) {
        case 'severity:desc': {
          const wa = SEVERITY_WEIGHTS[a.severity.toLowerCase()] || 0;
          const wb = SEVERITY_WEIGHTS[b.severity.toLowerCase()] || 0;
          return wb - wa;
        }
        case 'severity:asc': {
          const wa = SEVERITY_WEIGHTS[a.severity.toLowerCase()] || 0;
          const wb = SEVERITY_WEIGHTS[b.severity.toLowerCase()] || 0;
          return wa - wb;
        }
        case 'priority:desc': {
          const wa = PRIORITY_WEIGHTS[a.priority.toLowerCase()] || 0;
          const wb = PRIORITY_WEIGHTS[b.priority.toLowerCase()] || 0;
          return wb - wa;
        }
        case 'priority:asc': {
          const wa = PRIORITY_WEIGHTS[a.priority.toLowerCase()] || 0;
          const wb = PRIORITY_WEIGHTS[b.priority.toLowerCase()] || 0;
          return wa - wb;
        }
        case 'createdAt:desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'createdAt:asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'key:asc':
          return a.defectKey.localeCompare(b.defectKey);
        case 'updatedAt:desc':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

    return list;
  }, [defects, filterEnvironment, filterDevTaskId, filterReqId, sortValue]);

  // Active filter badge count and reset handler
  const handleResetFilters = () => {
    setSearch('');
    setFilterStatus('ALL');
    setFilterSeverity('ALL');
    setFilterPriority('ALL');
    setFilterAssigneeId('ALL');
    setFilterEnvironment('ALL');
    setFilterDevTaskId('');
    setFilterReqId('');
    setIncludeArchived(false);
  };

  const activeFilters = useMemo(() => {
    const list: Array<{ label: string; onClear: () => void }> = [];
    if (search) list.push({ label: `Search: "${search}"`, onClear: () => setSearch('') });
    if (filterStatus !== 'ALL') {
      list.push({ label: `Status: ${filterStatus}`, onClear: () => setFilterStatus('ALL') });
    }
    if (filterSeverity !== 'ALL') {
      list.push({ label: `Severity: ${filterSeverity}`, onClear: () => setFilterSeverity('ALL') });
    }
    if (filterPriority !== 'ALL') {
      list.push({ label: `Priority: ${filterPriority}`, onClear: () => setFilterPriority('ALL') });
    }
    if (filterAssigneeId !== 'ALL') {
      const m = meta.members.find((u) => String(u.id) === filterAssigneeId);
      list.push({ label: `Assignee: ${m?.name || filterAssigneeId}`, onClear: () => setFilterAssigneeId('ALL') });
    }
    if (filterEnvironment !== 'ALL') {
      list.push({ label: `Env: ${filterEnvironment}`, onClear: () => setFilterEnvironment('ALL') });
    }
    if (filterDevTaskId) {
      const dt = meta.devTasks.find((t) => String(t.id) === filterDevTaskId);
      list.push({ label: `Task: ${dt?.taskKey || filterDevTaskId}`, onClear: () => setFilterDevTaskId('') });
    }
    if (filterReqId) {
      const r = meta.requirements.find((req) => String(req.id) === filterReqId);
      list.push({ label: `Req: ${r?.code || r?.title || filterReqId}`, onClear: () => setFilterReqId('') });
    }
    if (includeArchived) {
      list.push({ label: 'Archived Included', onClear: () => setIncludeArchived(false) });
    }
    return list;
  }, [
    search,
    filterStatus,
    filterSeverity,
    filterPriority,
    filterAssigneeId,
    filterEnvironment,
    filterDevTaskId,
    filterReqId,
    includeArchived,
    meta.members,
    meta.devTasks,
    meta.requirements,
  ]);

  const activeFilterCount = activeFilters.length;
  const isSortGroupModified = groupBy !== 'none' || sortValue !== 'severity:desc';

  // Bulk Actions
  const handleBulkStatus = async (status: string) => {
    if (selectedIds.length === 0) return;
    try {
      await Promise.all(
        selectedIds.map((defectId) => testingService.updateDefect(projectId, defectId, { status }))
      );
      toast.success(`Updated ${selectedIds.length} defects to ${status}`);
      setSelectedIds([]);
      void loadData();
    } catch {
      toast.error('Bulk update failed');
    }
  };

  const handleBulkArchive = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirmDeleteSwal({
      title: `Archive ${selectedIds.length} defect(s)?`,
      text: 'Archived defects are hidden from active triage while preserving commit and execution links.',
      confirmText: 'Archive Selected',
    });
    if (!confirmed) return;

    try {
      await Promise.all(
        selectedIds.map((defectId) => testingService.updateDefect(projectId, defectId, { isArchived: true }))
      );
      toast.success(`Archived ${selectedIds.length} defect(s)`);
      setSelectedIds([]);
      void loadData();
    } catch {
      toast.error('Bulk archive failed');
    }
  };

  const toggleAll = () => {
    if (selectedIds.length === processedDefects.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(processedDefects.map((d) => d.id));
    }
  };

  const toggleOne = (defectId: number) => {
    setSelectedIds((prev) =>
      prev.includes(defectId) ? prev.filter((x) => x !== defectId) : [...prev, defectId]
    );
  };

  // Telemetry Metric Calculations
  const totalCount = defects.length;
  const openCount = defects.filter((d) => d.status === 'Open').length;
  const inProgressCount = defects.filter((d) => d.status === 'In Progress').length;
  const fixedCount = defects.filter((d) => d.status === 'Fixed' || d.status === 'Ready for Retest').length;
  const verifiedCount = defects.filter((d) => d.status === 'Verified').length;
  const closedCount = defects.filter((d) => d.status === 'Closed').length;
  const reopenedCount = defects.filter((d) => d.status === 'Reopened').length;

  const criticalCount = defects.filter(
    (d) => d.severity.toLowerCase() === 'critical' || d.severity.toLowerCase() === 'blocker'
  ).length;

  const activeTriageCount = openCount + inProgressCount + reopenedCount;
  const resolvedCount = verifiedCount + closedCount;

  const resolutionRate =
    totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : totalCount === 0 ? 100 : 0;

  const activeTriageRate =
    totalCount > 0 ? Math.round((activeTriageCount / totalCount) * 100) : 0;

  const linkedCount = defects.filter(
    (d) => d.linkedTestCaseId || d.linkedDevTaskId || d.linkedRequirementId
  ).length;

  const traceabilityRate =
    totalCount > 0 ? Math.round((linkedCount / totalCount) * 100) : 0;

  const totalReopens = defects.reduce((acc, d) => acc + (d.reopenCount || 0), 0);

  // Composite Quality Index (0 - 100)
  const healthScore = useMemo(() => {
    if (totalCount === 0) return 100;
    const resWeight = (resolvedCount / totalCount) * 55;
    const criticalPenalty = Math.min(25, criticalCount * 8);
    const reopenPenalty = Math.min(20, totalReopens * 5);
    const raw = Math.round(resWeight + (45 - criticalPenalty - reopenPenalty));
    return Math.max(0, Math.min(100, raw));
  }, [totalCount, resolvedCount, criticalCount, totalReopens]);

  // Priority Stats
  const priorityStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of defects) {
      counts[d.priority] = (counts[d.priority] || 0) + 1;
    }
    return (config?.priorities || [])
      .filter((p) => !p.isArchived)
      .map((p) => ({
        name: p.name,
        color: p.color || '#F59E0B',
        count: counts[p.name] || 0,
      }));
  }, [defects, config?.priorities]);

  // Severity Stats
  const severityStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of defects) {
      counts[d.severity] = (counts[d.severity] || 0) + 1;
    }
    const definedSeverities = config?.defectSeverities?.filter((s) => !s.isArchived) || [];
    if (definedSeverities.length > 0) {
      return definedSeverities.map((s) => ({
        name: s.name,
        color: s.color || '#F87171',
        count: counts[s.name] || 0,
      }));
    }
    return [
      { name: 'Critical', color: '#F87171', count: counts['Critical'] || 0 },
      { name: 'Major', color: '#FB923C', count: counts['Major'] || 0 },
      { name: 'Moderate', color: '#FBBF24', count: counts['Moderate'] || 0 },
      { name: 'Minor', color: '#60A5FA', count: counts['Minor'] || 0 },
    ];
  }, [defects, config?.defectSeverities]);

  // Grouping Logic
  const activeGroupMeta = useMemo(
    () => GROUP_OPTIONS.find((g) => g.key === groupBy) || GROUP_OPTIONS[0],
    [groupBy]
  );

  const groupedDefects = useMemo(() => {
    if (groupBy === 'none') return null;

    const map = new Map<
      string,
      {
        id: string;
        title: string;
        sublabel?: string;
        color?: string;
        count: number;
        items: QaDefectItem[];
      }
    >();

    for (const d of processedDefects) {
      let gId = 'unassigned';
      let gTitle = 'Unassigned';
      let gSub: string | undefined;
      let gColor: string | undefined;

      switch (groupBy) {
        case 'severity':
          gId = d.severity.toLowerCase();
          gTitle = d.severity;
          gColor = severityStats.find((s) => s.name.toLowerCase() === gId)?.color || '#F87171';
          break;
        case 'priority':
          gId = d.priority.toLowerCase();
          gTitle = d.priority;
          gColor = priorityStats.find((p) => p.name.toLowerCase() === gId)?.color || '#F59E0B';
          break;
        case 'status':
          gId = d.status.toLowerCase();
          gTitle = d.status;
          gColor = '#A78BFA';
          break;
        case 'assignee':
          if (d.assignee) {
            gId = String(d.assignee.id);
            gTitle = d.assignee.name || `User #${d.assignee.id}`;
            gSub = d.assignee.email || undefined;
            gColor = '#14B8A6';
          } else {
            gId = 'unassigned';
            gTitle = 'Unassigned';
            gColor = '#71717A';
          }
          break;
        case 'environment':
          gId = d.environment ? d.environment.toLowerCase() : 'none';
          gTitle = d.environment || 'No Environment';
          gColor = '#38BDF8';
          break;
      }

      const existing = map.get(gId);
      if (existing) {
        existing.items.push(d);
        existing.count += 1;
      } else {
        map.set(gId, {
          id: gId,
          title: gTitle,
          sublabel: gSub,
          color: gColor,
          count: 1,
          items: [d],
        });
      }
    }

    return Array.from(map.values());
  }, [processedDefects, groupBy, severityStats, priorityStats]);

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const collapseAllGroups = () => {
    if (!groupedDefects) return;
    const next: Record<string, boolean> = {};
    for (const g of groupedDefects) next[g.id] = true;
    setCollapsedGroups(next);
  };

  const expandAllGroups = () => {
    setCollapsedGroups({});
  };

  // Select Options for Filter Popover
  const severityFilterOptions: SelectOption[] = useMemo(
    () => [
      { value: 'ALL', label: 'All Severities' },
      ...(config?.defectSeverities || [])
        .filter((s) => !s.isArchived)
        .map((s) => ({ value: s.name, label: s.name })),
    ],
    [config?.defectSeverities]
  );

  const priorityFilterOptions: SelectOption[] = useMemo(
    () => [
      { value: 'ALL', label: 'All Priorities' },
      ...(config?.priorities || [])
        .filter((p) => !p.isArchived)
        .map((p) => ({ value: p.name, label: p.name })),
    ],
    [config?.priorities]
  );

  const assigneeFilterOptions: SelectOption[] = useMemo(
    () => [
      { value: 'ALL', label: 'All Assignees' },
      ...meta.members.map((m) => ({
        value: String(m.id),
        label: m.name || m.email || `User #${m.id}`,
        icon: <UserAvatar user={m} size="xs" />,
      })),
    ],
    [meta.members]
  );

  const environmentFilterOptions: SelectOption[] = useMemo(
    () => [
      { value: 'ALL', label: 'All Environments' },
      ...(config?.environments || [])
        .filter((e) => !e.isArchived)
        .map((e) => ({ value: e.name, label: e.name })),
    ],
    [config?.environments]
  );

  const devTaskFilterOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All Development Tasks' },
      ...meta.devTasks.map((t) => ({
        value: String(t.id),
        label: `${t.taskKey} — ${t.title}`,
      })),
    ],
    [meta.devTasks]
  );

  const reqFilterOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All Requirements' },
      ...meta.requirements.map((r) => ({
        value: String(r.id),
        label: r.code ? `${r.code} — ${r.title}` : r.title,
      })),
    ],
    [meta.requirements]
  );

  // Helper to render table rows for any defect array
  const renderTableRows = (items: QaDefectItem[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-[#0B0D12]/80 text-zinc-400 border-b border-[#27272A]">
          <tr>
            <th className="px-4 py-3 w-10">
              <input
                type="checkbox"
                checked={items.length > 0 && items.every((d) => selectedIds.includes(d.id))}
                onChange={() => {
                  const allInGrpSelected = items.every((d) => selectedIds.includes(d.id));
                  if (allInGrpSelected) {
                    setSelectedIds((prev) => prev.filter((id) => !items.some((d) => d.id === id)));
                  } else {
                    const toAdd = items.map((d) => d.id).filter((id) => !selectedIds.includes(id));
                    setSelectedIds((prev) => [...prev, ...toAdd]);
                  }
                }}
                className="rounded border-[#27272A] bg-[#0B0D12] text-rose-500 focus:ring-0 w-3.5 h-3.5"
              />
            </th>
            <th className="px-4 py-3">Key &amp; Defect Title</th>
            <th className="px-4 py-3">Severity</th>
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Assignee</th>
            <th className="px-4 py-3">Traceability</th>
            <th className="px-4 py-3 text-right">Updated</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#27272A]/70">
          {items.map((d) => (
            <tr
              key={d.id}
              className={`hover:bg-white/[0.03] transition-colors cursor-pointer ${
                d.isArchived ? 'opacity-55' : ''
              } ${drawerDefectId === d.id ? 'bg-rose-500/[0.07]' : ''}`}
              onClick={() => setDrawerDefectId(d.id)}
            >
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(d.id)}
                  onChange={() => toggleOne(d.id)}
                  className="rounded border-[#27272A] bg-[#0B0D12] text-rose-500 focus:ring-0 w-3.5 h-3.5"
                />
              </td>
              <td className="px-4 py-3 max-w-md">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-rose-400 shrink-0">
                    {d.defectKey}
                  </span>
                  <span className="font-medium text-white truncate">{d.title}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5 flex-wrap">
                  {d.environment && <span>Env: {d.environment}</span>}
                  {d.buildVersion && <span>• {d.buildVersion}</span>}
                  {d.reopenCount > 0 && (
                    <span className="text-rose-400 font-semibold font-mono text-[10px]">
                      • Reopened {d.reopenCount}x
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <TestingSeverityBadge severity={d.severity} />
              </td>
              <td className="px-4 py-3">
                <TestingPriorityBadge priority={d.priority} />
              </td>
              <td className="px-4 py-3">
                <DefectStatusBadge status={d.status} />
              </td>
              <td className="px-4 py-3">
                {d.assignee ? (
                  <div className="flex items-center gap-1.5">
                    <UserAvatar user={d.assignee} size="xs" />
                    <span className="text-zinc-300 truncate max-w-[110px]">{d.assignee.name}</span>
                  </div>
                ) : (
                  <span className="text-zinc-500 italic">Unassigned</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 flex-wrap">
                  {d.linkedTestCase && (
                    <span className="font-mono text-emerald-400 font-medium">
                      {d.linkedTestCase.caseKey}
                    </span>
                  )}
                  {d.linkedDevTask && (
                    <span className="font-mono text-cyan-400">{d.linkedDevTask.taskKey}</span>
                  )}
                  {!d.linkedTestCase && !d.linkedDevTask && <span className="text-zinc-600">—</span>}
                </div>
              </td>
              <td className="px-4 py-3 text-right text-zinc-400 whitespace-nowrap font-mono text-[11px]">
                {formatTestingDate(d.updatedAt)}
              </td>
              <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                <div className="inline-flex items-center gap-1">
                  {permissions.canManageDefects && (
                    <button
                      type="button"
                      onClick={async () => {
                        const detailRes = await testingService.getDefectDetail(projectId, d.id);
                        if (detailRes.success && detailRes.data) {
                          setEditingDefect(detailRes.data);
                          setModalOpen(true);
                        }
                      }}
                      title="Edit Defect"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {permissions.canArchiveRecords && (
                    <button
                      type="button"
                      onClick={async () => {
                        const confirmed = await confirmDeleteSwal({
                          title: d.isArchived ? `Restore ${d.defectKey}?` : `Archive ${d.defectKey}?`,
                          text: d.isArchived
                            ? 'Restores defect to active triage.'
                            : 'Hides defect from default triage without erasing execution links.',
                          confirmText: d.isArchived ? 'Restore' : 'Archive',
                        });
                        if (!confirmed) return;
                        const res = await testingService.updateDefect(projectId, d.id, {
                          isArchived: !d.isArchived,
                        });
                        if (res.success) {
                          toast.success(d.isArchived ? 'Defect restored' : 'Defect archived');
                          void loadData();
                        }
                      }}
                      title={d.isArchived ? 'Restore' : 'Archive'}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-300 hover:bg-white/10 transition-colors"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Helper to render card grid for any defect array
  const renderCardGrid = (items: QaDefectItem[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
      {items.map((d) => (
        <div
          key={d.id}
          onClick={() => setDrawerDefectId(d.id)}
          className={`rounded-2xl bg-[#111216] border border-[#27272A] hover:border-zinc-500 p-4 space-y-3 cursor-pointer transition-all shadow-sm ${
            drawerDefectId === d.id ? 'border-rose-500/50 bg-[#16141a]' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono font-bold text-rose-400">{d.defectKey}</span>
            <div className="flex items-center gap-1.5">
              <TestingSeverityBadge severity={d.severity} />
              <DefectStatusBadge status={d.status} />
            </div>
          </div>

          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-white line-clamp-2">{d.title}</h3>
            {d.description && (
              <p className="text-xs text-zinc-400 line-clamp-2 mt-1">{d.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap text-[11px] text-zinc-400">
            <TestingPriorityBadge priority={d.priority} />
            {d.environment && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-white/[0.05] text-zinc-300 border border-white/10">
                <Server className="w-2.5 h-2.5 text-cyan-400" />
                {d.environment}
              </span>
            )}
            {d.buildVersion && (
              <span className="font-mono text-[10px] text-zinc-500">{d.buildVersion}</span>
            )}
            {d.reopenCount > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                Reopened {d.reopenCount}x
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#27272A]/70 text-[11px] text-zinc-400">
            <div className="flex items-center gap-1.5">
              {d.assignee ? (
                <>
                  <UserAvatar user={d.assignee} size="xs" />
                  <span className="text-zinc-300 truncate max-w-[120px]">{d.assignee.name}</span>
                </>
              ) : (
                <span className="text-zinc-500 italic">Unassigned</span>
              )}
            </div>
            <span className="font-mono text-[10.5px] text-zinc-500">
              {formatTestingDate(d.updatedAt)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-[1680px] mx-auto space-y-5">
      {/* Module Page Header */}
      <TestingPageHeader
        projectId={projectId}
        activeKey="defects"
        title="Defects"
        description="Track software bugs with strict QA verification: developer fixes await retest before closure, and reopens increment traceability counters."
        icon={Bug}
        badge={`${totalCount} defects`}
        actions={
          permissions.canManageDefects ? (
            <button
              type="button"
              onClick={() => {
                setEditingDefect(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-md hover:brightness-110 transition-all cursor-pointer"
              style={{ backgroundColor: accentColor }}
            >
              <Plus className="w-4 h-4" />
              <span>Log Defect</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/30 border border-white/20">
                ⇧D
              </kbd>
            </button>
          ) : null
        }
      />

      {/* Top Database-Backed Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total Defects */}
        <div className="p-4 rounded-2xl bg-[#111216] border border-[#27272A] shadow-sm flex items-center gap-3.5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
          >
            <Bug className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Total Defects</div>
            <div className="text-xl font-bold text-white mt-0.5">{totalCount}</div>
            <div className="text-[10px] text-zinc-500 truncate">{meta.modules.length} app modules linked</div>
          </div>
        </div>

        {/* Card 2: Resolved / Closed */}
        <div className="p-4 rounded-2xl bg-[#111216] border border-[#27272A] shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Resolved / Closed</div>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">{resolvedCount}</div>
            <div className="text-[10px] text-zinc-500 truncate">{resolutionRate}% resolution rate</div>
          </div>
        </div>

        {/* Card 3: Pending Retest */}
        <div className="p-4 rounded-2xl bg-[#111216] border border-[#27272A] shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Pending Retest</div>
            <div className="text-xl font-bold text-amber-400 mt-0.5">{fixedCount}</div>
            <div className="text-[10px] text-zinc-500 truncate">{openCount + inProgressCount} in progress</div>
          </div>
        </div>

        {/* Card 4: Critical / Blocker */}
        <div className="p-4 rounded-2xl bg-[#111216] border border-[#27272A] shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Critical / Blocker</div>
            <div className="text-xl font-bold text-rose-400 mt-0.5">{criticalCount}</div>
            <div className="text-[10px] text-zinc-500 truncate">{reopenedCount} reopened bugs</div>
          </div>
        </div>

        {/* Card 5: Traceability */}
        <div className="col-span-2 lg:col-span-1 p-4 rounded-2xl bg-[#111216] border border-[#27272A] shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0">
            <Link2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Traceability</div>
            <div className="text-xl font-bold text-cyan-400 mt-0.5">{traceabilityRate}%</div>
            <div className="text-[10px] text-zinc-500 truncate">{linkedCount} tasks/reqs linked</div>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Left Content (9 cols) + Right Summary Box (3 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left Column: Clean Toolbar + Defects Table / Cards (9 cols) */}
        <div className="xl:col-span-9 space-y-3.5">
          {/* Streamlined Toolbar: Search + Icon-Only Filter Button + Icon-Only Sort & Group Button + View Switcher + Refresh */}
          <div className="rounded-2xl bg-[#111216] border border-[#27272A] p-2.5 sm:p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              {/* Search Bar */}
              <div className="flex-1 min-w-[200px] sm:min-w-[280px] relative">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search DEF-001, title, steps, build..."
                  className="w-full h-9 bg-[#0B0D12] border border-[#27272A] rounded-xl pl-9 pr-8 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500/60 transition-colors"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Action Buttons: Icon-Only Filter + Icon-Only Sort & Group + View Switcher + Refresh */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* ── 1. ICON-ONLY FILTER BUTTON ────────────────────────────── */}
                <div ref={filterRef} className="relative">
                  <button
                    type="button"
                    title={activeFilterCount > 0 ? `Filter options (${activeFilterCount} active)` : 'Filter options'}
                    aria-label="Filter options"
                    onClick={() => {
                      setIsFilterOpen((prev) => !prev);
                      setIsSortGroupOpen(false);
                      setIsGroupByHovered(false);
                    }}
                    className={`relative w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                      activeFilterCount > 0
                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-sm'
                        : isFilterOpen
                        ? 'bg-[#181A22] border-zinc-500 text-white'
                        : 'bg-[#111216] border-[#27272A] text-zinc-400 hover:text-white hover:border-zinc-600'
                    }`}
                  >
                    <ListFilter size={15} style={activeFilterCount > 0 ? { color: accentColor } : undefined} />
                    {activeFilterCount > 0 && (
                      <span
                        className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full text-[9.5px] font-mono font-bold text-white flex items-center justify-center shadow-md border border-[#111216]"
                        style={{ backgroundColor: accentColor }}
                      >
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  {/* Clean, Zero-Horizontal-Scrollbar Filter Popover with AnimatedSelect */}
                  <AnimatePresence>
                    {isFilterOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.97 }}
                        transition={{ duration: 0.16 }}
                        className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-[340px] sm:w-[380px] rounded-2xl bg-[#12141C] border border-[#27272A] shadow-2xl z-50 overflow-hidden text-xs"
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272A] bg-[#161824]">
                          <div className="flex items-center gap-2">
                            <ListFilter className="w-4 h-4" style={{ color: accentColor }} />
                            <span className="font-semibold text-white">Filter Defects</span>
                            {activeFilterCount > 0 && (
                              <span
                                className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold text-white"
                                style={{ backgroundColor: accentColor }}
                              >
                                {activeFilterCount} active
                              </span>
                            )}
                          </div>
                          {activeFilterCount > 0 && (
                            <button
                              type="button"
                              onClick={handleResetFilters}
                              className="text-[11px] font-mono text-zinc-400 hover:text-white underline cursor-pointer"
                            >
                              Reset all
                            </button>
                          )}
                        </div>

                        {/* Body with AnimatedSelect (dropdownMinWidth="w-full" prevents horizontal overflow scrollbars) */}
                        <div className="p-4 space-y-3 max-h-[62vh] overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-zinc-700">
                          <div>
                            <label className="block text-[11px] font-medium text-zinc-400 mb-1">Status</label>
                            <AnimatedSelect
                              options={DEFECT_STATUS_FILTER_OPTIONS}
                              value={filterStatus}
                              onChange={setFilterStatus}
                              placeholder="All Statuses"
                              dropdownMinWidth="w-full"
                              accentColor={accentColor}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Severity</label>
                              <AnimatedSelect
                                options={severityFilterOptions}
                                value={filterSeverity}
                                onChange={setFilterSeverity}
                                placeholder="All Severities"
                                dropdownMinWidth="w-full"
                                accentColor={accentColor}
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Priority</label>
                              <AnimatedSelect
                                options={priorityFilterOptions}
                                value={filterPriority}
                                onChange={setFilterPriority}
                                placeholder="All Priorities"
                                dropdownMinWidth="w-full"
                                dropdownAlign="right"
                                accentColor={accentColor}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Assigned Developer</label>
                              <AnimatedSelect
                                options={assigneeFilterOptions}
                                value={filterAssigneeId}
                                onChange={setFilterAssigneeId}
                                placeholder="All Developers"
                                dropdownMinWidth="w-full"
                                accentColor={accentColor}
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Environment</label>
                              <AnimatedSelect
                                options={environmentFilterOptions}
                                value={filterEnvironment}
                                onChange={setFilterEnvironment}
                                placeholder="All Environments"
                                dropdownMinWidth="w-full"
                                dropdownAlign="right"
                                accentColor={accentColor}
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-zinc-400 mb-1">Linked Dev Task</label>
                            <AnimatedSelect
                              options={devTaskFilterOptions}
                              value={filterDevTaskId}
                              onChange={setFilterDevTaskId}
                              placeholder="All Development Tasks"
                              dropdownMinWidth="w-full"
                              accentColor={accentColor}
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-zinc-400 mb-1">Linked Requirement</label>
                            <AnimatedSelect
                              options={reqFilterOptions}
                              value={filterReqId}
                              onChange={setFilterReqId}
                              placeholder="All Requirements"
                              dropdownMinWidth="w-full"
                              accentColor={accentColor}
                            />
                          </div>
                        </div>

                        {/* Footer Strip */}
                        <div className="px-4 py-2.5 border-t border-[#27272A] bg-[#161824] flex items-center justify-between">
                          <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={includeArchived}
                              onChange={(e) => setIncludeArchived(e.target.checked)}
                              className="rounded border-[#27272A] bg-[#0B0D12] text-rose-500 focus:ring-0 w-3.5 h-3.5"
                            />
                            <span>Include Archived</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setIsFilterOpen(false)}
                            className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white shadow-md hover:brightness-110 transition-all cursor-pointer"
                            style={{ backgroundColor: accentColor }}
                          >
                            Apply
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ── 2. ICON-ONLY SORT & GROUP BUTTON (WITH SUBMENU FLYOUT) ── */}
                <div ref={sortGroupRef} className="relative">
                  <button
                    type="button"
                    title={isSortGroupModified ? 'Sort & Group options (modified)' : 'Sort & Group options'}
                    aria-label="Sort & Group options"
                    onClick={() => {
                      setIsSortGroupOpen((prev) => !prev);
                      setIsFilterOpen(false);
                      setIsGroupByHovered(false);
                    }}
                    className={`relative w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                      isSortGroupModified
                        ? 'bg-purple-500/15 border-purple-500/40 text-purple-300 shadow-sm'
                        : isSortGroupOpen
                        ? 'bg-[#181A22] border-zinc-500 text-white'
                        : 'bg-[#111216] border-[#27272A] text-zinc-400 hover:text-white hover:border-zinc-600'
                    }`}
                  >
                    <ArrowUpDown size={15} style={isSortGroupModified ? { color: accentColor } : undefined} />
                    {isSortGroupModified && (
                      <span
                        className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-[#111216]"
                        style={{ backgroundColor: accentColor }}
                      />
                    )}
                  </button>

                  {/* Popover with Submenu Flyout for Group By */}
                  <AnimatePresence>
                    {isSortGroupOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.97 }}
                        transition={{ duration: 0.16 }}
                        className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-64 rounded-2xl bg-[#12141C] border border-[#27272A] shadow-2xl z-50 text-xs text-zinc-300"
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#27272A] bg-[#161824] rounded-t-2xl">
                          <span className="font-semibold text-white">Sort &amp; Group</span>
                          <span className="text-[10px] font-mono text-zinc-400">
                            {activeGroupMeta.shortLabel}
                          </span>
                        </div>

                        <div className="p-2 space-y-1">
                          {/* Sort Section */}
                          <div className="px-2 pt-1 pb-1 text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                            Sort Order
                          </div>
                          {SORT_OPTIONS.map((opt) => {
                            const isSelected = sortValue === opt.key;
                            return (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => {
                                  setSortValue(opt.key);
                                  setIsSortGroupOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-white/10 text-white font-medium'
                                    : 'hover:bg-white/5 text-zinc-300'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="shrink-0">{opt.icon}</span>
                                  <div className="min-w-0">
                                    <div className="truncate text-xs">{opt.label}</div>
                                    <div className="text-[10px] text-zinc-400 truncate">
                                      {opt.sublabel}
                                    </div>
                                  </div>
                                </div>
                                {isSelected && (
                                  <Check
                                    size={13}
                                    className="shrink-0"
                                    style={{ color: accentColor }}
                                  />
                                )}
                              </button>
                            );
                          })}

                          {/* Group By Trigger Row with Submenu Flyout */}
                          <div className="pt-2 border-t border-[#27272A] relative">
                            <div className="px-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                              Group By
                            </div>

                            <div
                              onMouseEnter={() => setIsGroupByHovered(true)}
                              onMouseLeave={() => setIsGroupByHovered(false)}
                              className="relative"
                            >
                              <button
                                type="button"
                                onClick={() => setIsGroupByHovered((prev) => !prev)}
                                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                                  groupBy !== 'none' || isGroupByHovered
                                    ? 'bg-white/10 text-white'
                                    : 'hover:bg-white/5 text-zinc-300'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="shrink-0">{activeGroupMeta.icon}</span>
                                  <span className="font-medium text-xs">
                                    {activeGroupMeta.label}
                                  </span>
                                </div>
                                <ChevronRight
                                  size={14}
                                  className={`text-zinc-400 transition-transform ${
                                    isGroupByHovered ? 'translate-x-0.5 text-white' : ''
                                  }`}
                                />
                              </button>

                              {/* Expandable Submenu Flyout */}
                              <AnimatePresence>
                                {isGroupByHovered && (
                                  <motion.div
                                    initial={{ opacity: 0, x: -6 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -6 }}
                                    transition={{ duration: 0.14 }}
                                    className="absolute left-full top-0 ml-1.5 w-56 rounded-2xl bg-[#141620] border border-[#27272A] shadow-2xl p-1.5 space-y-0.5 z-[60]"
                                  >
                                    <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                                      Group Defect View
                                    </div>
                                    {GROUP_OPTIONS.map((g) => {
                                      const isPicked = groupBy === g.key;
                                      return (
                                        <button
                                          key={g.key}
                                          type="button"
                                          onClick={() => {
                                            setGroupBy(g.key);
                                            setIsGroupByHovered(false);
                                            setIsSortGroupOpen(false);
                                          }}
                                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                                            isPicked
                                              ? 'bg-white/10 text-white font-medium'
                                              : 'hover:bg-white/5 text-zinc-300'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2 min-w-0">
                                            <span className="shrink-0">{g.icon}</span>
                                            <div className="min-w-0">
                                              <div className="truncate text-xs">{g.label}</div>
                                              <div className="text-[10px] text-zinc-400 truncate">
                                                {g.sublabel}
                                              </div>
                                            </div>
                                          </div>
                                          {isPicked && (
                                            <Check
                                              size={13}
                                              className="shrink-0"
                                              style={{ color: accentColor }}
                                            />
                                          )}
                                        </button>
                                      );
                                    })}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </div>

                        {/* Reset to Default Button */}
                        <div className="p-2 border-t border-[#27272A] bg-[#161824] rounded-b-2xl">
                          <button
                            type="button"
                            onClick={() => {
                              setSortValue('severity:desc');
                              setGroupBy('none');
                              setIsSortGroupOpen(false);
                              setIsGroupByHovered(false);
                            }}
                            className="w-full py-1.5 px-3 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <RotateCcw size={12} />
                            <span>Reset to Default</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ── 3. VIEW MODE SWITCHER (LIST / CARDS WITH SPRING PILL) ─── */}
                <div className="flex items-center bg-[#111216] border border-[#27272A] rounded-xl p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                      viewMode === 'list' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                    title="List View"
                  >
                    {viewMode === 'list' && (
                      <motion.span
                        layoutId="defectViewModePill"
                        className="absolute inset-0 rounded-lg bg-[#1C1E26] border border-[#2E313D]"
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      />
                    )}
                    <List className="w-3.5 h-3.5 relative z-10" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('cards')}
                    className={`relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                      viewMode === 'cards' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                    title="Card View"
                  >
                    {viewMode === 'cards' && (
                      <motion.span
                        layoutId="defectViewModePill"
                        className="absolute inset-0 rounded-lg bg-[#1C1E26] border border-[#2E313D]"
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      />
                    )}
                    <LayoutGrid className="w-3.5 h-3.5 relative z-10" />
                  </button>
                </div>

                {/* ── 4. REFRESH BUTTON ─────────────────────────────────────── */}
                <button
                  type="button"
                  onClick={() => void loadData()}
                  title="Refresh defects"
                  className="w-8 h-8 rounded-xl bg-[#161820] border border-[#27272A] flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Active Filter Chips Strip */}
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#27272A]/50">
                <span className="text-[10px] font-mono uppercase text-zinc-500 mr-0.5">Filters:</span>
                {activeFilters.map((flt, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] bg-white/[0.06] text-zinc-200 border border-white/10"
                  >
                    <span>{flt.label}</span>
                    <button
                      type="button"
                      onClick={flt.onClear}
                      className="text-zinc-400 hover:text-white cursor-pointer ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[11px] text-zinc-400 hover:text-white underline cursor-pointer ml-1"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Bulk Selection Actions Strip */}
            {selectedIds.length > 0 && (
              <div className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30">
                <span className="text-xs font-medium text-rose-300">
                  {selectedIds.length} defect(s) selected
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {permissions.canManageDefects && (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleBulkStatus('Open')}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 transition-colors cursor-pointer"
                      >
                        Mark Open
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleBulkStatus('Fixed')}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 transition-colors cursor-pointer"
                      >
                        Mark Fixed
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleBulkStatus('Verified')}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 transition-colors cursor-pointer"
                      >
                        Verify (QA)
                      </button>
                    </>
                  )}
                  {permissions.canArchiveRecords && (
                    <button
                      type="button"
                      onClick={() => void handleBulkArchive()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-500/15 text-red-300 hover:bg-red-500/25 transition-colors cursor-pointer"
                    >
                      <Archive className="w-3 h-3" />
                      Archive
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Main Defect List / Cards Content */}
          {loading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 rounded-2xl bg-[#111216] border border-[#27272A] animate-pulse" />
              ))}
            </div>
          ) : processedDefects.length === 0 ? (
            <div className="rounded-2xl bg-[#111216] border border-[#27272A] p-12 text-center space-y-3">
              <Bug className="w-10 h-10 text-zinc-600 mx-auto" />
              <h3 className="text-sm font-semibold text-white">No defects match these criteria</h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Log your first defect with steps to reproduce, or clear active filters to view all issues.
              </p>
              {permissions.canManageDefects && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingDefect(null);
                    setModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-md hover:brightness-110 cursor-pointer"
                  style={{ backgroundColor: accentColor }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log Defect</span>
                  <kbd className="px-1 py-0.5 rounded text-[10px] font-mono bg-black/30 border border-white/20">
                    ⇧D
                  </kbd>
                </button>
              )}
            </div>
          ) : groupBy !== 'none' && groupedDefects ? (
            /* ── GROUPED ACCORDION VIEW ────────────────────────────────────── */
            <div className="space-y-4">
              {groupedDefects.map((grp) => {
                const isCollapsed = Boolean(collapsedGroups[grp.id]);
                const grpResolvedCount = grp.items.filter(
                  (d) => d.status === 'Verified' || d.status === 'Closed'
                ).length;
                const grpCriticalCount = grp.items.filter(
                  (d) => d.severity.toLowerCase() === 'critical' || d.severity.toLowerCase() === 'blocker'
                ).length;

                return (
                  <div
                    key={grp.id}
                    className="rounded-2xl bg-[#111216] border border-[#27272A] overflow-hidden shadow-sm"
                  >
                    {/* Collapsible Accordion Header */}
                    <button
                      type="button"
                      onClick={() => toggleGroupCollapse(grp.id)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-[#13151D]/90 hover:bg-[#181A24] border-b border-[#27272A]/70 transition-colors cursor-pointer select-none text-left"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />
                        )}
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: grp.color || accentColor }}
                        />
                        <span className="text-xs sm:text-sm font-semibold text-white truncate">
                          {grp.title}
                        </span>
                        {grp.sublabel && (
                          <span className="hidden md:inline text-[11px] text-zinc-500 font-mono truncate">
                            ({grp.sublabel})
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[#1A1C26] border border-[#27272A] text-zinc-300 shrink-0">
                          {grp.items.length} {grp.items.length === 1 ? 'defect' : 'defects'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-[11px] font-mono text-zinc-400">
                        <span>{grpResolvedCount} Resolved</span>
                        {grpCriticalCount > 0 && (
                          <span className="hidden sm:inline text-rose-400">
                            • {grpCriticalCount} Critical
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Group Items Body */}
                    {!isCollapsed && (
                      <div className="p-3">
                        {viewMode === 'list'
                          ? renderTableRows(grp.items)
                          : renderCardGrid(grp.items)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'list' ? (
            /* ── FLAT TABLE VIEW ──────────────────────────────────────────── */
            <div className="rounded-2xl bg-[#111216] border border-[#27272A] overflow-hidden shadow-sm">
              {renderTableRows(processedDefects)}
            </div>
          ) : (
            /* ── FLAT CARDS VIEW ─────────────────────────────────────────── */
            renderCardGrid(processedDefects)
          )}
        </div>

        {/* Right Column: QA Summary & Quality Health Box (3 cols) */}
        <aside className="xl:col-span-3 space-y-4">
          {/* Quality Health Score Card */}
          <div className="rounded-2xl bg-[#111216] border border-[#27272A] p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" style={{ color: accentColor }} />
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Quality Health</h3>
              </div>
              <span
                className="text-xs font-mono font-bold px-2 py-0.5 rounded-md"
                style={{
                  backgroundColor: `${accentColor}20`,
                  color: accentColor,
                }}
              >
                {healthScore}/100
              </span>
            </div>

            {/* Progress Bars for Health Telemetry */}
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300">Resolution Rate</span>
                  <span className="font-mono text-zinc-200 font-semibold">{resolutionRate}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#1C1E26] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${resolutionRate}%` }}
                    transition={{ duration: 0.5 }}
                    className="h-full rounded-full bg-emerald-400"
                  />
                </div>
                <p className="text-[10px] text-zinc-500 font-mono">
                  {resolvedCount} of {totalCount} verified/closed
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300">Active Triage</span>
                  <span className="font-mono text-zinc-200 font-semibold">{activeTriageRate}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#1C1E26] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${activeTriageRate}%` }}
                    transition={{ duration: 0.5, delay: 0.08 }}
                    className="h-full rounded-full bg-blue-400"
                  />
                </div>
                <p className="text-[10px] text-zinc-500 font-mono">
                  {openCount + inProgressCount} open · {reopenedCount} reopened
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300">Traceability</span>
                  <span className="font-mono text-zinc-200 font-semibold">{traceabilityRate}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#1C1E26] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${traceabilityRate}%` }}
                    transition={{ duration: 0.5, delay: 0.16 }}
                    className="h-full rounded-full bg-cyan-400"
                  />
                </div>
                <p className="text-[10px] text-zinc-500 font-mono">
                  {linkedCount} linked to tasks &amp; tests
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Tiles */}
          <div className="rounded-2xl bg-[#111216] border border-[#27272A] p-4 sm:p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              {permissions.canManageDefects && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingDefect(null);
                    setModalOpen(true);
                  }}
                  className="flex flex-col items-center justify-center gap-1 py-2.5 px-1.5 rounded-xl bg-[#161820] border border-[#27272A] hover:border-zinc-500 text-zinc-300 hover:text-white transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  <span className="text-[10px] font-medium">New Defect</span>
                  <span className="text-[9px] font-mono text-zinc-500">⇧D</span>
                </button>
              )}
              <button
                type="button"
                onClick={toggleAll}
                className="flex flex-col items-center justify-center gap-1 py-2.5 px-1.5 rounded-xl bg-[#161820] border border-[#27272A] hover:border-zinc-500 text-zinc-300 hover:text-white transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-[10px] font-medium">
                  {selectedIds.length === processedDefects.length ? 'Clear All' : 'Select All'}
                </span>
                <span className="text-[9px] font-mono text-zinc-500">{processedDefects.length} total</span>
              </button>
            </div>
          </div>

          {/* Priority Breakdown Box */}
          <div className="rounded-2xl bg-[#111216] border border-[#27272A] p-4 sm:p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Priority Distribution</h3>
            <div className="space-y-2">
              {priorityStats.map((item) => {
                const pct = totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0;
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-zinc-300">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.name}
                      </span>
                      <span className="font-mono text-zinc-400 text-[11px]">
                        {item.count} <span className="text-zinc-600">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-[#1C1E26] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Severity Breakdown Box */}
          <div className="rounded-2xl bg-[#111216] border border-[#27272A] p-4 sm:p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Severity Distribution</h3>
            <div className="flex flex-wrap gap-1.5">
              {severityStats.map((item) => (
                <div
                  key={item.name}
                  onClick={() => setFilterSeverity(item.name)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#161820] border border-[#27272A] text-[11px] cursor-pointer hover:border-zinc-500 transition-colors"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-zinc-300">{item.name}</span>
                  <span className="font-mono text-zinc-400 font-semibold">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Git Traceability Box */}
          <div className="rounded-2xl bg-[#111216] border border-[#27272A] p-4 sm:p-5 shadow-sm space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-400">
                <GitBranch size={15} />
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Git Traceability
                </h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">
                {meta.gitRepositories.length} repo(s)
              </span>
            </div>

            {meta.gitRepositories.length > 0 ? (
              <div className="space-y-1.5">
                {meta.gitRepositories.map((repo) => (
                  <div
                    key={repo.id}
                    className="p-2.5 rounded-xl bg-[#0B0D12] border border-[#27272A] flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-mono font-semibold text-zinc-200 truncate">
                        {repo.name}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        {repo.provider} • branch {repo.defaultBranch || 'main'}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-zinc-500 italic">
                No Git repositories linked to this project yet.
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* Slide-over Create / Edit Defect Drawer Modal */}
      {config && (
        <DefectModal
          projectId={projectId}
          isOpen={modalOpen}
          editingDefect={editingDefect}
          meta={meta}
          config={config}
          permissions={permissions}
          onConfigUpdated={(cfg) => setConfig(cfg)}
          onClose={() => {
            setModalOpen(false);
            setEditingDefect(null);
          }}
          onSaved={(saved) => {
            setModalOpen(false);
            setEditingDefect(null);
            void loadData();
            setDrawerDefectId(saved.id);
          }}
        />
      )}

      {/* Slide-over Defect Details Drawer */}
      <DefectDrawer
        projectId={projectId}
        defectId={drawerDefectId}
        meta={meta}
        config={config}
        permissions={permissions}
        onClose={() => setDrawerDefectId(null)}
        onEdit={(detail) => {
          setDrawerDefectId(null);
          setEditingDefect(detail);
          setModalOpen(true);
        }}
        onArchived={() => {
          setDrawerDefectId(null);
          void loadData();
        }}
        onStatusChanged={() => {
          void loadData();
        }}
      />
    </div>
  );
};

export default DefectsView;
