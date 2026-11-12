import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  BarChart3,
  CheckSquare,
  FolderCog,
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
import { DevelopmentOverviewSidebar } from './DevelopmentOverviewSidebar';
import { DevelopmentAnalyticsView } from './DevelopmentAnalyticsView';
import { DevelopmentMastersManager } from './DevelopmentMastersManager';
import { DevelopmentTaskModal } from './DevelopmentTaskModal';
import { DevelopmentTaskDrawer } from './DevelopmentTaskDrawer';

interface DevelopmentManagementModuleProps {
  projectId: number;
  submoduleName?: string;
}

type DevTabKey = 'overview' | 'tasks' | 'analytics' | 'masters';

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
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
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
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [viewMode, setViewMode] = useState<DevViewMode>('list');
  const [groupBy, setGroupBy] = useState<DevGroupByMode>('module');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'createdAt' | 'updatedAt' | 'title'>(
    'createdAt'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  // Analytics filter state
  const [analyticsModuleId, setAnalyticsModuleId] = useState<number | undefined>(undefined);
  const [analyticsStartDate, setAnalyticsStartDate] = useState('');
  const [analyticsEndDate, setAnalyticsEndDate] = useState('');

  // Masters archived toggle
  const [showArchivedMasters, setShowArchivedMasters] = useState(false);

  // Modals & Drawers
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<DevelopmentTaskItem | null>(null);
  const [selectedTaskForDrawer, setSelectedTaskForDrawer] = useState<DevelopmentTaskItem | null>(
    null
  );

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
      developmentService.listModules(projectId, showArchivedMasters),
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
  }, [projectId, analyticsModuleId, analyticsStartDate, analyticsEndDate, showArchivedMasters]);

  const loadTasks = useCallback(async () => {
    setIsTasksLoading(true);
    const res = await developmentService.listTasks(projectId, {
      search: debouncedSearch || undefined,
      moduleId: moduleIdFilter,
      submoduleId: submoduleIdFilter,
      assigneeId: assigneeIdFilter,
      priority: priorityFilter,
      status: statusFilter,
      taskType: taskTypeFilter,
      metric: metricFilter,
      startDate: startDateFilter || undefined,
      endDate: endDateFilter || undefined,
      sortBy,
      sortOrder,
      page,
      limit: 50,
    });
    setIsTasksLoading(false);

    if (res.success && res.data) {
      setTasks(res.data.items);
      setPagination(res.data.pagination);
    } else if (!res.success) {
      setErrorMessage(res.error || 'Failed to load work items');
    }
  }, [
    projectId,
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
    page,
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
    setSearch('');
    setDebouncedSearch('');
    setModuleIdFilter(undefined);
    setSubmoduleIdFilter(undefined);
    setAssigneeIdFilter(undefined);
    setPriorityFilter(undefined);
    setStatusFilter(undefined);
    setTaskTypeFilter(undefined);
    setMetricFilter(undefined);
    setStartDateFilter('');
    setEndDateFilter('');
    setPage(1);
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
    setPage(1);
    setStatusFilter(undefined);
    setMetricFilter(undefined);
    if (metric === 'completed') setStatusFilter('Completed');
    else if (metric === 'in_progress') setStatusFilter('In Progress');
    else if (metric === 'not_started') setStatusFilter('Not Started');
    else if (metric === 'overdue') setMetricFilter('overdue');
    else if (metric === 'due_soon') setMetricFilter('due_soon');
    setActiveTab('tasks');
  };

  const handleSelectAssigneeCard = (userId: number) => {
    setPage(1);
    setAssigneeIdFilter((prev) => (prev === userId ? undefined : userId));
    setActiveTab('tasks');
  };

  const handleQuickStatusChange = async (task: DevelopmentTaskItem, newStatus: string) => {
    // Optimistic update
    const prevTasks = tasks;
    setTasks((cur) => cur.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
    const res = await developmentService.updateTaskStatus(projectId, task.id, newStatus);
    if (res.success && res.data) {
      await refreshEverything();
    } else {
      setTasks(prevTasks);
      setErrorMessage(res.error || 'Failed to update status');
    }
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
    {
      key: 'masters',
      label: 'Manage Masters',
      icon: FolderCog,
      count: modules.filter((m) => !m.isArchived).length,
    },
  ];

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
      return (
        <div className="rounded-2xl bg-[#0E0F14]/95 border border-dashed border-[#27272A] p-10 text-center space-y-3">
          <CheckSquare size={26} className="mx-auto text-zinc-600" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-white">No development work items found</h4>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              {search || moduleIdFilter || statusFilter || priorityFilter || metricFilter || assigneeIdFilter
                ? 'No tasks match your active search or filter criteria.'
                : 'Create your first development task to start tracking modules, deadlines, and team workload.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            {(search || moduleIdFilter || statusFilter || priorityFilter || metricFilter || assigneeIdFilter) && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-3.5 py-2 rounded-xl text-xs font-medium bg-[#161820] hover:bg-[#1E202B] text-zinc-200 border border-[#27272A] cursor-pointer"
              >
                Clear All Filters
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
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {viewMode === 'list' && (
          <DevelopmentListView
            tasks={tasks}
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
        {viewMode === 'card' && (
          <DevelopmentCardView
            tasks={tasks}
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
        {viewMode === 'board' && (
          <DevelopmentBoardView
            tasks={tasks}
            statuses={dashboardData.config.statuses}
            canEditTasks={dashboardData.permissions.canEditTasks}
            onSelectTask={(t) => setSelectedTaskForDrawer(t)}
            onQuickStatusChange={handleQuickStatusChange}
          />
        )}
        {viewMode === 'grouped' && (
          <DevelopmentGroupedView
            tasks={tasks}
            groupBy={groupBy}
            onSelectTask={(t) => setSelectedTaskForDrawer(t)}
          />
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 text-xs text-zinc-400">
            <span className="font-mono">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} items)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg bg-[#0E0F14] border border-[#27272A] disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg bg-[#0E0F14] border border-[#27272A] disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
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
              <span>+ Create Task</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('masters')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-300 bg-[#0E0F14] hover:bg-[#1C1E26] hover:text-white border border-[#27272A] transition-colors cursor-pointer"
          >
            <FolderCog size={14} />
            <span>Manage Masters</span>
          </button>
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
            activeAssigneeFilter={
              typeof assigneeIdFilter === 'number' ? assigneeIdFilter : undefined
            }
            onSelectMetricFilter={handleSelectMetricCard}
            onSelectAssigneeFilter={handleSelectAssigneeCard}
          />

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            <div className="xl:col-span-9 space-y-4">
              <DevelopmentToolbar
                search={search}
                onSearchChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                modules={modules}
                eligibleMembers={dashboardData.eligibleMembers}
                config={dashboardData.config}
                moduleId={moduleIdFilter}
                onModuleIdChange={(id) => {
                  setModuleIdFilter(id);
                  setPage(1);
                }}
                submoduleId={submoduleIdFilter}
                onSubmoduleIdChange={(id) => {
                  setSubmoduleIdFilter(id);
                  setPage(1);
                }}
                assigneeId={assigneeIdFilter}
                onAssigneeIdChange={(val) => {
                  setAssigneeIdFilter(val);
                  setPage(1);
                }}
                priority={priorityFilter}
                onPriorityChange={(val) => {
                  setPriorityFilter(val);
                  setPage(1);
                }}
                status={statusFilter}
                onStatusChange={(val) => {
                  setStatusFilter(val);
                  setPage(1);
                }}
                taskType={taskTypeFilter}
                onTaskTypeChange={(val) => {
                  setTaskTypeFilter(val);
                  setPage(1);
                }}
                metricFilter={metricFilter}
                onMetricFilterChange={(val) => {
                  setMetricFilter(val);
                  setPage(1);
                }}
                startDate={startDateFilter}
                endDate={endDateFilter}
                onDateRangeChange={(s, e) => {
                  setStartDateFilter(s);
                  setEndDateFilter(e);
                  setPage(1);
                }}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                groupBy={groupBy}
                onGroupByChange={setGroupBy}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={(sb, so) => {
                  setSortBy(sb);
                  setSortOrder(so);
                }}
                onClearAllFilters={clearAllFilters}
                onRefresh={refreshEverything}
                canEditTasks={dashboardData.permissions.canEditTasks}
                onCreateTask={() => {
                  setTaskToEdit(null);
                  setIsTaskModalOpen(true);
                }}
              />
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
                onMastersClick={() => setActiveTab('masters')}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <DevelopmentToolbar
            search={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            modules={modules}
            eligibleMembers={dashboardData.eligibleMembers}
            config={dashboardData.config}
            moduleId={moduleIdFilter}
            onModuleIdChange={(id) => {
              setModuleIdFilter(id);
              setPage(1);
            }}
            submoduleId={submoduleIdFilter}
            onSubmoduleIdChange={(id) => {
              setSubmoduleIdFilter(id);
              setPage(1);
            }}
            assigneeId={assigneeIdFilter}
            onAssigneeIdChange={(val) => {
              setAssigneeIdFilter(val);
              setPage(1);
            }}
            priority={priorityFilter}
            onPriorityChange={(val) => {
              setPriorityFilter(val);
              setPage(1);
            }}
            status={statusFilter}
            onStatusChange={(val) => {
              setStatusFilter(val);
              setPage(1);
            }}
            taskType={taskTypeFilter}
            onTaskTypeChange={(val) => {
              setTaskTypeFilter(val);
              setPage(1);
            }}
            metricFilter={metricFilter}
            onMetricFilterChange={(val) => {
              setMetricFilter(val);
              setPage(1);
            }}
            startDate={startDateFilter}
            endDate={endDateFilter}
            onDateRangeChange={(s, e) => {
              setStartDateFilter(s);
              setEndDateFilter(e);
              setPage(1);
            }}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(sb, so) => {
              setSortBy(sb);
              setSortOrder(so);
            }}
            onClearAllFilters={clearAllFilters}
            onRefresh={refreshEverything}
            canEditTasks={dashboardData.permissions.canEditTasks}
            onCreateTask={() => {
              setTaskToEdit(null);
              setIsTaskModalOpen(true);
            }}
          />
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

      {activeTab === 'masters' && (
        <DevelopmentMastersManager
          projectId={projectId}
          modules={modules}
          config={dashboardData.config}
          canManageMasters={dashboardData.permissions.canManageMasters}
          showArchived={showArchivedMasters}
          onToggleShowArchived={setShowArchivedMasters}
          onRefreshAll={refreshEverything}
        />
      )}

      {/* Create / Edit Task Modal */}
      <DevelopmentTaskModal
        isOpen={isTaskModalOpen}
        projectId={projectId}
        taskToEdit={taskToEdit}
        modules={modules}
        eligibleMembers={dashboardData.eligibleMembers}
        config={dashboardData.config}
        canManageMasters={dashboardData.permissions.canManageMasters}
        onClose={() => {
          setIsTaskModalOpen(false);
          setTaskToEdit(null);
        }}
        onSaved={async () => {
          await refreshEverything();
        }}
        onModulesUpdated={async () => {
          const modRes = await developmentService.listModules(projectId, showArchivedMasters);
          if (modRes.success && modRes.data) setModules(modRes.data);
        }}
      />

      {/* Task Detail Drawer */}
      <DevelopmentTaskDrawer
        projectId={projectId}
        task={selectedTaskForDrawer}
        config={dashboardData.config}
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
    </div>
  );
};

