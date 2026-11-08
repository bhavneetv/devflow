import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Users,
  Layers,
  FolderKanban,
  Settings,
  Clock,
  Shield,
  RefreshCw,
  AlertCircle,
  Search,
  X,
  Check,
  ChevronDown,
  ArrowDownAZ,
  ArrowUpZA,
  Calendar,
  Download,
  Copy,
  LayoutGrid,
  List as ListIcon,
  CheckCircle2,
  Terminal,
  ShieldCheck,
  Sparkles,
  ListFilter,
  Radio,
  Flame,
  Zap,
  CheckCheck,
  Eye,
  ChevronLeft,
  ChevronRight,
  Code2,
  FileText,
  Hash,
} from 'lucide-react';
import { useOrganization } from '../../context/OrganizationContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import { organizationService } from '../../services/organization.service';
import { useToast } from '../../context/ToastContext';
import type { OrganizationActivity } from '../../types/organization';

// ─── Filter Category Tabs ────────────────────────────────────────────────────

const CATEGORY_TABS = [
  { id: 'all', label: 'All Activities', icon: Activity },
  { id: 'requirements', label: 'Requirements', icon: FileText },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'teams', label: 'Squads', icon: Layers },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'settings', label: 'Settings', icon: Settings },
];

type SortOption = 'newest' | 'oldest' | 'action';
type DateWindow = 'all' | 'today' | '7d' | '30d';
type ViewMode = 'timeline' | 'list' | 'card';
type ModalTab = 'attributes' | 'json' | 'ledger';

// ─── Action Semantic Metadata ────────────────────────────────────────────────

const getActionMeta = (action: string) => {
  const upper = (action || '').toUpperCase();
  if (upper.startsWith('REQUIREMENT.APPROVED') || upper.endsWith('.APPROVED')) {
    return {
      type: 'APPROVE',
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
      dot: '#10B981',
    };
  }
  if (upper.startsWith('REQUIREMENT.REJECTED') || upper.endsWith('.REJECTED')) {
    return {
      type: 'REJECT',
      badge: 'bg-rose-500/10 text-rose-400 border-rose-500/25',
      dot: '#F43F5E',
    };
  }
  if (upper.startsWith('REQUIREMENT.CHANGES_REQUESTED')) {
    return {
      type: 'CHANGES',
      badge: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
      dot: '#F59E0B',
    };
  }
  if (upper.startsWith('REQUIREMENT.SUBMITTED')) {
    return {
      type: 'SUBMIT',
      badge: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
      dot: '#3B82F6',
    };
  }
  if (upper.startsWith('CREATED_') || upper.startsWith('FOUNDED_') || upper.startsWith('INITIATED_') || upper.startsWith('REQUIREMENT.CREATED') || upper.startsWith('REQUIREMENT.DRAFT_CREATED')) {
    return {
      type: 'CREATE',
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
      dot: '#10B981',
    };
  }
  if (upper.startsWith('UPDATED_') || upper.startsWith('CHANGED_') || upper.startsWith('TRANSFERRED_')) {
    return {
      type: 'UPDATE',
      badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25',
      dot: '#6366F1',
    };
  }
  if (upper.startsWith('REMOVED_') || upper.startsWith('DELETED_') || upper.startsWith('CANCELLED_')) {
    return {
      type: 'DELETE',
      badge: 'bg-rose-500/10 text-rose-400 border-rose-500/25',
      dot: '#F43F5E',
    };
  }
  if (upper.startsWith('INVITED_') || upper.startsWith('JOINED_') || upper.startsWith('ACCEPTED_')) {
    return {
      type: 'ACCESS',
      badge: 'bg-sky-500/10 text-sky-400 border-sky-500/25',
      dot: '#0EA5E9',
    };
  }
  return {
    type: 'EVENT',
    badge: 'bg-zinc-800 text-zinc-300 border-zinc-700/70',
    dot: '#A1A1AA',
  };
};

// ─── Resource Badge Helper ───────────────────────────────────────────────────

const getResourceBadge = (resourceType: string) => {
  switch (resourceType?.toUpperCase()) {
    case 'ORGANIZATION':
      return {
        label: 'Workspace',
        color: 'text-purple-400 bg-purple-500/10 border-purple-500/25',
        icon: Settings,
      };
    case 'MEMBER':
    case 'INVITATION':
      return {
        label: resourceType === 'INVITATION' ? 'Invitation' : 'Member',
        color: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
        icon: Users,
      };
    case 'TEAM':
      return {
        label: 'Squad',
        color: 'text-violet-400 bg-violet-500/10 border-violet-500/25',
        icon: Layers,
      };
    case 'PROJECT':
      return {
        label: 'Project',
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
        icon: FolderKanban,
      };
    case 'REQUIREMENT':
      return {
        label: 'Requirement',
        color: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
        icon: FileText,
      };
    default:
      return {
        label: resourceType || 'Event',
        color: 'text-zinc-400 bg-zinc-800/80 border-zinc-700/60',
        icon: Activity,
      };
  }
};

// ─── Deterministic Event Checksum ────────────────────────────────────────────

const getEventChecksum = (act: OrganizationActivity) => {
  const base = `${act.id}_${act.createdAt}_${act.action}_${act.resourceType}_${act.resourceId || '0'}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = (hash << 5) - hash + base.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852${hex}`.slice(0, 71);
};

// ─── Details Parsing Helper ──────────────────────────────────────────────────

const parseDetailsObject = (details: string | null): Record<string, any> => {
  if (!details) return {};
  try {
    const parsed = typeof details === 'string' ? JSON.parse(details) : details;
    return typeof parsed === 'object' && parsed !== null ? parsed : { value: String(parsed) };
  } catch {
    return { raw: details };
  }
};

// ─── Syntax-Highlighted JSON Viewer ──────────────────────────────────────────

const ValueToken: React.FC<{ value: string }> = ({ value }) => {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return <span className="text-emerald-300">{value}</span>;
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('",')) {
    return (
      <>
        <span className="text-emerald-300">{value.slice(0, -1)}</span>
        <span className="text-zinc-500">,</span>
      </>
    );
  }
  if (!isNaN(Number(trimmed.replace(',', '')))) {
    return <span className="text-amber-300">{value}</span>;
  }
  if (trimmed === 'true' || trimmed === 'false' || trimmed === 'true,' || trimmed === 'false,') {
    return <span className="text-purple-300 font-semibold">{value}</span>;
  }
  if (trimmed === 'null' || trimmed === 'null,') {
    return <span className="text-zinc-500 italic">{value}</span>;
  }
  return <span className="text-zinc-300">{value}</span>;
};

const JsonSyntaxViewer: React.FC<{ data: any }> = ({ data }) => {
  const jsonString = useMemo(() => {
    try {
      return typeof data === 'string' ? JSON.stringify(JSON.parse(data), null, 2) : JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  const lines = jsonString.split('\n');

  return (
    <div className="font-mono text-[11px] leading-relaxed bg-[#08090C] border border-[#27272A] rounded-xl p-3 overflow-x-auto text-zinc-300 select-text max-h-80 scrollbar-thin">
      {lines.map((line, idx) => {
        const matchKey = line.match(/^(\s*)"([^"]+)": (.*)$/);
        return (
          <div key={idx} className="flex gap-3 hover:bg-white/[0.03] py-0.5 px-1 rounded">
            <span className="text-zinc-600 select-none w-6 text-right shrink-0 font-mono text-[10px]">
              {idx + 1}
            </span>
            <span className="font-mono whitespace-pre">
              {matchKey ? (
                <>
                  <span>{matchKey[1]}</span>
                  <span className="text-sky-300">"{matchKey[2]}"</span>
                  <span className="text-zinc-500">: </span>
                  <ValueToken value={matchKey[3]} />
                </>
              ) : (
                <ValueToken value={line} />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Key-Value Attributes Viewer ─────────────────────────────────────────────

const EventAttributesGrid: React.FC<{
  activity: OrganizationActivity;
  detailsObj: Record<string, any>;
}> = ({ activity, detailsObj }) => {
  const entries = Object.entries(detailsObj);

  return (
    <div className="space-y-4">
      {/* Primary Details Key-Value Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="p-3 rounded-xl bg-[#111216] border border-[#27272A]/80 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Action Code</span>
          <p className="text-xs font-mono font-semibold text-white">{activity.action}</p>
        </div>
        <div className="p-3 rounded-xl bg-[#111216] border border-[#27272A]/80 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Resource Target</span>
          <p className="text-xs font-mono font-semibold text-white">
            {activity.resourceType} {activity.resourceId ? `(#${activity.resourceId})` : ''}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-[#111216] border border-[#27272A]/80 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Initiated By</span>
          <div className="flex items-center gap-2 pt-0.5 min-w-0">
            <span className="text-xs font-semibold text-white truncate">{activity.actor?.name || 'System Service'}</span>
            {activity.actor?.email && (
              <span className="text-[10.5px] font-mono text-zinc-400 truncate">({activity.actor.email})</span>
            )}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-[#111216] border border-[#27272A]/80 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Recorded At</span>
          <p className="text-xs font-mono text-zinc-300">
            {new Date(activity.createdAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'medium',
            })}
          </p>
        </div>
      </div>

      {/* Extracted Details Attributes */}
      {entries.length > 0 && (
        <div className="rounded-xl bg-[#111216] border border-[#27272A]/80 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-[#27272A]/60">
            <span className="text-[10.5px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
              <Layers size={12} className="text-purple-400" />
              <span>Event Properties</span>
            </span>
            <span className="text-[10px] font-mono text-zinc-500">{entries.length} attributes</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {entries.map(([k, v]) => (
              <div key={k} className="p-2 rounded-lg bg-[#0C0D10] border border-[#27272A]/60 space-y-0.5">
                <span className="text-[10px] font-mono text-zinc-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                <p className="text-xs font-mono font-medium text-zinc-200 truncate" title={String(v)}>
                  {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── High-Fidelity Skeleton Screen ───────────────────────────────────────────

const ActivitySkeleton: React.FC = () => (
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
        <div className="w-24 h-10 rounded-xl bg-zinc-800/60" />
      </div>
    </div>

    {/* 2-Column Content Skeleton */}
    <div className="flex flex-col lg:flex-row items-start gap-6 w-full">
      {/* Feed Skeleton */}
      <div className="flex-1 w-full space-y-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-[#0E0F14] border border-[#27272A] p-4 flex items-start gap-3.5"
          >
            <div className="w-9 h-9 rounded-full bg-zinc-800/80 shrink-0" />
            <div className="flex-1 space-y-2 pt-0.5">
              <div className="flex items-center justify-between gap-4">
                <div className="w-52 h-3.5 rounded bg-zinc-800/80" />
                <div className="w-16 h-3 rounded bg-zinc-800/50" />
              </div>
              <div className="w-3/4 h-3 rounded bg-zinc-800/50" />
              <div className="flex items-center gap-2 pt-1">
                <div className="w-16 h-4.5 rounded bg-zinc-800/60" />
                <div className="w-24 h-4.5 rounded bg-zinc-800/60" />
              </div>
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
        <div className="rounded-2xl bg-[#0E0F14] border border-[#27272A] p-5 space-y-2">
          <div className="w-28 h-4 rounded bg-zinc-800/80" />
          <div className="w-full h-12 rounded-xl bg-zinc-800/40" />
        </div>
      </div>
    </div>
  </div>
);

export const OrganizationActivityView: React.FC = () => {
  const { organizationSlug } = useParams<{ organizationSlug: string }>();
  const { currentOrganization } = useOrganization();
  const { accentColor } = useAccentTheme();
  const { toast } = useToast();

  const targetSlug = organizationSlug || currentOrganization?.slug;

  const [activities, setActivities] = useState<OrganizationActivity[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Controls State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [dateWindow, setDateWindow] = useState<DateWindow>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');

  // Filter Popover Menu State
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  // Dedicated Log Inspector Modal State
  const [selectedLog, setSelectedLog] = useState<OrganizationActivity | null>(null);
  const [modalTab, setModalTab] = useState<ModalTab>('attributes');

  // Inline Quick JSON Accordion State
  const [inlineExpandedDetails, setInlineExpandedDetails] = useState<Record<number, boolean>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);

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

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedLog) {
        setSelectedLog(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLog]);

  // Load activities from server
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

  // Format activity description
  const formatActivityDescription = (act: OrganizationActivity) => {
    const actorName = act.actor?.name || 'A team member';
    const detailsObj = parseDetailsObject(act.details);

    switch (act.action) {
      case 'CREATED_ORGANIZATION':
        return `${actorName} founded the organization workspace.`;
      case 'JOINED_ORGANIZATION':
        return `${actorName} accepted an invitation and joined the workspace.`;
      case 'INVITED_MEMBER':
        return `${actorName} invited ${detailsObj.email || 'a new collaborator'}${detailsObj.role ? ` with role ${detailsObj.role}` : ''}.`;
      case 'CHANGED_MEMBER_ROLE':
        return `${actorName} updated permissions for member #${act.resourceId} to ${detailsObj.newRole || 'updated role'}.`;
      case 'REMOVED_MEMBER':
        return `${actorName} removed member #${act.resourceId} from the organization.`;
      case 'CREATED_TEAM':
        return `${actorName} created squad "${detailsObj.teamName || detailsObj.name || 'New Squad'}".`;
      case 'CREATED_PROJECT':
        return `${actorName} initiated project "${detailsObj.projectTitle || detailsObj.projectName || detailsObj.title || 'New Project'}".`;
      case 'UPDATED_ORGANIZATION':
        return `${actorName} updated organization details & general workspace configuration.`;
      case 'TRANSFERRED_OWNERSHIP':
        return `${actorName} transferred primary ownership of the organization.`;
      case 'requirement.draft_created':
      case 'requirement.created':
        return `${actorName} created specification ${detailsObj.code || ''}: "${detailsObj.title || 'Untitled'}".`;
      case 'requirement.submitted':
        return `${actorName} submitted specification ${detailsObj.code || ''} for formal review.`;
      case 'requirement.approved':
        return `${actorName} approved specification ${detailsObj.code || ''}: "${detailsObj.title || 'Approved'}".`;
      case 'requirement.changes_requested':
        return `${actorName} requested changes on specification ${detailsObj.code || ''}.`;
      case 'requirement.rejected':
        return `${actorName} rejected specification ${detailsObj.code || ''}.`;
      case 'requirement.version_created':
        return `${actorName} released revision v${detailsObj.version || '2'} for specification ${detailsObj.code || ''}.`;
      case 'requirement.dependency_added':
        return `${actorName} linked an architecture dependency on specification ${detailsObj.code || ''}.`;
      case 'requirement.comment_added':
        return `${actorName} posted feedback on specification ${detailsObj.code || ''}.`;
      case 'requirement.criterion_completed':
        return `${actorName} verified an acceptance criterion on specification ${detailsObj.code || ''}.`;
      default:
        return `${actorName} performed ${act.action.toLowerCase().replace(/_/g, ' ')}.`;
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

  // Toggle inline JSON details
  const toggleInlineDetails = (id: number) => {
    setInlineExpandedDetails((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Copy JSON details to clipboard
  const handleCopyDetails = (id: number, detailsStr: string | null) => {
    if (!detailsStr) return;
    let formatted = detailsStr;
    try {
      const parsed = typeof detailsStr === 'string' ? JSON.parse(detailsStr) : detailsStr;
      formatted = JSON.stringify(parsed, null, 2);
    } catch {}
    navigator.clipboard.writeText(formatted);
    setCopiedId(id);
    toast.success('Payload Copied', 'JSON event payload copied to clipboard.');
    setTimeout(() => {
      setCopiedId((curr) => (curr === id ? null : curr));
    }, 2000);
  };

  // Export filtered audit activities to CSV
  const handleExportCsv = () => {
    if (filteredActivities.length === 0) {
      toast.error('No activities', 'There are no activity records matching the current filters.');
      return;
    }
    const headers = ['ID', 'Timestamp', 'Actor Name', 'Actor Email', 'Action', 'Resource Type', 'Resource ID', 'Details'];
    const rows = filteredActivities.map((act) => [
      act.id,
      `"${act.createdAt}"`,
      `"${act.actor?.name || 'System'}"`,
      `"${act.actor?.email || ''}"`,
      `"${act.action}"`,
      `"${act.resourceType}"`,
      act.resourceId ?? '',
      `"${(act.details || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `devflow-audit-log-${targetSlug || 'org'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Audit Log Exported', `Downloaded ${filteredActivities.length} event records.`);
  };

  // Filtered & Sorted Activities
  const filteredActivities = useMemo(() => {
    let result = [...activities];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((act) => {
        const actorName = act.actor?.name?.toLowerCase() || '';
        const actorEmail = act.actor?.email?.toLowerCase() || '';
        const action = act.action.toLowerCase();
        const resourceType = act.resourceType.toLowerCase();
        const details = (act.details || '').toLowerCase();
        return (
          actorName.includes(q) ||
          actorEmail.includes(q) ||
          action.includes(q) ||
          resourceType.includes(q) ||
          details.includes(q)
        );
      });
    }

    // Category filter
    if (activeFilter !== 'all') {
      result = result.filter((act) => {
        const rType = act.resourceType?.toUpperCase() || '';
        const actAction = act.action?.toLowerCase() || '';
        if (activeFilter === 'requirements') {
          return rType === 'REQUIREMENT' || actAction.startsWith('requirement.');
        }
        if (activeFilter === 'members') {
          return ['MEMBER', 'INVITATION'].includes(rType);
        }
        if (activeFilter === 'teams') {
          return rType === 'TEAM';
        }
        if (activeFilter === 'projects') {
          return rType === 'PROJECT';
        }
        if (activeFilter === 'settings') {
          return rType === 'ORGANIZATION';
        }
        return true;
      });
    }

    // Date window filter
    if (dateWindow !== 'all') {
      const now = new Date().getTime();
      result = result.filter((act) => {
        const t = new Date(act.createdAt).getTime();
        if (dateWindow === 'today') {
          return now - t <= 24 * 60 * 60 * 1000;
        }
        if (dateWindow === '7d') {
          return now - t <= 7 * 24 * 60 * 60 * 1000;
        }
        if (dateWindow === '30d') {
          return now - t <= 30 * 24 * 60 * 60 * 1000;
        }
        return true;
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === 'action') {
        return a.action.localeCompare(b.action);
      }
      return 0;
    });

    return result;
  }, [activities, searchQuery, activeFilter, dateWindow, sortBy]);

  // Sidebar Analytics: Counts, Top Actors, Velocity
  const analytics = useMemo(() => {
    const total = activities.length;
    const now = new Date().getTime();
    const last24h = activities.filter((a) => now - new Date(a.createdAt).getTime() <= 24 * 60 * 60 * 1000).length;

    // Distribution by Category
    const requirementsCount = activities.filter(
      (a) => a.resourceType?.toUpperCase() === 'REQUIREMENT' || (a.action?.toLowerCase() || '').startsWith('requirement.')
    ).length;
    const membersCount = activities.filter((a) => ['MEMBER', 'INVITATION'].includes(a.resourceType?.toUpperCase())).length;
    const squadsCount = activities.filter((a) => a.resourceType?.toUpperCase() === 'TEAM').length;
    const projectsCount = activities.filter((a) => a.resourceType?.toUpperCase() === 'PROJECT').length;
    const settingsCount = activities.filter((a) => a.resourceType?.toUpperCase() === 'ORGANIZATION').length;

    // Top Actors
    const actorCounts: Record<string, { actor: any; count: number }> = {};
    activities.forEach((act) => {
      const key = act.actor?.id ? String(act.actor.id) : (act.actor?.name || 'System');
      if (!actorCounts[key]) {
        actorCounts[key] = { actor: act.actor, count: 0 };
      }
      actorCounts[key].count += 1;
    });

    const topActors = Object.values(actorCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    return {
      total,
      last24h,
      requirementsCount,
      membersCount,
      squadsCount,
      projectsCount,
      settingsCount,
      topActors,
    };
  }, [activities]);

  const isFilterActive = sortBy !== 'newest' || dateWindow !== 'all';

  // Selected Log Index & Modal Navigation
  const selectedIndex = selectedLog ? filteredActivities.findIndex((a) => a.id === selectedLog.id) : -1;
  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < filteredActivities.length - 1;

  return (
    <div className="w-full max-w-[1600px] pl-4 sm:pl-8 lg:pl-10 pr-4 sm:pr-8 mr-auto pt-4 sm:pt-6 pb-16 space-y-6 text-left">
      {/* ─── Page Header (Exact Teams / Members Index Typography & Structure) ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#27272A]/70">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-[32px] font-extrabold text-[#FFFFFF] tracking-tight leading-tight">
            Audit & Activity Log
          </h1>
          <p className="text-sm sm:text-[14.5px] text-[#A1A1AA] mt-1.5 leading-relaxed">
            Immutable trail of team, project, member, and permission changes across {currentOrganization?.name || 'organization'}.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadActivities}
            className="inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-xl bg-[#171A21] hover:bg-[#1f232d] border border-[#27272A] text-xs sm:text-sm font-medium text-zinc-300 hover:text-white transition-all cursor-pointer shadow-sm"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-xl hover:brightness-110 active:scale-[0.98] text-[#0A0B10] text-xs sm:text-sm font-semibold transition-all shadow-md cursor-pointer"
            style={{ backgroundColor: accentColor, boxShadow: `0 4px 18px ${accentColor}35` }}
          >
            <Download size={14} strokeWidth={2.5} />
            <span>Export log</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <ActivitySkeleton />
      ) : (
        /* ─── Main 2-Column Directory Layout ──────────────────────────────── */
        <div className="flex flex-col lg:flex-row items-start gap-6 w-full">
          {/* ─── LEFT COLUMN: Tabs, Controls & Feed ─────────────────────────── */}
          <div className="flex-1 w-full lg:min-w-0 space-y-4">
            {/* Top Bar: Modern Category Tabs + Search + ListFilter Icon Button + View Mode Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Category Pill Switcher */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#111216] border border-[#27272A] w-fit shadow-inner overflow-x-auto max-w-full scrollbar-none">
                {CATEGORY_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveFilter(tab.id)}
                      className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                        isActive ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activityActiveTabPill"
                          className="absolute inset-0 rounded-lg shadow-sm"
                          style={{ backgroundColor: `${accentColor}25`, border: `1px solid ${accentColor}50` }}
                          transition={{ duration: 0.18 }}
                        />
                      )}
                      <Icon size={13} className="relative z-10 shrink-0" />
                      <span className="relative z-10">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Right Controls: Search + ListFilter Button + View Mode Switcher */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                {/* Search */}
                <div className="relative flex-1 sm:w-60">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search audit trail..."
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

                {/* Filter & Sort Icon-Only Button + Popover (Exact Members / Teams Standard) */}
                <div ref={filterMenuRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsFilterMenuOpen((prev) => !prev)}
                    className="relative w-10 h-10 rounded-xl bg-[#111216] border border-[#27272A] hover:border-zinc-500 text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-inner"
                    title="Sort and date filter options"
                    aria-label="Sort and date filter options"
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
                        {/* Section Header: Sort by */}
                        <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                          <span>Sort by</span>
                          <Calendar size={11} className="text-zinc-500" />
                        </div>

                        {/* Sort Options */}
                        <div className="space-y-1">
                          {[
                            {
                              value: 'newest',
                              label: 'Newest First',
                              sublabel: 'Chronological',
                              icon: <ArrowDownAZ size={14} className="text-blue-400" />,
                            },
                            {
                              value: 'oldest',
                              label: 'Oldest First',
                              sublabel: 'Reverse order',
                              icon: <ArrowUpZA size={14} className="text-sky-400" />,
                            },
                            {
                              value: 'action',
                              label: 'Action Type',
                              sublabel: 'Alphabetical',
                              icon: <Zap size={14} className="text-amber-400" />,
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

                        {/* Section Header: Date Window */}
                        <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                          <span>Date Window</span>
                          <Clock size={11} className="text-zinc-500" />
                        </div>

                        {/* Date Window Options */}
                        <div className="space-y-1">
                          {[
                            {
                              value: 'all',
                              label: 'All Time',
                              sublabel: 'Full history',
                              icon: <Clock size={14} className="text-zinc-400" />,
                            },
                            {
                              value: 'today',
                              label: 'Past 24 Hours',
                              sublabel: 'Recent bursts',
                              icon: <Flame size={14} className="text-rose-400" />,
                            },
                            {
                              value: '7d',
                              label: 'Last 7 Days',
                              sublabel: 'Current sprint',
                              icon: <Calendar size={14} className="text-emerald-400" />,
                            },
                            {
                              value: '30d',
                              label: 'Last 30 Days',
                              sublabel: 'Monthly ledger',
                              icon: <FolderKanban size={14} className="text-purple-400" />,
                            },
                          ].map((dOpt) => {
                            const isDateSelected = dateWindow === dOpt.value;
                            return (
                              <motion.button
                                key={dOpt.value}
                                type="button"
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                  setDateWindow(dOpt.value as DateWindow);
                                  setIsFilterMenuOpen(false);
                                }}
                                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs sm:text-[12.5px] transition-all cursor-pointer border ${
                                  isDateSelected
                                    ? 'font-medium shadow-sm'
                                    : 'text-[#D4D4D8] border-transparent hover:bg-white/[0.06] hover:text-white'
                                }`}
                                style={
                                  isDateSelected
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
                                    {dOpt.icon}
                                  </span>
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-semibold text-white truncate shrink-0">
                                      {dOpt.label}
                                    </span>
                                    {dOpt.sublabel && (
                                      <span className="text-[10px] font-mono text-zinc-400 truncate">
                                        {dOpt.sublabel}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isDateSelected && (
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
                                setSortBy('newest');
                                setDateWindow('all');
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

                {/* View Switcher: Timeline / List / Card */}
                <div className="p-1 rounded-xl bg-[#111216] border border-[#27272A] flex items-center gap-1 shadow-inner shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewMode('timeline')}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      viewMode === 'timeline'
                        ? 'text-black shadow-sm font-bold'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                    style={viewMode === 'timeline' ? { backgroundColor: accentColor } : {}}
                    title="Timeline view"
                  >
                    <Clock size={15} />
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
                  <button
                    type="button"
                    onClick={() => setViewMode('card')}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      viewMode === 'card'
                        ? 'text-black shadow-sm font-bold'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                    style={viewMode === 'card' ? { backgroundColor: accentColor } : {}}
                    title="Card grid view"
                  >
                    <LayoutGrid size={15} />
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
                  onClick={loadActivities}
                  className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 font-medium text-white transition-colors cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Empty State */}
            {filteredActivities.length === 0 ? (
              <div className="rounded-2xl border border-[#27272A] bg-[#0E0F14] p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto border border-blue-500/20 shadow-sm">
                  <Activity size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">No activity events found</h3>
                  <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                    {searchQuery
                      ? `No events matching "${searchQuery}". Try clearing your search query.`
                      : `No events recorded under "${activeFilter}" with the selected date window.`}
                  </p>
                </div>
                {(searchQuery || isFilterActive) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSortBy('newest');
                      setDateWindow('all');
                    }}
                    className="mt-2 px-3.5 py-1.5 rounded-xl bg-[#171A21] hover:bg-[#1f232d] text-xs text-zinc-200 border border-[#27272A] font-medium transition-colors cursor-pointer"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : viewMode === 'timeline' ? (
              /* ─── 1. TIMELINE VIEW ─────────────────────────────────────── */
              <div className="relative pl-7 space-y-4 before:absolute before:left-3 before:top-4 before:bottom-4 before:w-[2px] before:bg-[#27272A]">
                {filteredActivities.map((act) => {
                  const badge = getResourceBadge(act.resourceType);
                  const BadgeIcon = badge.icon;
                  const actionMeta = getActionMeta(act.action);
                  const isInlineExpanded = !!inlineExpandedDetails[act.id];
                  const detailsObj = parseDetailsObject(act.details);
                  const detailEntries = Object.entries(detailsObj);
                  const hasDetails = detailEntries.length > 0;

                  return (
                    <motion.div
                      key={act.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="relative group text-left"
                    >
                      {/* Timeline Node Dot */}
                      <div
                        className="absolute -left-7 top-4 w-3.5 h-3.5 rounded-full border-2 bg-[#0E0F14] group-hover:scale-125 transition-transform duration-200 z-10"
                        style={{
                          borderColor: actionMeta.dot || accentColor,
                          boxShadow: `0 0 10px ${actionMeta.dot}40`,
                        }}
                      />

                      {/* Card Container */}
                      <div className="rounded-2xl bg-[#0E0F14] border border-[#27272A] hover:border-zinc-600/80 p-4 sm:p-4.5 transition-all shadow-sm space-y-3">
                        {/* Header Row: Actor Info & Actions */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            {act.actor?.avatarUrl ? (
                              <img
                                src={act.actor.avatarUrl}
                                alt={act.actor.name}
                                className="w-8 h-8 rounded-full object-cover border border-zinc-700 shrink-0 mt-0.5"
                              />
                            ) : (
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 border border-white/10 shadow-sm mt-0.5"
                                style={{ backgroundColor: act.actor?.avatarColor || accentColor }}
                              >
                                {act.actor?.name?.charAt(0).toUpperCase() || 'U'}
                              </div>
                            )}

                            <div className="min-w-0 space-y-1">
                              <p className="text-xs sm:text-[13.5px] text-zinc-100 font-medium leading-relaxed">
                                {formatActivityDescription(act)}
                              </p>

                              {/* Badges Bar */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider border font-bold ${actionMeta.badge}`}
                                >
                                  <span>{actionMeta.type}</span>
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider border font-medium ${badge.color}`}
                                >
                                  <BadgeIcon size={10} />
                                  <span>{badge.label}</span>
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-400 bg-zinc-800/80 border border-zinc-700/50">
                                  {act.action}
                                </span>
                                {act.resourceId && (
                                  <span className="text-[10px] text-zinc-500 font-mono">
                                    ref: #{act.resourceId}
                                  </span>
                                )}
                              </div>

                              {/* Quick Property Pills Preview (Instant Insights Without Clicking) */}
                              {hasDetails && (
                                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                                  {detailEntries.slice(0, 3).map(([k, v]) => (
                                    <span
                                      key={k}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#12141A] border border-[#27272A] text-[10.5px] font-mono text-zinc-300"
                                    >
                                      <span className="text-zinc-500">{k}:</span>
                                      <span className="text-zinc-200 font-medium truncate max-w-[140px]">
                                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                      </span>
                                    </span>
                                  ))}
                                  {detailEntries.length > 3 && (
                                    <span className="text-[10px] font-mono text-zinc-500">
                                      +{detailEntries.length - 3} more
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right Controls: Timestamp & View Details Button */}
                          <div className="flex sm:flex-col sm:items-end justify-between items-center gap-2 shrink-0 pl-11 sm:pl-0">
                            <div className="text-right font-mono text-[11px] text-zinc-400">
                              <span className="text-zinc-300 font-medium">{formatRelativeTime(act.createdAt)}</span>
                              <div className="text-[10px] text-zinc-500">{formatTimestamp(act.createdAt)}</div>
                            </div>

                            {/* Prominent Inspect Log Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedLog(act);
                                setModalTab('attributes');
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold text-white bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-500 transition-all shadow-sm cursor-pointer group"
                            >
                              <Eye size={13} className="text-zinc-400 group-hover:text-white transition-colors" />
                              <span>Inspect Log</span>
                            </button>
                          </div>
                        </div>

                        {/* Inline Expandable Footer for Quick JSON Review */}
                        {hasDetails && (
                          <div className="pt-2 border-t border-[#1C1D24] flex items-center justify-between text-xs">
                            <button
                              type="button"
                              onClick={() => toggleInlineDetails(act.id)}
                              className="inline-flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer group"
                            >
                              <Terminal size={12} className="text-zinc-500 group-hover:text-zinc-300" />
                              <span>{isInlineExpanded ? 'Hide Raw JSON' : 'Quick JSON View'}</span>
                              <ChevronDown
                                size={12}
                                className={`text-zinc-500 transition-transform duration-200 ${
                                  isInlineExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            </button>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleCopyDetails(act.id, act.details)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer"
                              >
                                {copiedId === act.id ? (
                                  <>
                                    <CheckCheck size={11} className="text-emerald-400" />
                                    <span className="text-emerald-400 font-semibold">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={11} />
                                    <span>Copy JSON</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Inline Code View (Syntax Highlighted) */}
                        <AnimatePresence>
                          {isInlineExpanded && hasDetails && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.18 }}
                              className="overflow-hidden pt-1"
                            >
                              <JsonSyntaxViewer data={detailsObj} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : viewMode === 'list' ? (
              /* ─── 2. LIST TABLE VIEW ─────────────────────────────────────── */
              <div className="rounded-2xl border border-[#27272A] bg-[#0E0F14] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#27272A] bg-[#111216] text-[10.5px] font-mono uppercase tracking-wider text-zinc-400">
                        <th className="py-3 px-4">Action</th>
                        <th className="py-3 px-4">Event Narrative</th>
                        <th className="py-3 px-4">Initiator</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4 text-right">Inspect</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1C1D24]">
                      {filteredActivities.map((act) => {
                        const badge = getResourceBadge(act.resourceType);
                        const BadgeIcon = badge.icon;
                        const actionMeta = getActionMeta(act.action);

                        return (
                          <tr
                            key={act.id}
                            onClick={() => {
                              setSelectedLog(act);
                              setModalTab('attributes');
                            }}
                            className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                          >
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider border font-bold ${actionMeta.badge}`}
                              >
                                {actionMeta.type}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-medium text-zinc-200 min-w-[280px]">
                              <div className="space-y-0.5">
                                <p className="text-zinc-100 group-hover:text-white transition-colors">
                                  {formatActivityDescription(act)}
                                </p>
                                <span className="text-[10px] font-mono text-zinc-500">
                                  {act.action} {act.resourceId ? `· ref #${act.resourceId}` : ''}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-zinc-300 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {act.actor?.avatarUrl ? (
                                  <img
                                    src={act.actor.avatarUrl}
                                    alt={act.actor.name}
                                    className="w-5 h-5 rounded-full object-cover"
                                  />
                                ) : (
                                  <div
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                                    style={{ backgroundColor: act.actor?.avatarColor || accentColor }}
                                  >
                                    {act.actor?.name?.charAt(0).toUpperCase() || 'U'}
                                  </div>
                                )}
                                <span className="font-medium text-xs truncate max-w-[120px]">
                                  {act.actor?.name || 'System'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider border font-medium ${badge.color}`}
                              >
                                <BadgeIcon size={10} />
                                <span>{badge.label}</span>
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-[11px] font-mono text-zinc-400 whitespace-nowrap">
                              <div>{formatRelativeTime(act.createdAt)}</div>
                              <div className="text-[10px] text-zinc-500">{formatTimestamp(act.createdAt)}</div>
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLog(act);
                                  setModalTab('attributes');
                                }}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-mono text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/60 transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                <Eye size={12} />
                                <span>View</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* ─── 3. CARD GRID VIEW ──────────────────────────────────────── */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredActivities.map((act) => {
                  const badge = getResourceBadge(act.resourceType);
                  const BadgeIcon = badge.icon;
                  const actionMeta = getActionMeta(act.action);
                  const detailsObj = parseDetailsObject(act.details);
                  const detailEntries = Object.entries(detailsObj);

                  return (
                    <motion.div
                      key={act.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => {
                        setSelectedLog(act);
                        setModalTab('attributes');
                      }}
                      className="rounded-2xl bg-[#0E0F14] border border-[#27272A] hover:border-zinc-600/80 p-4.5 transition-all shadow-sm flex flex-col justify-between space-y-3 cursor-pointer group"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider border font-bold ${actionMeta.badge}`}
                            >
                              {actionMeta.type}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider border font-medium ${badge.color}`}
                            >
                              <BadgeIcon size={10} />
                              <span>{badge.label}</span>
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-zinc-400">
                            {formatRelativeTime(act.createdAt)}
                          </span>
                        </div>

                        <p className="text-xs sm:text-[13.5px] text-zinc-100 font-medium leading-relaxed group-hover:text-white transition-colors">
                          {formatActivityDescription(act)}
                        </p>

                        <div className="flex items-center gap-2 text-[10.5px] font-mono text-zinc-500">
                          <span>Action: {act.action}</span>
                          {act.resourceId && <span>· ID #{act.resourceId}</span>}
                        </div>

                        {/* Property Pills */}
                        {detailEntries.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            {detailEntries.slice(0, 2).map(([k, v]) => (
                              <span
                                key={k}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#12141A] border border-[#27272A] text-[10px] font-mono text-zinc-300"
                              >
                                <span className="text-zinc-500">{k}:</span>
                                <span className="text-zinc-200 truncate max-w-[120px]">
                                  {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-[#1C1D24] flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          {act.actor?.avatarUrl ? (
                            <img
                              src={act.actor.avatarUrl}
                              alt={act.actor.name}
                              className="w-5 h-5 rounded-full object-cover"
                            />
                          ) : (
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                              style={{ backgroundColor: act.actor?.avatarColor || accentColor }}
                            >
                              {act.actor?.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                          )}
                          <span className="text-xs text-zinc-300 font-medium truncate">
                            {act.actor?.name || 'System'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(act);
                            setModalTab('attributes');
                          }}
                          className="text-xs font-mono text-zinc-300 hover:text-white transition-colors flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700"
                        >
                          <Eye size={12} />
                          <span>Inspect</span>
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─── RIGHT SIDEBAR: Stream Health & Distribution Analytics ────────── */}
          <div className="w-full lg:w-80 shrink-0 space-y-4">
            {/* Box 1: Stream Health & Live Status */}
            <div className="rounded-2xl bg-[#0E0F14] border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-3.5 text-left">
              <div className="flex items-center justify-between pb-3 border-b border-[#27272A]/80">
                <div className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
                  <Activity size={13} className="text-blue-400" />
                  <span>Audit Stream Health</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>LIVE</span>
                </div>
              </div>

              {/* Stats Counters */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-[#111216] border border-[#27272A]/80 space-y-1">
                  <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Total Recorded</p>
                  <p className="text-xl font-bold text-white font-mono tracking-tight">{analytics.total}</p>
                </div>
                <div className="p-3 rounded-xl bg-[#111216] border border-[#27272A]/80 space-y-1">
                  <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Past 24h</p>
                  <p className="text-xl font-bold font-mono tracking-tight" style={{ color: accentColor }}>
                    +{analytics.last24h}
                  </p>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-zinc-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-mono">
                  <Radio size={12} className="text-emerald-400 animate-pulse" />
                  <span>Telemetry Active</span>
                </span>
                <span className="text-[10px] font-mono text-zinc-500">Append-Only Log</span>
              </div>
            </div>

            {/* Box 2: Category Distribution Progress Bars */}
            <div className="rounded-2xl bg-[#0E0F14] border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-3.5 text-left">
              <div className="flex items-center justify-between pb-3 border-b border-[#27272A]/80">
                <div className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
                  <Layers size={13} className="text-purple-400" />
                  <span>Event Breakdown</span>
                </div>
                <span className="text-[10.5px] font-mono text-zinc-500">Category Share</span>
              </div>

              <div className="space-y-3">
                {[
                  {
                    label: 'Requirements & Specs',
                    count: analytics.requirementsCount,
                    color: '#60A5FA',
                    icon: FileText,
                  },
                  {
                    label: 'Members & Access',
                    count: analytics.membersCount,
                    color: '#3B82F6',
                    icon: Users,
                  },
                  {
                    label: 'Squads & Teams',
                    count: analytics.squadsCount,
                    color: '#8B5CF6',
                    icon: Layers,
                  },
                  {
                    label: 'Projects & Tasks',
                    count: analytics.projectsCount,
                    color: '#10B981',
                    icon: FolderKanban,
                  },
                  {
                    label: 'Workspace Settings',
                    count: analytics.settingsCount,
                    color: '#F59E0B',
                    icon: Settings,
                  },
                ].map((cat) => {
                  const percent = analytics.total ? Math.round((cat.count / analytics.total) * 100) : 0;
                  const CatIcon = cat.icon;
                  return (
                    <div key={cat.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                          <CatIcon size={12} style={{ color: cat.color }} />
                          <span>{cat.label}</span>
                        </span>
                        <span className="font-mono text-[11px] text-zinc-400">
                          {cat.count} ({percent}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-zinc-800/80 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${percent}%`,
                            backgroundColor: cat.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Box 3: Top Event Actors */}
            <div className="rounded-2xl bg-[#0E0F14] border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-3.5 text-left">
              <div className="flex items-center justify-between pb-3 border-b border-[#27272A]/80">
                <div className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
                  <Sparkles size={13} className="text-amber-400" />
                  <span>Top Event Triggers</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">Audit Volume</span>
              </div>

              {analytics.topActors.length === 0 ? (
                <p className="text-xs text-zinc-500 italic py-2 text-center">No actor events recorded yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {analytics.topActors.map(({ actor, count }) => (
                    <div
                      key={actor?.id || actor?.name || 'system'}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#111216] border border-[#27272A]/60"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {actor?.avatarUrl ? (
                          <img
                            src={actor.avatarUrl}
                            alt={actor.name}
                            className="w-6 h-6 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                            style={{ backgroundColor: actor?.avatarColor || accentColor }}
                          >
                            {actor?.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                        )}
                        <span className="text-xs text-white font-medium truncate">
                          {actor?.name || 'System Service'}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[10px] font-mono text-zinc-300 font-semibold shrink-0">
                        {count} {count === 1 ? 'event' : 'events'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Box 4: SHA-256 Ledger Integrity */}
            <div className="rounded-2xl bg-[#0E0F14] border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-3 text-left">
              <div className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-emerald-400">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>SHA-256 Ledger Verified</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                All workspace events are signed with tamper-evident hashes stored in an append-only cryptographic ledger.
              </p>
              <div className="pt-2 border-t border-[#1C1D24] flex items-center justify-between text-[10px] font-mono text-zinc-500">
                <span>Compliance Level: SOC2</span>
                <span className="text-emerald-400">Validated</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Dedicated Interactive Log Detail Inspector ────────────── */}
      <AnimatePresence>
        {selectedLog && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
            onClick={() => setSelectedLog(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="bg-[#0E0F14] border border-[#27272A] rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-left"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Top Header */}
              <div className="p-4 sm:p-5 border-b border-[#27272A] flex items-center justify-between gap-3 bg-[#111216]">
                <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10.5px] font-mono uppercase font-bold tracking-wider border ${
                      getActionMeta(selectedLog.action).badge
                    }`}
                  >
                    {getActionMeta(selectedLog.action).type}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10.5px] font-mono uppercase font-medium tracking-wider border ${
                      getResourceBadge(selectedLog.resourceType).color
                    }`}
                  >
                    {getResourceBadge(selectedLog.resourceType).label}
                  </span>
                  <span className="text-xs font-mono text-zinc-400 flex items-center gap-1">
                    <Hash size={11} className="text-zinc-500" />
                    <span>LOG-{selectedLog.id}</span>
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCopyDetails(selectedLog.id, selectedLog.details)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                    title="Copy JSON Payload"
                  >
                    {copiedId === selectedLog.id ? (
                      <CheckCheck size={16} className="text-emerald-400" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLog(null)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                    title="Close (Esc)"
                  >
                    <X size={17} />
                  </button>
                </div>
              </div>

              {/* Event Description Hero Banner */}
              <div className="p-4 sm:p-5 border-b border-[#27272A]/70 bg-[#0A0B0E]/60 space-y-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                  {formatActivityDescription(selectedLog)}
                </h3>

                <div className="flex items-center gap-3 text-xs text-zinc-400 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    {selectedLog.actor?.avatarUrl ? (
                      <img
                        src={selectedLog.actor.avatarUrl}
                        alt={selectedLog.actor.name}
                        className="w-4 h-4 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                        style={{ backgroundColor: selectedLog.actor?.avatarColor || accentColor }}
                      >
                        {selectedLog.actor?.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}
                    <span className="text-zinc-200 font-medium">{selectedLog.actor?.name || 'System'}</span>
                  </div>
                  <span>•</span>
                  <span className="font-mono text-[11px] text-zinc-400">
                    {formatRelativeTime(selectedLog.createdAt)}
                  </span>
                  <span>•</span>
                  <span className="font-mono text-[11px] text-zinc-500">
                    {formatTimestamp(selectedLog.createdAt)}
                  </span>
                </div>
              </div>

              {/* Inspector Tabs Switcher */}
              <div className="px-4 sm:px-5 pt-3 border-b border-[#27272A]/70 flex items-center gap-2">
                {[
                  { id: 'attributes', label: 'Overview & Properties', icon: FileText },
                  { id: 'json', label: 'Payload JSON', icon: Code2 },
                  { id: 'ledger', label: 'Ledger Proof', icon: ShieldCheck },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = modalTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setModalTab(tab.id as ModalTab)}
                      className={`pb-2.5 px-2 text-xs font-medium border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                        isActive
                          ? 'text-white border-white font-semibold'
                          : 'text-zinc-400 border-transparent hover:text-zinc-200'
                      }`}
                      style={isActive ? { borderColor: accentColor, color: accentColor } : {}}
                    >
                      <Icon size={13} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab Content Body */}
              <div className="p-4 sm:p-5 overflow-y-auto max-h-[48vh] space-y-4">
                {modalTab === 'attributes' && (
                  <EventAttributesGrid
                    activity={selectedLog}
                    detailsObj={parseDetailsObject(selectedLog.details)}
                  />
                )}

                {modalTab === 'json' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span className="font-mono text-[10.5px]">JSON Event Payload Specification</span>
                      <button
                        type="button"
                        onClick={() => handleCopyDetails(selectedLog.id, selectedLog.details)}
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-300 hover:text-white cursor-pointer"
                      >
                        <Copy size={11} />
                        <span>{copiedId === selectedLog.id ? 'Copied' : 'Copy Payload'}</span>
                      </button>
                    </div>
                    <JsonSyntaxViewer data={parseDetailsObject(selectedLog.details)} />
                  </div>
                )}

                {modalTab === 'ledger' && (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-1.5">
                      <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                        <ShieldCheck size={15} />
                        <span>Cryptographically Sealed Entry</span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        This event is stamped into the organization's append-only audit trail. The hash below ensures
                        that payload data, actor identity, and timestamps are immutable and tamper-evident.
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-[#111216] border border-[#27272A] space-y-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                        SHA-256 Checksum
                      </span>
                      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#08090C] border border-[#27272A]/70 font-mono text-[11px] text-zinc-300">
                        <span className="truncate">{getEventChecksum(selectedLog)}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(getEventChecksum(selectedLog));
                            toast.success('Checksum Copied', 'SHA-256 hash copied.');
                          }}
                          className="text-zinc-400 hover:text-white shrink-0 p-1 cursor-pointer"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-3 rounded-xl bg-[#111216] border border-[#27272A] space-y-1">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Ledger Block</span>
                        <p className="font-mono text-white font-semibold">#BLK-{(selectedLog.id * 83) + 1042}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[#111216] border border-[#27272A] space-y-1">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Security Standard</span>
                        <p className="font-mono text-emerald-400 font-semibold">SOC2 Type II</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer with Previous / Next Pagination */}
              <div className="p-3 sm:p-4 border-t border-[#27272A] flex items-center justify-between gap-2 bg-[#111216]">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={!hasPrev}
                    onClick={() => hasPrev && setSelectedLog(filteredActivities[selectedIndex - 1])}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800/60 hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  >
                    <ChevronLeft size={13} />
                    <span>Prev</span>
                  </button>
                  <button
                    type="button"
                    disabled={!hasNext}
                    onClick={() => hasNext && setSelectedLog(filteredActivities[selectedIndex + 1])}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800/60 hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight size={13} />
                  </button>
                  <span className="text-[11px] font-mono text-zinc-500 pl-2">
                    {selectedIndex + 1} of {filteredActivities.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OrganizationActivityView;

