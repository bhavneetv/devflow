import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Circle,
  Layers,
  Users,
} from 'lucide-react';
import type { DevelopmentDashboardData } from '../../types/development';
import { useAccentTheme } from '../../services/accentTheme.service';
import { getMasterIconComponent } from './devIcons';
import { getStatusStyle } from './devBadges';

export type MetricFilterType =
  | 'all'
  | 'completed'
  | 'in_progress'
  | 'not_started'
  | 'overdue'
  | 'due_soon';

interface DevelopmentDashboardCardsProps {
  data: DevelopmentDashboardData;
  activeMetricFilter?: MetricFilterType | null;
  activeStatusFilter?: string;
  activeTaskTypeFilter?: string;
  activeAssigneeFilter?: number;
  onSelectMetricFilter: (metric: MetricFilterType) => void;
  onSelectStatusFilter?: (status: string) => void;
  onSelectTaskTypeFilter: (taskType: string | undefined) => void;
  onSelectAssigneeFilter: (userId: number) => void;
}

const CompletionRing: React.FC<{
  pct: number;
  size?: number;
  stroke?: number;
  color: string;
}> = ({ pct, size = 64, stroke = 7, color }) => {
  const clamped = Math.min(100, Math.max(0, pct));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (clamped / 100) * c;

  return (
    <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#27272A" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold font-mono text-white">{clamped}%</span>
      </div>
    </div>
  );
};

export const DevelopmentDashboardCards: React.FC<DevelopmentDashboardCardsProps> = ({
  data,
  activeMetricFilter,
  activeStatusFilter,
  activeAssigneeFilter,
  onSelectMetricFilter,
  onSelectStatusFilter,
  onSelectAssigneeFilter,
}) => {
  const { accentColor } = useAccentTheme();
  const { metrics, analytics, config } = data;

  const statusItemMap = new Map(
    (config.statusItems || []).map((s) => [s.name.trim().toLowerCase(), s])
  );

  const dynamicStatusChips = (analytics.byStatus || []).map((st) => {
    const customMeta = statusItemMap.get(st.label.trim().toLowerCase());
    const fallbackStyle = getStatusStyle(st.label);
    const Icon = customMeta?.icon
      ? getMasterIconComponent(customMeta.icon, Circle)
      : fallbackStyle.icon;
    return {
      key: `status:${st.key}`,
      statusName: st.label,
      label: st.label,
      count: st.count,
      color: customMeta?.color || st.color || fallbackStyle.color,
      icon: Icon,
    };
  });

  const scheduleChips: {
    key: MetricFilterType;
    label: string;
    count: number;
    color: string;
    icon: React.ComponentType<any>;
  }[] = [
    { key: 'overdue', label: 'Overdue', count: metrics.overdueCount, color: '#EF4444', icon: AlertTriangle },
    { key: 'due_soon', label: 'Due Soon', count: metrics.dueSoonCount, color: '#F59E0B', icon: CalendarClock },
  ];

  return (
    <div className="space-y-4">
      {/* ─── Single Summary Card: Total Work + Dynamic By Status & Schedule + Completion Rate ─── */}
      <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: Total Work Count */}
          <div className="flex items-center gap-3.5">
            <div
              className="p-2.5 rounded-xl border shrink-0"
              style={{
                backgroundColor: `${accentColor}15`,
                color: accentColor,
                borderColor: `${accentColor}35`,
              }}
            >
              <Layers size={20} />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Total Work Items
              </div>
              <div className="flex items-baseline gap-2.5 mt-0.5">
                <span className="text-3xl font-bold font-mono text-white tracking-tight">
                  {metrics.totalWorkItems}
                </span>
                <button
                  type="button"
                  onClick={() => onSelectMetricFilter('all')}
                  className="inline-flex items-center gap-1 text-[11px] font-medium hover:underline cursor-pointer"
                  style={{ color: accentColor }}
                >
                  <span>View all</span>
                  <ArrowRight size={11} />
                </button>
              </div>
            </div>
          </div>

          {/* Right: Completion Rate Ring inside same card */}
          <button
            type="button"
            onClick={() => onSelectMetricFilter('completed')}
            className="flex items-center gap-3.5 px-3.5 py-2 rounded-xl bg-[#13151C] hover:bg-[#171A24] border border-[#27272A] transition-colors cursor-pointer"
          >
            <div className="text-right">
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                Completion Rate
              </div>
              <div className="text-sm font-bold font-mono text-white mt-0.5">
                {metrics.completedCount} / {metrics.totalWorkItems} done
              </div>
              {metrics.recentCompletedDelta !== null && metrics.recentCompletedDelta !== 0 && (
                <div className="text-[10px] font-mono text-emerald-400">
                  {metrics.recentCompletedDelta > 0 ? `+${metrics.recentCompletedDelta}` : metrics.recentCompletedDelta} vs prior 7d
                </div>
              )}
            </div>
            <CompletionRing
              pct={metrics.completionRate}
              size={58}
              stroke={6}
              color={metrics.completionRate >= 70 ? '#10B981' : accentColor}
            />
          </button>
        </div>

        {/* Dynamic Status & Schedule Breakdown inside the same card */}
        <div className="pt-3 border-t border-[#27272A]/70 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              By Status & Schedule
            </div>
            <div className="text-[10px] font-mono text-zinc-500">
              {dynamicStatusChips.length} stages configured
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {dynamicStatusChips.map((chip) => {
              const Icon = chip.icon;
              const isSelected = activeStatusFilter === chip.statusName;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => {
                    if (onSelectStatusFilter) {
                      onSelectStatusFilter(chip.statusName);
                    } else if (chip.statusName.toLowerCase() === 'completed') {
                      onSelectMetricFilter('completed');
                    } else if (chip.statusName.toLowerCase() === 'in progress') {
                      onSelectMetricFilter('in_progress');
                    } else if (chip.statusName.toLowerCase() === 'not started') {
                      onSelectMetricFilter('not_started');
                    }
                  }}
                  className="rounded-lg bg-[#14161D] hover:bg-[#191C26] border px-2.5 py-1.5 flex items-center gap-1.5 transition-all cursor-pointer"
                  style={{
                    borderColor: isSelected ? accentColor : '#232632',
                    boxShadow: isSelected ? `0 0 0 1px ${accentColor}40` : undefined,
                  }}
                >
                  <Icon size={12} style={{ color: chip.color }} />
                  <span className="text-[11px] text-zinc-300 font-medium">{chip.label}</span>
                  <span className="text-[11px] font-mono font-bold text-white">{chip.count}</span>
                </button>
              );
            })}

            {scheduleChips.map((chip) => {
              const Icon = chip.icon;
              const isSelected = activeMetricFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => onSelectMetricFilter(chip.key)}
                  className="rounded-lg bg-[#14161D] hover:bg-[#191C26] border px-2.5 py-1.5 flex items-center gap-1.5 transition-all cursor-pointer"
                  style={{
                    borderColor: isSelected ? accentColor : '#232632',
                    boxShadow: isSelected ? `0 0 0 1px ${accentColor}40` : undefined,
                  }}
                >
                  <Icon size={12} style={{ color: chip.color }} />
                  <span className="text-[11px] text-zinc-300 font-medium">{chip.label}</span>
                  <span className="text-[11px] font-mono font-bold text-white">{chip.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Compact Team Workload (Small Member Cards, Text Stats Only, No Progress Bar) ─── */}
      <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 shadow-xl">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${accentColor}1A`, color: accentColor }}
            >
              <Users size={13} />
            </div>
            <h3 className="text-xs font-semibold text-white tracking-tight">Team Workload</h3>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">
            {metrics.teamWorkload.length} assigned member{metrics.teamWorkload.length === 1 ? '' : 's'}
          </span>
        </div>

        {metrics.teamWorkload.length === 0 ? (
          <div className="py-4 px-4 rounded-xl bg-[#0A0B0F] border border-dashed border-[#27272A] text-center">
            <p className="text-xs text-zinc-400">No assigned work items yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
            {metrics.teamWorkload.map((entry) => {
              const isSelected = activeAssigneeFilter === entry.user.id;
              const initials = (entry.user.name || 'U')
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase() || '')
                .join('');

              return (
                <button
                  key={entry.user.id}
                  type="button"
                  onClick={() => onSelectAssigneeFilter(entry.user.id)}
                  className="text-left rounded-xl bg-[#12141B] hover:bg-[#171923] border px-2.5 py-2 transition-all cursor-pointer space-y-1.5"
                  style={{
                    borderColor: isSelected ? accentColor : '#27272A',
                    boxShadow: isSelected ? `0 0 0 1px ${accentColor}40` : undefined,
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden"
                      style={{ backgroundColor: entry.user.avatarColor || '#6366F1' }}
                    >
                      {entry.user.avatarUrl ? (
                        <img
                          src={entry.user.avatarUrl}
                          alt={entry.user.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        initials
                      )}
                    </div>
                    <span className="text-xs font-medium text-white truncate">
                      {entry.user.name}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] font-mono text-zinc-400">
                    <span>
                      Total: <strong className="text-zinc-200">{entry.totalAssigned}</strong>
                    </span>
                    <span>
                      Complete: <strong className="text-emerald-400">{entry.completedCount}</strong>
                    </span>
                    <span>
                      Active: <strong style={{ color: accentColor }}>{entry.activeCount}</strong>
                    </span>
                    {entry.overdueCount > 0 && (
                      <span>
                        Overdue: <strong className="text-red-400">{entry.overdueCount}</strong>
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
