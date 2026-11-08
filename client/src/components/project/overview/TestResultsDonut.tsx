import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface TestResultsData {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  passPct: number;
}

interface TestResultsDonutProps {
  data?: TestResultsData | null;
  isIllustrative?: boolean;
}

export const TestResultsDonut: React.FC<TestResultsDonutProps> = ({
  data,
  isIllustrative = true,
}) => {
  const shouldReduceMotion = useReducedMotion();

  const defaultResults: TestResultsData = {
    total: 120,
    passed: 94,
    failed: 14,
    pending: 12,
    passPct: 78,
  };

  const results = data || defaultResults;

  // Donut geometry
  const radius = 42;
  const strokeWidth = 9;
  const circumference = 2 * Math.PI * radius;

  // Segment ratios
  const passRatio = results.total > 0 ? results.passed / results.total : 0;
  const failRatio = results.total > 0 ? results.failed / results.total : 0;
  const pendRatio = results.total > 0 ? results.pending / results.total : 0;

  const passLength = circumference * passRatio;
  const failLength = circumference * failRatio;
  const pendLength = circumference * pendRatio;

  return (
    <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm flex flex-col justify-between hover:border-zinc-700 transition-colors group">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">
            Test Results
          </span>
          <p className="text-[11px] text-zinc-500">{results.total} total cases</p>
        </div>
        {isIllustrative && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-zinc-800 text-zinc-400">
            Illustrative
          </span>
        )}
      </div>

      {/* Donut Chart & Center Metric */}
      <div className="flex items-center justify-center my-2">
        <div className="relative w-28 h-28 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 110 110">
            {/* Background ring */}
            <circle
              cx="55"
              cy="55"
              r={radius}
              stroke="#27272A"
              strokeWidth={strokeWidth}
              fill="transparent"
            />

            {/* Pending segment (amber) */}
            <circle
              cx="55"
              cy="55"
              r={radius}
              stroke="#F59E0B"
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={`${pendLength} ${circumference}`}
              strokeDashoffset={-(passLength + failLength)}
              strokeLinecap="round"
            />

            {/* Failed segment (red) */}
            <circle
              cx="55"
              cy="55"
              r={radius}
              stroke="#EF4444"
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={`${failLength} ${circumference}`}
              strokeDashoffset={-passLength}
              strokeLinecap="round"
            />

            {/* Passed segment (green, animated stroke-dashoffset draw-in 700ms) */}
            <motion.circle
              cx="55"
              cy="55"
              r={radius}
              stroke="#10B981"
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={`${passLength} ${circumference}`}
              initial={
                shouldReduceMotion
                  ? { strokeDashoffset: 0 }
                  : { strokeDashoffset: passLength }
              }
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              strokeLinecap="round"
            />
          </svg>

          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-base font-bold text-white tracking-tight">
              {results.passPct}%
            </span>
            <span className="text-[10px] text-zinc-400 font-medium">passed</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-1 text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/80">
        <div className="flex items-center gap-1.5 truncate">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="truncate">{results.passed} passed</span>
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          <span className="truncate">{results.failed} failed</span>
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <span className="truncate">{results.pending} pending</span>
        </div>
      </div>
    </div>
  );
};

