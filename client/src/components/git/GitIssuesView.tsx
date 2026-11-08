import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CircleDot,
  CheckCircle2,
  Plus,
  MessageSquare,
  ExternalLink,
  Loader2,
  X,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { gitService } from '../../services/git.service';
import { GitFilterBar } from './GitFilterBar';
import { GitRecordDetailsDrawer } from './GitRecordDetailsDrawer';
import { useToast } from '../../context/ToastContext';
import { cn } from '../../lib/utils';
import type {
  GitNormalizedIssue,
  GitRepositoryConnectionItem,
} from '../../types/git';

export interface GitIssuesViewProps {
  projectId: number;
  initialFilter?: {
    state?: string;
    repoId?: number | string;
    search?: string;
  };
}

export const GitIssuesView: React.FC<GitIssuesViewProps> = ({
  projectId,
  initialFilter,
}) => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [issues, setIssues] = useState<GitNormalizedIssue[]>([]);
  const [repositories, setRepositories] = useState<GitRepositoryConnectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState(initialFilter?.search || '');
  const [selectedStatus, setSelectedStatus] = useState<string>(
    initialFilter?.state || searchParams.get('state') || 'open'
  );
  const [selectedRepoId, setSelectedRepoId] = useState<string | number>(
    initialFilter?.repoId || 'all'
  );
  const [selectedSort, setSelectedSort] = useState('created');

  // Drawer state synced with URL search params
  const drawerType = searchParams.get('drawerType');
  const drawerRepoId = searchParams.get('drawerRepoId');
  const drawerNum = searchParams.get('drawerNum');

  const isDrawerOpen = drawerType === 'issue' && Boolean(drawerRepoId) && Boolean(drawerNum);

  // Create Issue Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createRepoId, setCreateRepoId] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Load issues based on filters
  const fetchIssues = async () => {
    try {
      setLoading(true);
      const res = await gitService.getIssues(projectId, {
        state: selectedStatus,
        search,
        repoId: selectedRepoId,
        sort: selectedSort,
      });
      if (res.success && res.data) {
        setIssues(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [projectId, selectedStatus, selectedRepoId, selectedSort]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchIssues();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Open drawer
  const handleOpenDrawer = (issue: GitNormalizedIssue) => {
    if (!issue.repositoryId) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('drawerType', 'issue');
      next.set('drawerRepoId', issue.repositoryId!.toString());
      next.set('drawerNum', issue.number.toString());
      return next;
    });
  };

  // Close drawer
  const handleCloseDrawer = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('drawerType');
      next.delete('drawerRepoId');
      next.delete('drawerNum');
      return next;
    });
  };

  // Handle create issue
  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createRepoId || !newTitle.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await gitService.createIssue(projectId, createRepoId, {
        title: newTitle.trim(),
        body: newBody,
      });

      if (res.success && res.data) {
        toast.success(`Created Issue #${res.data.number}`);
        setIsCreateOpen(false);
        setNewTitle('');
        setNewBody('');
        await fetchIssues();
      } else {
        toast.error(res.error || 'Failed to create issue');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error creating issue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusOptions = [
    { id: 'all', label: 'All Issues' },
    { id: 'open', label: 'Open' },
    { id: 'closed', label: 'Closed' },
  ];

  const sortOptions = [
    { id: 'created', label: 'Recently Created' },
    { id: 'updated', label: 'Recently Updated' },
    { id: 'comments', label: 'Most Commented' },
  ];

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <GitFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Filter issues by title, #number..."
        repositories={repositories}
        selectedRepoId={selectedRepoId}
        onRepoChange={setSelectedRepoId}
        statusOptions={statusOptions}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        sortOptions={sortOptions}
        selectedSort={selectedSort}
        onSortChange={setSelectedSort}
        actions={
          repositories.length > 0 && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors cursor-pointer"
            >
              <Plus size={13} />
              <span>New Git Issue</span>
            </button>
          )
        }
      />

      {/* Issues Table / List */}
      {loading ? (
        <div className="p-16 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
          <Loader2 size={20} className="animate-spin text-zinc-400" />
          <span>Loading issues from repositories...</span>
        </div>
      ) : issues.length === 0 ? (
        <div className="p-12 rounded-xl border border-dashed border-[#27272A] bg-[#0E0F15] text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
            <CircleDot size={20} />
          </div>
          <h3 className="text-sm font-semibold text-white">No Issues Found</h3>
          <p className="text-xs text-zinc-500">
            {search ? 'Try adjusting your search or filters.' : 'No issues matching current filters.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/80 rounded-xl border border-[#27272A] bg-[#0E0F15] overflow-hidden shadow-xs">
          {issues.map((issue) => (
            <div
              key={issue.id}
              onClick={() => handleOpenDrawer(issue)}
              className="p-3.5 px-4 flex items-center justify-between gap-3 hover:bg-zinc-900/40 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    'w-6 h-6 rounded-md flex items-center justify-center shrink-0 border',
                    issue.state === 'open'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  )}
                >
                  {issue.state === 'open' ? <CircleDot size={13} /> : <CheckCircle2 size={13} />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-amber-400">
                      #{issue.number}
                    </span>
                    <span className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors truncate">
                      {issue.title}
                    </span>
                    {issue.labels.map((lbl, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.2 rounded text-[10px] font-medium border"
                        style={{
                          backgroundColor: `${lbl.color}15`,
                          borderColor: `${lbl.color}30`,
                          color: lbl.color,
                        }}
                      >
                        {lbl.name}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-1">
                    <span className="font-mono text-zinc-400">{issue.repoFullName}</span>
                    <span>•</span>
                    <span>
                      opened {new Date(issue.createdAt).toLocaleDateString()} by{' '}
                      {issue.author.name || issue.author.username}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right metadata */}
              <div className="flex items-center gap-3 shrink-0">
                {issue.assignees.length > 0 && (
                  <div className="flex -space-x-1.5 overflow-hidden">
                    {issue.assignees.map((a, aIdx) => (
                      <div
                        key={aIdx}
                        className="w-5 h-5 rounded-full bg-zinc-800 border border-[#0E0F15] flex items-center justify-center text-[9px] text-zinc-300 font-bold"
                        title={a.name || a.username}
                      >
                        {(a.name || a.username).slice(0, 2).toUpperCase()}
                      </div>
                    ))}
                  </div>
                )}

                {issue.commentsCount > 0 && (
                  <div className="flex items-center gap-1 text-[11px] text-zinc-500 font-mono">
                    <MessageSquare size={11} />
                    <span>{issue.commentsCount}</span>
                  </div>
                )}

                <a
                  href={issue.webUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-zinc-500 hover:text-white p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                  title="Open in provider"
                >
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: Create Git Issue */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-[#27272A] bg-[#121319] shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <CircleDot size={15} className="text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Create Git Issue</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateIssue} className="space-y-4">
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

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Issue Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Fix token refresh race condition..."
                  className="w-full px-3 py-2 text-xs bg-[#0E0F14] border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Description</label>
                <textarea
                  rows={4}
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder="Steps to reproduce, expected behavior, context..."
                  className="w-full px-3 py-2 text-xs bg-[#0E0F14] border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 resize-none font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newTitle.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating on provider...' : 'Create Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sliding Details Drawer */}
      {isDrawerOpen && (
        <GitRecordDetailsDrawer
          projectId={projectId}
          isOpen={true}
          onClose={handleCloseDrawer}
          recordType="issue"
          repoId={Number(drawerRepoId)}
          recordNumber={Number(drawerNum)}
          onRecordUpdated={fetchIssues}
        />
      )}
    </div>
  );
};

