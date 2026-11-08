import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { GitFork, AlertTriangle, ArrowRight, CheckCircle2, FileText, Bug, ExternalLink } from 'lucide-react';

interface TraceabilityProps {
  traceability: {
    totalRequirements: number;
    linkedRequirements: number;
    coveragePct: number;
    unlinkedCount: number;
    unverifiedCriteriaCount: number;
    chainNodes: Array<{ name: string; count: number; status: 'COMPLETE' | 'IN_PROGRESS' | 'GAP' }>;
    warnings: Array<{ id: string; reqCode: string; message: string; severity: 'HIGH' | 'MEDIUM'; link: string }>;
  };
  projectId: number;
}

export const RequirementTraceabilityView: React.FC<TraceabilityProps> = ({ traceability, projectId }) => {
  const shouldReduceMotion = useReducedMotion();

  const getNodeColor = (status: 'COMPLETE' | 'IN_PROGRESS' | 'GAP') => {
    switch (status) {
      case 'COMPLETE':
        return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400';
      case 'GAP':
        return 'border-red-500/40 bg-red-500/10 text-red-400';
      case 'IN_PROGRESS':
      default:
        return 'border-blue-500/40 bg-blue-500/10 text-blue-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Coverage Metrics Bar (Inspired by TraceAI Studio Image 1) */}
      <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1">
          <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Total Specifications</div>
          <div className="text-2xl font-bold text-white">{traceability.totalRequirements}</div>
          <p className="text-[11px] text-purple-400">PRDs & Functional specs</p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1">
          <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Traceability Coverage</div>
          <div className="text-2xl font-bold text-emerald-400">{traceability.coveragePct}%</div>
          <p className="text-[11px] text-zinc-400">{traceability.linkedRequirements} linked to active tasks</p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1">
          <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Untraced Specifications</div>
          <div className="text-2xl font-bold text-amber-400">{traceability.unlinkedCount}</div>
          <p className="text-[11px] text-zinc-400">Missing direct task links</p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1">
          <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Unverified Acceptance Criteria</div>
          <div className="text-2xl font-bold text-blue-400">{traceability.unverifiedCriteriaCount}</div>
          <p className="text-[11px] text-zinc-400">Pending automated verification</p>
        </div>
      </div>

      {/* End-to-End Relationship Chain (Req -> Task -> Sprint -> Branch -> Commit -> PR -> Test -> Defect -> Release) */}
      <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wide flex items-center gap-2">
              <GitFork size={15} className="text-blue-400" />
              <span>Full Lifecycle Traceability Chain</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Live link traversal from requirement conception through production release
            </p>
          </div>
          <Link
            to={`/projects/${projectId}/requirements/traceability`}
            className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            <span>Open Traceability Matrix</span>
            <ExternalLink size={12} />
          </Link>
        </div>

        {/* Chain Flow Visualization */}
        <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-[760px] justify-between py-2">
            {traceability.chainNodes.map((node, i) => (
              <React.Fragment key={node.name}>
                <div
                  className={`px-3 py-2 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${getNodeColor(
                    node.status
                  )}`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider">{node.name}</span>
                  <span className="text-sm font-extrabold mt-0.5">{node.count}</span>
                </div>
                {i < traceability.chainNodes.length - 1 && (
                  <ArrowRight size={13} className="text-zinc-600 shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Actionable Gaps & Warnings */}
      <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-white uppercase tracking-wide">
              Traceability Gaps & Actionable Warnings
            </h3>
          </div>
          <span className="text-xs text-zinc-500 font-mono">
            {traceability.warnings.length} warning{traceability.warnings.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="space-y-2.5">
          {traceability.warnings.map((warn) => (
            <Link
              key={warn.id}
              to={warn.link}
              className="p-3.5 rounded-xl bg-zinc-950/50 border border-zinc-800/80 hover:border-zinc-700 flex items-center justify-between gap-3 text-xs transition-colors group block"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    warn.severity === 'HIGH'
                      ? 'bg-red-500/15 text-red-400 border-red-500/30'
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {warn.severity}
                </span>
                <span className="font-semibold text-zinc-200 group-hover:text-white transition-colors">
                  {warn.message}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-zinc-400 group-hover:text-white transition-colors shrink-0">
                <span className="text-[11px] font-medium hidden sm:inline-block">Resolve</span>
                <ArrowRight size={13} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

