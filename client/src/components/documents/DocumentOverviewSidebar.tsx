import React from 'react';
import { motion } from 'framer-motion';
import {
  UploadCloud,
  FolderPlus,
  FileCheck2,
  Settings,
  User,
  GitBranch,
  Folder,
  Lock,
  Globe,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import type { DocumentDashboardData } from '../../types/document';
import { useAccentTheme } from '../../services/accentTheme.service';

interface DocumentOverviewSidebarProps {
  data: DocumentDashboardData;
  onUploadClick: () => void;
  onNewFolderClick: () => void;
  onApprovalsClick: () => void;
  onSettingsClick: () => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const DocumentOverviewSidebar: React.FC<DocumentOverviewSidebarProps> = ({
  data,
  onUploadClick,
  onNewFolderClick,
  onApprovalsClick,
  onSettingsClick,
}) => {
  const { accentColor } = useAccentTheme();
  const { metrics, storageNotice, projectMeta, fileTypeDistribution } = data;

  const projectTitle = projectMeta?.title || 'Project Documents';
  const initials = projectTitle
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || 'DOC';

  const isConnected = storageNotice?.connectionStatus === 'connected';
  const branchName = storageNotice?.defaultBranch || storageNotice?.branch || 'main';
  const repoLabel = storageNotice?.repositoryName || 'Not connected';
  const repoUrl = storageNotice?.repositoryUrl || storageNotice?.repoUrl;

  // Health & capacity signal calculations
  const totalSizeBytes = metrics.totalSize || metrics.totalSizeBytes || 0;
  const maxQuotaBytes = 2 * 1024 * 1024 * 1024; // 2 GB limit
  const usedPct = Math.min(100, (totalSizeBytes / maxQuotaBytes) * 100);
  const headroomScore = Math.max(0, Math.round(100 - usedPct));

  const approvedCount = metrics.approvedCount || 0;
  const pendingCount = metrics.pendingApprovals || 0;
  const declinedCount = metrics.declinedApprovals || 0;
  const totalApprovals = approvedCount + pendingCount + declinedCount;
  const approvalRate = totalApprovals > 0 ? Math.round((approvedCount / totalApprovals) * 100) : 100;

  const totalDocs = metrics.totalDocuments || metrics.totalFiles || 0;
  const sharedCount = metrics.activeShares || 0;
  const sharedCoverage = totalDocs > 0 ? Math.min(100, Math.round((sharedCount / totalDocs) * 100)) : 0;

  const topCategories = (fileTypeDistribution || []).slice(0, 2);

  return (
    <aside className="space-y-5">
      {/* ─── Card 1: Project Identity, Quick Actions & Storage Metadata ──── */}
      <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-4">
        {/* Header Badge + Title */}
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-lg shrink-0"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}AA)`,
              boxShadow: `0 6px 18px -4px ${accentColor}55`,
            }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-white truncate tracking-tight">
              {projectTitle}
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] font-mono mt-0.5" style={{ color: accentColor }}>
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: isConnected ? '#10B981' : '#F59E0B' }}
              />
              <span>{isConnected ? 'Storage connected' : 'Setup required'}</span>
            </div>
          </div>
        </div>

        {/* 4 Quick Action Tiles */}
        <div className="grid grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={onUploadClick}
            className="flex flex-col items-center justify-center gap-1 py-2.5 px-1.5 rounded-xl bg-[#16171D] border border-[#27272A] hover:border-zinc-600 text-zinc-300 hover:text-white transition-all cursor-pointer"
          >
            <UploadCloud size={15} className="text-zinc-400" />
            <span className="text-[10px] font-medium">Upload</span>
          </button>

          <button
            type="button"
            onClick={onNewFolderClick}
            className="flex flex-col items-center justify-center gap-1 py-2.5 px-1.5 rounded-xl bg-[#16171D] border border-[#27272A] hover:border-zinc-600 text-zinc-300 hover:text-white transition-all cursor-pointer"
          >
            <FolderPlus size={15} className="text-zinc-400" />
            <span className="text-[10px] font-medium">Folder</span>
          </button>

          <button
            type="button"
            onClick={onApprovalsClick}
            className="flex flex-col items-center justify-center gap-1 py-2.5 px-1.5 rounded-xl bg-[#16171D] border border-[#27272A] hover:border-zinc-600 text-zinc-300 hover:text-white transition-all cursor-pointer"
          >
            <FileCheck2 size={15} className="text-zinc-400" />
            <span className="text-[10px] font-medium">Approvals</span>
          </button>

          <button
            type="button"
            onClick={onSettingsClick}
            className="flex flex-col items-center justify-center gap-1 py-2.5 px-1.5 rounded-xl bg-[#16171D] border border-[#27272A] hover:border-zinc-600 text-zinc-300 hover:text-white transition-all cursor-pointer"
          >
            <Settings size={15} className="text-zinc-400" />
            <span className="text-[10px] font-medium">Settings</span>
          </button>
        </div>

        {/* Metadata Key-Value Rows */}
        <dl className="space-y-2.5 text-xs pt-3 border-t border-[#27272A]/70">
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-2 text-zinc-500">
              <User size={13} />
              <span>Lead</span>
            </dt>
            <dd className="font-medium text-zinc-200 truncate">
              {projectMeta?.leadName || 'Project Lead'}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-2 text-zinc-500">
              <GitBranch size={13} />
              <span>Repository</span>
            </dt>
            <dd className="font-medium text-right truncate max-w-[155px]">
              {repoUrl ? (
                <a
                  href={repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-zinc-200 hover:text-white hover:underline truncate"
                >
                  <span className="truncate">{repoLabel}</span>
                  <ExternalLink size={10} className="shrink-0 opacity-70" />
                </a>
              ) : (
                <span className="italic text-zinc-500">{repoLabel}</span>
              )}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-2 text-zinc-500">
              <GitBranch size={13} />
              <span>Branch</span>
            </dt>
            <dd className="font-mono text-zinc-200 text-[11px] bg-[#16171D] border border-[#27272A] px-2 py-0.5 rounded-md">
              {branchName}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-2 text-zinc-500">
              {storageNotice?.isPrivate !== false ? <Lock size={13} /> : <Globe size={13} />}
              <span>Visibility</span>
            </dt>
            <dd className="font-medium text-zinc-200">
              {storageNotice?.isPrivate !== false ? 'Private Repo' : 'Public Repo'}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-2 text-zinc-500">
              <Folder size={13} />
              <span>Folders</span>
            </dt>
            <dd className="font-mono text-zinc-200">{metrics.categoryCount || 0} folders</dd>
          </div>

          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-2 text-zinc-500">
              <CheckCircle2 size={13} />
              <span>PDF Approvals</span>
            </dt>
            <dd className="font-mono text-zinc-200">
              <span className="text-emerald-400">{approvedCount}</span>
              <span className="text-zinc-500"> · </span>
              <span className="text-amber-400">{pendingCount}</span>
            </dd>
          </div>
        </dl>
      </div>

      {/* ─── Card 2: Storage & Documents Health (Project Health style) ───── */}
      <section className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-4">
        <header className="flex items-start gap-2.5">
          <div
            className="p-1.5 rounded-lg border shrink-0 mt-0.5"
            style={{
              backgroundColor: `${accentColor}15`,
              color: accentColor,
              borderColor: `${accentColor}35`,
            }}
          >
            <ShieldCheck size={16} />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-white tracking-tight">
              Storage & Docs Health
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Live quota, sharing & PDF sign-off telemetry
            </p>
          </div>
        </header>

        <div className="space-y-4 pt-1">
          {/* Signal 1: GitHub Quota Headroom */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-200 font-medium">Repo Headroom</span>
              <span className="font-mono text-[11px]">
                <span className={headroomScore > 20 ? 'text-emerald-400' : 'text-amber-400'}>
                  {headroomScore > 20 ? 'Healthy' : 'High Usage'}
                </span>
                <span className="text-zinc-600 mx-1">·</span>
                <span className="text-white font-semibold">{headroomScore}</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[#16171D] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${headroomScore}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ backgroundColor: headroomScore > 20 ? '#10B981' : '#F59E0B' }}
              />
            </div>
            <p className="text-[10px] font-mono text-zinc-500">
              {formatBytes(totalSizeBytes)} used of 2 GB limit
            </p>
          </div>

          {/* Signal 2: PDF Approval Progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-200 font-medium">PDF Approvals</span>
              <span className="font-mono text-[11px]">
                <span className={pendingCount === 0 ? 'text-emerald-400' : 'text-amber-400'}>
                  {totalApprovals === 0 ? 'Clear' : pendingCount === 0 ? 'Reviewed' : 'Pending'}
                </span>
                <span className="text-zinc-600 mx-1">·</span>
                <span className="text-white font-semibold">{approvalRate}</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[#16171D] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${approvalRate}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full rounded-full bg-emerald-500"
              />
            </div>
            <p className="text-[10px] font-mono text-zinc-500">
              {approvedCount} approved · {declinedCount} declined · {pendingCount} pending
            </p>
          </div>

          {/* Signal 3: Shared Coverage */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-200 font-medium">Shared Access</span>
              <span className="font-mono text-[11px]">
                <span className="text-zinc-400">Active</span>
                <span className="text-zinc-600 mx-1">·</span>
                <span className="text-white font-semibold">{sharedCoverage}</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[#16171D] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(sharedCoverage, sharedCount > 0 ? 12 : 0)}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ backgroundColor: accentColor }}
              />
            </div>
            <p className="text-[10px] font-mono text-zinc-500">
              {sharedCount} shared files across {totalDocs} total documents
            </p>
          </div>

          {/* Signal 4+: File Breakdown */}
          {topCategories.map((item) => {
            const pct =
              item.percentage ?? (totalDocs > 0 ? Math.round((item.count / totalDocs) * 100) : 0);
            return (
              <div key={item.type} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-200 font-medium">{item.label || item.type}</span>
                  <span className="font-mono text-[11px]">
                    <span className="text-emerald-400">Indexed</span>
                    <span className="text-zinc-600 mx-1">·</span>
                    <span className="text-white font-semibold">{pct}%</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[#16171D] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="h-full rounded-full bg-emerald-500"
                  />
                </div>
                <p className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                  <Clock size={10} />
                  <span>{item.count} file{item.count === 1 ? '' : 's'} tracked</span>
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </aside>
  );
};

