import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Bug, Sparkles, TrendingDown, CheckCircle2 } from 'lucide-react';

interface DefectPoint {
  month: string;
  reported: number;
  resolved: number;
}

interface DefectTrendChartProps {
  data?: DefectPoint[] | null;
  isIllustrative?: boolean;
}

const DEFAULT_DATA: DefectPoint[] = [
  { month: 'Jun', reported: 18, resolved: 14 },
  { month: 'Jul', reported: 24, resolved: 22 },
  { month: 'Aug', reported: 32, resolved: 30 },
  { month: 'Sep', reported: 16, resolved: 20 },
  { month: 'Oct', reported: 10, resolved: 12 },
  { month: 'Nov', reported: 4, resolved: 8 },
];

export const DefectTrendChart: React.FC<DefectTrendChartProps> = ({
  data,
  isIllustrative = true,
}) => {
  const chartData = data && data.length > 0 ? data : DEFAULT_DATA;
  const shouldReduceMotion = useReducedMotion();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Calculate net open defect trajectory
  // Cumulative net: reported - resolved
  let currentCumulative = 12;
  const netTrajectory = chartData.map((d) => {
    currentCumulative += d.reported - d.resolved;
    return {
      month: d.month,
      reported: d.reported,
      resolved: d.resolved,
      net: currentCumulative,
    };
  });

  const width = 360;
  const height = 180;
  const paddingLeft = 36;
  const paddingRight = 16;
  const paddingTop = 20;
  const paddingBottom = 28;

  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  const minVal = Math.min(...netTrajectory.map((d) => d.net), 0);
  const maxVal = Math.max(...netTrajectory.map((d) => d.net), 30);
  const range = maxVal - minVal || 1;

  const getX = (idx: number) => {
    return paddingLeft + (idx / (netTrajectory.length - 1)) * innerWidth;
  };

  const getY = (val: number) => {
    return paddingTop + innerHeight - ((val - minVal) / range) * innerHeight;
  };

  // Build smooth cubic bezier curve
  const points = netTrajectory.map((d, i) => ({ x: getX(i), y: getY(d.net) }));
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpX1 = p0.x + (p1.x - p0.x) / 2;
    const cpY1 = p0.y;
    const cpX2 = p0.x + (p1.x - p0.x) / 2;
    const cpY2 = p1.y;
    pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
  }

  // Area fill path
  const areaD = `${pathD} L ${points[points.length - 1].x} ${getY(minVal)} L ${points[0].x} ${getY(
    minVal
  )} Z`;

  const latest = netTrajectory[netTrajectory.length - 1];
  const previous = netTrajectory[netTrajectory.length - 2] || netTrajectory[0];
  const isDecreasing = latest.net <= previous.net;

  return (
    <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-zinc-700/80 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="flex items-center gap-1.5">
            <Bug size={14} className="text-purple-400" />
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Defect & Bug Trend
            </h3>
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            6 months rolling net defect rate
          </p>
        </div>

        {isIllustrative && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 shrink-0">
            <Sparkles size={10} />
            <span>Illustrative data</span>
          </span>
        )}
      </div>

      {/* Quick stats strip */}
      <div className="flex items-center gap-4 py-1.5 border-b border-zinc-800/60 mb-2">
        <div>
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Net Open</span>
          <span className="text-lg font-bold text-white tracking-tight">{latest.net}</span>
        </div>
        <div>
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Status</span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
            <TrendingDown size={13} />
            <span>Resolution pacing</span>
          </span>
        </div>
        <div className="ml-auto text-right">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Last Month</span>
          <span className="text-xs font-medium text-purple-300">
            +{latest.reported} / -{latest.resolved}
          </span>
        </div>
      </div>

      {/* SVG Chart inspired by Image 3 */}
      <div className="relative w-full h-[180px] select-none">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="purpleGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A855F7" stopOpacity="0.4" />
              <stop offset="70%" stopColor="#A855F7" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#A855F7" stopOpacity="0.0" />
            </linearGradient>
            <filter id="neonBlur" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#A855F7" floodOpacity="0.6" />
            </filter>
          </defs>

          {/* Horizontal grid lines */}
          {[0, 0.5, 1].map((ratio) => {
            const val = minVal + ratio * range;
            const y = getY(val);
            return (
              <g key={ratio}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#27272A"
                  strokeDasharray="2 3"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="#71717A"
                  fontFamily="monospace"
                >
                  {Math.round(val)}
                </text>
              </g>
            );
          })}

          {/* Area gradient under the curve */}
          <path d={areaD} fill="url(#purpleGlow)" />

          {/* Glowing curve stroke */}
          <motion.path
            d={pathD}
            fill="none"
            stroke="#A855F7"
            strokeWidth="2.5"
            strokeLinecap="round"
            filter="url(#neonBlur)"
            initial={shouldReduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />

          {/* Interactive point circles */}
          {points.map((p, i) => {
            const isHovered = hoveredIdx === i;
            return (
              <g key={i}>
                {/* Hit target */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="12"
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />

                {/* Point */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 5 : 3.5}
                  fill={isHovered ? '#C084FC' : '#18181B'}
                  stroke="#A855F7"
                  strokeWidth={isHovered ? 2.5 : 2}
                  className="transition-all duration-150 pointer-events-none"
                />

                {/* X-axis labels */}
                <text
                  x={p.x}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fill={isHovered ? '#FFFFFF' : '#A1A1AA'}
                  fontWeight={isHovered ? '600' : '400'}
                  className="pointer-events-none transition-colors"
                >
                  {netTrajectory[i].month}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating tooltip on hover */}
        {hoveredIdx !== null && (
          <div
            className="absolute z-20 pointer-events-none px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700/80 shadow-xl text-[11px] space-y-0.5"
            style={{
              left: `${Math.min(Math.max((points[hoveredIdx].x / width) * 100, 15), 85)}%`,
              top: `${Math.max((points[hoveredIdx].y / height) * 100 - 32, 0)}%`,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="font-semibold text-white">
              {netTrajectory[hoveredIdx].month}: Net {netTrajectory[hoveredIdx].net} defects
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-red-400">+{netTrajectory[hoveredIdx].reported} new</span>
              <span className="text-emerald-400">-{netTrajectory[hoveredIdx].resolved} resolved</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer summary */}
      <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-2 border-t border-zinc-800/80 mt-2">
        <span className="flex items-center gap-1 text-emerald-400 font-medium">
          <CheckCircle2 size={12} />
          <span>Burn-rate stable</span>
        </span>
        <span>Resolution exceeds intake</span>
      </div>
    </div>
  );
};

