import React, { useState } from 'react';
import {
  X,
  Share2,
  Globe,
  Users,
  Copy,
  Check,
  Lock,
  Calendar,
  Download,
  Eye,
  Loader2,
  Sparkles,
  Clock,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ProjectDocument, DocumentShare } from '../../types/document';
import { documentService } from '../../services/document.service';
import { AnimatedSelect, SelectOption } from '../settings/AnimatedSelect';
import { useAccentTheme } from '../../services/accentTheme.service';

interface DocumentShareModalProps {
  projectId: number;
  document: ProjectDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onShareCreated: (newShare: DocumentShare) => void;
}

export const DocumentShareModal: React.FC<DocumentShareModalProps> = ({
  projectId,
  document: doc,
  isOpen,
  onClose,
  onShareCreated,
}) => {
  const { accentColor } = useAccentTheme();
  const [shareType, setShareType] = useState<'public' | 'internal'>('public');
  const [permission, setPermission] = useState<'view' | 'download'>('download');
  const [requirePassword, setRequirePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [expiryDays, setExpiryDays] = useState<'never' | '1' | '7' | '30'>('7');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedShare, setGeneratedShare] = useState<DocumentShare | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !doc) return null;

  const handleCreateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let expiresAt: string | null = null;
      if (expiryDays !== 'never') {
        const d = new Date();
        d.setDate(d.getDate() + parseInt(expiryDays, 10));
        expiresAt = d.toISOString();
      }

      const res = await documentService.createShare(projectId, doc.id, {
        shareType,
        permission,
        password: requirePassword && password ? password : null,
        expiresAt,
      });

      if (res.success && res.data) {
        setGeneratedShare(res.data);
        onShareCreated(res.data);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resolvedShareToken =
    generatedShare?.token ||
    (generatedShare as any)?.tokenHash ||
    (generatedShare?.shareUrl ? generatedShare.shareUrl.split('/').filter(Boolean).pop() : '');

  const shareUrl = resolvedShareToken
    ? `${window.location.origin}/share/documents/${resolvedShareToken}`
    : '';

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setGeneratedShare(null);
    setPassword('');
    setRequirePassword(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-visible flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between rounded-t-2xl">
          <div className="space-y-0.5 min-w-0">
            <h3 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
              <Share2 size={18} style={{ color: accentColor }} />
              Share Document
            </h3>
            <p className="text-xs text-zinc-400 truncate max-w-sm">
              {doc.name}
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
        <div className="p-4 sm:p-5 space-y-4">
          {generatedShare ? (
            /* Link Generated Success View */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2.5">
                <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold text-white">Share Link Ready</span>
                  <p className="text-emerald-400/90 leading-relaxed">
                    Anyone with this link can {(generatedShare.permission || (generatedShare as any).permissionLevel) === 'download' ? 'preview & download' : 'preview'} this file. Private blobs are fetched through secure zero-cost backend proxy.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-zinc-400 block">
                  Public Share URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 select-all focus:outline-none"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-[#0A0B10] transition-all shrink-0 hover:brightness-110 cursor-pointer"
                    style={{ backgroundColor: accentColor }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {requirePassword && (
                <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 text-xs space-y-1">
                  <span className="text-zinc-400 font-medium flex items-center gap-1">
                    <Lock size={12} className="text-amber-400" /> Password Protected
                  </span>
                  <p className="text-zinc-300 font-mono">{password}</p>
                </div>
              )}

              <div className="pt-2 flex justify-between">
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                >
                  Create another share link
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-750"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Creation Form */
            <form onSubmit={handleCreateShare} className="space-y-4 text-xs">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShareType('public')}
                  className={cn(
                    'py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors',
                    shareType === 'public'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  <Globe size={14} />
                  <span>Public Token Link</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShareType('internal')}
                  className={cn(
                    'py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors',
                    shareType === 'internal'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  <Users size={14} />
                  <span>Project Members</span>
                </button>
              </div>

              {/* Permission */}
              <div>
                <label className="text-[11px] font-medium text-zinc-300 block mb-1.5">
                  Allowed Permission
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={cn(
                      'p-2.5 rounded-lg border flex items-center gap-2 cursor-pointer transition-colors',
                      permission === 'download'
                        ? 'border-blue-500 bg-blue-500/10 text-white'
                        : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700'
                    )}
                  >
                    <input
                      type="radio"
                      name="permission"
                      checked={permission === 'download'}
                      onChange={() => setPermission('download')}
                      className="hidden"
                    />
                    <Download size={14} className="text-emerald-400" />
                    <div>
                      <span className="font-semibold block text-xs">Preview & Download</span>
                      <span className="text-[10px] text-zinc-500">Full file access</span>
                    </div>
                  </label>

                  <label
                    className={cn(
                      'p-2.5 rounded-lg border flex items-center gap-2 cursor-pointer transition-colors',
                      permission === 'view'
                        ? 'border-blue-500 bg-blue-500/10 text-white'
                        : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700'
                    )}
                  >
                    <input
                      type="radio"
                      name="permission"
                      checked={permission === 'view'}
                      onChange={() => setPermission('view')}
                      className="hidden"
                    />
                    <Eye size={14} style={{ color: accentColor }} />
                    <div>
                      <span className="font-semibold block text-xs">View / Preview Only</span>
                      <span className="text-[10px] text-zinc-500">No direct downloads</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Expiration */}
              <div>
                <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                  Link Expiration
                </label>
                <AnimatedSelect
                  value={expiryDays}
                  onChange={(val) => setExpiryDays(val as any)}
                  options={[
                    { value: 'never', label: 'Never Expires', icon: <Clock size={13} className="text-emerald-400" /> },
                    { value: '1', label: 'Expires in 24 Hours', icon: <Clock size={13} className="text-amber-400" /> },
                    { value: '7', label: 'Expires in 7 Days', icon: <Clock size={13} style={{ color: accentColor }} /> },
                    { value: '30', label: 'Expires in 30 Days', icon: <Clock size={13} className="text-purple-400" /> },
                  ]}
                  accentColor={accentColor}
                />
              </div>

              {/* Optional Password Protection */}
              {shareType === 'public' && (
                <div className="space-y-2 p-3 rounded-xl bg-zinc-950/40 border border-zinc-800">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requirePassword}
                      onChange={(e) => setRequirePassword(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-0"
                    />
                    <span className="text-xs text-zinc-300 font-medium flex items-center gap-1.5">
                      <Lock size={12} className="text-amber-400" />
                      Require Password to Access
                    </span>
                  </label>

                  {requirePassword && (
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter access passphrase"
                      required={requirePassword}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  )}
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-750"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-[#0A0B10] transition-all shadow-sm disabled:opacity-50 hover:brightness-110 cursor-pointer"
                  style={{ backgroundColor: accentColor }}
                >
                  {isSubmitting ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Sparkles size={13} />
                  )}
                  <span>Generate Link</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

