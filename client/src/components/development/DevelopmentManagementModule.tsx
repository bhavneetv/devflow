import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  BarChart3,
  Calendar,
  CheckSquare,
  LayoutDashboard,
  ListTodo,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { confirmDeleteSwal } from '../../lib/confirmAlert';
import { developmentService } from '../../services/development.service';
import { useAccentTheme } from '../../services/accentTheme.service';
import type {
  DevelopmentDashboardData,
  DevelopmentModuleMaster,
  DevelopmentTaskItem,
  DevGitCommitLink,
} from '../../types/development';
import {
  DevelopmentDashboardCards,
  MetricFilterType,
} from './DevelopmentDashboardCards';
import {
  DevelopmentToolbar,
  DevGroupByMode,
  DevViewMode,
} from './DevelopmentToolbar';
import { DevelopmentListView } from './DevelopmentListView';
import { DevelopmentCardView } from './DevelopmentCardView';
import { DevelopmentBoardView } from './DevelopmentBoardView';
import { DevelopmentGroupedView } from './DevelopmentGroupedView';
import { DevelopmentCalendarView } from './DevelopmentCalendarView';
import { DevelopmentOverviewSidebar } from './DevelopmentOverviewSidebar';
import { DevelopmentAnalyticsView } from './DevelopmentAnalyticsView';
import { DevelopmentTaskModal } from './DevelopmentTaskModal';
import { DevelopmentTaskDrawer } from './DevelopmentTaskDrawer';
import { CommitCompletionModal } from './CommitCompletionModal';
import { isDevelopmentTaskType, isEndStatusName } from './devBadges';
import { CustomDatePicker } from '../settings/CustomDatePicker';

function getLocalDateIso(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const FULL_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatFullDayMonthYear(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const monthName = FULL_MONTH_NAMES[monthIdx] || parts[1];
  return `${day} - ${monthName} - ${year}`;
}

const PRIORITY_SORT_RANK: Record<string, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

interface DevelopmentManagementModuleProps {
  projectId: number;
  submoduleName?: string;
}

type DevTabKey = 'overview' | 'tasks' | 'analytics';

export const DevelopmentManagementModule: React.FC<DevelopmentManagementModuleProps> = ({
  projectId,
  submoduleName,
}) => {
  const { accentColor } = useAccentTheme();
  const [activeTab, setActiveTab] = useState<DevTabKey>('overview');

  // Core data states
  const [dashboardData, setDashboardData] = useState<DevelopmentDashboardData | null>(null);
  const [modules, setModules] = useState<DevelopmentModuleMaster[]>([]);
  const [tasks, setTasks] = useState<DevelopmentTaskItem[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isTasksLoading, setIsTasksLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters, search, view & sort state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [moduleIdFilter, setModuleIdFilter] = useState<number | undefined>(undefined);
  const [submoduleIdFilter, setSubmoduleIdFilter] = useState<number | undefined>(undefined);
  const [assigneeIdFilter, setAssigneeIdFilter] = useState<number | 'unassigned' | undefined>(
    undefined
  );
  const [priorityFilter, setPriorityFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [taskTypeFilter, setTaskTypeFilter] = useState<string | undefined>(undefined);
  const [metricFilter, setMetricFilter] = useState<'overdue' | 'due_soon' | undefined>(undefined);
  const [startDateFilter, setStartDateFilter] = useState(() => getLocalDateIso(0));
  const [endDateFilter, setEndDateFilter] = useState(() => getLocalDateIso(0));
  const [viewMode, setViewMode] = useState<DevViewMode>('list');
  const [groupBy, setGroupBy] = useState<DevGroupByMode>('none');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'createdAt' | 'updatedAt' | 'title'>(
    'createdAt'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Analytics filter state
  const [analyticsModuleId, setAnalyticsModuleId] = useState<number | undefined>(undefined);
  const [analyticsStartDate, setAnalyticsStartDate] = useState('');
  const [analyticsEndDate, setAnalyticsEndDate] = useState('');

  // Modals & Drawers
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<DevelopmentTaskItem | null>(null);
  const [selectedTaskForDrawer, setSelectedTaskForDrawer] = useState<DevelopmentTaskItem | null>(
    null
  );
  const [pendingCommitCompletion, setPendingCommitCompletion] = useState<{
    task: DevelopmentTaskItem;
    targetStatus: string;
  } | null>(null);
  const [isCompletingCommit, setIsCompletingCommit] = useState(false);

  // Global Shift + T keyboard shortcut to open Create Task modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!dashboardData?.permissions.canEditTasks) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!e.shiftKey || e.key.toLowerCase() !== 't') return;

      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) {
          return;
        }
      }

      e.preventDefault();
      setTaskToEdit(null);
      setIsTaskModalOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dashboardData?.permissions.canEditTasks]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 260);
    return () => clearTimeout(t);
  }, [search]);

  const loadDashboardAndMasters = useCallback(async () => {
    const [dashRes, modRes] = await Promise.all([
      developmentService.getDashboard(projectId, {
        moduleId: analyticsModuleId,
        startDate: analyticsStartDate || undefined,
        endDate: analyticsEndDate || undefined,
      }),
      developmentService.listModules(projectId, false),
    ]);

    if (dashRes.success && dashRes.data) {
      setDashboardData(dashRes.data);
      setErrorMessage(null);
    } else if (!dashRes.success) {
      setErrorMessage(dashRes.error || 'Failed to load development data');
    }

    if (modRes.success && modRes.data) {
      setModules(modRes.data);
    }
  }, [projectId, analyticsModuleId, analyticsStartDate, analyticsEndDate]);

  const loadTasks = useCallback(async () => {
    setIsTasksLoading(true);
    const todayIso = getLocalDateIso(0);
    const tzOffsetMinutes = new Date().getTimezoneOffset();
    const isOverview = activeTab === 'overview';

    const res = await developmentService.listTasks(projectId, {
      search: debouncedSearch || undefined,
      moduleId: moduleIdFilter,
      submoduleId: submoduleIdFilter,
      assigneeId: assigneeIdFilter,
      priority: priorityFilter,
      status: statusFilter,
      taskType: taskTypeFilter,
      metric: isOverview ? undefined : metricFilter,
      startDate: isOverview ? todayIso : startDateFilter || undefined,
      endDate: isOverview ? todayIso : endDateFilter || undefined,
      tzOffsetMinutes,
      sortBy,
      sortOrder,
      page: 1,
      limit: 500,
    });
    setIsTasksLoading(false);

    if (res.success && res.data) {
      setTasks(res.data.items);
    } else if (!res.success) {
      setErrorMessage(res.error || 'Failed to load work items');
    }
  }, [
    projectId,
    activeTab,
    debouncedSearch,
    moduleIdFilter,
    submoduleIdFilter,
    assigneeIdFilter,
    priorityFilter,
    statusFilter,
    taskTypeFilter,
    metricFilter,
    startDateFilter,
    endDateFilter,
    sortBy,
    sortOrder,
  ]);

  const refreshEverything = useCallback(async () => {
    await Promise.all([loadDashboardAndMasters(), loadTasks()]);
  }, [loadDashboardAndMasters, loadTasks]);

  useEffect(() => {
    let mounted = true;
    setIsInitialLoading(true);
    Promise.all([loadDashboardAndMasters(), loadTasks()]).finally(() => {
      if (mounted) setIsInitialLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (!isInitialLoading) {
      loadTasks();
    }
  }, [loadTasks]);

  useEffect(() => {
    if (!isInitialLoading) {
      loadDashboardAndMasters();
    }
  }, [loadDashboardAndMasters]);

  const clearAllFilters = () => {
    const todayIso = getLocalDateIso(0);
    setSearch('');
    setDebouncedSearch('');
    setModuleIdFilter(undefined);
    setSubmoduleIdFilter(undefined);
    setAssigneeIdFilter(undefined);
    setPriorityFilter(undefined);
    setStatusFilter(undefined);
    setTaskTypeFilter(undefined);
    setMetricFilter(undefined);
    setStartDateFilter(todayIso);
    setEndDateFilter(todayIso);
  };

  const activeMetricFilterKey: MetricFilterType | null = metricFilter
    ? metricFilter
    : statusFilter === 'Completed'
    ? 'completed'
    : statusFilter === 'In Progress'
    ? 'in_progress'
    : statusFilter === 'Not Started'
    ? 'not_started'
    : null;

  const handleSelectMetricCard = (metric: MetricFilterType) => {
    setStatusFilter(undefined);
    setMetricFilter(undefined);
    setStartDateFilter('');
    setEndDateFilter('');
    if (metric === 'completed') setStatusFilter('Completed');
    else if (metric === 'in_progress') setStatusFilter('In Progress');
    else if (metric === 'not_started') setStatusFilter('Not Started');
    else if (metric === 'overdue') setMetricFilter('overdue');
    else if (metric === 'due_soon') setMetricFilter('due_soon');
    setActiveTab('tasks');
  };

  const handleSelectAssigneeCard = (userId: number) => {
    setMetricFilter(undefined);
    setStartDateFilter('');
    setEndDateFilter('');
    setAssigneeIdFilter((prev) => (prev === userId ? undefined : userId));
    setActiveTab('tasks');
  };

  const performStatusUpdate = async (
    taskId: number,
    newStatus: string,
    gitCommit?: DevGitCommitLink | null
  ) => {
    const prevTasks = tasks;
    setTasks((cur) => cur.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    const res = await developmentService.updateTaskStatus(
      projectId,
      taskId,
      newStatus,
      gitCommit
    );
    if (res.success && res.data) {
      await refreshEverything();
    } else {
      setTasks(prevTasks);
      setErrorMessage(res.error || 'Failed to update status');
    }
  };

  const handleQuickStatusChange = async (task: DevelopmentTaskItem, newStatus: string) => {
    const statusItems = dashboardData?.config.statusItems || [];
    const alreadyEnded = isEndStatusName(task.status, statusItems);
    const nextIsEnd = isEndStatusName(newStatus, statusItems);

    if (!alreadyEnded && nextIsEnd && isDevelopmentTaskType(task.taskType)) {
      setPendingCommitCompletion({ task, targetStatus: newStatus });
      return;
    }

    await performStatusUpdate(task.id, newStatus);
  };

  const handleDeleteTask = async (task: DevelopmentTaskItem) => {
    const ok = await confirmDeleteSwal({
      title: `Delete ${task.taskKey}?`,
      text: 'This action permanently deletes this development work item and its history.',
      highlightLabel: `${task.taskKey} · ${task.title}`,
      confirmText: 'Yes, delete',
      accentColor,
    });
    if (!ok) return;
    const res = await developmentService.deleteTask(projectId, task.id);
    if (res.success) {
      if (selectedTaskForDrawer?.id === task.id) setSelectedTaskForDrawer(null);
      await refreshEverything();
    } else {
      setErrorMessage(res.error || 'Failed to delete task');
    }
  };

  const TABS: { key: DevTabKey; label: string; icon: React.ComponentType<any>; count?: number }[] = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    {
      key: 'tasks',
      label: 'All Tasks',
      icon: ListTodo,
      count: dashboardData?.metrics.totalWorkItems,
    },
    { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  const sortedTasks = useMemo(() => {
    const copy = [...tasks];
    copy.sort((a, b) => {
      if (sortBy === 'priority') {
        const diff = (PRIORITY_SORT_RANK[a.priority] || 0) - (PRIORITY_SORT_RANK[b.priority] || 0);
        if (diff !== 0) return sortOrder === 'asc' ? diff : -diff;
        return b.id - a.id;
      }
      if (sortBy === 'dueDate') {
        const aTime = a.dueDate ? new Date(a.dueDate).getTime() : null;
        const bTime = b.dueDate ? new Date(b.dueDate).getTime() : null;
        if (aTime === null && bTime === null) return b.id - a.id;
        if (aTime === null) return 1;
        if (bTime === null) return -1;
        const diff = aTime - bTime;
        if (diff !== 0) return sortOrder === 'asc' ? diff : -diff;
        return b.id - a.id;
      }
      if (sortBy === 'title') {
        const diff = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
        if (diff !== 0) return sortOrder === 'asc' ? diff : -diff;
        return b.id - a.id;
      }
      if (sortBy === 'updatedAt') {
        const diff = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        if (diff !== 0) return sortOrder === 'asc' ? diff : -diff;
        return b.id - a.id;
      }
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (diff !== 0) return sortOrder === 'asc' ? diff : -diff;
      return sortOrder === 'asc' ? a.id - b.id : b.id - a.id;
    });
    return copy;
  }, [tasks, sortBy, sortOrder]);

  // Skeleton matching DocumentsKnowledgeBaseModule
  if (isInitialLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#27272A]/70">
          <div className="space-y-2">
            <div className="h-8 w-72 rounded-xl bg-[#17181D]" />
            <div className="h-4 w-96 max-w-full rounded-lg bg-[#14151B]" />
          </div>
          <div className="h-9 w-32 rounded-xl bg-[#17181D]" />
        </div>
        <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-[#0A0B0F] border border-[#27272A]/80">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-8 w-24 rounded-lg bg-[#17181D]" />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, idx) => (
            <div key={idx} className="h-28 rounded-2xl bg-[#0E0F14]/95 border border-[#27272A]" />
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <div className="xl:col-span-9 h-72 rounded-2xl bg-[#0E0F14]/95 border border-[#27272A]" />
          <div className="xl:col-span-3 h-72 rounded-2xl bg-[#0E0F14]/95 border border-[#27272A]" />
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="rounded-2xl bg-[#0E0F14]/95 border border-red-500/30 p-8 text-center space-y-3 max-w-lg mx-auto my-8">
        <AlertCircle size={28} className="mx-auto text-red-400" />
        <h3 className="text-base font-semibold text-white">Unable to Load Development Module</h3>
        <p className="text-xs text-zinc-400">{errorMessage || 'Check your project access.'}</p>
        <button
          type="button"
          onClick={refreshEverything}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#0A0B10] cursor-pointer"
          style={{ backgroundColor: accentColor }}
        >
          <RefreshCw size={13} />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const todayIso = getLocalDateIso(0);
  const yesterdayIso = getLocalDateIso(-1);
  const last7Iso = getLocalDateIso(-6);
  const last30Iso = getLocalDateIso(-29);

  const isDefaultTodayRange = startDateFilter === todayIso && endDateFilter === todayIso;
  const activeDatePreset =
    activeTab === 'tasks' && !metricFilter
      ? startDateFilter === todayIso && endDateFilter === todayIso
        ? 'today'
        : startDateFilter === yesterdayIso && endDateFilter === yesterdayIso
        ? 'yesterday'
        : startDateFilter === last7Iso && endDateFilter === todayIso
        ? '7d'
        : startDateFilter === last30Iso && endDateFilter === todayIso
        ? '30d'
        : !startDateFilter && !endDateFilter
        ? 'all'
        : 'custom'
      : 'custom';

  const hasActiveFilters = Boolean(
    search ||
      moduleIdFilter ||
      submoduleIdFilter ||
      statusFilter ||
      priorityFilter ||
      taskTypeFilter ||
      metricFilter ||
      assigneeIdFilter ||
      (activeTab === 'tasks' && !isDefaultTodayRange) ||
      groupBy !== 'none'
  );

  const renderToolbar = () => (
    <DevelopmentToolbar
      search={search}
      onSearchChange={setSearch}
      modules={modules}
      config={dashboardData.config}
      moduleId={moduleIdFilter}
      onModuleIdChange={(id) => {
        setModuleIdFilter(id);
        setSubmoduleIdFilter(undefined);
      }}
      submoduleId={submoduleIdFilter}
      onSubmoduleIdChange={setSubmoduleIdFilter}
      status={statusFilter}
      onStatusChange={setStatusFilter}
      priority={priorityFilter}
      onPriorityChange={setPriorityFilter}
      taskType={taskTypeFilter}
      onTaskTypeChange={setTaskTypeFilter}
      assigneeId={assigneeIdFilter}
      onAssigneeIdChange={setAssigneeIdFilter}
      eligibleMembers={dashboardData.eligibleMembers}
      viewMode={viewMode}
      onViewModeChange={(mode) => {
        setViewMode(mode);
        if ((mode === 'list' || mode === 'card') && groupBy !== 'none') {
          setGroupBy('none');
        }
      }}
      groupBy={groupBy}
      onGroupByChange={(g) => {
        setGroupBy(g);
        if (g !== 'none' && (viewMode === 'board' || viewMode === 'calendar')) {
          setViewMode('list');
        }
      }}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSortChange={(sb, so) => {
        setSortBy(sb);
        setSortOrder(so);
      }}
      hasActiveFilters={hasActiveFilters}
      onClearAllFilters={() => {
        clearAllFilters();
        setGroupBy('none');
      }}
      onRefresh={refreshEverything}
      canEditTasks={dashboardData.permissions.canEditTasks}
      onCreateTask={() => {
        setTaskToEdit(null);
        setIsTaskModalOpen(true);
      }}
    />
  );

  const renderAllTasksDateBar = () => {
    const DATE_PRESETS = [
      { id: 'today', label: 'Today', from: todayIso, to: todayIso },
      { id: 'yesterday', label: 'Yesterday', from: yesterdayIso, to: yesterdayIso },
      { id: '7d', label: 'Last 7 Days', from: last7Iso, to: todayIso },
      { id: '30d', label: 'Last 30 Days', from: last30Iso, to: todayIso },
      { id: 'all', label: 'All', from: '', to: '' },
    ] as const;

    return (
      <div className="rounded-xl bg-[#0E0F14]/95 border border-[#27272A] px-3 py-2 relative z-[70] flex flex-wrap items-center justify-between gap-2.5">
        {/* Quick Presets at start */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-zinc-500 mr-1">
            <Calendar size={12} style={{ color: accentColor }} />
            <span>Range</span>
          </span>
          <div className="inline-flex flex-wrap items-center gap-1 p-0.5 rounded-lg bg-[#090A0E] border border-[#27272A]">
            {DATE_PRESETS.map((preset) => {
              const isSelected = activeDatePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setMetricFilter(undefined);
                    setStartDateFilter(preset.from);
                    setEndDateFilter(preset.to);
                  }}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer',
                    isSelected
                      ? 'text-[#0A0B10] font-semibold shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                  )}
                  style={isSelected ? { backgroundColor: accentColor } : undefined}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2 Date Inputs (From / To) defaulting to Today */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-zinc-500">From</span>
            <div className="w-38">
              <CustomDatePicker
                value={startDateFilter}
                onChange={(val) => {
                  setMetricFilter(undefined);
                  setStartDateFilter(val);
                  if (val && endDateFilter && val > endDateFilter) {
                    setEndDateFilter(val);
                  }
                }}
                placeholder="Start date"
                presetMode="none"
                showQuarterTab={false}
                align="right"
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-zinc-500">To</span>
            <div className="w-38">
              <CustomDatePicker
                value={endDateFilter}
                onChange={(val) => {
                  setMetricFilter(undefined);
                  setEndDateFilter(val);
                  if (val && startDateFilter && val < startDateFilter) {
                    setStartDateFilter(val);
                  }
                }}
                placeholder="End date"
                presetMode="none"
                showQuarterTab={false}
                align="right"
              />
            </div>
          </div>
          <span className="px-2 py-1 rounded-lg bg-[#161820] border border-[#27272A] text-[11px] font-mono text-zinc-300">
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
          </span>
        </div>
      </div>
    );
  };

  const renderTaskListContent = () => {
    if (isTasksLoading && tasks.length === 0) {
      return (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-14 rounded-xl bg-[#0E0F14]/95 border border-[#27272A]" />
          ))}
        </div>
      );
    }

    if (tasks.length === 0) {
      const isOverviewEmpty = activeTab === 'overview';
      return (
        <div className="rounded-2xl bg-[#0E0F14]/95 border border-dashed border-[#27272A] p-10 text-center space-y-3">
          <CheckSquare size={26} className="mx-auto text-zinc-600" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-white">
              {isOverviewEmpty && !hasActiveFilters
                ? 'No tasks given today'
                : 'No development work items found'}
            </h4>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              {hasActiveFilters
                ? 'No tasks match your active search or filter criteria.'
                : isOverviewEmpty
                ? `No tasks were created for today (${todayIso}). Create a new task or open All Tasks to view previous work items.`
                : 'No tasks found for the selected date range. Adjust the date presets or create a new work item.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  clearAllFilters();
                  setGroupBy('none');
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-medium bg-[#161820] hover:bg-[#1E202B] text-zinc-200 border border-[#27272A] cursor-pointer"
              >
                Clear All Filters
              </button>
            )}
            {isOverviewEmpty && (
              <button
                type="button"
                onClick={() => {
                  setStartDateFilter('');
                  setEndDateFilter('');
                  setActiveTab('tasks');
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-medium bg-[#161820] hover:bg-[#1E202B] text-zinc-200 border border-[#27272A] cursor-pointer"
              >
                View All Tasks
              </button>
            )}
            {dashboardData.permissions.canEditTasks && (
              <button
                type="button"
                onClick={() => {
                  setTaskToEdit(null);
                  setIsTaskModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#0A0B10] cursor-pointer hover:brightness-110"
                style={{ backgroundColor: accentColor }}
              >
                <Plus size={14} />
                <span>Create Task</span>
                <kbd className="px-1.5 py-0.5 rounded bg-black/15 text-[10px] font-mono font-bold">
                  Shift+T
                </kbd>
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {viewMode === 'calendar' && (
          <DevelopmentCalendarView
            tasks={sortedTasks}
            onSelectTask={(t) => setSelectedTaskForDrawer(t)}
          />
        )}
        {viewMode === 'board' && (
          <DevelopmentBoardView
            tasks={sortedTasks}
            statuses={dashboardData.config.statuses}
            assigneeGroups={dashboardData.assigneeGroups}
            canEditTasks={dashboardData.permissions.canEditTasks}
            onSelectTask={(t) => setSelectedTaskForDrawer(t)}
            onQuickStatusChange={handleQuickStatusChange}
          />
        )}
        {(viewMode === 'list' || viewMode === 'card') && groupBy !== 'none' && (
          <DevelopmentGroupedView
            tasks={sortedTasks}
            assigneeGroups={dashboardData.assigneeGroups}
            groupBy={groupBy}
            onSelectTask={(t) => setSelectedTaskForDrawer(t)}
          />
        )}
        {viewMode === 'list' && groupBy === 'none' && (
          <DevelopmentListView
            tasks={sortedTasks}
            assigneeGroups={dashboardData.assigneeGroups}
            canEditTasks={dashboardData.permissions.canEditTasks}
            onSelectTask={(t) => setSelectedTaskForDrawer(t)}
            onEditTask={(t) => {
              setTaskToEdit(t);
              setIsTaskModalOpen(true);
            }}
            onQuickStatusChange={handleQuickStatusChange}
            onDeleteTask={handleDeleteTask}
          />
        )}
        {viewMode === 'card' && groupBy === 'none' && (
          <DevelopmentCardView
            tasks={sortedTasks}
            assigneeGroups={dashboardData.assigneeGroups}
            canEditTasks={dashboardData.permissions.canEditTasks}
            onSelectTask={(t) => setSelectedTaskForDrawer(t)}
            onEditTask={(t) => {
              setTaskToEdit(t);
              setIsTaskModalOpen(true);
            }}
            onQuickStatusChange={handleQuickStatusChange}
            onDeleteTask={handleDeleteTask}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header matching DocumentsKnowledgeBaseModule */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#27272A]/70">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {submoduleName || 'Development Management'}
            </h1>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-[#121319] border border-[#27272A]"
              style={{ color: accentColor }}
            >
              {dashboardData.config.taskPrefix} · {dashboardData.metrics.completionRate}% done
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400">
            Coordinate engineering work items, module/submodule masters, priorities, deadlines, and team workload
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {dashboardData.permissions.canEditTasks && (
            <button
              type="button"
              title="Create Task (Shift+T)"
              onClick={() => {
                setTaskToEdit(null);
                setIsTaskModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#0A0B10] transition-all cursor-pointer hover:brightness-110"
              style={{
                backgroundColor: accentColor,
                boxShadow: `0 6px 18px -4px ${accentColor}55`,
              }}
            >
              <Plus size={14} />
              <span>Create Task</span>
              <kbd className="px-1.5 py-0.5 rounded bg-black/15 text-[10px] font-mono font-bold">
                Shift+T
              </kbd>
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-200 underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Sliding Button Tabs Navigation */}
      <div className="overflow-x-auto scrollbar-none pb-0.5">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#0A0B0F] border border-[#27272A]/80 shadow-inner">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'relative z-10 flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer text-[12px] select-none',
                  isActive ? 'text-[#0A0B10]' : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="developmentModuleActiveTabPill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-lg -z-10"
                    style={{
                      backgroundColor: accentColor,
                      boxShadow: `0 4px 14px -2px ${accentColor}66`,
                    }}
                  />
                )}
                <Icon size={14} className={isActive ? 'text-[#0A0B10]' : 'text-zinc-500'} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold',
                      isActive
                        ? 'bg-black/15 text-[#0A0B10]'
                        : 'bg-zinc-800/90 text-zinc-400'
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          <DevelopmentDashboardCards
            data={dashboardData}
            activeMetricFilter={activeMetricFilterKey}
            activeStatusFilter={statusFilter}
            activeTaskTypeFilter={taskTypeFilter}
            activeAssigneeFilter={
              typeof assigneeIdFilter === 'number' ? assigneeIdFilter : undefined
            }
            onSelectMetricFilter={handleSelectMetricCard}
            onSelectStatusFilter={(statusName) => {
              setMetricFilter(undefined);
              setStartDateFilter('');
              setEndDateFilter('');
              setStatusFilter(statusName);
              setActiveTab('tasks');
            }}
            onSelectTaskTypeFilter={(tt) => {
              setTaskTypeFilter(tt);
              if (tt) {
                setMetricFilter(undefined);
                setStartDateFilter('');
                setEndDateFilter('');
                setActiveTab('tasks');
              }
            }}
            onSelectAssigneeFilter={handleSelectAssigneeCard}
          />

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            <div className="xl:col-span-9 space-y-3">
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">Today&apos;s Tasks</span>
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-mono border border-[#27272A] bg-[#12141B]"
                    style={{ color: accentColor }}
                  >
                    {formatFullDayMonthYear(todayIso)} · {tasks.length}{' '}
                    {tasks.length === 1 ? 'task' : 'tasks'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('tasks')}
                  className="text-[11px] font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  Open All Tasks →
                </button>
              </div>
              {renderToolbar()}
              {renderTaskListContent()}
            </div>

            <div className="xl:col-span-3">
              <DevelopmentOverviewSidebar
                data={dashboardData}
                onCreateTaskClick={() => {
                  setTaskToEdit(null);
                  setIsTaskModalOpen(true);
                }}
                onAllTasksClick={() => setActiveTab('tasks')}
                onAnalyticsClick={() => setActiveTab('analytics')}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="space-y-3">
          {renderAllTasksDateBar()}
          {renderToolbar()}
          {renderTaskListContent()}
        </div>
      )}

      {activeTab === 'analytics' && (
        <DevelopmentAnalyticsView
          data={dashboardData}
          modules={modules}
          filterModuleId={analyticsModuleId}
          filterStartDate={analyticsStartDate}
          filterEndDate={analyticsEndDate}
          onFilterChange={(next) => {
            setAnalyticsModuleId(next.moduleId);
            setAnalyticsStartDate(next.startDate);
            setAnalyticsEndDate(next.endDate);
          }}
          onSelectTask={(t) => setSelectedTaskForDrawer(t)}
        />
      )}

      {/* Create / Edit Task Modal */}
      <DevelopmentTaskModal
        isOpen={isTaskModalOpen}
        projectId={projectId}
        taskToEdit={taskToEdit}
        modules={modules}
        eligibleMembers={dashboardData.eligibleMembers}
        assigneeGroups={dashboardData.assigneeGroups}
        config={dashboardData.config}
        canManageMasters={dashboardData.permissions.canManageMasters}
        onClose={() => {
          setIsTaskModalOpen(false);
          setTaskToEdit(null);
        }}
        onSaved={async () => {
          setIsTaskModalOpen(false);
          setTaskToEdit(null);
          await refreshEverything();
        }}
        onModulesUpdated={async () => {
          const modRes = await developmentService.listModules(projectId, false);
          if (modRes.success && modRes.data) setModules(modRes.data);
        }}
      />

      {/* Task Detail Drawer */}
      <DevelopmentTaskDrawer
        projectId={projectId}
        task={selectedTaskForDrawer}
        config={dashboardData.config}
        assigneeGroups={dashboardData.assigneeGroups}
        canEditTasks={dashboardData.permissions.canEditTasks}
        onClose={() => setSelectedTaskForDrawer(null)}
        onEditFull={(t) => {
          setSelectedTaskForDrawer(null);
          setTaskToEdit(t);
          setIsTaskModalOpen(true);
        }}
        onTaskUpdated={async () => {
          await refreshEverything();
        }}
        onTaskDeleted={async () => {
          await refreshEverything();
        }}
      />

      <CommitCompletionModal
        isOpen={Boolean(pendingCommitCompletion)}
        projectId={projectId}
        taskKey={pendingCommitCompletion?.task.taskKey}
        taskTitle={pendingCommitCompletion?.task.title || ''}
        targetStatus={pendingCommitCompletion?.targetStatus || 'Completed'}
        mode="complete"
        existingCommit={pendingCommitCompletion?.task.gitCommit || null}
        isSubmitting={isCompletingCommit}
        onCancel={() => {
          if (!isCompletingCommit) setPendingCommitCompletion(null);
        }}
        onConfirm={async (commit) => {
          if (!pendingCommitCompletion) return;
          setIsCompletingCommit(true);
          try {
            await performStatusUpdate(
              pendingCommitCompletion.task.id,
              pendingCommitCompletion.targetStatus,
              commit ?? undefined
            );
            setPendingCommitCompletion(null);
          } finally {
            setIsCompletingCommit(false);
          }
        }}
      />
    </div>
  );
};

