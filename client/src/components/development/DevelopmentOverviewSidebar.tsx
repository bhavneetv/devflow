import React from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  CheckCircle2,
  FolderCog,
  ListTodo,
  Plus,
  ShieldCheck,
  User,
} from 'lucide-react';
import type { DevelopmentDashboardData } from '../../types/development';
import { useAccentTheme } from '../../services/accentTheme.service';

interface DevelopmentOverviewSidebarProps {
  data: DevelopmentDashboardData;
  onCreateTaskClick: () => void;
  onAllTasksClick: () => void;
  onAnalyticsClick: () => void;
  onMastersClick: () => void;
}

export const DevelopmentOverviewSidebar: React.FC<DevelopmentOverviewSidebarProps> = ({
  data,
  onCreateTaskClick,
  onAllTasksClick,
  onAnalyticsClick,
  onMastersClick,
}) => {
  const { accentColor } = useAccentTheme();
  const { projectMeta, metrics, permissions } = data;

  const projectTitle = projectMeta?.title || 'Development';
  const initials =
    projectTitle
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('') || 'DEV';

  const total = metrics.totalWorkItems;
  const activeCount = Math.max(0, total - metrics.completedCount);
  const scheduleHealth =
    activeCount > 0 ? Math.max(0, Math.round(((activeCount - metrics.overdueCount) / activeCount) * 100)) : 100;
  const assignmentCoverage =
    total > 0 ? Math.max(0, Math.round(((total - metrics.unassignedCount) / total) * 100)) : 100;
  const flowScore =
    total > 0 ? Math.max(0, Math.round(((total - metrics.blockedCount) / total) * 100)) : 100;

  const signals = [
    {
      label: 'Completion Rate',
      score: metrics.completionRate,
      detail: `${metrics.completedCount} completed of ${total} items`,
      color: '#10B981',
    },
    {
      label: 'On-Time Schedule',
      score: scheduleHealth,
      detail: `${metrics.overdueCount} overdue · ${metrics.dueSoonCount} due within 7d`,
      color: scheduleHealth >= 80 ? '#10B981' : '#F59E0B',
    },
    {
      label: 'Ownership Coverage',
      score: assignmentCoverage,
      detail: `${total - metrics.unassignedCount} assigned · ${metrics.unassignedCount} unassigned`,
      color: '#3B82F6',
    },
    {
      label: 'Unblocked Flow',
      score: flowScore,
      detail: `${metrics.blockedCount} blocked · ${metrics.inReviewCount} in review`,
      color: metrics.blockedCount > 0 ? '#F97316' : '#10B981',
    },
  ];

  const avgHealth =
    total === 0
      ? 0
      : Math.round(
          signals.reduce((acc, s) => acc + s.score, 0) / signals.length
        );

  return (
    <aside className="space-y-5">
      {/* Card 1: Project Identity & Quick Actions */}
      <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-4">
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
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{data.config.taskPrefix} · {permissions.role}</span>
            </div>
          </div>
        </div>

        {/* 4 Quick Action Tiles */}
        <div className="grid grid-cols-4 gap-1.5">
          {permissions.canEditTasks && (
            <button
              type="button"
              onClick={onCreateTaskClick}
              className="flex flex-col items-center justify-center gap-1 py-2.5 px-1.5 rounded-xl bg-[#16171D] border border-[#27272A] hover:border-zinc-600 text-zinc-300 hover:text-white transition-all cursor-pointer"
            >
              <Plus size={15} style={{ color: accentColor }} />
              <span className="text-[10px] font-medium">New Task</span>
            </button>
          )}
          <button
            type="button"
            onClick={onAllTasksClick}
            className="flex flex-col items-center justify-center gap-1 py-2.5 px-1.5 rounded-xl bg-[#16171D] border border-[#27272A] hover:border-zinc-600 text-zinc-300 hover:text-white transition-all cursor-pointer"
          >
            <ListTodo size={15} className="text-zinc-400" />
            <span className="text-[10px] font-medium">Tasks</span>
          </button>
          <button
            type="button"
            onClick={onAnalyticsClick}
            className="flex flex-col items-center justify-center gap-1 py-2.5 px-1.5 rounded-xl bg-[#16171D] border border-[#27272A] hover:border-zinc-600 text-zinc-300 hover:text-white transition-all cursor-pointer"
          >
            <BarChart3 size={15} className="text-zinc-400" />
            <span className="text-[10px] font-medium">Analytics</span>
          </button>
          <button
            type="button"
            onClick={onMastersClick}
            className="flex flex-col items-center justify-center gap-1 py-2.5 px-1.5 rounded-xl bg-[#16171D] border border-[#27272A] hover:border-zinc-600 text-zinc-300 hover:text-white transition-all cursor-pointer"
          >
            <FolderCog size={15} className="text-zinc-400" />
            <span className="text-[10px] font-medium">Masters</span>
          </button>
        </div>

        <dl className="space-y-2.5 text-xs pt-3 border-t border-[#27272A]/70">
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-2 text-zinc-500">
              <User size={13} />
              <span>Lead</span>
            </dt>
            <dd className="font-medium text-zinc-200 truncate">
              {projectMeta.lead?.name || 'Project Owner'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-2 text-zinc-500">
              <CheckCircle2 size={13} />
              <span>Active Contributors</span>
            </dt>
            <dd className="font-mono font-medium text-zinc-200">
              {metrics.teamWorkload.length}
            </dd>
          </div>
        </dl>
      </div>

      {/* Card 2: Execution Health Telemetry */}
      <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} style={{ color: accentColor }} />
            <h3 className="text-sm font-semibold text-white">Delivery Health</h3>
          </div>
          <span className="text-xs font-mono font-bold text-white">
            {total === 0 ? '—' : `${avgHealth}/100`}
          </span>
        </div>

        <div className="space-y-3.5">
          {signals.map((sig, idx) => (
            <div key={sig.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-300 font-medium">{sig.label}</span>
                <span className="font-mono text-zinc-200 font-semibold">
                  {total === 0 ? '0' : sig.score}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[#1C1E26] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${total === 0 ? 0 : Math.max(4, sig.score)}%` }}
                  transition={{ duration: 0.5, delay: idx * 0.06 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: sig.color }}
                />
              </div>
              <p className="text-[10px] font-mono text-zinc-500">{sig.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

