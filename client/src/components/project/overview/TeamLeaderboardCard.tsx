import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Users, ChevronRight, Award } from 'lucide-react';

interface LeaderboardMember {
  id: number;
  name: string;
  username: string | null;
  role: string;
  avatarColor: string;
  workloadPct: number;
  doneCount: number;
  assignedCount: number;
}

interface TeamLeaderboardCardProps {
  members: LeaderboardMember[];
  onViewAll?: () => void;
}

const BAR_COLORS = [
  '#A3E635', // 01 Lime green (matching Image 4)
  '#3B82F6', // 02 Blue
  '#F97316', // 03 Coral / Orange
  '#A855F7', // 04 Purple
  '#06B6D4', // 05 Cyan
];

export const TeamLeaderboardCard: React.FC<TeamLeaderboardCardProps> = ({
  members,
  onViewAll,
}) => {
  const shouldReduceMotion = useReducedMotion();

  // Sort descending by workloadPct
  const sorted = [...members].sort((a, b) => b.workloadPct - a.workloadPct).slice(0, 5);

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm flex flex-col justify-between group hover:border-zinc-700/80 transition-colors">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-3.5 rounded-full bg-lime-400" />
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Team Leaderboard
            </h3>
          </div>
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="text-[11px] font-medium text-zinc-400 hover:text-white inline-flex items-center gap-0.5 cursor-pointer transition-colors"
            >
              <span>Workload View</span>
              <ChevronRight size={12} />
            </button>
          )}
        </div>

        <div className="space-y-3">
          {sorted.map((m, idx) => {
            const rank = String(idx + 1).padStart(2, '0');
            const barColor = BAR_COLORS[idx % BAR_COLORS.length];
            const initials = getInitials(m.name);

            return (
              <div key={m.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[11px] font-mono font-bold text-zinc-500 w-4 text-center">
                      {rank}
                    </span>
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-black shrink-0"
                      style={{ backgroundColor: barColor }}
                    >
                      {initials}
                    </div>
                    <span className="font-semibold text-white truncate max-w-[140px]">
                      {m.name}
                    </span>
                  </div>
                  <span className="font-bold text-white font-mono text-[11px]">
                    {m.workloadPct}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden ml-6.5 max-w-[calc(100%-26px)]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: barColor }}
                    initial={shouldReduceMotion ? { width: `${m.workloadPct}%` } : { width: '0%' }}
                    animate={{ width: `${m.workloadPct}%` }}
                    transition={{ duration: 0.6, delay: idx * 0.08 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-3 mt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
        <span className="flex items-center gap-1 text-zinc-400">
          <Award size={12} className="text-amber-400" />
          <span>Calculated by sprint velocity</span>
        </span>
        <span>{members.length} contributors</span>
      </div>
    </div>
  );
};

