import React, { useMemo } from 'react';
import { Clock, X, Download, Calendar } from 'lucide-react';
import { WhiteboardAuditLogEntry } from './whiteboard.types';
import { useAccentTheme } from '../../services/accentTheme.service';
import { cn } from '../../lib/utils';

export interface WhiteboardHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardTitle: string;
  history: WhiteboardAuditLogEntry[];
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function getActionBadge(action: WhiteboardAuditLogEntry['action']): {
  className: string;
  label: string;
} {
  switch (action) {
    case 'created':
      return {
        className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        label: 'Created',
      };
    case 'template_applied':
      return {
        className: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        label: 'Template',
      };
    case 'renamed':
      return {
        className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        label: 'Renamed',
      };
    case 'duplicated':
      return {
        className: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        label: 'Duplicated',
      };
    case 'guest_edit':
      return {
        className: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        label: 'Guest Edit',
      };
    case 'cleared':
      return {
        className: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        label: 'Cleared',
      };
    case 'modified':
    default:
      return {
        className: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
        label: 'Modified',
      };
  }
}

export const WhiteboardHistoryModal: React.FC<WhiteboardHistoryModalProps> = ({
  isOpen,
  onClose,
  boardTitle,
  history,
}) => {
  const { accentColor } = useAccentTheme();

  const stats = useMemo(() => {
    const uniqueUsers = new Set(history.map((h) => h.userName || 'Anonymous')).size;
    const latestCount = history[0]?.elementCount ?? 0;
    return {
      totalChanges: history.length,
      uniqueUsers,
      latestCount,
    };
  }, [history]);

  if (!isOpen) return null;

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(history, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${boardTitle.toLowerCase().replace(/\s+/g, '-')}-history.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[82vh] bg-[#121316] border border-[#27272A] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#27272A] bg-[#16171D]">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#27272A]"
              style={{ backgroundColor: `${accentColor}18` }}
            >
              <Clock size={15} style={{ color: accentColor }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight">
                Activity History
              </h3>
              <p className="text-[11px] text-zinc-400 truncate max-w-[280px]">
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

        {/* ─── Compact Stats Strip ───────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#27272A]/70 bg-[#0E0F14]/70 text-xs">
          <div className="flex items-center gap-3 text-[11px] text-zinc-400">
            <span>
              <strong className="text-zinc-200 font-semibold">{stats.totalChanges}</strong> revisions
            </span>
            <span className="text-zinc-600">·</span>
            <span>
              <strong className="text-zinc-200 font-semibold">{stats.uniqueUsers}</strong> contributors
            </span>
            <span className="text-zinc-600">·</span>
            <span>
              <strong className="text-zinc-200 font-semibold">{stats.latestCount}</strong> elements
            </span>
          </div>
        </div>

        {/* ─── Timeline Feed ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-3 divide-y divide-[#27272A]/40">
          {history.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <Clock size={24} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs font-medium">No activity recorded yet.</p>
            </div>
          ) : (
            history.map((item, idx) => {
              const badge = getActionBadge(item.action);
              const initials = (item.userName || 'U')
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

              return (
                <div key={item.id || idx} className="py-2.5 first:pt-1 last:pb-1 flex items-start gap-3">
                  {/* User Avatar */}
                  <div className="relative shrink-0 mt-0.5">
                    {item.userAvatar ? (
                      <img
                        src={item.userAvatar}
                        alt={item.userName}
                        className="w-7 h-7 rounded-full object-cover border border-[#27272A]"
                      />
                    ) : (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white border border-white/10"
                        style={{
                          backgroundColor: item.userColor || accentColor || '#6366F1',
                        }}
                      >
                        {initials}
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-zinc-200">
                          {item.userName}
                        </span>
                        <span
                          className={cn(
                            'px-1.5 py-0.2 rounded text-[9px] font-medium border',
                            badge.className
                          )}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <span
                        className="text-[10px] text-zinc-500 shrink-0 flex items-center gap-1 font-mono"
                        title={new Date(item.timestamp).toLocaleString()}
                      >
                        {formatRelativeTime(item.timestamp)}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400 mt-0.5 leading-snug">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ─── Footer Controls ───────────────────────────────────────────── */}
        <div className="px-5 py-3 border-t border-[#27272A] bg-[#16171D] flex items-center justify-between">
          <button
            type="button"
            onClick={handleExportJson}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer transition-colors"
            title="Download activity log as JSON"
          >
            <Download size={13} />
            <span>Export Log</span>
          </button>

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
