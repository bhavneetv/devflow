import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FileText,
  Download,
  Lock,
  ShieldCheck,
  Calendar,
  User,
  HardDrive,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  MessageSquare,
  CalendarClock,
  Clock,
} from 'lucide-react';
import { documentService } from '../../services/document.service';
import { useAccentTheme } from '../../services/accentTheme.service';
import { PdfDocumentViewer } from '../../components/documents/PdfDocumentViewer';
import type { PublicShareInfo } from '../../types/document';
import { cn } from '../../lib/utils';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const PublicDocumentShareView: React.FC = () => {
  const { accentColor } = useAccentTheme();
  const { token } = useParams<{ token: string }>();
  const [shareInfo, setShareInfo] = useState<PublicShareInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Password challenge
  const [password, setPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Text preview
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoadingText, setIsLoadingText] = useState(false);

  // Approval workflow state (PDF Only)
  const [pendingDecision, setPendingDecision] = useState<'approved' | 'declined' | null>(null);
  const [reviewerName, setReviewerName] = useState('');
  const [reviewerNote, setReviewerNote] = useState('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid share link.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    documentService
      .getPublicShareInfo(token)
      .then((res) => {
        if (res.success && res.data) {
          setShareInfo(res.data);
          if (!res.data.requiresPassword) {
            setIsUnlocked(true);
          }
        } else {
          setError(res.error || 'This share link has expired or was revoked.');
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load shared document');
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  // Load preview when unlocked
  useEffect(() => {
    if (isUnlocked && token && shareInfo?.document) {
      const ext = shareInfo.document.fileExtension.toLowerCase().replace('.', '');
      const isText = ['txt', 'md', 'json', 'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'html', 'css', 'yaml', 'yml'].includes(ext);

      if (isText) {
        setIsLoadingText(true);
        fetch(documentService.getPublicContentUrl(token, false, password))
          .then((r) => r.text())
          .then((txt) => {
            setTextContent(txt);
            setIsLoadingText(false);
          })
          .catch(() => {
            setTextContent('Failed to load text preview');
            setIsLoadingText(false);
          });
      }
    }
  }, [isUnlocked, token, shareInfo, password]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !password) return;

    setIsVerifying(true);
    setPasswordError(null);

    try {
      const res = await documentService.verifyPublicSharePassword(token, password);
      if (res.success && res.data) {
        setShareInfo(res.data);
        setIsUnlocked(true);
      } else {
        setPasswordError(res.error || 'Incorrect password.');
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Verification error');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDownload = () => {
    if (!token) return;
    const url = documentService.getPublicContentUrl(token, true, password);
    window.open(url, '_blank');
  };

  const handleOpenDecision = (choice: 'approved' | 'declined') => {
    setPendingDecision(choice);
    setDecisionError(null);
  };

  const handleSubmitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !pendingDecision) return;

    const trimmedName = reviewerName.trim();
    if (trimmedName.length < 2) {
      setDecisionError('Please enter your full name (at least 2 characters).');
      return;
    }

    setIsSubmittingDecision(true);
    setDecisionError(null);
    try {
      const res = await documentService.respondToPublicShare(token, {
        decision: pendingDecision,
        actorName: trimmedName,
        note: reviewerNote.trim() || undefined,
        password: password || undefined,
      });

      if (res.success && res.data) {
        setShareInfo(res.data);
        setPendingDecision(null);
        setReviewerName('');
        setReviewerNote('');
      } else {
        setDecisionError(res.error || 'Failed to record response.');
      }
    } catch (err: any) {
      setDecisionError(err.message || 'Failed to record response.');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-x-hidden">
        <header className="border-b border-zinc-800 bg-zinc-900/80">
          <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 animate-pulse">
              <div className="w-6 h-6 rounded-lg bg-zinc-800" />
              <div className="h-4 w-20 rounded bg-zinc-800" />
              <div className="h-4 w-48 rounded bg-zinc-800/80" />
            </div>
            <div className="h-8 w-28 rounded-lg bg-zinc-800 animate-pulse" />
          </div>
        </header>
        <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6 animate-pulse">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-zinc-800" />
              <div className="space-y-2">
                <div className="h-4 w-56 rounded bg-zinc-800" />
                <div className="h-3 w-40 rounded bg-zinc-800/70" />
              </div>
            </div>
            <div className="h-7 w-36 rounded-md bg-zinc-800" />
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 h-[420px] flex flex-col gap-3">
            <div className="h-4 w-1/3 rounded bg-zinc-800" />
            <div className="h-4 w-2/3 rounded bg-zinc-800/70" />
            <div className="flex-1 rounded-lg bg-zinc-800/50 mt-2" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !shareInfo) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 overflow-x-hidden">
        <div className="max-w-md w-full p-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertTriangle size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">Document Unavailable</h3>
            <p className="text-xs text-zinc-400">
              {error || 'This link may have expired or was revoked by the document owner.'}
            </p>
          </div>
          <Link
            to="/login"
            className="inline-block px-4 py-2 rounded-lg text-xs font-semibold text-[#0A0B10] transition-all hover:brightness-110"
            style={{ backgroundColor: accentColor }}
          >
            Go to DevFlow
          </Link>
        </div>
      </div>
    );
  }

  // Password Gate
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 overflow-x-hidden">
        <div className="max-w-md w-full p-6 sm:p-8 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Lock size={20} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Protected Document</h3>
              <p className="text-xs text-zinc-400">Enter the access passphrase to view this document</p>
            </div>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-3.5 text-xs">
            {passwordError && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {passwordError}
              </div>
            )}

            <div>
              <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                Passphrase
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter passphrase"
                autoFocus
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                style={{ borderColor: password ? accentColor : undefined }}
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying || !password}
              className="w-full py-2.5 rounded-lg text-xs font-semibold text-[#0A0B10] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer"
              style={{ backgroundColor: accentColor }}
            >
              {isVerifying ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
              <span>Unlock Document</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  const doc = shareInfo.document!;
  const ext = doc.fileExtension.toLowerCase().replace('.', '');
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext);
  const isPdf = ext === 'pdf' || doc.mimeType?.toLowerCase().includes('pdf');
  const isMedia = ['mp4', 'mov', 'webm', 'mp3', 'wav'].includes(ext);
  const isCodeOrText = ['txt', 'md', 'json', 'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'html', 'css', 'yaml', 'yml'].includes(ext);
  const previewUrl = documentService.getPublicContentUrl(token!, false, password);
  const canDownload = shareInfo.permission === 'download';

  const canRespondApproval = Boolean(isPdf && shareInfo.allowApproval);
  const isApproved = shareInfo.approvalStatus === 'approved';
  const isDeclined = shareInfo.approvalStatus === 'declined';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-x-hidden">
      {/* Top Banner (aligned identically inside max-w-6xl container) */}
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md sticky top-0 z-30 w-full">
        <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 font-bold text-white tracking-tight text-sm shrink-0">
              <span
                className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-[#0A0B10]"
                style={{ backgroundColor: accentColor }}
              >
                DF
              </span>
              <span>DevFlow</span>
            </div>
            <span className="text-zinc-600 shrink-0">/</span>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-semibold text-white truncate max-w-[190px] sm:max-w-md">
                {doc.name}
              </h1>
              <p className="text-[11px] text-zinc-400 truncate">
                {doc.projectName} • {formatBytes(doc.sizeBytes)} • by {doc.uploaderName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canRespondApproval && !isApproved && !isDeclined && (
              <div className="hidden sm:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenDecision('declined')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 transition-colors cursor-pointer"
                >
                  <XCircle size={14} />
                  <span>Decline</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenDecision('approved')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 transition-colors cursor-pointer"
                >
                  <CheckCircle2 size={14} />
                  <span>Approve</span>
                </button>
              </div>
            )}

            {canDownload && (
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#0A0B10] transition-all shadow-sm hover:brightness-110 cursor-pointer"
                style={{ backgroundColor: accentColor }}
              >
                <Download size={14} />
                <span>Download File</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Preview Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Document Header Card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="p-3 rounded-xl border shrink-0"
              style={{
                backgroundColor: `${accentColor}15`,
                color: accentColor,
                borderColor: `${accentColor}30`,
              }}
            >
              <FileText size={24} />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-white truncate">{doc.name}</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {ext}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                <span className="flex items-center gap-1">
                  <User size={12} /> {doc.uploaderName}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <HardDrive size={12} /> {formatBytes(doc.sizeBytes)}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar size={12} /> {new Date(doc.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck size={13} />
              Verified DevFlow Storage
            </span>
          </div>
        </div>

        {/* Sender Note / Message Banner */}
        {shareInfo.message && (
          <div
            className="rounded-xl border p-4 flex items-start gap-3"
            style={{
              backgroundColor: `${accentColor}10`,
              borderColor: `${accentColor}35`,
            }}
          >
            <div
              className="p-2 rounded-lg shrink-0"
              style={{
                backgroundColor: `${accentColor}20`,
                color: accentColor,
              }}
            >
              <MessageSquare size={16} />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                Message from {shareInfo.sharedByName || doc.uploaderName}
              </div>
              <p className="text-xs sm:text-sm text-zinc-100 leading-relaxed whitespace-pre-wrap">
                {shareInfo.message}
              </p>
            </div>
          </div>
        )}

        {/* PDF Approval Banner & Interactive Actions (PDF Only) */}
        {canRespondApproval && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/75 p-4 sm:p-5 space-y-4">
            {isApproved || isDeclined ? (
              <div
                className={cn(
                  'rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3',
                  isApproved
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-rose-500/10 border-rose-500/30'
                )}
              >
                <div className="flex items-start gap-3">
                  {isApproved ? (
                    <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle size={20} className="text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          'text-sm font-semibold',
                          isApproved ? 'text-emerald-300' : 'text-rose-300'
                        )}
                      >
                        Document {isApproved ? 'Approved' : 'Declined'}
                      </span>
                      {shareInfo.approvalActorName && (
                        <span className="text-xs text-zinc-200">
                          by <strong>{shareInfo.approvalActorName}</strong>
                        </span>
                      )}
                    </div>
                    {shareInfo.approvalActedAt && (
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
                        <CalendarClock size={12} />
                        <span>Recorded on {formatDateTime(shareInfo.approvalActedAt)}</span>
                      </div>
                    )}
                    {shareInfo.approvalNote && (
                      <p className="text-xs text-zinc-300 pt-1">
                        Comment: {shareInfo.approvalNote}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 shrink-0">
                    <Clock size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Document Approval Requested</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Review this PDF below and submit your approval or decline decision with your name.
                    </p>
                  </div>
                </div>

                {!pendingDecision && (
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenDecision('declined')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 transition-colors cursor-pointer"
                    >
                      <XCircle size={15} />
                      <span>Decline</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDecision('approved')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 transition-colors shadow-sm cursor-pointer"
                    >
                      <CheckCircle2 size={15} />
                      <span>Approve PDF</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Name Prompt Form on Approve/Decline Click */}
            {pendingDecision && !isApproved && !isDeclined && (
              <form
                onSubmit={handleSubmitDecision}
                className={cn(
                  'p-4 rounded-xl border space-y-3',
                  pendingDecision === 'approved'
                    ? 'bg-emerald-500/5 border-emerald-500/25'
                    : 'bg-rose-500/5 border-rose-500/25'
                )}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-white flex items-center gap-2">
                    {pendingDecision === 'approved' ? (
                      <CheckCircle2 size={15} className="text-emerald-400" />
                    ) : (
                      <XCircle size={15} className="text-rose-400" />
                    )}
                    <span>
                      {pendingDecision === 'approved'
                        ? 'Enter your name to approve this PDF'
                        : 'Enter your name to decline this PDF'}
                    </span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setPendingDecision(null)}
                    className="text-[11px] text-zinc-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                {decisionError && (
                  <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
                    {decisionError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                      Your Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={reviewerName}
                      onChange={(e) => setReviewerName(e.target.value)}
                      placeholder="e.g. Alex Johnson"
                      required
                      autoFocus
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                      Note / Comment (optional)
                    </label>
                    <input
                      type="text"
                      value={reviewerNote}
                      onChange={(e) => setReviewerNote(e.target.value)}
                      placeholder={
                        pendingDecision === 'approved'
                          ? 'Optional approval remarks...'
                          : 'Optional reason for declining...'
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingDecision(null)}
                    className="px-3.5 py-2 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingDecision}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50',
                      pendingDecision === 'approved'
                        ? 'bg-emerald-400 hover:bg-emerald-300 text-zinc-950'
                        : 'bg-rose-500 hover:bg-rose-400 text-white'
                    )}
                  >
                    {isSubmittingDecision ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : pendingDecision === 'approved' ? (
                      <CheckCircle2 size={13} />
                    ) : (
                      <XCircle size={13} />
                    )}
                    <span>
                      {pendingDecision === 'approved' ? 'Confirm Approval' : 'Confirm Decline'}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Live Content Display */}
        <div className={cn('rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden', isPdf ? 'p-0' : 'p-4')}>
          {isImage && (
            <div className="flex items-center justify-center p-4 bg-zinc-950/80 rounded-lg">
              <img
                src={previewUrl}
                alt={doc.name}
                className="max-h-[700px] w-auto object-contain rounded-md shadow-lg"
              />
            </div>
          )}

          {isPdf && (
            <PdfDocumentViewer
              url={previewUrl}
              title={doc.name}
              inlineHeightClassName="h-[min(82vh,880px)] min-h-[560px]"
              extraToolbarActions={
                <>
                  {canRespondApproval && !isApproved && !isDeclined && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenDecision('declined')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 transition-colors cursor-pointer"
                      >
                        <XCircle size={12} />
                        <span>Decline</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDecision('approved')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 transition-colors cursor-pointer"
                      >
                        <CheckCircle2 size={12} />
                        <span>Approve</span>
                      </button>
                    </>
                  )}
                  {canDownload && (
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#0A0B10] transition-all hover:brightness-110 cursor-pointer"
                      style={{ backgroundColor: accentColor }}
                    >
                      <Download size={12} />
                      <span>Download</span>
                    </button>
                  )}
                </>
              }
            />
          )}

          {isCodeOrText && (
            <div className="w-full flex flex-col rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden">
              <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900/60 text-xs font-mono text-zinc-400 flex items-center justify-between">
                <span>{doc.name}</span>
                <span>{textContent ? `${textContent.split('\n').length} lines` : ''}</span>
              </div>
              <div className="p-4 overflow-auto max-h-[700px] font-mono text-xs text-zinc-300 leading-relaxed whitespace-pre">
                {isLoadingText ? (
                  <div className="space-y-2.5 py-4 animate-pulse">
                    <div className="h-3.5 w-3/4 rounded bg-zinc-800/80" />
                    <div className="h-3.5 w-5/6 rounded bg-zinc-800/60" />
                    <div className="h-3.5 w-2/3 rounded bg-zinc-800/70" />
                    <div className="h-3.5 w-4/5 rounded bg-zinc-800/50" />
                    <div className="h-3.5 w-1/2 rounded bg-zinc-800/60" />
                  </div>
                ) : (
                  textContent || 'Empty document'
                )}
              </div>
            </div>
          )}

          {isMedia && (
            <div className="flex flex-col items-center justify-center p-8 bg-zinc-950 rounded-lg">
              {ext.includes('mp4') || ext.includes('mov') || ext.includes('webm') ? (
                <video controls src={previewUrl} className="max-h-[500px] rounded-lg" />
              ) : (
                <audio controls src={previewUrl} className="w-full max-w-md" />
              )}
            </div>
          )}

          {!isImage && !isPdf && !isCodeOrText && !isMedia && (
            <div className="py-16 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 mx-auto">
                <FileText size={32} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">{doc.name}</h4>
                <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                  Direct browser preview is not supported for this file format ({ext.toUpperCase()}). Use the download button above to inspect it.
                </p>
              </div>
              {canDownload && (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-[#0A0B10] transition-all shadow-sm hover:brightness-110 cursor-pointer"
                  style={{ backgroundColor: accentColor }}
                >
                  <Download size={14} />
                  <span>Download {formatBytes(doc.sizeBytes)}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-zinc-800/80 py-4 text-center text-xs text-zinc-500">
        DevFlow Document Storage • Stored securely in dedicated private repository
      </footer>
    </div>
  );
};
