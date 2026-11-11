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
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { DocumentModuleSettings, ProjectStorageConnection } from '../../types/document';
import { documentService } from '../../services/document.service';

interface DocumentSettingsModalProps {
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated: () => void;
}

export const DocumentSettingsModal: React.FC<DocumentSettingsModalProps> = ({
  projectId,
  isOpen,
  onClose,
  onSettingsUpdated,
}) => {
  const [storage, setStorage] = useState<ProjectStorageConnection | null>(null);
  const [settings, setSettings] = useState<DocumentModuleSettings | null>(null);
  const [maxSizeMb, setMaxSizeMb] = useState(25);
  const [duplicateHandling, setDuplicateHandling] = useState<'rename' | 'replace' | 'reject'>('rename');
  const [enableExternalSharing, setEnableExternalSharing] = useState(true);
  const [requireSharePassword, setRequireSharePassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      Promise.all([
        documentService.getStorageStatus(projectId),
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
        setStorage(res.data);
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
    try {
      const res = await documentService.updateSettings(projectId, {
        maxUploadSizeMb: maxSizeMb,
        duplicateHandling,
        enableExternalSharing,
        requireSharePassword,
      });

      if (res.success) {
        onSettingsUpdated();
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
              <Settings size={18} className="text-blue-400" />
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
            <div className="py-12 flex items-center justify-center gap-2 text-zinc-400 text-xs">
              <Loader2 size={16} className="animate-spin" />
              <span>Loading storage configuration...</span>
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
                      {storage ? `${storage.repositoryOwner}/${storage.repositoryName}` : 'devflow-{project}-docs'}
                    </strong>
                  </p>
                  <p>
                    Default Branch:{' '}
                    <span className="text-zinc-300 font-mono">
                      {storage?.repositoryBranch || 'main'}
                    </span>
                  </p>
                  <p>
                    Storage Cost: <span className="text-emerald-400 font-medium">Free (Zero Infrastructure Cloud S3 Fees)</span>
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

                  {storage?.repoUrl && (
                    <a
                      href={storage.repoUrl}
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

              {/* Upload Limit Settings */}
              <div className="space-y-3">
                <span className="font-semibold text-zinc-200 block text-xs uppercase tracking-wider">
                  Upload Constraints
                </span>

                <div>
                  <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                    Max File Upload Size: <span className="text-blue-400 font-bold">{maxSizeMb} MB</span>
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
                  <select
                    value={duplicateHandling}
                    onChange={(e) => setDuplicateHandling(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="rename">Auto-Rename (Append (1), (2))</option>
                    <option value="replace">Replace Existing (Increment Version)</option>
                    <option value="reject">Reject / Skip Duplicate</option>
                  </select>
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
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-sm disabled:opacity-50"
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

