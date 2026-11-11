import React from 'react';
import { Lock, ExternalLink, ShieldCheck, Sparkles, RefreshCw, GitBranch, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { DocumentDashboardData } from '../../types/document';

interface DocumentStorageNoticeProps {
  storageNotice?: DocumentDashboardData['storageNotice'];
  health?: DocumentDashboardData['metrics']['storageHealth'];
  onRefresh?: () => void;
  onOpenSettings?: () => void;
}

export const DocumentStorageNotice: React.FC<DocumentStorageNoticeProps> = ({
  storageNotice,
  health,
  onRefresh,
  onOpenSettings,
}) => {
  const repoName = storageNotice?.repositoryName || 'devflow-docs-repo';
  const repoOwner = storageNotice?.repositoryOwner || 'connected-account';
  const branch = storageNotice?.branch || 'main';
  const repoUrl = storageNotice?.repoUrl || (repoOwner && repoName ? `https://github.com/${repoOwner}/${repoName}` : undefined);
  const isHealthy = health?.status === 'healthy';
  const isWarning = health?.status === 'warning';
  const isError = health?.status === 'error';

  return (
    <div className="rounded-xl border border-blue-500/20 bg-gradient-to-r from-blue-950/30 via-zinc-900/60 to-purple-950/20 p-4 shadow-sm relative overflow-hidden">
      {/* Background glow decoration */}
      <div className="absolute right-0 top-0 -mt-4 -mr-4 w-48 h-48 rounded-full bg-blue-500/5 blur-2xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-400 shrink-0 mt-0.5">
            <ShieldCheck size={20} />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-white tracking-tight flex items-center gap-1.5">
                <Lock size={13} className="text-emerald-400" />
                Zero-Cost GitHub Storage
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/80">
                <GitBranch size={11} className="text-zinc-400" />
                {repoOwner}/{repoName}
                <span className="text-zinc-500">:</span>
                <span className="text-blue-400">{branch}</span>
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider',
                  isHealthy && 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
                  isWarning && 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
                  isError && 'bg-rose-500/10 text-rose-400 border border-rose-500/30',
                  !isHealthy && !isWarning && !isError && 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                )}
              >
                {isHealthy ? 'Sync Active' : isWarning ? 'Warning' : isError ? 'Repo Error' : 'Private Repo'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-3xl">
              Files are committed directly into your private GitHub repository (<strong className="text-zinc-300">{repoName}</strong>) with 100% data ownership. DevFlow proxies raw content blobs via authenticated backend endpoints, allowing instant document previews and share links without third-party cloud hosting fees.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          {repoUrl && (
            <a
              href={repoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-800/80 hover:bg-zinc-800 hover:text-white border border-zinc-700/60 transition-colors"
            >
              <ExternalLink size={13} />
              <span>GitHub Repo</span>
            </a>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              title="Refresh repository health"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-700/60 transition-colors"
            >
              <RefreshCw size={14} />
            </button>
          )}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 transition-colors"
            >
              <Sparkles size={13} />
              <span>Storage Config</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

