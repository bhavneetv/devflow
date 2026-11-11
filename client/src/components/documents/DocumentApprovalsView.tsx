import React, { useState } from 'react';
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  Eye,
  Copy,
  Check,
  Trash2,
  MessageSquare,
  CalendarClock,
  UserCheck,
  FileText,
  Download,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { DocumentApprovalEntry, ProjectDocument } from '../../types/document';
import { useAccentTheme } from '../../services/accentTheme.service';
import { documentService } from '../../services/document.service';
import { cn } from '../../lib/utils';

interface DocumentApprovalsViewProps {
  projectId: number;
  approvals: DocumentApprovalEntry[];
  counts: { total: number; approved: number; declined: number; pending: number };
  isLoading: boolean;
  statusFilter: 'all' | 'approved' | 'declined' | 'pending';
  onStatusFilterChange: (status: 'all' | 'approved' | 'declined' | 'pending') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onPreviewDocument: (doc: ProjectDocument) => void;
  onRevokeShare: (entry: DocumentApprovalEntry) => void;
  onRefresh: () => void;
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
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

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const DocumentApprovalsView: React.FC<DocumentApprovalsViewProps> = ({
  projectId,
  approvals,
  counts,
  isLoading,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchChange,
  onPreviewDocument,
  onRevokeShare,
  onRefresh,
}) => {
  const { accentColor } = useAccentTheme();
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const filterTabs = [
    { id: 'all' as const, label: 'All', count: counts.total },
    { id: 'approved' as const, label: 'Approved', count: counts.approved },
    { id: 'declined' as const, label: 'Declined', count: counts.declined },
    { id: 'pending' as const, label: 'Pending', count: counts.pending },
  ];

  const handleCopy = async (entry: DocumentApprovalEntry) => {
    if (!entry.token) return;
    const url = `${window.location.origin}/share/documents/${entry.token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(entry.shareId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#0E0F14]/95 border border-[#27272A] rounded-2xl p-3 sm:p-4 shadow-xl">
        {/* Status Filter Pills with sliding pill */}
        <div className="flex items-center gap-1 p-1 bg-[#16171D] border border-[#27272A] rounded-xl overflow-x-auto">
          {filterTabs.map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onStatusFilterChange(tab.id)}
                className={cn(
                  'relative px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer z-10',
                  active ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                {active && (
                  <motion.div
                    layoutId="approvalFilterPill"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    className="absolute inset-0 rounded-lg border -z-10"
                    style={{
                      backgroundColor: `${accentColor}22`,
                      borderColor: `${accentColor}55`,
                    }}
                  />
                )}
                <span>{tab.label}</span>
                <span className="px-1.5 py-0.5 text-[10px] font-mono rounded-md bg-black/40 text-zinc-300">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search + Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search PDF or reviewer..."
              className="w-full h-9 pl-8 pr-3 rounded-xl bg-[#16171D] border border-[#27272A] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh approval statuses"
            className="h-9 px-3 rounded-xl bg-[#16171D] border border-[#27272A] hover:border-zinc-600 text-zinc-300 hover:text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Results List */}
      <div className="bg-[#0E0F14]/95 border border-[#27272A] rounded-2xl shadow-xl overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-[#16171D] border border-[#27272A] animate-pulse" />
            ))}
          </div>
        ) : approvals.length === 0 ? (
          <div className="py-16 px-6 text-center space-y-2">
            <div
              className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center border"
              style={{
                backgroundColor: `${accentColor}12`,
                borderColor: `${accentColor}30`,
                color: accentColor,
              }}
            >
              <FileCheck2 size={22} />
            </div>
            <h4 className="text-sm font-semibold text-white">No PDF approval entries yet</h4>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Share any PDF document with the &ldquo;Add Approve Button&rdquo; toggle enabled to track sign-offs, reviewer names, and timestamps here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#27272A]/70">
            {approvals.map((entry) => {
              const doc = entry.document;
              const status = entry.approvalStatus || 'pending';
              const isApproved = status === 'approved';
              const isDeclined = status === 'declined';

              return (
                <div
                  key={entry.shareId}
                  className="p-4 sm:p-5 hover:bg-white/[0.02] transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  {/* Left: File + Status + Messages */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                      <FileText size={18} />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => doc && onPreviewDocument(doc)}
                          className="text-[14px] font-semibold text-white hover:underline truncate text-left cursor-pointer"
                        >
                          {doc?.name || doc?.displayName || 'PDF Document'}
                        </button>
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                          PDF
                        </span>
                        {doc?.sizeBytes ? (
                          <span className="text-[11px] font-mono text-zinc-500">
                            {formatBytes(doc.sizeBytes)}
                          </span>
                        ) : null}

                        {/* Status Badge */}
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border',
                            isApproved
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : isDeclined
                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          )}
                        >
                          {isApproved ? (
                            <CheckCircle2 size={11} />
                          ) : isDeclined ? (
                            <XCircle size={11} />
                          ) : (
                            <Clock size={11} />
                          )}
                          {isApproved ? 'Approved' : isDeclined ? 'Declined' : 'Pending Review'}
                        </span>

                        {entry.isRevoked && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700">
                            Link Removed
                          </span>
                        )}
                      </div>

                      {/* Actor + Exact Date & Time */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                        <span className="inline-flex items-center gap-1.5">
                          <UserCheck size={13} className={isApproved ? 'text-emerald-400' : isDeclined ? 'text-rose-400' : 'text-zinc-500'} />
                          {entry.approvalActorName ? (
                            <span>
                              Done by <strong className="text-white font-medium">{entry.approvalActorName}</strong>
                            </span>
                          ) : (
                            <span className="text-zinc-500 italic">Waiting for reviewer response</span>
                          )}
                        </span>

                        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-zinc-400">
                          <CalendarClock size={13} className="text-zinc-500" />
                          {entry.approvalActedAt
                            ? `Responded ${formatDateTime(entry.approvalActedAt)}`
                            : `Shared ${formatDateTime(entry.createdAt)}`}
                        </span>
                      </div>

                      {/* Share Message & Reviewer Comment */}
                      {(entry.message || entry.approvalNote) && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {entry.message && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#16171D] border border-[#27272A] text-[11px] text-zinc-300">
                              <MessageSquare size={11} className="text-zinc-500 shrink-0" />
                              <span className="text-zinc-500">Share note:</span>
                              <span>{entry.message}</span>
                            </div>
                          )}
                          {entry.approvalNote && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-[#27272A] text-[11px] text-zinc-200">
                              <MessageSquare size={11} style={{ color: accentColor }} className="shrink-0" />
                              <span className="text-zinc-500">Reviewer note:</span>
                              <span>{entry.approvalNote}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                    {doc && (
                      <>
                        <button
                          type="button"
                          onClick={() => onPreviewDocument(doc)}
                          className="h-8 px-2.5 rounded-lg bg-[#16171D] border border-[#27272A] hover:border-zinc-600 text-xs text-zinc-300 hover:text-white inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Eye size={13} />
                          <span>Preview</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => documentService.downloadDocument(projectId, doc)}
                          title="Download PDF"
                          className="h-8 w-8 rounded-lg bg-[#16171D] border border-[#27272A] hover:border-zinc-600 text-zinc-300 hover:text-white inline-flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <Download size={13} />
                        </button>
                      </>
                    )}

                    {!entry.isRevoked && entry.token && (
                      <button
                        type="button"
                        onClick={() => handleCopy(entry)}
                        className="h-8 px-2.5 rounded-lg bg-[#16171D] border border-[#27272A] hover:border-zinc-600 text-xs text-zinc-300 hover:text-white inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        {copiedId === entry.shareId ? (
                          <>
                            <Check size={13} className="text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>
                    )}

                    {!entry.isRevoked && (
                      <button
                        type="button"
                        onClick={() => onRevokeShare(entry)}
                        className="h-8 px-2.5 rounded-lg bg-rose-500/10 border border-rose-500/25 hover:bg-rose-500/20 text-xs font-medium text-rose-300 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Trash2 size={13} />
                        <span>Remove Sharing</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

