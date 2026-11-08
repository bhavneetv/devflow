import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  GitPullRequest,
  GitMerge,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageSquare,
  Loader2,
  X,
  FileCode,
  Search,
  LayoutGrid,
  List,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  FolderGit2,
  GitBranch,
  Link2,
} from 'lucide-react';
import { gitService } from '../../services/git.service';
import { GitRecordDetailsDrawer } from './GitRecordDetailsDrawer';
import { GitRecordLinker } from './GitRecordLinker';
import { useToast } from '../../context/ToastContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import { cn } from '../../lib/utils';
import type {
  GitNormalizedMR,
  GitRepositoryConnectionItem,
} from '../../types/git';

export interface GitMergeRequestsViewProps {
  projectId: number;
  initialFilter?: {
    state?: string;
    repoId?: number | string;
    hasConflicts?: boolean;
    awaitingReview?: boolean;
    approved?: boolean;
  };
}

export const GitMergeRequestsView: React.FC<GitMergeRequestsViewProps> = ({
  projectId,
  initialFilter,
}) => {
  const { toast } = useToast();
  const { accentColor } = useAccentTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  const [mergeRequests, setMergeRequests] = useState<GitNormalizedMR[]>([]);
  const [repositories, setRepositories] = useState<GitRepositoryConnectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // View mode: Grid vs List (matching TeamView)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Currently focused MR for the sticky right inspector panel
  const [focusedMRId, setFocusedMRId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>(
    initialFilter?.hasConflicts
      ? 'conflicts'
      : initialFilter?.awaitingReview
      ? 'awaiting_review'
      : initialFilter?.approved
      ? 'approved'
      : initialFilter?.state || searchParams.get('state') || 'all'
  );
  const [selectedRepoId, setSelectedRepoId] = useState<string | number>(
    initialFilter?.repoId || 'all'
  );

  // Drawer state synced with URL search params
  const drawerType = searchParams.get('drawerType');
  const drawerRepoId = searchParams.get('drawerRepoId');
  const drawerNum = searchParams.get('drawerNum');
  const isDrawerOpen = drawerType === 'mr' && Boolean(drawerRepoId) && Boolean(drawerNum);

  // Create MR Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createRepoId, setCreateRepoId] = useState<number | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [sourceBranch, setSourceBranch] = useState('');
  const [targetBranch, setTargetBranch] = useState('main');
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [isDraft, setIsDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);

  // Record Linker Modal
  const [linkingMR, setLinkingMR] = useState<GitNormalizedMR | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Load repositories
  useEffect(() => {
    let isMounted = true;
    const fetchRepos = async () => {
      try {
        const res = await gitService.getRepositories(projectId);
        if (isMounted && res.success && res.data) {
          setRepositories(res.data);
          if (res.data.length > 0 && !createRepoId) {
            setCreateRepoId(res.data[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchRepos();
    return () => {
      isMounted = false;
    };
  }, [projectId]);

  // Load branches when target repository is chosen in Create MR modal
  useEffect(() => {
    if (!isCreateOpen || !createRepoId) return;

    let isMounted = true;
    const fetchBranches = async () => {
      setLoadingBranches(true);
      try {
        const res = await gitService.getBranches(projectId, createRepoId);
        if (isMounted && res.success && res.data) {
          setBranches(res.data);
          const defaultB = res.data.find((b) => b.isDefault)?.name || 'main';
          setTargetBranch(defaultB);
          const otherB = res.data.find((b) => !b.isDefault)?.name || res.data[0]?.name || 'feature';
          setSourceBranch(otherB);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoadingBranches(false);
      }
    };
    fetchBranches();
    return () => {
      isMounted = false;
    };
  }, [isCreateOpen, createRepoId, projectId]);

  // Fetch merge requests
  const fetchMRs = async () => {
    try {
      setLoading(true);
      const res = await gitService.getMergeRequests(projectId, {
        state: selectedStatus === 'all' || selectedStatus === 'conflicts' || selectedStatus === 'awaiting_review' || selectedStatus === 'approved' ? 'all' : selectedStatus,
        repoId: selectedRepoId === 'all' ? undefined : selectedRepoId,
        hasConflicts: selectedStatus === 'conflicts' ? true : undefined,
      });

      if (res.success && res.data) {
        setMergeRequests(res.data);
        if (res.data.length > 0 && !focusedMRId) {
          setFocusedMRId(res.data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMRs();
  }, [projectId, selectedStatus, selectedRepoId]);

  // Filtered MRs based on search and status
  const filteredMRs = useMemo(() => {
    let result = mergeRequests;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (mr) =>
          mr.title.toLowerCase().includes(q) ||
          mr.number.toString().includes(q) ||
          mr.sourceBranch.toLowerCase().includes(q) ||
          mr.targetBranch.toLowerCase().includes(q) ||
          (mr.author?.name || '').toLowerCase().includes(q)
      );
    }

    if (selectedStatus === 'open') {
      result = result.filter((m) => m.state === 'open');
    } else if (selectedStatus === 'merged') {
      result = result.filter((m) => m.state === 'merged');
    } else if (selectedStatus === 'closed') {
      result = result.filter((m) => m.state === 'closed');
    } else if (selectedStatus === 'conflicts') {
      result = result.filter((m) => m.hasConflicts);
    } else if (selectedStatus === 'awaiting_review') {
      result = result.filter(
        (m) => m.state === 'open' && !m.reviewers.some((r) => r.status === 'approved')
      );
    } else if (selectedStatus === 'approved') {
      result = result.filter(
        (m) => m.state === 'open' && m.reviewers.some((r) => r.status === 'approved')
      );
    }

    return result;
  }, [mergeRequests, search, selectedStatus]);

  // Compute stats across all loaded MRs
  const stats = useMemo(() => {
    const total = mergeRequests.length;
    const open = mergeRequests.filter((m) => m.state === 'open').length;
    const merged = mergeRequests.filter((m) => m.state === 'merged').length;
    const conflicts = mergeRequests.filter((m) => m.hasConflicts).length;
    const approved = mergeRequests.filter((m) => m.state === 'open' && m.reviewers.some((r) => r.status === 'approved')).length;
    const awaiting = mergeRequests.filter((m) => m.state === 'open' && !m.reviewers.some((r) => r.status === 'approved')).length;
    return { total, open, merged, conflicts, approved, awaiting };
  }, [mergeRequests]);

  // Currently focused MR object
  const focusedMR = useMemo(() => {
    return mergeRequests.find((m) => m.id === focusedMRId) || filteredMRs[0] || mergeRequests[0] || null;
  }, [mergeRequests, focusedMRId, filteredMRs]);

  const handleOpenDrawer = (mr: GitNormalizedMR) => {
    setSearchParams({
      drawerType: 'mr',
      drawerRepoId: (mr.repositoryId || repositories[0]?.id || 1).toString(),
      drawerNum: mr.number.toString(),
    });
  };

  const handleCloseDrawer = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('drawerType');
    next.delete('drawerRepoId');
    next.delete('drawerNum');
    setSearchParams(next);
  };

  const handleCreateMR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createRepoId || !sourceBranch || !targetBranch || !newTitle.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await gitService.createMergeRequest(projectId, createRepoId, {
        title: newTitle.trim(),
        body: newBody,
        sourceBranch,
        targetBranch,
        draft: isDraft,
      });

      if (res.success && res.data) {
        toast.success(`Created Pull Request #${res.data.number}`);
        setIsCreateOpen(false);
        setNewTitle('');
        setNewBody('');
        await fetchMRs();
      } else {
        toast.error(res.error || 'Failed to create pull request');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error creating pull request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyMRLink = async (mr: GitNormalizedMR) => {
    const link = mr.webUrl || `${window.location.origin}/projects/${projectId}/pulls?drawerType=mr&drawerRepoId=${mr.repositoryId}&drawerNum=${mr.number}`;
    await navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast.success('Copied link', 'Pull request link copied to clipboard');
  };

  const statusPills = [
    { id: 'all', label: 'All', count: stats.total },
    { id: 'open', label: 'Open', count: stats.open },
    { id: 'awaiting_review', label: 'Awaiting Review', count: stats.awaiting },
    { id: 'approved', label: 'Approved', count: stats.approved },
    { id: 'merged', label: 'Merged', count: stats.merged },
    { id: 'conflicts', label: 'Conflicts', count: stats.conflicts },
  ];

  return (
    <div className="space-y-6">
      {/* ─── Top Stat Cards Row ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div
          onClick={() => setSelectedStatus('open')}
          className={cn(
            'p-3.5 rounded-xl border bg-[#0E0F14] hover:bg-[#121319] transition-all cursor-pointer group shadow-sm text-left',
            selectedStatus === 'open' ? 'ring-1 ring-emerald-500/50 border-emerald-500/40' : 'border-[#27272A]'
          )}
        >
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-medium truncate">Open PRs</span>
            <GitPullRequest size={14} className="text-emerald-400 shrink-0" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white tracking-tight">{stats.open}</div>
          <span className="text-[10px] text-emerald-400/90 font-mono">active development</span>
        </div>

        <div
          onClick={() => setSelectedStatus('awaiting_review')}
          className={cn(
            'p-3.5 rounded-xl border bg-[#0E0F14] hover:bg-[#121319] transition-all cursor-pointer group shadow-sm text-left',
            selectedStatus === 'awaiting_review' ? 'ring-1 ring-orange-500/50 border-orange-500/40' : 'border-[#27272A]'
          )}
        >
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-medium truncate">Awaiting Review</span>
            <Clock size={14} className="text-orange-400 shrink-0" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white tracking-tight">{stats.awaiting}</div>
          <span className="text-[10px] text-orange-400/90 font-mono">needs reviewer</span>
        </div>

        <div
          onClick={() => setSelectedStatus('approved')}
          className={cn(
            'p-3.5 rounded-xl border bg-[#0E0F14] hover:bg-[#121319] transition-all cursor-pointer group shadow-sm text-left',
            selectedStatus === 'approved' ? 'ring-1 ring-emerald-500/50 border-emerald-500/40' : 'border-[#27272A]'
          )}
        >
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-medium truncate">Approved</span>
            <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white tracking-tight">{stats.approved}</div>
          <span className="text-[10px] text-emerald-400/90 font-mono">ready to merge</span>
        </div>

        <div
          onClick={() => setSelectedStatus('merged')}
          className={cn(
            'p-3.5 rounded-xl border bg-[#0E0F14] hover:bg-[#121319] transition-all cursor-pointer group shadow-sm text-left',
            selectedStatus === 'merged' ? 'ring-1 ring-purple-500/50 border-purple-500/40' : 'border-[#27272A]'
          )}
        >
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-medium truncate">Merged</span>
            <GitMerge size={14} className="text-purple-400 shrink-0" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white tracking-tight">{stats.merged}</div>
          <span className="text-[10px] text-purple-400/90 font-mono">shipped to main</span>
        </div>

        <div
          onClick={() => setSelectedStatus('conflicts')}
          className={cn(
            'p-3.5 rounded-xl border bg-[#0E0F14] hover:bg-[#121319] transition-all cursor-pointer group shadow-sm text-left',
            selectedStatus === 'conflicts' ? 'ring-1 ring-rose-500/50 border-rose-500/40' : 'border-[#27272A]'
          )}
        >
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-medium truncate">Conflicts</span>
            <AlertTriangle size={14} className="text-rose-400 shrink-0" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white tracking-tight">{stats.conflicts}</div>
          <span className="text-[10px] text-rose-400/90 font-mono">unmergeable</span>
        </div>

        <div
          onClick={() => setSelectedStatus('all')}
          className={cn(
            'p-3.5 rounded-xl border bg-[#0E0F14] hover:bg-[#121319] transition-all cursor-pointer group shadow-sm text-left',
            selectedStatus === 'all' ? 'ring-1 ring-blue-500/50 border-blue-500/40' : 'border-[#27272A]'
          )}
        >
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-medium truncate">Total PRs</span>
            <FolderGit2 size={14} className="text-blue-400 shrink-0" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white tracking-tight">{stats.total}</div>
          <span className="text-[10px] text-blue-400/90 font-mono">all activity</span>
        </div>
      </div>

      {/* ─── 2-Column Directory Layout matching TeamView ─── */}
      <div className="flex flex-col lg:flex-row items-start gap-6 w-full">
        {/* Left Column: Search & Controls + Cards/List Directory */}
        <div className="flex-1 w-full lg:min-w-0 space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search PRs by title, author, branch, #number..."
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

            {/* Right Controls: Repo picker, Count, Grid/List Switcher, New MR Button */}
            <div className="flex items-center gap-2.5 flex-wrap self-end sm:self-auto">
              {repositories.length > 1 && (
                <select
                  value={selectedRepoId}
                  onChange={(e) => setSelectedRepoId(e.target.value)}
                  className="h-9 px-2.5 rounded-xl bg-[#111216] border border-[#27272A] text-xs text-zinc-300 font-mono focus:outline-none"
                >
                  <option value="all">All Repositories</option>
                  {repositories.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}

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

              {/* New Merge Request Button */}
              {repositories.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(true)}
                  className="h-9 px-3 rounded-xl hover:brightness-110 active:scale-[0.98] text-[#0A0B10] text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                  style={{ backgroundColor: accentColor, boxShadow: `0 3px 12px ${accentColor}30` }}
                >
                  <Plus size={14} strokeWidth={2.5} />
                  <span>New MR</span>
                </button>
              )}
            </div>
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {statusPills.map((pill) => {
              const isSelected = selectedStatus === pill.id;
              return (
                <button
                  key={pill.id}
                  onClick={() => setSelectedStatus(pill.id)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border',
                    isSelected
                      ? 'bg-zinc-800 text-white border-zinc-600 shadow-sm'
                      : 'bg-[#111216] text-zinc-400 border-[#27272A] hover:text-zinc-200 hover:bg-[#16171D]'
                  )}
                >
                  <span>{pill.label}</span>
                  <span
                    className={cn(
                      'px-1.5 py-0.2 rounded text-[10px] font-mono',
                      isSelected ? 'bg-white/10 text-white' : 'bg-white/5 text-zinc-500'
                    )}
                  >
                    {pill.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Content: Cards Grid or List */}
          {loading ? (
            <div className="p-16 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
              <Loader2 size={20} className="animate-spin text-zinc-400" />
              <span>Loading merge requests...</span>
            </div>
          ) : filteredMRs.length === 0 ? (
            <div className="p-16 rounded-2xl border border-dashed border-[#27272A] bg-[#0E0F14] text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto">
                <GitPullRequest size={22} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">No Merge Requests Found</h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                  {search ? `No pull requests matching "${search}".` : 'No pull requests found matching the selected filter.'}
                </p>
              </div>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="text-xs text-indigo-400 hover:underline cursor-pointer"
                >
                  Clear search filter
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* ─── GRID / CARD VIEW (with ambient hover glow matching TeamView) ─── */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMRs.map((mr) => {
                const isFocused = focusedMR?.id === mr.id;
                return (
                  <motion.div
                    key={mr.id}
                    whileHover={{ y: -2, transition: { duration: 0.15 } }}
                    onMouseEnter={() => setFocusedMRId(mr.id)}
                    onClick={() => {
                      setFocusedMRId(mr.id);
                    }}
                    onDoubleClick={() => handleOpenDrawer(mr)}
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
                      style={{
                        backgroundColor:
                          mr.state === 'merged'
                            ? '#8B5CF6'
                            : mr.hasConflicts
                            ? '#EF4444'
                            : mr.state === 'open'
                            ? '#10B981'
                            : '#6B7280',
                      }}
                    />

                    <div className="space-y-3 relative z-10">
                      {/* Top Row: #Number + State Badge + Reviewer Avatars */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={cn(
                              'w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border text-xs',
                              mr.state === 'merged'
                                ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                                : mr.state === 'open'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                            )}
                          >
                            {mr.state === 'merged' ? <GitMerge size={13} /> : <GitPullRequest size={13} />}
                          </span>
                          <span className="font-mono text-xs font-bold text-indigo-400">
                            #{mr.number}
                          </span>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border',
                              mr.state === 'merged'
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                : mr.state === 'open'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                            )}
                          >
                            {mr.state}
                          </span>
                          {mr.isDraft && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
                              Draft
                            </span>
                          )}
                        </div>

                        {/* Right: Reviewers Stack */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {mr.reviewers.length > 0 && (
                            <div className="flex -space-x-1.5 overflow-hidden">
                              {mr.reviewers.slice(0, 3).map((r, rIdx) => (
                                <div
                                  key={rIdx}
                                  className={cn(
                                    'w-5 h-5 rounded-full border border-[#0E0F15] flex items-center justify-center text-[9px] font-bold text-white',
                                    r.status === 'approved' ? 'bg-emerald-600' : 'bg-zinc-800 text-zinc-300'
                                  )}
                                  title={`${r.name} (${r.status || 'pending'})`}
                                >
                                  {r.name.slice(0, 2).toUpperCase()}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* PR Title */}
                      <h4 className="text-[13px] font-semibold text-white group-hover:text-indigo-200 transition-colors line-clamp-2">
                        {mr.title}
                      </h4>

                      {/* Branch Info Pill */}
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 bg-[#111216] p-1.5 rounded-lg border border-[#27272A] w-fit max-w-full truncate">
                        <GitBranch size={11} className="text-zinc-500 shrink-0" />
                        <span className="text-indigo-300 truncate">{mr.sourceBranch}</span>
                        <span className="text-zinc-600">→</span>
                        <span className="text-zinc-400 truncate">{mr.targetBranch}</span>
                      </div>

                      {/* Metadata Badges: Checks, Conflicts, Diff */}
                      <div className="flex items-center gap-2 flex-wrap pt-1 text-[11px]">
                        {mr.hasConflicts && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                            <AlertTriangle size={10} />
                            <span>Conflicts</span>
                          </span>
                        )}

                        {mr.checkStatus === 'success' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                            <CheckCircle2 size={10} />
                            <span>Passed</span>
                          </span>
                        )}

                        {mr.checkStatus === 'failed' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                            <AlertTriangle size={10} />
                            <span>Failed</span>
                          </span>
                        )}

                        {mr.diffSummary && (
                          <span className="text-xs font-mono">
                            <span className="text-emerald-400">+{mr.diffSummary.additions}</span>{' '}
                            <span className="text-rose-400">-{mr.diffSummary.deletions}</span>
                          </span>
                        )}

                        {mr.commentsCount > 0 && (
                          <span className="text-zinc-500 flex items-center gap-1 font-mono text-[11px]">
                            <MessageSquare size={11} />
                            <span>{mr.commentsCount}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Author + Relative date */}
                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#27272A]/80 text-[11px] text-zinc-500 relative z-10">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                          {mr.author.avatarUrl ? (
                            <img src={mr.author.avatarUrl} alt={mr.author.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            mr.author.name.slice(0, 1).toUpperCase()
                          )}
                        </div>
                        <span className="text-zinc-400 truncate">{mr.author.name || mr.author.username}</span>
                      </div>
                      <span className="shrink-0">{new Date(mr.createdAt).toLocaleDateString()}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            /* ─── LIST VIEW ─── */
            <div className="divide-y divide-[#27272A]/80 rounded-2xl border border-[#27272A] bg-[#0E0F14] overflow-hidden shadow-sm">
              {filteredMRs.map((mr) => {
                const isFocused = focusedMR?.id === mr.id;
                return (
                  <div
                    key={mr.id}
                    onMouseEnter={() => setFocusedMRId(mr.id)}
                    onClick={() => setFocusedMRId(mr.id)}
                    onDoubleClick={() => handleOpenDrawer(mr)}
                    className={cn(
                      'p-3.5 px-4 flex items-center justify-between gap-3 transition-colors cursor-pointer group text-left',
                      isFocused ? 'bg-[#151620]' : 'hover:bg-[#12131A]'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border',
                          mr.state === 'merged'
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                            : mr.state === 'open'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        )}
                      >
                        {mr.state === 'merged' ? <GitMerge size={13} /> : <GitPullRequest size={13} />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-indigo-400">
                            #{mr.number}
                          </span>
                          <span className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors truncate">
                            {mr.title}
                          </span>

                          {mr.isDraft && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
                              Draft
                            </span>
                          )}

                          {mr.hasConflicts && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                              <AlertTriangle size={10} />
                              <span>Conflicts</span>
                            </span>
                          )}

                          {mr.checkStatus === 'success' && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Checks Passed
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-1">
                          <span className="font-mono text-zinc-400">{mr.repoFullName}</span>
                          <span>•</span>
                          <span className="font-mono text-indigo-400/90">{mr.sourceBranch}</span>
                          <span>→</span>
                          <span className="font-mono text-zinc-400">{mr.targetBranch}</span>
                          <span>•</span>
                          <span>opened {new Date(mr.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right metadata */}
                    <div className="flex items-center gap-3 shrink-0">
                      {mr.diffSummary && (
                        <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono">
                          <span className="text-emerald-400">+{mr.diffSummary.additions}</span>
                          <span className="text-rose-400">-{mr.diffSummary.deletions}</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDrawer(mr);
                        }}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.08] transition-colors"
                        title="Open diff inspection"
                      >
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Right Column: Sticky Quick Inspector Panel (matching TeamView) ─── */}
        <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 lg:sticky lg:top-6">
          <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-4 text-left">
            {/* Box Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-[#27272A]/80">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                  style={{
                    backgroundColor:
                      focusedMR?.state === 'merged'
                        ? '#8B5CF6'
                        : focusedMR?.hasConflicts
                        ? '#EF4444'
                        : focusedMR?.state === 'open'
                        ? '#10B981'
                        : '#6B7280',
                  }}
                />
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-white truncate tracking-tight">PR Inspector</h3>
                  <p className="text-[10px] text-zinc-500 font-mono truncate">
                    {focusedMR ? `#${focusedMR.number} · ${focusedMR.repoFullName}` : 'Quick review details'}
                  </p>
                </div>
              </div>

              {focusedMR && (
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={focusedMR.webUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                    title="Open on Git Provider"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              )}
            </div>

            {focusedMR ? (
              <div className="space-y-4">
                {/* Title & Status */}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border',
                        focusedMR.state === 'merged'
                          ? 'bg-purple-500/10 text-purple-400 border-purple-500/25'
                          : focusedMR.state === 'open'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      )}
                    >
                      {focusedMR.state}
                    </span>
                    {focusedMR.hasConflicts && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/25">
                        Conflicts Detected
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-semibold text-white leading-snug">
                    {focusedMR.title}
                  </h4>
                </div>

                {/* Branch Flow Diagram */}
                <div className="p-3 rounded-xl bg-[#111216] border border-[#27272A] space-y-2 text-xs font-mono">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block font-sans">
                    Branch Flow
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate px-2 py-1 rounded bg-zinc-800/80 text-indigo-300 border border-zinc-700/60 max-w-[45%]">
                      {focusedMR.sourceBranch}
                    </div>
                    <span className="text-zinc-500 shrink-0 font-sans">into</span>
                    <div className="truncate px-2 py-1 rounded bg-zinc-800/80 text-zinc-300 border border-zinc-700/60 max-w-[45%]">
                      {focusedMR.targetBranch}
                    </div>
                  </div>
                </div>

                {/* Author & Reviewers */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-[11px] text-zinc-500">Author:</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] text-white">
                        {focusedMR.author.avatarUrl ? (
                          <img src={focusedMR.author.avatarUrl} alt="" className="w-full h-full rounded-full" />
                        ) : (
                          focusedMR.author.name.slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <span className="text-white font-medium">{focusedMR.author.name}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-[11px] text-zinc-500">CI / Checks:</span>
                    <span
                      className={cn(
                        'font-medium text-[11px]',
                        focusedMR.checkStatus === 'success'
                          ? 'text-emerald-400'
                          : focusedMR.checkStatus === 'failed'
                          ? 'text-rose-400'
                          : 'text-zinc-400'
                      )}
                    >
                      {focusedMR.checkStatus === 'success'
                        ? '✓ All Passed'
                        : focusedMR.checkStatus === 'failed'
                        ? '✕ Failed'
                        : '• Neutral'}
                    </span>
                  </div>

                  {focusedMR.diffSummary && (
                    <div className="flex items-center justify-between text-zinc-400">
                      <span className="text-[11px] text-zinc-500">Diff Summary:</span>
                      <span className="font-mono text-xs">
                        <span className="text-emerald-400">+{focusedMR.diffSummary.additions}</span>{' '}
                        <span className="text-rose-400">-{focusedMR.diffSummary.deletions}</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2 border-t border-[#27272A]/80">
                  <button
                    type="button"
                    onClick={() => handleOpenDrawer(focusedMR)}
                    className="w-full h-9 rounded-xl text-black font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer hover:brightness-110 active:scale-[0.98]"
                    style={{ backgroundColor: accentColor }}
                  >
                    <FileCode size={13} />
                    <span>Inspect Full Diff & Reviews</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => copyMRLink(focusedMR)}
                      className="h-8 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer border border-zinc-700/60"
                    >
                      {copiedLink ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLinkingMR(focusedMR)}
                      className="h-8 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer border border-zinc-700/60"
                    >
                      <Link2 size={12} />
                      <span>Link Record</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-zinc-500">
                Select a pull request to inspect its branches, reviews, and diff summary.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── MODAL: Create Merge Request ─── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-[#27272A] bg-[#121319] shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150 text-left">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <GitPullRequest size={15} className="text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">Open Merge Request</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateMR} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Target Repository</label>
                <select
                  value={createRepoId || ''}
                  onChange={(e) => setCreateRepoId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-[#0E0F14] border border-zinc-800 rounded-lg text-white"
                >
                  {repositories.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.fullName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Branch Selector */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">Source Branch (head)</label>
                  <select
                    value={sourceBranch}
                    onChange={(e) => setSourceBranch(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#0E0F14] border border-zinc-800 rounded-lg text-white font-mono"
                  >
                    {branches.map((b) => (
                      <option key={b.name} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">Target Branch (base)</label>
                  <select
                    value={targetBranch}
                    onChange={(e) => setTargetBranch(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#0E0F14] border border-zinc-800 rounded-lg text-white font-mono"
                  >
                    {branches.map((b) => (
                      <option key={b.name} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. feat(auth): add OAuth2 provider authentication"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0E0F14] border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe your changes, fixes, and references..."
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0E0F14] border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 resize-none font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="draft-mr-checkbox"
                  checked={isDraft}
                  onChange={(e) => setIsDraft(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-indigo-500"
                />
                <label htmlFor="draft-mr-checkbox" className="text-xs text-zinc-400 cursor-pointer">
                  Create as Draft (not ready for merge)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || loadingBranches}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 size={12} className="animate-spin" />}
                  <span>Create Merge Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DRAWER: Detailed MR Inspection ─── */}
      <GitRecordDetailsDrawer
        projectId={projectId}
        isOpen={isDrawerOpen}
        recordType="mr"
        repoId={drawerRepoId ? parseInt(drawerRepoId, 10) : 0}
        recordNumber={drawerNum ? parseInt(drawerNum, 10) : 0}
        onClose={handleCloseDrawer}
        onRecordUpdated={fetchMRs}
      />

      {/* ─── MODAL: Link Record ─── */}
      {linkingMR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#27272A] bg-[#121319] p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-white">Link Pull Request to DevFlow Record</h3>
              <button
                type="button"
                onClick={() => setLinkingMR(null)}
                className="text-zinc-500 hover:text-white cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
            <GitRecordLinker
              projectId={projectId}
              repositoryId={linkingMR.repositoryId}
              provider={linkingMR.provider}
              recordType="merge_request"
              recordNumber={linkingMR.number}
              recordId={linkingMR.id}
              recordTitle={linkingMR.title}
              recordUrl={linkingMR.webUrl}
              onLinksChanged={() => {
                fetchMRs();
                toast.success('Record linked successfully');
                setLinkingMR(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
