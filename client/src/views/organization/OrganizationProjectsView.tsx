import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderKanban,
  Plus,
  Search,
  Users,
  CheckSquare,
  Clock,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  X,
  Check,
  ArrowDownAZ,
  ArrowUpZA,
  Calendar,
  CheckCircle2,
  LayoutGrid,
  List as ListIcon,
  ListFilter,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Layers,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Flame,
  Zap,
} from 'lucide-react';
import { useOrganization } from '../../context/OrganizationContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import { organizationService } from '../../services/organization.service';
import { useToast } from '../../context/ToastContext';
import { apiUrl } from '../../config/api';
import { authService } from '../../services/auth.service';

// ─── Status Filter Tabs ──────────────────────────────────────────────────────

const STATUS_TABS = [
  { id: 'ALL', label: 'All Projects', icon: FolderKanban },
  { id: 'IN_PROGRESS', label: 'In Progress', icon: Zap },
  { id: 'PLANNING', label: 'Planning', icon: Clock },
  { id: 'COMPLETED', label: 'Completed', icon: CheckCircle2 },
  { id: 'ARCHIVED', label: 'Archived', icon: Layers },
];

type SortOption = 'recent' | 'title-asc' | 'title-desc' | 'progress' | 'tasks';
type HealthFilter = 'all' | 'attention' | 'healthy';
type ViewMode = 'grid' | 'list';

// ─── Status Badges & Colors ──────────────────────────────────────────────────

const getStatusBadge = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'IN_PROGRESS':
      return {
        label: 'In Progress',
        color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25',
        dot: '#6366F1',
      };
    case 'COMPLETED':
      return {
        label: 'Completed',
        color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
        dot: '#10B981',
      };
    case 'PLANNING':
      return {
        label: 'Planning',
        color: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
        dot: '#F59E0B',
      };
    case 'ARCHIVED':
      return {
        label: 'Archived',
        color: 'bg-zinc-800 text-zinc-400 border-zinc-700/60',
        dot: '#71717A',
      };
    default:
      return {
        label: status || 'Active',
        color: 'bg-purple-500/10 text-purple-400 border-purple-500/25',
        dot: '#A855F7',
      };
  }
};

// ─── High-Fidelity Skeleton Screen ───────────────────────────────────────────

const ProjectsSkeleton: React.FC = () => (
  <div className="w-full space-y-6 animate-pulse text-left">
    {/* Controls Bar Skeleton */}
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="w-24 h-9 rounded-xl bg-zinc-800/60 shrink-0" />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="w-48 h-10 rounded-xl bg-zinc-800/60" />
        <div className="w-10 h-10 rounded-xl bg-zinc-800/60" />
        <div className="w-20 h-10 rounded-xl bg-zinc-800/60" />
      </div>
    </div>

    {/* 2-Column Content Skeleton */}
    <div className="flex flex-col lg:flex-row items-start gap-6 w-full">
      {/* Projects Grid Skeleton */}
      <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-[#0E0F14] border border-[#27272A] space-y-4 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1.5 flex-1">
                <div className="w-40 h-4 rounded bg-zinc-800/80" />
                <div className="w-24 h-3 rounded bg-zinc-800/50" />
              </div>
              <div className="w-20 h-5 rounded-md bg-zinc-800/60" />
            </div>
            <div className="w-full h-8 rounded bg-zinc-800/40" />
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between">
                <div className="w-28 h-2.5 rounded bg-zinc-800/60" />
                <div className="w-10 h-2.5 rounded bg-zinc-800/60" />
              </div>
              <div className="w-full h-1.5 rounded bg-zinc-800/50" />
            </div>
            <div className="pt-3 border-t border-[#1C1D24] flex items-center justify-between">
              <div className="w-24 h-6 rounded bg-zinc-800/50" />
              <div className="w-12 h-4 rounded bg-zinc-800/60" />
            </div>
          </div>
        ))}
      </div>

      {/* Sidebar Skeleton */}
      <div className="w-full lg:w-80 shrink-0 space-y-4">
        <div className="rounded-2xl bg-[#0E0F14] border border-[#27272A] p-5 space-y-3">
          <div className="w-32 h-4 rounded bg-zinc-800/80" />
          <div className="grid grid-cols-2 gap-2 pt-2">
            <div className="h-16 rounded-xl bg-zinc-800/50" />
            <div className="h-16 rounded-xl bg-zinc-800/50" />
          </div>
        </div>
        <div className="rounded-2xl bg-[#0E0F14] border border-[#27272A] p-5 space-y-3">
          <div className="w-36 h-4 rounded bg-zinc-800/80" />
          <div className="space-y-2 pt-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between">
                  <div className="w-20 h-2.5 rounded bg-zinc-800/60" />
                  <div className="w-8 h-2.5 rounded bg-zinc-800/60" />
                </div>
                <div className="w-full h-1.5 rounded bg-zinc-800/40" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const OrganizationProjectsView: React.FC = () => {
  const { organizationSlug } = useParams<{ organizationSlug: string }>();
  const { currentOrganization } = useOrganization();
  const { accentColor } = useAccentTheme();
  const { toast } = useToast();

  const targetSlug = organizationSlug || currentOrganization?.slug;

  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Controls State
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Filter Popover Menu State
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  // Create Project Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newStatus, setNewStatus] = useState<'PLANNING' | 'IN_PROGRESS'>('IN_PROGRESS');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Close filter popover on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setIsFilterMenuOpen(false);
      }
    };
    if (isFilterMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isFilterMenuOpen]);

  // Load projects from server
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

  // Create Project Submit Handler
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error('Project title required', 'Please provide a title for the new project.');
      return;
    }

    setIsSubmitting(true);
    try {
      const user = authService.getUser();
      const payload = {
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        status: newStatus,
        ownerId: user?.id || 1,
        organizationId: currentOrganization?.id,
        organizationSlug: targetSlug,
      };

      const res = await fetch(apiUrl('/projects'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authService.getToken() ? { Authorization: `Bearer ${authService.getToken()}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Project created', `"${newTitle}" has been initiated.`);
        setNewTitle('');
        setNewDescription('');
        setNewStatus('IN_PROGRESS');
        setIsCreateModalOpen(false);
        loadProjects();
      } else {
        toast.error('Failed to create project', data.error || 'Unknown error occurred.');
      }
    } catch (err: any) {
      toast.error('Network error', err.message || 'Could not connect to server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format Date Helper
  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  // Filtered & Sorted Projects
  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Status Tab filter
    if (activeTab !== 'ALL') {
      result = result.filter((p) => p.status === activeTab);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((p) => {
        const title = (p.title || p.name || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        const ownerName = (p.owner?.name || '').toLowerCase();
        return title.includes(q) || desc.includes(q) || ownerName.includes(q);
      });
    }

    // Health / Attention filter
    if (healthFilter === 'attention') {
      result = result.filter((p) => {
        const tasks = p.tasks || [];
        const hasUrgent = tasks.some((t: any) => t.priority === 'URGENT' && t.status !== 'DONE');
        const total = tasks.length || p._count?.tasks || 0;
        const done = tasks.filter((t: any) => t.status === 'DONE').length;
        const pct = total > 0 ? (done / total) * 100 : 0;
        return hasUrgent || (p.status === 'IN_PROGRESS' && pct < 40);
      });
    } else if (healthFilter === 'healthy') {
      result = result.filter((p) => {
        const tasks = p.tasks || [];
        const total = tasks.length || p._count?.tasks || 0;
        const done = tasks.filter((t: any) => t.status === 'DONE').length;
        const pct = total > 0 ? (done / total) * 100 : 0;
        return pct >= 40 || p.status === 'COMPLETED';
      });
    }

    // Sorting
    result.sort((a, b) => {
      const aTitle = a.title || a.name || '';
      const bTitle = b.title || b.name || '';

      if (sortBy === 'title-asc') return aTitle.localeCompare(bTitle);
      if (sortBy === 'title-desc') return bTitle.localeCompare(aTitle);

      const aTasks = a.tasks || [];
      const bTasks = b.tasks || [];
      const aTotal = aTasks.length || a._count?.tasks || 0;
      const bTotal = bTasks.length || b._count?.tasks || 0;
      const aDone = aTasks.filter((t: any) => t.status === 'DONE').length;
      const bDone = bTasks.filter((t: any) => t.status === 'DONE').length;

      if (sortBy === 'tasks') return bTotal - aTotal;

      if (sortBy === 'progress') {
        const aPct = aTotal > 0 ? aDone / aTotal : 0;
        const bPct = bTotal > 0 ? bDone / bTotal : 0;
        return bPct - aPct;
      }

      // Default: recent (updatedAt desc)
      return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
    });

    return result;
  }, [projects, activeTab, searchQuery, healthFilter, sortBy]);

  // Portfolio Analytics for Sidebar
  const analytics = useMemo(() => {
    const total = projects.length;
    const inProgress = projects.filter((p) => p.status === 'IN_PROGRESS').length;
    const planning = projects.filter((p) => p.status === 'PLANNING').length;
    const completed = projects.filter((p) => p.status === 'COMPLETED').length;
    const archived = projects.filter((p) => p.status === 'ARCHIVED').length;

    let totalTasks = 0;
    let completedTasks = 0;

    projects.forEach((p) => {
      const tasks = p.tasks || [];
      totalTasks += tasks.length || p._count?.tasks || 0;
      completedTasks += tasks.filter((t: any) => t.status === 'DONE').length;
    });

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Owners count
    const ownerMap: Record<string, { name: string; count: number; avatarUrl?: string }> = {};
    projects.forEach((p) => {
      const name = p.owner?.name || 'Unassigned';
      if (!ownerMap[name]) {
        ownerMap[name] = { name, count: 0, avatarUrl: p.owner?.avatarUrl };
      }
      ownerMap[name].count += 1;
    });

    const topLeads = Object.values(ownerMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    return {
      total,
      inProgress,
      planning,
      completed,
      archived,
      totalTasks,
      completedTasks,
      completionRate,
      topLeads,
    };
  }, [projects]);

  const isFilterActive = sortBy !== 'recent' || healthFilter !== 'all';

  return (
    <div className="w-full max-w-[1600px] pl-4 sm:pl-8 lg:pl-10 pr-4 sm:pr-8 mr-auto pt-4 sm:pt-6 pb-16 space-y-6 text-left">
      {/* ─── Page Header (Exact Teams / Members Index Typography & Structure) ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#27272A]/70">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-[32px] font-extrabold text-[#FFFFFF] tracking-tight leading-tight">
            Projects
          </h1>
          <p className="text-sm sm:text-[14.5px] text-[#A1A1AA] mt-1.5 leading-relaxed">
            Active engineering roadmaps, sprint initiatives, and deliverables across {currentOrganization?.name || 'organization'}.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadProjects}
            className="inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-xl bg-[#171A21] hover:bg-[#1f232d] border border-[#27272A] text-xs sm:text-sm font-medium text-zinc-300 hover:text-white transition-all cursor-pointer shadow-sm"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-xl hover:brightness-110 active:scale-[0.98] text-[#0A0B10] text-xs sm:text-sm font-semibold transition-all shadow-md cursor-pointer"
            style={{ backgroundColor: accentColor, boxShadow: `0 4px 18px ${accentColor}35` }}
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Create project</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <ProjectsSkeleton />
      ) : (
        /* ─── Main 2-Column Directory Layout ──────────────────────────────── */
        <div className="flex flex-col lg:flex-row items-start gap-6 w-full">
          {/* ─── LEFT COLUMN: Tabs, Controls & Projects Feed ─────────────────── */}
          <div className="flex-1 w-full lg:min-w-0 space-y-4">
            {/* Top Bar: Status Tabs + Search + ListFilter Icon Button + View Mode Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Status Tab Switcher Pills */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#111216] border border-[#27272A] w-fit shadow-inner overflow-x-auto max-w-full scrollbar-none">
                {STATUS_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const count =
                    tab.id === 'ALL'
                      ? projects.length
                      : projects.filter((p) => p.status === tab.id).length;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                        isActive ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="projectActiveTabPill"
                          className="absolute inset-0 rounded-lg shadow-sm"
                          style={{ backgroundColor: `${accentColor}25`, border: `1px solid ${accentColor}50` }}
                          transition={{ duration: 0.18 }}
                        />
                      )}
                      <Icon size={13} className="relative z-10 shrink-0" />
                      <span className="relative z-10">{tab.label}</span>
                      <span
                        className={`relative z-10 px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                          isActive ? 'bg-white/15 text-white' : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Right Controls: Search + ListFilter Popover + View Switcher */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                {/* Search */}
                <div className="relative flex-1 sm:w-60">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search projects..."
                    className="w-full h-10 pl-9 pr-8 rounded-xl bg-[#111216] border border-[#27272A] text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/30 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-1 cursor-pointer"
                      title="Clear search"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Filter & Sort Icon-Only Button + Popover */}
                <div ref={filterMenuRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsFilterMenuOpen((prev) => !prev)}
                    className="relative w-10 h-10 rounded-xl bg-[#111216] border border-[#27272A] hover:border-zinc-500 text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-inner"
                    title="Sort and filter options"
                    aria-label="Sort and filter options"
                  >
                    <ListFilter
                      size={15}
                      className={isFilterActive ? 'text-white' : 'text-zinc-400'}
                      style={isFilterActive ? { color: accentColor } : {}}
                    />
                    {isFilterActive && (
                      <span
                        className="absolute top-2 right-2 w-2 h-2 rounded-full ring-2 ring-[#111216]"
                        style={{ backgroundColor: accentColor }}
                      />
                    )}
                  </button>

                  {/* Popover Menu (No background on icons per user requirement) */}
                  <AnimatePresence>
                    {isFilterMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 4, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-[#14161C]/98 backdrop-blur-xl border border-[#27272A] p-2 shadow-2xl z-50 text-left space-y-1.5"
                      >
                        {/* Section: Sort by */}
                        <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                          <span>Sort by</span>
                          <Calendar size={11} className="text-zinc-500" />
                        </div>

                        <div className="space-y-1">
                          {[
                            {
                              value: 'recent',
                              label: 'Most Recent',
                              sublabel: 'Updated date',
                              icon: <Calendar size={14} className="text-blue-400" />,
                            },
                            {
                              value: 'title-asc',
                              label: 'Name (A → Z)',
                              sublabel: 'Alphabetical',
                              icon: <ArrowDownAZ size={14} className="text-sky-400" />,
                            },
                            {
                              value: 'title-desc',
                              label: 'Name (Z → A)',
                              sublabel: 'Reverse order',
                              icon: <ArrowUpZA size={14} className="text-indigo-400" />,
                            },
                            {
                              value: 'progress',
                              label: 'Highest Progress',
                              sublabel: 'Completion %',
                              icon: <CheckCircle2 size={14} className="text-emerald-400" />,
                            },
                            {
                              value: 'tasks',
                              label: 'Most Tasks',
                              sublabel: 'Scope volume',
                              icon: <FolderKanban size={14} className="text-amber-400" />,
                            },
                          ].map((opt) => {
                            const isSelected = sortBy === opt.value;
                            return (
                              <motion.button
                                key={opt.value}
                                type="button"
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                  setSortBy(opt.value as SortOption);
                                  setIsFilterMenuOpen(false);
                                }}
                                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs sm:text-[12.5px] transition-all cursor-pointer border ${
                                  isSelected
                                    ? 'font-medium shadow-sm'
                                    : 'text-[#D4D4D8] border-transparent hover:bg-white/[0.06] hover:text-white'
                                }`}
                                style={
                                  isSelected
                                    ? {
                                        backgroundColor: `${accentColor}20`,
                                        borderColor: `${accentColor}40`,
                                        color: '#FFFFFF',
                                      }
                                    : undefined
                                }
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <span className="shrink-0 flex items-center justify-center">
                                    {opt.icon}
                                  </span>
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-semibold text-white truncate shrink-0">
                                      {opt.label}
                                    </span>
                                    {opt.sublabel && (
                                      <span className="text-[10px] font-mono text-zinc-400 truncate">
                                        {opt.sublabel}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isSelected && (
                                  <Check
                                    size={13}
                                    strokeWidth={2.5}
                                    className="flex-shrink-0"
                                    style={{ color: accentColor }}
                                  />
                                )}
                              </motion.button>
                            );
                          })}
                        </div>

                        {/* Divider */}
                        <div className="my-1.5 border-t border-[#27272A]/80" />

                        {/* Section: Priority & Health Filter */}
                        <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                          <span>Health & Urgency</span>
                          <TrendingUp size={11} className="text-zinc-500" />
                        </div>

                        <div className="space-y-1">
                          {[
                            {
                              value: 'all',
                              label: 'All Health Status',
                              sublabel: 'Full portfolio',
                              icon: <Clock size={14} className="text-zinc-400" />,
                            },
                            {
                              value: 'attention',
                              label: 'Needs Attention',
                              sublabel: 'Urgent issues or low %',
                              icon: <AlertTriangle size={14} className="text-rose-400" />,
                            },
                            {
                              value: 'healthy',
                              label: 'On Track',
                              sublabel: 'Healthy pace or done',
                              icon: <CheckCircle2 size={14} className="text-emerald-400" />,
                            },
                          ].map((hOpt) => {
                            const isHealthSelected = healthFilter === hOpt.value;
                            return (
                              <motion.button
                                key={hOpt.value}
                                type="button"
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                  setHealthFilter(hOpt.value as HealthFilter);
                                  setIsFilterMenuOpen(false);
                                }}
                                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs sm:text-[12.5px] transition-all cursor-pointer border ${
                                  isHealthSelected
                                    ? 'font-medium shadow-sm'
                                    : 'text-[#D4D4D8] border-transparent hover:bg-white/[0.06] hover:text-white'
                                }`}
                                style={
                                  isHealthSelected
                                    ? {
                                        backgroundColor: `${accentColor}20`,
                                        borderColor: `${accentColor}40`,
                                        color: '#FFFFFF',
                                      }
                                    : undefined
                                }
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <span className="shrink-0 flex items-center justify-center">
                                    {hOpt.icon}
                                  </span>
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-semibold text-white truncate shrink-0">
                                      {hOpt.label}
                                    </span>
                                    {hOpt.sublabel && (
                                      <span className="text-[10px] font-mono text-zinc-400 truncate">
                                        {hOpt.sublabel}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isHealthSelected && (
                                  <Check
                                    size={13}
                                    strokeWidth={2.5}
                                    className="flex-shrink-0"
                                    style={{ color: accentColor }}
                                  />
                                )}
                              </motion.button>
                            );
                          })}
                        </div>

                        {/* Reset button if active */}
                        {isFilterActive && (
                          <div className="pt-1.5 border-t border-[#27272A]/80">
                            <button
                              type="button"
                              onClick={() => {
                                setSortBy('recent');
                                setHealthFilter('all');
                                setIsFilterMenuOpen(false);
                              }}
                              className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-mono text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer group"
                            >
                              <RefreshCw size={11} className="transition-transform group-hover:rotate-180 duration-300" />
                              <span>Reset filters & sort</span>
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* View Switcher: Grid / List */}
                <div className="p-1 rounded-xl bg-[#111216] border border-[#27272A] flex items-center gap-1 shadow-inner shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      viewMode === 'grid'
                        ? 'text-black shadow-sm font-bold'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                    style={viewMode === 'grid' ? { backgroundColor: accentColor } : {}}
                    title="Grid card view"
                  >
                    <LayoutGrid size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      viewMode === 'list'
                        ? 'text-black shadow-sm font-bold'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                    style={viewMode === 'list' ? { backgroundColor: accentColor } : {}}
                    title="List table view"
                  >
                    <ListIcon size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 flex items-center justify-between text-xs text-red-200">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-red-400" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={loadProjects}
                  className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 font-medium text-white transition-colors cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Empty State */}
            {filteredProjects.length === 0 ? (
              <div className="rounded-2xl border border-[#27272A] bg-[#0E0F14] p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20 shadow-sm">
                  <FolderKanban size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">No projects found</h3>
                  <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                    {searchQuery
                      ? `No projects matching "${searchQuery}". Try clearing search.`
                      : `No projects found under "${activeTab}". Ready to launch a new roadmap?`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#0A0B10] shadow-md cursor-pointer hover:brightness-110"
                  style={{ backgroundColor: accentColor }}
                >
                  <Plus size={14} />
                  <span>Initiate First Project</span>
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              /* ─── 1. GRID CARD VIEW ──────────────────────────────────────── */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredProjects.map((proj) => {
                  const title = proj.title || proj.name || 'Untitled Project';
                  const statusMeta = getStatusBadge(proj.status);
                  const tasks = proj.tasks || [];
                  const totalTasks = tasks.length || proj._count?.tasks || 0;
                  const completedTasks = tasks.filter((t: any) => t.status === 'DONE').length;
                  const percent =
                    totalTasks > 0
                      ? Math.round((completedTasks / totalTasks) * 100)
                      : proj.status === 'COMPLETED'
                      ? 100
                      : 0;

                  // Unique assignees / collaborators
                  const collaboratorMap: Record<string, any> = {};
                  tasks.forEach((t: any) => {
                    if (t.assignee) {
                      collaboratorMap[t.assignee.id] = t.assignee;
                    }
                  });
                  const collaborators = Object.values(collaboratorMap);

                  return (
                    <motion.div
                      key={proj.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group"
                    >
                      <Link
                        to={`/projects/${proj.id}`}
                        className="p-5 rounded-2xl bg-[#0E0F14] border border-[#27272A] hover:border-zinc-600/80 transition-all flex flex-col justify-between shadow-sm text-left h-full space-y-4 cursor-pointer block"
                      >
                        <div className="space-y-3">
                          {/* Top Row: Title + Status Badge */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm sm:text-[15px] font-bold text-white group-hover:text-emerald-300 transition-colors truncate">
                                  {title}
                                </h3>
                                <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                                  #PRJ-{proj.id}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                                {proj.description || 'No project description recorded.'}
                              </p>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider border font-bold shrink-0 flex items-center gap-1 ${statusMeta.color}`}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: statusMeta.dot }}
                              />
                              <span>{statusMeta.label}</span>
                            </span>
                          </div>

                          {/* Progress Bar & Task Completion Metric */}
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="text-zinc-400 text-[11px] flex items-center gap-1.5">
                                <CheckSquare size={12} className="text-zinc-500" />
                                <span>
                                  {completedTasks} / {totalTasks} tasks done
                                </span>
                              </span>
                              <span className="text-white font-semibold text-[11.5px]">{percent}%</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-zinc-800/80 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${percent}%`,
                                  backgroundColor:
                                    percent === 100 ? '#10B981' : percent > 50 ? accentColor : '#6366F1',
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Card Footer: Collaborator Avatars & Open Link */}
                        <div className="pt-3.5 border-t border-[#1C1D24] flex items-center justify-between text-xs">
                          {/* Avatars Stack */}
                          <div className="flex items-center gap-2 min-w-0">
                            {collaborators.length > 0 ? (
                              <div className="flex items-center -space-x-1.5 overflow-hidden">
                                {collaborators.slice(0, 4).map((c: any) => (
                                  <div
                                    key={c.id}
                                    className="w-6 h-6 rounded-full border-2 border-[#0E0F14] bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-white shrink-0 shadow-sm"
                                    title={c.name}
                                  >
                                    {c.avatarUrl ? (
                                      <img
                                        src={c.avatarUrl}
                                        alt={c.name}
                                        className="w-full h-full rounded-full object-cover"
                                      />
                                    ) : (
                                      c.name?.charAt(0).toUpperCase() || 'U'
                                    )}
                                  </div>
                                ))}
                                {collaborators.length > 4 && (
                                  <div className="w-6 h-6 rounded-full border-2 border-[#0E0F14] bg-zinc-800 flex items-center justify-center text-[9px] font-mono text-zinc-400 font-bold shrink-0">
                                    +{collaborators.length - 4}
                                  </div>
                                )}
                              </div>
                            ) : proj.owner ? (
                              <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] truncate">
                                <span className="text-zinc-500">Lead:</span>
                                <span className="text-zinc-200 font-medium truncate">{proj.owner.name}</span>
                              </div>
                            ) : (
                              <span className="text-[11px] font-mono text-zinc-500">No assignees</span>
                            )}
                          </div>

                          {/* Open Project CTA */}
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 group-hover:translate-x-0.5 transition-transform shrink-0">
                            <span>Open</span>
                            <ArrowRight size={13} />
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              /* ─── 2. LIST TABLE VIEW ─────────────────────────────────────── */
              <div className="rounded-2xl border border-[#27272A] bg-[#0E0F14] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#27272A] bg-[#111216] text-[10.5px] font-mono uppercase tracking-wider text-zinc-400">
                        <th className="py-3 px-4">Project Initiative</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Progress</th>
                        <th className="py-3 px-4">Lead & Team</th>
                        <th className="py-3 px-4">Updated</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1C1D24]">
                      {filteredProjects.map((proj) => {
                        const title = proj.title || proj.name || 'Untitled Project';
                        const statusMeta = getStatusBadge(proj.status);
                        const tasks = proj.tasks || [];
                        const totalTasks = tasks.length || proj._count?.tasks || 0;
                        const completedTasks = tasks.filter((t: any) => t.status === 'DONE').length;
                        const percent =
                          totalTasks > 0
                            ? Math.round((completedTasks / totalTasks) * 100)
                            : proj.status === 'COMPLETED'
                            ? 100
                            : 0;

                        return (
                          <tr
                            key={proj.id}
                            className="hover:bg-white/[0.03] transition-colors group cursor-pointer"
                          >
                            <td className="py-3 px-4 min-w-[220px]">
                              <Link to={`/projects/${proj.id}`} className="block">
                                <p className="font-semibold text-white group-hover:text-emerald-300 transition-colors">
                                  {title}
                                </p>
                                <span className="text-[10px] font-mono text-zinc-500">
                                  #PRJ-{proj.id} {proj.description ? `· ${proj.description}` : ''}
                                </span>
                              </Link>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider border font-bold ${statusMeta.color}`}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: statusMeta.dot }}
                                />
                                <span>{statusMeta.label}</span>
                              </span>
                            </td>
                            <td className="py-3 px-4 min-w-[140px]">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10.5px] font-mono">
                                  <span className="text-zinc-400">
                                    {completedTasks}/{totalTasks}
                                  </span>
                                  <span className="text-white font-semibold">{percent}%</span>
                                </div>
                                <div className="w-full h-1 rounded-full bg-zinc-800 overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${percent}%`,
                                      backgroundColor:
                                        percent === 100 ? '#10B981' : percent > 50 ? accentColor : '#6366F1',
                                    }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-zinc-300 whitespace-nowrap">
                              <span className="text-xs font-medium text-zinc-200">
                                {proj.owner?.name || 'Unassigned'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-[11px] font-mono text-zinc-400 whitespace-nowrap">
                              {formatDate(proj.updatedAt || proj.createdAt)}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <Link
                                to={`/projects/${proj.id}`}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-mono text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 transition-colors inline-flex items-center gap-1"
                              >
                                <span>Open</span>
                                <ArrowRight size={11} />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ─── RIGHT SIDEBAR: Portfolio Health & Workload ─────────────────── */}
          <div className="w-full lg:w-80 shrink-0 space-y-4">
            {/* Box 1: Portfolio Health & Execution Velocity */}
            <div className="rounded-2xl bg-[#0E0F14] border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-3.5 text-left">
              <div className="flex items-center justify-between pb-3 border-b border-[#27272A]/80">
                <div className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
                  <TrendingUp size={13} className="text-emerald-400" />
                  <span>Portfolio Velocity</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>ACTIVE</span>
                </div>
              </div>

              {/* Stats Counters */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-[#111216] border border-[#27272A]/80 space-y-1">
                  <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Total Projects</p>
                  <p className="text-xl font-bold text-white font-mono tracking-tight">{analytics.total}</p>
                </div>
                <div className="p-3 rounded-xl bg-[#111216] border border-[#27272A]/80 space-y-1">
                  <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">In Progress</p>
                  <p className="text-xl font-bold font-mono tracking-tight text-indigo-400">
                    {analytics.inProgress}
                  </p>
                </div>
              </div>

              {/* Overall Completion Metric */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 text-[11px]">Portfolio Completion</span>
                  <span className="text-white font-mono font-semibold">{analytics.completionRate}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-zinc-800/80 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${analytics.completionRate}%`,
                      backgroundColor: accentColor,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-0.5">
                  <span>{analytics.completedTasks} completed</span>
                  <span>{analytics.totalTasks} total tasks</span>
                </div>
              </div>
            </div>

            {/* Box 2: Status Breakdown */}
            <div className="rounded-2xl bg-[#0E0F14] border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-3.5 text-left">
              <div className="flex items-center justify-between pb-3 border-b border-[#27272A]/80">
                <div className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
                  <Layers size={13} className="text-purple-400" />
                  <span>Roadmap Stages</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">Distribution</span>
              </div>

              <div className="space-y-3">
                {[
                  {
                    label: 'In Progress',
                    count: analytics.inProgress,
                    color: '#6366F1',
                  },
                  {
                    label: 'Planning',
                    count: analytics.planning,
                    color: '#F59E0B',
                  },
                  {
                    label: 'Completed',
                    count: analytics.completed,
                    color: '#10B981',
                  },
                  {
                    label: 'Archived',
                    count: analytics.archived,
                    color: '#71717A',
                  },
                ].map((st) => {
                  const percent = analytics.total ? Math.round((st.count / analytics.total) * 100) : 0;
                  return (
                    <div key={st.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: st.color }} />
                          <span>{st.label}</span>
                        </span>
                        <span className="font-mono text-[11px] text-zinc-400">
                          {st.count} ({percent}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-zinc-800/80 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${percent}%`,
                            backgroundColor: st.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Box 3: Project Leads & Ownership */}
            <div className="rounded-2xl bg-[#0E0F14] border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-3.5 text-left">
              <div className="flex items-center justify-between pb-3 border-b border-[#27272A]/80">
                <div className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
                  <Users size={13} className="text-amber-400" />
                  <span>Project Leads</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">Ownership</span>
              </div>

              {analytics.topLeads.length === 0 ? (
                <p className="text-xs text-zinc-500 italic py-2 text-center">No assigned project leads.</p>
              ) : (
                <div className="space-y-2.5">
                  {analytics.topLeads.map((lead) => (
                    <div
                      key={lead.name}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#111216] border border-[#27272A]/60"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                          style={{ backgroundColor: accentColor }}
                        >
                          {lead.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs text-white font-medium truncate">{lead.name}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[10px] font-mono text-zinc-300 font-semibold shrink-0">
                        {lead.count} {lead.count === 1 ? 'project' : 'projects'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Box 4: Quick Launchpad */}
            <div className="rounded-2xl bg-[#0E0F14] border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-3 text-left">
              <div className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
                <Sparkles size={13} className="text-indigo-400" />
                <span>Workspace Launchpad</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Link
                  to={`/organizations/${targetSlug}/teams`}
                  className="p-2.5 rounded-xl bg-[#111216] border border-[#27272A] hover:border-zinc-500 hover:text-white text-zinc-400 transition-colors flex items-center justify-between"
                >
                  <span>Squads</span>
                  <ChevronRight size={12} />
                </Link>
                <Link
                  to={`/organizations/${targetSlug}/members`}
                  className="p-2.5 rounded-xl bg-[#111216] border border-[#27272A] hover:border-zinc-500 hover:text-white text-zinc-400 transition-colors flex items-center justify-between"
                >
                  <span>Members</span>
                  <ChevronRight size={12} />
                </Link>
                <Link
                  to={`/organizations/${targetSlug}/activity`}
                  className="p-2.5 rounded-xl bg-[#111216] border border-[#27272A] hover:border-zinc-500 hover:text-white text-zinc-400 transition-colors flex items-center justify-between"
                >
                  <span>Audit Log</span>
                  <ChevronRight size={12} />
                </Link>
                <Link
                  to={`/organizations/${targetSlug}/settings`}
                  className="p-2.5 rounded-xl bg-[#111216] border border-[#27272A] hover:border-zinc-500 hover:text-white text-zinc-400 transition-colors flex items-center justify-between"
                >
                  <span>Settings</span>
                  <ChevronRight size={12} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Create New Project ─────────────────────────────────────── */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setIsCreateModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="bg-[#0E0F14] border border-[#27272A] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-[#0A0B10]"
                    style={{ backgroundColor: accentColor }}
                  >
                    <FolderKanban size={16} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">Create Project</h3>
                    <p className="text-[11px] text-zinc-400">Initiate a new roadmap or sprint initiative</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-white/[0.05]"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleCreateProject} className="space-y-4">
                {/* Field 1: Project Title */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    Project Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. NextGen API Gateway"
                    className="w-full h-10 px-3 bg-[#111216] border border-[#27272A] rounded-xl text-xs sm:text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-zinc-400"
                  />
                </div>

                {/* Field 2: Description */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Description</label>
                  <textarea
                    rows={3}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="What are the key goals, objectives, and deliverables of this project?"
                    className="w-full p-3 bg-[#111216] border border-[#27272A] rounded-xl text-xs sm:text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-zinc-400 resize-none"
                  />
                </div>

                {/* Field 3: Status Selector */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Initial Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewStatus('IN_PROGRESS')}
                      className={`p-2.5 rounded-xl border text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                        newStatus === 'IN_PROGRESS'
                          ? 'bg-indigo-500/15 border-indigo-500/40 text-white'
                          : 'bg-[#111216] border-[#27272A] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Zap size={14} className="text-indigo-400" />
                        <span>In Progress</span>
                      </div>
                      {newStatus === 'IN_PROGRESS' && <Check size={13} className="text-indigo-400" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewStatus('PLANNING')}
                      className={`p-2.5 rounded-xl border text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                        newStatus === 'PLANNING'
                          ? 'bg-amber-500/15 border-amber-500/40 text-white'
                          : 'bg-[#111216] border-[#27272A] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-amber-400" />
                        <span>Planning</span>
                      </div>
                      {newStatus === 'PLANNING' && <Check size={13} className="text-amber-400" />}
                    </button>
                  </div>
                </div>

                {/* Submit Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#27272A]">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !newTitle.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#0A0B10] disabled:opacity-50 shadow-md hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
                    style={{ backgroundColor: accentColor }}
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <Plus size={14} strokeWidth={2.5} />
                        <span>Initiate Project</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OrganizationProjectsView;

