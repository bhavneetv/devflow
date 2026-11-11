import React, { useState } from 'react';
import {
  FileText,
  Share2,
  Clock,
  ArrowRight,
  FileCode,
  Image as ImageIcon,
  Archive,
  Film,
  Copy,
  Check,
  Globe,
  Users,
} from 'lucide-react';
import type { DocumentDashboardData, ProjectDocument } from '../../types/document';
import { formatDistanceToNow } from '../../lib/dateUtils';
import { cn } from '../../lib/utils';

interface DocumentsDashboardProps {
  projectId: number;
  data: DocumentDashboardData;
  onSelectDocument: (doc: ProjectDocument) => void;
  onUploadClick: () => void;
  onNewCategoryClick: () => void;
  onSettingsClick: () => void;
  onViewAllClick: () => void;
  onRefresh: () => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(ext: string) {
  const e = (ext || '').toLowerCase().replace('.', '');
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(e)) return ImageIcon;
  if (['ts', 'tsx', 'js', 'jsx', 'json', 'py', 'go', 'rs', 'html', 'css'].includes(e)) return FileCode;
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(e)) return Archive;
  if (['mp4', 'mov', 'webm', 'mp3', 'wav'].includes(e)) return Film;
  return FileText;
}

// Circular Ring/Pie chart matching Project Overview styling
const StorageRing: React.FC<{
  usedPct: number;
  size?: number;
  stroke?: number;
  color?: string;
}> = ({ usedPct, size = 64, stroke = 7, color = '#3B82F6' }) => {
  const clampedPct = Math.min(100, Math.max(0, usedPct));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (clampedPct / 100) * c;

  return (
    <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#27272A" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-bold font-mono text-white">
          {clampedPct}%
        </span>
      </div>
    </div>
  );
};

export const DocumentsDashboard: React.FC<DocumentsDashboardProps> = ({
  projectId: _projectId,
  data,
  onSelectDocument,
  onUploadClick: _onUploadClick,
  onNewCategoryClick: _onNewCategoryClick,
  onSettingsClick: _onSettingsClick,
  onViewAllClick,
  onRefresh: _onRefresh,
}) => {
  const { metrics, recentDocuments, recentFiles, recentShares } = data;
  const [copiedShareId, setCopiedShareId] = useState<number | null>(null);

  // Storage calculation
  const totalSizeBytes = metrics.totalSize || metrics.totalSizeBytes || 0;
  const maxQuotaBytes = 26214400; // 25 MB default limit
  const remainingBytes = Math.max(0, maxQuotaBytes - totalSizeBytes);
  const usedPct = Math.min(100, Math.round((totalSizeBytes / maxQuotaBytes) * 100));

  const totalDocsCount = metrics.totalDocuments || metrics.totalFiles || 0;
  const activeSharesCount = metrics.activeShares || 0;
  const filesList = recentFiles || recentDocuments || [];

  const handleCopyShare = async (share: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const token = share.tokenHash;
    const url = token ? `${window.location.origin}/share/documents/${token}` : window.location.href;
    await navigator.clipboard.writeText(url);
    setCopiedShareId(share.id);
    setTimeout(() => setCopiedShareId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* ─── 3 Project-Overview Style Summary Cards ───────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Documents */}
        <div
          onClick={onViewAllClick}
          className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 shadow-xl flex flex-col justify-between cursor-pointer hover:border-[#3B82F6]/50 transition-all group"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Total Documents
              </div>
              <div className="text-3xl font-bold font-mono text-white tracking-tight mt-1.5 group-hover:text-blue-400 transition-colors">
                {totalDocsCount}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
              <FileText size={20} />
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-[#27272A]/70 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Tracked in DevFlow & GitHub</span>
            <span className="text-blue-400 group-hover:underline flex items-center gap-1 font-medium">
              View all <ArrowRight size={11} />
            </span>
          </div>
        </div>

        {/* Card 2: Storage Used & Remaining (Both in one with pie chart) */}
        <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Storage (Used & Remaining)
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold font-mono text-white">
                    {formatBytes(totalSizeBytes)}
                  </span>
                  <span className="text-[11px] font-medium text-blue-400 font-mono">
                    used
                  </span>
                </div>
                <div className="flex items-baseline gap-2 text-zinc-400 text-xs">
                  <span className="font-mono font-medium text-zinc-300">
                    {formatBytes(remainingBytes)}
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    remaining
                  </span>
                </div>
              </div>
            </div>

            {/* Circular Pie Ring Chart */}
            <div className="pt-1">
              <StorageRing usedPct={usedPct} color={usedPct > 90 ? '#EF4444' : '#3B82F6'} />
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-[#27272A]/70 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Quota limit: {formatBytes(maxQuotaBytes)}</span>
            <span className="font-mono text-zinc-400">
              {usedPct}% capacity
            </span>
          </div>
        </div>

        {/* Card 3: Total Shared */}
        <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Total Shared
              </div>
              <div className="text-3xl font-bold font-mono text-white tracking-tight mt-1.5">
                {activeSharesCount}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
              <Share2 size={20} />
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-[#27272A]/70 flex items-center justify-between text-[11px] text-zinc-500">
            <span>
              {metrics.externalShares || 0} external · {metrics.internalShares || 0} internal
            </span>
            <span className="text-purple-400 font-mono font-medium">
              Active links
            </span>
          </div>
        </div>
      </div>

      {/* ─── Two Panels Below: Recent Files & Recent Share Links ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Panel 1: Recent Files */}
        <section className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 shadow-xl flex flex-col min-w-0">
          <header className="flex items-center justify-between pb-3 mb-3 border-b border-[#27272A]/70">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Clock size={16} />
              </div>
              <div>
                <h3 className="font-semibold text-[14px] text-white tracking-tight">Recent Files</h3>
                <p className="text-[11px] text-zinc-500">Recently uploaded and modified documents</p>
              </div>
            </div>
            <button
              onClick={onViewAllClick}
              className="text-[11px] text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>View all</span>
              <ArrowRight size={12} />
            </button>
          </header>

          {filesList && filesList.length > 0 ? (
            <div className="divide-y divide-[#27272A]/50">
              {filesList.slice(0, 6).map((doc) => {
                const Icon = getFileIcon(doc.fileExtension || doc.extension || '');
                return (
                  <div
                    key={doc.id}
                    onClick={() => onSelectDocument(doc)}
                    className="py-2.5 px-2 flex items-center justify-between gap-3 group cursor-pointer hover:bg-white/[0.03] rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-300 group-hover:text-blue-400 group-hover:border-blue-500/30 transition-colors shrink-0">
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-zinc-200 group-hover:text-white truncate">
                            {doc.name || doc.displayName}
                          </span>
                          {doc.category && (
                            <span
                              className="text-[10px] px-1.5 py-0.2 rounded font-medium truncate shrink-0"
                              style={{
                                backgroundColor: `${doc.category.color || '#3b82f6'}20`,
                                color: doc.category.color || '#60a5fa',
                              }}
                            >
                              {doc.category.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                          <span className="font-mono">{formatBytes(doc.sizeBytes)}</span>
                          <span>•</span>
                          <span>
                            {doc.updatedAt
                              ? formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })
                              : 'Recently'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-zinc-400 uppercase px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/60">
                        {(doc.fileExtension || doc.extension || '').replace('.', '')}
                      </span>
                      <ArrowRight size={13} className="text-zinc-500 group-hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-1.5">
              <FileText size={24} className="text-zinc-600" />
              <span>No documents uploaded yet.</span>
            </div>
          )}
        </section>

        {/* Panel 2: Recent Share Links */}
        <section className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 shadow-xl flex flex-col min-w-0">
          <header className="flex items-center justify-between pb-3 mb-3 border-b border-[#27272A]/70">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Share2 size={16} />
              </div>
              <div>
                <h3 className="font-semibold text-[14px] text-white tracking-tight">Recent Share Links</h3>
                <p className="text-[11px] text-zinc-500">Active public links and internal collaborations</p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
              {recentShares?.length || 0} Active
            </span>
          </header>

          {recentShares && recentShares.length > 0 ? (
            <div className="divide-y divide-[#27272A]/50">
              {recentShares.slice(0, 6).map((share: any) => {
                const isExternal = share.shareType === 'external_link' || share.shareType === 'public';
                const isCopied = copiedShareId === share.id;

                return (
                  <div
                    key={share.id}
                    className="py-2.5 px-2 flex items-center justify-between gap-3 group hover:bg-white/[0.03] rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "w-8 h-8 rounded-lg border flex items-center justify-center shrink-0",
                        isExternal
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                      )}>
                        {isExternal ? <Globe size={15} /> : <Users size={15} />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-zinc-200 group-hover:text-white truncate">
                            {share.document?.displayName || share.document?.name || 'Shared Document'}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] px-1.5 py-0.2 rounded font-medium shrink-0 border",
                              isExternal
                                ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                                : "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
                            )}
                          >
                            {isExternal ? 'Public' : 'Team'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                          <span className="capitalize">{share.permissionLevel || 'view'} access</span>
                          <span>•</span>
                          <span>
                            {share.expiresAt
                              ? `Expires ${new Date(share.expiresAt).toLocaleDateString()}`
                              : 'No expiration'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isExternal && (
                        <button
                          onClick={(e) => handleCopyShare(share, e)}
                          title="Copy share link"
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                        >
                          {isCopied ? (
                            <Check size={14} className="text-emerald-400" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-1.5">
              <Share2 size={24} className="text-zinc-600" />
              <span>No shared links generated yet.</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
