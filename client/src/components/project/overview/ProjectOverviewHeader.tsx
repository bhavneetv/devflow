import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Settings,
  UserPlus,
  Search,
  ArrowLeft,
  Sparkles,
  LayoutDashboard,
  Target,
  Activity,
  Users,
  GitFork,
  Rocket,
  Calendar,
  ChevronDown,
  LucideIcon,
} from 'lucide-react';

export type OverviewTab =
  | 'overview'
  | 'roadmap'
  | 'health'
  | 'workload'
  | 'traceability'
  | 'release';

interface ProjectOverviewHeaderProps {
  project: {
    id: number;
    title: string;
    description: string | null;
    status: string;
    visibility: string;
    avatarColor: string;
    avatarIcon: string;
    createdAt: string;
    owner: { name: string } | null;
    userRole: string;
  };
  activeTab: OverviewTab;
  onTabChange: (tab: OverviewTab) => void;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
  isIllustrativeActive: boolean;
  onToggleIllustrative: () => void;
  onExitProject: () => void;
  onOpenInviteModal?: () => void;
  blockerCount?: number;
  riskCount?: number;
  unlinkedReqCount?: number;
}

export const ProjectOverviewHeader: React.FC<ProjectOverviewHeaderProps> = ({
  project,
  activeTab,
  onTabChange,
  dateRange,
  onDateRangeChange,
  isIllustrativeActive,
  onToggleIllustrative,
  onExitProject,
  onOpenInviteModal,
  blockerCount = 0,
  riskCount = 0,
  unlinkedReqCount = 0,
}) => {
  const isOwnerOrManager = project.userRole === 'OWNER' || project.userRole === 'MANAGER';
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PLANNING':
        return 'bg-amber-950/40 text-amber-400 border-amber-500/40';
      case 'IN_PROGRESS':
        return 'bg-blue-950/40 text-blue-400 border-blue-500/40';
      case 'COMPLETED':
        return 'bg-emerald-950/40 text-emerald-400 border-emerald-500/40';
      default:
        return 'bg-zinc-900 text-zinc-300 border-zinc-700';
    }
  };

  const initial = project.title ? project.title.charAt(0).toUpperCase() : 'P';
  const createdDate = new Date(project.createdAt).toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });

  const DATE_OPTIONS = [
    { id: '7d', label: 'Last 7 Days' },
    { id: '30d', label: 'Last 30 Days' },
    { id: 'quarter', label: 'This Quarter' },
    { id: 'all', label: 'All Time' },
  ];

  const currentDateLabel =
    DATE_OPTIONS.find((o) => o.id === dateRange)?.label || 'Last 30 Days';

  const tabs: Array<{
    id: OverviewTab;
    label: string;
    icon: LucideIcon;
    badge?: number | string;
    badgeColor?: string;
  }> = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
    },
    {
      id: 'roadmap',
      label: 'Roadmap & Gantt',
      icon: Target,
    },
    {
      id: 'health',
      label: 'Health & Risks',
      icon: Activity,
      badge: blockerCount > 0 ? `${blockerCount} critical` : riskCount > 0 ? riskCount : undefined,
      badgeColor: blockerCount > 0 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400',
    },
    {
      id: 'workload',
      label: 'Team Workload',
      icon: Users,
    },
    {
      id: 'traceability',
      label: 'Traceability & QA',
      icon: GitFork,
      badge: unlinkedReqCount > 0 ? `${unlinkedReqCount} gaps` : undefined,
      badgeColor: 'bg-purple-500/20 text-purple-300',
    },
    {
      id: 'release',
      label: 'Release Readiness',
      icon: Rocket,
    },
  ];

  return (
    <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm space-y-5">
      {/* 1. Top action row with breadcrumb action, date filter & tools */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-zinc-800/80">
        <button
          onClick={onExitProject}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white bg-zinc-950/60 hover:bg-zinc-800 border border-zinc-800 transition-colors cursor-pointer"
        >
          <ArrowLeft size={13} />
          <span>Return to Workspace</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Date range filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDateDropdown((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
            >
              <Calendar size={12} className="text-zinc-500" />
              <span>{currentDateLabel}</span>
              <ChevronDown size={12} className="text-zinc-500" />
            </button>

            {showDateDropdown && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowDateDropdown(false)}
                />
                <div className="absolute right-0 mt-1 w-36 rounded-xl bg-zinc-950 border border-zinc-800 shadow-xl py-1 z-40 text-xs">
                  {DATE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        onDateRangeChange(opt.id);
                        setShowDateDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-zinc-900 transition-colors cursor-pointer ${
                        dateRange === opt.id
                          ? 'text-blue-400 font-semibold bg-zinc-900/50'
                          : 'text-zinc-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Illustrative data toggle chip */}
          <button
            onClick={onToggleIllustrative}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
              isIllustrativeActive
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-zinc-800/70 text-zinc-400 border-zinc-700/60 hover:text-zinc-200'
            }`}
            title="Toggle illustrative preview for unconnected modules (Sprints, QA, Deadlines)"
          >
            <Sparkles
              size={11}
              className={isIllustrativeActive ? 'text-amber-400' : 'text-zinc-500'}
            />
            <span>Illustrative data</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isIllustrativeActive ? 'bg-amber-400' : 'bg-zinc-600'
              }`}
            />
          </button>

          {/* Quick Search ⌘K */}
          <div className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-950/80 border border-zinc-800 text-xs text-zinc-400">
            <Search size={12} className="text-zinc-500" />
            <span className="text-[11px]">Search</span>
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400 border border-zinc-700 font-mono">
              ⌘K
            </kbd>
          </div>
        </div>
      </div>

      {/* 2. Main Project Identity Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          {/* Project Icon */}
          <div
            className="w-13 h-13 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-md shrink-0 border border-white/10"
            style={{ backgroundColor: project.avatarColor || '#3B82F6' }}
          >
            {initial}
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-semibold text-white tracking-tight truncate">
                {project.title}
              </h1>

              {/* Status Pill (PLANNING = amber pill) */}
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getStatusBadge(
                  project.status
                )} uppercase tracking-wider shrink-0`}
              >
                {project.status.replace('_', ' ')}
              </span>

              {/* Visibility Pill (PRIVATE = zinc pill) */}
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-900 text-zinc-400 border border-zinc-700/80 uppercase tracking-wider shrink-0">
                {project.visibility || 'PRIVATE'}
              </span>
            </div>

            <div className="text-xs text-zinc-400 flex items-center gap-2 flex-wrap">
              <span>Owner: {project.owner?.name || 'Admin'}</span>
              <span>•</span>
              <span>Created {createdDate}</span>
            </div>

            {project.description && (
              <p className="text-xs text-zinc-300 leading-relaxed pt-1 max-w-2xl line-clamp-2">
                {project.description}
              </p>
            )}
          </div>
        </div>

        {/* Right side buttons */}
        <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
          {isOwnerOrManager && (
            <button
              onClick={onOpenInviteModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-sm transition-colors cursor-pointer"
            >
              <UserPlus size={14} />
              <span>Invite Members</span>
            </button>
          )}

          <Link
            to={`/projects/${project.id}/settings`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 transition-colors shadow-sm"
          >
            <Settings size={14} className="text-zinc-400" />
            <span>Settings</span>
          </Link>
        </div>
      </div>

      {/* 3. Dashboard Navigation Tabs (Inspired by GuardPro Image 2 & TraceAI Image 1) */}
      <div className="pt-2 border-t border-zinc-800/80 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-blue-400' : 'text-zinc-500'} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    tab.badgeColor || 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
