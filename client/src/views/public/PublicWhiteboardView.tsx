import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  PenTool,
  ShieldAlert,
  Globe,
  Maximize2,
  Minimize2,
  Lock,
  Edit3,
  Eye,
  ArrowLeft,
} from 'lucide-react';
import { WhiteboardCanvas } from '../../components/whiteboard/WhiteboardCanvas';
import {
  getShareConfig,
  recordBoardAuditLog,
} from '../../components/whiteboard/whiteboard.storage';
import { WhiteboardShareConfig } from '../../components/whiteboard/whiteboard.types';
import { useAccentTheme } from '../../services/accentTheme.service';
import { cn } from '../../lib/utils';

export const PublicWhiteboardView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { accentColor } = useAccentTheme();

  const [shareConfig, setShareConfig] = useState<WhiteboardShareConfig | null>(() =>
    token ? getShareConfig(token) : null
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lastSaveTimeRef = useRef<number>(0);

  useEffect(() => {
    if (token) {
      const cfg = getShareConfig(token);
      setShareConfig(cfg);
    }
  }, [token]);

  // Keyboard shortcut to toggle / exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Log guest editor modifications debounced
  const handleGuestSaveContent = (elements: any[]) => {
    if (!shareConfig || shareConfig.permission !== 'edit') return;
    const now = Date.now();
    // Debounce audit log entry every 15 seconds so we don't spam on every stroke
    if (now - lastSaveTimeRef.current > 15000) {
      lastSaveTimeRef.current = now;
      recordBoardAuditLog(
        shareConfig.projectId,
        shareConfig.scopeKey,
        shareConfig.boardId,
        {
          userName: 'Guest Collaborator',
          userColor: '#F97316',
          action: 'guest_edit',
          description: `Edited whiteboard elements via public link (${elements.length} total)`,
          elementCount: elements.length,
        }
      );
    }
  };

  // If share token is invalid or board doesn't exist
  if (!shareConfig) {
    return (
      <div className="min-h-screen w-full bg-[#08090B] flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4 shadow-xl">
          <ShieldAlert size={28} />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">
          Whiteboard Not Found or Link Expired
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-md mb-6 leading-relaxed">
          The public whiteboard link you followed does not exist or may have been revoked by the project owner.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-lg transition-transform active:scale-95 cursor-pointer"
          style={{ backgroundColor: accentColor }}
        >
          <ArrowLeft size={14} />
          <span>Go to DevFlow Home</span>
        </Link>
      </div>
    );
  }

  const isReadOnly = shareConfig.permission === 'view';

  return (
    <div
      className={cn(
        'w-screen h-screen flex flex-col bg-[#0A0B0E] overflow-hidden select-none',
        isFullscreen ? 'fixed inset-0 z-50' : 'relative'
      )}
    >
      {/* ─── Public Top Header ──────────────────────────────────────────────── */}
      <header className="h-11 px-3 sm:px-4 border-b border-[#27272A]/70 bg-[#0E0F14]/95 backdrop-blur-md flex items-center justify-between z-30 shrink-0 gap-3">
        {/* Left: Branding & Board Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#16171E] border border-[#27272A] shrink-0 text-zinc-300">
            <PenTool size={13} style={{ color: accentColor }} />
            <span className="text-[11px] font-bold tracking-wide uppercase text-zinc-300">
              DevFlow
            </span>
          </div>

          <div className="w-[1px] h-4 bg-zinc-800 shrink-0 hidden xs:block" />

          <h2 className="text-xs sm:text-sm font-semibold text-white truncate max-w-[140px] sm:max-w-xs md:max-w-md">
            {shareConfig.boardTitle || 'Shared Whiteboard'}
          </h2>
        </div>

        {/* Right: Permission Status & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Permission Mode Pill */}
          {isReadOnly ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[11px] font-medium">
              <Eye size={12} />
              <span className="hidden xs:inline">Public View Only</span>
              <span className="inline xs:hidden">View</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">
              <Edit3 size={12} />
              <span className="hidden xs:inline">Public Live Editor</span>
              <span className="inline xs:hidden">Edit</span>
            </div>
          )}

          {/* Fullscreen Button */}
          {isFullscreen ? (
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="flex items-center gap-1 h-7 px-2 rounded-lg bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700 text-xs cursor-pointer transition-colors"
              title="Exit Fullscreen (Esc)"
            >
              <Minimize2 size={13} style={{ color: accentColor }} />
              <span className="text-[11px] font-semibold hidden sm:inline">Minimize</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="flex items-center gap-1 h-7 px-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs cursor-pointer transition-colors"
              title="Toggle Fullscreen"
            >
              <Maximize2 size={13} />
              <span className="text-[11px] hidden sm:inline">Fullscreen</span>
            </button>
          )}
        </div>
      </header>

      {/* ─── Whiteboard Canvas ──────────────────────────────────────────────── */}
      <div className="flex-1 relative w-full h-full overflow-hidden">
        <WhiteboardCanvas
          key={`shared_${shareConfig.projectId}_${shareConfig.scopeKey}_${shareConfig.boardId}`}
          projectId={shareConfig.projectId}
          scopeKey={shareConfig.scopeKey}
          boardId={shareConfig.boardId}
          readOnly={isReadOnly}
          onSaveContent={handleGuestSaveContent}
        />
      </div>
    </div>
  );
};

