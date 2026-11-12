import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Clock,
  GitCompare,
  Layers,
  PieChart,
  TrendingUp,
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
  DevMasterChoiceItem,
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

interface BreakdownSlice {
  key: string;
  label: string;
  count: number;
  percentage: number;
  color?: string;
}

const AnimatedDonutChart: React.FC<{
  title: string;
  subtitle: string;
  items: BreakdownSlice[];
  centerPrimary: string;
  centerSecondary: string;
  accentColor: string;
}> = ({ title, subtitle, items, centerPrimary, centerSecondary, accentColor }) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const totalCount = useMemo(
    () => items.reduce((sum, item) => sum + item.count, 0),
    [items]
  );

  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  const segments = useMemo(() => {
    if (totalCount === 0) return [];
    let offset = 0;
    return items
      .filter((item) => item.count > 0)
      .map((item) => {
        const length = (item.count / totalCount) * circumference;
        const segment = {
          ...item,
          length,
          offset,
        };
        offset += length;
        return segment;
      });
  }, [items, totalCount, circumference]);

  const activeItem = hoveredKey
    ? items.find((i) => i.key === hoveredKey) || null
    : null;

  return (
    <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 space-y-4 shadow-xl">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
            <PieChart size={14} style={{ color: accentColor }} />
            <span>{title}</span>
          </h4>
          <p className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</p>
        </div>
        <span className="text-[11px] font-mono text-zinc-400">
          {totalCount} items
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-5">
        {/* Donut SVG */}
        <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
          <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="#1A1C25"
              strokeWidth="15"
            />
            {segments.map((seg, idx) => {
              const isHovered = hoveredKey === seg.key;
              return (
                <motion.circle
                  key={seg.key}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={seg.color || accentColor}
                  strokeWidth={isHovered ? 19 : 15}
                  strokeLinecap="butt"
                  strokeDashoffset={-seg.offset}
                  initial={{ strokeDasharray: `0 ${circumference}` }}
                  animate={{
                    strokeDasharray: `${Math.max(seg.length - (segments.length > 1 ? 1.5 : 0), 1)} ${circumference}`,
                    opacity: hoveredKey && !isHovered ? 0.45 : 1,
                  }}
                  transition={{
                    duration: 0.75,
                    delay: idx * 0.06,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="cursor-pointer transition-[stroke-width] duration-200"
                  onMouseEnter={() => setHoveredKey(seg.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-3">
            <span className="text-lg font-bold text-white leading-tight">
              {activeItem ? `${activeItem.percentage}%` : centerPrimary}
            </span>
            <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[82px]">
              {activeItem ? activeItem.label : centerSecondary}
            </span>
          </div>
        </div>

        {/* Legend with animated bars */}
        <div className="flex-1 w-full space-y-2">
          {items.map((item) => {
            const isHovered = hoveredKey === item.key;
            return (
              <div
                key={item.key}
                onMouseEnter={() => setHoveredKey(item.key)}
                onMouseLeave={() => setHoveredKey(null)}
                className={`p-1.5 rounded-lg transition-colors cursor-default ${
                  isHovered ? 'bg-[#171923]' : ''
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-2 text-zinc-200 font-medium truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color || accentColor }}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="font-mono text-[11px] text-zinc-400 shrink-0">
                    {item.count} ({item.percentage}%)
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[#171923] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(item.count > 0 ? 3 : 0, item.percentage)}%` }}
                    transition={{ duration: 0.65, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: item.color || accentColor }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

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
  const [hoveredDayIdx, setHoveredDayIdx] = useState<number | null>(null);
  const { metrics, analytics, config } = data;

  const statusMap = useMemo(() => {
    const m = new Map<string, DevMasterChoiceItem>();
    (config.statusItems || []).forEach((item) => m.set(item.name, item));
    return m;
  }, [config.statusItems]);

  const priorityMap = useMemo(() => {
    const m = new Map<string, DevMasterChoiceItem>();
    (config.priorityItems || []).forEach((item) => m.set(item.name, item));
    return m;
  }, [config.priorityItems]);

  const toggleMod = (id: number) => {
    setExpandedModules((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const activeModules = modules.filter((m) => !m.isArchived);

  // 14-Day Velocity Line/Area Chart coordinates (100% real DB data)
  const trend = analytics.dailyTrend || [];
  const chartW = 620;
  const chartH = 190;
  const padL = 32;
  const padR = 16;
  const padT = 18;
  const padB = 28;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const trendMax = useMemo(() => {
    const peak = trend.reduce((m, d) => Math.max(m, d.created, d.completed), 0);
    return Math.max(4, Math.ceil(peak * 1.15));
  }, [trend]);

  const trendCoords = useMemo(() => {
    if (trend.length === 0) return [];
    const step = trend.length > 1 ? plotW / (trend.length - 1) : 0;
    return trend.map((pt, idx) => {
      const x = trend.length === 1 ? padL + plotW / 2 : padL + idx * step;
      const yCreated = padT + plotH - (pt.created / trendMax) * plotH;
      const yCompleted = padT + plotH - (pt.completed / trendMax) * plotH;
      return { ...pt, idx, x, yCreated, yCompleted };
    });
  }, [trend, plotW, plotH, trendMax]);

  const buildPath = (pts: { x: number; y: number }[]) =>
    pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');

  const buildAreaPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    const line = buildPath(pts);
    const baseY = padT + plotH;
    return `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${baseY} L ${pts[0].x.toFixed(1)} ${baseY} Z`;
  };

  const createdLinePath = buildPath(trendCoords.map((p) => ({ x: p.x, y: p.yCreated })));
  const completedLinePath = buildPath(trendCoords.map((p) => ({ x: p.x, y: p.yCompleted })));
  const createdAreaPath = buildAreaPath(trendCoords.map((p) => ({ x: p.x, y: p.yCreated })));
  const completedAreaPath = buildAreaPath(trendCoords.map((p) => ({ x: p.x, y: p.yCompleted })));

  const hoveredTrend =
    hoveredDayIdx !== null && trendCoords[hoveredDayIdx]
      ? trendCoords[hoveredDayIdx]
      : null;

  const totalCreated14d = trend.reduce((s, d) => s + d.created, 0);
  const totalCompleted14d = trend.reduce((s, d) => s + d.completed, 0);

  // Delivery bar chart comparison across top metrics
  const scheduleBars = [
    {
      label: 'Completed',
      value: metrics.completedCount,
      color: '#10B981',
    },
    {
      label: 'In Progress',
      value: metrics.inProgressCount,
      color: '#3B82F6',
    },
    {
      label: 'In Review',
      value: metrics.inReviewCount,
      color: '#8B5CF6',
    },
    {
      label: 'Due Soon (7d)',
      value: metrics.dueSoonCount,
      color: '#F59E0B',
    },
    {
      label: 'Overdue',
      value: metrics.overdueCount,
      color: '#EF4444',
    },
    {
      label: 'Blocked',
      value: metrics.blockedCount,
      color: '#FB7185',
    },
  ];
  const scheduleBarMax = Math.max(1, ...scheduleBars.map((b) => b.value));

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
          {/* Row 1: 14-Day Velocity Line/Area Graph + Vertical Schedule Bar Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Animated Line & Area Trend Graph */}
            <div className="lg:col-span-7 rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 space-y-3 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <TrendingUp size={15} style={{ color: accentColor }} />
                    <span>14-Day Task Creation vs Completion Velocity</span>
                  </h4>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Real daily throughput from project task records
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-mono">
                  <span className="inline-flex items-center gap-1.5 text-zinc-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                    Created ({totalCreated14d})
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-zinc-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    Completed ({totalCompleted14d})
                  </span>
                </div>
              </div>

              {trendCoords.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-xs text-zinc-500">
                  No daily velocity history recorded yet.
                </div>
              ) : (
                <div className="relative">
                  {hoveredTrend && (
                    <div className="absolute right-2 top-1 z-10 px-2.5 py-1.5 rounded-lg bg-[#161822]/95 border border-[#2E3140] text-[11px] font-mono shadow-lg pointer-events-none flex items-center gap-3">
                      <span className="text-zinc-300 font-semibold">{hoveredTrend.label}</span>
                      <span className="text-sky-400">{hoveredTrend.created} created</span>
                      <span className="text-emerald-400">{hoveredTrend.completed} completed</span>
                    </div>
                  )}
                  <svg
                    viewBox={`0 0 ${chartW} ${chartH}`}
                    className="w-full h-52 overflow-visible select-none"
                  >
                    <defs>
                      <linearGradient id="devCreatedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.01" />
                      </linearGradient>
                      <linearGradient id="devCompletedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.32" />
                        <stop offset="100%" stopColor="#10B981" stopOpacity="0.01" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Grid + Y ticks */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                      const y = padT + plotH * (1 - ratio);
                      const tickVal = Math.round(trendMax * ratio);
                      return (
                        <g key={ratio}>
                          <line
                            x1={padL}
                            y1={y}
                            x2={chartW - padR}
                            y2={y}
                            stroke="#27272A"
                            strokeDasharray="3 3"
                            strokeWidth="1"
                          />
                          <text
                            x={padL - 8}
                            y={y + 3}
                            textAnchor="end"
                            fill="#71717A"
                            fontSize="10"
                            fontFamily="monospace"
                          >
                            {tickVal}
                          </text>
                        </g>
                      );
                    })}

                    {/* Area fills */}
                    <motion.path
                      d={createdAreaPath}
                      fill="url(#devCreatedGrad)"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.7 }}
                    />
                    <motion.path
                      d={completedAreaPath}
                      fill="url(#devCompletedGrad)"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.7, delay: 0.12 }}
                    />

                    {/* Line strokes */}
                    <motion.path
                      d={createdLinePath}
                      fill="none"
                      stroke="#38BDF8"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.9, ease: 'easeInOut' }}
                    />
                    <motion.path
                      d={completedLinePath}
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.9, delay: 0.15, ease: 'easeInOut' }}
                    />

                    {/* Vertical Hover Guide */}
                    {hoveredTrend && (
                      <line
                        x1={hoveredTrend.x}
                        y1={padT}
                        x2={hoveredTrend.x}
                        y2={padT + plotH}
                        stroke="#52525B"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                      />
                    )}

                    {/* Data Points & Hit Targets */}
                    {trendCoords.map((pt) => {
                      const isActive = hoveredDayIdx === pt.idx;
                      const showXLabel = pt.idx % 2 === 0 || pt.idx === trendCoords.length - 1;
                      return (
                        <g
                          key={pt.date}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredDayIdx(pt.idx)}
                          onMouseLeave={() => setHoveredDayIdx(null)}
                        >
                          <rect
                            x={pt.x - 16}
                            y={padT}
                            width={32}
                            height={plotH + 18}
                            fill="transparent"
                          />
                          <motion.circle
                            cx={pt.x}
                            cy={pt.yCreated}
                            r={isActive ? 5 : 3}
                            fill="#0E0F14"
                            stroke="#38BDF8"
                            strokeWidth="2"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.35 + pt.idx * 0.025 }}
                          />
                          <motion.circle
                            cx={pt.x}
                            cy={pt.yCompleted}
                            r={isActive ? 5 : 3}
                            fill="#0E0F14"
                            stroke="#10B981"
                            strokeWidth="2"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.4 + pt.idx * 0.025 }}
                          />
                          {showXLabel && (
                            <text
                              x={pt.x}
                              y={chartH - 6}
                              textAnchor="middle"
                              fill={isActive ? '#FFFFFF' : '#71717A'}
                              fontSize="9.5"
                              fontFamily="monospace"
                            >
                              {pt.label}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}
            </div>

            {/* Animated Pipeline Volume Bar Graph */}
            <div className="lg:col-span-5 rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 space-y-3 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Activity size={15} style={{ color: accentColor }} />
                    <span>Execution Volume & Risk Bars</span>
                  </h4>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Live distribution across progress and deadline states
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-white px-2 py-0.5 rounded-md bg-[#171923] border border-[#27272A]">
                  {metrics.completionRate}% done
                </span>
              </div>

              <div className="grid grid-cols-6 gap-2.5 items-end h-44 pt-4 pb-1 px-1">
                {scheduleBars.map((bar, idx) => {
                  const pctHeight = Math.max(
                    bar.value > 0 ? 12 : 4,
                    Math.round((bar.value / scheduleBarMax) * 100)
                  );
                  return (
                    <div
                      key={bar.label}
                      className="flex flex-col items-center justify-end h-full gap-1.5 group"
                    >
                      <span className="text-[11px] font-mono font-semibold text-zinc-200">
                        {bar.value}
                      </span>
                      <div className="w-full max-w-[34px] flex-1 rounded-lg bg-[#161822] border border-[#242736] p-1 flex items-end overflow-hidden">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${pctHeight}%` }}
                          transition={{
                            duration: 0.7,
                            delay: idx * 0.07,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          className="w-full rounded-md transition-opacity group-hover:opacity-90"
                          style={{ backgroundColor: bar.color }}
                        />
                      </div>
                      <span className="text-[9.5px] text-zinc-400 text-center leading-tight line-clamp-2 h-6 flex items-center">
                        {bar.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 2: Animated Donut / Pie Charts (Status + Priority) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AnimatedDonutChart
              title="Status Distribution (Pie)"
              subtitle="Configured workflow stages across active scope"
              items={analytics.byStatus}
              centerPrimary={`${metrics.completionRate}%`}
              centerSecondary="Completed"
              accentColor={accentColor}
            />
            <AnimatedDonutChart
              title="Priority Distribution (Pie)"
              subtitle="Urgency balance across total development tasks"
              items={analytics.byPriority}
              centerPrimary={`${metrics.totalWorkItems}`}
              centerSecondary="Total Items"
              accentColor={accentColor}
            />
          </div>

          {/* Row 3: Progress by Module & Submodule + Workload by Assignee */}
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
                  {analytics.moduleProgress.map((mod, idx) => {
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
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${mod.completionRate}%` }}
                              transition={{ duration: 0.7, delay: idx * 0.05 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: mod.color || accentColor }}
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
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${sub.completionRate}%` }}
                                      transition={{ duration: 0.6 }}
                                      className="h-full rounded-full bg-emerald-500"
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
                <h4 className="text-xs font-semibold text-white">Team Workload Bar Chart</h4>
              </div>

              {metrics.teamWorkload.length === 0 ? (
                <p className="text-xs text-zinc-500 py-6 text-center">
                  No assigned tasks in current filter.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {metrics.teamWorkload.map((w, idx) => {
                    const pct =
                      w.totalAssigned > 0
                        ? Math.round((w.completedCount / w.totalAssigned) * 100)
                        : 0;
                    const activePct =
                      w.totalAssigned > 0
                        ? Math.round((w.activeCount / w.totalAssigned) * 100)
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
                        <div className="h-2 rounded-full bg-[#1C1E26] overflow-hidden flex">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.65, delay: idx * 0.04 }}
                            className="h-full bg-emerald-500"
                            title={`${w.completedCount} completed`}
                          />
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${activePct}%` }}
                            transition={{ duration: 0.65, delay: idx * 0.04 + 0.08 }}
                            className="h-full bg-sky-500/80"
                            title={`${w.activeCount} active`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Row 3.5: Planned vs Actual Average Performance */}
          {(() => {
            const pva = analytics.plannedVsActual;
            const summary = pva?.summary;

            const fmtHrs = (hrs: number | null | undefined) => {
              if (hrs === null || hrs === undefined) return '0h';
              if (hrs === 0) return '0h';
              if (hrs < 1) return `${Math.max(1, Math.round(hrs * 60))}m`;
              if (hrs >= 48) {
                const days = Number((hrs / 24).toFixed(1));
                return `${Number(hrs.toFixed(1))}h (${days}d)`;
              }
              return `${Number(hrs.toFixed(1))}h`;
            };

            const avgPlanned = summary?.avgPlannedHours ?? 0;
            const avgActual = summary?.avgActualHours ?? 0;
            const totalTracked = summary?.totalTracked ?? 0;
            const completedTracked = summary?.completedTracked ?? 0;
            const aheadOrOnTime = summary?.aheadOrOnTimeCount ?? 0;
            const delayed = summary?.delayedCount ?? 0;
            const inProg = summary?.inProgressCount ?? 0;
            const maxAvg = Math.max(1, avgPlanned, avgActual);
            const plannedBarPct = avgPlanned > 0 ? Math.max(6, (avgPlanned / maxAvg) * 100) : 0;
            const actualBarPct = avgActual > 0 ? Math.max(6, (avgActual / maxAvg) * 100) : 0;

            const diffHours = Number((avgActual - avgPlanned).toFixed(1));
            const diffPct =
              avgPlanned > 0 ? Math.round(((avgActual - avgPlanned) / avgPlanned) * 100) : 0;
            const hasComparable = totalTracked > 0 && (avgPlanned > 0 || avgActual > 0);
            const isFasterOrOnTrack = avgActual <= avgPlanned;

            const outcomeTotal = Math.max(1, aheadOrOnTime + delayed + inProg);
            const onTimePct = Math.round((aheadOrOnTime / outcomeTotal) * 100);
            const delayedPct = Math.round((delayed / outcomeTotal) * 100);
            const inProgPct = Math.max(0, 100 - onTimePct - delayedPct);

            return (
              <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 space-y-4 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <GitCompare size={15} style={{ color: accentColor }} />
                      <h4 className="text-xs font-semibold text-white">
                        Planned vs Actual Execution Performance (Average)
                      </h4>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Overall benchmark comparing average Planned window (assigned / start → due) vs Actual execution (first status change → end status)
                    </p>
                  </div>

                  {hasComparable && (
                    <span
                      className={`px-3 py-1 rounded-xl text-[11px] font-mono font-semibold border ${
                        diffHours < 0
                          ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                          : diffHours > 0
                          ? 'bg-red-500/15 border-red-500/35 text-red-300'
                          : 'bg-sky-500/15 border-sky-500/35 text-sky-300'
                      }`}
                    >
                      {diffHours < 0
                        ? `${Math.abs(diffPct)}% Faster (${fmtHrs(Math.abs(diffHours))} under plan)`
                        : diffHours > 0
                        ? `${diffPct}% Slower (+${fmtHrs(diffHours)} over plan)`
                        : 'On Target with Plan'}
                    </span>
                  )}
                </div>

                {!summary || totalTracked === 0 ? (
                  <p className="text-xs text-zinc-500 py-6 text-center">
                    No tasks tracked yet to compute average planned vs actual performance.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                    {/* Left: Avg Planned vs Avg Actual Visual Comparison Bars */}
                    <div className="lg:col-span-7 rounded-xl bg-[#11131B] border border-[#232634] p-4 space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-zinc-300 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-sm bg-sky-400" />
                            Average Planned Time
                          </span>
                          <span className="font-mono font-semibold text-sky-300">
                            {fmtHrs(avgPlanned)}
                          </span>
                        </div>
                        <div className="h-3 rounded-full bg-[#191C26] overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${plannedBarPct}%` }}
                            transition={{ duration: 0.65, ease: 'easeOut' }}
                            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-300"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-zinc-300 flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-sm"
                              style={{ backgroundColor: isFasterOrOnTrack ? '#34D399' : '#F87171' }}
                            />
                            Average Actual Time
                          </span>
                          <span
                            className="font-mono font-semibold"
                            style={{ color: isFasterOrOnTrack ? '#6EE7B7' : '#FCA5A5' }}
                          >
                            {fmtHrs(avgActual)}
                          </span>
                        </div>
                        <div className="h-3 rounded-full bg-[#191C26] overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${actualBarPct}%` }}
                            transition={{ duration: 0.65, delay: 0.1, ease: 'easeOut' }}
                            className="h-full rounded-full"
                            style={{
                              background: isFasterOrOnTrack
                                ? 'linear-gradient(90deg, #10B981, #34D399)'
                                : 'linear-gradient(90deg, #EF4444, #F87171)',
                            }}
                          />
                        </div>
                      </div>

                      {/* Aggregate Outcome Ratio */}
                      <div className="pt-2 border-t border-[#232634] space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-zinc-400">
                          <span>Execution Outcome Mix</span>
                          <span className="font-mono">
                            {completedTracked} ended / {totalTracked} tasks
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-[#191C26] overflow-hidden flex">
                          {aheadOrOnTime > 0 && (
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${onTimePct}%` }}
                              transition={{ duration: 0.6 }}
                              className="h-full bg-emerald-400"
                              title={`Ahead / On Time: ${aheadOrOnTime}`}
                            />
                          )}
                          {inProg > 0 && (
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${inProgPct}%` }}
                              transition={{ duration: 0.6 }}
                              className="h-full bg-sky-400"
                              title={`In Execution: ${inProg}`}
                            />
                          )}
                          {delayed > 0 && (
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${delayedPct}%` }}
                              transition={{ duration: 0.6 }}
                              className="h-full bg-red-400"
                              title={`Delayed: ${delayed}`}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Summary Performance Counters */}
                    <div className="lg:col-span-5 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-[#11131B] border border-[#232634] p-3.5">
                        <span className="text-[10px] font-mono uppercase text-zinc-500 block">
                          On Time / Ahead
                        </span>
                        <span className="text-xl font-bold font-mono text-emerald-300 mt-1 block">
                          {aheadOrOnTime}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {onTimePct}% of active outcome mix
                        </span>
                      </div>
                      <div className="rounded-xl bg-[#11131B] border border-[#232634] p-3.5">
                        <span className="text-[10px] font-mono uppercase text-zinc-500 block">
                          Delayed
                        </span>
                        <span className="text-xl font-bold font-mono text-red-300 mt-1 block">
                          {delayed}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {delayedPct}% over planned due
                        </span>
                      </div>
                      <div className="rounded-xl bg-[#11131B] border border-[#232634] p-3.5">
                        <span className="text-[10px] font-mono uppercase text-zinc-500 block">
                          In Execution
                        </span>
                        <span className="text-xl font-bold font-mono text-sky-300 mt-1 block">
                          {inProg}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          Started, awaiting end status
                        </span>
                      </div>
                      <div className="rounded-xl bg-[#11131B] border border-[#232634] p-3.5">
                        <span className="text-[10px] font-mono uppercase text-zinc-500 block">
                          Avg Delta
                        </span>
                        <span
                          className={`text-xl font-bold font-mono mt-1 block ${
                            diffHours <= 0 ? 'text-emerald-300' : 'text-red-300'
                          }`}
                        >
                          {diffHours > 0 ? `+${fmtHrs(diffHours)}` : diffHours < 0 ? `-${fmtHrs(Math.abs(diffHours))}` : '0h'}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          Actual vs planned average
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Row 4: Overdue / Upcoming + Recently Updated */}
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
                          <StatusBadge status={t.status} compact customItem={statusMap.get(t.status)} />
                          <PriorityBadge
                            priority={t.priority}
                            compact
                            customItem={priorityMap.get(t.priority)}
                          />
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
                          <DevAvatarStack
                            users={t.assignees}
                            assignedTeams={t.assignedTeams}
                            max={2}
                            size="xs"
                          />
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
                      <StatusBadge
                        status={t.status}
                        compact
                        customItem={statusMap.get(t.status)}
                      />
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
