import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface ProgressBarItem {
  label: string;
  pct: number;
  color: string;
  category: 'requirements' | 'tasks' | 'sprint' | 'testing';
  isIllustrative?: boolean;
}

interface ProjectProgressCardProps {
  progressBars: ProgressBarItem[];
  showIllustrativeTag?: boolean;
}

export const ProjectProgressCard: React.FC<ProjectProgressCardProps> = ({
  progressBars,
  showIllustrativeTag,
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white tracking-wide uppercase">
            Project progress
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Cross-module velocity across specifications, backlog, sprint, and quality
          </p>
        </div>
        {showIllustrativeTag && (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Illustrative data
          </span>
        )}
      </div>

      <div className="space-y-3.5 pt-1">
        {progressBars.map((item, idx) => (
          <div key={item.category} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium">
              <div className="flex items-center gap-2">
                <span className="text-zinc-200">{item.label}</span>
                {item.isIllustrative && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-zinc-800 text-zinc-400">
                    Unconnected
                  </span>
                )}
              </div>
              <span className="text-white font-mono font-semibold">{item.pct}%</span>
            </div>

            <div className="w-full h-2 rounded-full bg-zinc-800/80 overflow-hidden">
              <motion.div
                initial={shouldReduceMotion ? { width: `${item.pct}%` } : { width: '0%' }}
                animate={{ width: `${Math.min(Math.max(item.pct, 0), 100)}%` }}
                transition={{
                  duration: 0.8,
                  delay: (idx * 120) / 1000,
                  ease: 'easeOut',
                }}
                className="h-full rounded-full transition-all"
                style={{ backgroundColor: item.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

