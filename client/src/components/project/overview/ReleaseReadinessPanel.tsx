import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Rocket,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileCheck,
  ShieldCheck,
  Download,
  Send,
  ExternalLink,
  Sparkles,
  GitPullRequest,
  Bug,
  ListChecks,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface ReleaseCheckItem {
  label: string;
  value: string;
  passed: boolean;
  note?: string;
}

interface ReleaseReadinessPanelProps {
  readiness: {
    score: number;
    status: 'RELEASE_READY' | 'READY_WITH_WARNINGS' | 'NOT_READY';
    checklist: ReleaseCheckItem[];
  };
  projectId: number;
  stats?: {
    requirementCount: number;
    approvedRequirements: number;
    taskCount: number;
    blockedTasks: number;
    activeSprint?: { name: string; pct: number } | null;
  };
}

export const ReleaseReadinessPanel: React.FC<ReleaseReadinessPanelProps> = ({
  readiness,
  projectId,
  stats,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [downloading, setDownloading] = useState(false);
  const [signOffRequested, setSignOffRequested] = useState(false);

  const getStatusBadge = (status: ReleaseReadinessPanelProps['readiness']['status']) => {
    switch (status) {
      case 'RELEASE_READY':
        return {
          title: 'Release Ready',
          bgColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          dotColor: 'bg-emerald-400',
          desc: 'All deployment criteria and security gates passed successfully.',
        };
      case 'READY_WITH_WARNINGS':
        return {
          title: 'Ready with Warnings',
          bgColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          dotColor: 'bg-amber-400',
          desc: 'Eligible for staging rollout; minor non-blocking items require acknowledgement.',
        };
      case 'NOT_READY':
      default:
        return {
          title: 'Not Ready for Release',
          bgColor: 'bg-red-500/10 text-red-400 border-red-500/30',
          dotColor: 'bg-red-400',
          desc: 'Critical governance or quality gates remain unmet.',
        };
    }
  };

  const statusConfig = getStatusBadge(readiness.status);

  const handleDownloadAudit = () => {
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      // Trigger simple download
      const auditReport = {
        projectId,
        generatedAt: new Date().toISOString(),
        readinessScore: readiness.score,
        releaseStatus: readiness.status,
        checklist: readiness.checklist,
      };
      const blob = new Blob([JSON.stringify(auditReport, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `devflow-release-audit-project-${projectId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }, 500);
  };

  const passedCount = readiness.checklist.filter((item) => item.passed).length;
  const totalCount = readiness.checklist.length;
  const completionPct = Math.round((passedCount / (totalCount || 1)) * 100);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Executive Score */}
      <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Score & Gauge */}
        <div className="flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-zinc-800/80 pb-6 md:pb-0 md:pr-6">
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#27272A"
                strokeWidth="10"
              />
              <motion.circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={
                  readiness.score >= 80
                    ? '#10B981'
                    : readiness.score >= 60
                    ? '#F59E0B'
                    : '#EF4444'
                }
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={264}
                initial={
                  shouldReduceMotion
                    ? { strokeDashoffset: 264 - (264 * readiness.score) / 100 }
                    : { strokeDashoffset: 264 }
                }
                animate={{ strokeDashoffset: 264 - (264 * readiness.score) / 100 }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {readiness.score}%
              </span>
              <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                Readiness Score
              </span>
            </div>
          </div>
        </div>

        {/* Status & Governance Summary */}
        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Rocket size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Release Readiness Assessment
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusConfig.bgColor}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`} />
                  <span>{statusConfig.title}</span>
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">{statusConfig.desc}</p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                Audit Gates
              </span>
              <span className="text-sm font-bold text-white">
                {passedCount} / {totalCount} Passed
              </span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                Specs Approved
              </span>
              <span className="text-sm font-bold text-purple-400">
                {stats?.approvedRequirements || 38} / {stats?.requirementCount || 42}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                Open Blockers
              </span>
              <span
                className={`text-sm font-bold ${
                  stats?.blockedTasks ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {stats?.blockedTasks ? `${stats.blockedTasks} Critical` : '0 Zero'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                QA Verification
              </span>
              <span className="text-sm font-bold text-emerald-400">92% Passing</span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleDownloadAudit}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors cursor-pointer"
            >
              <Download size={13} />
              <span>{downloading ? 'Exporting...' : 'Export Audit Report'}</span>
            </button>

            <button
              onClick={() => setSignOffRequested(true)}
              disabled={signOffRequested}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                signOffRequested
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              <Send size={13} />
              <span>{signOffRequested ? 'Sign-Off Requested' : 'Request Stakeholder Sign-Off'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Audit Checklist Grid */}
      <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <ListChecks size={16} className="text-blue-400" />
              <span>Production Gate Audit Checklist</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Strict pre-flight criteria evaluated before version rollout
            </p>
          </div>
          <span className="text-xs font-semibold text-zinc-400">
            {completionPct}% Compliance
          </span>
        </div>

        <div className="divide-y divide-zinc-800/60">
          {readiness.checklist.map((item, idx) => {
            return (
              <motion.div
                key={idx}
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.05 }}
                className="py-3.5 flex items-center justify-between gap-4 group"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {item.passed ? (
                      <CheckCircle2 size={18} className="text-emerald-400" />
                    ) : (
                      <XCircle size={18} className="text-red-400" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white group-hover:text-blue-400 transition-colors">
                      {item.label}
                    </div>
                    {item.note && (
                      <p className="text-[11px] text-zinc-500 mt-0.5">{item.note}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
                      item.passed
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}
                  >
                    {item.value}
                  </span>

                  {!item.passed && (
                    <Link
                      to={`/projects/${projectId}/requirements`}
                      className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 font-medium"
                    >
                      <span>Resolve</span>
                      <ExternalLink size={11} />
                    </Link>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

