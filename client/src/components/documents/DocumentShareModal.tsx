import React, { useState, useEffect } from 'react';
import {
  X,
  Share2,
  Globe,
  Users,
  Copy,
  Check,
  Lock,
  Download,
  Eye,
  Loader2,
  Sparkles,
  Clock,
  Trash2,
  CheckCircle2,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ProjectDocument, DocumentShare } from '../../types/document';
import { documentService } from '../../services/document.service';
import { AnimatedSelect } from '../settings/AnimatedSelect';
import { useAccentTheme } from '../../services/accentTheme.service';
import { confirmDeleteSwal } from '../../lib/confirmAlert';

interface DocumentShareModalProps {
  projectId: number;
  document: ProjectDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onShareCreated: (newShare: DocumentShare) => void;
  onShareRevoked?: (shareId: number) => void;
}

export const DocumentShareModal: React.FC<DocumentShareModalProps> = ({
  projectId,
  document: doc,
  isOpen,
  onClose,
  onShareCreated,
  onShareRevoked,
}) => {
  const { accentColor } = useAccentTheme();
  const [shareType, setShareType] = useState<'public' | 'internal'>('public');
  const [permission, setPermission] = useState<'view' | 'download'>('download');
  const [requirePassword, setRequirePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [expiryDays, setExpiryDays] = useState<'never' | '1' | '7' | '30'>('7');
  const [message, setMessage] = useState('');
  const [allowApproval, setAllowApproval] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedShare, setGeneratedShare] = useState<DocumentShare | null>(null);
  const [activeShares, setActiveShares] = useState<DocumentShare[]>([]);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | 'generated' | null>(null);

  const isPdf = Boolean(
    doc &&
      (doc.mimeType?.toLowerCase().includes('pdf') ||
        (doc.fileExtension || doc.extension || '').replace('.', '').toLowerCase() === 'pdf')
  );

  useEffect(() => {
    if (!isOpen || !doc) return;
    setGeneratedShare(null);
    setPassword('');
    setRequirePassword(false);
    setMessage('');
    setAllowApproval(false);
    setErrorMsg(null);
    setActiveShares(doc.shares || []);

    documentService.getDocument(projectId, doc.id).then((res) => {
      if (res.success && res.data) {
        setActiveShares(res.data.shares || []);
      }
    });
  }, [isOpen, doc, projectId]);

  if (!isOpen || !doc) return null;

  const resolveToken = (share: any): string => {
    return (
      share?.token ||
      share?.tokenHash ||
      (share?.shareUrl ? share.shareUrl.split('/').filter(Boolean).pop() : '') ||
      ''
    );
  };

  const handleCreateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

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
        message: message.trim() ? message.trim() : null,
        allowApproval: isPdf ? allowApproval : false,
      });

      if (res.success && res.data) {
        setGeneratedShare(res.data);
        setActiveShares((prev) => [res.data!, ...prev]);
        onShareCreated(res.data);
      } else {
        setErrorMsg(res.error || 'Failed to create share link.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeShare = async (shareId: number) => {
    const confirmed = await confirmDeleteSwal({
      title: 'Remove sharing link?',
      text: 'This share URL will stop working immediately for anyone using it.',
      confirmText: 'Remove Sharing',
      accentColor,
    });
    if (!confirmed) return;

    setRevokingId(shareId);
    try {
      const res = await documentService.revokeShare(projectId, doc.id, shareId);
      if (res.success) {
        setActiveShares((prev) => prev.filter((s) => s.id !== shareId));
        if (generatedShare?.id === shareId) {
          setGeneratedShare(null);
        }
        onShareRevoked?.(shareId);
      }
    } finally {
      setRevokingId(null);
    }
  };

  const resolvedShareToken = resolveToken(generatedShare);
  const shareUrl = resolvedShareToken
    ? `${window.location.origin}/share/documents/${resolvedShareToken}`
    : '';

  const handleCopy = (url: string, tag: number | 'generated') => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedId(tag);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReset = () => {
    setGeneratedShare(null);
    setPassword('');
    setRequirePassword(false);
    setMessage('');
    setAllowApproval(false);
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between rounded-t-2xl sticky top-0 bg-zinc-900/95 backdrop-blur-md z-20">
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
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
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
                    Anyone with this link can {(generatedShare.permission || generatedShare.permissionLevel) === 'download' ? 'preview & download' : 'preview'} this file.
                    {generatedShare.allowApproval ? ' Approve & Decline review buttons are active on this link.' : ''}
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
                    type="button"
                    onClick={() => handleCopy(shareUrl, 'generated')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-[#0A0B10] transition-all shrink-0 hover:brightness-110 cursor-pointer"
                    style={{ backgroundColor: accentColor }}
                  >
                    {copiedId === 'generated' ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedId === 'generated' ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {generatedShare.message && (
                <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 text-xs space-y-1">
                  <span className="text-zinc-400 font-medium flex items-center gap-1.5">
                    <MessageSquare size={12} style={{ color: accentColor }} /> Message Included
                  </span>
                  <p className="text-zinc-200">{generatedShare.message}</p>
                </div>
              )}

              {requirePassword && (
                <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 text-xs space-y-1">
                  <span className="text-zinc-400 font-medium flex items-center gap-1">
                    <Lock size={12} className="text-amber-400" /> Password Protected
                  </span>
                  <p className="text-zinc-300 font-mono">{password}</p>
                </div>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs font-medium hover:underline cursor-pointer"
                    style={{ color: accentColor }}
                  >
                    Create another link
                  </button>
                  <button
                    type="button"
                    disabled={revokingId === generatedShare.id}
                    onClick={() => handleRevokeShare(generatedShare.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {revokingId === generatedShare.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Trash2 size={12} />
                    )}
                    <span>Remove Sharing</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Creation Form + Existing Shares */
            <div className="space-y-4">
              {activeShares.length > 0 && (
                <div className="space-y-2 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      Active Sharing Links ({activeShares.length})
                    </span>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-0.5">
                    {activeShares.map((share) => {
                      const tok = resolveToken(share);
                      const fullUrl = tok ? `${window.location.origin}/share/documents/${tok}` : '';
                      const isExt = share.shareType === 'external_link' || share.shareType === 'public';
                      return (
                        <div
                          key={share.id}
                          className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800/90 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={cn(
                                  'text-[10px] font-medium px-1.5 py-0.5 rounded uppercase border',
                                  isExt
                                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                                    : 'bg-blue-500/10 text-blue-300 border-blue-500/25'
                                )}
                              >
                                {isExt ? 'Public' : 'Team'}
                              </span>
                              <span className="text-zinc-300 capitalize">
                                {share.permission || share.permissionLevel || 'view'}
                              </span>
                              {share.allowApproval && (
                                <span
                                  className={cn(
                                    'text-[10px] px-1.5 py-0.5 rounded border',
                                    share.approvalStatus === 'approved'
                                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                      : share.approvalStatus === 'declined'
                                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                  )}
                                >
                                  {share.approvalStatus === 'approved'
                                    ? `Approved${share.approvalActorName ? ` by ${share.approvalActorName}` : ''}`
                                    : share.approvalStatus === 'declined'
                                    ? `Declined${share.approvalActorName ? ` by ${share.approvalActorName}` : ''}`
                                    : 'Approval Pending'}
                                </span>
                              )}
                            </div>
                            {share.message && (
                              <p className="text-[11px] text-zinc-400 truncate max-w-[230px]">
                                Note: {share.message}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {fullUrl && (
                              <button
                                type="button"
                                onClick={() => handleCopy(fullUrl, share.id)}
                                title="Copy link"
                                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                              >
                                {copiedId === share.id ? (
                                  <Check size={12} className="text-emerald-400" />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={revokingId === share.id}
                              onClick={() => handleRevokeShare(share.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/25 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {revokingId === share.id ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <Trash2 size={11} />
                              )}
                              <span>Remove Sharing</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <form onSubmit={handleCreateShare} className="space-y-4 text-xs">
                {errorMsg && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Type Switcher */}
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShareType('public')}
                    className={cn(
                      'py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors cursor-pointer',
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
                      'py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors cursor-pointer',
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
                          ? 'bg-white/[0.04] text-white'
                          : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700'
                      )}
                      style={
                        permission === 'download'
                          ? { borderColor: accentColor, backgroundColor: `${accentColor}12` }
                          : undefined
                      }
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
                          ? 'bg-white/[0.04] text-white'
                          : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700'
                      )}
                      style={
                        permission === 'view'
                          ? { borderColor: accentColor, backgroundColor: `${accentColor}12` }
                          : undefined
                      }
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

                {/* Add Message / Note */}
                <div>
                  <label className="text-[11px] font-medium text-zinc-300 flex items-center gap-1.5 mb-1">
                    <MessageSquare size={12} className="text-zinc-400" />
                    <span>Message for Recipient (optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Add a note or instructions shown above the shared document..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 resize-none"
                  />
                </div>

                {/* Add Approve & Decline Button (PDF Only) */}
                <div
                  className={cn(
                    'p-3 rounded-xl border transition-colors',
                    !isPdf
                      ? 'bg-zinc-950/30 border-zinc-800/70 opacity-65'
                      : allowApproval
                      ? 'bg-emerald-500/10 border-emerald-500/35'
                      : 'bg-zinc-950/40 border-zinc-800'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2
                          size={14}
                          className={isPdf && allowApproval ? 'text-emerald-400' : 'text-zinc-400'}
                        />
                        <span className="text-xs font-semibold text-white">
                          Add Approve & Decline Buttons
                        </span>
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                          PDF Only
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        {isPdf
                          ? 'Anyone opening this PDF link can click Approve or Decline (with their name) and record sign-off in Approve Files.'
                          : 'Approval sign-off buttons are available exclusively for PDF files.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={!isPdf}
                      onClick={() => isPdf && setAllowApproval((v) => !v)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all shrink-0 border',
                        !isPdf
                          ? 'bg-zinc-800/60 border-zinc-700 text-zinc-500 cursor-not-allowed'
                          : allowApproval
                          ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-sm cursor-pointer'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700 cursor-pointer'
                      )}
                    >
                      {allowApproval ? 'Added' : '+ Add Approve'}
                    </button>
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
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-600"
                      />
                    )}
                  </div>
                )}

                {/* Submit Buttons */}
                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 cursor-pointer"
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
