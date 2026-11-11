import React from 'react';
import {
  FileText,
  Share2,
  ArrowRight,
  Image as ImageIcon,
  Video,
  FileCode2,
} from 'lucide-react';
import type { DocumentDashboardData, ProjectDocument } from '../../types/document';
import { useAccentTheme } from '../../services/accentTheme.service';

interface DocumentsDashboardProps {
  projectId: number;
  data: DocumentDashboardData;
  onSelectDocument?: (doc: ProjectDocument) => void;
  onUploadClick?: () => void;
  onNewCategoryClick?: () => void;
  onSettingsClick?: () => void;
  onViewAllClick: () => void;
  onRefresh?: () => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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
  const displayLabel =
    clampedPct === 0
      ? '0%'
      : clampedPct < 0.1
      ? '<0.1%'
      : clampedPct < 10
      ? `${Number(clampedPct.toFixed(1))}%`
      : `${Math.round(clampedPct)}%`;

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
          {displayLabel}
        </span>
      </div>
    </div>
  );
};

export const DocumentsDashboard: React.FC<DocumentsDashboardProps> = ({
  projectId: _projectId,
  data,
  onSelectDocument: _onSelectDocument,
  onUploadClick: _onUploadClick,
  onNewCategoryClick: _onNewCategoryClick,
  onSettingsClick: _onSettingsClick,
  onViewAllClick,
  onRefresh: _onRefresh,
}) => {
  const { accentColor } = useAccentTheme();
  const { metrics } = data;

  // Storage calculation (combined across all modules & branches, GitHub limit: 2 GB)
  const totalSizeBytes = metrics.repoTotalSizeBytes ?? metrics.totalSizeBytes ?? metrics.totalSize ?? 0;
  const moduleSizeBytes = metrics.moduleSizeBytes;
  const isScopedSubset = moduleSizeBytes !== undefined && moduleSizeBytes !== totalSizeBytes;
  const maxQuotaBytes = metrics.configuredLimitBytes || 2 * 1024 * 1024 * 1024; // 2 GB per repository
  const remainingBytes = Math.max(0, maxQuotaBytes - totalSizeBytes);
  const exactUsedPct = maxQuotaBytes > 0 ? Math.min(100, (totalSizeBytes / maxQuotaBytes) * 100) : 0;
  const usedPct = Math.round(exactUsedPct);
  const formattedUsedPct =
    totalSizeBytes > 0 && exactUsedPct < 0.1 ? '< 0.1' : exactUsedPct.toFixed(1).replace(/\.0$/, '');

  const totalDocsCount = metrics.totalDocuments || metrics.totalFiles || 0;
  const imagesCount = metrics.imagesCount ?? 0;
  const videosCount = metrics.videosCount ?? 0;
  const documentsCount = metrics.documentsCount ?? 0;
  const othersCount =
    metrics.othersCount ??
    Math.max(0, totalDocsCount - imagesCount - videosCount - documentsCount);
  const activeSharesCount = metrics.activeShares || 0;

  return (
    <div className="space-y-4">
      {/* ─── 3 Project-Overview Style Summary Cards ───────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Documents + Type Breakdown */}
        <div
          onClick={onViewAllClick}
          className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 shadow-xl flex flex-col justify-between cursor-pointer transition-all group"
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = `${accentColor}80`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '';
          }}
        >
          <div>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  Total Documents
                </div>
                <div className="text-3xl font-bold font-mono text-white tracking-tight mt-1 transition-colors">
                  {totalDocsCount}
                </div>
              </div>
              <div
                className="p-2.5 rounded-xl border shrink-0"
                style={{
                  backgroundColor: `${accentColor}15`,
                  color: accentColor,
                  borderColor: `${accentColor}35`,
                }}
              >
                <FileText size={20} />
              </div>
            </div>

            {/* Type Breakdown Strip inside Card 1 */}
            <div className="grid grid-cols-4 gap-1.5 mt-3">
              <div className="rounded-lg bg-[#14161D] border border-[#232632] px-2 py-1.5 flex items-center justify-between gap-1">
                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 font-medium truncate">
                  <ImageIcon size={11} className="text-sky-400 shrink-0" />
                  Img
                </span>
                <span className="text-[11px] font-mono font-semibold text-white">{imagesCount}</span>
              </div>
              <div className="rounded-lg bg-[#14161D] border border-[#232632] px-2 py-1.5 flex items-center justify-between gap-1">
                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 font-medium truncate">
                  <Video size={11} className="text-purple-400 shrink-0" />
                  Video
                </span>
                <span className="text-[11px] font-mono font-semibold text-white">{videosCount}</span>
              </div>
              <div className="rounded-lg bg-[#14161D] border border-[#232632] px-2 py-1.5 flex items-center justify-between gap-1">
                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 font-medium truncate">
                  <FileText size={11} className="text-emerald-400 shrink-0" />
                  Doc
                </span>
                <span className="text-[11px] font-mono font-semibold text-white">{documentsCount}</span>
              </div>
              <div className="rounded-lg bg-[#14161D] border border-[#232632] px-2 py-1.5 flex items-center justify-between gap-1">
                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 font-medium truncate">
                  <FileCode2 size={11} className="text-amber-400 shrink-0" />
                  Other
                </span>
                <span className="text-[11px] font-mono font-semibold text-white">{othersCount}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-[#27272A]/70 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Tracked in DevFlow & GitHub</span>
            <span className="group-hover:underline flex items-center gap-1 font-medium" style={{ color: accentColor }}>
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
                  <span className="text-[11px] font-medium font-mono" style={{ color: accentColor }}>
                    used {isScopedSubset ? '· combined' : ''}
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
              <StorageRing usedPct={exactUsedPct} color={usedPct > 90 ? '#EF4444' : accentColor} />
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-[#27272A]/70 flex items-center justify-between text-[11px] text-zinc-500">
            <span>
              {isScopedSubset
                ? `This module: ${formatBytes(moduleSizeBytes || 0)}`
                : `Repo limit: ${formatBytes(maxQuotaBytes)}`}
            </span>
            <span className="font-mono text-zinc-400">
              {formattedUsedPct}% capacity
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
    </div>
  );
};
