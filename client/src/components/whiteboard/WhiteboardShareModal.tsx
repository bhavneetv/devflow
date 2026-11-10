import React, { useState, useEffect } from 'react';
import {
  Share2,
  X,
  Copy,
  Check,
  Link2,
  ExternalLink,
  Eye,
  Edit3,
  Lock,
  Globe,
  PowerOff,
} from 'lucide-react';
import {
  WhiteboardShareConfig,
  WhiteboardSharePermission,
  WhiteboardShareStatus,
} from './whiteboard.types';
import {
  getExistingShareConfig,
  createOrUpdateShareConfig,
  updateSharePermission,
  closeBoardSharing,
  reopenBoardSharing,
  getBoardShareStatus,
} from './whiteboard.storage';
import { useAccentTheme } from '../../services/accentTheme.service';
import { cn } from '../../lib/utils';

export interface WhiteboardShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardTitle: string;
  projectId: string | number;
  scopeKey: string;
  boardId: string;
  onShareStatusChange?: (status: WhiteboardShareStatus) => void;
}

export const WhiteboardShareModal: React.FC<WhiteboardShareModalProps> = ({
  isOpen,
  onClose,
  boardTitle,
  projectId,
  scopeKey,
  boardId,
  onShareStatusChange,
}) => {
  const { accentColor } = useAccentTheme();
  const [permission, setPermission] = useState<WhiteboardSharePermission>('view');
  const [shareConfig, setShareConfig] = useState<WhiteboardShareConfig | null>(null);
  const [isSharingActive, setIsSharingActive] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load existing share config on modal open
  useEffect(() => {
    if (isOpen) {
      const existing = getExistingShareConfig(projectId, scopeKey, boardId, true);
      if (existing) {
        setShareConfig(existing);
        setPermission(existing.permission);
        setIsSharingActive(existing.enabled !== false);
      } else {
        // Not shared yet
        setShareConfig(null);
        setIsSharingActive(false);
      }
      setCopied(false);
    }
  }, [isOpen, projectId, scopeKey, boardId]);

  if (!isOpen) return null;

  const shareUrl = shareConfig && isSharingActive
    ? `${window.location.origin}/whiteboard/share/${shareConfig.token}`
    : '';

  // Start / Enable Sharing
  const handleEnableSharing = () => {
    const cfg = createOrUpdateShareConfig(
      projectId,
      scopeKey,
      boardId,
      boardTitle,
      permission
    );
    setShareConfig(cfg);
    setIsSharingActive(true);
    onShareStatusChange?.(cfg.permission === 'edit' ? 'public_edit' : 'public_view');
  };

  // Close / Stop Sharing
  const handleStopSharing = () => {
    const updated = closeBoardSharing(projectId, scopeKey, boardId);
    if (updated) {
      setShareConfig(updated);
    }
    setIsSharingActive(false);
    onShareStatusChange?.('private');
  };

  const handlePermissionChange = (newPerm: WhiteboardSharePermission) => {
    setPermission(newPerm);
    if (shareConfig && isSharingActive) {
      const updated = updateSharePermission(shareConfig.token, newPerm);
      if (updated) {
        setShareConfig(updated);
        onShareStatusChange?.(newPerm === 'edit' ? 'public_edit' : 'public_view');
      }
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenPreview = () => {
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#121316] border border-[#27272A] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Modal Header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#27272A] bg-[#16171D]">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#27272A]"
              style={{ backgroundColor: `${accentColor}18` }}
            >
              {isSharingActive ? (
                permission === 'edit' ? (
                  <div className="relative">
                    <Globe size={15} className="text-emerald-400" />
                    <Edit3 size={7} className="absolute -bottom-1 -right-1 text-emerald-300" />
                  </div>
                ) : (
                  <Globe size={15} className="text-cyan-400" />
                )
              ) : (
                <Lock size={15} className="text-zinc-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white tracking-tight">
                  Share Whiteboard
                </h3>
                <span
                  className={cn(
                    'px-2 py-0.2 rounded-full text-[10px] font-medium border',
                    isSharingActive
                      ? permission === 'edit'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  )}
                >
                  {isSharingActive ? (permission === 'edit' ? 'Public (Can Edit)' : 'Public (View Only)') : 'Private'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate max-w-[240px]">
                {boardTitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* ─── Modal Body ────────────────────────────────────────────────── */}
        <div className="p-5 space-y-4">
          {/* Active Sharing State */}
          {isSharingActive ? (
            <>
              {/* Permission Mode Selector */}
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
                  Permission
                </label>

                <div className="grid grid-cols-2 gap-2">
                  {/* Option 1: Can View */}
                  <button
                    type="button"
                    onClick={() => handlePermissionChange('view')}
                    className={cn(
                      'flex items-center gap-2.5 p-3 rounded-xl border text-left cursor-pointer transition-all',
                      permission === 'view'
                        ? 'bg-[#181922] border-cyan-500/70 shadow-sm'
                        : 'bg-[#14151A] border-[#27272A] hover:bg-[#181920] text-zinc-400'
                    )}
                    style={
                      permission === 'view'
                        ? {
                            borderColor: `${accentColor}80`,
                            boxShadow: `0 0 12px ${accentColor}18`,
                          }
                        : undefined
                    }
                  >
                    <div
                      className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                        permission === 'view'
                          ? 'bg-cyan-500/15 text-cyan-400'
                          : 'bg-zinc-800 text-zinc-400'
                      )}
                      style={
                        permission === 'view'
                          ? { backgroundColor: `${accentColor}20`, color: accentColor }
                          : undefined
                      }
                    >
                      <Eye size={14} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-zinc-200 block">
                        Can View
                      </span>
                      <span className="text-[10px] text-zinc-400 block truncate">
                        Read-only
                      </span>
                    </div>
                  </button>

                  {/* Option 2: Can Edit */}
                  <button
                    type="button"
                    onClick={() => handlePermissionChange('edit')}
                    className={cn(
                      'flex items-center gap-2.5 p-3 rounded-xl border text-left cursor-pointer transition-all',
                      permission === 'edit'
                        ? 'bg-[#181922] border-emerald-500/70 shadow-sm'
                        : 'bg-[#14151A] border-[#27272A] hover:bg-[#181920] text-zinc-400'
                    )}
                    style={
                      permission === 'edit'
                        ? {
                            borderColor: `${accentColor}80`,
                            boxShadow: `0 0 12px ${accentColor}18`,
                          }
                        : undefined
                    }
                  >
                    <div
                      className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                        permission === 'edit'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-zinc-800 text-zinc-400'
                      )}
                      style={
                        permission === 'edit'
                          ? { backgroundColor: `${accentColor}20`, color: accentColor }
                          : undefined
                      }
                    >
                      <Edit3 size={14} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-zinc-200 block">
                        Can Edit
                      </span>
                      <span className="text-[10px] text-zinc-400 block truncate">
                        Allow editing
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Share Link Input & Copy Button */}
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
                  Share Link
                </label>
                <div className="flex items-center gap-2 p-1.5 pl-3 rounded-xl bg-[#0E0F14] border border-[#27272A] focus-within:border-zinc-500 transition-colors">
                  <Link2 size={14} className="text-zinc-500 shrink-0" />
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    onFocus={(e) => e.target.select()}
                    className="flex-1 bg-transparent text-xs text-zinc-200 font-mono outline-none selection:bg-indigo-500/30 truncate"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 shadow-sm',
                      copied
                        ? 'bg-emerald-500 text-white'
                        : 'text-white hover:opacity-90'
                    )}
                    style={!copied ? { backgroundColor: accentColor } : undefined}
                    title="Copy link"
                  >
                    {copied ? (
                      <>
                        <Check size={13} className="stroke-[3]" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Close Sharing Button */}
              <div className="pt-1 flex items-center justify-between">
                <span className="text-[11px] text-zinc-500">
                  Want to disable public access?
                </span>
                <button
                  type="button"
                  onClick={handleStopSharing}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 cursor-pointer transition-colors"
                  title="Close sharing and disable public link"
                >
                  <PowerOff size={11} />
                  <span>Close Sharing</span>
                </button>
              </div>
            </>
          ) : (
            /* Private / Disabled State */
            <div className="text-center py-5 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-800/80 border border-[#27272A] flex items-center justify-center text-zinc-400 mx-auto">
                <Lock size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-200">
                  This whiteboard is private
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Enable public sharing to generate a shareable link.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleEnableSharing}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-lg cursor-pointer transition-transform active:scale-95 hover:opacity-95"
                  style={{ backgroundColor: accentColor }}
                >
                  <Globe size={13} />
                  <span>Enable Share Link</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Footer Controls ───────────────────────────────────────────── */}
        <div className="px-5 py-3 border-t border-[#27272A] bg-[#16171D] flex items-center justify-between">
          {isSharingActive && shareUrl ? (
            <button
              type="button"
              onClick={handleOpenPreview}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer transition-colors"
              title="Open preview in new tab"
            >
              <ExternalLink size={13} />
              <span>Open preview</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-[#1F2028] hover:bg-[#272832] border border-[#27272A] cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
