import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  FolderKanban,
  Layers,
  CheckSquare,
  Plus,
  ArrowRight,
  Shield,
  Activity,
  Building2,
  ExternalLink,
  UserPlus,
  Settings,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Rocket,
  Zap,
  Globe,
  Calendar,
  BarChart3,
  PieChart,
  Server,
  CheckCircle,
  GanttChartSquare,
  Flame,
  AlertTriangle,
} from 'lucide-react';
import { useOrganization } from '../../context/OrganizationContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import { organizationService } from '../../services/organization.service';
import { OrgAvatar } from '../../components/organization/OrgAvatar';
import type { OrganizationOverviewData, OrganizationActivity } from '../../types/organization';
import { useNavigation } from '../../context/NavigationContext';

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

const smoothPath = (pts: Array<{ x: number; y: number }>) => {
  if (pts.length === 0) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  IN_PROGRESS: { label: 'In Progress', color: '#8B5CF6' },
  COMPLETED: { label: 'Completed', color: '#10B981' },
  PLANNING: { label: 'Planning', color: '#F59E0B' },
  ON_HOLD: { label: 'On Hold', color: '#F43F5E' },
  ARCHIVED: { label: 'Archived', color: '#6B7280' },
};

const PRIORITY_META = [
  { key: 'URGENT', label: 'Urgent', color: '#EF4444' },
  { key: 'HIGH', label: 'High', color: '#F97316' },
  { key: 'MEDIUM', label: 'Medium', color: '#FBBF24' },
  { key: 'LOW', label: 'Low', color: '#60A5FA' },
] as const;

const TEAM_COLORS = ['#8B5CF6', '#EC4899', '#06B6D4', '#10B981', '#F59E0B', '#3B82F6'];

// ═════════════════════════════════════════════════════════════════════════════
// Small presentational building blocks
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
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer font-mono text-[11px] ${value === o.value ? 'bg-[#1C1E26] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-200'
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
    title="Not enough workspace data yet — showing sample data"
  >
    Sample
  </span>
);

const Ring: React.FC<{ pct: number; color: string; size?: number; stroke?: number; children?: React.ReactNode }> = ({
  pct,
  color,
  size = 56,
  stroke = 6,
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

// ═════════════════════════════════════════════════════════════════════════════
// Skeleton Loading Screen (Replaces standard spinner with high-fidelity layout)
// ═════════════════════════════════════════════════════════════════════════════

const OverviewSkeleton: React.FC<{ accentColor: string }> = ({ accentColor }) => {
  return (
    <div className="w-full px-4 sm:px-8 lg:px-10 pt-4 sm:pt-6 pb-16 space-y-5 animate-pulse text-left">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#27272A]/70">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-xl bg-zinc-800/80 shrink-0" />
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-44 h-7 rounded-lg bg-zinc-800/80" />
              <div className="w-20 h-5 rounded-md bg-zinc-800/60" />
              <div className="w-16 h-5 rounded-md bg-zinc-800/60" />
            </div>
            <div className="w-64 h-4 rounded bg-zinc-800/50" />
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-24 h-7 rounded-full bg-zinc-800/60 mr-1 hidden sm:block" />
          <div className="w-8 h-8 rounded-lg bg-zinc-800/80" />
          <div className="w-20 h-8 rounded-lg bg-zinc-800/80" />
          <div className="w-28 h-8 rounded-lg bg-zinc-800/80" />
        </div>
      </div>

      {/* Upper Grid (12 cols): Left (8 cols: KPIs + Throughput) + Right (4 cols: Org Detail Box + Portfolio Health) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* 4 KPI Cards */}
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

          {/* Throughput Chart Panel Skeleton */}
          <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272A]/70">
              <div className="space-y-1">
                <div className="w-32 h-4 rounded bg-zinc-800/80" />
                <div className="w-56 h-3 rounded bg-zinc-800/50" />
              </div>
              <div className="w-28 h-7 rounded-lg bg-zinc-800/60" />
            </div>
            {/* Stat Counters */}
            <div className="flex gap-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="w-14 h-3 rounded bg-zinc-800/60" />
                  <div className="w-10 h-6 rounded bg-zinc-800/80" />
                </div>
              ))}
            </div>
            {/* Graph Bar Skeleton */}
            <div className="h-44 w-full flex items-end justify-between gap-2 pt-6 px-4">
              {[40, 65, 30, 85, 50, 70, 90, 45, 60, 75, 55, 80, 68, 95].map((h, i) => (
                <div key={i} className="flex-1 flex items-end gap-1 h-full">
                  <div className="flex-1 rounded-sm bg-zinc-800/70" style={{ height: `${h * 0.7}%` }} />
                  <div className="flex-1 rounded-sm bg-zinc-800/40" style={{ height: `${h}%` }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Org Detail Box + Portfolio Health Skeleton */}
        <div className="lg:col-span-4 space-y-5">
          {/* Org Detail Box Skeleton */}
          <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-zinc-800/80 shrink-0" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex justify-between items-center">
                  <div className="w-28 h-4 rounded bg-zinc-800/80" />
                  <div className="w-10 h-4 rounded bg-zinc-800/60" />
                </div>
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

          {/* Portfolio Health Skeleton */}
          <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 space-y-4">
            <div className="w-32 h-4 rounded bg-zinc-800/80" />
            <div className="flex items-center gap-4">
              <div className="w-[120px] h-[120px] rounded-full border-8 border-zinc-800/70 shrink-0" />
              <div className="flex-1 space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="w-full h-3 rounded bg-zinc-800/60" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Middle: Gantt Project Timeline Skeleton */}
      <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-[#27272A]/70">
          <div className="space-y-1">
            <div className="w-36 h-4 rounded bg-zinc-800/80" />
            <div className="w-60 h-3 rounded bg-zinc-800/50" />
          </div>
          <div className="w-24 h-7 rounded-lg bg-zinc-800/60" />
        </div>
        <div className="space-y-3 pt-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 h-10 border-b border-[#1C1D23] last:border-b-0">
              <div className="w-[200px] h-4 rounded bg-zinc-800/70 shrink-0" />
              <div className="flex-1 h-6 rounded-md bg-zinc-800/40 relative">
                <div
                  className="h-full rounded-md bg-zinc-800/70"
                  style={{ width: `${35 + i * 18}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Grid: Deliverables & Audit Log Skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 space-y-3">
          <div className="w-40 h-4 rounded bg-zinc-800/80 mb-4" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-zinc-800/40" />
          ))}
        </div>
        <div className="lg:col-span-4 rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 space-y-3">
          <div className="w-28 h-4 rounded bg-zinc-800/80 mb-4" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-zinc-800/40" />
          ))}
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// Organization Detail Box (Upper Right Card)
// ═════════════════════════════════════════════════════════════════════════════

const OrgDetailBox: React.FC<{
  activeOrg: any;
  targetSlug?: string;
  metadata: any;
  accentColor: string;
}> = ({ activeOrg, targetSlug, metadata, accentColor }) => (
  <section className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-4">
    <div className="flex items-center gap-3">
      <OrgAvatar
        name={activeOrg?.name || 'DevFlow'}
        logoUrl={activeOrg?.logoUrl}
        className="w-11 h-11 shrink-0 shadow-md"
        iconSize={22}
        roundedClassName="rounded-xl"
        fontSize={16}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-sm text-white truncate">{activeOrg?.name || 'DevFlow Inc'}</h3>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
            Pro
          </span>
        </div>
        <p className="text-[11px] text-zinc-500 truncate font-mono mt-0.5">/{activeOrg?.slug || 'devflow'}</p>
      </div>
    </div>

    {/* Quick action buttons */}
    <div className="grid grid-cols-4 gap-1.5">
      {[
        { to: 'members', icon: <Users size={14} />, label: 'Members', hover: 'group-hover:text-blue-400' },
        { to: 'teams', icon: <Layers size={14} />, label: 'Squads', hover: 'group-hover:text-violet-400' },
        { to: 'projects', icon: <FolderKanban size={14} />, label: 'Projects', hover: 'group-hover:text-emerald-400' },
        { to: 'settings', icon: <Settings size={14} />, label: 'Settings', hover: 'group-hover:text-amber-400' },
      ].map((q) => (
        <Link
          key={q.to}
          to={`/organizations/${targetSlug}/${q.to}`}
          className="group flex flex-col items-center gap-1 py-2.5 rounded-xl bg-[#111216] border border-[#27272A] hover:border-zinc-600 hover:bg-white/[0.03] transition-all"
        >
          <span className={`text-zinc-400 transition-colors ${q.hover}`}>{q.icon}</span>
          <span className="text-[10px] text-zinc-300 font-medium">{q.label}</span>
        </Link>
      ))}
    </div>

    {/* Metadata list */}
    <dl className="space-y-2 text-xs pt-3 border-t border-[#27272A]/70">
      <div className="flex items-center justify-between gap-3">
        <dt className="flex items-center gap-1.5 text-zinc-500"><Building2 size={12} /> Industry</dt>
        <dd className="text-zinc-200 truncate font-medium">{metadata.industry}</dd>
      </div>
      <div className="flex items-center justify-between gap-3">
        <dt className="flex items-center gap-1.5 text-zinc-500"><Globe size={12} /> Website</dt>
        <dd className="truncate">
          {metadata.website ? (
            <a href={metadata.website} target="_blank" rel="noreferrer" className="text-purple-400 hover:underline inline-flex items-center gap-1 font-mono text-[11px]">
              {metadata.website.replace(/^https?:\/\//, '')}
              <ExternalLink size={10} />
            </a>
          ) : (
            <span className="text-zinc-500 italic">Not set</span>
          )}
        </dd>
      </div>
      <div className="flex items-center justify-between gap-3">
        <dt className="flex items-center gap-1.5 text-zinc-500"><Calendar size={12} /> Founded</dt>
        <dd className="text-zinc-300 font-mono text-[11px]">
          {activeOrg?.createdAt ? new Date(activeOrg.createdAt).toLocaleDateString() : '—'}
        </dd>
      </div>
      <div className="flex items-center justify-between gap-3">
        <dt className="flex items-center gap-1.5 text-zinc-500"><Server size={12} /> System</dt>
        <dd className="text-emerald-400 font-mono text-[11px] flex items-center gap-1.5 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Operational
        </dd>
      </div>
    </dl>
  </section>
);

// ═════════════════════════════════════════════════════════════════════════════
// Main view
// ═════════════════════════════════════════════════════════════════════════════

type TrendRange = '14d' | '30d' | 'quarter';
type GanttZoom = 'month' | 'quarter' | 'half';
type IssueFilter = 'ALL' | 'IN_PROGRESS' | 'DONE' | 'URGENT';

export const OrganizationOverviewView: React.FC = () => {
  const { organizationSlug } = useParams<{ organizationSlug: string }>();
  const { currentOrganization } = useOrganization();
  const { accentColor } = useAccentTheme();
  const { setIsCreateOpen } = useNavigation();
  const navigate = useNavigate();

  const [data, setData] = useState<OrganizationOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [trendRange, setTrendRange] = useState<TrendRange>('30d');
  const [hoveredBucket, setHoveredBucket] = useState<number | null>(null);
  const [ganttZoom, setGanttZoom] = useState<GanttZoom>('quarter');
  const [hoveredGantt, setHoveredGantt] = useState<string | null>(null);
  const [hoveredHeat, setHoveredHeat] = useState<{ date: Date; count: number } | null>(null);
  const [issueFilter, setIssueFilter] = useState<IssueFilter>('ALL');

  const targetSlug = organizationSlug || currentOrganization?.slug;

  const loadOverview = useCallback(async () => {
    if (!targetSlug) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await organizationService.getOverview(targetSlug);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error || 'Failed to load organization overview');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to organization service');
    } finally {
      setIsLoading(false);
    }
  }, [targetSlug]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const activeOrg = data?.organization || currentOrganization;
  const stats: any = data?.stats ||
    data?.summary || {
    totalMembers: 0,
    totalTeams: 0,
    totalProjects: 0,
    openIssues: 0,
    completedIssues: 0,
    totalTasks: 0,
  };
  const teams: any[] = data?.teams || [];
  const projects: any[] = data?.projects || [];
  const allTasks: any[] = data?.allTasks || [];
  const members: any[] = data?.members || [];
  const recentActivities: OrganizationActivity[] = data?.recentActivities || data?.recentActivity || [];
  const role = data?.currentRole || activeOrg?.currentUserRole || 'MEMBER';
  const today = useMemo(() => startOfDay(new Date()), []);

  // ─── Metadata parsed from description tags ────────────────────────────────
  const metadata = useMemo(() => {
    const raw = activeOrg?.description || '';
    const websiteMatch = raw.match(/\[website:([^\]]+)\]/i);
    const industryMatch = raw.match(/\[industry:([^\]]+)\]/i);
    const locationMatch = raw.match(/\[location:([^\]]+)\]/i);
    const cleanDesc = raw.replace(/\[(website|industry|contact|location):[^\]]+\]/gi, '').trim();
    return {
      website: websiteMatch ? websiteMatch[1] : null,
      industry: industryMatch ? industryMatch[1] : 'Technology & Software',
      location: locationMatch ? locationMatch[1] : 'San Francisco, CA',
      cleanDesc: cleanDesc || 'Enterprise workspace orchestrating agile delivery, sprints, and teams.',
    };
  }, [activeOrg?.description]);

  // ─── Activity formatting (unchanged behaviour) ────────────────────────────
  const parseDetails = (act: OrganizationActivity): any => {
    try {
      if (!act.details) return {};
      return typeof act.details === 'string' ? JSON.parse(act.details) : act.details;
    } catch {
      return {};
    }
  };

  const formatActivityText = (act: OrganizationActivity) => {
    const actorName = act.actor?.name || 'A team member';
    const details = parseDetails(act);
    switch (act.action) {
      case 'DEPLOYED_RELEASE':
        return `${actorName} deployed release ${details.version || 'v2.4.0'}`;
      case 'UPDATED_ORGANIZATION':
        return `${actorName} updated security policies & settings`;
      case 'CREATED_ORGANIZATION':
        return `${actorName} founded the organization workspace`;
      case 'JOINED_ORGANIZATION':
        return `${actorName} joined as a member`;
      case 'INVITED_MEMBER':
        return `${actorName} sent a workspace invitation`;
      case 'ASSIGNED_ROLE':
      case 'CHANGED_MEMBER_ROLE':
        return `${actorName} assigned role permissions`;
      case 'CONFIGURED_SECURITY':
        return `${actorName} updated security configuration`;
      case 'REMOVED_MEMBER':
        return `${actorName} removed a member`;
      case 'CREATED_TEAM':
        return `${actorName} created team "${details.teamName || 'new team'}"`;
      case 'CREATED_PROJECT':
        return `${actorName} launched project "${details.projectName || 'project'}"`;
      case 'TRANSFERRED_OWNERSHIP':
        return `${actorName} transferred organization ownership`;
      default:
        return `${actorName} performed ${act.action.toLowerCase().replace(/_/g, ' ')}`;
    }
  };

  const getActivityIcon = (act: OrganizationActivity) => {
    switch (act.action) {
      case 'DEPLOYED_RELEASE':
        return <Rocket size={11} className="text-emerald-400" />;
      case 'UPDATED_ORGANIZATION':
      case 'CONFIGURED_SECURITY':
        return <Shield size={11} className="text-amber-400" />;
      case 'CREATED_ORGANIZATION':
        return <Building2 size={11} className="text-purple-400" />;
      case 'CREATED_TEAM':
        return <Layers size={11} className="text-violet-400" />;
      case 'CREATED_PROJECT':
        return <FolderKanban size={11} className="text-blue-400" />;
      case 'INVITED_MEMBER':
      case 'JOINED_ORGANIZATION':
        return <UserPlus size={11} className="text-indigo-400" />;
      case 'ASSIGNED_ROLE':
      case 'CHANGED_MEMBER_ROLE':
        return <Zap size={11} className="text-cyan-400" />;
      default:
        return <Activity size={11} className="text-zinc-400" />;
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMins = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${Math.floor(diffHours / 24)}d ago`;
    } catch {
      return 'Recently';
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // GRAPH 1 — Throughput (grouped bars: created vs completed + 3-pt trend line)
  // Non-overlapping buckets so tasks are never double-counted.
  // ═══════════════════════════════════════════════════════════════════════════
  const throughput = useMemo(() => {
    const cfg =
      trendRange === '14d'
        ? { buckets: 14, step: 1 }
        : trendRange === '30d'
          ? { buckets: 15, step: 2 }
          : { buckets: 13, step: 7 };
    const windowStart = addDays(today, -(cfg.buckets * cfg.step) + 1);
    const usingSample = allTasks.length === 0;

    const points = Array.from({ length: cfg.buckets }, (_, i) => {
      const from = addDays(windowStart, i * cfg.step);
      const to = addDays(from, cfg.step);
      let created = 0;
      let completed = 0;
      if (!usingSample) {
        allTasks.forEach((t) => {
          const c = toDate(t.createdAt);
          if (c && c >= from && c < to) created++;
          if (t.status === 'DONE') {
            const u = toDate(t.completedAt || t.updatedAt || t.createdAt);
            if (u && u >= from && u < to) completed++;
          }
        });
      } else {
        created = Math.round((5 + Math.cos(i * 0.6) * 2.5 + i * 0.25) * (cfg.step > 2 ? 3 : 1));
        completed = Math.round((4 + Math.sin(i * 0.7) * 3 + i * 0.35) * (cfg.step > 2 ? 3 : 1));
      }
      return {
        label: cfg.step === 1 ? fmtShort(from) : `${fmtShort(from)}`,
        rangeLabel: cfg.step === 1 ? fmtShort(from) : `${fmtShort(from)} – ${fmtShort(addDays(to, -1))}`,
        created,
        completed,
      };
    });

    const withTrend = points.map((p, i) => {
      const slice = points.slice(Math.max(0, i - 2), i + 1);
      return { ...p, trend: slice.reduce((s, x) => s + x.completed, 0) / slice.length };
    });

    const half = Math.floor(withTrend.length / 2);
    const firstHalf = withTrend.slice(0, half).reduce((s, p) => s + p.completed, 0);
    const secondHalf = withTrend.slice(half).reduce((s, p) => s + p.completed, 0);
    const delta = firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : 0;
    const totalCreated = withTrend.reduce((s, p) => s + p.created, 0);
    const totalCompleted = withTrend.reduce((s, p) => s + p.completed, 0);

    return { points: withTrend, delta, totalCreated, totalCompleted, usingSample };
  }, [allTasks, trendRange, today]);

  const avgCycleDays = useMemo(() => {
    const done = allTasks
      .filter((t) => t.status === 'DONE')
      .map((t) => {
        const c = toDate(t.createdAt);
        const u = toDate(t.completedAt || t.updatedAt);
        return c && u ? (u.getTime() - c.getTime()) / DAY : null;
      })
      .filter((v): v is number => v !== null && v >= 0);
    if (done.length === 0) return null;
    return done.reduce((s, v) => s + v, 0) / done.length;
  }, [allTasks]);

  // Chart geometry
  const TC = { w: 640, h: 220, top: 16, right: 12, bottom: 26, left: 32 };
  const tInnerW = TC.w - TC.left - TC.right;
  const tInnerH = TC.h - TC.top - TC.bottom;
  const tMax = Math.max(4, ...throughput.points.map((p) => Math.max(p.created, p.completed)));
  const tNiceMax = Math.ceil(tMax / 4) * 4;
  const bucketW = tInnerW / throughput.points.length;
  const barW = Math.max(3, (bucketW * 0.64) / 2 - 1);
  const yScale = (v: number) => TC.top + tInnerH - (v / tNiceMax) * tInnerH;
  const trendPath = smoothPath(
    throughput.points.map((p, i) => ({ x: TC.left + bucketW * i + bucketW / 2, y: yScale(p.trend) }))
  );
  const labelEvery = throughput.points.length > 10 ? 2 : 1;

  // ═══════════════════════════════════════════════════════════════════════════
  // Portfolio health — project status + priority mix
  // ═══════════════════════════════════════════════════════════════════════════
  const projectStatus = useMemo(() => {
    const counts: Record<string, number> = { IN_PROGRESS: 0, COMPLETED: 0, PLANNING: 0, ARCHIVED: 0 };
    projects.forEach((p) => {
      const s = p.status || 'IN_PROGRESS';
      counts[s] = (counts[s] || 0) + 1;
    });
    const usingSample = projects.length === 0;
    const src = usingSample ? { IN_PROGRESS: 5, COMPLETED: 3, PLANNING: 2, ARCHIVED: 0 } : counts;
    const total = Math.max(
      Object.values(src).reduce((s, v) => s + v, 0),
      1
    );
    const rows = Object.entries(src).map(([key, count]) => ({
      key,
      count,
      pct: Math.round((count / total) * 100),
      label: STATUS_META[key]?.label || key.replace(/_/g, ' '),
      color: STATUS_META[key]?.color || '#6B7280',
    }));
    return { rows, total, usingSample, counts: src };
  }, [projects]);

  const priorityMix = useMemo(() => {
    const counts: Record<string, number> = { URGENT: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    allTasks
      .filter((t) => t.status !== 'DONE')
      .forEach((t) => {
        const p = t.priority && counts[t.priority] !== undefined ? t.priority : 'MEDIUM';
        counts[p]++;
      });
    const usingSample = allTasks.length === 0;
    const src = usingSample ? { URGENT: 4, HIGH: 9, MEDIUM: 14, LOW: 5 } : counts;
    const max = Math.max(1, ...Object.values(src));
    const total = Object.values(src).reduce((s, v) => s + v, 0);
    return { src, max, total };
  }, [allTasks]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Team velocity
  // ═══════════════════════════════════════════════════════════════════════════
  const teamPerformance = useMemo(() => {
    const list = teams.map((t: any, idx: number) => {
      const teamTasks = allTasks.filter((task) => task.teamId === t.id || task.project?.teamId === t.id);
      const done = teamTasks.filter((task) => task.status === 'DONE').length;
      const hasReal = teamTasks.length > 0;
      return {
        id: t.id,
        name: t.name,
        color: t.color || TEAM_COLORS[idx % TEAM_COLORS.length],
        memberCount: t._count?.members || t.members?.length || 0,
        velocityScore: hasReal ? Math.round((done / teamTasks.length) * 100) : Math.min(98, 82 + ((idx * 5) % 16)),
        tasksCompleted: hasReal ? done : Math.max(5, 18 - idx * 4),
        open: hasReal ? teamTasks.length - done : 0,
      };
    });
    if (list.length === 0) {
      return [
        { id: 1, name: 'Core Engineering', color: '#8B5CF6', memberCount: 4, velocityScore: 94, tasksCompleted: 18, open: 3 },
        { id: 2, name: 'Platform & DevOps', color: '#06B6D4', memberCount: 2, velocityScore: 91, tasksCompleted: 10, open: 2 },
        { id: 3, name: 'Design Systems', color: '#EC4899', memberCount: 3, velocityScore: 86, tasksCompleted: 12, open: 4 },
        { id: 4, name: 'Mobile Squad', color: '#10B981', memberCount: 3, velocityScore: 72, tasksCompleted: 8, open: 6 },
      ];
    }
    return list.sort((a, b) => b.velocityScore - a.velocityScore);
  }, [teams, allTasks]);

  // ═══════════════════════════════════════════════════════════════════════════
  // GANTT — project timeline
  // ═══════════════════════════════════════════════════════════════════════════
  const ganttWindow = useMemo(() => {
    const cfg =
      ganttZoom === 'month'
        ? { before: 14, after: 46, tick: 7 }
        : ganttZoom === 'quarter'
          ? { before: 30, after: 90, tick: 14 }
          : { before: 60, after: 120, tick: 30 };
    const start = addDays(today, -cfg.before);
    const end = addDays(today, cfg.after);
    const spanMs = end.getTime() - start.getTime();

    const ticks: Date[] = [];
    if (ganttZoom === 'half') {
      const m = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      while (m < end) {
        ticks.push(new Date(m));
        m.setMonth(m.getMonth() + 1);
      }
    } else {
      // align to Monday
      const first = new Date(start);
      first.setDate(first.getDate() + ((8 - first.getDay()) % 7));
      for (let d = first; d < end; d = addDays(d, cfg.tick)) ticks.push(d);
    }
    const pct = (d: Date) => ((d.getTime() - start.getTime()) / spanMs) * 100;
    return { start, end, ticks, pct };
  }, [ganttZoom, today]);

  const ganttRows = useMemo(() => {
    const usingSample = projects.length === 0;
    const src: any[] = usingSample
      ? [
        { id: 's1', name: 'Analytics Engine', status: 'IN_PROGRESS', startDate: addDays(today, -24), endDate: addDays(today, 8), progress: 85, team: 'Core Engineering' },
        { id: 's2', name: 'Enterprise SSO & RBAC', status: 'IN_PROGRESS', startDate: addDays(today, -10), endDate: addDays(today, 22), progress: 40, team: 'Platform & DevOps' },
        { id: 's3', name: 'Design System v3', status: 'IN_PROGRESS', startDate: addDays(today, -40), endDate: addDays(today, -3), progress: 90, team: 'Design Systems' },
        { id: 's4', name: 'Mobile Companion App', status: 'PLANNING', startDate: addDays(today, 12), endDate: addDays(today, 70), progress: 0, team: 'Mobile Squad' },
        { id: 's5', name: 'Billing Revamp', status: 'COMPLETED', startDate: addDays(today, -55), endDate: addDays(today, -18), progress: 100, team: 'Core Engineering' },
      ]
      : projects;

    const rows = src.map((p: any, idx: number) => {
      const start =
        toDate(p.startDate) || toDate(p.createdAt) || addDays(today, -14 + idx * 6);
      let end = toDate(p.endDate) || toDate(p.dueDate) || toDate(p.targetDate);
      if (!end || end <= start) end = addDays(start, 30 + (idx % 3) * 15);

      let progress: number;
      if (typeof p.progress === 'number') progress = p.progress;
      else {
        const pTasks = allTasks.filter((t) => t.projectId === p.id || t.project?.id === p.id);
        if (pTasks.length > 0) progress = Math.round((pTasks.filter((t) => t.status === 'DONE').length / pTasks.length) * 100);
        else progress = p.status === 'COMPLETED' ? 100 : p.status === 'PLANNING' ? 0 : 50;
      }
      if (p.status === 'COMPLETED') progress = 100;

      const totalDur = end.getTime() - start.getTime();
      const elapsed = clamp((today.getTime() - start.getTime()) / totalDur, 0, 1) * 100;
      const overdue = end < today && progress < 100;
      const atRisk = !overdue && progress < 100 && elapsed - progress > 20;
      const status = p.status || 'IN_PROGRESS';
      const daysLeft = Math.ceil((end.getTime() - today.getTime()) / DAY);

      return {
        id: String(p.id),
        name: p.title || p.name || 'Untitled project',
        team: p.team?.name || p.team || p.teamName || null,
        status,
        color: p.color || STATUS_META[status]?.color || '#8B5CF6',
        start,
        end,
        progress,
        overdue,
        atRisk,
        daysLeft,
      };
    });

    rows.sort((a, b) => a.start.getTime() - b.start.getTime());
    return { rows: rows.slice(0, 10), usingSample, hidden: Math.max(0, rows.length - 10) };
  }, [projects, allTasks, today]);

  const ganttSummary = useMemo(() => {
    const r = ganttRows.rows;
    return {
      onTrack: r.filter((x) => !x.overdue && !x.atRisk && x.progress < 100).length,
      atRisk: r.filter((x) => x.atRisk).length,
      overdue: r.filter((x) => x.overdue).length,
      done: r.filter((x) => x.progress >= 100).length,
    };
  }, [ganttRows]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Activity heatmap (16 weeks, GitHub-style)
  // ═══════════════════════════════════════════════════════════════════════════
  const HEAT_WEEKS = 16;
  const heatmap = useMemo(() => {
    const counts = new Map<string, number>();
    const bump = (d: Date | null) => {
      if (!d) return;
      const k = dayKey(d);
      counts.set(k, (counts.get(k) || 0) + 1);
    };
    allTasks.forEach((t) => {
      bump(toDate(t.createdAt));
      if (t.status === 'DONE') bump(toDate(t.completedAt || t.updatedAt));
    });
    recentActivities.forEach((a) => bump(toDate(a.createdAt)));
    const usingSample = counts.size === 0;

    // Start on Sunday HEAT_WEEKS-1 weeks ago
    const gridStart = addDays(today, -today.getDay() - (HEAT_WEEKS - 1) * 7);
    const weeks: Array<Array<{ date: Date; count: number; future: boolean }>> = [];
    let max = 1;
    for (let w = 0; w < HEAT_WEEKS; w++) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(gridStart, w * 7 + d);
        const future = date > today;
        const count = future
          ? 0
          : usingSample
            ? ((w * 7 + d) * 37) % 11 > 4
              ? ((w * 13 + d * 7) % 9) + (d === 0 || d === 6 ? 0 : 2)
              : d === 0 || d === 6
                ? 0
                : 1
            : counts.get(dayKey(date)) || 0;
        max = Math.max(max, count);
        col.push({ date, count, future });
      }
      weeks.push(col);
    }
    const total = weeks.flat().reduce((s, c) => s + c.count, 0);
    // longest streak of active days
    let streak = 0;
    let best = 0;
    weeks.flat().forEach((c) => {
      if (c.future) return;
      streak = c.count > 0 ? streak + 1 : 0;
      best = Math.max(best, streak);
    });
    return { weeks, max, total, best, usingSample };
  }, [allTasks, recentActivities, today]);

  const heatColor = (count: number, max: number) => {
    if (count === 0) return '#16171D';
    const t = count / max;
    if (t < 0.25) return '#064E3B';
    if (t < 0.5) return '#047857';
    if (t < 0.75) return '#10B981';
    return '#6EE7B7';
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Deliverables
  // ═══════════════════════════════════════════════════════════════════════════
  const filterCounts = useMemo(
    () => ({
      ALL: allTasks.length,
      IN_PROGRESS: allTasks.filter((t) => t.status === 'IN_PROGRESS').length,
      DONE: allTasks.filter((t) => t.status === 'DONE').length,
      URGENT: allTasks.filter((t) => t.priority === 'URGENT' || t.priority === 'HIGH').length,
    }),
    [allTasks]
  );

  const filteredTasks = useMemo(() => {
    const f =
      issueFilter === 'IN_PROGRESS'
        ? allTasks.filter((t) => t.status === 'IN_PROGRESS')
        : issueFilter === 'DONE'
          ? allTasks.filter((t) => t.status === 'DONE')
          : issueFilter === 'URGENT'
            ? allTasks.filter((t) => t.priority === 'URGENT' || t.priority === 'HIGH')
            : allTasks;
    return f.slice(0, 8);
  }, [allTasks, issueFilter]);

  const last8AuditLogs = useMemo(() => recentActivities.slice(0, 8), [recentActivities]);

  const roleSplit = useMemo(() => {
    const c = { OWNER: 0, ADMIN: 0, MEMBER: 0 };
    members.forEach((m: any) => {
      if (m.role === 'OWNER') c.OWNER++;
      else if (m.role === 'ADMIN') c.ADMIN++;
      else c.MEMBER++;
    });
    return c;
  }, [members]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Loading / error states
  // ═══════════════════════════════════════════════════════════════════════════
  if (isLoading && !data) {
    return <OverviewSkeleton accentColor={accentColor} />;
  }

  if (error && !data) {
    return (
      <div className="p-8 max-w-xl mx-auto mt-12 bg-[#171A21] border border-red-500/30 rounded-2xl text-center space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto border border-red-500/20">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-base font-semibold text-white">Could not load organization</h3>
        <p className="text-xs text-zinc-400 leading-relaxed">{error}</p>
        <button
          onClick={loadOverview}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white font-medium transition-colors"
        >
          <RefreshCw size={13} /> Try Again
        </button>
      </div>
    );
  }

  const completedIssuesCount = stats.completedIssues ?? allTasks.filter((t) => t.status === 'DONE').length;
  const openIssuesCount = stats.openIssues ?? allTasks.filter((t) => t.status !== 'DONE').length;
  const totalTasksCount = completedIssuesCount + openIssuesCount;
  const completionRate = Math.round((completedIssuesCount / Math.max(totalTasksCount, 1)) * 100);
  const totalMembers = stats.totalMembers ?? members.length ?? 0;
  const totalTeams = stats.totalTeams ?? teams.length ?? 0;
  const totalProjects = stats.totalProjects ?? projects.length ?? 0;
  const avgVelocity = Math.round(
    teamPerformance.reduce((s, t) => s + t.velocityScore, 0) / Math.max(teamPerformance.length, 1)
  );

  const todayPct = ganttWindow.pct(today);

  return (
    <div className="w-full px-4 sm:px-8 lg:px-10 pt-4 sm:pt-6 pb-16 space-y-5 animate-in fade-in duration-200 text-left">
      {/* ═══ HEADER ═══════════════════════════════════════════════════════════ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#27272A]/70">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <OrgAvatar
            name={activeOrg?.name || 'Organization'}
            logoUrl={activeOrg?.logoUrl}
            className="w-12 h-12 shadow-md shrink-0"
            iconSize={22}
            roundedClassName="rounded-xl"
            fontSize={18}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-[28px] font-extrabold text-white tracking-tight leading-tight truncate">
                {activeOrg?.name || 'DevFlow Inc'}
              </h1>
              <span
                className="px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold border"
                style={{ backgroundColor: `${accentColor}18`, borderColor: `${accentColor}40`, color: accentColor }}
              >
                /{activeOrg?.slug || 'devflow'}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                {role}
              </span>
            </div>
            <p className="text-[13.5px] text-zinc-400 mt-1 truncate">{metadata.cleanDesc}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {members.length > 0 && (
            <div className="flex items-center -space-x-2 select-none mr-1">
              {members.slice(0, 5).map((m: any, idx: number) => {
                const uName = m.user?.name || 'Member';
                return (
                  <div
                    key={m.id || idx}
                    className="relative w-[28px] h-[28px] rounded-full ring-2 ring-[#0C0D10] overflow-hidden shrink-0 hover:z-30 hover:-translate-y-0.5 transition-transform"
                    style={{ zIndex: 10 - idx, backgroundColor: m.user?.avatarColor || accentColor }}
                    title={`${uName} (${m.role})`}
                  >
                    {m.user?.avatarUrl ? (
                      <img src={m.user.avatarUrl} alt={uName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-white text-[10px]">
                        {uName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                );
              })}
              {members.length > 5 && (
                <div className="relative w-[28px] h-[28px] rounded-full ring-2 ring-[#0C0D10] bg-[#1E1F26] flex items-center justify-center text-[10px] font-bold font-mono text-zinc-300">
                  +{members.length - 5}
                </div>
              )}
            </div>
          )}
          <Link
            to={`/organizations/${targetSlug}/settings`}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#27272A] text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Organization Settings"
          >
            <Settings size={14} />
          </Link>
          <Link
            to={`/organizations/${targetSlug}/members`}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#27272A] text-zinc-300 hover:text-white hover:bg-white/[0.06] text-[12px] font-medium transition-colors"
          >
            <UserPlus size={13} className="text-zinc-400" />
            <span className="hidden sm:inline">Invite</span>
          </Link>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[12px] font-semibold text-[#0A0B10] transition-all hover:brightness-110 cursor-pointer"
            style={{ backgroundColor: accentColor, boxShadow: `0 2px 10px ${accentColor}25` }}
          >
            <Plus size={14} />
            <span>Create Project</span>
          </button>
        </div>
      </div>

      {/* ═══ UPPER DASHBOARD GRID: LEFT (KPIs + THROUGHPUT) | RIGHT (ORG DETAIL BOX + PORTFOLIO HEALTH) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (8 cols): KPI Strip + Throughput Chart */}
        <div className="lg:col-span-8 space-y-5">
          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Members */}
            <Link
              to={`/organizations/${targetSlug}/members`}
              className="group rounded-2xl bg-[#0E0F14]/90 border border-[#27272A] hover:border-blue-500/40 p-4 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10.5px] font-mono font-semibold uppercase tracking-wider text-zinc-500">Members</div>
                  <div className="text-3xl font-extrabold text-white font-mono tracking-tight mt-1">{totalMembers}</div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Users size={17} />
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex h-1.5 rounded-full overflow-hidden bg-zinc-800">
                  {(['OWNER', 'ADMIN', 'MEMBER'] as const).map((r, i) => (
                    <motion.div
                      key={r}
                      initial={{ width: 0 }}
                      animate={{ width: `${(roleSplit[r] / Math.max(members.length, 1)) * 100}%` }}
                      transition={{ duration: 0.6, delay: i * 0.1, ease: 'easeOut' }}
                      style={{
                        backgroundColor: ['#60A5FA', '#3B82F6', '#1D4ED8'][i],
                      }}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                  <span>{roleSplit.OWNER} owner</span>
                  <span>{roleSplit.ADMIN} admin</span>
                  <span>{roleSplit.MEMBER} member</span>
                </div>
              </div>
            </Link>

            {/* Squads */}
            <Link
              to={`/organizations/${targetSlug}/teams`}
              className="group rounded-2xl bg-[#0E0F14]/90 border border-[#27272A] hover:border-purple-500/40 p-4 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10.5px] font-mono font-semibold uppercase tracking-wider text-zinc-500">Squads</div>
                  <div className="text-3xl font-extrabold text-white font-mono tracking-tight mt-1">{totalTeams}</div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Layers size={17} />
                </div>
              </div>
              <div className="mt-3 flex items-end gap-1 h-6">
                {teamPerformance.slice(0, 8).map((t, idx) => (
                  <motion.div
                    key={t.id}
                    className="flex-1 rounded-sm"
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(15, t.velocityScore)}%` }}
                    transition={{ duration: 0.5, delay: idx * 0.04, ease: 'easeOut' }}
                    style={{ backgroundColor: t.color, opacity: 0.85 }}
                    title={`${t.name}: ${t.velocityScore}%`}
                  />
                ))}
              </div>
              <div className="text-[10px] font-mono text-zinc-500 mt-1.5">avg velocity {avgVelocity}%</div>
            </Link>

            {/* Projects */}
            <Link
              to={`/organizations/${targetSlug}/projects`}
              className="group rounded-2xl bg-[#0E0F14]/90 border border-[#27272A] hover:border-emerald-500/40 p-4 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10.5px] font-mono font-semibold uppercase tracking-wider text-zinc-500">Projects</div>
                  <div className="text-3xl font-extrabold text-white font-mono tracking-tight mt-1">{totalProjects}</div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <FolderKanban size={17} />
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex h-1.5 rounded-full overflow-hidden bg-zinc-800">
                  {projectStatus.rows.map((r, i) => (
                    <motion.div
                      key={r.key}
                      initial={{ width: 0 }}
                      animate={{ width: `${r.pct}%` }}
                      transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                      style={{ backgroundColor: r.color }}
                      title={`${r.label}: ${r.count}`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                  <span>{projectStatus.counts.IN_PROGRESS || 0} active</span>
                  <span>{projectStatus.counts.COMPLETED || 0} shipped</span>
                  <span>{projectStatus.counts.PLANNING || 0} planned</span>
                </div>
              </div>
            </Link>

            {/* Completion */}
            <Link
              to="/my-tasks"
              className="group rounded-2xl bg-[#0E0F14]/90 border border-[#27272A] hover:border-amber-500/40 p-4 transition-colors flex items-center gap-4"
            >
              <Ring pct={completionRate} color="#F59E0B" size={68} stroke={7}>
                <span className="text-sm font-bold font-mono text-white">{completionRate}%</span>
              </Ring>
              <div className="min-w-0">
                <div className="text-[10.5px] font-mono font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  <CheckSquare size={12} className="text-amber-400" /> Completion
                </div>
                <div className="text-[13px] text-white font-semibold mt-1">
                  {completedIssuesCount} <span className="text-zinc-500 font-normal">of {totalTasksCount} issues</span>
                </div>
                <div className="text-[10.5px] font-mono text-zinc-500 mt-0.5">{openIssuesCount} still in flight</div>
              </div>
            </Link>
          </div>

          {/* Throughput Panel */}
          <Panel
            className="w-full"
            icon={<BarChart3 size={16} className="text-emerald-400" />}
            title="Throughput"
            subtitle="Issues created vs completed, with 3-period completion trend"
            right={
              <div className="flex items-center gap-2">
                {throughput.usingSample && <SampleBadge />}
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
            {/* Headline numbers */}
            <div className="flex flex-wrap items-end gap-x-8 gap-y-2 mb-3">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Completed</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono text-white">{throughput.totalCompleted}</span>
                  <span
                    className={`inline-flex items-center gap-0.5 text-[11px] font-mono font-semibold ${throughput.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                  >
                    {throughput.delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {throughput.delta >= 0 ? '+' : ''}
                    {throughput.delta}%
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Created</div>
                <div className="text-2xl font-bold font-mono text-zinc-300">{throughput.totalCreated}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Net backlog</div>
                <div
                  className={`text-2xl font-bold font-mono ${throughput.totalCreated - throughput.totalCompleted > 0 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                >
                  {throughput.totalCreated - throughput.totalCompleted > 0 ? '+' : ''}
                  {throughput.totalCreated - throughput.totalCompleted}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Avg cycle</div>
                <div className="text-2xl font-bold font-mono text-zinc-300">
                  {avgCycleDays !== null ? `${avgCycleDays.toFixed(1)}d` : '—'}
                </div>
              </div>
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

                {throughput.points.map((p, i) => {
                  const cx = TC.left + bucketW * i + bucketW / 2;
                  const isHover = hoveredBucket === i;
                  const dim = hoveredBucket !== null && !isHover;
                  const createdH = Math.max(0, TC.top + tInnerH - yScale(p.created));
                  const completedH = Math.max(0, TC.top + tInnerH - yScale(p.completed));
                  return (
                    <g key={i} onMouseEnter={() => setHoveredBucket(i)} className="cursor-pointer">
                      {isHover && (
                        <rect x={TC.left + bucketW * i} y={TC.top} width={bucketW} height={tInnerH} fill="#ffffff" opacity="0.03" />
                      )}
                      <motion.rect
                        x={cx - barW - 1}
                        initial={{ y: TC.top + tInnerH, height: 0 }}
                        animate={{ y: yScale(p.created), height: createdH }}
                        transition={{ duration: 0.5, delay: i * 0.02, ease: 'easeOut' }}
                        width={barW}
                        rx="2"
                        fill="#6366F1"
                        opacity={dim ? 0.25 : 0.55}
                      />
                      <motion.rect
                        x={cx + 1}
                        initial={{ y: TC.top + tInnerH, height: 0 }}
                        animate={{ y: yScale(p.completed), height: completedH }}
                        transition={{ duration: 0.5, delay: i * 0.02 + 0.03, ease: 'easeOut' }}
                        width={barW}
                        rx="2"
                        fill="#10B981"
                        opacity={dim ? 0.35 : 1}
                      />
                      <rect x={TC.left + bucketW * i} y={TC.top} width={bucketW} height={tInnerH} fill="transparent" />
                      {(i % labelEvery === 0 || i === throughput.points.length - 1) && (
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
                    cy={yScale(throughput.points[hoveredBucket].trend)}
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
                  className="absolute top-0 pointer-events-none p-2.5 rounded-lg bg-[#0A0B0F]/95 border border-[#27272A] shadow-xl text-[11px] space-y-1 min-w-[140px] -translate-x-1/2"
                  style={{
                    left: `${clamp(((TC.left + bucketW * hoveredBucket + bucketW / 2) / TC.w) * 100, 12, 88)}%`,
                  }}
                >
                  <div className="font-mono text-[10px] text-zinc-400">{throughput.points[hoveredBucket].rangeLabel}</div>
                  <div className="flex justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-zinc-300">
                      <span className="w-2 h-2 rounded-sm bg-emerald-500" />
                      Completed
                    </span>
                    <span className="font-mono font-bold text-white">{throughput.points[hoveredBucket].completed}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-zinc-300">
                      <span className="w-2 h-2 rounded-sm bg-indigo-500" />
                      Created
                    </span>
                    <span className="font-mono font-bold text-white">{throughput.points[hoveredBucket].created}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-zinc-300">
                      <span className="w-2 h-0.5 bg-amber-400" />
                      Trend
                    </span>
                    <span className="font-mono text-zinc-300">{throughput.points[hoveredBucket].trend.toFixed(1)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 text-[11px] text-zinc-400 mt-2">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />Completed</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500/60" />Created</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-amber-400" />Completion trend</span>
            </div>
          </Panel>
        </div>

        {/* Right Column (4 cols): Org Detail Box (Upper Right) + Portfolio Health */}
        <div className="lg:col-span-4 space-y-5">
          {/* Organization Detail Box */}
          <OrgDetailBox
            activeOrg={activeOrg}
            targetSlug={targetSlug}
            metadata={metadata}
            accentColor={accentColor}
          />

          {/* Portfolio Health */}
          <Panel
            className="w-full"
            icon={<PieChart size={16} className="text-violet-400" />}
            title="Portfolio Health"
            subtitle="Project status & open-issue priority"
            right={projectStatus.usingSample ? <SampleBadge /> : undefined}
          >
            {/* Concentric status rings */}
            <div className="flex items-center gap-4">
              <div className="relative w-[120px] h-[120px] shrink-0">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  {projectStatus.rows.map((r, i) => {
                    const radius = 54 - i * 11;
                    const c = 2 * Math.PI * radius;
                    return (
                      <g key={r.key}>
                        <circle cx="60" cy="60" r={radius} fill="none" stroke="#1A1B21" strokeWidth="7" />
                        {r.pct > 0 && (
                          <motion.circle
                            cx="60"
                            cy="60"
                            r={radius}
                            fill="none"
                            stroke={r.color}
                            strokeWidth="7"
                            strokeLinecap="round"
                            strokeDasharray={`${(r.pct / 100) * c} ${c}`}
                            initial={{ strokeDashoffset: c }}
                            animate={{ strokeDashoffset: 0 }}
                            transition={{ duration: 0.9, delay: i * 0.12, ease: 'easeOut' }}
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-bold font-mono text-white leading-none">{projectStatus.total}</span>
                  <span className="text-[8.5px] font-mono uppercase text-zinc-500 mt-0.5">projects</span>
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                {projectStatus.rows.map((r) => (
                  <div key={r.key} className="flex items-center justify-between text-xs gap-2">
                    <span className="flex items-center gap-2 text-zinc-300 truncate">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                      {r.label}
                    </span>
                    <span className="font-mono text-[11px] shrink-0">
                      <span className="text-white font-semibold">{r.count}</span>
                      <span className="text-zinc-500"> · {r.pct}%</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Priority bars */}
            <div className="mt-5 pt-4 border-t border-[#27272A]/70 space-y-2.5">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                <span className="flex items-center gap-1.5"><Flame size={12} className="text-orange-400" />Open by priority</span>
                <span>{priorityMix.total} open</span>
              </div>
              {PRIORITY_META.map((p, i) => {
                const v = priorityMix.src[p.key] || 0;
                return (
                  <div key={p.key} className="flex items-center gap-3 text-xs">
                    <span className="w-14 text-zinc-400 shrink-0">{p.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-[#16171D] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(v / priorityMix.max) * 100}%` }}
                        transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                        style={{ backgroundColor: p.color }}
                      />
                    </div>
                    <span className="w-6 text-right font-mono text-[11px] text-white">{v}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>

      {/* ═══ GANTT TIMELINE ═══════════════════════════════════════════════════ */}
      <Panel
        icon={<GanttChartSquare size={16} className="text-amber-400" />}
        title="Project Timeline"
        subtitle={`${fmtShort(ganttWindow.start)} – ${fmtShort(ganttWindow.end)} · bars show elapsed schedule, fill shows completion`}
        right={
          <div className="flex items-center gap-2">
            {ganttRows.usingSample && <SampleBadge />}
            <Segmented<GanttZoom>
              value={ganttZoom}
              onChange={setGanttZoom}
              options={[
                { value: 'month', label: '2M' },
                { value: 'quarter', label: '4M' },
                { value: 'half', label: '6M' },
              ]}
            />
          </div>
        }
      >
        {/* Summary chips */}
        <div className="flex flex-wrap gap-2 mb-4 text-[11px] font-mono">
          <span className="px-2 py-1 rounded-md bg-violet-500/10 text-violet-300 border border-violet-500/20">{ganttSummary.onTrack} on track</span>
          <span className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">{ganttSummary.atRisk} at risk</span>
          <span className="px-2 py-1 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/20">{ganttSummary.overdue} overdue</span>
          <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">{ganttSummary.done} completed</span>
        </div>

        <div className="overflow-x-auto -mx-1 px-1">
          <div className="min-w-[720px]">
            {/* Axis header */}
            <div className="flex items-end h-7 border-b border-[#27272A]">
              <div className="w-[220px] shrink-0 text-[10px] font-mono uppercase tracking-wider text-zinc-500 pb-1.5">
                Project
              </div>
              <div className="relative flex-1 h-full">
                {ganttWindow.ticks
                  .filter((t) => Math.abs(ganttWindow.pct(t) - todayPct) > 4)
                  .map((t, i) => (
                    <span
                      key={i}
                      className="absolute bottom-1.5 -translate-x-1/2 text-[10px] font-mono text-zinc-500 whitespace-nowrap"
                      style={{ left: `${ganttWindow.pct(t)}%` }}
                    >
                      {ganttZoom === 'half' ? t.toLocaleDateString('en-US', { month: 'short' }) : fmtShort(t)}
                    </span>
                  ))}
                <span
                  className="absolute bottom-1.5 -translate-x-1/2 text-[9px] font-mono font-bold px-1 rounded"
                  style={{ left: `${todayPct}%`, backgroundColor: accentColor, color: '#0A0B10' }}
                >
                  TODAY
                </span>
              </div>
            </div>

            {/* Rows */}
            <div className="relative">
              {/* grid + today line overlay (timeline area only) */}
              <div className="absolute inset-y-0 left-[220px] right-0 pointer-events-none">
                {ganttWindow.ticks.map((t, i) => (
                  <div key={i} className="absolute inset-y-0 w-px bg-[#1C1D23]" style={{ left: `${ganttWindow.pct(t)}%` }} />
                ))}
                <div
                  className="absolute inset-y-0 w-[2px] z-20"
                  style={{ left: `${todayPct}%`, backgroundColor: accentColor, boxShadow: `0 0 8px ${accentColor}80` }}
                />
              </div>

              {ganttRows.rows.map((r) => {
                const rawL = ganttWindow.pct(r.start);
                const rawR = ganttWindow.pct(r.end);
                const left = clamp(rawL, 0, 100);
                const right = clamp(rawR, 0, 100);
                const width = right - left;
                const visible = width > 0;
                const isHover = hoveredGantt === r.id;
                const barColor = r.overdue ? '#F43F5E' : r.color;
                return (
                  <div
                    key={r.id}
                    className={`flex items-center h-12 border-b border-[#1C1D23] last:border-b-0 transition-colors ${isHover ? 'bg-white/[0.02]' : ''
                      }`}
                    style={{ position: 'relative', zIndex: isHover ? 30 : 1 }}
                    onMouseEnter={() => setHoveredGantt(r.id)}
                    onMouseLeave={() => setHoveredGantt(null)}
                  >
                    {/* label */}
                    <div className="w-[220px] shrink-0 pr-3 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-1.5 h-6 rounded-full shrink-0" style={{ backgroundColor: barColor }} />
                        <div className="min-w-0">
                          <div className="text-[12.5px] text-white font-medium truncate flex items-center gap-1.5">
                            {r.name}
                            {r.overdue && <AlertTriangle size={11} className="text-rose-400 shrink-0" />}
                            {r.atRisk && <AlertTriangle size={11} className="text-amber-400 shrink-0" />}
                          </div>
                          <div className="text-[10px] font-mono text-zinc-500 truncate">
                            {r.team ? `${r.team} · ` : ''}
                            {r.progress}%
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* timeline */}
                    <div className="relative flex-1 h-full">
                      {visible ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/organizations/${targetSlug}/projects`)}
                          className="absolute top-1/2 -translate-y-1/2 h-6 rounded-md overflow-hidden cursor-pointer transition-all"
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            backgroundColor: `${barColor}2E`,
                            border: `1px solid ${barColor}${isHover ? 'CC' : '66'}`,
                            borderTopLeftRadius: rawL < 0 ? 0 : undefined,
                            borderBottomLeftRadius: rawL < 0 ? 0 : undefined,
                            borderTopRightRadius: rawR > 100 ? 0 : undefined,
                            borderBottomRightRadius: rawR > 100 ? 0 : undefined,
                          }}
                        >
                          <motion.div
                            className="absolute inset-y-0 left-0"
                            initial={{ width: 0 }}
                            animate={{ width: `${r.progress}%` }}
                            transition={{ duration: 0.7, ease: 'easeOut' }}
                            style={{ backgroundColor: barColor, opacity: 0.85 }}
                          />
                          {width > 9 && (
                            <span className="relative z-10 px-2 text-[10.5px] font-semibold text-white whitespace-nowrap leading-6 drop-shadow">
                              {r.progress}%
                            </span>
                          )}
                        </button>
                      ) : (
                        <span
                          className={`absolute top-1/2 -translate-y-1/2 text-[10px] font-mono text-zinc-500 ${rawR <= 0 ? 'left-1' : 'right-1'
                            }`}
                        >
                          {rawR <= 0 ? `◂ ended ${fmtShort(r.end)}` : `starts ${fmtShort(r.start)} ▸`}
                        </span>
                      )}

                      {isHover && visible && (
                        <div
                          className="absolute bottom-[calc(100%-6px)] -translate-x-1/2 pointer-events-none p-2.5 rounded-lg bg-[#0A0B0F]/95 border border-[#27272A] shadow-xl text-[11px] space-y-1 w-[200px]"
                          style={{ left: `${clamp(left + width / 2, 14, 86)}%` }}
                        >
                          <div className="font-semibold text-white truncate">{r.name}</div>
                          <div className="flex justify-between text-zinc-400">
                            <span>Schedule</span>
                            <span className="font-mono text-zinc-200">{fmtShort(r.start)} → {fmtShort(r.end)}</span>
                          </div>
                          <div className="flex justify-between text-zinc-400">
                            <span>Status</span>
                            <span className="font-mono" style={{ color: STATUS_META[r.status]?.color || '#A1A1AA' }}>
                              {STATUS_META[r.status]?.label || r.status}
                            </span>
                          </div>
                          <div className="flex justify-between text-zinc-400">
                            <span>{r.daysLeft >= 0 ? 'Remaining' : 'Late by'}</span>
                            <span className={`font-mono ${r.overdue ? 'text-rose-400' : 'text-zinc-200'}`}>
                              {r.progress >= 100 ? 'Done' : `${Math.abs(r.daysLeft)}d`}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {ganttRows.rows.length === 0 && (
                <p className="text-xs text-zinc-500 italic py-6 text-center">No projects scheduled yet.</p>
              )}
            </div>
          </div>
        </div>

        {ganttRows.hidden > 0 && (
          <Link
            to={`/organizations/${targetSlug}/projects`}
            className="mt-3 text-[11px] font-mono text-zinc-400 hover:text-white inline-flex items-center gap-1"
          >
            +{ganttRows.hidden} more projects <ArrowRight size={11} />
          </Link>
        )}
      </Panel>

      {/* ═══ ROW: TEAM VELOCITY + ACTIVITY HEATMAP ════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Panel
          className="lg:col-span-5"
          icon={<Layers size={16} className="text-purple-400" />}
          title="Squad Velocity"
          subtitle="Share of assigned issues completed"
          right={
            <Link
              to={`/organizations/${targetSlug}/teams`}
              className="text-[11px] text-zinc-400 hover:text-white font-mono flex items-center gap-1"
            >
              All squads <ArrowRight size={11} />
            </Link>
          }
        >
          <div className="space-y-1">
            {teamPerformance.slice(0, 6).map((t, i) => (
              <Link
                key={t.id}
                to={`/organizations/${targetSlug}/teams/${t.id}`}
                className="group flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-white/[0.03] transition-colors"
              >
                <span className="w-4 text-[10px] font-mono text-zinc-600">{i + 1}</span>
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                  style={{ backgroundColor: t.color }}
                >
                  {t.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-white truncate group-hover:text-purple-300 transition-colors">{t.name}</span>
                    <span className="font-mono font-bold text-white text-[11px]">{t.velocityScore}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-[#16171D] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${t.velocityScore}%` }}
                      transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                      style={{ backgroundColor: t.color }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] font-mono text-zinc-500">
                    {t.memberCount} members · {t.tasksCompleted} done{t.open ? ` · ${t.open} open` : ''}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel
          className="lg:col-span-7"
          icon={<Activity size={16} className="text-emerald-400" />}
          title="Activity Heatmap"
          subtitle={`Issue & audit events over the last ${HEAT_WEEKS} weeks`}
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
              <div className="text-xl font-bold font-mono text-emerald-400">{heatmap.best}d</div>
            </div>
          </div>

          <div className="relative overflow-x-auto">
            <div className="inline-flex gap-2 min-w-full">
              <div className="flex flex-col gap-[3px] pt-4 text-[9px] font-mono text-zinc-600 shrink-0">
                {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((d, i) => (
                  <span key={i} className="h-[13px] leading-[13px]">{d}</span>
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
      </div>

      {/* ═══ ROW: DELIVERABLES + SIDEBAR ══════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <Panel
          className="lg:col-span-8"
          icon={<CheckCircle size={16} className="text-indigo-400" />}
          title="Active Deliverables"
          subtitle={`${allTasks.length} issues across all projects`}
          right={
            <div className="flex items-center p-0.5 rounded-lg bg-[#0A0B0F] border border-[#27272A]">
              {(['ALL', 'IN_PROGRESS', 'DONE', 'URGENT'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setIssueFilter(f)}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer font-mono text-[11px] flex items-center gap-1.5 ${issueFilter === f ? 'bg-[#1C1E26] text-white' : 'text-zinc-500 hover:text-zinc-200'
                    }`}
                >
                  {f === 'IN_PROGRESS' ? 'Active' : f === 'URGENT' ? 'Hot' : f === 'DONE' ? 'Done' : 'All'}
                  <span className="text-[9.5px] text-zinc-500">{filterCounts[f]}</span>
                </button>
              ))}
            </div>
          }
        >
          <div className="hidden sm:grid grid-cols-[1fr_90px_100px_70px] gap-3 px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-zinc-600">
            <span>Issue</span>
            <span>Priority</span>
            <span>Status</span>
            <span className="text-right">Due</span>
          </div>
          <div className="divide-y divide-[#1C1D23] rounded-xl border border-[#1F2027] overflow-hidden">
            {filteredTasks.length === 0 ? (
              <p className="text-xs text-zinc-500 italic py-6 text-center">No tasks match this filter.</p>
            ) : (
              filteredTasks.map((t: any) => {
                const pr = PRIORITY_META.find((p) => p.key === t.priority);
                const due = toDate(t.dueDate);
                const late = due && due < today && t.status !== 'DONE';
                return (
                  <div
                    key={t.id}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_90px_100px_70px] gap-2 sm:gap-3 items-center px-3 py-2.5 bg-[#101116] hover:bg-[#14151B] transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${t.status === 'DONE' ? 'bg-emerald-400' : t.status === 'IN_PROGRESS' ? 'bg-indigo-400' : 'bg-zinc-600'
                          }`}
                      />
                      <span className={`truncate ${t.status === 'DONE' ? 'text-zinc-500 line-through' : 'text-white'}`}>{t.title}</span>
                    </div>
                    <span className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pr?.color || '#71717A' }} />
                      {pr?.label || t.priority || '—'}
                    </span>
                    <span
                      className={`justify-self-start px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${t.status === 'DONE'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : t.status === 'IN_PROGRESS'
                          ? 'bg-indigo-500/10 text-indigo-300'
                          : 'bg-zinc-800 text-zinc-400'
                        }`}
                    >
                      {(t.status || 'TODO').replace(/_/g, ' ')}
                    </span>
                    <span className={`sm:text-right font-mono text-[10.5px] ${late ? 'text-rose-400' : 'text-zinc-500'}`}>
                      {due ? fmtShort(due) : '—'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </Panel>

        <div className="lg:col-span-4 space-y-4">
          {/* Audit log */}
          <section className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity size={15} className="text-blue-400" />
                <h3 className="font-semibold text-[14px] text-white">Audit Log</h3>
              </div>
              <Link
                to={`/organizations/${targetSlug}/activity`}
                className="text-[11px] font-mono text-zinc-400 hover:text-white flex items-center gap-1"
              >
                View all <ArrowRight size={11} />
              </Link>
            </div>

            {last8AuditLogs.length === 0 ? (
              <p className="text-xs text-zinc-500 italic py-2 text-center">No audit logs recorded yet.</p>
            ) : (
              <ol className="relative pl-6 space-y-3.5">
                <div className="absolute left-[9px] top-2 bottom-2 w-px bg-[#27272A]" />
                {last8AuditLogs.map((act) => (
                  <li key={act.id} className="relative group">
                    <div className="absolute -left-6 top-0 w-[19px] h-[19px] rounded-full border border-[#27272A] bg-[#12131A] flex items-center justify-center z-10 group-hover:border-zinc-500 transition-colors">
                      {getActivityIcon(act)}
                    </div>
                    <p className="text-xs text-zinc-200 leading-snug line-clamp-2">{formatActivityText(act)}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-mono text-zinc-500">
                      <span className="uppercase">{act.resourceType}</span>
                      <span>·</span>
                      <span>{formatRelativeTime(act.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};