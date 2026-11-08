import {
  GitFork,
  CircleDot,
  CheckCircle2,
  GitPullRequest,
  Clock,
  ShieldCheck,
  GitMerge,
  AlertTriangle,
  GitCommit,
  ArrowUpRight,
  LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface GitSummaryCardProps {
  id: string;
  title: string;
  count: number | string;
  subtitle?: string;
  badge?: string;
  badgeColor?: 'emerald' | 'amber' | 'rose' | 'indigo' | 'zinc';
  icon?: string;
  color?: string;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}

const ICON_MAP: Record<string, LucideIcon> = {
  'total-repos': GitFork,
  'open-issues': CircleDot,
  'closed-issues': CheckCircle2,
  'open-mrs': GitPullRequest,
  'mrs-awaiting-review': Clock,
  'approved-mrs': ShieldCheck,
  'merged-mrs': GitMerge,
  'mrs-with-conflicts': AlertTriangle,
  'recent-commits': GitCommit,
  'git-fork': GitFork,
  'circle-dot': CircleDot,
  'git-pull-request': GitPullRequest,
};

export const GitSummaryCard: React.FC<GitSummaryCardProps> = ({
  id,
  title,
  count,
  subtitle,
  badge,
  badgeColor = 'zinc',
  icon,
  color = '#6366F1',
  isActive = false,
  onClick,
  className,
}) => {
  const IconComponent = ICON_MAP[icon || id] || CircleDot;

  const badgeColorClasses = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    zinc: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  }[badgeColor];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'group relative flex flex-col justify-between p-4 rounded-xl border text-left transition-all duration-150',
        onClick
          ? 'cursor-pointer hover:border-zinc-700 hover:bg-[#15161E] hover:shadow-md'
          : 'cursor-default',
        isActive
          ? 'border-indigo-500/50 bg-[#151622] shadow-sm ring-1 ring-indigo-500/30'
          : 'border-[#27272A] bg-[#0E0F15]',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 w-full">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-white/5 transition-transform group-hover:scale-105"
            style={{ backgroundColor: `${color}20`, color }}
          >
            <IconComponent size={16} />
          </div>
          <span className="text-xs font-medium text-zinc-400 truncate group-hover:text-zinc-200 transition-colors">
            {title}
          </span>
        </div>

        {onClick && (
          <ArrowUpRight
            size={14}
            className="text-zinc-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0"
          />
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <div className="text-2xl font-bold tracking-tight text-white font-mono">
          {count}
        </div>

        {badge ? (
          <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border', badgeColorClasses)}>
            {badge}
          </span>
        ) : subtitle ? (
          <span className="text-[11px] text-zinc-500 truncate">{subtitle}</span>
        ) : null}
      </div>
    </button>
  );
};
