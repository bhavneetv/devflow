import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DocumentSummaryCardProps {
  title: string;
  value: string | number;
  sublabel?: string;
  icon: LucideIcon;
  color?: 'blue' | 'emerald' | 'amber' | 'purple' | 'indigo' | 'rose' | 'zinc' | 'cyan';
  badge?: {
    text: string;
    variant?: 'success' | 'warning' | 'info' | 'neutral';
  };
  onClick?: () => void;
}

const COLOR_MAP = {
  blue: {
    bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    borderHover: 'hover:border-blue-500/40',
    glow: 'from-blue-500/5',
  },
  emerald: {
    bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    borderHover: 'hover:border-emerald-500/40',
    glow: 'from-emerald-500/5',
  },
  amber: {
    bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    borderHover: 'hover:border-amber-500/40',
    glow: 'from-amber-500/5',
  },
  purple: {
    bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    borderHover: 'hover:border-purple-500/40',
    glow: 'from-purple-500/5',
  },
  indigo: {
    bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    borderHover: 'hover:border-indigo-500/40',
    glow: 'from-indigo-500/5',
  },
  rose: {
    bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    borderHover: 'hover:border-rose-500/40',
    glow: 'from-rose-500/5',
  },
  zinc: {
    bg: 'bg-zinc-800 text-zinc-300 border-zinc-700/50',
    borderHover: 'hover:border-zinc-600',
    glow: 'from-zinc-500/5',
  },
  cyan: {
    bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    borderHover: 'hover:border-cyan-500/40',
    glow: 'from-cyan-500/5',
  },
};

export const DocumentSummaryCard: React.FC<DocumentSummaryCardProps> = ({
  title,
  value,
  sublabel,
  icon: Icon,
  color = 'blue',
  badge,
  onClick,
}) => {
  const styles = COLOR_MAP[color] || COLOR_MAP.blue;

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-xl bg-zinc-900/80 border border-zinc-800/80 p-4 transition-all duration-200',
        onClick && 'cursor-pointer hover:bg-zinc-850',
        styles.borderHover
      )}
    >
      <div className={cn('absolute -right-4 -top-4 w-24 h-24 rounded-full bg-gradient-to-br to-transparent pointer-events-none opacity-40', styles.glow)} />

      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">
            {title}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-white">
              {value}
            </span>
            {badge && (
              <span
                className={cn(
                  'text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide',
                  badge.variant === 'success' && 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
                  badge.variant === 'warning' && 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
                  badge.variant === 'info' && 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
                  (!badge.variant || badge.variant === 'neutral') && 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                )}
              >
                {badge.text}
              </span>
            )}
          </div>
          {sublabel && (
            <p className="text-[11px] text-zinc-500 line-clamp-1">{sublabel}</p>
          )}
        </div>

        <div className={cn('p-2.5 rounded-lg border shadow-sm shrink-0', styles.bg)}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
};

