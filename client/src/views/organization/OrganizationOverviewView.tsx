import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Users,
  FolderKanban,
  Layers,
  CheckSquare,
  Plus,
  ArrowRight,
  Shield,
  Activity,
  Building2,
  ExternalLink,
  Sparkles,
  Clock,
  UserPlus,
  Settings,
  ChevronRight,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useOrganization } from '../../context/OrganizationContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import { organizationService } from '../../services/organization.service';
import { OrgAvatar } from '../../components/organization/OrgAvatar';
import type { OrganizationOverviewData } from '../../types/organization';
import { useNavigation } from '../../context/NavigationContext';

export const OrganizationOverviewView: React.FC = () => {
  const { organizationSlug } = useParams<{ organizationSlug: string }>();
  const { currentOrganization, switchOrganization, isAdminOrOwner, isOwner } = useOrganization();
  const { accentColor } = useAccentTheme();
  const { setIsCreateOpen } = useNavigation();
  const navigate = useNavigate();

  const [data, setData] = useState<OrganizationOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const targetSlug = organizationSlug || currentOrganization?.slug;

  const loadOverview = useCallback(async () => {
    if (!targetSlug) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await organizationService.getOverview(targetSlug);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error || 'Failed to load organization overview');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to organization service');
    } finally {
      setIsLoading(false);
    }
  }, [targetSlug]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const activeOrg = data?.organization || currentOrganization;
  const stats = data?.stats || data?.summary || {
    totalMembers: 0,
    totalTeams: 0,
    totalProjects: 0,
    openIssues: 0,
  };
  const teams = data?.teams || [];
  const projects = data?.projects || [];
  const recentActivities = data?.recentActivity || data?.recentActivities || [];
  const role = data?.currentRole || activeOrg?.currentUserRole || 'MEMBER';

  // Format activity action label
  const formatActivityText = (act: any) => {
    const actorName = act.actor?.name || 'A team member';
    switch (act.action) {
      case 'CREATED_ORGANIZATION':
        return `${actorName} founded the organization`;
      case 'JOINED_ORGANIZATION':
        return `${actorName} joined as a member`;
      case 'INVITED_MEMBER':
        return `${actorName} sent a member invitation`;
      case 'CHANGED_MEMBER_ROLE':
        return `${actorName} updated member permissions`;
      case 'REMOVED_MEMBER':
        return `${actorName} removed a member`;
      case 'CREATED_TEAM':
        return `${actorName} created a new team`;
      case 'CREATED_PROJECT':
        return `${actorName} initiated a project`;
      case 'UPDATED_ORGANIZATION':
        return `${actorName} modified organization settings`;
      case 'TRANSFERRED_OWNERSHIP':
        return `${actorName} transferred organization ownership`;
      default:
        return `${actorName} performed ${act.action.toLowerCase().replace(/_/g, ' ')}`;
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
      return 'Recently';
    }
  };

  if (isLoading && !data) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center p-8 space-y-4">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: `${accentColor} transparent ${accentColor} ${accentColor}` }}
        />
        <p className="text-xs text-zinc-400 font-medium">Loading organization workspace...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 max-w-xl mx-auto mt-12 bg-[#171A21] border border-red-500/30 rounded-2xl text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto border border-red-500/20">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-base font-semibold text-white">Could not load organization</h3>
        <p className="text-xs text-zinc-400 leading-relaxed">{error}</p>
        <button
          onClick={loadOverview}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white font-medium transition-colors"
        >
          <RefreshCw size={13} /> Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* ─── Breadcrumbs & Header ────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span>Organizations</span>
          <ChevronRight size={13} className="text-zinc-600" />
          <span className="text-zinc-200 font-medium">{activeOrg?.name}</span>
          <ChevronRight size={13} className="text-zinc-600" />
          <span className="text-zinc-400">Overview</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#27272A]">
          <div className="flex items-center gap-4 min-w-0">
            <OrgAvatar
              name={activeOrg?.name || 'Organization'}
              logoUrl={activeOrg?.logoUrl}
              className="w-14 h-14"
              iconSize={28}
              roundedClassName="rounded-2xl"
              fontSize={22}
            />
            <div className="truncate min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-[#F4F4F5] tracking-tight truncate">
                  {activeOrg?.name}
                </h1>
                <span
                  className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider font-mono border"
                  style={{
                    backgroundColor: `${accentColor}18`,
                    color: accentColor,
                    borderColor: `${accentColor}33`,
                  }}
                >
                  {data?.currentRole || 'MEMBER'}
                </span>
              </div>
              <p className="text-xs text-[#A1A1AA] mt-1 max-w-2xl truncate">
                {activeOrg?.description || `Organization workspace for ${activeOrg?.name}. Manage teams, projects, and permissions.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              to={`/organizations/${targetSlug}/members`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#171A21] hover:bg-[#1f232d] text-xs text-zinc-300 border border-[#27272A] font-medium transition-colors"
            >
              <UserPlus size={14} className="text-zinc-400" />
              <span>Invite</span>
            </Link>
            <Link
              to={`/organizations/${targetSlug}/settings`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#171A21] hover:bg-[#1f232d] text-xs text-zinc-300 border border-[#27272A] font-medium transition-colors"
            >
              <Settings size={14} className="text-zinc-400" />
              <span>Settings</span>
            </Link>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white shadow-md transition-opacity hover:opacity-95"
              style={{ backgroundColor: accentColor }}
            >
              <Plus size={15} />
              <span>Create Project</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Metric Summary Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Members */}
        <Link
          to={`/organizations/${targetSlug}/members`}
          className="p-5 rounded-2xl bg-[#171A21] border border-[#27272A] hover:border-zinc-600/70 transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider font-mono">
              Members
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20 group-hover:scale-105 transition-transform">
              <Users size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[#F4F4F5] font-mono">
              {stats.totalMembers ?? 0}
            </span>
            <span className="text-[11px] text-zinc-500">collaborators</span>
          </div>
        </Link>

        {/* Teams */}
        <Link
          to={`/organizations/${targetSlug}/teams`}
          className="p-5 rounded-2xl bg-[#171A21] border border-[#27272A] hover:border-zinc-600/70 transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider font-mono">
              Teams
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 group-hover:scale-105 transition-transform">
              <Layers size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[#F4F4F5] font-mono">
              {stats.totalTeams ?? 0}
            </span>
            <span className="text-[11px] text-zinc-500">active squads</span>
          </div>
        </Link>

        {/* Projects */}
        <Link
          to={`/organizations/${targetSlug}/projects`}
          className="p-5 rounded-2xl bg-[#171A21] border border-[#27272A] hover:border-zinc-600/70 transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider font-mono">
              Projects
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 group-hover:scale-105 transition-transform">
              <FolderKanban size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[#F4F4F5] font-mono">
              {stats.totalProjects ?? 0}
            </span>
            <span className="text-[11px] text-zinc-500">roadmaps</span>
          </div>
        </Link>

        {/* Open Issues */}
        <Link
          to="/my-tasks"
          className="p-5 rounded-2xl bg-[#171A21] border border-[#27272A] hover:border-zinc-600/70 transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider font-mono">
              Open Tasks
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 group-hover:scale-105 transition-transform">
              <CheckSquare size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[#F4F4F5] font-mono">
              {stats.openIssues ?? 0}
            </span>
            <span className="text-[11px] text-zinc-500">pending resolution</span>
          </div>
        </Link>
      </div>

      {/* ─── Two-Column Layout: Teams & Projects ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teams Section */}
        <div className="p-6 rounded-2xl bg-[#171A21] border border-[#27272A] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Layers size={17} className="text-purple-400" />
              <h2 className="text-base font-bold text-white tracking-tight">Teams</h2>
            </div>
            <Link
              to={`/organizations/${targetSlug}/teams`}
              className="text-xs font-medium text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>View All</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {teams.length === 0 ? (
            <div className="py-8 px-4 text-center rounded-xl bg-[#0D0F14] border border-[#27272A]/70 space-y-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto">
                <Layers size={18} />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">No teams formed yet</h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Organize engineers, designers, and managers into scoped squads.
                </p>
              </div>
              <Link
                to={`/organizations/${targetSlug}/teams`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white font-medium transition-colors"
              >
                <Plus size={13} /> Create Team
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {teams.map((team) => (
                <Link
                  key={team.id}
                  to={`/teams/${team.id}`}
                  className="p-3.5 rounded-xl bg-[#0D0F14] border border-[#27272A] hover:border-zinc-600/70 transition-all flex flex-col justify-between group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
                        style={{ backgroundColor: team.color || accentColor }}
                      >
                        {team.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-white group-hover:text-purple-300 transition-colors truncate block">
                          {team.name}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {team.identifier || 'TEAM'}
                        </span>
                      </div>
                    </div>
                    <ExternalLink size={12} className="text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Users size={12} className="text-zinc-500" />
                      <span>{team.memberCount} members</span>
                    </span>
                    <span className="text-purple-400 font-medium text-[10.5px]">Open squad</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Projects Section */}
        <div className="p-6 rounded-2xl bg-[#171A21] border border-[#27272A] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FolderKanban size={17} className="text-emerald-400" />
              <h2 className="text-base font-bold text-white tracking-tight">Active Projects</h2>
            </div>
            <Link
              to={`/organizations/${targetSlug}/projects`}
              className="text-xs font-medium text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>View All</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {projects.length === 0 ? (
            <div className="py-8 px-4 text-center rounded-xl bg-[#0D0F14] border border-[#27272A]/70 space-y-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                <FolderKanban size={18} />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">No projects created</h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Track deliverables, milestones, and cycles under this organization.
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white font-medium transition-colors"
              >
                <Plus size={13} /> Create Project
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {projects.map((proj) => (
                <Link
                  key={proj.id}
                  to={`/projects/${proj.id}`}
                  className="p-3.5 rounded-xl bg-[#0D0F14] border border-[#27272A] hover:border-zinc-600/70 transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-2 h-8 rounded-full bg-emerald-500/80 shrink-0" />
                    <div className="truncate min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors truncate">
                          {proj.name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {proj.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                        {proj.description || 'No description provided'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {proj.owner && (
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400" title={`Owner: ${proj.owner.name}`}>
                        <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-300 font-bold">
                          {proj.owner.name.charAt(0).toUpperCase()}
                        </div>
                      </div>
                    )}
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {formatRelativeTime(proj.updatedAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Recent Organization Activity ─────────────────────────────────── */}
      <div className="p-6 rounded-2xl bg-[#171A21] border border-[#27272A] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Activity size={17} className="text-blue-400" />
              <h2 className="text-base font-bold text-white tracking-tight">Recent Activity</h2>
            </div>
            <Link
              to={`/organizations/${targetSlug}/activity`}
              className="text-xs font-medium text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>Audit Log</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {recentActivities.length === 0 ? (
            <div className="py-6 text-center text-xs text-zinc-500">
              No recent activity recorded for this organization yet.
            </div>
          ) : (
            <div className="divide-y divide-[#27272A]/70">
              {recentActivities.map((act: any) => (
              <div key={act.id} className="py-3 flex items-center justify-between gap-4 first:pt-1 last:pb-1">
                <div className="flex items-center gap-3 min-w-0">
                  {act.actor?.avatarUrl ? (
                    <img
                      src={act.actor.avatarUrl}
                      alt={act.actor.name}
                      className="w-7 h-7 rounded-full object-cover border border-zinc-700 shrink-0"
                    />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 border border-white/10"
                      style={{ backgroundColor: act.actor?.avatarColor || accentColor }}
                    >
                      {act.actor?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="truncate min-w-0 text-xs">
                    <span className="text-zinc-200 font-medium">
                      {formatActivityText(act)}
                    </span>
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[9.5px] font-mono uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700">
                      {act.resourceType}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11px] text-zinc-500 font-mono shrink-0">
                  <Clock size={11} className="text-zinc-600" />
                  <span>{formatRelativeTime(act.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
