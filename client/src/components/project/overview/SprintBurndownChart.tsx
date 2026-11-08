import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface BurndownPoint {
  day: string;
  actual?: number;
  ideal: number;
}

interface SprintBurndownChartProps {
  data?: BurndownPoint[] | null;
  isIllustrative?: boolean;
}

export const SprintBurndownChart: React.FC<SprintBurndownChartProps> = ({
  data,
  isIllustrative = true,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const defaultPoints: BurndownPoint[] = [
    { day: 'Day 0', actual: 60, ideal: 60 },
    { day: 'Day 2', actual: 52, ideal: 48 },
    { day: 'Day 5', actual: 38, ideal: 30 },
    { day: 'Day 7', actual: 24, ideal: 18 },
    { day: 'Day 10', actual: 12, ideal: 0 },
  ];

  const points = data && data.length > 0 ? data : defaultPoints;

  // Coordinate mapping for SVG (width: 280, height: 130, padding: 25)
  const width = 280;
  const height = 130;
  const padLeft = 32;
  const padRight = 16;
  const padTop = 15;
  const padBottom = 25;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const maxVal = 60;

  const getX = (idx: number) => padLeft + (idx / (points.length - 1)) * chartW;
  const getY = (val: number) => padTop + chartH - (val / maxVal) * chartH;

  // Build SVG path strings
  const idealPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.ideal)}`).join(' ');
  const actualPoints = points.filter((p) => p.actual !== undefined);
  const actualPath = actualPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.actual!)}`).join(' ');

  return (
    <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm flex flex-col justify-between hover:border-zinc-700 transition-colors group">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">
            Sprint Burndown
          </span>
          <p className="text-[11px] text-zinc-500">Remaining story points</p>
        </div>
        {isIllustrative && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-zinc-800 text-zinc-400">
            Illustrative
          </span>
        )}
      </div>

      {/* SVG Chart */}
      <div className="my-2 relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32 overflow-visible">
          {/* Horizontal Gridlines */}
          {[0, 20, 40, 60].map((val) => (
            <g key={val}>
              <line
                x1={padLeft}
                y1={getY(val)}
                x2={width - padRight}
                y2={getY(val)}
                stroke="#27272A"
                strokeDasharray="2 2"
                strokeWidth="1"
              />
              <text
                x={padLeft - 6}
                y={getY(val) + 3}
                fill="#71717A"
                fontSize="9"
                textAnchor="end"
                fontFamily="monospace"
              >
                {val}
              </text>
            </g>
          ))}

          {/* Ideal line (dashed gray) */}
          <path
            d={idealPath}
            fill="none"
            stroke="#71717A"
            strokeDasharray="4 4"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* Actual line (solid blue) */}
          <motion.path
            d={actualPath}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={shouldReduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />

          {/* Actual points */}
          {actualPoints.map((p, i) => (
            <g key={i}>
              <circle
                cx={getX(i)}
                cy={getY(p.actual!)}
                r={hoveredIdx === i ? 4.5 : 3}
                fill="#3B82F6"
                stroke="#09090B"
                strokeWidth="1.5"
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            </g>
          ))}

          {/* X Axis Labels */}
          {points.map((p, i) => {
            if (i === 0 || i === 2 || i === points.length - 1) {
              return (
                <text
                  key={i}
                  x={getX(i)}
                  y={height - 5}
                  fill="#71717A"
                  fontSize="9"
                  textAnchor="middle"
                  fontFamily="sans-serif"
                >
                  {p.day}
                </text>
              );
            }
            return null;
          })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredIdx !== null && points[hoveredIdx]?.actual !== undefined && (
          <div
            className="absolute -top-3 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-white text-[10px] pointer-events-none shadow-lg -translate-x-1/2 whitespace-nowrap z-10"
            style={{
              left: `${(getX(hoveredIdx) / width) * 100}%`,
            }}
          >
            <span className="font-semibold text-blue-400">{points[hoveredIdx].actual} pts</span>
            <span className="text-zinc-400 ml-1">({points[hoveredIdx].day})</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/80">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-0.5 bg-blue-500 rounded-full" />
          <span>Actual</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-0.5 border-t border-dashed border-zinc-400" />
          <span>Ideal burndown</span>
        </div>
      </div>
    </div>
  );
};

