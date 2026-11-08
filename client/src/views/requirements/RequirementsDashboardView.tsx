import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  FileText,
  Search,
  Filter,
  Plus,
  Download,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Layers,
  ArrowUpDown,
  RefreshCw,
  FolderKanban,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import {
  requirementService,
  RequirementSummary,
  RequirementStats,
  RequirementWidgets,
  RequirementCategory,
  RequirementFilters,
} from '../../services/requirement.service';
import {
  WorkflowStatusBadge,
  PriorityBadge,
  ImplementationStatusBadge,
  RequirementTypeBadge,
} from '../../components/requirements/RequirementBadges';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { can } from '../../services/requirementPermissions.service';

interface RequirementsDashboardViewProps {
  projectId?: number | string;
}

export const RequirementsDashboardView: React.FC<RequirementsDashboardViewProps> = ({
  projectId: propProjectId,
}) => {
  const { id: routeProjectId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrganization, currentRole } = useOrganization();

  // Determine if this is Project-level or Global view
  const activeProjectId = propProjectId || routeProjectId;
  const isProjectScoped = Boolean(activeProjectId);

  // Sub-filter tabs (for project level or global)
  const [subFilter, setSubFilter] = useState<
    'all' | 'functional' | 'non_functional' | 'pending_approval' | 'approved' | 'traceability'
  >(
    (searchParams.get('tab') as any) || 'all'
  );

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedProject, setSelectedProject] = useState<string>(
    activeProjectId ? String(activeProjectId) : searchParams.get('projectId') || ''
  );
  const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.get('category') || '');
  const [selectedPriority, setSelectedPriority] = useState<string>(searchParams.get('priority') || '');
  const [selectedWorkflowStatus, setSelectedWorkflowStatus] = useState<string>(searchParams.get('status') || '');
  const [selectedOwner, setSelectedOwner] = useState<string>(searchParams.get('owner') || '');

  // Data state
  const [requirements, setRequirements] = useState<RequirementSummary[]>([]);
  const [stats, setStats] = useState<RequirementStats>({
    total: 0,
    approved: 0,
    pendingReview: 0,
    rejected: 0,
    draft: 0,
    inProgress: 0,
    completed: 0,
    blocked: 0,
  });
  const [widgets, setWidgets] = useState<RequirementWidgets>({
    noLinkedTasks: [],
    approachingTargetDates: [],
  });
  const [categories, setCategories] = useState<RequirementCategory[]>([]);
  const [projectsList, setProjectsList] = useState<Array<{ id: number; title: string }>>([]);
  const [knownOwners, setKnownOwners] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Maintain unique owners across filter operations
  useEffect(() => {
    if (requirements.length > 0) {
      setKnownOwners((prev) => {
        const map = new Map<string, { id: string; name: string }>();
        prev.forEach((o) => map.set(o.id, o));
        requirements.forEach((r) => {
          if (r.author?.id && r.author?.name) {
            map.set(String(r.author.id), { id: String(r.author.id), name: r.author.name });
          }
        });
        return Array.from(map.values());
      });
    }
  }, [requirements]);

  // Permission check for current user
  const userContext = useMemo(() => {
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      orgRole: currentRole || 'MEMBER',
      isProjectOwner: user.role === 'ADMIN',
    };
  }, [user, currentRole]);

  const canCreate = useMemo(() => {
    const res = can(userContext, 'create', {
      projectId: activeProjectId ? Number(activeProjectId) : 0,
    });
    return res.allowed;
  }, [userContext, activeProjectId]);

  const canExport = useMemo(() => {
    if (!userContext) return false;
    // Viewers are read-only and restricted from data export per matrix
    return userContext.orgRole !== 'VIEWER';
  }, [userContext]);

  // Load requirements
  const loadData = async (showSkeleton = true) => {
    if (showSkeleton) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const filters: RequirementFilters = {
        projectId: activeProjectId || (selectedProject ? Number(selectedProject) : undefined),
        organizationSlug: currentOrganization?.slug,
        search: searchQuery || undefined,
        categoryId: selectedCategory || undefined,
        priority: selectedPriority || undefined,
        workflowStatus: selectedWorkflowStatus || undefined,
        ownerId: selectedOwner || undefined,
        subFilter,
      };

      const res = await requirementService.getRequirements(filters);
      if (res.success && res.data) {
        setRequirements(res.data.items);
        setStats(res.data.stats);
        setWidgets(res.data.widgets);
        setCategories(res.data.categories);
        setProjectsList(res.data.projects);
      }
    } catch (err) {
      console.error('Error fetching requirements:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [
    activeProjectId,
    subFilter,
    selectedProject,
    selectedCategory,
    selectedPriority,
    selectedWorkflowStatus,
    selectedOwner,
    currentOrganization?.slug,
  ]);

  // Handle Search submit / debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSubFilterChange = (tab: typeof subFilter) => {
    if (tab === 'traceability') {
      navigate(
        isProjectScoped
          ? `/projects/${activeProjectId}/requirements/traceability`
          : '/requirements/traceability'
      );
      return;
    }
    setSubFilter(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'all') next.delete('tab');
      else next.set('tab', tab);
      return next;
    });
  };

  const handleExportCsv = () => {
    requirementService.exportRequirementsCsv({
      projectId: activeProjectId || selectedProject || undefined,
      organizationId: currentOrganization?.id || undefined,
    });
  };

  const clearFilters = () => {
    setSearchQuery('');
    if (!activeProjectId) setSelectedProject('');
    setSelectedCategory('');
    setSelectedPriority('');
    setSelectedWorkflowStatus('');
    setSelectedOwner('');
    setSubFilter('all');
  };

  const hasActiveFilters = Boolean(
    searchQuery ||
    (!activeProjectId && selectedProject) ||
    selectedCategory ||
    selectedPriority ||
    selectedWorkflowStatus ||
    selectedOwner ||
    subFilter !== 'all'
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Top Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {isProjectScoped ? 'Project Requirements' : 'Requirements Management'}
                </h1>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold tracking-wider uppercase bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  {isProjectScoped ? 'Project Scope' : 'Workspace Wide'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Traceable specifications, formal review workflows, and implementation governance
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadData(false)}
            disabled={isRefreshing}
            className="p-2 rounded-lg text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
            title="Refresh requirements"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
          </button>

          {canExport && (
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
            >
              <Download size={14} className="text-zinc-400" />
              <span>Export CSV</span>
            </button>
          )}

          {canCreate && (
            <button
              onClick={() => {
                // Navigate to creation wizard (Phase 4)
                if (activeProjectId) {
                  navigate(`/projects/${activeProjectId}/requirements/new`);
                } else {
                  navigate('/requirements/new');
                }
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-sm shadow-blue-500/20 transition-all"
            >
              <Plus size={15} />
              <span>Create Requirement</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 8 Real Data Stat Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        <div className="p-3 rounded-lg bg-[#0E0E10] border border-[#27272A]">
          <div className="text-[10.5px] uppercase font-semibold text-zinc-500 tracking-wider">Total</div>
          <div className="text-xl font-bold text-white mt-0.5">{stats.total}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Specifications</div>
        </div>

        <div className="p-3 rounded-lg bg-[#0E0E10] border border-[#27272A] border-l-2 border-l-emerald-500">
          <div className="text-[10.5px] uppercase font-semibold text-emerald-400 tracking-wider flex items-center justify-between">
            Approved
          </div>
          <div className="text-xl font-bold text-emerald-400 mt-0.5">{stats.approved}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Reviewed & locked</div>
        </div>

        <div className="p-3 rounded-lg bg-[#0E0E10] border border-[#27272A] border-l-2 border-l-amber-500">
          <div className="text-[10.5px] uppercase font-semibold text-amber-400 tracking-wider">In Review</div>
          <div className="text-xl font-bold text-amber-400 mt-0.5">{stats.pendingReview}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Awaiting decision</div>
        </div>

        <div className="p-3 rounded-lg bg-[#0E0E10] border border-[#27272A] border-l-2 border-l-red-500">
          <div className="text-[10.5px] uppercase font-semibold text-red-400 tracking-wider">Rejected</div>
          <div className="text-xl font-bold text-red-400 mt-0.5">{stats.rejected}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Requires re-work</div>
        </div>

        <div className="p-3 rounded-lg bg-[#0E0E10] border border-[#27272A] border-l-2 border-l-zinc-500">
          <div className="text-[10.5px] uppercase font-semibold text-zinc-400 tracking-wider">Draft</div>
          <div className="text-xl font-bold text-zinc-300 mt-0.5">{stats.draft}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Unsubmitted</div>
        </div>

        <div className="p-3 rounded-lg bg-[#0E0E10] border border-[#27272A] border-l-2 border-l-blue-500">
          <div className="text-[10.5px] uppercase font-semibold text-blue-400 tracking-wider">In Progress</div>
          <div className="text-xl font-bold text-blue-400 mt-0.5">{stats.inProgress}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Active coding</div>
        </div>

        <div className="p-3 rounded-lg bg-[#0E0E10] border border-[#27272A] border-l-2 border-l-purple-500">
          <div className="text-[10.5px] uppercase font-semibold text-purple-400 tracking-wider">Completed</div>
          <div className="text-xl font-bold text-purple-400 mt-0.5">{stats.completed}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Verified / shipped</div>
        </div>

        <div className="p-3 rounded-lg bg-[#0E0E10] border border-[#27272A] border-l-2 border-l-rose-500">
          <div className="text-[10.5px] uppercase font-semibold text-rose-400 tracking-wider">Blocked</div>
          <div className="text-xl font-bold text-rose-400 mt-0.5">{stats.blocked}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Needs unblocking</div>
        </div>
      </div>

      {/* ── Sub-Filters Tabs Bar ─────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-[#27272A] overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => handleSubFilterChange('all')}
          className={`px-3 py-2 font-medium rounded-t-md transition-colors flex items-center gap-1.5 ${
            subFilter === 'all'
              ? 'text-white border-b-2 border-blue-500 bg-zinc-900/60'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span>All Requirements</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] bg-zinc-800 text-zinc-400">{stats.total}</span>
        </button>

        <button
          onClick={() => handleSubFilterChange('functional')}
          className={`px-3 py-2 font-medium rounded-t-md transition-colors flex items-center gap-1.5 ${
            subFilter === 'functional'
              ? 'text-white border-b-2 border-blue-500 bg-zinc-900/60'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span>Functional</span>
        </button>

        <button
          onClick={() => handleSubFilterChange('non_functional')}
          className={`px-3 py-2 font-medium rounded-t-md transition-colors flex items-center gap-1.5 ${
            subFilter === 'non_functional'
              ? 'text-white border-b-2 border-blue-500 bg-zinc-900/60'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span>Non-Functional & Security</span>
        </button>

        <button
          onClick={() => handleSubFilterChange('pending_approval')}
          className={`px-3 py-2 font-medium rounded-t-md transition-colors flex items-center gap-1.5 ${
            subFilter === 'pending_approval'
              ? 'text-amber-400 border-b-2 border-amber-500 bg-amber-500/10'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span>Pending Approval</span>
          {stats.pendingReview > 0 && (
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 font-bold">
              {stats.pendingReview}
            </span>
          )}
        </button>

        <button
          onClick={() => handleSubFilterChange('approved')}
          className={`px-3 py-2 font-medium rounded-t-md transition-colors flex items-center gap-1.5 ${
            subFilter === 'approved'
              ? 'text-emerald-400 border-b-2 border-emerald-500 bg-emerald-500/10'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span>Approved</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-medium">
            {stats.approved}
          </span>
        </button>

        <button
          onClick={() => handleSubFilterChange('traceability')}
          className={`px-3 py-2 font-medium rounded-t-md transition-colors flex items-center gap-1.5 ${
            subFilter === 'traceability'
              ? 'text-white border-b-2 border-blue-500 bg-zinc-900/60'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Layers size={13} className="text-zinc-400" />
          <span>Traceability Matrix</span>
        </button>
      </div>

      {/* ── Sticky Filter Bar ────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 p-3 rounded-xl bg-[#0E0E10]/95 backdrop-blur border border-[#27272A] shadow-lg flex flex-wrap items-center gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search by ID (REQ-001) or title..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs bg-zinc-900/90 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Global Project Picker (Only shown when not project-scoped) */}
        {!isProjectScoped && (
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg text-xs bg-zinc-900 border border-zinc-800 text-zinc-300 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Projects</option>
            {projectsList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        )}

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg text-xs bg-zinc-900 border border-zinc-800 text-zinc-300 focus:outline-none focus:border-blue-500"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Priority Filter */}
        <select
          value={selectedPriority}
          onChange={(e) => setSelectedPriority(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg text-xs bg-zinc-900 border border-zinc-800 text-zinc-300 focus:outline-none focus:border-blue-500"
        >
          <option value="">All Priorities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        {/* Workflow Status Filter */}
        <select
          value={selectedWorkflowStatus}
          onChange={(e) => setSelectedWorkflowStatus(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg text-xs bg-zinc-900 border border-zinc-800 text-zinc-300 focus:outline-none focus:border-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_REVIEW">Pending Review</option>
          <option value="CHANGES_REQUESTED">Changes Requested</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="DEPRECATED">Deprecated</option>
          <option value="ARCHIVED">Archived</option>
        </select>

        {/* Owner Filter */}
        <select
          value={selectedOwner}
          onChange={(e) => setSelectedOwner(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg text-xs bg-zinc-900 border border-zinc-800 text-zinc-300 focus:outline-none focus:border-blue-500"
        >
          <option value="">All Owners</option>
          {knownOwners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Main Layout: Table on Left, Attention Widgets on Right ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Column: Requirements Table */}
        <div className="lg:col-span-3 space-y-4">
          <div className="border border-[#27272A] rounded-xl bg-[#0E0E10] overflow-hidden">
            {isLoading ? (
              /* Skeleton Loader */
              <div className="p-6 space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-12 bg-zinc-900/60 rounded animate-pulse" />
                ))}
              </div>
            ) : requirements.length === 0 ? (
              /* Empty State */
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
                  <FileText size={24} />
                </div>
                <h3 className="text-sm font-semibold text-zinc-200">No requirements found</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  {hasActiveFilters
                    ? 'No requirements matched your current filters. Try clearing some filters or searching for something else.'
                    : 'There are no requirements defined yet in this scope. Create your first specification to begin the review workflow.'}
                </p>
                {hasActiveFilters ? (
                  <button
                    onClick={clearFilters}
                    className="mt-2 px-3 py-1.5 rounded-lg text-xs bg-zinc-800 text-zinc-200 hover:text-white"
                  >
                    Clear Filters
                  </button>
                ) : canCreate ? (
                  <button
                    onClick={() => {
                      if (activeProjectId) {
                        navigate(`/projects/${activeProjectId}/requirements/new`);
                      } else {
                        navigate('/requirements/new');
                      }
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-sm shadow-blue-500/20"
                  >
                    <Plus size={14} />
                    <span>Create Requirement</span>
                  </button>
                ) : null}
              </div>
            ) : (
              /* Requirements Table */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#141417] text-zinc-400 font-semibold uppercase text-[10.5px] border-b border-[#27272A]">
                    <tr>
                      <th className="py-3 px-3.5 w-24">ID</th>
                      <th className="py-3 px-3.5">Title & Type</th>
                      {!isProjectScoped && <th className="py-3 px-3.5">Project</th>}
                      <th className="py-3 px-3.5">Category</th>
                      <th className="py-3 px-3.5">Priority</th>
                      <th className="py-3 px-3.5">Workflow</th>
                      <th className="py-3 px-3.5">Implementation</th>
                      <th className="py-3 px-3.5">
                        {subFilter === 'pending_approval' ? 'Submitter' : 'Owner'}
                      </th>
                      <th className="py-3 px-3.5">
                        {subFilter === 'pending_approval' ? 'Submission Date' : 'Target Date'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27272A]">
                    {requirements.map((req) => (
                      <tr
                        key={req.id}
                        onClick={() => navigate(`/projects/${req.projectId}/requirements/${req.id}`)}
                        className="hover:bg-[#161619] cursor-pointer transition-colors group"
                      >
                        {/* ID Code */}
                        <td className="py-3 px-3.5 font-mono font-semibold text-blue-400 group-hover:text-blue-300">
                          {req.code}
                        </td>

                        {/* Title & Type */}
                        <td className="py-3 px-3.5">
                          <div className="font-medium text-zinc-200 group-hover:text-white transition-colors truncate max-w-xs">
                            {req.title}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <RequirementTypeBadge type={req.type} />
                            <span className="text-[10.5px] text-zinc-500 font-mono">v{req.currentVersion}</span>
                            {req._count && req._count.acceptanceCriteria > 0 && (
                              <span className="text-[10px] text-zinc-400">
                                • {req._count.acceptanceCriteria} AC
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Project (only in global view) */}
                        {!isProjectScoped && (
                          <td className="py-3 px-3.5 text-zinc-400 truncate max-w-[130px]">
                            {req.project?.title || 'Unknown'}
                          </td>
                        )}

                        {/* Category */}
                        <td className="py-3 px-3.5">
                          {req.category ? (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-medium"
                              style={{ color: req.category.color || '#94A3B8' }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: req.category.color || '#94A3B8' }}
                              />
                              {req.category.name}
                            </span>
                          ) : (
                            <span className="text-zinc-500 text-[11px]">—</span>
                          )}
                        </td>

                        {/* Priority */}
                        <td className="py-3 px-3.5">
                          <PriorityBadge priority={req.priority} />
                        </td>

                        {/* Workflow Status */}
                        <td className="py-3 px-3.5">
                          <WorkflowStatusBadge status={req.workflowStatus} />
                        </td>

                        {/* Implementation Status (Rule 2: separate field) */}
                        <td className="py-3 px-3.5">
                          <ImplementationStatusBadge status={req.implementationStatus} />
                        </td>

                        {/* Owner / Submitter */}
                        <td className="py-3 px-3.5">
                          {subFilter === 'pending_approval' ? (
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-[9px]">
                                {(req.submittedBy?.name || req.author?.name || 'U').charAt(0).toUpperCase()}
                              </div>
                              <span className="text-zinc-300 text-[11.5px] truncate max-w-[100px]">
                                {req.submittedBy?.name || req.author?.name || 'Unknown'}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold text-[9px]">
                                {req.author.name?.charAt(0).toUpperCase() || 'U'}
                              </div>
                              <span className="text-zinc-300 text-[11.5px] truncate max-w-[100px]">
                                {req.author.name}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Target Date / Submission Date */}
                        <td className="py-3 px-3.5 text-zinc-400 font-mono text-[11px]">
                          {subFilter === 'pending_approval' ? (
                            req.submittedAt ? (
                              new Date(req.submittedAt).toLocaleDateString()
                            ) : (
                              <span className="text-zinc-600">—</span>
                            )
                          ) : (
                            req.targetDate ? (
                              new Date(req.targetDate).toLocaleDateString()
                            ) : (
                              <span className="text-zinc-600">—</span>
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Widgets */}
        <div className="space-y-4">
          {/* Widget 1: No Linked Tasks */}
          <div className="p-4 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-3">
            <div className="flex items-center gap-2 text-zinc-200 font-semibold text-xs">
              <AlertCircle size={15} className="text-amber-400" />
              <span>Approved Without Tasks</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Approved specifications that haven't been broken down into development tasks yet.
            </p>

            {widgets.noLinkedTasks.length === 0 ? (
              <div className="p-3 text-center rounded bg-zinc-900/40 text-zinc-500 text-[11px]">
                All approved requirements have linked tasks.
              </div>
            ) : (
              <div className="space-y-2">
                {widgets.noLinkedTasks.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/projects/${activeProjectId || 1}/requirements/${item.id}`)}
                    className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 cursor-pointer transition-colors"
                  >
                    <div className="font-mono text-[10.5px] font-bold text-blue-400">{item.code}</div>
                    <div className="text-xs text-zinc-300 font-medium truncate mt-0.5">{item.title}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Widget 2: Approaching Target Dates */}
          <div className="p-4 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-3">
            <div className="flex items-center gap-2 text-zinc-200 font-semibold text-xs">
              <Clock size={15} className="text-blue-400" />
              <span>Approaching Target Dates</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Requirements with delivery dates due in the next 14 days.
            </p>

            {widgets.approachingTargetDates.length === 0 ? (
              <div className="p-3 text-center rounded bg-zinc-900/40 text-zinc-500 text-[11px]">
                No upcoming deadlines in the next 14 days.
              </div>
            ) : (
              <div className="space-y-2">
                {widgets.approachingTargetDates.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/projects/${activeProjectId || 1}/requirements/${item.id}`)}
                    className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className="font-mono font-bold text-blue-400">{item.code}</span>
                      <span className="text-amber-400 font-mono font-medium">
                        {new Date(item.targetDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-300 font-medium truncate mt-0.5">{item.title}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
