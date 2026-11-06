import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  Plus,
  Search,
  Filter,
  Users,
  CheckSquare,
  Clock,
  ArrowRight,
  ChevronRight,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useOrganization } from '../../context/OrganizationContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import { organizationService } from '../../services/organization.service';
import { useNavigation } from '../../context/NavigationContext';

const STATUS_FILTERS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'PLANNING', label: 'Planning' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export const OrganizationProjectsView: React.FC = () => {
  const { organizationSlug } = useParams<{ organizationSlug: string }>();
  const { currentOrganization } = useOrganization();
  const { accentColor } = useAccentTheme();
  const { setIsCreateOpen } = useNavigation();

  const targetSlug = organizationSlug || currentOrganization?.slug;

  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    if (!targetSlug) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await organizationService.listProjects(targetSlug);
      if (res.success && res.data) {
        setProjects(res.data);
      } else {
        setError(res.error || 'Failed to load projects');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading projects');
    } finally {
      setIsLoading(false);
    }
  }, [targetSlug]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const title = p.title || p.name || '';
      const desc = p.description || '';
      const matchesSearch =
        title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        desc.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'COMPLETED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'PLANNING':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'ARCHIVED':
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
      default:
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
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
          <span className="text-zinc-400">Projects</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#27272A]">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <FolderKanban size={22} className="text-emerald-400" />
              <span>Organization Projects</span>
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Active engineering projects and product roadmaps under {currentOrganization?.name}.
            </p>
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-white shadow-md transition-opacity hover:opacity-95 self-start sm:self-auto cursor-pointer"
            style={{ backgroundColor: accentColor }}
          >
            <Plus size={15} />
            <span>Create Project</span>
          </button>
        </div>
      </div>

      {/* ─── Search & Status Filters ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full h-9 pl-8 pr-3 rounded-lg bg-[#171A21] border border-[#27272A] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 rounded-lg bg-[#171A21] border border-[#27272A] text-xs text-zinc-300 focus:outline-none focus:border-zinc-500 cursor-pointer appearance-none pr-8"
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <Filter size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>
        </div>

        <span className="text-xs text-zinc-500 font-mono">
          {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'}
        </span>
      </div>

      {/* ─── Projects Grid ───────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <div
            className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: `${accentColor} transparent ${accentColor} ${accentColor}` }}
          />
          <p className="text-xs text-zinc-400">Loading projects...</p>
        </div>
      ) : error ? (
        <div className="py-12 px-6 rounded-2xl bg-[#171A21] border border-red-500/30 text-center space-y-3">
          <AlertCircle size={24} className="text-red-400 mx-auto" />
          <p className="text-xs text-zinc-300">{error}</p>
          <button
            onClick={loadProjects}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white"
          >
            Retry
          </button>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="py-16 px-6 text-center rounded-2xl bg-[#171A21] border border-[#27272A] space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
            <FolderKanban size={22} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">No projects found</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto leading-relaxed">
              {searchQuery || statusFilter !== 'ALL'
                ? 'No projects match your current filters. Try resetting search.'
                : 'Start tracking tasks, sprint backlogs, and feature development.'}
            </p>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-md"
            style={{ backgroundColor: accentColor }}
          >
            <Plus size={14} /> Create First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((proj) => {
            const title = proj.title || proj.name || 'Untitled Project';
            return (
              <Link
                key={proj.id}
                to={`/projects/${proj.id}`}
                className="p-5 rounded-2xl bg-[#171A21] border border-[#27272A] hover:border-zinc-600/70 transition-all flex flex-col justify-between group shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                        <FolderKanban size={18} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors truncate">
                          {title}
                        </h3>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          ID: #{proj.id}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border font-medium shrink-0 ${getStatusBadge(
                        proj.status
                      )}`}
                    >
                      {proj.status?.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                    {proj.description || 'No description provided.'}
                  </p>
                </div>

                <div className="mt-5 pt-3.5 border-t border-[#27272A] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 text-zinc-400">
                    <span className="flex items-center gap-1 text-[11px]">
                      <CheckSquare size={12} className="text-zinc-500" />
                      <span>{proj._count?.tasks || proj.tasks?.length || 0} tasks</span>
                    </span>

                    {proj.owner && (
                      <span className="text-[11px] text-zinc-500 truncate max-w-[100px]">
                        {proj.owner.name}
                      </span>
                    )}
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                    <span>Open</span>
                    <ArrowRight size={12} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};
