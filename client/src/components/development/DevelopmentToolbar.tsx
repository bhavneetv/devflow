import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownUp,
  Filter,
  Kanban,
  Layers,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { AnimatedSelect } from '../settings/AnimatedSelect';
import { CustomDatePicker } from '../settings/CustomDatePicker';
import { useAccentTheme } from '../../services/accentTheme.service';
import type {
  DevUser,
  DevelopmentModuleMaster,
  DevelopmentProjectConfig,
} from '../../types/development';
import { DEV_PRIORITIES } from '../../types/development';

export type DevViewMode = 'list' | 'card' | 'board' | 'grouped';
export type DevGroupByMode = 'module' | 'submodule' | 'assignee' | 'priority' | 'status';

interface DevelopmentToolbarProps {
  search: string;
  onSearchChange: (val: string) => void;
  modules: DevelopmentModuleMaster[];
  eligibleMembers: DevUser[];
  config: DevelopmentProjectConfig;
  moduleId?: number;
  onModuleIdChange: (id: number | undefined) => void;
  submoduleId?: number;
  onSubmoduleIdChange: (id: number | undefined) => void;
  assigneeId?: number | 'unassigned';
  onAssigneeIdChange: (val: number | 'unassigned' | undefined) => void;
  priority?: string;
  onPriorityChange: (val: string | undefined) => void;
  status?: string;
  onStatusChange: (val: string | undefined) => void;
  taskType?: string;
  onTaskTypeChange: (val: string | undefined) => void;
  metricFilter?: 'overdue' | 'due_soon';
  onMetricFilterChange: (val: 'overdue' | 'due_soon' | undefined) => void;
  startDate: string;
  endDate: string;
  onDateRangeChange: (start: string, end: string) => void;
  viewMode: DevViewMode;
  onViewModeChange: (mode: DevViewMode) => void;
  groupBy: DevGroupByMode;
  onGroupByChange: (g: DevGroupByMode) => void;
  sortBy: 'dueDate' | 'priority' | 'createdAt' | 'updatedAt' | 'title';
  sortOrder: 'asc' | 'desc';
  onSortChange: (
    sb: 'dueDate' | 'priority' | 'createdAt' | 'updatedAt' | 'title',
    so: 'asc' | 'desc'
  ) => void;
  onClearAllFilters: () => void;
  onRefresh: () => void;
  canEditTasks: boolean;
  onCreateTask: () => void;
}

export const DevelopmentToolbar: React.FC<DevelopmentToolbarProps> = ({
  search,
  onSearchChange,
  modules,
  eligibleMembers,
  config,
  moduleId,
  onModuleIdChange,
  submoduleId,
  onSubmoduleIdChange,
  assigneeId,
  onAssigneeIdChange,
  priority,
  onPriorityChange,
  status,
  onStatusChange,
  taskType,
  onTaskTypeChange,
  metricFilter,
  onMetricFilterChange,
  startDate,
  endDate,
  onDateRangeChange,
  viewMode,
  onViewModeChange,
  groupBy,
  onGroupByChange,
  sortBy,
  sortOrder,
  onSortChange,
  onClearAllFilters,
  onRefresh,
  canEditTasks,
  onCreateTask,
}) => {
  const { accentColor } = useAccentTheme();
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    if (filterOpen) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [filterOpen]);

  const activeModules = modules.filter((m) => !m.isArchived);
  const selectedModule = modules.find((m) => m.id === moduleId);
  const availableSubmodules = selectedModule
    ? selectedModule.submodules.filter((s) => !s.isArchived)
    : [];

  const activeFilterCount = [
    moduleId,
    submoduleId,
    assigneeId,
    priority,
    status,
    taskType,
    metricFilter,
    startDate,
    endDate,
    search.trim() ? 'search' : undefined,
  ].filter(Boolean).length;

  const VIEW_OPTIONS: { id: DevViewMode; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'list', label: 'List', icon: List },
    { id: 'card', label: 'Cards', icon: LayoutGrid },
    { id: 'board', label: 'Board', icon: Kanban },
    { id: 'grouped', label: 'Grouped', icon: Layers },
  ];

  return (
    <div className="rounded-xl bg-[#0E0F14]/95 border border-[#27272A] px-2.5 py-2 relative z-[60] flex flex-wrap items-center justify-between gap-2">
      {/* Left: Search & Primary Module Filter */}
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={`Search ${config.taskPrefix}-001, title, description...`}
            className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-[#161820] border border-[#27272A] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Module filter */}
        <div className="w-44">
          <AnimatedSelect
            value={moduleId ? String(moduleId) : ''}
            onChange={(val) => {
              const id = val ? parseInt(val, 10) : undefined;
              onModuleIdChange(id);
              onSubmoduleIdChange(undefined);
            }}
            accentColor={accentColor}
            dropdownMinWidth="w-56"
            placeholder="All Modules"
            options={[
              { value: '', label: 'All Modules' },
              ...activeModules.map((m) => ({
                value: String(m.id),
                label: m.name,
                sublabel: `${m.taskCount} tasks`,
              })),
            ]}
          />
        </div>

        {/* Submodule filter (when module selected) */}
        {moduleId && (
          <div className="w-44">
            <AnimatedSelect
              value={submoduleId ? String(submoduleId) : ''}
              onChange={(val) => onSubmoduleIdChange(val ? parseInt(val, 10) : undefined)}
              accentColor={accentColor}
              dropdownMinWidth="w-56"
              placeholder="All Submodules"
              options={[
                { value: '', label: 'All Submodules' },
                ...availableSubmodules.map((s) => ({
                  value: String(s.id),
                  label: s.name,
                  sublabel: `${s.taskCount} tasks`,
                })),
              ]}
            />
          </div>
        )}

        {/* Popover Filter & Sort Button */}
        <div className="relative" ref={filterRef}>
          <button
            type="button"
            onClick={() => setFilterOpen((p) => !p)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#161820] hover:bg-[#1C1E28] border text-zinc-200 transition-colors cursor-pointer"
            style={{
              borderColor: activeFilterCount > 0 ? accentColor : '#27272A',
            }}
          >
            <Filter size={13} style={{ color: activeFilterCount > 0 ? accentColor : undefined }} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span
                className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold text-[#0A0B10]"
                style={{ backgroundColor: accentColor }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {filterOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.14 }}
                className="absolute left-0 top-full mt-2 w-[340px] sm:w-[400px] rounded-2xl bg-[#111319] border border-[#27272A] shadow-2xl p-4 z-[9980] space-y-3.5"
              >
                <div className="flex items-center justify-between pb-2 border-b border-[#27272A]">
                  <span className="text-xs font-semibold text-white">Filter & Sort Work Items</span>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        onClearAllFilters();
                        setFilterOpen(false);
                      }}
                      className="text-[11px] font-medium text-red-400 hover:underline cursor-pointer"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase text-zinc-400">Status</label>
                    <AnimatedSelect
                      value={status || ''}
                      onChange={(v) => onStatusChange(v || undefined)}
                      accentColor={accentColor}
                      dropdownMinWidth="w-44"
                      options={[
                        { value: '', label: 'All Statuses' },
                        ...config.statuses.map((s) => ({ value: s, label: s })),
                      ]}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase text-zinc-400">Priority</label>
                    <AnimatedSelect
                      value={priority || ''}
                      onChange={(v) => onPriorityChange(v || undefined)}
                      accentColor={accentColor}
                      dropdownMinWidth="w-44"
                      options={[
                        { value: '', label: 'All Priorities' },
                        ...DEV_PRIORITIES.map((p) => ({ value: p, label: p })),
                      ]}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase text-zinc-400">Assignee</label>
                    <AnimatedSelect
                      value={assigneeId !== undefined ? String(assigneeId) : ''}
                      onChange={(v) => {
                        if (!v) onAssigneeIdChange(undefined);
                        else if (v === 'unassigned') onAssigneeIdChange('unassigned');
                        else onAssigneeIdChange(parseInt(v, 10));
                      }}
                      accentColor={accentColor}
                      dropdownMinWidth="w-48"
                      options={[
                        { value: '', label: 'Any Assignee' },
                        { value: 'unassigned', label: 'Unassigned Only' },
                        ...eligibleMembers.map((m) => ({
                          value: String(m.id),
                          label: m.name,
                        })),
                      ]}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase text-zinc-400">Type</label>
                    <AnimatedSelect
                      value={taskType || ''}
                      onChange={(v) => onTaskTypeChange(v || undefined)}
                      accentColor={accentColor}
                      dropdownMinWidth="w-44"
                      options={[
                        { value: '', label: 'All Types' },
                        ...config.taskTypes.map((tt) => ({ value: tt, label: tt })),
                      ]}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase text-zinc-400">Due From</label>
                    <CustomDatePicker
                      value={startDate}
                      onChange={(v) => onDateRangeChange(v, endDate)}
                      placeholder="Start date"
                      presetMode="none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase text-zinc-400">Due To</label>
                    <CustomDatePicker
                      value={endDate}
                      onChange={(v) => onDateRangeChange(startDate, v)}
                      placeholder="End date"
                      presetMode="none"
                      align="right"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-[#27272A] space-y-1.5">
                  <label className="text-[10px] font-mono uppercase text-zinc-400 flex items-center gap-1">
                    <ArrowDownUp size={10} />
                    <span>Sort By</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <AnimatedSelect
                        value={sortBy}
                        onChange={(v) =>
                          onSortChange(
                            v as 'dueDate' | 'priority' | 'createdAt' | 'updatedAt' | 'title',
                            sortOrder
                          )
                        }
                        accentColor={accentColor}
                        dropdownMinWidth="w-44"
                        options={[
                          { value: 'createdAt', label: 'Created Date' },
                          { value: 'dueDate', label: 'Due Date' },
                          { value: 'priority', label: 'Priority' },
                          { value: 'updatedAt', label: 'Last Updated' },
                          { value: 'title', label: 'Title (A–Z)' },
                        ]}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onSortChange(sortBy, sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="px-3 py-1.5 rounded-lg bg-[#161820] border border-[#27272A] text-xs font-mono text-zinc-200 hover:bg-[#1E202B] cursor-pointer"
                    >
                      {sortOrder === 'asc' ? 'ASC ↑' : 'DESC ↓'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Active Metric Chip (e.g. Overdue / Due Soon) */}
        {metricFilter && (
          <button
            type="button"
            onClick={() => onMetricFilterChange(undefined)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-500/15 border border-amber-500/35 text-amber-300 cursor-pointer"
          >
            <span>{metricFilter === 'overdue' ? 'Filter: Overdue' : 'Filter: Due Soon (7d)'}</span>
            <X size={11} />
          </button>
        )}

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={onClearAllFilters}
            className="text-[11px] text-zinc-400 hover:text-white underline cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>

      {/* Right: Group By (if Grouped), View Switcher, Refresh, + Create Task */}
      <div className="flex flex-wrap items-center gap-2">
        {viewMode === 'grouped' && (
          <div className="w-40">
            <AnimatedSelect
              value={groupBy}
              onChange={(v) => onGroupByChange(v as DevGroupByMode)}
              accentColor={accentColor}
              dropdownMinWidth="w-44"
              dropdownAlign="right"
              options={[
                { value: 'module', label: 'Group: Module' },
                { value: 'submodule', label: 'Group: Submodule' },
                { value: 'assignee', label: 'Group: Assignee' },
                { value: 'priority', label: 'Group: Priority' },
                { value: 'status', label: 'Group: Status' },
              ]}
            />
          </div>
        )}

        {/* View Switcher */}
        <div className="inline-flex items-center p-0.5 rounded-lg bg-[#0A0B0F] border border-[#27272A]">
          {VIEW_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = viewMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onViewModeChange(opt.id)}
                className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer"
                style={{ color: active ? '#FFFFFF' : '#71717A' }}
              >
                {active && (
                  <motion.span
                    layoutId="devViewModePill"
                    className="absolute inset-0 rounded-md bg-[#1C1E26] border border-[#2E313D]"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  />
                )}
                <Icon size={12} className="relative z-10" />
                <span className="relative z-10 hidden sm:inline">{opt.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onRefresh}
          title="Refresh work items"
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-[#161820] hover:bg-[#1E202B] border border-[#27272A] transition-colors cursor-pointer"
        >
          <RefreshCw size={14} />
        </button>

        {canEditTasks && (
          <button
            type="button"
            onClick={onCreateTask}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0A0B10] transition-all cursor-pointer hover:brightness-110"
            style={{ backgroundColor: accentColor }}
          >
            <Plus size={14} />
            <span>Create Task</span>
          </button>
        )}
      </div>
    </div>
  );
};

