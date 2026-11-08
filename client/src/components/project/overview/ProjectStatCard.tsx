import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface ProjectStatCardProps {
  title: string;
  value: number | string;
  subText: string;
  subTextColor?: string;
  progressPct?: number;
  progressColor?: string;
  badge?: string;
  badgeColor?: string;
  delayMs?: number;
}

export const ProjectStatCard: React.FC<ProjectStatCardProps> = ({
  title,
  value,
  subText,
  subTextColor = 'text-zinc-400',
  progressPct,
  progressColor = 'bg-blue-500',
  badge,
  badgeColor = 'bg-zinc-800 text-zinc-300 border-zinc-700',
  delayMs = 0,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const numericValue = typeof value === 'number' ? value : parseFloat(value as string);
  const isNumeric = !isNaN(numericValue) && typeof value !== 'string';

  const [displayValue, setDisplayValue] = useState<number | string>(
    shouldReduceMotion || !isNumeric ? value : 0
  );

  useEffect(() => {
    if (shouldReduceMotion || !isNumeric) {
      setDisplayValue(value);
      return;
    }

    let startTime: number | null = null;
    const duration = 400; // 400ms count-up ease-out

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // easeOutQuad: progress * (2 - progress)
      const easeProgress = progress * (2 - progress);
      const current = Math.round(easeProgress * numericValue);
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setDisplayValue(numericValue);
      }
    };

    const timer = setTimeout(() => {
      requestAnimationFrame(step);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [value, numericValue, isNumeric, delayMs, shouldReduceMotion]);

  const renderFormattedValue = () => {
    const str = String(displayValue);
    if (str.endsWith('%')) return str;
    if (typeof value === 'string' && value.endsWith('%')) return `${str}%`;
    return str;
  };

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: delayMs / 1000,
        ease: 'easeOut',
      }}
      whileHover={shouldReduceMotion ? {} : { y: -2, transition: { duration: 0.15 } }}
      className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 shadow-sm transition-colors flex flex-col justify-between select-none group min-h-[110px]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
          {title}
        </span>
        {badge && (
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${badgeColor}`}
          >
            {badge}
          </span>
        )}
      </div>

      <div className="my-1">
        <div className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
          {renderFormattedValue()}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className={`text-xs ${subTextColor} font-medium truncate flex items-center gap-1.5`}>
          {subText}
        </div>

        {progressPct !== undefined && (
          <div className="w-full h-1 rounded-full bg-zinc-800 overflow-hidden">
            <motion.div
              initial={shouldReduceMotion ? { width: `${progressPct}%` } : { width: '0%' }}
              animate={{ width: `${Math.min(Math.max(progressPct, 0), 100)}%` }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: (delayMs + 150) / 1000 }}
              className={`h-full rounded-full ${progressColor}`}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
};

