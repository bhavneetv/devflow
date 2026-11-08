import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  GitPullRequest,
  CircleDot,
  GitFork,
  ArrowRight,
  RefreshCw,
  Activity,
  BarChart3,
  GitMerge,
  GitBranch,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Gauge,
  HeartPulse,
  Clock,
  ExternalLink,
  Users,
  Settings,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { gitService } from '../../services/git.service';
import { useNavigation } from '../../context/NavigationContext';
import { GitActivityFeed } from './GitActivityFeed';
import { GitRecordDetailsDrawer } from './GitRecordDetailsDrawer';
import type { GitOverviewStats, GitActivityEvent, GitNormalizedIssue, GitNormalizedMR } from '../../types/git';
import { cn } from '../../lib/utils';

export interface GitOverviewProps {
  projectId: number;
  configuredCards?: string[];
  onNavigateToFeature?: (featureKey: string, initialFilter?: Record<string, any>) => void;
}

// ═════════════════════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════════════════════

const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const dayKey = (d: Date) => {
  const x = startOfDay(d);
  return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
};
const fmtShort = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const toDate = (v: any): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Dates / categories are read defensively since event shapes can vary per provider. */
const eventDate = (e: any): Date | null =>
  toDate(e?.createdAt || e?.timestamp || e?.occurredAt || e?.date || e?.created_at);

type Category = 'commits' | 'mrs' | 'issues' | 'other';
const categorize = (e: any): Category => {
  const t = String(e?.type || e?.action || e?.event || '').toLowerCase();
  if (/issue/.test(t)) return 'issues';
  if (/merge|pull|review|\bmr\b|\bpr\b/.test(t)) return 'mrs';
  if (/commit|push/.test(t)) return 'commits';
  return 'other';
};

const SERIES: Array<{ key: Category; label: string; color: string }> = [
  { key: 'commits', label: 'Commits', color: '#6366F1' },
  { key: 'mrs', label: 'Merge requests', color: '#10B981' },
  { key: 'issues', label: 'Issues', color: '#F59E0B' },
  { key: 'other', label: 'Other', color: '#52525B' },
];

const smoothPath = (pts: Array<{ x: number; y: number }>) => {
  if (pts.length === 0) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
  }
  return d;
};

// ═════════════════════════════════════════════════════════════════════════════
// Presentational building blocks (same design system as OrganizationOverviewView)
// ═════════════════════════════════════════════════════════════════════════════

const Panel: React.FC<{
  title: string;
  icon: React.ReactNode;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ title, icon, subtitle, right, className = '', children }) => (
  <section
    className={`rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 shadow-xl flex flex-col min-w-0 ${className}`}
  >
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-[#27272A]/70">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-[15px] text-white tracking-tight truncate">{title}</h3>
        </div>
        {subtitle && <p className="text-[11.5px] text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </header>
    {children}
  </section>
);

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center p-0.5 rounded-lg bg-[#0A0B0F] border border-[#27272A]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer font-mono text-[11px] ${
            value === o.value ? 'bg-[#1C1E26] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const SampleBadge: React.FC = () => (
  <span
    className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700"
    title="Not enough activity data yet — showing sample data"
  >
    Sample
  </span>
);

const Ring: React.FC<{ pct: number; color: string; size?: number; stroke?: number; children?: React.ReactNode }> = ({
  pct,
  color,
  size = 68,
  stroke = 7,
  children,
}) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (clamp(pct, 0, 100) / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1F2027" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
};

const StackBar: React.FC<{ parts: Array<{ key: string; label: string; value: number; color: string }> }> = ({ parts }) => {
  const total = Math.max(1, parts.reduce((s, p) => s + p.value, 0));
  return (
    <div className="flex h-1.5 gap-[2px] rounded-full overflow-hidden bg-zinc-800">
      {parts
        .filter((p) => p.value > 0)
        .map((p, i) => (
          <motion.div
            key={p.key}
            initial={{ width: 0 }}
            animate={{ width: `${(p.value / total) * 100}%` }}
            transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
            style={{ backgroundColor: p.color }}
            title={`${p.label}: ${p.value}`}
          />
        ))}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// Skeleton Loading Screen (matches OrganizationOverviewView 8-col left / 4-col right)
// ═════════════════════════════════════════════════════════════════════════════

const GitOverviewSkeleton: React.FC = () => (
  <div className="space-y-5 animate-pulse text-left">
    {/* Header Skeleton */}
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#27272A]/70">
      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-48 h-7 rounded-lg bg-zinc-800/80" />
          <div className="w-24 h-5 rounded-md bg-zinc-800/60" />
          <div className="w-20 h-5 rounded-md bg-zinc-800/60" />
        </div>
        <div className="w-80 h-4 rounded bg-zinc-800/50" />
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-32 h-6 rounded bg-zinc-800/40 hidden sm:block" />
        <div className="w-8 h-8 rounded-lg bg-zinc-800/80" />
        <div className="w-28 h-8 rounded-lg bg-zinc-800/80" />
        <div className="w-28 h-8 rounded-lg bg-zinc-800/80" />
      </div>
    </div>

    {/* Upper Dashboard Grid: Left 8-cols (Summary Cards + Trend) | Right 4-cols (Identity + Feed) */}
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left Column (8 cols) */}
      <div className="lg:col-span-8 space-y-5">
        {/* 4 Summary Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-[#0E0F14]/90 border border-[#27272A] p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <div className="w-16 h-3 rounded bg-zinc-800/70" />
                  <div className="w-12 h-7 rounded bg-zinc-800/90" />
                </div>
                <div className="w-9 h-9 rounded-xl bg-zinc-800/70" />
              </div>
              <div className="w-full h-2 rounded-full bg-zinc-800/50" />
              <div className="w-28 h-3 rounded bg-zinc-800/40" />
            </div>
          ))}
        </div>

        {/* Chart Panel Skeleton */}
        <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#27272A]/70">
            <div className="space-y-1">
              <div className="w-36 h-4 rounded bg-zinc-800/80" />
              <div className="w-56 h-3 rounded bg-zinc-800/50" />
            </div>
            <div className="w-28 h-7 rounded-lg bg-zinc-800/60" />
          </div>
          <div className="h-52 w-full rounded-xl bg-zinc-800/30" />
        </div>
      </div>

      {/* Right Column (4 cols) */}
      <div className="lg:col-span-4 space-y-5">
        <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-zinc-800/80 shrink-0" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="w-28 h-4 rounded bg-zinc-800/80" />
              <div className="w-20 h-3 rounded bg-zinc-800/50" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-zinc-800/50" />
            ))}
          </div>
          <div className="space-y-2.5 pt-3 border-t border-[#27272A]/70">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="w-20 h-3 rounded bg-zinc-800/60" />
                <div className="w-24 h-3 rounded bg-zinc-800/70" />
              </div>
            ))}
          </div>
        </div>
        <div className="h-60 rounded-2xl bg-[#0E0F14]/95 border border-[#27272A]" />
      </div>
    </div>
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════
// Main view
// ═════════════════════════════════════════════════════════════════════════════

type TrendRange = '14d' | '30d' | 'quarter';
const HEAT_WEEKS = 16;

export const GitOverview: React.FC<GitOverviewProps> = ({ projectId, onNavigateToFeature }) => {
  const navigate = useNavigate();
  const { activeProject } = useNavigation();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<GitOverviewStats>({
    totalRepositories: 0,
    openIssues: 0,
    closedIssues: 0,
    openMergeRequests: 0,
    mrsAwaitingReview: 0,
    approvedMrs: 0,
    mergedMrs: 0,
    mrsWithConflicts: 0,
    recentCommitsCount: 0,
  });
  const [activity, setActivity] = useState<GitActivityEvent[]>([]);
  const [recentIssues, setRecentIssues] = useState<GitNormalizedIssue[]>([]);
  const [recentMrs, setRecentMrs] = useState<GitNormalizedMR[]>([]);
  const [trendRange, setTrendRange] = useState<TrendRange>('30d');
  const [hoveredBucket, setHoveredBucket] = useState<number | null>(null);
  const [hoveredHeat, setHoveredHeat] = useState<{ date: Date; count: number } | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const [selectedRecord, setSelectedRecord] = useState<{
    type: 'issue' | 'mr';
    repoId: number;
    number: number;
  } | null>(null);

  const today = useMemo(() => startOfDay(new Date()), []);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const res = await gitService.getOverview(projectId);
      if (res.success && res.data) {
        setStats(res.data.stats);
        setActivity(res.data.activity);
        setRecentIssues(res.data.recentIssues);
        setRecentMrs(res.data.recentMergeRequests);
      }
    } catch (err) {
      console.error('Failed to load git overview:', err);
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [projectId]);

  const goTo = (feature: string, path: string, filter?: Record<string, any>) => {
    if (onNavigateToFeature) onNavigateToFeature(feature, filter);
    else {
      let url = `/projects/${projectId}/${path}`;
      if (filter) {
        const params = new URLSearchParams();
        Object.entries(filter).forEach(([k, v]) => params.append(k, String(v)));
        url += `?${params.toString()}`;
      }
      navigate(url);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Derived metrics
  // ═══════════════════════════════════════════════════════════════════════════
  const totalIssues = stats.openIssues + stats.closedIssues;
  const issueCloseRate = Math.round((stats.closedIssues / Math.max(totalIssues, 1)) * 100);
  const totalMrs = stats.openMergeRequests + stats.mergedMrs;
  const mergeRate = Math.round((stats.mergedMrs / Math.max(totalMrs, 1)) * 100);
  const conflictRate = Math.round((stats.mrsWithConflicts / Math.max(stats.openMergeRequests, 1)) * 100);
  const reviewBacklog = Math.round((stats.mrsAwaitingReview / Math.max(stats.openMergeRequests, 1)) * 100);
  const healthScore = clamp(100 - Math.round(conflictRate * 0.6 + reviewBacklog * 0.4), 0, 100);
  const healthColor = healthScore >= 75 ? '#10B981' : healthScore >= 50 ? '#F59E0B' : '#F43F5E';
  const healthLabel = healthScore >= 75 ? 'Healthy' : healthScore >= 50 ? 'Needs attention' : 'At risk';

  // ═══════════════════════════════════════════════════════════════════════════
  // GRAPH 1 — Activity trend (stacked bars by event type + 3-pt trend line)
  // ═══════════════════════════════════════════════════════════════════════════
  const trend = useMemo(() => {
    const cfg =
      trendRange === '14d'
        ? { buckets: 14, step: 1 }
        : trendRange === '30d'
          ? { buckets: 15, step: 2 }
          : { buckets: 13, step: 7 };
    const windowStart = addDays(today, -(cfg.buckets * cfg.step) + 1);
    const dated = activity.map((e) => ({ d: eventDate(e), c: categorize(e) })).filter((x) => x.d !== null);
    const usingSample = dated.length === 0;

    const points = Array.from({ length: cfg.buckets }, (_, i) => {
      const from = addDays(windowStart, i * cfg.step);
      const to = addDays(from, cfg.step);
      const counts: Record<Category, number> = { commits: 0, mrs: 0, issues: 0, other: 0 };
      if (!usingSample) {
        dated.forEach((x) => {
          if (x.d! >= from && x.d! < to) counts[x.c]++;
        });
      } else {
        const m = cfg.step > 2 ? 3 : 1;
        counts.commits = Math.round((4 + Math.cos(i * 0.7) * 2.5 + i * 0.2) * m);
        counts.mrs = Math.round((2 + Math.sin(i * 0.6) * 1.5 + i * 0.1) * m);
        counts.issues = Math.round((1.5 + Math.cos(i * 0.9) * 1.2) * m);
      }
      const total = counts.commits + counts.mrs + counts.issues + counts.other;
      return {
        label: fmtShort(from),
        rangeLabel: cfg.step === 1 ? fmtShort(from) : `${fmtShort(from)} – ${fmtShort(addDays(to, -1))}`,
        counts,
        total,
      };
    });

    const withTrend = points.map((p, i) => {
      const slice = points.slice(Math.max(0, i - 2), i + 1);
      return { ...p, trend: slice.reduce((s, x) => s + x.total, 0) / slice.length };
    });
    const half = Math.floor(withTrend.length / 2);
    const first = withTrend.slice(0, half).reduce((s, p) => s + p.total, 0);
    const second = withTrend.slice(half).reduce((s, p) => s + p.total, 0);
    const delta = first > 0 ? Math.round(((second - first) / first) * 100) : 0;
    const totals = SERIES.reduce(
      (acc, s) => ({ ...acc, [s.key]: withTrend.reduce((sum, p) => sum + p.counts[s.key], 0) }),
      {} as Record<Category, number>
    );
    const total = withTrend.reduce((s, p) => s + p.total, 0);
    return { points: withTrend, delta, totals, total, usingSample };
  }, [activity, trendRange, today]);

  const TC = { w: 640, h: 220, top: 16, right: 12, bottom: 26, left: 32 };
  const tInnerW = TC.w - TC.left - TC.right;
  const tInnerH = TC.h - TC.top - TC.bottom;
  const tMax = Math.max(4, ...trend.points.map((p) => p.total));
  const tNiceMax = Math.ceil(tMax / 4) * 4;
  const bucketW = tInnerW / trend.points.length;
  const barW = Math.max(6, bucketW * 0.6);
  const yScale = (v: number) => TC.top + tInnerH - (v / tNiceMax) * tInnerH;
  const trendPath = smoothPath(
    trend.points.map((p, i) => ({ x: TC.left + bucketW * i + bucketW / 2, y: yScale(p.trend) }))
  );
  const labelEvery = trend.points.length > 10 ? 2 : 1;

  // ═══════════════════════════════════════════════════════════════════════════
  // GRAPH 2 — Merge request pipeline (funnel from live stats)
  // ═══════════════════════════════════════════════════════════════════════════
  const pipeline = useMemo(() => {
    const rows = [
      { key: 'open', label: 'Open', value: stats.openMergeRequests, color: '#6366F1' },
      { key: 'review', label: 'Awaiting review', value: stats.mrsAwaitingReview, color: '#F59E0B' },
      { key: 'approved', label: 'Approved', value: stats.approvedMrs, color: '#06B6D4' },
      { key: 'merged', label: 'Merged', value: stats.mergedMrs, color: '#10B981' },
    ];
    const max = Math.max(1, ...rows.map((r) => r.value));
    return { rows, max };
  }, [stats]);

  // ═══════════════════════════════════════════════════════════════════════════
  // GRAPH 3 — Activity heatmap (16 weeks)
  // ═══════════════════════════════════════════════════════════════════════════
  const heatmap = useMemo(() => {
    const counts = new Map<string, number>();
    activity.forEach((e) => {
      const d = eventDate(e);
      if (d) counts.set(dayKey(d), (counts.get(dayKey(d)) || 0) + 1);
    });
    const usingSample = counts.size === 0;
    const gridStart = addDays(today, -today.getDay() - (HEAT_WEEKS - 1) * 7);
    const weeks: Array<Array<{ date: Date; count: number; future: boolean }>> = [];
    let max = 1;
    for (let w = 0; w < HEAT_WEEKS; w++) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(gridStart, w * 7 + d);
        const future = date > today;
        const weekend = d === 0 || d === 6;
        const count = future
          ? 0
          : usingSample
            ? ((w * 7 + d) * 37) % 11 > 4
              ? ((w * 13 + d * 7) % 9) + (weekend ? 0 : 2)
              : weekend
                ? 0
                : 1
            : counts.get(dayKey(date)) || 0;
        max = Math.max(max, count);
        col.push({ date, count, future });
      }
      weeks.push(col);
    }
    const total = weeks.flat().reduce((s, c) => s + c.count, 0);
    let streak = 0;
    let best = 0;
    weeks.flat().forEach((c) => {
      if (c.future) return;
      streak = c.count > 0 ? streak + 1 : 0;
      best = Math.max(best, streak);
    });
    return { weeks, max, total, best, usingSample };
  }, [activity, today]);

  const heatColor = (count: number, max: number) => {
    if (count === 0) return '#16171D';
    const t = count / max;
    if (t < 0.25) return '#312E81';
    if (t < 0.5) return '#4338CA';
    if (t < 0.75) return '#6366F1';
    return '#A5B4FC';
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Needs Attention Radar
  // ═══════════════════════════════════════════════════════════════════════════
  const gitAttention = useMemo(() => {
    const items: Array<{ id: string; level: number; icon: React.ReactNode; text: string; meta: string; action: () => void }> = [];
    if (stats.mrsWithConflicts > 0) {
      items.push({
        id: 'conflicts',
        level: 0,
        icon: <AlertTriangle size={13} className="text-rose-400 shrink-0" />,
        text: `${stats.mrsWithConflicts} merge request${stats.mrsWithConflicts === 1 ? '' : 's'} with conflicts`,
        meta: 'High risk · Merge blocked',
        action: () => goTo('git.merge_requests', 'pulls', { hasConflicts: true }),
      });
    }
    if (stats.mrsAwaitingReview > 0) {
      items.push({
        id: 'review',
        level: 1,
        icon: <Clock size={13} className="text-amber-400 shrink-0" />,
        text: `${stats.mrsAwaitingReview} merge request${stats.mrsAwaitingReview === 1 ? '' : 's'} awaiting review`,
        meta: 'Review backlog',
        action: () => goTo('git.merge_requests', 'pulls', { awaitingReview: true }),
      });
    }
    if (stats.openIssues > 0) {
      items.push({
        id: 'issues',
        level: 2,
        icon: <CircleDot size={13} className="text-amber-400 shrink-0" />,
        text: `${stats.openIssues} open git issue${stats.openIssues === 1 ? '' : 's'} pending`,
        meta: 'Repository backlog',
        action: () => goTo('git.issues', 'issues', { state: 'open' }),
      });
    }
    items.push({
      id: 'mapping',
      level: 3,
      icon: <Users size={13} className="text-indigo-400 shrink-0" />,
      text: 'Git author member mappings',
      meta: 'Link commit authors to team members',
      action: () => navigate(`/projects/${projectId}/settings`),
    });
    return items;
  }, [stats, projectId]);

  // ═══════════════════════════════════════════════════════════════════════════
  if (loading && !hasLoadedOnce) return <GitOverviewSkeleton />;

  return (
    <div className="space-y-5 text-left">
      {/* ═══ HEADER (No left icon, text-side badges, page path on right side just like OrganizationOverviewView) ═══ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#27272A]/70">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-[28px] font-extrabold text-white tracking-tight leading-tight truncate">
              Git Overview
            </h1>
            <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold border bg-indigo-500/10 border-indigo-500/30 text-indigo-400">
              /git-overview
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider font-mono border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Sync
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
              <GitFork size={11} className="text-indigo-400" />
              {stats.totalRepositories} {stats.totalRepositories === 1 ? 'Repo' : 'Repos'}
            </span>
          </div>
          <p className="text-[13.5px] text-zinc-400 mt-1 truncate">
            Live repository intelligence, merge request pipelines, and unified cross-repo activity stream.
          </p>
        </div>

        {/* Right side: Page Path + Actions */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono mr-1 hidden sm:flex">
            <Link to={`/projects/${projectId}`} className="hover:text-white transition-colors">
              {activeProject?.title || 'Project'}
            </Link>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-200 font-medium">git-overview</span>
          </div>

          <button
            type="button"
            onClick={fetchOverview}
            disabled={loading}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#27272A] text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-60"
            title="Refresh metrics"
          >
            <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
          </button>
          <button
            type="button"
            onClick={() => goTo('git.repositories', 'repositories')}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#27272A] text-zinc-200 hover:text-white hover:bg-white/[0.06] text-[12px] font-medium transition-colors cursor-pointer"
          >
            <GitFork size={13} className="text-zinc-400" />
            <span>Manage Repos</span>
          </button>
          <button
            type="button"
            onClick={() => navigate(`/projects/${projectId}/settings`)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 hover:text-white text-[12px] font-medium transition-colors cursor-pointer"
          >
            <Settings size={13} />
            <span>Git Settings</span>
          </button>
        </div>
      </div>

      {/* ═══ UPPER DASHBOARD GRID: LEFT (8-COL: SUMMARY CARDS + TREND) | RIGHT (4-COL: HUB + ATTENTION) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ─── LEFT COLUMN (lg:col-span-8) ──────────────────────────────────── */}
        <div className="lg:col-span-8 space-y-5 min-w-0">
          {/* 4 Summary Cards (Inside left column, exactly matching OrganizationOverviewView) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Card 1: Repositories & Sync */}
            <div
              onClick={() => goTo('git.repositories', 'repositories')}
              className="group rounded-2xl bg-[#0E0F14]/90 border border-[#27272A] hover:border-cyan-500/40 p-4 transition-colors cursor-pointer text-left shadow-xl"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10.5px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                    Repositories
                  </div>
                  <div className="text-3xl font-extrabold text-white font-mono tracking-tight mt-1">
                    {stats.totalRepositories}
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                  <GitFork size={17} />
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-cyan-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${clamp(stats.recentCommitsCount * 4, 20, 100)}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                  <span>{stats.recentCommitsCount} commits</span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Merge Requests */}
            <div
              onClick={() => goTo('git.merge_requests', 'pulls')}
              className="group rounded-2xl bg-[#0E0F14]/90 border border-[#27272A] hover:border-indigo-500/40 p-4 transition-colors cursor-pointer text-left shadow-xl"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10.5px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                    Merge Requests
                  </div>
                  <div className="text-3xl font-extrabold text-white font-mono tracking-tight mt-1">
                    {mergeRate}
                    <span className="text-base text-zinc-500 font-normal">%</span>
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
                  <GitPullRequest size={17} />
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <StackBar
                  parts={[
                    { key: 'open', label: 'Open', value: stats.openMergeRequests, color: '#6366F1' },
                    { key: 'review', label: 'Awaiting Review', value: stats.mrsAwaitingReview, color: '#F59E0B' },
                    { key: 'approved', label: 'Approved', value: stats.approvedMrs, color: '#06B6D4' },
                    { key: 'merged', label: 'Merged', value: stats.mergedMrs, color: '#10B981' },
                  ]}
                />
                <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                  <span>{stats.openMergeRequests} open</span>
                  <span>{stats.mergedMrs} merged</span>
                </div>
              </div>
            </div>

            {/* Card 3: Git Issues */}
            <div
              onClick={() => goTo('git.issues', 'issues', { state: 'open' })}
              className="group rounded-2xl bg-[#0E0F14]/90 border border-[#27272A] hover:border-amber-500/40 p-4 transition-colors cursor-pointer text-left shadow-xl"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10.5px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                    Git Issues
                  </div>
                  <div className="text-3xl font-extrabold text-white font-mono tracking-tight mt-1">
                    {stats.openIssues}
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                  <CircleDot size={17} />
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <StackBar
                  parts={[
                    { key: 'open', label: 'Open', value: stats.openIssues, color: '#F59E0B' },
                    { key: 'closed', label: 'Closed', value: stats.closedIssues, color: '#10B981' },
                  ]}
                />
                <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                  <span>{stats.closedIssues} closed</span>
                  <span>{issueCloseRate}% rate</span>
                </div>
              </div>
            </div>

            {/* Card 4: Git Health (Ring Gauge matching Organization Completion card) */}
            <div className="rounded-2xl bg-[#0E0F14]/90 border border-[#27272A] p-4 flex items-center gap-4 shadow-xl">
              <Ring pct={healthScore} color={healthColor} size={68} stroke={7}>
                <span className="text-sm font-bold font-mono text-white">{healthScore}</span>
              </Ring>
              <div className="min-w-0">
                <div className="text-[10.5px] font-mono font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  <HeartPulse size={12} style={{ color: healthColor }} /> Health
                </div>
                <div className="text-[13px] font-semibold mt-1" style={{ color: healthColor }}>
                  {healthLabel}
                </div>
                <div className="text-[10.5px] font-mono text-zinc-500 mt-0.5 truncate">
                  {stats.mrsWithConflicts} conflicts · {stats.mrsAwaitingReview} review
                </div>
              </div>
            </div>
          </div>

          {/* Graph 1: Activity trend */}
          <Panel
            icon={<BarChart3 size={16} className="text-indigo-400" />}
            title="Repository Activity"
            subtitle="Events per period by type, with 3-period trend"
            right={
              <div className="flex items-center gap-2">
                {trend.usingSample && <SampleBadge />}
                <Segmented<TrendRange>
                  value={trendRange}
                  onChange={setTrendRange}
                  options={[
                    { value: '14d', label: '14D' },
                    { value: '30d', label: '30D' },
                    { value: 'quarter', label: 'QTR' },
                  ]}
                />
              </div>
            }
          >
            <div className="flex flex-wrap items-end gap-x-8 gap-y-2 mb-3">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Total events</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono text-white">{trend.total}</span>
                  <span
                    className={`inline-flex items-center gap-0.5 text-[11px] font-mono font-semibold ${
                      trend.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {trend.delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {trend.delta >= 0 ? '+' : ''}
                    {trend.delta}%
                  </span>
                </div>
              </div>
              {SERIES.filter((s) => s.key !== 'other').map((s) => (
                <div key={s.key}>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{s.label}</div>
                  <div className="text-2xl font-bold font-mono text-zinc-300">{trend.totals[s.key]}</div>
                </div>
              ))}
            </div>

            <div className="relative w-full" onMouseLeave={() => setHoveredBucket(null)}>
              <svg viewBox={`0 0 ${TC.w} ${TC.h}`} className="w-full h-auto overflow-visible">
                {[0, 0.25, 0.5, 0.75, 1].map((f) => {
                  const y = TC.top + tInnerH * f;
                  return (
                    <g key={f}>
                      <line x1={TC.left} x2={TC.w - TC.right} y1={y} y2={y} stroke="#1F2027" strokeWidth="1" />
                      <text x={TC.left - 8} y={y + 3} fill="#52525B" fontSize="9" fontFamily="monospace" textAnchor="end">
                        {Math.round(tNiceMax * (1 - f))}
                      </text>
                    </g>
                  );
                })}

                {trend.points.map((p, i) => {
                  const cx = TC.left + bucketW * i + bucketW / 2;
                  const isHover = hoveredBucket === i;
                  const dim = hoveredBucket !== null && !isHover;
                  let acc = 0;
                  return (
                    <g key={i} onMouseEnter={() => setHoveredBucket(i)} className="cursor-pointer">
                      {isHover && (
                        <rect x={TC.left + bucketW * i} y={TC.top} width={bucketW} height={tInnerH} fill="#ffffff" opacity="0.03" />
                      )}
                      {SERIES.map((s, si) => {
                        const v = p.counts[s.key];
                        if (v === 0) return null;
                        const h = (v / tNiceMax) * tInnerH;
                        const y = TC.top + tInnerH - ((acc + v) / tNiceMax) * tInnerH;
                        acc += v;
                        return (
                          <motion.rect
                            key={s.key}
                            x={cx - barW / 2}
                            width={barW}
                            rx={si === 0 ? 2 : 0}
                            fill={s.color}
                            opacity={dim ? 0.3 : 0.9}
                            initial={{ y: TC.top + tInnerH, height: 0 }}
                            animate={{ y, height: h }}
                            transition={{ duration: 0.5, delay: i * 0.02, ease: 'easeOut' }}
                          />
                        );
                      })}
                      <rect x={TC.left + bucketW * i} y={TC.top} width={bucketW} height={tInnerH} fill="transparent" />
                      {(i % labelEvery === 0 || i === trend.points.length - 1) && (
                        <text x={cx} y={TC.h - 8} fill={isHover ? '#E4E4E7' : '#52525B'} fontSize="9" fontFamily="monospace" textAnchor="middle">
                          {p.label}
                        </text>
                      )}
                    </g>
                  );
                })}

                <motion.path
                  d={trendPath}
                  fill="none"
                  stroke="#FBBF24"
                  strokeWidth="2"
                  strokeLinecap="round"
                  pointerEvents="none"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                />
                {hoveredBucket !== null && (
                  <circle
                    cx={TC.left + bucketW * hoveredBucket + bucketW / 2}
                    cy={yScale(trend.points[hoveredBucket].trend)}
                    r="4"
                    fill="#FBBF24"
                    stroke="#0E0F14"
                    strokeWidth="2"
                    pointerEvents="none"
                  />
                )}
              </svg>

              {hoveredBucket !== null && (
                <div
                  className="absolute top-0 pointer-events-none p-2.5 rounded-lg bg-[#0A0B0F]/95 border border-[#27272A] shadow-xl text-[11px] space-y-1 min-w-[150px] -translate-x-1/2"
                  style={{
                    left: `${clamp(((TC.left + bucketW * hoveredBucket + bucketW / 2) / TC.w) * 100, 14, 86)}%`,
                  }}
                >
                  <div className="font-mono text-[10px] text-zinc-400">{trend.points[hoveredBucket].rangeLabel}</div>
                  {SERIES.map((s) => (
                    <div key={s.key} className="flex justify-between gap-4">
                      <span className="flex items-center gap-1.5 text-zinc-300">
                        <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: s.color }} />
                        {s.label}
                      </span>
                      <span className="font-mono font-bold text-white">{trend.points[hoveredBucket].counts[s.key]}</span>
                    </div>
                  ))}
                  <div className="flex justify-between gap-4 pt-1 border-t border-[#27272A]">
                    <span className="flex items-center gap-1.5 text-zinc-300">
                      <span className="w-2 h-0.5 bg-amber-400" />
                      Trend
                    </span>
                    <span className="font-mono text-zinc-300">{trend.points[hoveredBucket].trend.toFixed(1)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px] text-zinc-400 mt-2">
              {SERIES.filter((s) => s.key !== 'other').map((s) => (
                <span key={s.key} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                  {s.label}
                </span>
              ))}
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded bg-amber-400" />
                Trend
              </span>
            </div>
          </Panel>

          {/* Graph 2: MR Pipeline funnel */}
          <Panel
            icon={<GitPullRequest size={16} className="text-violet-400" />}
            title="Merge Request Pipeline"
            subtitle="Distribution of open code reviews and merges"
          >
            <div className="space-y-3">
              {pipeline.rows.map((r, i) => (
                <div key={r.key} className="flex items-center gap-3 text-xs">
                  <span className="w-[104px] text-zinc-400 shrink-0 truncate">{r.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-[#16171D] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(r.value / pipeline.max) * 100}%` }}
                      transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                      style={{ backgroundColor: r.color }}
                    />
                  </div>
                  <span className="w-7 text-right font-mono text-[11px] text-white">{r.value}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => goTo('git.merge_requests', 'pulls', { hasConflicts: true })}
              className={`mt-4 w-full flex items-center justify-between px-3 py-2 rounded-xl border text-[11.5px] transition-colors cursor-pointer ${
                stats.mrsWithConflicts > 0
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-300 hover:bg-rose-500/15'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/15'
              }`}
            >
              <span className="flex items-center gap-2">
                {stats.mrsWithConflicts > 0 ? <AlertTriangle size={13} /> : <CheckCircle size={13} />}
                {stats.mrsWithConflicts > 0
                  ? `${stats.mrsWithConflicts} merge request${stats.mrsWithConflicts === 1 ? '' : 's'} with conflicts`
                  : 'No merge conflicts detected'}
              </span>
              <ArrowRight size={12} />
            </button>
          </Panel>

          {/* Graph 3: Contribution Heatmap */}
          <Panel
            icon={<Activity size={16} className="text-indigo-400" />}
            title="Contribution Heatmap"
            subtitle={`Repository events over the last ${HEAT_WEEKS} weeks`}
            right={heatmap.usingSample ? <SampleBadge /> : undefined}
          >
            <div className="flex flex-wrap gap-x-8 gap-y-2 mb-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Events</div>
                <div className="text-xl font-bold font-mono text-white">{heatmap.total}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Daily avg</div>
                <div className="text-xl font-bold font-mono text-zinc-300">{(heatmap.total / (HEAT_WEEKS * 7)).toFixed(1)}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Best streak</div>
                <div className="text-xl font-bold font-mono text-indigo-400">{heatmap.best}d</div>
              </div>
            </div>

            <div className="relative overflow-x-auto">
              <div className="inline-flex gap-2 min-w-full">
                <div className="flex flex-col gap-[3px] pt-4 text-[9px] font-mono text-zinc-600 shrink-0">
                  {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((d, i) => (
                    <span key={i} className="h-[13px] leading-[13px]">
                      {d}
                    </span>
                  ))}
                </div>
                <div className="flex-1">
                  <div className="flex gap-[3px] h-4 text-[9px] font-mono text-zinc-500">
                    {heatmap.weeks.map((w, i) => {
                      const first = w[0].date;
                      const showMonth = i === 0 || first.getMonth() !== heatmap.weeks[i - 1][0].date.getMonth();
                      return (
                        <span key={i} className="flex-1 min-w-[13px] whitespace-nowrap">
                          {showMonth ? first.toLocaleDateString('en-US', { month: 'short' }) : ''}
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex gap-[3px]">
                    {heatmap.weeks.map((w, wi) => (
                      <div key={wi} className="flex-1 min-w-[13px] flex flex-col gap-[3px]">
                        {w.map((c, di) => (
                          <div
                            key={di}
                            className={`h-[13px] rounded-[3px] transition-transform ${c.future ? 'opacity-0' : 'hover:scale-125 cursor-pointer'}`}
                            style={{ backgroundColor: heatColor(c.count, heatmap.max) }}
                            onMouseEnter={() => !c.future && setHoveredHeat(c)}
                            onMouseLeave={() => setHoveredHeat(null)}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 text-[10px] font-mono text-zinc-500">
              <span className="h-4">
                {hoveredHeat
                  ? `${hoveredHeat.count} event${hoveredHeat.count === 1 ? '' : 's'} on ${hoveredHeat.date.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}`
                  : 'Hover a cell for details'}
              </span>
              <span className="flex items-center gap-1">
                Less
                {[0, 0.2, 0.45, 0.7, 1].map((f, i) => (
                  <span key={i} className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: heatColor(f * heatmap.max, heatmap.max) }} />
                ))}
                More
              </span>
            </div>
          </Panel>

          {/* Recent Records: MRs & Issues Side-by-Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Recent MRs */}
            <Panel
              icon={<GitPullRequest size={16} className="text-indigo-400" />}
              title="Recent Merge Requests"
              right={
                <button
                  type="button"
                  onClick={() => goTo('git.merge_requests', 'pulls')}
                  className="text-[11px] text-zinc-400 hover:text-white font-mono flex items-center gap-1 cursor-pointer"
                >
                  All ({stats.openMergeRequests}) <ArrowRight size={11} />
                </button>
              }
            >
              {recentMrs.length === 0 ? (
                <p className="text-xs text-zinc-500 italic py-6 text-center">
                  No active merge requests found.
                </p>
              ) : (
                <div className="divide-y divide-[#1C1D23] rounded-xl border border-[#1F2027] overflow-hidden">
                  {recentMrs.slice(0, 5).map((mr) => (
                    <button
                      key={mr.id}
                      type="button"
                      onClick={() => {
                        if (mr.repositoryId) setSelectedRecord({ type: 'mr', repoId: mr.repositoryId, number: mr.number });
                      }}
                      className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 bg-[#101116] hover:bg-[#14151B] transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${mr.hasConflicts ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold text-indigo-400">#{mr.number}</span>
                            <span className="text-xs font-medium text-zinc-200 group-hover:text-white truncate">{mr.title}</span>
                          </div>
                          <span className="text-[11px] text-zinc-500 font-mono truncate block">
                            {mr.sourceBranch} → {mr.targetBranch}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {mr.hasConflicts && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Conflict
                          </span>
                        )}
                        <ArrowRight size={13} className="text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Panel>

            {/* Recent Issues */}
            <Panel
              icon={<CircleDot size={16} className="text-amber-400" />}
              title="Recent Git Issues"
              right={
                <button
                  type="button"
                  onClick={() => goTo('git.issues', 'issues')}
                  className="text-[11px] text-zinc-400 hover:text-white font-mono flex items-center gap-1 cursor-pointer"
                >
                  All ({stats.openIssues}) <ArrowRight size={11} />
                </button>
              }
            >
              {recentIssues.length === 0 ? (
                <p className="text-xs text-zinc-500 italic py-6 text-center">No open issues found.</p>
              ) : (
                <div className="divide-y divide-[#1C1D23] rounded-xl border border-[#1F2027] overflow-hidden">
                  {recentIssues.slice(0, 5).map((iss) => (
                    <button
                      key={iss.id}
                      type="button"
                      onClick={() => {
                        if (iss.repositoryId) setSelectedRecord({ type: 'issue', repoId: iss.repositoryId, number: iss.number });
                      }}
                      className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 bg-[#101116] hover:bg-[#14151B] transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold text-amber-400">#{iss.number}</span>
                            <span className="text-xs font-medium text-zinc-200 group-hover:text-white truncate">{iss.title}</span>
                          </div>
                          <span className="text-[11px] text-zinc-500">opened by {iss.author.name || iss.author.username}</span>
                        </div>
                      </div>
                      <ArrowRight size={13} className="text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>

        {/* ─── RIGHT SIDEBAR (lg:col-span-4) ─────────────────────────────────── */}
        <div className="lg:col-span-4 space-y-5 min-w-0">
          {/* Identity & Launchpad Card */}
          <section className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl shrink-0 shadow-md flex items-center justify-center font-bold text-white text-sm font-mono bg-gradient-to-br from-indigo-500 to-purple-600">
                {(activeProject?.title || 'GIT').slice(0, 3).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm text-white truncate">
                    {activeProject?.title || 'DevFlow Repositories'}
                  </h3>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                    Live sync
                  </span>
                </div>
                <p className="text-[11px] truncate font-mono mt-0.5 text-zinc-400">
                  Connected Git Hub
                </p>
              </div>
            </div>

            {/* 4-Button Launchpad */}
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { action: () => goTo('git.repositories', 'repositories'), icon: <GitFork size={14} />, label: 'Repos', hover: 'group-hover:text-cyan-400' },
                { action: () => goTo('git.merge_requests', 'pulls'), icon: <GitPullRequest size={14} />, label: 'PRs', hover: 'group-hover:text-indigo-400' },
                { action: () => goTo('git.issues', 'issues'), icon: <CircleDot size={14} />, label: 'Issues', hover: 'group-hover:text-amber-400' },
                { action: () => navigate(`/projects/${projectId}/settings`), icon: <Settings size={14} />, label: 'Settings', hover: 'group-hover:text-emerald-400' },
              ].map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={q.action}
                  className="group flex flex-col items-center gap-1 py-2.5 rounded-xl bg-[#111216] border border-[#27272A] hover:border-zinc-600 hover:bg-white/[0.03] transition-all cursor-pointer"
                >
                  <span className={`text-zinc-400 transition-colors ${q.hover}`}>{q.icon}</span>
                  <span className="text-[10px] text-zinc-300 font-medium">{q.label}</span>
                </button>
              ))}
            </div>

            {/* Metadata list */}
            <dl className="space-y-2 text-xs pt-3 border-t border-[#27272A]/70">
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-zinc-500"><GitFork size={12} /> Connected Repos</dt>
                <dd className="text-zinc-200 font-mono font-medium">{stats.totalRepositories}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-zinc-500"><GitPullRequest size={12} /> Open PRs</dt>
                <dd className="text-zinc-300 font-mono text-[11px]">{stats.openMergeRequests}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-zinc-500"><Clock size={12} /> Review Backlog</dt>
                <dd className="text-zinc-300 font-mono text-[11px]">{stats.mrsAwaitingReview} pending</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-zinc-500"><CheckCircle size={12} /> Merge Rate</dt>
                <dd className="text-emerald-400 font-mono text-[11px] font-semibold">{mergeRate}%</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-zinc-500"><AlertTriangle size={12} /> Conflicts</dt>
                <dd className={`font-mono text-[11px] font-semibold ${stats.mrsWithConflicts > 0 ? 'text-rose-400' : 'text-zinc-400'}`}>
                  {stats.mrsWithConflicts > 0 ? `${stats.mrsWithConflicts} detected` : 'None'}
                </dd>
              </div>
            </dl>
          </section>

          {/* Needs Attention / Git Risks */}
          <Panel
            icon={<AlertTriangle size={16} className="text-amber-400" />}
            title="Needs Attention"
            subtitle="Most urgent git items first"
          >
            {gitAttention.length === 0 ? (
              <p className="text-xs text-zinc-500 italic py-6 text-center">
                No blocking git risks detected. All repositories and merge requests are healthy.
              </p>
            ) : (
              <div className="space-y-1">
                {gitAttention.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.action}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-[#101116] hover:bg-[#14151B] transition-colors text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {item.icon}
                      <div className="min-w-0">
                        <div className="text-xs text-zinc-200 group-hover:text-white truncate">
                          {item.text}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-500">{item.meta}</div>
                      </div>
                    </div>
                    <ArrowRight size={12} className="text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </Panel>

          {/* Live Activity Stream */}
          <Panel
            icon={<Activity size={16} className="text-blue-400" />}
            title="Live Feed"
            subtitle="Unified repository stream"
          >
            <div className="overflow-y-auto max-h-[500px] -mx-1 px-1 scrollbar-thin scrollbar-thumb-zinc-700">
              <GitActivityFeed events={activity} loading={loading} />
            </div>
          </Panel>
        </div>
      </div>

      {/* Shared Details Drawer */}
      {selectedRecord && (
        <GitRecordDetailsDrawer
          projectId={projectId}
          isOpen={true}
          onClose={() => setSelectedRecord(null)}
          recordType={selectedRecord.type}
          repoId={selectedRecord.repoId}
          recordNumber={selectedRecord.number}
          onRecordUpdated={fetchOverview}
        />
      )}
    </div>
  );
};
