import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Archive,
  ArrowDownAZ,
  ArrowUpDown,
  ArrowUpZA,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Edit3,
  FileEdit,
  Flame,
  Folder,
  FolderGit2,
  Layers,
  LayoutGrid,
  Link2,
  List,
  ListFilter,
  PlayCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
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
  ExecutionStatusBadge,
  TestCaseStatusBadge,
  TestTypeBadge,
  TestingPriorityBadge,
  formatTestingDate,
} from '../../../components/testing/testingBadges';
import { TestCaseModal } from './TestCaseModal';
import { TestCaseDrawer } from './TestCaseDrawer';
import type {
  TestCaseDetail,
  TestCaseItem,
  TestingConfigurationItem,
  TestingMetaData,
  TestingPermissions,
} from '../../../types/testing';

interface TestCasesViewProps {
  projectId?: number;
}

export type TestCaseGroupBy =
  | 'none'
  | 'module'
  | 'testType'
  | 'priority'
  | 'status'
  | 'tester'
  | 'execution';

const GROUP_OPTIONS: Array<{
  key: TestCaseGroupBy;
  label: string;
  sublabel: string;
  shortLabel: string;
  icon: React.ReactNode;
}> = [
  { key: 'none', label: 'No Grouping', sublabel: 'Flat list or card view', shortLabel: 'None', icon: <List size={13} className="text-zinc-400" /> },
  { key: 'module', label: 'Application Module', sublabel: 'Group by project module', shortLabel: 'Module', icon: <Folder size={13} className="text-indigo-400" /> },
  { key: 'testType', label: 'Test Type', sublabel: 'Functional, UI, API, etc.', shortLabel: 'Type', icon: <CheckSquare size={13} className="text-emerald-400" /> },
  { key: 'priority', label: 'Priority', sublabel: 'Critical, High, Medium, Low', shortLabel: 'Priority', icon: <Flame size={13} className="text-amber-400" /> },
  { key: 'status', label: 'Case Status', sublabel: 'Draft, Ready, Deprecated', shortLabel: 'Status', icon: <Clock size={13} className="text-purple-400" /> },
  { key: 'execution', label: 'Latest Execution', sublabel: 'Passed, Failed, Blocked, Not Run', shortLabel: 'Execution', icon: <PlayCircle size={13} className="text-cyan-400" /> },
  { key: 'tester', label: 'Assigned Tester', sublabel: 'Group by test owner', shortLabel: 'Tester', icon: <User size={13} className="text-teal-400" /> },
];

const SORT_OPTIONS: Array<{
  key: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
}> = [
  { key: 'updatedAt:desc', label: 'Recently Updated', sublabel: 'Most recent first', icon: <Clock size={13} className="text-emerald-400" /> },
  { key: 'createdAt:desc', label: 'Newest Created', sublabel: 'Latest created', icon: <Calendar size={13} className="text-cyan-400" /> },
  { key: 'createdAt:asc', label: 'Oldest Created', sublabel: 'Earliest created', icon: <Calendar size={13} className="text-zinc-400" /> },
  { key: 'title:asc', label: 'Title (A → Z)', sublabel: 'Alphabetical order', icon: <ArrowDownAZ size={13} className="text-sky-400" /> },
  { key: 'title:desc', label: 'Title (Z → A)', sublabel: 'Reverse alphabetical', icon: <ArrowUpZA size={13} className="text-indigo-400" /> },
  { key: 'priority:desc', label: 'Priority (Urgent First)', sublabel: 'Critical → Low', icon: <Flame size={13} className="text-rose-400" /> },
  { key: 'priority:asc', label: 'Priority (Lowest First)', sublabel: 'Low → Critical', icon: <Flame size={13} className="text-amber-400" /> },
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

export const TestCasesView: React.FC<TestCasesViewProps> = ({ projectId: propProjectId }) => {
  const { id } = useParams<{ id: string }>();
  const projectId = propProjectId || Number(id);
  const [searchParams, setSearchParams] = useSearchParams();
  const { accentColor } = useAccentTheme();
  const { toast } = useToast();

  const [cases, setCases] = useState<TestCaseItem[]>([]);
  const [meta, setMeta] = useState<TestingMetaData>(DEFAULT_META);
  const [config, setConfig] = useState<TestingConfigurationItem | null>(null);
  const [permissions, setPermissions] = useState<TestingPermissions>(DEFAULT_PERMS);

  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');
  const [groupBy, setGroupBy] = useState<TestCaseGroupBy>('none');
  const [sortValue, setSortValue] = useState('updatedAt:desc');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Filters State
  const [search, setSearch] = useState(searchParams.get('q') || searchParams.get('search') || '');
  const [filterModuleId, setFilterModuleId] = useState(searchParams.get('moduleId') || '');
  const [filterType, setFilterType] = useState(searchParams.get('testType') || '');
  const [filterPriority, setFilterPriority] = useState(searchParams.get('priority') || '');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '');
  const [filterTesterId, setFilterTesterId] = useState(searchParams.get('testerId') || '');
  const [filterReqId, setFilterReqId] = useState(
    searchParams.get('linkedRequirementId') || searchParams.get('requirementId') || ''
  );
  const [filterDevTaskId, setFilterDevTaskId] = useState(searchParams.get('linkedDevTaskId') || '');
  const [includeArchived, setIncludeArchived] = useState(searchParams.get('archived') === '1');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Popover State: Icon-only Filter & Inbuilt Sort/Group Popovers
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortGroupOpen, setIsSortGroupOpen] = useState(false);
  const [isGroupByHovered, setIsGroupByHovered] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const sortGroupRef = useRef<HTMLDivElement>(null);

  // Close popovers on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
      if (sortGroupRef.current && !sortGroupRef.current.contains(e.target as Node)) {
        setIsSortGroupOpen(false);
        setIsGroupByHovered(false);
      }
    };
    if (isFilterOpen || isSortGroupOpen) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isFilterOpen, isSortGroupOpen]);

  const [modalOpen, setModalOpen] = useState(searchParams.get('create') === '1');
  const [editingCase, setEditingCase] = useState<TestCaseDetail | TestCaseItem | null>(null);
  const [drawerCaseId, setDrawerCaseId] = useState<number | null>(() => {
    const raw = searchParams.get('caseId');
    return raw ? Number(raw) : null;
  });

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const [sortBy, sortDir] = sortValue.split(':');
    const [metaRes, listRes] = await Promise.all([
      testingService.getMeta(projectId),
      testingService.listTestCases(projectId, {
        search: search || undefined,
        moduleId: filterModuleId ? Number(filterModuleId) : undefined,
        testType: filterType || undefined,
        priority: filterPriority || undefined,
        status: filterStatus || undefined,
        testerId: filterTesterId || undefined,
        linkedRequirementId: filterReqId || undefined,
        linkedDevTaskId: filterDevTaskId || undefined,
        includeArchived,
        sortBy,
        sortDir: (sortDir === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
      }),
    ]);

    if (metaRes.success && metaRes.data) {
      setMeta(metaRes.data.meta);
      setConfig(metaRes.data.config);
      setPermissions(metaRes.data.permissions);
    }
    if (listRes.success && listRes.data) {
      setCases(listRes.data.items);
      setSelectedIds([]);
    } else {
      toast.error(listRes.error || 'Failed to load test cases');
    }
    setLoading(false);
  }, [
    projectId,
    search,
    filterModuleId,
    filterType,
    filterPriority,
    filterStatus,
    filterTesterId,
    filterReqId,
    filterDevTaskId,
    includeArchived,
    sortValue,
    toast,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Global Keyboard Shortcut: Shift + G opens the Create Test Case Drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === 'G' || e.key === 'g')) {
        const target = e.target as HTMLElement | null;
        const isInput =
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable);
        if (!isInput) {
          e.preventDefault();
          if (permissions.canEditTestCases) {
            setEditingCase(null);
            setModalOpen(true);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [permissions.canEditTestCases]);

  const handleResetFilters = () => {
    setSearch('');
    setFilterModuleId('');
    setFilterType('');
    setFilterPriority('');
    setFilterStatus('');
    setFilterTesterId('');
    setFilterReqId('');
    setFilterDevTaskId('');
    setIncludeArchived(false);
    setSearchParams({});
  };

  // Active Filter Pills
  const activeFilters = useMemo(() => {
    const list: Array<{ key: string; label: string; onRemove: () => void }> = [];
    if (filterModuleId) {
      const mod = meta.modules.find((m) => String(m.id) === filterModuleId);
      list.push({
        key: 'module',
        label: `Module: ${mod?.name || filterModuleId}`,
        onRemove: () => setFilterModuleId(''),
      });
    }
    if (filterType) {
      list.push({
        key: 'type',
        label: `Type: ${filterType}`,
        onRemove: () => setFilterType(''),
      });
    }
    if (filterPriority) {
      list.push({
        key: 'priority',
        label: `Priority: ${filterPriority}`,
        onRemove: () => setFilterPriority(''),
      });
    }
    if (filterStatus) {
      list.push({
        key: 'status',
        label: `Status: ${filterStatus}`,
        onRemove: () => setFilterStatus(''),
      });
    }
    if (filterTesterId) {
      const u = meta.members.find((m) => String(m.id) === filterTesterId);
      list.push({
        key: 'tester',
        label: `Tester: ${u?.name || filterTesterId}`,
        onRemove: () => setFilterTesterId(''),
      });
    }
    if (filterReqId) {
      const req = meta.requirements.find((r) => String(r.id) === filterReqId);
      list.push({
        key: 'req',
        label: `Req: ${req?.code || req?.title || filterReqId}`,
        onRemove: () => setFilterReqId(''),
      });
    }
    if (filterDevTaskId) {
      const dt = meta.devTasks.find((t) => String(t.id) === filterDevTaskId);
      list.push({
        key: 'devTask',
        label: `Task: ${dt?.taskKey || filterDevTaskId}`,
        onRemove: () => setFilterDevTaskId(''),
      });
    }
    if (includeArchived) {
      list.push({
        key: 'archived',
        label: 'Archived Included',
        onRemove: () => setIncludeArchived(false),
      });
    }
    return list;
  }, [
    filterModuleId,
    filterType,
    filterPriority,
    filterStatus,
    filterTesterId,
    filterReqId,
    filterDevTaskId,
    includeArchived,
    meta,
  ]);

  const activeFilterCount = activeFilters.length;
  const isSortGroupModified = groupBy !== 'none' || sortValue !== 'updatedAt:desc';

  const handleBulkStatus = async (status: string) => {
    if (selectedIds.length === 0) return;
    const res = await testingService.bulkTestCaseAction(projectId, {
      caseIds: selectedIds,
      action: 'status',
      status,
    });
    if (res.success) {
      toast.success(`Updated ${selectedIds.length} test cases to ${status}`);
      void loadData();
    } else {
      toast.error(res.error || 'Bulk update failed');
    }
  };

  const handleBulkArchive = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirmDeleteSwal({
      title: `Archive ${selectedIds.length} test case(s)?`,
      text: 'Archived test cases remain preserved in historical test runs.',
      confirmText: 'Archive Selected',
    });
    if (!confirmed) return;
    const res = await testingService.bulkTestCaseAction(projectId, {
      caseIds: selectedIds,
      action: 'archive',
    });
    if (res.success) {
      toast.success(`Archived ${selectedIds.length} test case(s)`);
      void loadData();
    } else {
      toast.error(res.error || 'Bulk archive failed');
    }
  };

  const toggleAll = () => {
    if (selectedIds.length === cases.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(cases.map((c) => c.id));
    }
  };

  const toggleOne = (caseId: number) => {
    setSelectedIds((prev) =>
      prev.includes(caseId) ? prev.filter((x) => x !== caseId) : [...prev, caseId]
    );
  };

  // Telemetry Metric Calculations
  const totalCount = cases.length;
  const readyCount = cases.filter((c) => c.status === 'Ready').length;
  const draftCount = cases.filter((c) => c.status === 'Draft').length;
  const deprecatedCount = cases.filter((c) => c.status === 'Deprecated').length;

  const executedCases = cases.filter((c) => c.latestExecutionStatus);
  const passedCases = cases.filter((c) => c.latestExecutionStatus === 'Passed');
  const failedCases = cases.filter((c) => c.latestExecutionStatus === 'Failed');
  const blockedCases = cases.filter((c) => c.latestExecutionStatus === 'Blocked');

  const passRate =
    executedCases.length > 0
      ? Math.round((passedCases.length / executedCases.length) * 100)
      : totalCount > 0
      ? 100
      : 0;

  const readinessRate =
    totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;

  const linkedCount = cases.filter(
    (c) => c.linkedRequirementId || c.linkedDevTaskId
  ).length;
  const traceabilityRate =
    totalCount > 0 ? Math.round((linkedCount / totalCount) * 100) : 0;

  // Composite Quality Health score (0 - 100)
  const healthScore = useMemo(() => {
    if (totalCount === 0) return 100;
    const passWeight = (passRate / 100) * 45;
    const readinessWeight = (readinessRate / 100) * 35;
    const traceabilityWeight = (traceabilityRate / 100) * 20;
    return Math.round(passWeight + readinessWeight + traceabilityWeight);
  }, [totalCount, passRate, readinessRate, traceabilityRate]);

  // Priority Stats
  const priorityStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of cases) {
      counts[c.priority] = (counts[c.priority] || 0) + 1;
    }
    return (config?.priorities || [])
      .filter((p) => !p.isArchived)
      .map((p) => ({
        name: p.name,
        color: p.color || '#F59E0B',
        count: counts[p.name] || 0,
      }));
  }, [cases, config?.priorities]);

  // Test Type Stats
  const testTypeStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of cases) {
      counts[c.testType] = (counts[c.testType] || 0) + 1;
    }
    return (config?.testTypes || [])
      .filter((t) => !t.isArchived)
      .map((t) => ({
        name: t.name,
        color: t.color || '#10B981',
        count: counts[t.name] || 0,
      }));
  }, [cases, config?.testTypes]);

  // ── GROUPING LOGIC ─────────────────────────────────────────────────────────
  const activeGroupMeta = useMemo(
    () => GROUP_OPTIONS.find((g) => g.key === groupBy) || GROUP_OPTIONS[0],
    [groupBy]
  );

  const groupedCases = useMemo(() => {
    if (groupBy === 'none') return null;

    const map = new Map<
      string,
      {
        key: string;
        label: string;
        sublabel?: string;
        color?: string;
        items: TestCaseItem[];
      }
    >();

    const getOrInit = (key: string, label: string, color?: string, sublabel?: string) => {
      if (!map.has(key)) {
        map.set(key, { key, label, color, sublabel, items: [] });
      }
      return map.get(key)!;
    };

    for (const tc of cases) {
      if (groupBy === 'module') {
        const modKey = tc.module ? `mod-${tc.module.id}` : 'mod-none';
        const modLabel = tc.module?.name || 'General / No Module';
        const modColor = tc.module?.color || '#10B981';
        getOrInit(modKey, modLabel, modColor).items.push(tc);
      } else if (groupBy === 'testType') {
        const opt = config?.testTypes?.find((t) => t.name === tc.testType);
        getOrInit(`type-${tc.testType}`, tc.testType, opt?.color || '#10B981').items.push(tc);
      } else if (groupBy === 'priority') {
        const opt = config?.priorities?.find((p) => p.name === tc.priority);
        getOrInit(`pri-${tc.priority}`, tc.priority, opt?.color || '#F59E0B').items.push(tc);
      } else if (groupBy === 'status') {
        const statusColor =
          tc.status === 'Ready' ? '#10B981' : tc.status === 'Draft' ? '#F59E0B' : '#71717A';
        getOrInit(`status-${tc.status}`, tc.status, statusColor).items.push(tc);
      } else if (groupBy === 'execution') {
        const execStatus = tc.latestExecutionStatus || 'Not Run';
        const execColor =
          execStatus === 'Passed'
            ? '#10B981'
            : execStatus === 'Failed'
            ? '#EF4444'
            : execStatus === 'Blocked'
            ? '#F97316'
            : '#71717A';
        getOrInit(`exec-${execStatus}`, execStatus, execColor).items.push(tc);
      } else if (groupBy === 'tester') {
        if (!tc.assignedTester) {
          getOrInit('tester-unassigned', 'Unassigned', '#71717A').items.push(tc);
        } else {
          getOrInit(
            `tester-${tc.assignedTester.id}`,
            tc.assignedTester.name,
            tc.assignedTester.avatarColor || accentColor,
            tc.assignedTester.email || undefined
          ).items.push(tc);
        }
      }
    }

    return Array.from(map.values());
  }, [cases, groupBy, config, accentColor]);

  const toggleGroup = (grpKey: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [grpKey]: !prev[grpKey] }));
  };

  // AnimatedSelect Options for Filter Popup
  const moduleOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All Modules' },
      ...meta.modules.map((m) => ({ value: String(m.id), label: m.name })),
    ],
    [meta.modules]
  );

  const typeOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All Types' },
      ...(config?.testTypes || [])
        .filter((t) => !t.isArchived)
        .map((t) => ({ value: t.name, label: t.name })),
    ],
    [config?.testTypes]
  );

  const priorityOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All Priorities' },
      ...(config?.priorities || [])
        .filter((p) => !p.isArchived)
        .map((p) => ({ value: p.name, label: p.name })),
    ],
    [config?.priorities]
  );

  const statusOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    { value: 'Draft', label: 'Draft' },
    { value: 'Ready', label: 'Ready' },
    { value: 'Deprecated', label: 'Deprecated' },
  ];

  const testerOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All Testers' },
      ...meta.members.map((m) => ({
        value: String(m.id),
        label: m.name || m.email || `User #${m.id}`,
        icon: <UserAvatar user={m} size="xs" />,
      })),
    ],
    [meta.members]
  );

  const reqOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All Requirements' },
      ...meta.requirements.map((r) => ({
        value: String(r.id),
        label: r.code ? `${r.code} — ${r.title}` : r.title,
      })),
    ],
    [meta.requirements]
  );

  const devTaskOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All Development Tasks' },
      ...meta.devTasks.map((t) => ({
        value: String(t.id),
        label: `${t.taskKey} — ${t.title}`,
      })),
    ],
    [meta.devTasks]
  );

  // Helper to render table rows for any case array
  const renderTableRows = (items: TestCaseItem[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-[#0B0D12]/80 text-zinc-400 border-b border-[#27272A]">
          <tr>
            <th className="px-4 py-3 w-10">
              <input
                type="checkbox"
                checked={items.length > 0 && items.every((tc) => selectedIds.includes(tc.id))}
                onChange={() => {
                  const allInGrpSelected = items.every((tc) => selectedIds.includes(tc.id));
                  if (allInGrpSelected) {
                    setSelectedIds((prev) => prev.filter((id) => !items.some((tc) => tc.id === id)));
                  } else {
                    const toAdd = items.map((tc) => tc.id).filter((id) => !selectedIds.includes(id));
                    setSelectedIds((prev) => [...prev, ...toAdd]);
                  }
                }}
                className="rounded border-[#27272A] bg-[#0B0D12] text-emerald-500 focus:ring-0 w-3.5 h-3.5"
              />
            </th>
            <th className="px-4 py-3">Key &amp; Title</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Latest Run</th>
            <th className="px-4 py-3">Tester</th>
            <th className="px-4 py-3 text-right">Updated</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#27272A]/70">
          {items.map((tc) => (
            <tr
              key={tc.id}
              className={`hover:bg-white/[0.03] transition-colors cursor-pointer ${
                tc.isArchived ? 'opacity-55' : ''
              }`}
              onClick={() => setDrawerCaseId(tc.id)}
            >
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(tc.id)}
                  onChange={() => toggleOne(tc.id)}
                  className="rounded border-[#27272A] bg-[#0B0D12] text-emerald-500 focus:ring-0 w-3.5 h-3.5"
                />
              </td>
              <td className="px-4 py-3 max-w-md">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-semibold text-emerald-400 shrink-0">
                    {tc.caseKey}
                  </span>
                  <span className="font-medium text-white truncate">{tc.title}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5 flex-wrap">
                  <span>{tc.stepsCount} steps</span>
                  {tc.module && <span>• {tc.module.name}</span>}
                  {tc.linkedRequirement && (
                    <span className="text-purple-400 truncate max-w-[180px]">
                      • Req: {tc.linkedRequirement.title}
                    </span>
                  )}
                  {tc.linkedDevTask && (
                    <span className="text-cyan-400">• {tc.linkedDevTask.taskKey}</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <TestTypeBadge testType={tc.testType} />
              </td>
              <td className="px-4 py-3">
                <TestingPriorityBadge priority={tc.priority} />
              </td>
              <td className="px-4 py-3">
                <TestCaseStatusBadge status={tc.status} />
              </td>
              <td className="px-4 py-3">
                {tc.latestExecutionStatus ? (
                  <ExecutionStatusBadge status={tc.latestExecutionStatus} />
                ) : (
                  <span className="text-zinc-500">Not Run</span>
                )}
              </td>
              <td className="px-4 py-3">
                {tc.assignedTester ? (
                  <div className="flex items-center gap-1.5">
                    <UserAvatar user={tc.assignedTester} size="xs" />
                    <span className="text-zinc-300 truncate max-w-[110px]">
                      {tc.assignedTester.name}
                    </span>
                  </div>
                ) : (
                  <span className="text-zinc-500">Unassigned</span>
                )}
              </td>
              <td className="px-4 py-3 text-right text-zinc-400 whitespace-nowrap font-mono text-[11px]">
                {formatTestingDate(tc.updatedAt)}
              </td>
              <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                <div className="inline-flex items-center gap-1">
                  {permissions.canEditTestCases && (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          const detailRes = await testingService.getTestCaseDetail(projectId, tc.id);
                          if (detailRes.success && detailRes.data) {
                            setEditingCase(detailRes.data);
                            setModalOpen(true);
                          }
                        }}
                        title="Edit Test Case"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await testingService.duplicateTestCase(projectId, tc.id);
                          if (res.success && res.data) {
                            toast.success(`Duplicated as ${res.data.caseKey}`);
                            void loadData();
                          }
                        }}
                        title="Duplicate"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Helper to render card grid for any case array
  const renderCardGrid = (items: TestCaseItem[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
      {items.map((tc) => (
        <div
          key={tc.id}
          onClick={() => setDrawerCaseId(tc.id)}
          className="rounded-2xl bg-[#111216] border border-[#27272A] hover:border-zinc-500 p-4 space-y-3 cursor-pointer transition-all shadow-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono font-semibold text-emerald-400">{tc.caseKey}</span>
            <div className="flex items-center gap-1.5">
              <TestingPriorityBadge priority={tc.priority} />
              <TestCaseStatusBadge status={tc.status} />
            </div>
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-white line-clamp-2">{tc.title}</h3>
            {tc.description && (
              <p className="text-xs text-zinc-400 line-clamp-2 mt-1">{tc.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <TestTypeBadge testType={tc.testType} />
            {tc.labels.slice(0, 3).map((lbl) => (
              <span
                key={lbl}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-white/[0.05] text-zinc-300 border border-white/10"
              >
                <Tag className="w-2.5 h-2.5 text-emerald-400" />
                {lbl}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-[#27272A]/70 text-[11px] text-zinc-400">
            <span>
              {tc.stepsCount} steps • {tc.executionsCount} runs
            </span>
            {tc.latestExecutionStatus ? (
              <ExecutionStatusBadge status={tc.latestExecutionStatus} />
            ) : (
              <span className="text-zinc-500">Not Run</span>
            )}
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
        activeKey="test-cases"
        title="Test Cases"
        description="Design reusable manual test cases, verify edge conditions, and manage traceability across development modules."
        icon={CheckSquare}
        badge={`${totalCount} cases`}
        actions={
          permissions.canEditTestCases ? (
            <button
              type="button"
              onClick={() => {
                setEditingCase(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-md hover:brightness-110 transition-all cursor-pointer"
              style={{ backgroundColor: accentColor }}
            >
              <Plus className="w-4 h-4" />
              <span>New Test Case</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/30 border border-white/20">
                ⇧G
              </kbd>
            </button>
          ) : null
        }
      />

      {/* Top Database-Backed Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-[#111216] border border-[#27272A] shadow-sm flex items-center gap-3.5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
          >
            <CheckSquare className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Total Cases</div>
            <div className="text-xl font-bold text-white mt-0.5">{totalCount}</div>
            <div className="text-[10px] text-zinc-500 truncate">{meta.modules.length} app modules linked</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#111216] border border-[#27272A] shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
            <PlayCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Ready to Run</div>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">{readyCount}</div>
            <div className="text-[10px] text-zinc-500 truncate">{readinessRate}% readiness rate</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#111216] border border-[#27272A] shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
            <FileEdit className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Draft &amp; Review</div>
            <div className="text-xl font-bold text-amber-400 mt-0.5">{draftCount}</div>
            <div className="text-[10px] text-zinc-500 truncate">{deprecatedCount} deprecated</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#111216] border border-[#27272A] shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-teal-500/15 text-teal-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Pass Rate</div>
            <div className="text-xl font-bold text-teal-400 mt-0.5">{passRate}%</div>
            <div className="text-[10px] text-zinc-500 truncate">
              {passedCases.length}/{executedCases.length} executed passed
            </div>
          </div>
        </div>

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
        {/* Left Column: Clean Toolbar + Test Cases Table / Cards (9 cols) */}
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
                  placeholder="Search TC-001, title, steps, precondition..."
                  className="w-full h-9 bg-[#0B0D12] border border-[#27272A] rounded-xl pl-9 pr-8 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 transition-colors"
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
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm'
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
                            <span className="font-semibold text-white">Filter Test Cases</span>
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
                            <label className="block text-[11px] font-medium text-zinc-400 mb-1">Application Module</label>
                            <AnimatedSelect
                              options={moduleOptions}
                              value={filterModuleId}
                              onChange={setFilterModuleId}
                              placeholder="All Modules"
                              dropdownMinWidth="w-full"
                              accentColor={accentColor}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Test Type</label>
                              <AnimatedSelect
                                options={typeOptions}
                                value={filterType}
                                onChange={setFilterType}
                                placeholder="All Types"
                                dropdownMinWidth="w-full"
                                accentColor={accentColor}
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Priority</label>
                              <AnimatedSelect
                                options={priorityOptions}
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
                              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Status</label>
                              <AnimatedSelect
                                options={statusOptions}
                                value={filterStatus}
                                onChange={setFilterStatus}
                                placeholder="All Statuses"
                                dropdownMinWidth="w-full"
                                accentColor={accentColor}
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Assigned Tester</label>
                              <AnimatedSelect
                                options={testerOptions}
                                value={filterTesterId}
                                onChange={setFilterTesterId}
                                placeholder="All Testers"
                                dropdownMinWidth="w-full"
                                dropdownAlign="right"
                                accentColor={accentColor}
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-zinc-400 mb-1">Linked Requirement</label>
                            <AnimatedSelect
                              options={reqOptions}
                              value={filterReqId}
                              onChange={setFilterReqId}
                              placeholder="All Requirements"
                              dropdownMinWidth="w-full"
                              accentColor={accentColor}
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-zinc-400 mb-1">Linked Development Task</label>
                            <AnimatedSelect
                              options={devTaskOptions}
                              value={filterDevTaskId}
                              onChange={setFilterDevTaskId}
                              placeholder="All Development Tasks"
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
                              className="rounded border-[#27272A] bg-[#0B0D12] text-emerald-500 focus:ring-0 w-3.5 h-3.5"
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

                  {/* Combined Sort & Group Popover Panel */}
                  <AnimatePresence>
                    {isSortGroupOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.97 }}
                        transition={{ duration: 0.16 }}
                        className="absolute right-0 top-full mt-2 w-64 max-h-[calc(100vh-120px)] overflow-visible rounded-2xl bg-[#14161C]/98 backdrop-blur-xl border border-[#27272A] p-2 shadow-2xl z-50 space-y-1.5 text-left"
                      >
                        {/* Section 1: Sort by */}
                        <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                          <span>Sort by</span>
                          <Calendar size={11} className="text-zinc-500" />
                        </div>
                        <div className="space-y-0.5">
                          {SORT_OPTIONS.map((opt) => {
                            const isSelected = sortValue === opt.key;
                            return (
                              <motion.button
                                key={opt.key}
                                type="button"
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                  setSortValue(opt.key);
                                }}
                                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer border ${
                                  isSelected
                                    ? 'font-medium shadow-sm'
                                    : 'text-[#D4D4D8] border-transparent hover:bg-white/[0.06] hover:text-white'
                                }`}
                                style={
                                  isSelected
                                    ? {
                                        backgroundColor: `${accentColor}20`,
                                        borderColor: `${accentColor}40`,
                                        color: '#FFFFFF',
                                      }
                                    : undefined
                                }
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {opt.icon}
                                  <div className="text-left truncate">
                                    <div className="truncate font-medium text-white">{opt.label}</div>
                                    <div className="text-[10px] text-zinc-500">{opt.sublabel}</div>
                                  </div>
                                </div>
                                {isSelected && <Check size={12} style={{ color: accentColor }} />}
                              </motion.button>
                            );
                          })}
                        </div>

                        {/* Divider */}
                        <div className="my-1 border-t border-[#27272A]/80" />

                        {/* Section 2: Group by with Submenu Flyout */}
                        <div
                          className="relative"
                          onMouseEnter={() => setIsGroupByHovered(true)}
                          onMouseLeave={() => setIsGroupByHovered(false)}
                        >
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setIsGroupByHovered((p) => !p)}
                            className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer group border ${
                              groupBy !== 'none'
                                ? 'font-medium shadow-sm'
                                : 'text-[#D4D4D8] border-transparent hover:bg-white/[0.06] hover:text-white'
                            }`}
                            style={
                              groupBy !== 'none'
                                ? {
                                    backgroundColor: `${accentColor}18`,
                                    borderColor: `${accentColor}35`,
                                    color: '#FFFFFF',
                                  }
                                : undefined
                            }
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="shrink-0 flex items-center justify-center">
                                <Layers size={14} className="text-purple-400" />
                              </span>
                              <span className="font-semibold text-white">Group by</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border ${
                                  groupBy !== 'none'
                                    ? 'bg-white/10 text-white'
                                    : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/60'
                                }`}
                                style={
                                  groupBy !== 'none'
                                    ? { borderColor: `${accentColor}50`, color: accentColor }
                                    : undefined
                                }
                              >
                                {activeGroupMeta.shortLabel}
                              </span>
                              <ChevronRight
                                size={13}
                                className="text-zinc-500 group-hover:translate-x-0.5 transition-transform"
                              />
                            </div>
                          </motion.button>

                          {/* Submenu Flyout */}
                          <AnimatePresence>
                            {isGroupByHovered && (
                              <motion.div
                                initial={{ opacity: 0, x: -8, scale: 0.96 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, x: -8, scale: 0.96 }}
                                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                                className="absolute right-full bottom-0 pr-2 z-[9990]"
                              >
                                <div className="w-60 max-h-[75vh] overflow-y-auto rounded-2xl bg-[#14161C]/98 backdrop-blur-xl border border-[#27272A] p-2 shadow-2xl space-y-1 text-left">
                                  <div className="px-2.5 py-1 text-[9.5px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                                    <span>Group By</span>
                                    <Layers size={11} className="text-zinc-500" />
                                  </div>
                                  {GROUP_OPTIONS.map((grp) => {
                                    const isSelected = groupBy === grp.key;
                                    return (
                                      <motion.button
                                        key={grp.key}
                                        type="button"
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => {
                                          setGroupBy(grp.key);
                                          setIsGroupByHovered(false);
                                        }}
                                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer border ${
                                          isSelected
                                            ? 'font-medium shadow-sm'
                                            : 'text-[#D4D4D8] border-transparent hover:bg-white/[0.06] hover:text-white'
                                        }`}
                                        style={
                                          isSelected
                                            ? {
                                                backgroundColor: `${accentColor}20`,
                                                borderColor: `${accentColor}40`,
                                                color: '#FFFFFF',
                                              }
                                            : undefined
                                        }
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                          <span className="shrink-0 flex items-center justify-center">
                                            {grp.icon}
                                          </span>
                                          <div className="flex flex-col text-left min-w-0">
                                            <span className="font-semibold text-white truncate">
                                              {grp.label}
                                            </span>
                                            <span className="text-[10px] font-mono text-zinc-400 truncate">
                                              {grp.sublabel}
                                            </span>
                                          </div>
                                        </div>
                                        {isSelected && (
                                          <Check
                                            size={13}
                                            strokeWidth={2.5}
                                            className="flex-shrink-0"
                                            style={{ color: accentColor }}
                                          />
                                        )}
                                      </motion.button>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Reset Sort & Group Button at Bottom */}
                        <div className="pt-1.5 border-t border-[#27272A]/80">
                          <button
                            type="button"
                            onClick={() => {
                              setSortValue('updatedAt:desc');
                              setGroupBy('none');
                              setIsSortGroupOpen(false);
                              setIsGroupByHovered(false);
                            }}
                            className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-mono text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                          >
                            <RotateCcw size={12} />
                            <span>Reset to Default</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ── 3. LIST / CARDS VIEW TOGGLE ────────────────────────────── */}
                <div className="inline-flex items-center p-0.5 rounded-xl bg-[#0A0B0F] border border-[#27272A]">
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
                        layoutId="testCaseViewModePill"
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
                        layoutId="testCaseViewModePill"
                        className="absolute inset-0 rounded-lg bg-[#1C1E26] border border-[#2E313D]"
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      />
                    )}
                    <LayoutGrid className="w-3.5 h-3.5 relative z-10" />
                  </button>
                </div>

                {/* ── 4. REFRESH BUTTON ──────────────────────────────────────── */}
                <button
                  type="button"
                  onClick={() => void loadData()}
                  className="w-8 h-8 rounded-xl bg-[#161820] border border-[#27272A] flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors cursor-pointer"
                  title="Refresh"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Active Filter Chips Bar (Shown whenever any filter is applied) */}
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#27272A]/50">
                <span className="text-[10px] font-mono uppercase text-zinc-500 mr-0.5">Filters:</span>
                {activeFilters.map((pill) => (
                  <span
                    key={pill.key}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] bg-white/[0.06] text-zinc-200 border border-white/10"
                  >
                    <span>{pill.label}</span>
                    <button
                      type="button"
                      onClick={pill.onRemove}
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
            {selectedIds.length > 0 && permissions.canEditTestCases && (
              <div className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <span className="text-xs font-medium text-emerald-300">
                  {selectedIds.length} test case(s) selected
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => void handleBulkStatus('Ready')}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 transition-colors"
                  >
                    Mark Ready
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleBulkStatus('Draft')}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 transition-colors"
                  >
                    Mark Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleBulkStatus('Deprecated')}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/10 text-zinc-200 hover:bg-white/20 transition-colors"
                  >
                    Deprecate
                  </button>
                  {permissions.canArchiveRecords && (
                    <button
                      type="button"
                      onClick={() => void handleBulkArchive()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-500/15 text-red-300 hover:bg-red-500/25 transition-colors"
                    >
                      <Archive className="w-3 h-3" />
                      Archive
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Test Cases Table or Grid Cards (Grouped or Flat) */}
          {loading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-2xl bg-[#111216] border border-[#27272A] animate-pulse"
                />
              ))}
            </div>
          ) : cases.length === 0 ? (
            <div className="rounded-2xl bg-[#111216] border border-[#27272A] p-12 text-center space-y-3">
              <CheckSquare className="w-10 h-10 text-zinc-600 mx-auto" />
              <h3 className="text-sm font-semibold text-white">No test cases match these criteria</h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Create your first test case with ordered steps, or clear active filters to view all repository tests.
              </p>
              {permissions.canEditTestCases && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCase(null);
                    setModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-md hover:brightness-110"
                  style={{ backgroundColor: accentColor }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Test Case</span>
                  <kbd className="px-1 py-0.5 rounded text-[10px] font-mono bg-black/30 border border-white/20">
                    ⇧G
                  </kbd>
                </button>
              )}
            </div>
          ) : groupBy !== 'none' && groupedCases ? (
            /* ── GROUPED VIEW ─────────────────────────────────────────────── */
            <div className="space-y-4">
              {groupedCases.map((grp) => {
                const isCollapsed = Boolean(collapsedGroups[grp.key]);
                const grpReadyCount = grp.items.filter((c) => c.status === 'Ready').length;
                const grpExecuted = grp.items.filter((c) => c.latestExecutionStatus);
                const grpPassed = grp.items.filter((c) => c.latestExecutionStatus === 'Passed');
                const grpPassRate =
                  grpExecuted.length > 0
                    ? Math.round((grpPassed.length / grpExecuted.length) * 100)
                    : null;

                return (
                  <div
                    key={grp.key}
                    className="rounded-2xl bg-[#111216] border border-[#27272A] overflow-hidden shadow-sm"
                  >
                    {/* Collapsible Accordion Header */}
                    <button
                      type="button"
                      onClick={() => toggleGroup(grp.key)}
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
                          {grp.label}
                        </span>
                        {grp.sublabel && (
                          <span className="hidden md:inline text-[11px] text-zinc-500 font-mono truncate">
                            ({grp.sublabel})
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[#1A1C26] border border-[#27272A] text-zinc-300 shrink-0">
                          {grp.items.length} {grp.items.length === 1 ? 'case' : 'cases'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-[11px] font-mono text-zinc-400">
                        <span>{grpReadyCount} Ready</span>
                        {grpPassRate !== null && (
                          <span className="hidden sm:inline text-emerald-400">
                            • {grpPassRate}% Pass
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
            /* ── FLAT LIST VIEW ───────────────────────────────────────────── */
            <div className="rounded-2xl bg-[#111216] border border-[#27272A] overflow-hidden shadow-sm">
              {renderTableRows(cases)}
            </div>
          ) : (
            /* ── FLAT CARDS VIEW ──────────────────────────────────── */
            renderCardGrid(cases)
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
                  <span className="text-zinc-300">Pass Rate</span>
                  <span className="font-mono text-zinc-200 font-semibold">{passRate}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#1C1E26] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${passRate}%` }}
                    transition={{ duration: 0.5 }}
                    className="h-full rounded-full bg-emerald-400"
                  />
                </div>
                <p className="text-[10px] text-zinc-500 font-mono">
                  {passedCases.length} of {executedCases.length} runs passed
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300">Test Readiness</span>
                  <span className="font-mono text-zinc-200 font-semibold">{readinessRate}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#1C1E26] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${readinessRate}%` }}
                    transition={{ duration: 0.5, delay: 0.08 }}
                    className="h-full rounded-full bg-blue-400"
                  />
                </div>
                <p className="text-[10px] text-zinc-500 font-mono">
                  {readyCount} ready · {draftCount} in draft
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
                  {linkedCount} linked to requirements &amp; tasks
                </p>
              </div>
            </div>

            {/* Quick Action Tiles */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#27272A]/70">
              {permissions.canEditTestCases && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCase(null);
                    setModalOpen(true);
                  }}
                  className="flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-xl bg-[#161820] border border-[#27272A] hover:border-zinc-500 text-zinc-300 hover:text-white transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  <span className="text-[10px] font-medium">New Case</span>
                  <span className="text-[9px] font-mono text-zinc-500">⇧G</span>
                </button>
              )}
              <button
                type="button"
                onClick={toggleAll}
                className="flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-xl bg-[#161820] border border-[#27272A] hover:border-zinc-500 text-zinc-300 hover:text-white transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-[10px] font-medium">
                  {selectedIds.length === cases.length ? 'Clear All' : 'Select All'}
                </span>
                <span className="text-[9px] font-mono text-zinc-500">{cases.length} total</span>
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

          {/* Test Type Distribution Box */}
          <div className="rounded-2xl bg-[#111216] border border-[#27272A] p-4 sm:p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Test Types</h3>
            <div className="flex flex-wrap gap-1.5">
              {testTypeStats.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#161820] border border-[#27272A] text-[11px]"
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
        </aside>
      </div>

      {/* Create / Edit Test Case Sliding Drawer */}
      {config && (
        <TestCaseModal
          projectId={projectId}
          isOpen={modalOpen}
          editingCase={editingCase}
          meta={meta}
          config={config}
          permissions={permissions}
          onConfigUpdated={setConfig}
          onClose={() => {
            setModalOpen(false);
            setEditingCase(null);
          }}
          onSaved={() => {
            setModalOpen(false);
            setEditingCase(null);
            void loadData();
          }}
        />
      )}

      {/* Test Case Detail View Drawer */}
      <TestCaseDrawer
        projectId={projectId}
        caseId={drawerCaseId}
        meta={meta}
        permissions={permissions}
        onClose={() => setDrawerCaseId(null)}
        onEdit={(detail) => {
          setDrawerCaseId(null);
          setEditingCase(detail);
          setModalOpen(true);
        }}
        onDuplicated={(created) => {
          setDrawerCaseId(created.id);
          void loadData();
        }}
        onArchived={() => {
          setDrawerCaseId(null);
          void loadData();
        }}
      />
    </div>
  );
};
