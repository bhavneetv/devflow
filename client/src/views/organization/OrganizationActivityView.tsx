import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Activity,
  Filter,
  Users,
  Layers,
  FolderKanban,
  Settings,
  Clock,
  ChevronRight,
  Shield,
  UserPlus,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useOrganization } from '../../context/OrganizationContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import { organizationService } from '../../services/organization.service';
import type { OrganizationActivity } from '../../types/organization';

const FILTER_TABS = [
  { id: 'all', label: 'All Activities', icon: Activity },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'teams', label: 'Teams', icon: Layers },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const OrganizationActivityView: React.FC = () => {
  const { organizationSlug } = useParams<{ organizationSlug: string }>();
  const { currentOrganization } = useOrganization();
  const { accentColor } = useAccentTheme();

  const targetSlug = organizationSlug || currentOrganization?.slug;

  const [activities, setActivities] = useState<OrganizationActivity[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadActivities = useCallback(async () => {
    if (!targetSlug) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await organizationService.listActivity(targetSlug, activeFilter);
      if (res.success && res.data) {
        setActivities(res.data);
      } else {
        setError(res.error || 'Failed to load activity logs');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading activity');
    } finally {
      setIsLoading(false);
    }
  }, [targetSlug, activeFilter]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const formatActivityDescription = (act: OrganizationActivity) => {
    const actorName = act.actor?.name || 'A team member';
    let detailsObj: any = {};
    if (act.details) {
      try {
        detailsObj = typeof act.details === 'string' ? JSON.parse(act.details) : act.details;
      } catch {}
    }

    switch (act.action) {
      case 'CREATED_ORGANIZATION':
        return `${actorName} founded the organization workspace.`;
      case 'JOINED_ORGANIZATION':
        return `${actorName} accepted an invitation and joined the workspace.`;
      case 'INVITED_MEMBER':
        return `${actorName} invited ${detailsObj.email || 'a new collaborator'} with role ${detailsObj.role || 'MEMBER'}.`;
      case 'CHANGED_MEMBER_ROLE':
        return `${actorName} updated permissions for member #${act.resourceId} to ${detailsObj.newRole || 'updated role'}.`;
      case 'REMOVED_MEMBER':
        return `${actorName} removed member #${act.resourceId} from the organization.`;
      case 'CREATED_TEAM':
        return `${actorName} created team "${detailsObj.teamName || 'New Team'}".`;
      case 'CREATED_PROJECT':
        return `${actorName} initiated project "${detailsObj.projectTitle || detailsObj.projectName || 'New Project'}".`;
      case 'UPDATED_ORGANIZATION':
        return `${actorName} updated organization details & general settings.`;
      case 'TRANSFERRED_OWNERSHIP':
        return `${actorName} transferred primary ownership of the organization.`;
      default:
        return `${actorName} executed ${act.action.toLowerCase().replace(/_/g, ' ')}.`;
    }
  };

  const getActionBadgeColor = (resourceType: string) => {
    switch (resourceType) {
      case 'ORGANIZATION':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'MEMBER':
      case 'INVITATION':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'TEAM':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'PROJECT':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* ─── Breadcrumbs & Header ────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span>Organizations</span>
          <ChevronRight size={13} className="text-zinc-600" />
          <Link
            to={`/organizations/${targetSlug}/overview`}
            className="text-zinc-300 hover:text-white transition-colors"
          >
            {currentOrganization?.name || 'Organization'}
          </Link>
          <ChevronRight size={13} className="text-zinc-600" />
          <span className="text-zinc-400">Activity</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#27272A]">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <Activity size={22} className="text-blue-400" />
              <span>Audit & Activity Log</span>
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Immutable trail of team, project, member, and permission changes across {currentOrganization?.name}.
            </p>
          </div>

          <button
            onClick={loadActivities}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#171A21] hover:bg-[#1f232d] text-xs text-zinc-300 border border-[#27272A] font-medium transition-colors self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ─── Category Filter Pills ───────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {FILTER_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-white/10 text-white border border-white/20 shadow-sm'
                  : 'bg-[#171A21] text-zinc-400 border border-[#27272A] hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── Timeline Feed ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[#27272A] bg-[#171A21] p-6 shadow-sm">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <div
              className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: `${accentColor} transparent ${accentColor} ${accentColor}` }}
            />
            <p className="text-xs text-zinc-400">Loading audit log...</p>
          </div>
        ) : error ? (
          <div className="py-12 px-4 text-center space-y-3">
            <AlertCircle size={24} className="text-red-400 mx-auto" />
            <p className="text-xs text-zinc-300">{error}</p>
            <button
              onClick={loadActivities}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white"
            >
              Retry
            </button>
          </div>
        ) : activities.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto border border-blue-500/20">
              <Activity size={22} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">No activity found</h3>
              <p className="text-xs text-zinc-400 mt-1">
                No events recorded matching the selected "{activeFilter}" filter.
              </p>
            </div>
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-px before:bg-[#27272A]">
            {activities.map((act) => (
              <div key={act.id} className="relative group">
                {/* Timeline Dot */}
                <div className="absolute -left-6 top-1.5 w-2 h-2 rounded-full bg-zinc-600 group-hover:bg-purple-400 transition-colors ring-4 ring-[#171A21]" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-[#0D0F14] border border-[#27272A] hover:border-zinc-700 transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    {act.actor?.avatarUrl ? (
                      <img
                        src={act.actor.avatarUrl}
                        alt={act.actor.name}
                        className="w-8 h-8 rounded-full object-cover border border-zinc-700 shrink-0"
                      />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 border border-white/10 shadow-sm"
                        style={{ backgroundColor: act.actor?.avatarColor || accentColor }}
                      >
                        {act.actor?.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="text-xs text-zinc-200 leading-relaxed">
                        {formatActivityDescription(act)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono uppercase tracking-wider border font-medium ${getActionBadgeColor(
                            act.resourceType
                          )}`}
                        >
                          {act.resourceType}
                        </span>
                        {act.resourceId && (
                          <span className="text-[10px] text-zinc-500 font-mono">
                            ref: #{act.resourceId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col sm:items-end justify-between text-[11px] text-zinc-500 font-mono shrink-0 pl-11 sm:pl-0">
                    <span className="text-zinc-400">{formatRelativeTime(act.createdAt)}</span>
                    <span className="text-[10px] text-zinc-600">{formatTimestamp(act.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
