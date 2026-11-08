import React, { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  GitPullRequest,
  CircleDot,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  GitMerge,
  GitCommit,
  FileCode,
  Link as LinkIcon,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  Plus,
  Minus,
  Edit2,
  Loader2,
  Check,
} from 'lucide-react';
import { gitService } from '../../services/git.service';
import { GitRecordLinker } from './GitRecordLinker';
import { useToast } from '../../context/ToastContext';
import { cn } from '../../lib/utils';
import type { GitNormalizedIssue, GitNormalizedMR, GitDiffFile } from '../../types/git';

export interface GitRecordDetailsDrawerProps {
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
  recordType: 'issue' | 'mr' | null;
  repoId: number | null;
  recordNumber: number | null;
  onRecordUpdated?: () => void;
}

export const GitRecordDetailsDrawer: React.FC<GitRecordDetailsDrawerProps> = ({
  projectId,
  isOpen,
  onClose,
  recordType,
  repoId,
  recordNumber,
  onRecordUpdated,
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'details' | 'diff' | 'links'>('details');

  const [loading, setLoading] = useState(false);
  const [issue, setIssue] = useState<GitNormalizedIssue | null>(null);
  const [mr, setMr] = useState<GitNormalizedMR | null>(null);
  const [diffFiles, setDiffFiles] = useState<GitDiffFile[]>([]);
  const [loadingDiff, setLoadingDiff] = useState(false);

  // Merge modal state
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeMethod, setMergeMethod] = useState<'merge' | 'squash' | 'rebase'>('merge');
  const [commitTitle, setCommitTitle] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [isMerging, setIsMerging] = useState(false);

  // Edit issue state
  const [isEditingIssue, setIsEditingIssue] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [isSavingIssue, setIsSavingIssue] = useState(false);

  // Handle Esc key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (isMergeModalOpen) {
          setIsMergeModalOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isMergeModalOpen, onClose]);

  // Load record data when opened
  useEffect(() => {
    if (!isOpen || !repoId || !recordNumber || !recordType) {
      setIssue(null);
      setMr(null);
      setDiffFiles([]);
      return;
    }

    let isMounted = true;
    const fetchRecord = async () => {
      setLoading(true);
      try {
        if (recordType === 'issue') {
          const res = await gitService.getIssue(projectId, repoId, recordNumber);
          if (isMounted && res.success && res.data) {
            setIssue(res.data);
            setEditTitle(res.data.title);
            setEditBody(res.data.body);
          }
        } else if (recordType === 'mr') {
          const res = await gitService.getMergeRequest(projectId, repoId, recordNumber);
          if (isMounted && res.success && res.data) {
            setMr(res.data);
            setCommitTitle(`Merge pull request #${res.data.number} from ${res.data.sourceBranch}`);
            setCommitMessage(res.data.title);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRecord();
    return () => {
      isMounted = false;
    };
  }, [isOpen, projectId, repoId, recordNumber, recordType]);

  // Load diff files when switching to diff tab
  useEffect(() => {
    if (activeTab === 'diff' && recordType === 'mr' && repoId && recordNumber && diffFiles.length === 0) {
      let isMounted = true;
      const fetchDiff = async () => {
        setLoadingDiff(true);
        try {
          const res = await gitService.getMergeRequestDiff(projectId, repoId, recordNumber);
          if (isMounted && res.success && res.data) {
            setDiffFiles(res.data);
          }
        } catch (err) {
          console.error(err);
        } finally {
          if (isMounted) setLoadingDiff(false);
        }
      };
      fetchDiff();
      return () => {
        isMounted = false;
      };
    }
  }, [activeTab, recordType, projectId, repoId, recordNumber, diffFiles.length]);

  if (!isOpen) return null;

  // Toggle issue state
  const handleToggleIssueState = async () => {
    if (!issue || !repoId || !recordNumber) return;
    const nextState = issue.state === 'open' ? 'closed' : 'open';
    try {
      setLoading(true);
      const res = await gitService.updateIssue(projectId, repoId, recordNumber, { state: nextState });
      if (res.success && res.data) {
        setIssue(res.data);
        toast.success(`Issue ${nextState === 'closed' ? 'closed' : 'reopened'}`);
        onRecordUpdated?.();
      } else {
        toast.error(res.error || 'Failed to update issue');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating issue');
    } finally {
      setLoading(false);
    }
  };

  // Save edited issue
  const handleSaveIssue = async () => {
    if (!issue || !repoId || !recordNumber || !editTitle.trim()) return;
    try {
      setIsSavingIssue(true);
      const res = await gitService.updateIssue(projectId, repoId, recordNumber, {
        title: editTitle.trim(),
        body: editBody,
      });
      if (res.success && res.data) {
        setIssue(res.data);
        setIsEditingIssue(false);
        toast.success('Issue updated');
        onRecordUpdated?.();
      } else {
        toast.error(res.error || 'Failed to update issue');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating issue');
    } finally {
      setIsSavingIssue(false);
    }
  };

  // Execute Merge
  const handleExecuteMerge = async () => {
    if (!mr || !repoId || !recordNumber) return;
    try {
      setIsMerging(true);
      const res = await gitService.mergeMergeRequest(projectId, repoId, recordNumber, {
        commitTitle,
        commitMessage,
        mergeMethod,
      });

      if (res.success) {
        toast.success('Merge request successfully merged!');
        setIsMergeModalOpen(false);
        // Refresh MR
        const updated = await gitService.getMergeRequest(projectId, repoId, recordNumber);
        if (updated.success && updated.data) {
          setMr(updated.data);
        }
        onRecordUpdated?.();
      } else {
        toast.error(res.error || 'Failed to merge MR: Conflicts or provider checks failing');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error merging request');
    } finally {
      setIsMerging(false);
    }
  };

  const currentRecord = recordType === 'issue' ? issue : mr;
  const canonicalId = currentRecord?.id || `${recordType}:${recordNumber}`;
  const provider = currentRecord?.provider || 'github';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-in fade-in duration-150">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Sliding Drawer Container */}
      <div className="relative w-full max-w-2xl bg-[#0D0F14] border-l border-[#27272A] shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="shrink-0 p-4 px-5 border-b border-[#27272A] flex items-center justify-between bg-[#111319]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border',
                recordType === 'issue'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
              )}
            >
              {recordType === 'issue' ? <CircleDot size={15} /> : <GitPullRequest size={15} />}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold text-white">
                  #{recordNumber}
                </span>
                <span className="text-zinc-500 text-[11px] truncate font-mono">
                  {currentRecord?.repoFullName}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-zinc-800 text-zinc-400 border border-zinc-700">
                  {provider}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentRecord?.webUrl && (
              <a
                href={currentRecord.webUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Open in provider"
              >
                <ExternalLink size={15} />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Status and Action Ribbon */}
        {currentRecord && (
          <div className="shrink-0 px-5 py-2.5 bg-[#0E0F15] border-b border-[#27272A] flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2">
              {recordType === 'issue' ? (
                <span
                  className={cn(
                    'px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 border',
                    issue?.state === 'open'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  )}
                >
                  {issue?.state === 'open' ? <CircleDot size={11} /> : <CheckCircle2 size={11} />}
                  <span className="capitalize">{issue?.state}</span>
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 border',
                      mr?.state === 'merged'
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        : mr?.state === 'open'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                    )}
                  >
                    {mr?.state === 'merged' ? <GitMerge size={11} /> : <GitPullRequest size={11} />}
                    <span className="capitalize">{mr?.state}</span>
                  </span>

                  {mr?.hasConflicts && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1">
                      <AlertTriangle size={10} />
                      <span>Conflicts</span>
                    </span>
                  )}
                </div>
              )}

              {/* Author info */}
              <span className="text-zinc-400 text-[11px]">
                opened by <strong className="text-zinc-200">{currentRecord.author.name || currentRecord.author.username}</strong>
              </span>
            </div>

            {/* Header Primary Action */}
            <div className="flex items-center gap-2">
              {recordType === 'issue' && (
                <button
                  type="button"
                  onClick={handleToggleIssueState}
                  className="px-3 py-1 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors cursor-pointer"
                >
                  {issue?.state === 'open' ? 'Close Issue' : 'Reopen Issue'}
                </button>
              )}

              {recordType === 'mr' && mr?.state === 'open' && (
                <button
                  type="button"
                  disabled={mr.hasConflicts || !mr.canMerge}
                  onClick={() => setIsMergeModalOpen(true)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer',
                    mr.hasConflicts || !mr.canMerge
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  )}
                >
                  <GitMerge size={12} />
                  <span>Merge Pull Request</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="shrink-0 px-5 border-b border-[#27272A] bg-[#111319] flex items-center gap-4 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={cn(
              'py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5',
              activeTab === 'details'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            )}
          >
            <span>Overview</span>
          </button>

          {recordType === 'mr' && (
            <button
              type="button"
              onClick={() => setActiveTab('diff')}
              className={cn(
                'py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5',
                activeTab === 'diff'
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              )}
            >
              <FileCode size={13} />
              <span>Files Changed</span>
              {mr?.diffSummary && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300">
                  {mr.diffSummary.changedFiles}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('links')}
            className={cn(
              'py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5',
              activeTab === 'links'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            )}
          >
            <LinkIcon size={13} />
            <span>DevFlow Links</span>
          </button>
        </div>

        {/* Drawer Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-zinc-700">
          {loading ? (
            <div className="p-12 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
              <Loader2 size={20} className="animate-spin text-zinc-400" />
              <span>Loading record details...</span>
            </div>
          ) : !currentRecord ? (
            <div className="p-12 text-center text-xs text-zinc-500">Record not found</div>
          ) : (
            <>
              {/* TAB 1: DETAILS */}
              {activeTab === 'details' && (
                <div className="space-y-5">
                  {/* Title & Metadata Card */}
                  <div className="p-4 rounded-xl border border-[#27272A] bg-[#0E0F15] space-y-3">
                    {recordType === 'issue' && isEditingIssue ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-[#14151D] border border-zinc-700 rounded-lg text-white font-semibold focus:outline-none focus:border-indigo-500"
                        />
                        <textarea
                          rows={4}
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-[#14151D] border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 resize-none font-mono"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingIssue(false)}
                            className="px-3 py-1 rounded-md text-xs text-zinc-400 hover:text-white"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isSavingIssue}
                            onClick={handleSaveIssue}
                            className="px-3.5 py-1 rounded-md text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
                          >
                            {isSavingIssue ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-base font-semibold text-white leading-snug">
                          {currentRecord.title}
                        </h2>
                        {recordType === 'issue' && (
                          <button
                            type="button"
                            onClick={() => setIsEditingIssue(true)}
                            className="text-zinc-500 hover:text-zinc-300 p-1 rounded transition-colors cursor-pointer shrink-0"
                            title="Edit"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Branch information for MR */}
                    {recordType === 'mr' && mr && (
                      <div className="p-2.5 rounded-lg bg-[#14151D] border border-zinc-800 flex items-center gap-2 text-xs font-mono text-zinc-300">
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-indigo-400 font-semibold truncate">
                          {mr.sourceBranch}
                        </span>
                        <span className="text-zinc-500">into</span>
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 truncate">
                          {mr.targetBranch}
                        </span>
                      </div>
                    )}

                    {/* Diff stats for MR */}
                    {recordType === 'mr' && mr?.diffSummary && (
                      <div className="flex items-center gap-3 text-xs font-mono">
                        <span className="text-emerald-400 flex items-center gap-0.5">
                          <Plus size={11} />
                          {mr.diffSummary.additions} lines
                        </span>
                        <span className="text-rose-400 flex items-center gap-0.5">
                          <Minus size={11} />
                          {mr.diffSummary.deletions} lines
                        </span>
                        <span className="text-zinc-500 font-sans">
                          across {mr.diffSummary.changedFiles} files
                        </span>
                      </div>
                    )}

                    {/* Labels */}
                    {currentRecord.labels.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        {currentRecord.labels.map((lbl, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md text-[11px] font-medium border"
                            style={{
                              backgroundColor: `${lbl.color}15`,
                              borderColor: `${lbl.color}35`,
                              color: lbl.color,
                            }}
                          >
                            {lbl.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Body / Description */}
                  <div className="p-4 rounded-xl border border-[#27272A] bg-[#0E0F15] space-y-2">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500">
                      Description
                    </span>
                    <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans">
                      {currentRecord.body || (
                        <span className="italic text-zinc-500">No description provided.</span>
                      )}
                    </div>
                  </div>

                  {/* Reviewers for MR */}
                  {recordType === 'mr' && mr && mr.reviewers.length > 0 && (
                    <div className="p-4 rounded-xl border border-[#27272A] bg-[#0E0F15] space-y-2">
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500">
                        Reviewers
                      </span>
                      <div className="space-y-1.5">
                        {mr.reviewers.map((rev, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              {rev.avatarUrl ? (
                                <img src={rev.avatarUrl} alt={rev.name} className="w-5 h-5 rounded-full" />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] text-zinc-300">
                                  {rev.name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <span className="text-zinc-200">{rev.name}</span>
                            </div>
                            <span
                              className={cn(
                                'text-[10px] font-semibold uppercase px-2 py-0.5 rounded',
                                rev.status === 'approved'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : rev.status === 'changes_requested'
                                  ? 'bg-rose-500/10 text-rose-400'
                                  : 'bg-zinc-800 text-zinc-400'
                              )}
                            >
                              {rev.status || 'Pending'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: DIFF FILES (FOR MR) */}
              {activeTab === 'diff' && recordType === 'mr' && (
                <div className="space-y-4">
                  {loadingDiff ? (
                    <div className="p-12 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin text-zinc-400" />
                      <span>Loading file changes & diffs...</span>
                    </div>
                  ) : diffFiles.length === 0 ? (
                    <div className="p-8 text-center text-xs text-zinc-500">No changed files detected.</div>
                  ) : (
                    <div className="space-y-4">
                      {diffFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-[#27272A] bg-[#0E0F15] overflow-hidden"
                        >
                          <div className="p-2.5 px-3 bg-[#14151D] border-b border-[#27272A] flex items-center justify-between text-xs font-mono">
                            <span className="text-zinc-200 font-semibold truncate">{file.newPath}</span>
                            <div className="flex items-center gap-2 text-[11px] shrink-0">
                              <span className="text-emerald-400">+{file.additions}</span>
                              <span className="text-rose-400">-{file.deletions}</span>
                            </div>
                          </div>

                          <div className="p-3 overflow-x-auto text-[11px] font-mono leading-tight bg-[#090A0E] text-zinc-300">
                            {file.diffContent.split('\n').map((line, lIdx) => {
                              const isAdd = line.startsWith('+') && !line.startsWith('+++');
                              const isDel = line.startsWith('-') && !line.startsWith('---');
                              return (
                                <div
                                  key={lIdx}
                                  className={cn(
                                    'px-2 py-0.5 whitespace-pre',
                                    isAdd && 'bg-emerald-950/40 text-emerald-300',
                                    isDel && 'bg-rose-950/40 text-rose-300'
                                  )}
                                >
                                  {line || ' '}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: DEVFLOW LINKS */}
              {activeTab === 'links' && repoId && (
                <GitRecordLinker
                  projectId={projectId}
                  recordId={canonicalId}
                  recordType={recordType === 'issue' ? 'issue' : 'merge_request'}
                  provider={provider}
                  recordNumber={recordNumber ?? undefined}
                  recordTitle={currentRecord.title}
                  recordUrl={currentRecord.webUrl}
                  repositoryId={repoId}
                  onLinksChanged={onRecordUpdated}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Real Merge Confirmation Modal */}
      {isMergeModalOpen && mr && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-[#27272A] bg-[#121319] shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-white">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <GitMerge size={16} />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Confirm Merge</h3>
                <p className="text-[11px] text-zinc-400">Merge #{mr.number} into {mr.targetBranch}</p>
              </div>
            </div>

            {/* Merge Method Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Merge Strategy</label>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#0E0F14] border border-zinc-800 text-xs">
                {(['merge', 'squash', 'rebase'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setMergeMethod(method)}
                    className={cn(
                      'py-1.5 rounded-lg font-medium capitalize transition-all cursor-pointer text-center',
                      mergeMethod === method
                        ? 'bg-zinc-800 text-white font-semibold shadow-xs'
                        : 'text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            {/* Commit Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Commit Title</label>
              <input
                type="text"
                value={commitTitle}
                onChange={(e) => setCommitTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#0E0F14] border border-zinc-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Commit Message */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Commit Description</label>
              <textarea
                rows={3}
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#0E0F14] border border-zinc-800 rounded-lg text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isMerging}
                onClick={handleExecuteMerge}
                className="inline-flex items-center gap-1.5 px-4.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isMerging ? 'Merging with provider...' : 'Confirm and Execute Merge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

