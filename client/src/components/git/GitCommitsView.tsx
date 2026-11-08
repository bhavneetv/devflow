import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  GitCommit,
  GitBranch,
  Search,
  LayoutGrid,
  List,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  X,
  Users,
  Calendar,
  Clock,
  ArrowRight,
  FileCode,
  Link2,
  FolderGit2,
} from 'lucide-react';
import { gitService } from '../../services/git.service';
import { GitRecordLinker } from './GitRecordLinker';
import { useToast } from '../../context/ToastContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import { cn } from '../../lib/utils';
import type {
  GitRepositoryConnectionItem,
  GitBranchSummary,
  GitCommitSummary,
  GitCommitDetail,
} from '../../types/git';

export interface GitCommitsViewProps {
  projectId: number;
  initialRepoId?: number;
}

export const GitCommitsView: React.FC<GitCommitsViewProps> = ({
  projectId,
  initialRepoId,
}) => {
  const { toast } = useToast();
  const { accentColor } = useAccentTheme();

  const [repositories, setRepositories] = useState<GitRepositoryConnectionItem[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(initialRepoId || null);
  const [branches, setBranches] = useState<GitBranchSummary[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [commits, setCommits] = useState<GitCommitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCommits, setLoadingCommits] = useState(false);

  // View mode: Grid vs List (matching TeamView)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Focused commit SHA for right inspector panel
  const [focusedSha, setFocusedSha] = useState<string | null>(null);
  const [focusedDetail, setFocusedDetail] = useState<GitCommitDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Search filter
  const [search, setSearch] = useState('');
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  // Link record modal
  const [linkingCommit, setLinkingCommit] = useState<GitCommitSummary | null>(null);

  // 1. Fetch repositories
  useEffect(() => {
    let isMounted = true;
    const fetchRepos = async () => {
      try {
        setLoading(true);
        const res = await gitService.getRepositories(projectId);
        if (isMounted && res.success && res.data && res.data.length > 0) {
          setRepositories(res.data);
          if (!selectedRepoId) {
            setSelectedRepoId(res.data[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchRepos();
    return () => {
      isMounted = false;
    };
  }, [projectId]);

  // 2. Fetch branches for selected repo
  useEffect(() => {
    if (!selectedRepoId) return;

    let isMounted = true;
    const fetchBranches = async () => {
      try {
        const res = await gitService.getBranches(projectId, selectedRepoId);
        if (isMounted && res.success && res.data) {
          setBranches(res.data);
          const defaultB = res.data.find((b) => b.isDefault)?.name || res.data[0]?.name || 'main';
          setSelectedBranch(defaultB);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchBranches();
    return () => {
      isMounted = false;
    };
  }, [projectId, selectedRepoId]);

  // 3. Fetch commits for selected repo and branch
  useEffect(() => {
    if (!selectedRepoId) return;

    let isMounted = true;
    const fetchCommits = async () => {
      try {
        setLoadingCommits(true);
        const res = await gitService.getCommits(projectId, selectedRepoId, selectedBranch || undefined);
        if (isMounted && res.success && res.data) {
          setCommits(res.data);
          if (res.data.length > 0) {
            setFocusedSha(res.data[0].sha);
          } else {
            setFocusedSha(null);
            setFocusedDetail(null);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoadingCommits(false);
      }
    };
    fetchCommits();
    return () => {
      isMounted = false;
    };
  }, [projectId, selectedRepoId, selectedBranch]);

  // 4. Fetch detailed commit when focusedSha changes
  useEffect(() => {
    if (!selectedRepoId || !focusedSha) {
      setFocusedDetail(null);
      return;
    }

    let isMounted = true;
    const fetchCommitDetail = async () => {
      try {
        setLoadingDetail(true);
        const res = await gitService.getCommit(projectId, selectedRepoId, focusedSha);
        if (isMounted && res.success && res.data) {
          setFocusedDetail(res.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoadingDetail(false);
      }
    };
    fetchCommitDetail();
    return () => {
      isMounted = false;
    };
  }, [projectId, selectedRepoId, focusedSha]);

  // Filtered commits based on search
  const filteredCommits = useMemo(() => {
    if (!search.trim()) return commits;
    const q = search.toLowerCase();
    return commits.filter(
      (c) =>
        c.message.toLowerCase().includes(q) ||
        c.sha.toLowerCase().includes(q) ||
        (c.authorName || '').toLowerCase().includes(q)
    );
  }, [commits, search]);

  // Compute stat metrics
  const stats = useMemo(() => {
    const total = commits.length;
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const today = commits.filter((c) => new Date(c.committedDate).getTime() > oneDayAgo).length;
    const authorsSet = new Set(commits.map((c) => c.authorName || 'Unknown'));
    return {
      total,
      today,
      authors: authorsSet.size,
      branchesCount: branches.length,
    };
  }, [commits, branches]);

  const copySha = async (sha: string) => {
    await navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 2000);
    toast.success('Copied SHA', `${sha.slice(0, 7)} copied to clipboard`);
  };

  const selectedRepo = useMemo(() => {
    return repositories.find((r) => r.id === selectedRepoId) || repositories[0];
  }, [repositories, selectedRepoId]);

  return (
    <div className="space-y-6">
      {/* ─── Top Stat Cards Row ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-[#27272A] bg-[#0E0F14] shadow-sm text-left">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-medium truncate">Total Commits</span>
            <GitCommit size={14} className="text-cyan-400 shrink-0" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white tracking-tight">{stats.total}</div>
          <span className="text-[10px] text-cyan-400/90 font-mono">in current branch</span>
        </div>

        <div className="p-3.5 rounded-xl border border-[#27272A] bg-[#0E0F14] shadow-sm text-left">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-medium truncate">Today's Commits</span>
            <Clock size={14} className="text-emerald-400 shrink-0" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white tracking-tight">{stats.today}</div>
          <span className="text-[10px] text-emerald-400/90 font-mono">last 24 hours</span>
        </div>

        <div className="p-3.5 rounded-xl border border-[#27272A] bg-[#0E0F14] shadow-sm text-left">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-medium truncate">Active Authors</span>
            <Users size={14} className="text-indigo-400 shrink-0" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white tracking-tight">{stats.authors}</div>
          <span className="text-[10px] text-indigo-400/90 font-mono">contributors</span>
        </div>

        <div className="p-3.5 rounded-xl border border-[#27272A] bg-[#0E0F14] shadow-sm text-left">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-medium truncate">Branches</span>
            <GitBranch size={14} className="text-amber-400 shrink-0" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white tracking-tight">{stats.branchesCount}</div>
          <span className="text-[10px] text-amber-400/90 font-mono">active branches</span>
        </div>
      </div>

      {/* ─── 2-Column Directory Layout matching TeamView ─── */}
      <div className="flex flex-col lg:flex-row items-start gap-6 w-full">
        {/* Left Column: Search & Controls + Cards/List Directory */}
        <div className="flex-1 w-full lg:min-w-0 space-y-4">
          {/* Controls Bar: Branch Selector + Search Input + Repo Picker + View Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Left controls: Branch Switcher & Search Bar */}
            <div className="flex items-center gap-2 flex-1 max-w-lg">
              {/* Branch Selector Dropdown */}
              <div className="relative shrink-0">
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="h-10 pl-8 pr-7 rounded-xl bg-[#111216] border border-[#27272A] text-xs font-mono text-indigo-300 focus:outline-none focus:border-zinc-500 cursor-pointer"
                >
                  {branches.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name} {b.isDefault ? '(default)' : ''}
                    </option>
                  ))}
                </select>
                <GitBranch size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              </div>

              {/* Search Bar */}
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter commits by message, SHA, author..."
                  className="w-full h-10 pl-9 pr-8 rounded-xl bg-[#111216] border border-[#27272A] text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/30 transition-colors"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-1 cursor-pointer"
                    title="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Right Controls: Repo picker & View Switcher */}
            <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
              {repositories.length > 1 && (
                <select
                  value={selectedRepoId || ''}
                  onChange={(e) => setSelectedRepoId(Number(e.target.value))}
                  className="h-10 px-2.5 rounded-xl bg-[#111216] border border-[#27272A] text-xs text-zinc-300 font-mono focus:outline-none"
                >
                  {repositories.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}

              <span className="text-xs font-mono text-zinc-500">
                {filteredCommits.length} {filteredCommits.length === 1 ? 'commit' : 'commits'}
              </span>

              {/* View Switcher: Card / List */}
              <div className="p-1 rounded-xl bg-[#111216] border border-[#27272A] flex items-center gap-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'p-1.5 rounded-lg transition-all cursor-pointer',
                    viewMode === 'grid'
                      ? 'text-black shadow-sm font-bold'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                  )}
                  style={viewMode === 'grid' ? { backgroundColor: accentColor } : {}}
                  title="Grid / Card view"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'p-1.5 rounded-lg transition-all cursor-pointer',
                    viewMode === 'list'
                      ? 'text-black shadow-sm font-bold'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                  )}
                  style={viewMode === 'list' ? { backgroundColor: accentColor } : {}}
                  title="List view"
                >
                  <List size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Commits Content: Grid or List */}
          {loading || loadingCommits ? (
            <div className="p-16 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
              <Loader2 size={20} className="animate-spin text-zinc-400" />
              <span>Loading commits...</span>
            </div>
          ) : filteredCommits.length === 0 ? (
            <div className="p-16 rounded-2xl border border-dashed border-[#27272A] bg-[#0E0F14] text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center mx-auto">
                <GitCommit size={22} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">No Commits Found</h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                  {search ? `No commits matching "${search}".` : 'No commits in this branch yet.'}
                </p>
              </div>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="text-xs text-cyan-400 hover:underline cursor-pointer"
                >
                  Clear search filter
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* ─── GRID / CARD VIEW (with ambient hover glow matching TeamView) ─── */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCommits.map((c) => {
                const isFocused = focusedSha === c.sha;
                const shortSha = c.sha.slice(0, 7);
                const firstLine = c.message.split('\n')[0];
                const restOfMsg = c.message.split('\n').slice(1).join('\n').trim();

                return (
                  <motion.div
                    key={c.sha}
                    whileHover={{ y: -2, transition: { duration: 0.15 } }}
                    onMouseEnter={() => setFocusedSha(c.sha)}
                    onClick={() => setFocusedSha(c.sha)}
                    className={cn(
                      'rounded-2xl bg-[#0E0F14]/90 border p-4.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between shadow-sm relative overflow-hidden text-left',
                      isFocused
                        ? 'border-zinc-500 bg-[#12131A] ring-1 ring-white/10'
                        : 'border-[#27272A] hover:border-zinc-600 hover:bg-[#12131A]'
                    )}
                  >
                    {/* Ambient Glow */}
                    <div
                      className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl pointer-events-none opacity-0 group-hover:opacity-15 transition-opacity duration-300"
                      style={{ backgroundColor: accentColor || '#06B6D4' }}
                    />

                    <div className="space-y-3 relative z-10">
                      {/* Top Row: Short SHA badge + Copy button + Branch tag */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              copySha(c.sha);
                            }}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-cyan-300 border border-zinc-700 text-xs font-mono font-semibold transition-colors cursor-pointer"
                            title="Click to copy full SHA"
                          >
                            <GitCommit size={12} className="text-cyan-400" />
                            <span>{shortSha}</span>
                            {copiedSha === c.sha ? (
                              <Check size={11} className="text-emerald-400" />
                            ) : (
                              <Copy size={11} className="text-zinc-500 group-hover:text-zinc-300" />
                            )}
                          </button>
                        </div>

                        {c.webUrl && (
                          <a
                            href={c.webUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.08] transition-colors"
                            title="Open on Git Provider"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>

                      {/* Commit Message Headline */}
                      <h4 className="text-[13px] font-semibold text-white group-hover:text-cyan-200 transition-colors line-clamp-2 leading-snug">
                        {firstLine}
                      </h4>

                      {/* Body preview if present */}
                      {restOfMsg && (
                        <p className="text-xs text-zinc-500 line-clamp-2 font-mono">
                          {restOfMsg}
                        </p>
                      )}
                    </div>

                    {/* Bottom Row: Author + Relative timestamp */}
                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#27272A]/80 text-[11px] text-zinc-500 relative z-10">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                          {c.authorAvatarUrl ? (
                            <img src={c.authorAvatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            (c.authorName || 'U').slice(0, 1).toUpperCase()
                          )}
                        </div>
                        <span className="text-zinc-400 truncate">{c.authorName}</span>
                      </div>
                      <span className="shrink-0">{new Date(c.committedDate).toLocaleDateString()}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            /* ─── LIST VIEW ─── */
            <div className="divide-y divide-[#27272A]/80 rounded-2xl border border-[#27272A] bg-[#0E0F14] overflow-hidden shadow-sm">
              {filteredCommits.map((c) => {
                const isFocused = focusedSha === c.sha;
                const shortSha = c.sha.slice(0, 7);
                const firstLine = c.message.split('\n')[0];

                return (
                  <div
                    key={c.sha}
                    onMouseEnter={() => setFocusedSha(c.sha)}
                    onClick={() => setFocusedSha(c.sha)}
                    className={cn(
                      'p-3 px-4 flex items-center justify-between gap-3 transition-colors cursor-pointer group text-left',
                      isFocused ? 'bg-[#151620]' : 'hover:bg-[#12131A]'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copySha(c.sha);
                        }}
                        className="px-2 py-0.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-cyan-300 border border-zinc-700 text-xs font-mono font-semibold transition-colors cursor-pointer shrink-0"
                        title="Copy SHA"
                      >
                        {shortSha}
                      </button>

                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white group-hover:text-cyan-200 transition-colors truncate">
                          {firstLine}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                          <span>{c.authorName}</span>
                          <span>•</span>
                          <span>{new Date(c.committedDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {c.webUrl && (
                        <a
                          href={c.webUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.08] transition-colors"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                      <ArrowRight size={14} className="text-zinc-600 group-hover:text-white transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Right Column: Sticky Commit Inspector Panel (matching TeamView) ─── */}
        <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 lg:sticky lg:top-6">
          <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-4 text-left">
            {/* Box Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-[#27272A]/80">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: accentColor || '#06B6D4' }}
                />
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-white truncate tracking-tight">Commit Inspector</h3>
                  <p className="text-[10px] text-zinc-500 font-mono truncate">
                    {focusedSha ? `${focusedSha.slice(0, 7)} · ${selectedRepo?.name}` : 'Commit breakdown'}
                  </p>
                </div>
              </div>

              {focusedDetail?.webUrl && (
                <a
                  href={focusedDetail.webUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                  title="Open in Git Provider"
                >
                  <ExternalLink size={13} />
                </a>
              )}
            </div>

            {loadingDetail ? (
              <div className="p-8 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin text-zinc-400" />
                <span>Fetching commit details...</span>
              </div>
            ) : focusedDetail ? (
              <div className="space-y-4">
                {/* Full Commit Message */}
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block font-sans">
                    Commit Message
                  </span>
                  <div className="p-3 rounded-xl bg-[#111216] border border-[#27272A] text-xs text-zinc-200 font-mono leading-relaxed whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                    {focusedDetail.message}
                  </div>
                </div>

                {/* Author Info */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-[11px] text-zinc-500">Author:</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] text-white">
                        {focusedDetail.authorAvatarUrl ? (
                          <img src={focusedDetail.authorAvatarUrl} alt="" className="w-full h-full rounded-full" />
                        ) : (
                          focusedDetail.authorName.slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <span className="text-white font-medium">{focusedDetail.authorName}</span>
                    </div>
                  </div>

                  {focusedDetail.authorEmail && (
                    <div className="flex items-center justify-between text-zinc-400">
                      <span className="text-[11px] text-zinc-500">Email:</span>
                      <span className="text-zinc-300 font-mono text-[11px] truncate max-w-[180px]">
                        {focusedDetail.authorEmail}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-[11px] text-zinc-500">Committed:</span>
                    <span className="text-zinc-300 text-[11px]">
                      {new Date(focusedDetail.committedDate).toLocaleString()}
                    </span>
                  </div>

                  {/* Stats */}
                  {focusedDetail.stats && (
                    <div className="flex items-center justify-between text-zinc-400 pt-1">
                      <span className="text-[11px] text-zinc-500">Changes:</span>
                      <span className="font-mono text-xs">
                        <span className="text-emerald-400">+{focusedDetail.stats.additions}</span>{' '}
                        <span className="text-rose-400">-{focusedDetail.stats.deletions}</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Changed Files List */}
                {focusedDetail.files && focusedDetail.files.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 uppercase font-bold tracking-wider font-mono">
                      <span>Changed Files</span>
                      <span>({focusedDetail.files.length})</span>
                    </div>

                    <div className="space-y-1 max-h-44 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
                      {focusedDetail.files.map((file, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-lg bg-[#111216] border border-[#27272A]/70 flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="font-mono text-[11px] text-zinc-300 truncate" title={file.filename}>
                            {file.filename}
                          </span>
                          <span
                            className={cn(
                              'px-1.5 py-0.2 rounded text-[9px] font-mono uppercase font-semibold shrink-0',
                              file.status === 'added'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : file.status === 'removed'
                                ? 'bg-rose-500/10 text-rose-400'
                                : 'bg-blue-500/10 text-blue-400'
                            )}
                          >
                            {file.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2 pt-2 border-t border-[#27272A]/80">
                  <button
                    type="button"
                    onClick={() => copySha(focusedDetail.sha)}
                    className="w-full h-8 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-zinc-700/60"
                  >
                    {copiedSha === focusedDetail.sha ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copiedSha === focusedDetail.sha ? 'SHA Copied' : 'Copy Full SHA'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const cur = commits.find((c) => c.sha === focusedDetail.sha);
                      if (cur) setLinkingCommit(cur);
                    }}
                    className="w-full h-9 rounded-xl text-black font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer hover:brightness-110 active:scale-[0.98]"
                    style={{ backgroundColor: accentColor }}
                  >
                    <Link2 size={13} />
                    <span>Link Commit to Task / Requirement</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-zinc-500">
                Select a commit from the list to inspect details, files changed, and author history.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── MODAL: Link Record ─── */}
      {linkingCommit && selectedRepo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#27272A] bg-[#121319] p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-white">Link Commit to DevFlow Record</h3>
              <button
                type="button"
                onClick={() => setLinkingCommit(null)}
                className="text-zinc-500 hover:text-white cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
            <GitRecordLinker
              projectId={projectId}
              repositoryId={selectedRepo.id}
              provider={selectedRepo.providerConnection?.provider || 'github'}
              recordType="commit"
              recordId={linkingCommit.sha}
              recordTitle={linkingCommit.message.split('\n')[0]}
              recordUrl={linkingCommit.webUrl}
              onLinksChanged={() => {
                setLinkingCommit(null);
                toast.success('Commit linked to DevFlow record');
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

