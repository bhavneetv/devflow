import React from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Layers,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import type { DevelopmentDashboardData } from '../../types/development';
import { useAccentTheme } from '../../services/accentTheme.service';

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
  activeAssigneeFilter?: number;
  onSelectMetricFilter: (metric: MetricFilterType) => void;
  onSelectAssigneeFilter: (userId: number) => void;
}

const CompletionRing: React.FC<{
  pct: number;
  size?: number;
  stroke?: number;
  color: string;
}> = ({ pct, size = 56, stroke = 6, color }) => {
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
        <span className="text-[11px] font-bold font-mono text-white">{clamped}%</span>
      </div>
    </div>
  );
};

export const DevelopmentDashboardCards: React.FC<DevelopmentDashboardCardsProps> = ({
  data,
  activeMetricFilter,
  activeAssigneeFilter,
  onSelectMetricFilter,
  onSelectAssigneeFilter,
}) => {
  const { accentColor } = useAccentTheme();
  const { metrics } = data;

  const statCards: {
    key: MetricFilterType;
    label: string;
    value: number;
    subtext: string;
    icon: React.ComponentType<any>;
    color: string;
    badge?: string | null;
  }[] = [
    {
      key: 'all',
      label: 'Total Work Items',
      value: metrics.totalWorkItems,
      subtext:
        metrics.recentCreatedCount > 0
          ? `+${metrics.recentCreatedCount} added this week`
          : 'All tracked tasks',
      icon: Layers,
      color: accentColor,
    },
    {
      key: 'completed',
      label: 'Completed',
      value: metrics.completedCount,
      subtext:
        metrics.recentCompletedDelta !== null && metrics.recentCompletedDelta !== 0
          ? `${metrics.recentCompletedDelta > 0 ? '+' : ''}${metrics.recentCompletedDelta} vs prior 7d`
          : `${metrics.completionRate}% of total`,
      icon: CheckCircle2,
      color: '#10B981',
    },
    {
      key: 'in_progress',
      label: 'In Progress',
      value: metrics.inProgressCount,
      subtext:
        metrics.inReviewCount > 0
          ? `${metrics.inReviewCount} in review · ${metrics.blockedCount} blocked`
          : 'Active execution',
      icon: Zap,
      color: '#3B82F6',
    },
    {
      key: 'not_started',
      label: 'Not Started',
      value: metrics.notStartedCount,
      subtext:
        metrics.unassignedCount > 0
          ? `${metrics.unassignedCount} unassigned`
          : 'Queued in backlog',
      icon: CircleDashed,
      color: '#A1A1AA',
    },
    {
      key: 'overdue',
      label: 'Overdue',
      value: metrics.overdueCount,
      subtext: metrics.overdueCount > 0 ? 'Past target due date' : 'No overdue items',
      icon: AlertTriangle,
      color: metrics.overdueCount > 0 ? '#EF4444' : '#71717A',
    },
    {
      key: 'due_soon',
      label: 'Due Soon (7d)',
      value: metrics.dueSoonCount,
      subtext: metrics.dueSoonCount > 0 ? 'Due within 7 days' : 'Nothing due in 7d',
      icon: CalendarClock,
      color: metrics.dueSoonCount > 0 ? '#F59E0B' : '#71717A',
    },
  ];

  const maxWorkload = Math.max(1, ...metrics.teamWorkload.map((w) => w.activeCount || 0));

  return (
    <div className="space-y-4">
      {/* Row 1: 6 Clickable Core Metric Cards + Completion Rate Card */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          const isActive = activeMetricFilter === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => onSelectMetricFilter(card.key)}
              className="group text-left rounded-2xl bg-[#0E0F14]/95 border p-4 shadow-xl transition-all cursor-pointer hover:bg-[#13151C]"
              style={{
                borderColor: isActive ? accentColor : '#27272A',
                boxShadow: isActive ? `0 0 0 1px ${accentColor}45` : undefined,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  {card.label}
                </span>
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-white/5 transition-transform group-hover:scale-105"
                  style={{ backgroundColor: `${card.color}18`, color: card.color }}
                >
                  <Icon size={15} />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white tracking-tight font-mono">
                  {card.value}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-500 truncate">{card.subtext}</p>
            </button>
          );
        })}

        {/* Card 7: Completion Rate */}
        <button
          type="button"
          onClick={() => onSelectMetricFilter('completed')}
          className="col-span-2 sm:col-span-1 text-left rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] hover:border-zinc-700 p-4 shadow-xl transition-all cursor-pointer flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              <TrendingUp size={12} style={{ color: '#10B981' }} />
              <span>Completion Rate</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-white font-mono">
              {metrics.completionRate}%
            </div>
            <p className="mt-1 text-[11px] text-zinc-500 truncate">
              {metrics.completedCount} / {metrics.totalWorkItems} done
            </p>
          </div>
          <CompletionRing
            pct={metrics.completionRate}
            color={metrics.completionRate >= 70 ? '#10B981' : accentColor}
          />
        </button>
      </div>

      {/* Row 2: Card 8 — Team Workload (Active items per team member) */}
      <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${accentColor}1A`, color: accentColor }}
            >
              <Users size={14} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white tracking-tight">Team Workload</h3>
              <p className="text-[11px] text-zinc-500">
                Active work items per assigned member — click a member to filter
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-zinc-400">
            {metrics.teamWorkload.length} active contributor{metrics.teamWorkload.length === 1 ? '' : 's'}
          </span>
        </div>

        {metrics.teamWorkload.length === 0 ? (
          <div className="py-5 px-4 rounded-xl bg-[#0A0B0F] border border-dashed border-[#27272A] text-center">
            <p className="text-xs text-zinc-400">No assigned work items yet</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Assign development tasks to project members to track workload balance here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {metrics.teamWorkload.map((entry) => {
              const isSelected = activeAssigneeFilter === entry.user.id;
              const pct = Math.min(100, Math.round((entry.activeCount / maxWorkload) * 100));
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
                  className="text-left rounded-xl bg-[#12141B] hover:bg-[#171923] border p-3 transition-all cursor-pointer space-y-2"
                  style={{
                    borderColor: isSelected ? accentColor : '#27272A',
                    boxShadow: isSelected ? `0 0 0 1px ${accentColor}40` : undefined,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden"
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
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white truncate">{entry.user.name}</p>
                        <p className="text-[10px] text-zinc-500 truncate">
                          {entry.completedCount} done
                          {entry.overdueCount > 0 ? ` · ${entry.overdueCount} overdue` : ''}
                        </p>
                      </div>
                    </div>
                    <span
                      className="text-xs font-mono font-bold px-2 py-0.5 rounded-md shrink-0"
                      style={{
                        backgroundColor: `${accentColor}1A`,
                        color: accentColor,
                      }}
                    >
                      {entry.activeCount} active
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#1E202B] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(entry.activeCount > 0 ? 10 : 0, pct)}%`,
                        backgroundColor: entry.overdueCount > 0 ? '#F59E0B' : accentColor,
                      }}
                    />
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

