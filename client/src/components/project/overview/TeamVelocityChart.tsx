import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface VelocityPoint {
  sprint: string;
  points: number;
  isCurrent: boolean;
}

interface TeamVelocityChartProps {
  data?: VelocityPoint[] | null;
  isIllustrative?: boolean;
}

export const TeamVelocityChart: React.FC<TeamVelocityChartProps> = ({
  data,
  isIllustrative = true,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const defaultVelocity: VelocityPoint[] = [
    { sprint: 'S1', points: 28, isCurrent: false },
    { sprint: 'S2', points: 34, isCurrent: false },
    { sprint: 'S3', points: 42, isCurrent: false },
    { sprint: 'S4', points: 45, isCurrent: false },
    { sprint: 'S5', points: 52, isCurrent: true },
    { sprint: 'S6', points: 0, isCurrent: false },
  ];

  const points = data && data.length > 0 ? data : defaultVelocity;

  const width = 280;
  const height = 130;
  const padLeft = 32;
  const padRight = 12;
  const padTop = 15;
  const padBottom = 25;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const maxVal = 60;

  const barWidth = 20;
  const getX = (idx: number) =>
    padLeft + (idx / points.length) * chartW + (chartW / points.length - barWidth) / 2;
  const getBarHeight = (pts: number) => (pts / maxVal) * chartH;
  const getY = (pts: number) => padTop + chartH - getBarHeight(pts);

  return (
    <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm flex flex-col justify-between hover:border-zinc-700 transition-colors group">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">
            Team Velocity
          </span>
          <p className="text-[11px] text-zinc-500">Points delivered per sprint</p>
        </div>
        {isIllustrative && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-zinc-800 text-zinc-400">
            Illustrative
          </span>
        )}
      </div>

      {/* SVG Bar Chart */}
      <div className="my-2 relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32 overflow-visible">
          {/* Gridlines */}
          {[0, 30, 60].map((val) => (
            <g key={val}>
              <line
                x1={padLeft}
                y1={padTop + chartH - (val / maxVal) * chartH}
                x2={width - padRight}
                y2={padTop + chartH - (val / maxVal) * chartH}
                stroke="#27272A"
                strokeDasharray="2 2"
                strokeWidth="1"
              />
              <text
                x={padLeft - 6}
                y={padTop + chartH - (val / maxVal) * chartH + 3}
                fill="#71717A"
                fontSize="9"
                textAnchor="end"
                fontFamily="monospace"
              >
                {val}
              </text>
            </g>
          ))}

          {/* Bars */}
          {points.map((p, i) => {
            const barH = getBarHeight(p.points);
            const barY = getY(p.points);
            const isBlue = p.isCurrent;
            const barColor = isBlue ? '#3B82F6' : '#A855F7';

            return (
              <g
                key={p.sprint}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {/* Bar rect */}
                {p.points > 0 ? (
                  <motion.rect
                    x={getX(i)}
                    y={shouldReduceMotion ? barY : padTop + chartH}
                    width={barWidth}
                    height={shouldReduceMotion ? barH : 0}
                    animate={{ y: barY, height: barH }}
                    transition={{
                      duration: 0.6,
                      delay: (i * 80) / 1000,
                      ease: 'easeOut',
                    }}
                    rx="3"
                    fill={hoveredIdx === i ? '#60A5FA' : barColor}
                    opacity={hoveredIdx !== null && hoveredIdx !== i ? 0.6 : 1}
                  />
                ) : (
                  <rect
                    x={getX(i)}
                    y={padTop + chartH - 2}
                    width={barWidth}
                    height={2}
                    rx="1"
                    fill="#3F3F46"
                  />
                )}

                {/* X label */}
                <text
                  x={getX(i) + barWidth / 2}
                  y={height - 5}
                  fill={p.isCurrent ? '#60A5FA' : '#71717A'}
                  fontSize="9"
                  fontWeight={p.isCurrent ? 'bold' : 'normal'}
                  textAnchor="middle"
                >
                  {p.sprint}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredIdx !== null && (
          <div
            className="absolute -top-3 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-white text-[10px] pointer-events-none shadow-lg -translate-x-1/2 whitespace-nowrap z-10"
            style={{
              left: `${((getX(hoveredIdx) + barWidth / 2) / width) * 100}%`,
            }}
          >
            <span className="font-semibold text-purple-400">
              {points[hoveredIdx].points} pts
            </span>
            <span className="text-zinc-400 ml-1">
              ({points[hoveredIdx].sprint} {points[hoveredIdx].isCurrent ? '· Active' : ''})
            </span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/80">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded bg-purple-500" />
          <span>Past Sprints</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded bg-blue-500" />
          <span>Current (S5)</span>
        </div>
      </div>
    </div>
  );
};

