import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownAZ,
  ArrowUpDown,
  ArrowUpZA,
  Calendar,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Flame,
  Folder,
  Kanban,
  Layers,
  LayoutGrid,
  List,
  ListFilter,
  Plus,
  RefreshCw,
  Search,
  User,
  X,
} from 'lucide-react';
import { useAccentTheme } from '../../services/accentTheme.service';
import type {
  DevelopmentModuleMaster,
  DevelopmentProjectConfig,
} from '../../types/development';
import { AnimatedSelect, SelectOption } from '../settings/AnimatedSelect';
import { UserAvatar } from '../common/UserAvatar';

export type DevViewMode = 'list' | 'card' | 'board' | 'calendar';
export type DevGroupByMode =
  | 'none'
  | 'module'
  | 'submodule'
  | 'assignee'
  | 'priority'
  | 'status';

interface DevelopmentToolbarProps {
  search: string;
  onSearchChange: (val: string) => void;
  modules: DevelopmentModuleMaster[];
  config: DevelopmentProjectConfig;
  moduleId?: number;
  onModuleIdChange: (id: number | undefined) => void;
  submoduleId?: number;
  onSubmoduleIdChange?: (id: number | undefined) => void;
  status?: string;
  onStatusChange?: (status: string | undefined) => void;
  priority?: string;
  onPriorityChange?: (priority: string | undefined) => void;
  taskType?: string;
  onTaskTypeChange?: (tt: string | undefined) => void;
  assigneeId?: number | 'unassigned';
  onAssigneeIdChange?: (uid: number | 'unassigned' | undefined) => void;
  eligibleMembers?: Array<{ id: number; name: string }>;
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
  hasActiveFilters: boolean;
  onClearAllFilters: () => void;
  onRefresh: () => void;
  canEditTasks: boolean;
  onCreateTask: () => void;
}

export const DevelopmentToolbar: React.FC<DevelopmentToolbarProps> = ({
  search,
  onSearchChange,
  modules,
  config,
  moduleId,
  onModuleIdChange,
  submoduleId,
  onSubmoduleIdChange,
  status,
  onStatusChange,
  priority,
  onPriorityChange,
  taskType,
  onTaskTypeChange,
  assigneeId,
  onAssigneeIdChange,
  eligibleMembers = [],
  viewMode,
  onViewModeChange,
  groupBy,
  onGroupByChange,
  sortBy,
  sortOrder,
  onSortChange,
  hasActiveFilters,
  onClearAllFilters,
  onRefresh,
  canEditTasks,
  onCreateTask,
}) => {
  const { accentColor } = useAccentTheme();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortGroupOpen, setIsSortGroupOpen] = useState(false);
  const [isGroupByHovered, setIsGroupByHovered] = useState(false);

  const filterRef = useRef<HTMLDivElement>(null);
  const sortGroupRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
      if (sortGroupRef.current && !sortGroupRef.current.contains(e.target as Node)) {
        setIsSortGroupOpen(false);
        setIsGroupByHovered(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeModules = useMemo(
    () => modules.filter((m) => !m.isArchived),
    [modules]
  );

  const currentModule = activeModules.find((m) => m.id === moduleId);
  const activeSubmodules = useMemo(
    () => (currentModule?.submodules || []).filter((s) => !s.isArchived),
    [currentModule]
  );

  // Select Options formatted for AnimatedSelect
  const moduleSelectOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All Modules' },
      ...activeModules.map((m) => ({
        value: String(m.id),
        label: `${m.name} (${m.taskCount})`,
      })),
    ],
    [activeModules]
  );

  const submoduleSelectOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All Submodules' },
      ...activeSubmodules.map((s) => ({
        value: String(s.id),
        label: s.name,
      })),
    ],
    [activeSubmodules]
  );

  const statusSelectOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All Statuses' },
      ...config.statuses.map((s) => ({ value: s, label: s })),
    ],
    [config.statuses]
  );

  const prioritySelectOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All Priorities' },
      ...(config.priorities || ['Critical', 'High', 'Medium', 'Low']).map((p) => ({
        value: p,
        label: p,
      })),
    ],
    [config.priorities]
  );

  const taskTypeSelectOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All Types' },
      ...(config.taskTypes || ['Development', 'Research']).map((tt) => ({
        value: tt,
        label: tt,
      })),
    ],
    [config.taskTypes]
  );

  const assigneeSelectOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All Assignees' },
      { value: 'unassigned', label: 'Unassigned' },
      ...eligibleMembers.map((m) => ({
        value: String(m.id),
        label: m.name,
        icon: <UserAvatar user={m} size="xs" />,
      })),
    ],
    [eligibleMembers]
  );

  // Active filter pills list
  const activeFilterPills = useMemo(() => {
    const list: Array<{ key: string; label: string; onRemove: () => void }> = [];
    if (moduleId) {
      const mod = activeModules.find((m) => m.id === moduleId);
      list.push({
        key: 'module',
        label: `Module: ${mod?.name || moduleId}`,
        onRemove: () => {
          onModuleIdChange(undefined);
          onSubmoduleIdChange?.(undefined);
        },
      });
    }
    if (submoduleId) {
      const sub = activeSubmodules.find((s) => s.id === submoduleId);
      list.push({
        key: 'submodule',
        label: `Submodule: ${sub?.name || submoduleId}`,
        onRemove: () => onSubmoduleIdChange?.(undefined),
      });
    }
    if (status) {
      list.push({
        key: 'status',
        label: `Status: ${status}`,
        onRemove: () => onStatusChange?.(undefined),
      });
    }
    if (priority) {
      list.push({
        key: 'priority',
        label: `Priority: ${priority}`,
        onRemove: () => onPriorityChange?.(undefined),
      });
    }
    if (taskType) {
      list.push({
        key: 'taskType',
        label: `Type: ${taskType}`,
        onRemove: () => onTaskTypeChange?.(undefined),
      });
    }
    if (assigneeId !== undefined) {
      if (assigneeId === 'unassigned') {
        list.push({
          key: 'assignee',
          label: 'Assignee: Unassigned',
          onRemove: () => onAssigneeIdChange?.(undefined),
        });
      } else {
        const member = eligibleMembers.find((m) => m.id === assigneeId);
        list.push({
          key: 'assignee',
          label: `Assignee: ${member?.name || assigneeId}`,
          onRemove: () => onAssigneeIdChange?.(undefined),
        });
      }
    }
    return list;
  }, [
    moduleId,
    submoduleId,
    status,
    priority,
    taskType,
    assigneeId,
    activeModules,
    activeSubmodules,
    eligibleMembers,
    onModuleIdChange,
    onSubmoduleIdChange,
    onStatusChange,
    onPriorityChange,
    onTaskTypeChange,
    onAssigneeIdChange,
  ]);

  const activeFilterCount = activeFilterPills.length;

  const SORT_OPTIONS: {
    sb: 'dueDate' | 'priority' | 'createdAt' | 'updatedAt' | 'title';
    so: 'asc' | 'desc';
    label: string;
    sublabel: string;
    icon: React.ReactNode;
  }[] = [
    {
      sb: 'updatedAt',
      so: 'desc',
      label: 'Recently Updated',
      sublabel: 'Most recent first',
      icon: <Clock size={13} className="text-emerald-400" />,
    },
    {
      sb: 'dueDate',
      so: 'asc',
      label: 'Due Date (Earliest)',
      sublabel: 'Urgent deadlines',
      icon: <Calendar size={13} className="text-cyan-400" />,
    },
    {
      sb: 'dueDate',
      so: 'desc',
      label: 'Due Date (Latest)',
      sublabel: 'Furthest deadline',
      icon: <Calendar size={13} className="text-zinc-400" />,
    },
    {
      sb: 'priority',
      so: 'desc',
      label: 'Priority (Urgent First)',
      sublabel: 'Critical → Low',
      icon: <Flame size={13} className="text-rose-400" />,
    },
    {
      sb: 'priority',
      so: 'asc',
      label: 'Priority (Lowest First)',
      sublabel: 'Low → Critical',
      icon: <Flame size={13} className="text-amber-400" />,
    },
    {
      sb: 'title',
      so: 'asc',
      label: 'Title (A → Z)',
      sublabel: 'Alphabetical order',
      icon: <ArrowDownAZ size={13} className="text-sky-400" />,
    },
    {
      sb: 'title',
      so: 'desc',
      label: 'Title (Z → A)',
      sublabel: 'Reverse alphabetical',
      icon: <ArrowUpZA size={13} className="text-indigo-400" />,
    },
    {
      sb: 'createdAt',
      so: 'desc',
      label: 'Newest Created',
      sublabel: 'Latest first',
      icon: <Clock size={13} className="text-emerald-400" />,
    },
  ];

  const GROUP_OPTIONS: {
    key: DevGroupByMode;
    shortLabel: string;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
  }[] = [
    {
      key: 'none',
      shortLabel: 'None',
      label: 'No Grouping',
      sublabel: 'Flat view',
      icon: <List size={13} className="text-zinc-400" />,
    },
    {
      key: 'module',
      shortLabel: 'Module',
      label: 'By Module',
      sublabel: 'Parent categories',
      icon: <Folder size={13} className="text-indigo-400" />,
    },
    {
      key: 'submodule',
      shortLabel: 'Submodule',
      label: 'By Submodule',
      sublabel: 'Module slices',
      icon: <Layers size={13} className="text-sky-400" />,
    },
    {
      key: 'assignee',
      shortLabel: 'Assignee',
      label: 'By Assignee',
      sublabel: 'Team members',
      icon: <User size={13} className="text-emerald-400" />,
    },
    {
      key: 'priority',
      shortLabel: 'Priority',
      label: 'By Priority',
      sublabel: 'Urgency level',
      icon: <Flame size={13} className="text-amber-400" />,
    },
    {
      key: 'status',
      shortLabel: 'Status',
      label: 'By Status',
      sublabel: 'Workflow stage',
      icon: <Clock size={13} className="text-purple-400" />,
    },
  ];

  const isSortGroupModified = groupBy !== 'none' || sortBy !== 'createdAt' || sortOrder !== 'desc';
  const activeGroupOption = GROUP_OPTIONS.find((g) => g.key === groupBy) || GROUP_OPTIONS[0];

  return (
    <div className="rounded-xl bg-[#0E0F14]/95 border border-[#27272A] px-2.5 py-2 relative z-[60] space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Left: Search input */}
        <div className="flex-1 min-w-[200px] sm:min-w-[280px] relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={`Search ${config.taskPrefix}-001, title, text...`}
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

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* ── 1. ICON-ONLY FILTER BUTTON ────────────────────────────────── */}
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
                  : 'bg-[#111216] border-[#27272A] text-zinc-300 hover:text-white hover:border-zinc-600'
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

            {/* Filter Popover Dropdown (Zero horizontal scrollbar with AnimatedSelect) */}
            <AnimatePresence>
              {isFilterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ duration: 0.16 }}
                  className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-[320px] sm:w-[380px] rounded-2xl bg-[#12141C] border border-[#27272A] shadow-2xl z-50 overflow-hidden text-xs"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272A] bg-[#161824]">
                    <div className="flex items-center gap-2">
                      <ListFilter size={14} style={{ color: accentColor }} />
                      <span className="font-semibold text-white">Filter Tasks</span>
                      {activeFilterCount > 0 && (
                        <span
                          className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold text-white shadow-sm"
                          style={{ backgroundColor: accentColor }}
                        >
                          {activeFilterCount} active
                        </span>
                      )}
                    </div>
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={onClearAllFilters}
                        className="text-[11px] font-mono text-zinc-400 hover:text-white underline cursor-pointer"
                      >
                        Reset all
                      </button>
                    )}
                  </div>

                  <div className="p-4 space-y-3 max-h-[62vh] overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-zinc-700">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">Module</label>
                      <AnimatedSelect
                        options={moduleSelectOptions}
                        value={moduleId ? String(moduleId) : ''}
                        onChange={(val) => {
                          onModuleIdChange(val ? parseInt(val, 10) : undefined);
                          onSubmoduleIdChange?.(undefined);
                        }}
                        placeholder="All Modules"
                        dropdownMinWidth="w-full"
                        accentColor={accentColor}
                      />
                    </div>

                    {moduleId && activeSubmodules.length > 0 && onSubmoduleIdChange && (
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-400 mb-1">Submodule</label>
                        <AnimatedSelect
                          options={submoduleSelectOptions}
                          value={submoduleId ? String(submoduleId) : ''}
                          onChange={(val) => onSubmoduleIdChange(val ? parseInt(val, 10) : undefined)}
                          placeholder="All Submodules"
                          dropdownMinWidth="w-full"
                          accentColor={accentColor}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-400 mb-1">Status</label>
                        <AnimatedSelect
                          options={statusSelectOptions}
                          value={status || ''}
                          onChange={(val) => onStatusChange?.(val || undefined)}
                          placeholder="All Statuses"
                          dropdownMinWidth="w-full"
                          accentColor={accentColor}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-zinc-400 mb-1">Priority</label>
                        <AnimatedSelect
                          options={prioritySelectOptions}
                          value={priority || ''}
                          onChange={(val) => onPriorityChange?.(val || undefined)}
                          placeholder="All Priorities"
                          dropdownMinWidth="w-full"
                          dropdownAlign="right"
                          accentColor={accentColor}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-400 mb-1">Task Type</label>
                        <AnimatedSelect
                          options={taskTypeSelectOptions}
                          value={taskType || ''}
                          onChange={(val) => onTaskTypeChange?.(val || undefined)}
                          placeholder="All Types"
                          dropdownMinWidth="w-full"
                          accentColor={accentColor}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-zinc-400 mb-1">Assignee</label>
                        <AnimatedSelect
                          options={assigneeSelectOptions}
                          value={assigneeId ? String(assigneeId) : ''}
                          onChange={(val) =>
                            onAssigneeIdChange?.(
                              val === 'unassigned' ? 'unassigned' : val ? parseInt(val, 10) : undefined
                            )
                          }
                          placeholder="All Assignees"
                          dropdownMinWidth="w-full"
                          dropdownAlign="right"
                          accentColor={accentColor}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="px-4 py-2.5 border-t border-[#27272A] bg-[#161824] flex items-center justify-end">
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

          {/* ── 2. ICON-ONLY SORT & GROUP BUTTON (WITH EXPANDABLE SUBMENU FLYOUT) ── */}
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
                  : 'bg-[#111216] border-[#27272A] text-zinc-300 hover:text-white hover:border-zinc-600'
              }`}
            >
              <ArrowUpDown size={15} style={isSortGroupModified ? { color: accentColor } : undefined} />
              {isSortGroupModified && (
                <span
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-[#111216] shadow-sm"
                  style={{ backgroundColor: accentColor }}
                />
              )}
            </button>

            <AnimatePresence>
              {isSortGroupOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ duration: 0.16 }}
                  className="absolute right-0 top-full mt-2 w-64 max-h-[calc(100vh-120px)] overflow-visible rounded-2xl bg-[#14161C]/98 backdrop-blur-xl border border-[#27272A] p-2 shadow-2xl z-50 space-y-1.5 text-left"
                >
                  {/* Section 1: Sort By (with icons) */}
                  <div>
                    <div className="px-2.5 py-1 text-[9.5px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                      <span>Sort By</span>
                      <Calendar size={11} className="text-zinc-500" />
                    </div>
                    <div className="space-y-0.5">
                      {SORT_OPTIONS.map((opt) => {
                        const isSelected = sortBy === opt.sb && sortOrder === opt.so;
                        return (
                          <button
                            key={`${opt.sb}-${opt.so}`}
                            type="button"
                            onClick={() => {
                              onSortChange(opt.sb, opt.so);
                            }}
                            className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-white/10 text-white font-medium border border-white/10 shadow-sm'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="shrink-0">{opt.icon}</span>
                              <div className="text-left truncate">
                                <div className="truncate font-medium text-white">{opt.label}</div>
                                <div className="text-[10px] text-zinc-500">{opt.sublabel}</div>
                              </div>
                            </div>
                            {isSelected && (
                              <Check
                                size={13}
                                className="shrink-0 ml-1"
                                style={{ color: accentColor }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-[#27272A]/70" />

                  {/* Section 2: Group By (Submenu Flyout on Hover / Click) */}
                  <div
                    className="relative"
                    onMouseEnter={() => setIsGroupByHovered(true)}
                    onMouseLeave={() => setIsGroupByHovered(false)}
                  >
                    <div className="px-2.5 py-1 text-[9.5px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                      <span>Group By</span>
                      <ChevronRight size={11} className="text-zinc-500" />
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsGroupByHovered((prev) => !prev)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                        groupBy !== 'none'
                          ? 'bg-purple-500/15 border border-purple-500/40 text-purple-200'
                          : 'text-zinc-300 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0">{activeGroupOption.icon}</span>
                        <div className="truncate">
                          <span className="block text-xs font-medium text-white truncate">
                            {activeGroupOption.label}
                          </span>
                          <span className="block text-[10px] font-mono text-zinc-500">
                            {activeGroupOption.sublabel}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={13} className="text-zinc-400 shrink-0 ml-1" />
                    </button>

                    {/* Flyout Submenu */}
                    <AnimatePresence>
                      {isGroupByHovered && (
                        <motion.div
                          initial={{ opacity: 0, x: 6, scale: 0.97 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: 6, scale: 0.97 }}
                          transition={{ duration: 0.14 }}
                          className="absolute right-full bottom-0 pr-2 z-[9990]"
                        >
                          <div className="w-60 max-h-[75vh] overflow-y-auto rounded-2xl bg-[#14161C]/98 backdrop-blur-xl border border-[#27272A] p-2 shadow-2xl space-y-1 text-left">
                            <div className="px-2.5 py-1 text-[9.5px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                              <span>Group Options</span>
                              <Folder size={11} className="text-zinc-500" />
                            </div>
                            {GROUP_OPTIONS.map((g) => {
                              const isSelected = groupBy === g.key;
                              return (
                                <button
                                  key={g.key}
                                  type="button"
                                  onClick={() => {
                                    onGroupByChange(g.key);
                                    setIsGroupByHovered(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-white/10 text-white font-medium border border-white/10 shadow-sm'
                                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="shrink-0">{g.icon}</span>
                                    <div className="truncate">
                                      <span className="block text-xs text-zinc-200 truncate">{g.label}</span>
                                      <span className="block text-[10px] font-mono text-zinc-500">{g.sublabel}</span>
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <Check
                                      size={13}
                                      className="shrink-0 ml-1"
                                      style={{ color: accentColor }}
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Section 3: Reset to Default Button */}
                  <div className="pt-2 border-t border-[#27272A]/70">
                    <button
                      type="button"
                      onClick={() => {
                        onGroupByChange('none');
                        onSortChange('createdAt', 'desc');
                        setIsSortGroupOpen(false);
                        setIsGroupByHovered(false);
                      }}
                      className="w-full py-1.5 px-2 rounded-lg text-center text-[11px] font-mono text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
                    >
                      Reset to Default
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* View mode switcher */}
          <div className="flex items-center p-0.5 rounded-xl bg-[#161820] border border-[#27272A]">
            <button
              type="button"
              onClick={() => onViewModeChange('list')}
              title="List View"
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#27272A] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <List size={14} />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('card')}
              title="Card View"
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                viewMode === 'card'
                  ? 'bg-[#27272A] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('board')}
              title="Kanban Board View"
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                viewMode === 'board'
                  ? 'bg-[#27272A] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Kanban size={14} />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('calendar')}
              title="Calendar View"
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-[#27272A] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <CalendarRange size={14} />
            </button>
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh tasks"
            className="p-2 rounded-xl border border-[#27272A] bg-[#111216] text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors cursor-pointer"
          >
            <RefreshCw size={13} />
          </button>

          {/* Create Task button */}
          {canEditTasks && (
            <button
              type="button"
              onClick={onCreateTask}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-xs text-white shadow-lg transition-all cursor-pointer hover:brightness-110"
              style={{
                backgroundColor: accentColor,
                boxShadow: `0 4px 14px -3px ${accentColor}66`,
              }}
            >
              <Plus size={14} />
              <span>Create Task</span>
              <span className="text-[10px] font-mono opacity-80 pl-0.5">⇧T</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Filter Pills Strip */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#27272A]/50">
          <span className="text-[10px] font-mono uppercase text-zinc-500 mr-0.5">Filters:</span>
          {activeFilterPills.map((pill) => (
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
            onClick={onClearAllFilters}
            className="text-[11px] text-zinc-400 hover:text-white underline cursor-pointer ml-1"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};
