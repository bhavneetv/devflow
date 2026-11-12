import React, { useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Clock,
  Layers,
  Users,
} from 'lucide-react';
import { AnimatedSelect } from '../settings/AnimatedSelect';
import { CustomDatePicker } from '../settings/CustomDatePicker';
import { formatDistanceToNow } from '../../lib/dateUtils';
import { useAccentTheme } from '../../services/accentTheme.service';
import type {
  DevelopmentDashboardData,
  DevelopmentModuleMaster,
  DevelopmentTaskItem,
} from '../../types/development';
import {
  DevAvatarStack,
  formatDevDate,
  PriorityBadge,
  StatusBadge,
} from './devBadges';

interface DevelopmentAnalyticsViewProps {
  data: DevelopmentDashboardData;
  modules: DevelopmentModuleMaster[];
  filterModuleId?: number;
  filterStartDate: string;
  filterEndDate: string;
  onFilterChange: (next: {
    moduleId?: number;
    startDate: string;
    endDate: string;
  }) => void;
  onSelectTask: (task: DevelopmentTaskItem) => void;
}

export const DevelopmentAnalyticsView: React.FC<DevelopmentAnalyticsViewProps> = ({
  data,
  modules,
  filterModuleId,
  filterStartDate,
  filterEndDate,
  onFilterChange,
  onSelectTask,
}) => {
  const { accentColor } = useAccentTheme();
  const [expandedModules, setExpandedModules] = useState<Record<number, boolean>>({});
  const { metrics, analytics } = data;

  const toggleMod = (id: number) => {
    setExpandedModules((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const activeModules = modules.filter((m) => !m.isArchived);

  return (
    <div className="space-y-5">
      {/* Filter Bar */}
      <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 flex flex-wrap items-center justify-between gap-3 shadow-xl relative z-[50]">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <BarChart3 size={15} style={{ color: accentColor }} />
            <span>Progress & Execution Analytics</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real database metrics scoped by module and date window
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-44">
            <AnimatedSelect
              value={filterModuleId ? String(filterModuleId) : ''}
              onChange={(val) =>
                onFilterChange({
                  moduleId: val ? parseInt(val, 10) : undefined,
                  startDate: filterStartDate,
                  endDate: filterEndDate,
                })
              }
              accentColor={accentColor}
              dropdownMinWidth="w-56"
              placeholder="All Modules"
              options={[
                { value: '', label: 'All Modules' },
                ...activeModules.map((m) => ({ value: String(m.id), label: m.name })),
              ]}
            />
          </div>
          <div className="w-40">
            <CustomDatePicker
              value={filterStartDate}
              onChange={(v) =>
                onFilterChange({
                  moduleId: filterModuleId,
                  startDate: v,
                  endDate: filterEndDate,
                })
              }
              placeholder="From Date"
              presetMode="none"
            />
          </div>
          <div className="w-40">
            <CustomDatePicker
              value={filterEndDate}
              onChange={(v) =>
                onFilterChange({
                  moduleId: filterModuleId,
                  startDate: filterStartDate,
                  endDate: v,
                })
              }
              placeholder="To Date"
              presetMode="none"
              align="right"
            />
          </div>
          {(filterModuleId || filterStartDate || filterEndDate) && (
            <button
              type="button"
              onClick={() =>
                onFilterChange({ moduleId: undefined, startDate: '', endDate: '' })
              }
              className="text-xs text-zinc-400 hover:text-white underline cursor-pointer px-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Empty Analytics State */}
      {metrics.totalWorkItems === 0 ? (
        <div className="rounded-2xl bg-[#0E0F14]/95 border border-dashed border-[#27272A] p-12 text-center space-y-2">
          <BarChart3 size={28} className="mx-auto text-zinc-600" />
          <h4 className="text-sm font-semibold text-white">No work items match this scope</h4>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Create development tasks or adjust the module/date filters above to inspect team velocity, completion rates, and module breakdowns.
          </p>
        </div>
      ) : (
        <>
          {/* Row 1: Overall Progress + Status / Priority / Type Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* By Status */}
            <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 space-y-3.5 shadow-xl">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                  Breakdown by Status
                </h4>
                <span className="text-xs font-mono font-bold text-white">
                  {metrics.completedCount}/{metrics.totalWorkItems} done ({metrics.completionRate}%)
                </span>
              </div>
              <div className="space-y-2.5">
                {analytics.byStatus.map((item) => (
                  <div key={item.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-200 font-medium">{item.label}</span>
                      <span className="font-mono text-zinc-400">
                        {item.count} ({item.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#171923] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(item.count > 0 ? 4 : 0, item.percentage)}%`,
                          backgroundColor: item.color || accentColor,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By Priority */}
            <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 space-y-3.5 shadow-xl">
              <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                Breakdown by Priority
              </h4>
              <div className="space-y-2.5">
                {analytics.byPriority.map((item) => (
                  <div key={item.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-200 font-medium">{item.label}</span>
                      <span className="font-mono text-zinc-400">
                        {item.count} ({item.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#171923] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(item.count > 0 ? 4 : 0, item.percentage)}%`,
                          backgroundColor: item.color || accentColor,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By Type */}
            <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 space-y-3.5 shadow-xl">
              <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                Breakdown by Task Type
              </h4>
              <div className="space-y-2.5">
                {analytics.byTaskType.map((item) => (
                  <div key={item.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-200 font-medium">{item.label}</span>
                      <span className="font-mono text-zinc-400">
                        {item.count} ({item.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#171923] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(item.count > 0 ? 4 : 0, item.percentage)}%`,
                          backgroundColor: item.color || accentColor,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Progress by Module & Submodule + Workload by Assignee */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Module & Submodule Progress */}
            <div className="lg:col-span-7 rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 space-y-3.5 shadow-xl">
              <div className="flex items-center gap-2">
                <Layers size={15} style={{ color: accentColor }} />
                <h4 className="text-xs font-semibold text-white">
                  Progress by Module & Submodule
                </h4>
              </div>

              {analytics.moduleProgress.length === 0 ? (
                <p className="text-xs text-zinc-500 py-6 text-center">
                  No module master data configured yet.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {analytics.moduleProgress.map((mod) => {
                    const isExpanded = expandedModules[mod.id] ?? true;
                    return (
                      <div
                        key={mod.id}
                        className="rounded-xl bg-[#12141B] border border-[#27272A] overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => toggleMod(mod.id)}
                          className="w-full p-3 flex items-center justify-between gap-3 hover:bg-[#171923] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isExpanded ? (
                              <ChevronDown size={14} className="text-zinc-500 shrink-0" />
                            ) : (
                              <ChevronRight size={14} className="text-zinc-500 shrink-0" />
                            )}
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: mod.color || accentColor }}
                            />
                            <span className="text-xs font-semibold text-white truncate">
                              {mod.name}
                            </span>
                            {mod.overdueTasks > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 text-[10px] font-mono">
                                {mod.overdueTasks} overdue
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[11px] font-mono text-zinc-400">
                              {mod.completedTasks}/{mod.totalTasks}
                            </span>
                            <span className="text-xs font-mono font-bold text-white w-10 text-right">
                              {mod.completionRate}%
                            </span>
                          </div>
                        </button>

                        <div className="px-3 pb-2">
                          <div className="h-1.5 rounded-full bg-[#1C1E26] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${mod.completionRate}%`,
                                backgroundColor: mod.color || accentColor,
                              }}
                            />
                          </div>
                        </div>

                        {isExpanded && mod.submodules.length > 0 && (
                          <div className="border-t border-[#27272A]/70 bg-[#0D0E13] divide-y divide-[#27272A]/40">
                            {mod.submodules.map((sub) => (
                              <div
                                key={sub.id}
                                className="px-4 py-2 pl-9 flex items-center justify-between gap-3 text-xs"
                              >
                                <span className="text-zinc-300 truncate">{sub.name}</span>
                                <div className="flex items-center gap-3 shrink-0">
                                  <div className="w-24 h-1.5 rounded-full bg-[#1C1E26] overflow-hidden hidden sm:block">
                                    <div
                                      className="h-full rounded-full bg-emerald-500"
                                      style={{ width: `${sub.completionRate}%` }}
                                    />
                                  </div>
                                  <span className="text-[11px] font-mono text-zinc-400">
                                    {sub.completedTasks}/{sub.totalTasks} ({sub.completionRate}%)
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Workload by Assignee */}
            <div className="lg:col-span-5 rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 space-y-3.5 shadow-xl">
              <div className="flex items-center gap-2">
                <Users size={15} style={{ color: accentColor }} />
                <h4 className="text-xs font-semibold text-white">Workload Distribution</h4>
              </div>

              {metrics.teamWorkload.length === 0 ? (
                <p className="text-xs text-zinc-500 py-6 text-center">
                  No assigned tasks in current filter.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {metrics.teamWorkload.map((w) => {
                    const pct =
                      w.totalAssigned > 0
                        ? Math.round((w.completedCount / w.totalAssigned) * 100)
                        : 0;
                    return (
                      <div
                        key={w.user.id}
                        className="p-3 rounded-xl bg-[#12141B] border border-[#27272A] space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-white truncate">
                            {w.user.name}
                          </span>
                          <span className="text-[11px] font-mono text-zinc-400 shrink-0">
                            {w.activeCount} active · {w.completedCount} done
                            {w.overdueCount > 0 ? ` · ${w.overdueCount} overdue` : ''}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#1C1E26] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: '#10B981' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Row 3: Overdue / Upcoming + Recently Updated */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Overdue & Due Soon */}
            <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 space-y-3.5 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarClock size={15} className="text-amber-400" />
                  <h4 className="text-xs font-semibold text-white">
                    Overdue & Upcoming Deadlines (7d)
                  </h4>
                </div>
                <span className="text-[11px] font-mono text-zinc-400">
                  {analytics.overdueTasks.length} overdue · {analytics.dueSoonTasks.length} soon
                </span>
              </div>

              {analytics.overdueTasks.length === 0 && analytics.dueSoonTasks.length === 0 ? (
                <p className="text-xs text-zinc-500 py-6 text-center">
                  No overdue or upcoming deadlines in the next 7 days.
                </p>
              ) : (
                <div className="divide-y divide-[#27272A]/60 max-h-72 overflow-y-auto">
                  {[...analytics.overdueTasks, ...analytics.dueSoonTasks].map((t) => (
                    <div
                      key={t.id}
                      onClick={() => onSelectTask(t)}
                      className="py-2.5 flex items-center justify-between gap-3 hover:bg-[#151720] px-2 rounded-lg cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] font-mono font-bold"
                            style={{ color: accentColor }}
                          >
                            {t.taskKey}
                          </span>
                          <span className="text-xs font-medium text-white truncate">{t.title}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusBadge status={t.status} compact />
                          <PriorityBadge priority={t.priority} compact />
                        </div>
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <div
                          className={`inline-flex items-center gap-1 text-[11px] font-mono ${
                            t.isOverdue ? 'text-red-400 font-semibold' : 'text-amber-300'
                          }`}
                        >
                          {t.isOverdue && <AlertTriangle size={10} />}
                          <span>{formatDevDate(t.dueDate)}</span>
                        </div>
                        <div className="flex justify-end">
                          <DevAvatarStack users={t.assignees} max={2} size="xs" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recently Updated Tasks */}
            <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 space-y-3.5 shadow-xl">
              <div className="flex items-center gap-2">
                <Clock size={15} style={{ color: accentColor }} />
                <h4 className="text-xs font-semibold text-white">Recently Updated Work Items</h4>
              </div>

              <div className="divide-y divide-[#27272A]/60 max-h-72 overflow-y-auto">
                {analytics.recentlyUpdatedTasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => onSelectTask(t)}
                    className="py-2.5 flex items-center justify-between gap-3 hover:bg-[#151720] px-2 rounded-lg cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-mono font-bold"
                          style={{ color: accentColor }}
                        >
                          {t.taskKey}
                        </span>
                        <span className="text-xs font-medium text-white truncate">{t.title}</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-0.5 truncate">
                        {t.module?.name} / {t.submodule?.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={t.status} compact />
                      <span className="text-[10px] text-zinc-500">
                        {formatDistanceToNow(t.updatedAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

