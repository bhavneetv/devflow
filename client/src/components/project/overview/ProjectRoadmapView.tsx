import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Calendar, CheckCircle2, Clock, Target, Layers, List, GanttChartSquare, GitCommit } from 'lucide-react';

interface RoadmapPhase {
  id: string;
  phaseNumber: number;
  name: string;
  description: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PLANNED';
  progressPct: number;
  targetDate: string;
  deliverablesCount: number;
}

interface RoadmapMilestone {
  id: string;
  title: string;
  targetDate: string;
  status: 'DONE' | 'IN_PROGRESS' | 'UPCOMING';
  completionPct: number;
  isCritical: boolean;
  ownerName: string;
}

interface ProjectRoadmapViewProps {
  roadmap: {
    objectives: Array<{ id: string; title: string; targetQuarter: string; progressPct: number }>;
    phases: RoadmapPhase[];
    milestones: RoadmapMilestone[];
  };
}

export const ProjectRoadmapView: React.FC<ProjectRoadmapViewProps> = ({ roadmap }) => {
  const [viewMode, setViewMode] = useState<'timeline' | 'gantt' | 'list'>('timeline');
  const shouldReduceMotion = useReducedMotion();

  const getPhaseBadge = (status: RoadmapPhase['status']) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'IN_PROGRESS':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'PLANNED':
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Roadmap Controls & View Switcher */}
      <div className="flex items-center justify-between flex-wrap gap-4 p-4 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide flex items-center gap-2">
            <Target size={16} className="text-purple-400" />
            <span>Interactive Project Roadmap</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Phases, milestone gates, objectives, and critical path delivery
          </p>
        </div>

        {/* View Switcher: Timeline | Gantt | List */}
        <div className="flex items-center p-1 rounded-xl bg-zinc-950 border border-zinc-800">
          <button
            onClick={() => setViewMode('timeline')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              viewMode === 'timeline'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Clock size={13} />
            <span>Timeline</span>
          </button>
          <button
            onClick={() => setViewMode('gantt')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              viewMode === 'gantt'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <GanttChartSquare size={13} />
            <span>Gantt</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              viewMode === 'list'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <List size={13} />
            <span>Milestone List</span>
          </button>
        </div>
      </div>

      {/* High-Level Objectives Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {roadmap.objectives.map((obj, i) => (
          <div
            key={obj.id}
            className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2 hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                OKR · {obj.targetQuarter}
              </span>
              <span className="font-mono text-zinc-300 font-semibold">{obj.progressPct}%</span>
            </div>
            <p className="text-xs font-semibold text-zinc-100 leading-snug">{obj.title}</p>
            <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-purple-500 transition-all duration-500"
                style={{ width: `${obj.progressPct}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* VIEW: Timeline Mode */}
      {viewMode === 'timeline' && (
        <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-6">
          <div className="relative border-l-2 border-zinc-800 ml-4 space-y-8 pl-6">
            {roadmap.phases.map((phase, idx) => (
              <motion.div
                key={phase.id}
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: idx * 0.08 }}
                className="relative space-y-2 group"
              >
                {/* Node icon */}
                <div
                  className={`absolute -left-[33px] top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-transform group-hover:scale-125 ${
                    phase.status === 'COMPLETED'
                      ? 'bg-emerald-500 border-zinc-950 text-zinc-950'
                      : phase.status === 'IN_PROGRESS'
                      ? 'bg-blue-500 border-zinc-950 text-zinc-950 animate-pulse'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                  }`}
                >
                  <span className="text-[10px] font-bold">{phase.phaseNumber}</span>
                </div>

                {/* Content */}
                <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700 transition-colors space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-sm font-semibold text-white">
                        Phase {phase.phaseNumber}: {phase.name}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getPhaseBadge(
                          phase.status
                        )}`}
                      >
                        {phase.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} className="text-zinc-500" />
                        <span>Target: {phase.targetDate}</span>
                      </span>
                      <span className="font-mono text-white font-bold">{phase.progressPct}%</span>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">{phase.description}</p>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        phase.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${phase.progressPct}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW: Gantt Chart Mode */}
      {viewMode === 'gantt' && (
        <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4 overflow-x-auto">
          <div className="min-w-[600px] space-y-3">
            {/* Header timeline months */}
            <div className="grid grid-cols-12 gap-1 text-[11px] font-mono text-zinc-500 pb-2 border-b border-zinc-800">
              <div className="col-span-4 text-zinc-400 font-sans font-medium">Phase / Deliverable</div>
              <div className="col-span-2 text-center">October</div>
              <div className="col-span-3 text-center">November</div>
              <div className="col-span-3 text-center">December</div>
            </div>

            {/* Gantt phase rows */}
            {roadmap.phases.map((phase) => (
              <div key={phase.id} className="grid grid-cols-12 gap-1 items-center py-2 text-xs">
                <div className="col-span-4 pr-3 truncate">
                  <span className="font-medium text-white truncate">{phase.name}</span>
                  <div className="text-[10px] text-zinc-500">
                    {phase.deliverablesCount} items · {phase.status}
                  </div>
                </div>

                <div className="col-span-8 bg-zinc-950/80 p-1.5 rounded-xl border border-zinc-800/80 relative h-9 flex items-center">
                  <motion.div
                    initial={shouldReduceMotion ? { width: `${phase.progressPct}%` } : { width: '0%' }}
                    animate={{ width: `${Math.min(100, Math.max(15, phase.progressPct))}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className={`h-6 rounded-lg flex items-center justify-between px-2.5 text-[10px] font-bold text-white shadow-sm ${
                      phase.status === 'COMPLETED'
                        ? 'bg-emerald-600'
                        : phase.status === 'IN_PROGRESS'
                        ? 'bg-blue-600'
                        : 'bg-zinc-800'
                    }`}
                  >
                    <span className="truncate">{phase.targetDate}</span>
                    <span>{phase.progressPct}%</span>
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW: List Mode */}
      {viewMode === 'list' && (
        <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
          <div className="divide-y divide-zinc-800/80">
            {roadmap.milestones.map((ms) => (
              <div
                key={ms.id}
                className="py-3 flex items-center justify-between gap-4 text-xs hover:bg-zinc-800/30 px-3 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      ms.status === 'DONE'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : ms.status === 'IN_PROGRESS'
                        ? 'bg-blue-500/15 text-blue-400'
                        : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    <CheckCircle2 size={15} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{ms.title}</span>
                      {ms.isCritical && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                          Critical Path
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      Owner: {ms.ownerName} • Target: {ms.targetDate}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-24 hidden sm:block">
                    <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          ms.status === 'DONE' ? 'bg-emerald-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${ms.completionPct}%` }}
                      />
                    </div>
                  </div>
                  <span className="font-mono text-zinc-300 font-bold">{ms.completionPct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

