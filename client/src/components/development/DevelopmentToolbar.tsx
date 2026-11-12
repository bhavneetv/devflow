import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownAZ,
  ArrowUpZA,
  Calendar,
  CalendarRange,
  Check,
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
import { AnimatedSelect } from '../settings/AnimatedSelect';
import { useAccentTheme } from '../../services/accentTheme.service';
import type {
  DevelopmentModuleMaster,
  DevelopmentProjectConfig,
} from '../../types/development';

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
  const [isGroupByHovered, setIsGroupByHovered] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
        setIsGroupByHovered(false);
      }
    };
    if (isFilterOpen) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isFilterOpen]);

  const activeModules = modules.filter((m) => !m.isArchived);

  const VIEW_MODES: { id: DevViewMode; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'list', label: 'List View', icon: List },
    { id: 'card', label: 'Card View', icon: LayoutGrid },
    { id: 'board', label: 'Board View', icon: Kanban },
    { id: 'calendar', label: 'Calendar View', icon: Calendar },
  ];

  const SORT_OPTIONS: {
    sb: 'priority' | 'dueDate' | 'title' | 'createdAt' | 'updatedAt';
    so: 'asc' | 'desc';
    label: string;
    sublabel: string;
    icon: React.ReactNode;
  }[] = [
    {
      sb: 'priority',
      so: 'desc',
      label: 'Priority (Urgent First)',
      sublabel: 'Critical → Low',
      icon: <Flame size={13} className="text-rose-400" />,
    },
    {
      sb: 'dueDate',
      so: 'asc',
      label: 'Due Date (Earliest)',
      sublabel: 'Nearest deadline',
      icon: <CalendarRange size={13} className="text-amber-400" />,
    },
    {
      sb: 'dueDate',
      so: 'desc',
      label: 'Due Date (Latest)',
      sublabel: 'Furthest deadline',
      icon: <CalendarRange size={13} className="text-zinc-400" />,
    },
    {
      sb: 'title',
      so: 'asc',
      label: 'Title / Text (A → Z)',
      sublabel: 'Alphabetical',
      icon: <ArrowDownAZ size={13} className="text-sky-400" />,
    },
    {
      sb: 'title',
      so: 'desc',
      label: 'Title / Text (Z → A)',
      sublabel: 'Reverse text',
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
      label: 'None',
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

  const activeGroupMeta = GROUP_OPTIONS.find((g) => g.key === groupBy) || GROUP_OPTIONS[0];
  const isMenuModified =
    groupBy !== 'none' || sortBy !== 'createdAt' || sortOrder !== 'desc' || hasActiveFilters;

  return (
    <div className="rounded-xl bg-[#0E0F14]/95 border border-[#27272A] px-2.5 py-2 relative z-[60] flex flex-wrap items-center justify-between gap-2">
      {/* Left: Search & All Modules Filter */}
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
        <div className="relative flex-1 min-w-[190px] max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
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

        {/* All Modules Filter */}
        <div className="w-48">
          <AnimatedSelect
            value={moduleId ? String(moduleId) : ''}
            onChange={(val) => onModuleIdChange(val ? parseInt(val, 10) : undefined)}
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

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearAllFilters}
            className="text-[11px] text-zinc-400 hover:text-white underline cursor-pointer px-1"
          >
            Reset
          </button>
        )}
      </div>

      {/* Right: 4 Icon-Only Modes (List, Cards, Board, Calendar) + ListFilter Icon Button + Refresh + Create */}
      <div className="flex items-center gap-2 shrink-0">
        {/* 4 View Switcher Icons Only */}
        <div className="inline-flex items-center p-0.5 rounded-xl bg-[#0A0B0F] border border-[#27272A]">
          {VIEW_MODES.map((mode) => {
            const Icon = mode.icon;
            const active = viewMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                title={mode.label}
                aria-label={mode.label}
                onClick={() => onViewModeChange(mode.id)}
                className="relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                style={{ color: active ? '#FFFFFF' : '#71717A' }}
              >
                {active && (
                  <motion.span
                    layoutId="devIconViewModePill"
                    className="absolute inset-0 rounded-lg bg-[#1C1E26] border border-[#2E313D]"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  />
                )}
                <Icon size={14} className="relative z-10" />
              </button>
            );
          })}
        </div>

        {/* Custom Made 3-Line Icon Filter Button (Sort + Group Logic) */}
        <div ref={filterRef} className="relative">
          <button
            type="button"
            title="Sort & Group options"
            aria-label="Sort & Group options"
            onClick={() => {
              setIsFilterOpen((p) => {
                if (p) setIsGroupByHovered(false);
                return !p;
              });
            }}
            className="relative w-9 h-9 rounded-xl bg-[#111216] border border-[#27272A] hover:border-zinc-500 text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <ListFilter
              size={15}
              style={isMenuModified ? { color: accentColor } : undefined}
            />
            {isMenuModified && (
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-[#111216]"
                style={{ backgroundColor: accentColor }}
              />
            )}
          </button>

          <AnimatePresence>
            {isFilterOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 4, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 top-full mt-1.5 w-68 rounded-2xl bg-[#14161C]/98 backdrop-blur-xl border border-[#27272A] p-2 shadow-2xl z-[9980] space-y-1.5"
              >
                {/* Section: Sort By */}
                <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                  <span>Sort by</span>
                  <Calendar size={11} className="text-zinc-500" />
                </div>
                <div className="space-y-0.5">
                  {SORT_OPTIONS.map((opt) => {
                    const isSelected = sortBy === opt.sb && sortOrder === opt.so;
                    return (
                      <motion.button
                        key={`${opt.sb}-${opt.so}`}
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          onSortChange(opt.sb, opt.so);
                          setIsFilterOpen(false);
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

                {/* Section: Group by with Hover/Click Submenu Flyout */}
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

                  {/* Submenu Flyout — aligned bottom-0 so options expand upward and never clip below viewport */}
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
                                  onGroupByChange(grp.key);
                                  setIsFilterOpen(false);
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

                {/* Reset button always at the bottom */}
                <div className="pt-1.5 border-t border-[#27272A]/80">
                  <button
                    type="button"
                    onClick={() => {
                      onGroupByChange('none');
                      onSortChange('createdAt', 'desc');
                      onClearAllFilters();
                      setIsFilterOpen(false);
                      setIsGroupByHovered(false);
                    }}
                    className={`w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-mono transition-colors cursor-pointer group ${
                      isMenuModified
                        ? 'text-zinc-200 hover:text-white hover:bg-white/[0.07]'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
                    }`}
                  >
                    <RefreshCw
                      size={11}
                      className="transition-transform group-hover:rotate-180 duration-300"
                    />
                    <span>Reset filters & sort</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          title="Refresh work items"
          className="w-9 h-9 rounded-xl text-zinc-400 hover:text-white bg-[#161820] hover:bg-[#1E202B] border border-[#27272A] flex items-center justify-center transition-colors cursor-pointer"
        >
          <RefreshCw size={14} />
        </button>

        {canEditTasks && (
          <button
            type="button"
            onClick={onCreateTask}
            title="Create Task (Shift+T)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 h-9 rounded-xl text-xs font-semibold text-[#0A0B10] transition-all cursor-pointer hover:brightness-110"
            style={{ backgroundColor: accentColor }}
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Create Task</span>
            <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded bg-black/15 text-[10px] font-mono font-bold">
              Shift+T
            </kbd>
          </button>
        )}
      </div>
    </div>
  );
};
