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
  Check,
  Eye,
  FileCode,
  Image as ImageIcon,
  Film,
} from 'lucide-react';
import { documentService } from '../../services/document.service';
import { useAccentTheme } from '../../services/accentTheme.service';
import type { PublicShareInfo } from '../../types/document';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
        <header className="border-b border-zinc-800 bg-zinc-900/80 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 animate-pulse">
            <div className="w-6 h-6 rounded-lg bg-zinc-800" />
            <div className="h-4 w-20 rounded bg-zinc-800" />
            <div className="h-4 w-48 rounded bg-zinc-800/80" />
          </div>
          <div className="h-8 w-28 rounded-lg bg-zinc-800 animate-pulse" />
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
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
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
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
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
  const isPdf = ext === 'pdf';
  const isMedia = ['mp4', 'mov', 'webm', 'mp3', 'wav'].includes(ext);
  const isCodeOrText = ['txt', 'md', 'json', 'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'html', 'css', 'yaml', 'yml'].includes(ext);
  const previewUrl = documentService.getPublicContentUrl(token!, false, password);
  const canDownload = shareInfo.permission === 'download';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top Banner */}
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-30">
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
          <span className="text-zinc-600">/</span>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-semibold text-white truncate max-w-sm sm:max-w-md">
              {doc.name}
            </h1>
            <p className="text-[11px] text-zinc-400 truncate">
              {doc.projectName} • {formatBytes(doc.sizeBytes)} • by {doc.uploaderName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canDownload && (
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#0A0B10] transition-all shadow-sm hover:brightness-110 cursor-pointer"
              style={{ backgroundColor: accentColor }}
            >
              <Download size={14} />
              <span>Download File</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Preview Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Document Header Card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
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
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{doc.name}</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
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

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck size={13} />
              Verified DevFlow Storage
            </span>
          </div>
        </div>

        {/* Live Content Display */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 overflow-hidden">
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
            <div className="w-full h-[750px] rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950">
              <iframe
                src={previewUrl}
                title={doc.name}
                className="w-full h-full border-0"
              />
            </div>
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

