import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  Loader2,
  Search,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { gitService } from '../../services/git.service';
import { useAccentTheme } from '../../services/accentTheme.service';
import { AnimatedSelect } from '../settings/AnimatedSelect';
import { formatDistanceToNow } from '../../lib/dateUtils';
import type { DevGitCommitLink } from '../../types/development';
import type { GitCommitSummary, GitRepositoryConnectionItem } from '../../types/git';

interface CommitCompletionModalProps {
  isOpen: boolean;
  projectId: number;
  taskKey?: string;
  taskTitle: string;
  targetStatus: string;
  mode?: 'complete' | 'link_only';
  existingCommit?: DevGitCommitLink | null;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: (commit: DevGitCommitLink | null) => void;
}

export const CommitCompletionModal: React.FC<CommitCompletionModalProps> = ({
  isOpen,
  projectId,
  taskKey,
  taskTitle,
  targetStatus,
  mode = 'complete',
  existingCommit,
  isSubmitting = false,
  onCancel,
  onConfirm,
}) => {
  const { accentColor } = useAccentTheme();
  const [repos, setRepos] = useState<GitRepositoryConnectionItem[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [branches, setBranches] = useState<Array<{ name: string; isDefault: boolean }>>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [commits, setCommits] = useState<GitCommitSummary[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingCommits, setLoadingCommits] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedCommit, setSelectedCommit] = useState<DevGitCommitLink | null>(null);
  const [manualSha, setManualSha] = useState('');
  const [manualMessage, setManualMessage] = useState('');
  const [manualMode, setManualMode] = useState(false);

  // Load connected repositories whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setSelectedCommit(existingCommit || null);
    setManualSha(existingCommit?.sha || '');
    setManualMessage(existingCommit?.message || '');
    setManualMode(false);
    setSearchQuery('');
    setRepoError(null);
    setLoadingRepos(true);

    gitService.getRepositories(projectId).then((res) => {
      if (!active) return;
      setLoadingRepos(false);
      if (res.success && res.data && res.data.length > 0) {
        setRepos(res.data);
        const first = res.data[0];
        setSelectedRepoId(String(first.id));
        setSelectedBranch(first.defaultBranch || '');
      } else {
        setRepos([]);
        setSelectedRepoId('');
        setCommits([]);
        if (!res.success && res.error) setRepoError(res.error);
      }
    });

    return () => {
      active = false;
    };
  }, [isOpen, projectId, existingCommit]);

  // Load branches when selected repository changes
  useEffect(() => {
    if (!isOpen || !selectedRepoId) {
      setBranches([]);
      return;
    }
    const repoIdNum = Number(selectedRepoId);
    if (!repoIdNum) return;
    let active = true;

    gitService.getBranches(projectId, repoIdNum).then((res) => {
      if (!active) return;
      if (res.success && res.data) {
        setBranches(res.data);
        const def = res.data.find((b) => b.isDefault);
        if (def && !selectedBranch) setSelectedBranch(def.name);
      }
    });

    return () => {
      active = false;
    };
  }, [isOpen, projectId, selectedRepoId]);

  // Load commits when repository or branch changes
  useEffect(() => {
    if (!isOpen || !selectedRepoId) return;
    const repoIdNum = Number(selectedRepoId);
    if (!repoIdNum) return;
    let active = true;
    setLoadingCommits(true);
    setRepoError(null);

    gitService.getCommits(projectId, repoIdNum, selectedBranch || undefined).then((res) => {
      if (!active) return;
      setLoadingCommits(false);
      if (res.success && res.data) {
        setCommits(res.data);
      } else {
        setCommits([]);
        if (res.error) setRepoError(res.error);
      }
    });

    return () => {
      active = false;
    };
  }, [isOpen, projectId, selectedRepoId, selectedBranch]);

  const currentRepo = useMemo(
    () => repos.find((r) => String(r.id) === selectedRepoId) || null,
    [repos, selectedRepoId]
  );

  const filteredCommits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return commits;
    return commits.filter(
      (c) =>
        c.sha.toLowerCase().includes(q) ||
        c.message.toLowerCase().includes(q) ||
        (c.authorName || '').toLowerCase().includes(q) ||
        (c.authorUsername || '').toLowerCase().includes(q)
    );
  }, [commits, searchQuery]);

  if (!isOpen) return null;

  const trimmedManualSha = manualSha.trim();
  const effectiveCommit: DevGitCommitLink | null = manualMode
    ? trimmedManualSha.length >= 4
      ? {
          sha: trimmedManualSha,
          shortSha: trimmedManualSha.slice(0, 7),
          message: manualMessage.trim() || null,
          repoName: currentRepo?.fullName || null,
        }
      : null
    : selectedCommit;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
        <div className="absolute inset-0" onClick={() => !isSubmitting && onCancel()} />

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2 }}
          className="relative z-10 w-full max-w-2xl rounded-2xl bg-[#111319] border border-[#27272A] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-[#27272A] bg-[#151721] flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-emerald-400">
                <GitCommitHorizontal size={13} />
                <span>
                  {mode === 'complete'
                    ? `Completing Development Task · ${targetStatus}`
                    : 'Link Project Git Commit'}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-white mt-1 truncate">
                {taskKey ? `${taskKey} · ` : ''}
                {taskTitle}
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Optionally link the Git commit from this project that delivers this task, or skip cleanly.
              </p>
            </div>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onCancel}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-[#1E202B] disabled:opacity-50"
            >
              <X size={17} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Mode Switcher */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#0B0C10] border border-[#27272A]">
                <button
                  type="button"
                  onClick={() => setManualMode(false)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    !manualMode
                      ? 'bg-[#1D202A] text-white border border-[#2E313D]'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Project Commits
                </button>
                <button
                  type="button"
                  onClick={() => setManualMode(true)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    manualMode
                      ? 'bg-[#1D202A] text-white border border-[#2E313D]'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Enter Commit SHA
                </button>
              </div>

              {selectedCommit && !manualMode && (
                <button
                  type="button"
                  onClick={() => setSelectedCommit(null)}
                  className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200"
                >
                  Clear selection
                </button>
              )}
            </div>

            {manualMode ? (
              <div className="space-y-3 rounded-xl bg-[#0D0E14] border border-[#27272A] p-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">
                    Commit SHA <span className="text-zinc-500">(optional, min 4 chars)</span>
                  </label>
                  <input
                    type="text"
                    value={manualSha}
                    onChange={(e) => setManualSha(e.target.value)}
                    placeholder="e.g. a1b2c3d or full 40-char commit hash"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#11131B] border border-[#27272A] text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">
                    Commit Summary <span className="text-zinc-500">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={manualMessage}
                    onChange={(e) => setManualMessage(e.target.value)}
                    placeholder="e.g. feat: implement OAuth token refresh flow"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#11131B] border border-[#27272A] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>
            ) : (
              <>
                {loadingRepos ? (
                  <div className="py-10 flex items-center justify-center gap-2 text-xs text-zinc-400">
                    <Loader2 size={15} className="animate-spin" />
                    <span>Loading connected Git repositories...</span>
                  </div>
                ) : repos.length === 0 ? (
                  <div className="rounded-xl bg-[#0D0E14] border border-dashed border-[#27272A] p-6 text-center space-y-2">
                    <GitCommitHorizontal size={22} className="mx-auto text-zinc-500" />
                    <p className="text-xs font-medium text-zinc-300">
                      No connected Git repositories found for this project.
                    </p>
                    <p className="text-[11px] text-zinc-500 max-w-md mx-auto">
                      Connect a repository in the Git module, switch to &quot;Enter Commit SHA&quot; above, or click Skip to complete without a commit.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Repo & Branch Controls + Commit Search */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <div className="sm:col-span-5">
                        <AnimatedSelect
                          value={selectedRepoId}
                          onChange={(val) => {
                            const nextRepo = repos.find((r) => String(r.id) === val);
                            setSelectedRepoId(val);
                            setSelectedBranch(nextRepo?.defaultBranch || '');
                          }}
                          options={repos.map((r) => ({
                            value: String(r.id),
                            label: r.fullName || r.name,
                            sublabel: r.defaultBranch ? `default: ${r.defaultBranch}` : undefined,
                          }))}
                          placeholder="Choose repository..."
                          accentColor={accentColor}
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <AnimatedSelect
                          value={selectedBranch}
                          onChange={setSelectedBranch}
                          options={(branches.length > 0
                            ? branches
                            : currentRepo?.defaultBranch
                            ? [{ name: currentRepo.defaultBranch, isDefault: true }]
                            : []
                          ).map((b) => ({
                            value: b.name,
                            label: b.name,
                            icon: <GitBranch size={11} className="text-zinc-400" />,
                          }))}
                          placeholder="Branch..."
                          accentColor={accentColor}
                        />
                      </div>
                      <div className="sm:col-span-4 relative">
                        <Search
                          size={13}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                        />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search SHA or message..."
                          className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#0D0F14] border border-[#27272A] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                        />
                      </div>
                    </div>

                    {repoError && (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
                        {repoError}
                      </div>
                    )}

                    {/* Commit List */}
                    <div className="rounded-xl border border-[#232634] bg-[#0B0C11] max-h-64 overflow-y-auto divide-y divide-[#1D202C]">
                      {loadingCommits ? (
                        <div className="py-10 flex items-center justify-center gap-2 text-xs text-zinc-400">
                          <Loader2 size={14} className="animate-spin" />
                          <span>Fetching commits...</span>
                        </div>
                      ) : filteredCommits.length === 0 ? (
                        <div className="py-8 text-center text-xs text-zinc-500">
                          No commits match your filter on this branch.
                        </div>
                      ) : (
                        filteredCommits.map((c) => {
                          const isSelected = selectedCommit?.sha === c.sha;
                          const headline = (c.message || '').split('\n')[0] || '(no commit message)';
                          return (
                            <button
                              key={c.sha}
                              type="button"
                              onClick={() =>
                                setSelectedCommit(
                                  isSelected
                                    ? null
                                    : {
                                        sha: c.sha,
                                        shortSha: c.shortSha || c.sha.slice(0, 7),
                                        message: headline,
                                        url: c.webUrl || null,
                                        repoName: currentRepo?.fullName || currentRepo?.name || null,
                                        author: c.authorName || c.authorUsername || null,
                                        committedAt: c.committedDate || null,
                                      }
                                )
                              }
                              className={`w-full text-left px-3.5 py-2.5 flex items-start justify-between gap-3 transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-500/10'
                                  : 'hover:bg-[#141722]'
                              }`}
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold border ${
                                      isSelected
                                        ? 'bg-emerald-500/20 border-emerald-500/45 text-emerald-300'
                                        : 'bg-[#161923] border-[#272B3A] text-zinc-300'
                                    }`}
                                  >
                                    {c.shortSha || c.sha.slice(0, 7)}
                                  </span>
                                  <span className="text-xs font-medium text-white truncate">
                                    {headline}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono">
                                  <span className="inline-flex items-center gap-1">
                                    <User size={10} />
                                    {c.authorName || c.authorUsername || 'Unknown'}
                                  </span>
                                  {c.committedDate && (
                                    <span>{formatDistanceToNow(c.committedDate)}</span>
                                  )}
                                  {c.webUrl && (
                                    <a
                                      href={c.webUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-0.5 text-zinc-400 hover:text-white"
                                    >
                                      <span>View</span>
                                      <ExternalLink size={9} />
                                    </a>
                                  )}
                                </div>
                              </div>

                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${
                                  isSelected
                                    ? 'bg-emerald-500 border-emerald-400 text-[#0A0B10]'
                                    : 'border-[#2D3142] bg-transparent'
                                }`}
                              >
                                {isSelected && <Check size={11} strokeWidth={3} />}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Selected commit preview */}
            {effectiveCommit && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles size={13} className="text-emerald-400 shrink-0" />
                  <span className="font-mono font-semibold text-emerald-300 shrink-0">
                    {effectiveCommit.shortSha || effectiveCommit.sha.slice(0, 7)}
                  </span>
                  <span className="text-zinc-200 truncate">
                    {effectiveCommit.message || 'Ready to link'}
                  </span>
                </div>
                {effectiveCommit.repoName && (
                  <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                    {effectiveCommit.repoName}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3.5 border-t border-[#27272A] bg-[#151721] flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onCancel}
              className="px-3.5 py-2 rounded-xl border border-[#27272A] bg-[#181B24] hover:bg-[#1E222E] text-xs font-medium text-zinc-300 disabled:opacity-50"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              {mode === 'complete' && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => onConfirm(null)}
                  className="px-4 py-2 rounded-xl border border-[#27272A] bg-[#181B24] hover:bg-[#222634] text-xs font-medium text-zinc-200 disabled:opacity-50 cursor-pointer"
                >
                  Skip Commit & Complete
                </button>
              )}
              <button
                type="button"
                disabled={isSubmitting || !effectiveCommit}
                onClick={() => effectiveCommit && onConfirm(effectiveCommit)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#0A0B10] disabled:opacity-45 cursor-pointer"
                style={{ backgroundColor: accentColor }}
              >
                {isSubmitting ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <GitCommitHorizontal size={13} />
                )}
                <span>
                  {mode === 'complete' ? 'Link Commit & Complete' : 'Link Commit'}
                </span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

