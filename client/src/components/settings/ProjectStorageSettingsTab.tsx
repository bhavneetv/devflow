import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HardDrive,
  GitBranch,
  FolderGit2,
  Link2,
  Unlink,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Globe,
  FileText,
  ArrowUpRight,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAccentTheme } from '../../services/accentTheme.service';
import { useToast } from '../../context/ToastContext';
import { documentService } from '../../services/document.service';
import { confirmActionSwal } from '../../lib/confirmAlert';
import { SettingsPageHeader } from './SettingsPageHeader';
import { SettingsSection } from './SettingsSection';
import { AnimatedSelect, SelectOption } from './AnimatedSelect';
import type {
  AccessibleStorageRepo,
  ProjectStorageOverview,
} from '../../types/document';

interface ProjectStorageSettingsTabProps {
  projectId: number;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getContrastText(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#0A0B10';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#0A0B10' : '#FFFFFF';
}

export const ProjectStorageSettingsTab: React.FC<ProjectStorageSettingsTabProps> = ({
  projectId,
}) => {
  const { accentColor } = useAccentTheme();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [overview, setOverview] = useState<ProjectStorageOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [isRelinking, setIsRelinking] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);

  // Relink / Change Repository Modal State
  const [isRepoPickerOpen, setIsRepoPickerOpen] = useState(false);
  const [repos, setRepos] = useState<AccessibleStorageRepo[]>([]);
  const [isReposLoading, setIsReposLoading] = useState(false);
  const [selectedRepoFullName, setSelectedRepoFullName] = useState<string>('');
  const [customBranchInput, setCustomBranchInput] = useState<string>('');

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await documentService.getStorageOverview(projectId);
      if (res.success && res.data) {
        setOverview(res.data);
      } else {
        toast.error('Storage Overview', res.error || 'Failed to load project storage info');
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const storageConn = overview?.storageConnection;
  const health = overview?.health;
  const usage = overview?.usage;
  const branches = overview?.branches || [];
  const modules = overview?.modules || [];

  const status = storageConn?.connectionStatus || health?.connectionStatus || 'disconnected';
  const isUnlinked = status === 'unlinked';
  const isConnected = status === 'connected' && Boolean(storageConn?.repositoryName);
  const repoFullName =
    storageConn?.providerOwner && storageConn?.repositoryName
      ? `${storageConn.providerOwner}/${storageConn.repositoryName}`
      : null;

  const limitBytes = usage?.configuredLimitBytes || 2 * 1024 * 1024 * 1024;
  const usedBytes = usage?.totalTrackedBytes || 0;
  const remainingBytes = Math.max(0, limitBytes - usedBytes);
  const usedPct = limitBytes > 0 ? Math.min(100, (usedBytes / limitBytes) * 100) : 0;

  const handleOpenRepoPicker = async () => {
    setIsRepoPickerOpen(true);
    setIsReposLoading(true);
    setSelectedRepoFullName(repoFullName || '');
    setCustomBranchInput(storageConn?.defaultBranch || '');
    try {
      const res = await documentService.listStorageRepos(projectId);
      if (res.success && res.data?.repos) {
        setRepos(res.data.repos);
        if (!repoFullName && res.data.repos.length > 0) {
          setSelectedRepoFullName(res.data.repos[0].fullName);
          setCustomBranchInput(res.data.repos[0].defaultBranch);
        }
      } else {
        toast.error('GitHub Repositories', res.error || 'Could not fetch accessible repositories');
      }
    } finally {
      setIsReposLoading(false);
    }
  };

  const handleUnlink = async () => {
    const confirmed = await confirmActionSwal({
      title: 'Unlink Storage Repository?',
      text: 'This disconnects DevFlow Document submodules from your GitHub storage repository across the entire project.',
      highlightLabel: repoFullName || 'Connected GitHub Repository',
      warningNote:
        'WARNING: While unlinked, all uploaded documents, folders, previews, downloads, and shared links will NOT be shown or accessible in any project module. No data on GitHub is deleted and you can Relink anytime.',
      confirmText: 'Yes, Unlink Repository',
      cancelText: 'Keep Linked',
      accentColor,
      icon: 'warning',
    });

    if (!confirmed) return;

    setIsUnlinking(true);
    try {
      const res = await documentService.unlinkStorage(projectId);
      if (res.success) {
        toast.info(
          'Repository Unlinked',
          'Document modules are now locked until you relink the storage repository.'
        );
        await loadOverview();
      } else {
        toast.error('Unlink Failed', res.error || 'Could not unlink repository');
      }
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleQuickRelink = async () => {
    setIsRelinking(true);
    try {
      const res = await documentService.relinkStorage(projectId);
      if (res.success) {
        toast.success(
          'Repository Relinked',
          `${repoFullName || res.data?.fullName || 'Storage repository'} is active again.`
        );
        await loadOverview();
      } else {
        toast.error('Relink Failed', res.error || 'Failed to relink previous repository');
      }
    } finally {
      setIsRelinking(false);
    }
  };

  const handleConfirmRelinkRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosen = repos.find((r) => r.fullName === selectedRepoFullName);
    if (!chosen) {
      toast.error('Repository Required', 'Please select a GitHub repository.');
      return;
    }

    setIsRelinking(true);
    try {
      const res = await documentService.relinkStorage(projectId, {
        owner: chosen.owner,
        repositoryName: chosen.name,
        branch: customBranchInput.trim() || chosen.defaultBranch,
      });
      if (res.success) {
        toast.success('Repository Linked', `Document storage is now linked to ${chosen.fullName}.`);
        setIsRepoPickerOpen(false);
        await loadOverview();
      } else {
        toast.error('Relink Failed', res.error || 'Could not link selected repository');
      }
    } finally {
      setIsRelinking(false);
    }
  };

  const handleSetupDefaultRepo = async () => {
    setIsSettingUp(true);
    try {
      const res = await documentService.setupStorage(projectId);
      if (res.success) {
        toast.success('Storage Connected', 'Private GitHub document storage repository provisioned.');
        await loadOverview();
      } else {
        toast.error('Provision Failed', res.error || 'Could not setup GitHub repository');
      }
    } finally {
      setIsSettingUp(false);
    }
  };

  const repoSelectOptions: SelectOption[] = repos.map((r) => ({
    value: r.fullName,
    label: r.fullName,
    description: `${r.isPrivate ? 'Private' : 'Public'} · branch: ${r.defaultBranch} · ${formatBytes((r.sizeKb || 0) * 1024)}`,
  }));

  const ctaTextColor = getContrastText(accentColor);

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        title="Storage"
        description="Monitor the connected GitHub repository backing DevFlow documents, combined multi-branch storage consumption, and unlink or relink storage."
        action={
          <button
            type="button"
            onClick={loadOverview}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#161820] hover:bg-[#1E202B] border border-[#27272A] text-xs font-medium text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh Usage</span>
          </button>
        }
      />

      <div className="px-6 sm:px-8 space-y-2 pb-12">
        {isLoading ? (
          <div className="py-8 space-y-5 animate-pulse">
            <div className="rounded-2xl border border-[#27272A] bg-[#0E0F14] p-6 h-48" />
            <div className="rounded-2xl border border-[#27272A] bg-[#0E0F14] p-6 h-40" />
            <div className="rounded-2xl border border-[#27272A] bg-[#0E0F14] p-6 h-36" />
          </div>
        ) : (
          <>
            {/* ─── Section 1: Repository Binding & Combined Usage ─────────── */}
            <SettingsSection
              id="storage-repository"
              title="Connected Storage Repository"
              description="All Document submodules inside this project commit encrypted/raw assets to this repository and share the 2 GB quota."
            >
              {isUnlinked && (
                <div className="rounded-2xl border border-amber-500/35 bg-amber-500/[0.08] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle size={17} />
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-amber-200">
                        Storage Repository Currently Unlinked
                      </div>
                      <p className="text-xs text-amber-200/80 leading-relaxed max-w-xl">
                        Document listings, previews, downloads, and share links are disabled across every module while unlinked. Relink <span className="font-mono font-semibold">{repoFullName || 'your repository'}</span> below to restore immediate access.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleQuickRelink}
                      disabled={isRelinking}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                      style={{
                        backgroundColor: accentColor,
                        color: ctaTextColor,
                        boxShadow: `0 6px 18px -4px ${accentColor}55`,
                      }}
                    >
                      {isRelinking ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                      <span>{isRelinking ? 'Relinking...' : 'Relink Repository'}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-[#27272A] bg-[#0E0F14]/95 p-5 sm:p-6 shadow-xl space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className="w-11 h-11 rounded-xl border flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${accentColor}15`,
                        borderColor: `${accentColor}40`,
                        color: accentColor,
                      }}
                    >
                      <HardDrive size={20} />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-white font-mono truncate">
                          {repoFullName || 'No repository linked yet'}
                        </h3>

                        {isConnected && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                            <CheckCircle2 size={11} />
                            Connected
                          </span>
                        )}
                        {isUnlinked && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25">
                            <AlertTriangle size={11} />
                            Unlinked (Locked)
                          </span>
                        )}
                        {!isConnected && !isUnlinked && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
                            Not Connected
                          </span>
                        )}

                        {repoFullName && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#161820] text-zinc-400 border border-[#27272A]">
                            {usage?.isPrivate !== false ? <Lock size={10} /> : <Globe size={10} />}
                            {usage?.isPrivate !== false ? 'Private' : 'Public'}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                        {storageConn?.defaultBranch && (
                          <span className="inline-flex items-center gap-1 font-mono">
                            <GitBranch size={12} className="text-zinc-500" />
                            Default: <span className="text-zinc-200">{storageConn.defaultBranch}</span>
                          </span>
                        )}
                        {storageConn?.providerConnection?.accountName && (
                          <span>
                            GitHub Account:{' '}
                            <span className="text-zinc-300 font-medium">
                              {storageConn.providerConnection.accountName}
                            </span>
                          </span>
                        )}
                        {storageConn?.repositoryUrl && (
                          <a
                            href={storageConn.repositoryUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                            style={{ color: accentColor }}
                          >
                            <span>Open on GitHub</span>
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Link / Unlink Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {isUnlinked ? (
                      <>
                        <button
                          type="button"
                          onClick={handleQuickRelink}
                          disabled={isRelinking}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                          style={{
                            backgroundColor: accentColor,
                            color: ctaTextColor,
                          }}
                        >
                          <Link2 size={13} />
                          <span>{isRelinking ? 'Relinking...' : 'Relink Repo'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleOpenRepoPicker}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-300 bg-[#161820] hover:bg-[#1E202B] border border-[#27272A] transition-colors cursor-pointer"
                        >
                          <FolderGit2 size={13} />
                          <span>Choose Another Repo</span>
                        </button>
                      </>
                    ) : isConnected ? (
                      <>
                        <button
                          type="button"
                          onClick={handleOpenRepoPicker}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-200 bg-[#161820] hover:bg-[#1E202B] border border-[#27272A] transition-colors cursor-pointer"
                        >
                          <Link2 size={13} />
                          <span>Relink / Switch Repo</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleUnlink}
                          disabled={isUnlinking}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isUnlinking ? <Loader2 size={13} className="animate-spin" /> : <Unlink size={13} />}
                          <span>Unlink</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleSetupDefaultRepo}
                          disabled={isSettingUp}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                          style={{
                            backgroundColor: accentColor,
                            color: ctaTextColor,
                          }}
                        >
                          {isSettingUp ? <Loader2 size={13} className="animate-spin" /> : <HardDrive size={13} />}
                          <span>Provision Default Repo</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleOpenRepoPicker}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-200 bg-[#161820] hover:bg-[#1E202B] border border-[#27272A] transition-colors cursor-pointer"
                        >
                          <Link2 size={13} />
                          <span>Link Existing Repo</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Combined Capacity Progress */}
                <div className="pt-4 border-t border-[#27272A]/80 space-y-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold font-mono text-white">
                        {formatBytes(usedBytes)}
                      </span>
                      <span className="text-xs text-zinc-400">
                        used across all modules & branches ·{' '}
                        <span className="text-zinc-200 font-mono font-medium">
                          {formatBytes(remainingBytes)}
                        </span>{' '}
                        remaining
                      </span>
                    </div>
                    <div className="text-xs font-mono text-zinc-400">
                      {usage?.totalFiles || 0} tracked files · Limit: {formatBytes(limitBytes)}
                    </div>
                  </div>

                  <div className="h-2.5 w-full rounded-full bg-[#171923] overflow-hidden border border-[#27272A]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(usedBytes > 0 ? 1.5 : 0, usedPct)}%`,
                        backgroundColor: usedPct > 90 ? '#EF4444' : accentColor,
                      }}
                    />
                  </div>

                  {usage?.repoGitHubSizeBytes !== null && usage?.repoGitHubSizeBytes !== undefined && (
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                      <span>
                        Total Git repository size reported by GitHub (all refs & history):{' '}
                        <span className="text-zinc-300">{formatBytes(usage.repoGitHubSizeBytes)}</span>
                      </span>
                      <span>
                        {usedBytes > 0 && usedPct < 0.1 ? '< 0.1%' : `${usedPct.toFixed(1)}%`} of 2 GB limit
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </SettingsSection>

            {/* ─── Section 2: Per-Branch Storage Breakdown ────────────────── */}
            <SettingsSection
              id="storage-branches"
              title="Branch Storage Breakdown"
              description="Combined storage used by each Git branch inside your document repository."
            >
              {branches.length === 0 ? (
                <div className="rounded-2xl border border-[#27272A] bg-[#0E0F14]/90 p-6 text-center text-xs text-zinc-500">
                  {isUnlinked
                    ? 'Live GitHub branch inspection is paused while the repository is unlinked.'
                    : 'No branches detected yet. Upload a document or configure a branch-isolated submodule to see branch usage.'}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {branches.map((branch) => {
                    const sharePct =
                      usedBytes > 0 ? Math.min(100, (branch.trackedBytes / usedBytes) * 100) : 0;
                    return (
                      <div
                        key={branch.name}
                        className="rounded-xl border border-[#27272A] bg-[#0E0F14]/95 p-4 space-y-2.5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <GitBranch size={14} style={{ color: accentColor }} className="shrink-0" />
                            <span className="text-xs sm:text-sm font-mono font-semibold text-white truncate">
                              {branch.name}
                            </span>
                            {branch.isDefault && (
                              <span
                                className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
                                style={{
                                  backgroundColor: `${accentColor}15`,
                                  borderColor: `${accentColor}40`,
                                  color: accentColor,
                                }}
                              >
                                default
                              </span>
                            )}
                            {branch.protected && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                                protected
                              </span>
                            )}
                            {branch.moduleNames.map((mName) => (
                              <span
                                key={mName}
                                className="text-[10px] px-2 py-0.5 rounded-md bg-[#161820] text-zinc-300 border border-[#27272A]"
                              >
                                {mName}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center gap-3 text-xs font-mono shrink-0">
                            <span className="text-zinc-400">{branch.fileCount} files</span>
                            <span className="text-white font-semibold">
                              {formatBytes(branch.trackedBytes)}
                            </span>
                            {branch.gitHubTreeBytes !== null &&
                              branch.gitHubTreeBytes !== undefined && (
                                <span className="text-[11px] text-zinc-500">
                                  (Git tree: {formatBytes(branch.gitHubTreeBytes)})
                                </span>
                              )}
                          </div>
                        </div>

                        <div className="h-1.5 w-full rounded-full bg-[#171923] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(branch.trackedBytes > 0 ? 2 : 0, sharePct)}%`,
                              backgroundColor: accentColor,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SettingsSection>

            {/* ─── Section 3: Submodule Isolation Map ─────────────────────── */}
            <SettingsSection
              id="storage-modules"
              title="Document Submodules Across Project Modules"
              description="Each Documents submodule keeps its own isolated file explorer & folders while contributing toward the combined repository quota."
            >
              {modules.length === 0 ? (
                <div className="rounded-2xl border border-[#27272A] bg-[#0E0F14]/90 p-6 text-center text-xs text-zinc-500">
                  No Documents submodules have been added to Project Modules yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {modules.map((mod) => (
                    <div
                      key={mod.submoduleId}
                      className="rounded-xl border border-[#27272A] bg-[#0E0F14]/95 p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <FileText size={14} style={{ color: accentColor }} className="shrink-0" />
                            <h4 className="text-sm font-semibold text-white truncate">
                              {mod.submoduleName}
                            </h4>
                            {mod.isPrimary && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                                Primary
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-0.5">
                            Module: <span className="text-zinc-300">{mod.moduleName}</span>
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => navigate(`/projects/${projectId}/documents/${mod.submoduleId}`)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-[#161820] border border-[#27272A] transition-colors cursor-pointer shrink-0"
                          title="Open submodule"
                        >
                          <ArrowUpRight size={13} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-[#27272A]/70 text-[11px]">
                        <span className="inline-flex items-center gap-1.5 font-mono text-zinc-300 truncate">
                          {mod.storageMode === 'branch' ? (
                            <>
                              <GitBranch size={11} style={{ color: accentColor }} />
                              Branch: {mod.branchName}
                            </>
                          ) : (
                            <>
                              <FolderGit2 size={11} style={{ color: accentColor }} />
                              Folder: /{mod.folderPath}
                            </>
                          )}
                        </span>
                        <span className="font-mono text-zinc-400 shrink-0">
                          {mod.fileCount} files ·{' '}
                          <strong className="text-white">{formatBytes(mod.sizeBytes)}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SettingsSection>
          </>
        )}
      </div>

      {/* ─── Relink / Switch Repository Modal ─────────────────────────────── */}
      {isRepoPickerOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-[#11131A] border border-[#27272A] shadow-2xl overflow-visible">
            <div className="p-5 border-b border-[#27272A] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Link2 size={16} style={{ color: accentColor }} />
                  Relink Document Storage Repository
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Select an accessible GitHub repository to store and serve DevFlow documents.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRepoPickerOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmRelinkRepo} className="p-5 space-y-4 text-xs">
              {isReposLoading ? (
                <div className="py-8 flex items-center justify-center gap-2 text-zinc-400">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Loading your GitHub repositories...</span>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-300 mb-1.5">
                      GitHub Repository
                    </label>
                    <AnimatedSelect
                      value={selectedRepoFullName}
                      onChange={(val) => {
                        setSelectedRepoFullName(val);
                        const match = repos.find((r) => r.fullName === val);
                        if (match) setCustomBranchInput(match.defaultBranch);
                      }}
                      options={repoSelectOptions}
                      placeholder="Choose a GitHub repository..."
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-300 mb-1.5">
                      Default Storage Branch
                    </label>
                    <input
                      type="text"
                      value={customBranchInput}
                      onChange={(e) => setCustomBranchInput(e.target.value)}
                      placeholder="main"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0C10] border border-[#27272A] text-white font-mono text-xs focus:outline-none focus:border-zinc-500"
                    />
                  </div>
                </>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRepoPickerOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white bg-[#171923] border border-[#27272A] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReposLoading || isRelinking || !selectedRepoFullName}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                  style={{
                    backgroundColor: accentColor,
                    color: ctaTextColor,
                  }}
                >
                  {isRelinking ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                  <span>{isRelinking ? 'Linking...' : 'Link Repository'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
