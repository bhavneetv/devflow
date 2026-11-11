import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  ShieldCheck,
  HardDrive,
  RefreshCw,
  Save,
  Loader2,
  ExternalLink,
  Lock,
  GitBranch,
  Copy,
  XCircle,
  FolderGit2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type {
  DocumentModuleSettings,
  DocumentScopeMeta,
  ProjectStorageOverview,
} from '../../types/document';
import { documentService } from '../../services/document.service';
import { AnimatedSelect, SelectOption } from '../settings/AnimatedSelect';
import { useAccentTheme } from '../../services/accentTheme.service';

interface DocumentSettingsModalProps {
  projectId: number;
  submoduleId?: number;
  scopeMeta?: DocumentScopeMeta;
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated: () => void;
}

export const DocumentSettingsModal: React.FC<DocumentSettingsModalProps> = ({
  projectId,
  submoduleId,
  scopeMeta,
  isOpen,
  onClose,
  onSettingsUpdated,
}) => {
  const { accentColor } = useAccentTheme();
  const [storage, setStorage] = useState<ProjectStorageOverview | null>(null);
  const [settings, setSettings] = useState<DocumentModuleSettings | null>(null);
  const [maxSizeMb, setMaxSizeMb] = useState(25);
  const [duplicateHandling, setDuplicateHandling] = useState<'rename' | 'replace' | 'reject'>('rename');
  const [enableExternalSharing, setEnableExternalSharing] = useState(true);
  const [requireSharePassword, setRequireSharePassword] = useState(false);
  const [storageMode, setStorageMode] = useState<'folder' | 'branch'>('folder');
  const [folderPath, setFolderPath] = useState('documents');
  const [branchName, setBranchName] = useState('main');
  const [scopeWarning, setScopeWarning] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);

  useEffect(() => {
    if (scopeMeta) {
      setStorageMode(scopeMeta.storageMode || 'folder');
      setFolderPath(scopeMeta.pathPrefix || 'documents');
      setBranchName(scopeMeta.branchName || 'main');
    }
  }, [scopeMeta, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setScopeWarning(null);
      Promise.all([
        documentService.getStorageOverview(projectId),
        documentService.getSettings(projectId),
      ])
        .then(([storageRes, settingsRes]) => {
          if (storageRes.success && storageRes.data) {
            setStorage(storageRes.data);
          }
          if (settingsRes.success && settingsRes.data) {
            setSettings(settingsRes.data);
            setMaxSizeMb(settingsRes.data.maxUploadSizeMb || 25);
            setDuplicateHandling(settingsRes.data.duplicateHandling || 'rename');
            setEnableExternalSharing(settingsRes.data.enableExternalSharing ?? true);
            setRequireSharePassword(settingsRes.data.requireSharePassword ?? false);
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const handleHealthCheck = async () => {
    setIsCheckingHealth(true);
    setHealthStatus(null);
    try {
      const res = await documentService.setupStorage(projectId);
      if (res.success && res.data) {
        const overviewRes = await documentService.getStorageOverview(projectId);
        if (overviewRes.success && overviewRes.data) {
          setStorage(overviewRes.data);
        }
        setHealthStatus('Repository connection is 100% active and healthy.');
      } else {
        setHealthStatus(res.error || 'Health check encountered an issue.');
      }
    } catch (e: any) {
      setHealthStatus(e.message || 'Error communicating with storage provider.');
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setScopeWarning(null);
    try {
      const targetSubId = submoduleId ?? scopeMeta?.submoduleId ?? undefined;
      const [res, scopeRes] = await Promise.all([
        documentService.updateSettings(projectId, {
          maxUploadSizeMb: maxSizeMb,
          duplicateHandling,
          enableExternalSharing,
          requireSharePassword,
        }),
        targetSubId
          ? documentService.updateScopeConfig(projectId, {
              submoduleId: targetSubId,
              storageMode,
              folderPath,
              branchName,
            })
          : Promise.resolve({ success: true as const }),
      ]);

      if ((scopeRes as any)?.data?.branchWarning) {
        setScopeWarning((scopeRes as any).data.branchWarning);
      }

      if (res.success) {
        onSettingsUpdated();
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-visible flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
              <Settings size={18} style={{ color: accentColor }} />
              Documents & Storage Configuration
            </h3>
            <p className="text-xs text-zinc-400">
              Manage zero-cost GitHub repository binding and document upload policies
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-5 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="space-y-4 py-2 animate-pulse">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
                <div className="h-4 w-44 rounded bg-zinc-800" />
                <div className="h-3 w-64 rounded bg-zinc-800/70" />
                <div className="h-8 w-full rounded-lg bg-zinc-800/60" />
              </div>
              <div className="space-y-2">
                <div className="h-3.5 w-36 rounded bg-zinc-800" />
                <div className="h-9 w-full rounded-lg bg-zinc-800/70" />
              </div>
              <div className="space-y-2">
                <div className="h-3.5 w-44 rounded bg-zinc-800" />
                <div className="h-9 w-full rounded-lg bg-zinc-800/70" />
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-5 text-xs">
              {/* GitHub Storage Section */}
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-200 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-400" />
                    Dedicated GitHub Repository
                  </span>
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                    Zero Cost
                  </span>
                </div>

                <div className="space-y-1 text-zinc-400 text-xs leading-relaxed">
                  <p>
                    Target Repository:{' '}
                    <strong className="text-white font-mono">
                      {storage?.storageConnection?.repositoryName
                        ? `${storage.storageConnection.providerOwner || 'owner'}/${storage.storageConnection.repositoryName}`
                        : 'devflow-{project}-docs'}
                    </strong>
                  </p>
                  <p>
                    Default Branch:{' '}
                    <span className="text-zinc-300 font-mono">
                      {storage?.storageConnection?.defaultBranch || 'main'}
                    </span>
                  </p>
                  <p>
                    Status:{' '}
                    <span
                      className={cn(
                        'font-medium font-mono',
                        storage?.storageConnection?.connectionStatus === 'unlinked'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      )}
                    >
                      {storage?.storageConnection?.connectionStatus === 'unlinked'
                        ? 'Unlinked (Manage in Project Settings > Storage)'
                        : 'Free (Zero Infrastructure Cloud S3 Fees)'}
                    </span>
                  </p>
                </div>

                {healthStatus && (
                  <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300">
                    {healthStatus}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleHealthCheck}
                    disabled={isCheckingHealth}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-750 hover:text-white border border-zinc-700 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={isCheckingHealth ? 'animate-spin' : ''} />
                    <span>Test Repository Sync</span>
                  </button>

                  {storage?.storageConnection?.repositoryUrl && (
                    <a
                      href={storage.storageConnection.repositoryUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <ExternalLink size={12} />
                      <span>View on GitHub</span>
                    </a>
                  )}
                </div>
              </div>

              {(submoduleId || scopeMeta?.submoduleId) && (
                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-200 flex items-center gap-2">
                      <FolderGit2 size={15} style={{ color: accentColor }} />
                      Module Storage Isolation (Same Repository)
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {scopeMeta?.submoduleName || `Module #${submoduleId || scopeMeta?.submoduleId}`}
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Choose whether files uploaded in this submodule are stored in an isolated folder on the default branch or on their own dedicated Git branch while sharing the 2 GB combined repository quota.
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setStorageMode('folder')}
                      className={cn(
                        'p-2.5 rounded-lg border text-left transition-all cursor-pointer',
                        storageMode === 'folder'
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      )}
                      style={storageMode === 'folder' ? { borderColor: accentColor } : undefined}
                    >
                      <div className="font-semibold text-[11px]">Dedicated Folder</div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate">
                        {folderPath || 'modules/...'}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStorageMode('branch')}
                      className={cn(
                        'p-2.5 rounded-lg border text-left transition-all cursor-pointer',
                        storageMode === 'branch'
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      )}
                      style={storageMode === 'branch' ? { borderColor: accentColor } : undefined}
                    >
                      <div className="font-semibold text-[11px] flex items-center gap-1">
                        <GitBranch size={11} /> Dedicated Branch
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate">
                        {branchName || 'docs/...'}
                      </div>
                    </button>
                  </div>

                  {storageMode === 'folder' ? (
                    <div>
                      <label className="text-[11px] text-zinc-400 block mb-1">
                        Repository Folder Path
                      </label>
                      <input
                        type="text"
                        value={folderPath}
                        onChange={(e) => setFolderPath(e.target.value)}
                        placeholder="modules/design-docs"
                        className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono text-xs focus:outline-none focus:border-zinc-600"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-[11px] text-zinc-400 block mb-1">
                        Dedicated Git Branch Name
                      </label>
                      <input
                        type="text"
                        value={branchName}
                        onChange={(e) => setBranchName(e.target.value)}
                        placeholder="docs/module-branch"
                        className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono text-xs focus:outline-none focus:border-zinc-600"
                      />
                    </div>
                  )}

                  {scopeWarning && (
                    <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                      {scopeWarning}
                    </div>
                  )}
                </div>
              )}

              {/* Upload Limit Settings */}
              <div className="space-y-3">
                <span className="font-semibold text-zinc-200 block text-xs uppercase tracking-wider">
                  Upload Constraints
                </span>

                <div>
                  <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                    Max File Upload Size: <span className="font-bold" style={{ color: accentColor }}>{maxSizeMb} MB</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="25"
                    value={maxSizeMb}
                    onChange={(e) => setMaxSizeMb(Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                  <span className="text-[10px] text-zinc-500 block mt-1">
                    GitHub Contents API REST payload limit is 25 MB per direct commit.
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                    Default Duplicate Policy
                  </label>
                  <AnimatedSelect
                    value={duplicateHandling}
                    onChange={(val) => setDuplicateHandling(val as any)}
                    options={[
                      {
                        value: 'rename',
                        label: 'Auto-Rename',
                        sublabel: 'Append (1), (2)',
                        icon: <Copy size={13} style={{ color: accentColor }} />,
                      },
                      {
                        value: 'replace',
                        label: 'Replace Existing',
                        sublabel: 'Increment Version',
                        icon: <RefreshCw size={13} className="text-amber-400" />,
                      },
                      {
                        value: 'reject',
                        label: 'Reject / Skip',
                        sublabel: 'Error on duplicate',
                        icon: <XCircle size={13} className="text-rose-400" />,
                      },
                    ]}
                    accentColor={accentColor}
                  />
                </div>
              </div>

              {/* Security & Sharing Settings */}
              <div className="space-y-3 pt-2 border-t border-zinc-800">
                <span className="font-semibold text-zinc-200 block text-xs uppercase tracking-wider">
                  Sharing & Security
                </span>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableExternalSharing}
                    onChange={(e) => setEnableExternalSharing(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-0 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-semibold text-zinc-200 block">
                      Enable External Public Share Links
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Allows project members to generate secure unguessable token links for stakeholders without GitHub accounts.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireSharePassword}
                    onChange={(e) => setRequireSharePassword(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-0 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-semibold text-zinc-200 block">
                      Enforce Password Protection on Public Links
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Requires all generated external links to have a passphrase set.
                    </span>
                  </div>
                </label>
              </div>

              {/* Submit */}
              <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-750"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-[#0A0B10] transition-all shadow-sm disabled:opacity-50 hover:brightness-110 cursor-pointer"
                  style={{ backgroundColor: accentColor }}
                >
                  {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Save Configuration</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

