import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderKanban,
  ArrowLeft,
  Save,
  Trash2,
  AlertTriangle,
  Check,
  X,
  Search,
  Users,
  Building2,
  Calendar,
  Clock,
  Zap,
  CheckCircle2,
  PauseCircle,
  Layers,
  Flame,
  ArrowUp,
  Equal,
  ArrowDown,
  Smile,
  MoreHorizontal,
  Loader2,
  Sparkles,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import {
  QUICK_AVATAR_ICONS,
  MORE_AVATAR_ICONS,
  AVATAR_COLORS,
} from '../../types/onboarding';
import { AVATAR_ICON_COMPONENTS } from '../../components/onboarding/StepProfile';
import { AnimatedSelect, AnimatedMultiSelect } from '../../components/settings/AnimatedSelect';
import { CustomDatePicker } from '../../components/settings/CustomDatePicker';
import { SettingsSectionNav, SettingsCategory } from '../../components/settings/SettingsSectionNav';
import { SettingsSection } from '../../components/settings/SettingsSection';
import { SettingsRow } from '../../components/settings/SettingsRow';
import { organizationService } from '../../services/organization.service';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import { useToast } from '../../context/ToastContext';
import { apiUrl } from '../../config/api';

const SETTINGS_CATEGORIES: SettingsCategory[] = [
  { id: 'general', label: 'General & Workflow' },
  { id: 'appearance', label: 'Appearance & Avatar' },
  { id: 'team', label: 'Team & Ownership' },
  { id: 'timeline', label: 'Timeline & Schedule' },
  { id: 'danger', label: 'Danger Zone' },
];

const PREDEFINED_CATEGORIES = [
  'Core Platform',
  'Backend Services',
  'Frontend UI',
  'Design System',
  'Mobile App',
  'Cloud Ops & Infra',
  'DevOps & CI/CD',
  'Security & Auth',
  'AI & Machine Learning',
  'Analytics & Data',
];

const STATUS_OPTIONS = [
  {
    id: 'IN_PROGRESS',
    label: 'In Progress',
    sublabel: 'Active development sprint',
    icon: Zap,
    color: '#6366F1',
    badgeClass: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  },
  {
    id: 'PLANNING',
    label: 'Backlog / Planning',
    sublabel: 'Scoping & architecture',
    icon: Clock,
    color: '#F59E0B',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  {
    id: 'PENDING',
    label: 'Pending / On Hold',
    sublabel: 'Awaiting dependencies',
    icon: PauseCircle,
    color: '#38BDF8',
    badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  },
  {
    id: 'COMPLETED',
    label: 'Completed',
    sublabel: 'Delivered & in production',
    icon: CheckCircle2,
    color: '#10B981',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  {
    id: 'ARCHIVED',
    label: 'Archived',
    sublabel: 'Legacy or deprecated',
    icon: Layers,
    color: '#71717A',
    badgeClass: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  },
];

const PRIORITY_OPTIONS = [
  {
    id: 'URGENT',
    label: 'Urgent',
    icon: Flame,
    color: '#EF4444',
    badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30',
  },
  {
    id: 'HIGH',
    label: 'High',
    icon: ArrowUp,
    color: '#F97316',
    badgeClass: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  },
  {
    id: 'MEDIUM',
    label: 'Medium',
    icon: Equal,
    color: '#3B82F6',
    badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  },
  {
    id: 'LOW',
    label: 'Low',
    icon: ArrowDown,
    color: '#A1A1AA',
    badgeClass: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  },
];

interface WorkspaceUser {
  id: number;
  name: string;
  username?: string | null;
  email: string;
  avatarType?: 'initials' | 'icon' | 'upload';
  avatarUrl?: string | null;
  avatarColor?: string | null;
  avatarId?: string | null;
  jobTitle?: string | null;
}

interface OrganizationTeam {
  id: number;
  name: string;
  color?: string;
  description?: string;
}

function parseTeamMetadata(description?: string | null, teamName?: string) {
  let key = '';
  let icon = 'initials';
  let cleanDesc = description || '';

  if (cleanDesc) {
    const keyMatch = cleanDesc.match(/\[key:([^\]]+)\]/);
    if (keyMatch) {
      key = keyMatch[1];
      cleanDesc = cleanDesc.replace(keyMatch[0], '').trim();
    }
    const iconMatch = cleanDesc.match(/\[icon:([^\]]+)\]/);
    if (iconMatch) {
      icon = iconMatch[1];
      cleanDesc = cleanDesc.replace(iconMatch[0], '').trim();
    }
  }

  if (!key && teamName) {
    const words = teamName.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      key = words.slice(0, 4).map((w) => w[0]?.toUpperCase()).join('').slice(0, 5);
    } else {
      key = teamName.slice(0, 3).toUpperCase();
    }
  }

  return { key: key || 'TEAM', icon, cleanDesc };
}

function parseProjectMetadata(description?: string | null) {
  let cleanDesc = description || '';
  let brief = '';

  if (cleanDesc) {
    const briefMatch = cleanDesc.match(/\[brief:([^\]]+)\]/);
    if (briefMatch) {
      brief = briefMatch[1];
      cleanDesc = cleanDesc.replace(briefMatch[0], '').trim();
    }
  }

  return { cleanDesc, brief };
}

function serializeProjectDescription(cleanDesc: string, brief?: string) {
  let result = cleanDesc.trim();
  if (brief && brief.trim()) {
    result = `[brief:${brief.trim()}] ${result}`.trim();
  }
  return result;
}

export const ProjectSettingsView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { currentOrganization } = useOrganization();
  const { accentColor } = useAccentTheme();

  const projectId = id ? parseInt(id, 10) : 1;

  const [loading, setLoading] = useState(true);
  const [initialProject, setInitialProject] = useState<any>(null);

  // General Form State
  const [title, setTitle] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [briefDescription, setBriefDescription] = useState('');
  const [description, setDescription] = useState('');
  const [availableCategories, setAvailableCategories] = useState<string[]>(PREDEFINED_CATEGORIES);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('IN_PROGRESS');
  const [priority, setPriority] = useState<string>('MEDIUM');

  // Appearance State
  const [avatarType, setAvatarType] = useState<'icon' | 'initials'>('icon');
  const [avatarId, setAvatarId] = useState<string>('folder');
  const [avatarColor, setAvatarColor] = useState<string>('#8B5CF6');
  const [showMoreIcons, setShowMoreIcons] = useState(false);
  const moreButtonRef = useRef<HTMLDivElement>(null);

  // Team & Ownership State
  const [dbUsers, setDbUsers] = useState<WorkspaceUser[]>([]);
  const [dbTeams, setDbTeams] = useState<OrganizationTeam[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const memberDropdownRef = useRef<HTMLDivElement>(null);

  // Timeline State
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Save / Discard / Delete State
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationPhrase, setDeleteConfirmationPhrase] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Close more icons and member dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (moreButtonRef.current && !moreButtonRef.current.contains(target)) {
        setShowMoreIcons(false);
      }
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(target)) {
        setIsMemberDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Fetch Project & Workspace Resources
  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      setLoading(true);
      try {
        const [projRes, usersRes, teamsRes] = await Promise.all([
          organizationService.getProject(projectId),
          fetch(apiUrl('/users')).then((r) => r.json()).catch(() => ({ success: false })),
          currentOrganization?.slug
            ? organizationService.listTeams(currentOrganization.slug)
            : Promise.resolve({ success: false, data: [] }),
        ]);

        if (!isMounted) return;

        if (usersRes.success && Array.isArray(usersRes.data)) {
          setDbUsers(usersRes.data);
        }
        if (teamsRes.success && Array.isArray(teamsRes.data)) {
          setDbTeams(teamsRes.data);
        }

        if (projRes.success && projRes.data) {
          const p = projRes.data;
          setInitialProject(p);

          setTitle(p.title || '');
          setIdentifier(p.identifier || '');
          const meta = parseProjectMetadata(p.description);
          setBriefDescription(meta.brief || '');
          setDescription(meta.cleanDesc || '');

          // Categories
          if (p.category) {
            const cats = p.category.split(',').map((c: string) => c.trim()).filter(Boolean);
            setSelectedCategories(cats);
            setAvailableCategories((prev) => {
              const combined = new Set([...prev, ...cats]);
              return Array.from(combined);
            });
          } else {
            setSelectedCategories([]);
          }

          setStatus(p.status || 'IN_PROGRESS');
          setPriority(p.priority || 'MEDIUM');

          // Avatar
          setAvatarColor(p.avatarColor || '#8B5CF6');
          if (p.avatarIcon) {
            setAvatarId(p.avatarIcon);
            setAvatarType('icon');
          } else {
            setAvatarType('initials');
          }

          // Team & Lead
          setSelectedLeadId(p.leadId || p.lead?.id || null);
          setSelectedTeamId(p.teamId || p.team?.id || null);

          // Members
          if (Array.isArray(p.members)) {
            const memberIds = p.members.map((m: any) => m.userId || m.user?.id).filter(Boolean);
            setSelectedMemberIds(memberIds);
          }

          // Dates
          if (p.startDate) {
            setStartDate(new Date(p.startDate).toISOString().split('T')[0]);
          } else {
            setStartDate('');
          }
          if (p.endDate) {
            setEndDate(new Date(p.endDate).toISOString().split('T')[0]);
          } else {
            setEndDate('');
          }
        }
      } catch (err: any) {
        console.error('Failed to load project settings:', err);
        toast.error('Error', 'Failed to load project details');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [projectId, currentOrganization?.slug]);

  // Compute Initials
  const projectInitials = useMemo(() => {
    if (identifier.trim()) return identifier.trim().slice(0, 2);
    const clean = title.trim();
    if (!clean) return 'PR';
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  }, [identifier, title]);

  // Check Dirty State
  const isDirty = useMemo(() => {
    if (!initialProject) return false;
    const origCats = initialProject.category
      ? initialProject.category.split(',').map((c: string) => c.trim()).filter(Boolean)
      : [];
    const sameCats =
      origCats.length === selectedCategories.length &&
      origCats.every((c: string) => selectedCategories.includes(c));

    const origMemberIds = Array.isArray(initialProject.members)
      ? initialProject.members.map((m: any) => m.userId || m.user?.id).filter(Boolean)
      : [];
    const sameMembers =
      origMemberIds.length === selectedMemberIds.length &&
      origMemberIds.every((id: number) => selectedMemberIds.includes(id));

    const origStart = initialProject.startDate
      ? new Date(initialProject.startDate).toISOString().split('T')[0]
      : '';
    const origEnd = initialProject.endDate
      ? new Date(initialProject.endDate).toISOString().split('T')[0]
      : '';

    const origMeta = parseProjectMetadata(initialProject.description);

    return (
      title !== (initialProject.title || '') ||
      identifier !== (initialProject.identifier || '') ||
      briefDescription !== (origMeta.brief || '') ||
      description !== (origMeta.cleanDesc || '') ||
      status !== (initialProject.status || 'IN_PROGRESS') ||
      priority !== (initialProject.priority || 'MEDIUM') ||
      avatarColor !== (initialProject.avatarColor || '#8B5CF6') ||
      (avatarType === 'icon' ? avatarId : '') !== (initialProject.avatarIcon || '') ||
      selectedLeadId !== (initialProject.leadId || null) ||
      selectedTeamId !== (initialProject.teamId || null) ||
      !sameCats ||
      !sameMembers ||
      startDate !== origStart ||
      endDate !== origEnd
    );
  }, [
    initialProject,
    title,
    identifier,
    briefDescription,
    description,
    status,
    priority,
    avatarColor,
    avatarType,
    avatarId,
    selectedLeadId,
    selectedTeamId,
    selectedCategories,
    selectedMemberIds,
    startDate,
    endDate,
  ]);

  // Reset Form
  const handleDiscardChanges = () => {
    if (!initialProject) return;
    setTitle(initialProject.title || '');
    setIdentifier(initialProject.identifier || '');
    const origMeta = parseProjectMetadata(initialProject.description);
    setBriefDescription(origMeta.brief || '');
    setDescription(origMeta.cleanDesc || '');
    setStatus(initialProject.status || 'IN_PROGRESS');
    setPriority(initialProject.priority || 'MEDIUM');
    setAvatarColor(initialProject.avatarColor || '#8B5CF6');

    if (initialProject.avatarIcon) {
      setAvatarId(initialProject.avatarIcon);
      setAvatarType('icon');
    } else {
      setAvatarType('initials');
    }

    if (initialProject.category) {
      setSelectedCategories(
        initialProject.category.split(',').map((c: string) => c.trim()).filter(Boolean)
      );
    } else {
      setSelectedCategories([]);
    }

    setSelectedLeadId(initialProject.leadId || null);
    setSelectedTeamId(initialProject.teamId || null);

    if (Array.isArray(initialProject.members)) {
      setSelectedMemberIds(
        initialProject.members.map((m: any) => m.userId || m.user?.id).filter(Boolean)
      );
    }

    setStartDate(
      initialProject.startDate
        ? new Date(initialProject.startDate).toISOString().split('T')[0]
        : ''
    );
    setEndDate(
      initialProject.endDate
        ? new Date(initialProject.endDate).toISOString().split('T')[0]
        : ''
    );
  };

  // Save Changes
  const handleSaveChanges = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error('Validation Error', 'Project name cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      const fullDescription = serializeProjectDescription(description, briefDescription);
      const payload = {
        title: trimmedTitle,
        identifier: identifier.trim() || undefined,
        description: fullDescription || undefined,
        status,
        priority,
        category: selectedCategories.length > 0 ? selectedCategories.join(', ') : 'General',
        avatarColor,
        avatarIcon: avatarType === 'icon' ? avatarId : null,
        startDate: startDate || null,
        endDate: endDate || null,
        leadId: selectedLeadId || null,
        teamId: selectedTeamId || null,
        memberIds: selectedMemberIds,
      };

      const res = await organizationService.updateProject(projectId, payload);
      if (res.success) {
        setInitialProject(res.data);
        toast.success('Project Settings Saved', `Changes to "${trimmedTitle}" have been saved.`);
      } else {
        throw new Error(res.error || 'Failed to save project settings');
      }
    } catch (err: any) {
      console.error('Failed to update project:', err);
      toast.error('Error', err.message || 'Failed to update project settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Project
  const handleDeleteProject = async () => {
    if (deleteConfirmationPhrase.trim() !== (initialProject?.title || '').trim()) {
      toast.error('Confirmation mismatch', 'Please type the project title exactly to confirm.');
      return;
    }

    setIsDeleting(true);
    try {
      const res = await organizationService.deleteProject(projectId);
      if (res.success) {
        toast.success('Project Deleted', `"${initialProject?.title}" has been permanently removed.`);
        navigate(
          currentOrganization?.slug
            ? `/organizations/${currentOrganization.slug}/projects`
            : '/projects'
        );
      } else {
        throw new Error(res.error || 'Failed to delete project');
      }
    } catch (err: any) {
      console.error('Failed to delete project:', err);
      toast.error('Error', err.message || 'Failed to delete project');
      setIsDeleting(false);
    }
  };

  // Toggle member
  const handleToggleMember = (userId: number) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // Helpers
  const renderUserAvatar = (user: WorkspaceUser, sizeClass = 'w-6 h-6', iconSize = 12) => {
    if (user.avatarUrl) {
      return (
        <img
          src={user.avatarUrl}
          alt={user.name}
          className={`${sizeClass} rounded-full object-cover shrink-0 border border-white/10`}
        />
      );
    }
    if (user.avatarType === 'icon' && user.avatarId) {
      const IconComp = AVATAR_ICON_COMPONENTS[user.avatarId] || Smile;
      return (
        <div
          className={`${sizeClass} rounded-full flex items-center justify-center text-white shrink-0`}
          style={{ backgroundColor: user.avatarColor || accentColor }}
        >
          <IconComp size={iconSize} strokeWidth={2.2} />
        </div>
      );
    }
    const initials =
      user.name
        ?.split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join('') || user.username?.slice(0, 2).toUpperCase() || 'U';

    return (
      <div
        className={`${sizeClass} rounded-full flex items-center justify-center text-white font-mono font-bold text-[10px] shrink-0`}
        style={{ backgroundColor: user.avatarColor || accentColor }}
      >
        {initials}
      </div>
    );
  };

  const renderProjectIcon = (sizeClass = 'w-12 h-12', iconSize = 22) => {
    if (avatarType === 'icon') {
      const IconComp = AVATAR_ICON_COMPONENTS[avatarId] || FolderKanban;
      return (
        <div
          className={`${sizeClass} rounded-2xl flex items-center justify-center text-white shadow-xl transition-all duration-300 shrink-0`}
          style={{
            backgroundColor: avatarColor,
            boxShadow: `0 8px 24px ${avatarColor}40`,
          }}
        >
          <IconComp size={iconSize} strokeWidth={2.2} />
        </div>
      );
    }

    return (
      <div
        className={`${sizeClass} rounded-2xl flex items-center justify-center text-white font-mono font-bold text-base shadow-xl transition-all duration-300 shrink-0`}
        style={{
          backgroundColor: avatarColor,
          boxShadow: `0 8px 24px ${avatarColor}40`,
        }}
      >
        {projectInitials}
      </div>
    );
  };

  const filteredMemberUsers = useMemo(() => {
    if (!memberSearchQuery.trim()) return dbUsers;
    const q = memberSearchQuery.toLowerCase().trim();
    return dbUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.username && u.username.toLowerCase().includes(q))
    );
  }, [dbUsers, memberSearchQuery]);

  const selectedMembers = useMemo(() => {
    return dbUsers.filter((u) => selectedMemberIds.includes(u.id));
  }, [dbUsers, selectedMemberIds]);

  const isCurrentMoreIcon =
    avatarType === 'icon' && MORE_AVATAR_ICONS.some((i) => i.id === avatarId);
  const CurrentMoreIconComponent =
    isCurrentMoreIcon && avatarId ? AVATAR_ICON_COMPONENTS[avatarId] : null;

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center gap-3">
        <Loader2 size={24} className="animate-spin text-zinc-400" />
        <span className="text-xs text-zinc-500 font-mono">Loading project settings...</span>
      </div>
    );
  }

  if (!initialProject) {
    return (
      <div className="p-8 text-center text-zinc-500 text-xs">
        <p className="text-sm font-semibold text-zinc-300 mb-2">Project not found</p>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
        >
          <ArrowLeft size={13} />
          <span>Back to Projects</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-28">
      {/* ─── Top Header Banner ────────────────────────────────────────────── */}
      <div className="border-b border-[#27272A]/80 bg-[#090A0D]/60 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => navigate(`/projects/${projectId}`)}
                className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors cursor-pointer"
                title="Back to Project"
              >
                <ArrowLeft size={16} />
              </button>

              <div className="flex items-center gap-3">
                {renderProjectIcon('w-12 h-12', 22)}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                      {title || 'Untitled Project'}
                    </h1>
                    {identifier && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold uppercase bg-zinc-800 text-zinc-300 border border-zinc-700">
                        #{identifier}
                      </span>
                    )}
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border"
                      style={{
                        backgroundColor: `${avatarColor}18`,
                        borderColor: `${avatarColor}35`,
                        color: avatarColor,
                      }}
                    >
                      {status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    Project Settings • Owner:{' '}
                    <span className="text-zinc-300 font-medium">
                      {initialProject.owner?.name || 'Workspace Owner'}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to={`/projects/${projectId}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:text-white transition-colors"
              >
                <span>View Project</span>
                <ExternalLink size={12} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Sticky Section Navigation ────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-[#0C0D10]/95 backdrop-blur-md border-b border-[#27272A]/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <SettingsSectionNav categories={SETTINGS_CATEGORIES} />
        </div>
      </div>

      {/* ─── Main Content Container ───────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 space-y-12 divide-y divide-[#27272A]/70">
        {/* ─── SECTION 1: General & Workflow ───────────────────────────────── */}
        <SettingsSection
          id="general"
          title="General & Workflow"
          description="Configure project identity, classification, priority, and development status."
        >
          {/* Project Name */}
          <SettingsRow
            label="Project Name"
            description="The primary display title of your project."
          >
            <div className="space-y-1.5 max-w-md">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Core Engine v2"
                maxLength={60}
                className="w-full px-3.5 py-2.5 bg-[#111216] border border-[#27272A] rounded-xl text-xs sm:text-[13px] text-white placeholder-zinc-500 outline-none focus:border-zinc-500 transition-colors"
                style={{ outlineColor: accentColor }}
              />
              <div className="flex items-center justify-between text-[10px] text-zinc-500">
                <span>Must be descriptive and concise</span>
                <span className="font-mono">{title.length}/60</span>
              </div>
            </div>
          </SettingsRow>

          {/* Project Key / Identifier */}
          <SettingsRow
            label="Project Key / Identifier"
            description="Short 2-5 character uppercase prefix for issue numbers and URLs."
          >
            <div className="space-y-1.5 max-w-md">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-zinc-500">#</span>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    const sanitized = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
                    setIdentifier(sanitized);
                  }}
                  placeholder="e.g., CORE"
                  maxLength={5}
                  className="w-full px-3.5 py-2.5 bg-[#111216] border border-[#27272A] rounded-xl text-xs sm:text-[13px] font-mono text-white placeholder-zinc-500 outline-none focus:border-zinc-500 transition-colors uppercase"
                  style={{ outlineColor: accentColor }}
                />
              </div>
              <span className="text-[10px] text-zinc-500">
                Used to prefix tasks (e.g., #{identifier || 'CORE'}-101)
              </span>
            </div>
          </SettingsRow>

          {/* Brief Description */}
          <SettingsRow
            label="Brief Description"
            description="A concise, one-line summary displayed on project cards, directory views, and tooltips."
          >
            <div className="space-y-1.5 max-w-lg">
              <input
                type="text"
                value={briefDescription}
                onChange={(e) => setBriefDescription(e.target.value)}
                placeholder="e.g., Next-gen distributed task engine with real-time sync"
                maxLength={120}
                className="w-full px-3.5 py-2.5 bg-[#111216] border border-[#27272A] rounded-xl text-xs sm:text-[13px] text-white placeholder-zinc-500 outline-none focus:border-zinc-500 transition-colors"
                style={{ outlineColor: accentColor }}
              />
              <div className="flex items-center justify-between text-[10px] text-zinc-500">
                <span>One-line summary for cards and search</span>
                <span className="font-mono">{briefDescription.length}/120</span>
              </div>
            </div>
          </SettingsRow>

          {/* Description */}
          <SettingsRow
            label="Detailed Scope & Architecture"
            description="Provide team context, goals, technical architecture, and deliverables."
          >
            <div className="space-y-1.5 max-w-lg">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this project aims to accomplish..."
                rows={4}
                className="w-full px-3.5 py-2.5 bg-[#111216] border border-[#27272A] rounded-xl text-xs sm:text-[13px] text-white placeholder-zinc-500 outline-none focus:border-zinc-500 transition-colors resize-y leading-relaxed"
                style={{ outlineColor: accentColor }}
              />
            </div>
          </SettingsRow>

          {/* Categories */}
          <SettingsRow
            label="Categories"
            description="Multi-select functional tags for classification and roadmap filtering."
          >
            <div className="max-w-md">
              <AnimatedMultiSelect
                values={selectedCategories}
                onChange={setSelectedCategories}
                options={availableCategories.map((c) => ({
                  value: c,
                  label: c,
                }))}
                accentColor={accentColor}
                placeholder="Choose categories..."
                searchPlaceholder="Search or add category..."
                allowCustom
                onAddCustom={(newCat) => {
                  if (!availableCategories.includes(newCat)) {
                    setAvailableCategories((prev) => [...prev, newCat]);
                  }
                }}
              />
            </div>
          </SettingsRow>

          {/* Status */}
          <SettingsRow
            label="Workflow Status"
            description="The current operational lifecycle phase of this initiative."
          >
            <div className="max-w-md">
              <AnimatedSelect
                value={status}
                onChange={setStatus}
                options={STATUS_OPTIONS.map((s) => {
                  const IconComp = s.icon;
                  return {
                    value: s.id,
                    label: s.label,
                    sublabel: s.sublabel,
                    icon: <IconComp size={14} style={{ color: s.color }} />,
                  };
                })}
                accentColor={accentColor}
                placeholder="Select status..."
              />
            </div>
          </SettingsRow>

          {/* Priority */}
          <SettingsRow
            label="Priority Level"
            description="Sets organizational urgency and resource allocation rank."
          >
            <div className="max-w-md">
              <AnimatedSelect
                value={priority}
                onChange={setPriority}
                options={PRIORITY_OPTIONS.map((p) => {
                  const IconComp = p.icon;
                  return {
                    value: p.id,
                    label: p.label,
                    icon: <IconComp size={14} style={{ color: p.color }} />,
                  };
                })}
                accentColor={accentColor}
                placeholder="Select priority..."
              />
            </div>
          </SettingsRow>
        </SettingsSection>

        {/* ─── SECTION 2: Appearance & Avatar ──────────────────────────────── */}
        <SettingsSection
          id="appearance"
          title="Appearance & Avatar"
          description="Customize the visual badge, icon tray, and branding color palette."
        >
          {/* Avatar Mode */}
          <SettingsRow
            label="Avatar Type"
            description="Choose whether to represent this project with an icon glyph or monogram initials."
          >
            <div className="flex items-center gap-2 bg-[#111216] border border-[#27272A] p-1 rounded-xl max-w-xs">
              <button
                type="button"
                onClick={() => setAvatarType('icon')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  avatarType === 'icon'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
                style={avatarType === 'icon' ? { color: accentColor } : undefined}
              >
                Icon Glyph
              </button>
              <button
                type="button"
                onClick={() => setAvatarType('initials')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  avatarType === 'initials'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
                style={avatarType === 'initials' ? { color: accentColor } : undefined}
              >
                Project Initials
              </button>
            </div>
          </SettingsRow>

          {/* Icon Tray (if icon mode) */}
          {avatarType === 'icon' && (
            <SettingsRow
              label="Icon Glyph"
              description="Pick from curated quick icons or open the full 30+ icon tray."
            >
              <div className="space-y-3 max-w-lg">
                <div className="flex flex-wrap items-center gap-2">
                  {QUICK_AVATAR_ICONS.map((item) => {
                    const IconComp = AVATAR_ICON_COMPONENTS[item.id] || Smile;
                    const isSelected = avatarId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setAvatarId(item.id)}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'text-white ring-2 shadow-lg'
                            : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                        }`}
                        style={
                          isSelected
                            ? {
                                backgroundColor: avatarColor,
                                boxShadow: `0 0 0 2px ${accentColor}, 0 4px 12px ${avatarColor}40`,
                              }
                            : undefined
                        }
                        title={item.name}
                      >
                        <IconComp size={16} strokeWidth={2.2} />
                      </button>
                    );
                  })}

                  {/* Selected Icon from More Popover if active */}
                  {isCurrentMoreIcon && CurrentMoreIconComponent && (
                    <button
                      type="button"
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white ring-2 shadow-lg transition-all cursor-pointer"
                      style={{
                        backgroundColor: avatarColor,
                        boxShadow: `0 0 0 2px ${accentColor}, 0 4px 12px ${avatarColor}40`,
                      }}
                    >
                      <CurrentMoreIconComponent size={16} strokeWidth={2.2} />
                    </button>
                  )}

                  {/* + More Icons Button */}
                  <div ref={moreButtonRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setShowMoreIcons((prev) => !prev)}
                      className={`h-9 px-3 rounded-xl flex items-center gap-1.5 text-xs font-semibold border transition-all cursor-pointer ${
                        showMoreIcons
                          ? 'bg-zinc-800 border-zinc-600 text-white'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                      }`}
                      style={showMoreIcons ? { color: accentColor } : undefined}
                    >
                      <MoreHorizontal size={14} />
                      <span>More</span>
                    </button>

                    {/* Popover */}
                    <AnimatePresence>
                      {showMoreIcons && (
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 6, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-0 top-full mt-2 z-50 p-3 rounded-2xl bg-[#14161C] border border-[#27272A] shadow-2xl w-64 max-h-60 overflow-y-auto grid grid-cols-5 gap-2"
                        >
                          {MORE_AVATAR_ICONS.map((item) => {
                            const IconComp = AVATAR_ICON_COMPONENTS[item.id] || Smile;
                            const isSelected = avatarId === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setAvatarId(item.id);
                                  setShowMoreIcons(false);
                                }}
                                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                                  isSelected
                                    ? 'text-white shadow-md'
                                    : 'bg-zinc-900/80 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
                                }`}
                                style={
                                  isSelected
                                    ? {
                                        backgroundColor: avatarColor,
                                        boxShadow: `0 4px 12px ${avatarColor}40`,
                                      }
                                    : undefined
                                }
                                title={item.name}
                              >
                                <IconComp size={15} strokeWidth={2.2} />
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </SettingsRow>
          )}

          {/* Color Swatches */}
          <SettingsRow
            label="Avatar Color"
            description="Vibrant theme accent applied to badges, charts, and card banners."
          >
            <div className="flex flex-wrap items-center gap-2 max-w-lg">
              {AVATAR_COLORS.map((c) => {
                const isSelected = avatarColor.toLowerCase() === c.hex.toLowerCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setAvatarColor(c.hex)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer relative shadow-sm"
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {isSelected && (
                      <Check size={14} className="text-white drop-shadow-md" strokeWidth={3} />
                    )}
                  </button>
                );
              })}
            </div>
          </SettingsRow>

          {/* Live Preview Card */}
          <SettingsRow
            label="Live Badge Preview"
            description="How your project badge appears across the sidebar, cards, and directory."
          >
            <div className="p-4 rounded-2xl bg-[#090A0D] border border-[#27272A] flex items-center gap-4 max-w-md shadow-inner">
              {renderProjectIcon('w-12 h-12', 22)}
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-white truncate">
                  {title.trim() || 'Project Name'}
                </h4>
                {briefDescription.trim() && (
                  <p className="text-xs text-zinc-400 truncate mt-0.5">
                    {briefDescription.trim()}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] font-mono text-zinc-400">
                    #{identifier || 'PRJ'}
                  </span>
                  <span
                    className="px-2 py-0.2 rounded text-[10px] font-mono font-bold uppercase border"
                    style={{
                      backgroundColor: `${avatarColor}18`,
                      borderColor: `${avatarColor}35`,
                      color: avatarColor,
                    }}
                  >
                    {status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>
          </SettingsRow>
        </SettingsSection>

        {/* ─── SECTION 3: Team & Ownership ─────────────────────────────────── */}
        <SettingsSection
          id="team"
          title="Team & Ownership"
          description="Manage assigned squad, project leadership, and collaborating engineers."
        >
          {/* Squad / Team */}
          <SettingsRow
            label="Assign Squad / Team"
            description="The dedicated organizational team responsible for delivering this project."
          >
            <div className="max-w-md">
              <AnimatedSelect
                value={selectedTeamId ? String(selectedTeamId) : ''}
                onChange={(val) => setSelectedTeamId(val ? Number(val) : null)}
                options={[
                  {
                    value: '',
                    label: 'No squad assigned (Independent project)',
                    icon: (
                      <div className="w-5 h-5 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 shrink-0">
                        <Users size={11} />
                      </div>
                    ),
                  },
                  ...dbTeams.map((t) => {
                    const { key, icon, cleanDesc } = parseTeamMetadata(t.description, t.name);
                    const IconComp =
                      icon && icon !== 'initials' && AVATAR_ICON_COMPONENTS[icon]
                        ? AVATAR_ICON_COMPONENTS[icon]
                        : null;
                    const teamColor = t.color || '#3B82F6';
                    return {
                      value: String(t.id),
                      label: t.name,
                      sublabel: cleanDesc || (key ? `Squad key: ${key}` : undefined),
                      icon: (
                        <div
                          className="w-5 h-5 rounded-md flex items-center justify-center text-white shrink-0 shadow-sm"
                          style={{ backgroundColor: teamColor }}
                        >
                          {IconComp ? (
                            <IconComp size={11} strokeWidth={2.2} />
                          ) : (
                            <span className="font-mono font-bold text-[9px] uppercase leading-none">
                              {key.slice(0, 2)}
                            </span>
                          )}
                        </div>
                      ),
                    };
                  }),
                ]}
                accentColor={accentColor}
                placeholder="Select squad..."
                searchPlaceholder="Search squads..."
              />
            </div>
          </SettingsRow>

          {/* Project Lead */}
          <SettingsRow
            label="Project Lead"
            description="The designated point person and technical owner for this initiative."
          >
            <div className="max-w-md">
              <AnimatedSelect
                value={selectedLeadId ? String(selectedLeadId) : ''}
                onChange={(val) => setSelectedLeadId(val ? Number(val) : null)}
                options={[
                  {
                    value: '',
                    label: 'Unassigned',
                    icon: (
                      <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 shrink-0">
                        <Users size={11} />
                      </div>
                    ),
                  },
                  ...dbUsers.map((u) => ({
                    value: String(u.id),
                    label: u.name,
                    sublabel: u.jobTitle || u.email,
                    icon: renderUserAvatar(u, 'w-5 h-5', 10),
                  })),
                ]}
                accentColor={accentColor}
                placeholder="Select project lead..."
                searchPlaceholder="Search teammates..."
              />
            </div>
          </SettingsRow>

          {/* Collaborating Members */}
          <SettingsRow
            label={`Collaborating Members (${selectedMemberIds.length})`}
            description="Team members actively assigned to collaborate on project tasks."
          >
            <div className="space-y-3 max-w-md">
              <div ref={memberDropdownRef} className="relative">
                <div className="flex items-center gap-2 h-10 px-3 bg-[#111216] border border-[#27272A] rounded-xl focus-within:border-zinc-400 transition-colors">
                  <Search size={13} className="text-zinc-500" />
                  <input
                    type="text"
                    value={memberSearchQuery}
                    onFocus={() => setIsMemberDropdownOpen(true)}
                    onChange={(e) => {
                      setMemberSearchQuery(e.target.value);
                      setIsMemberDropdownOpen(true);
                    }}
                    placeholder="Search teammate to add or remove..."
                    className="w-full bg-transparent border-0 outline-none text-xs text-white placeholder-zinc-500"
                  />
                </div>

                {/* Dropdown Menu */}
                {isMemberDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 max-h-48 overflow-y-auto p-1.5 rounded-xl bg-[#14161C] border border-[#27272A] shadow-2xl z-50 space-y-1">
                    {filteredMemberUsers.length === 0 ? (
                      <div className="py-2 text-center text-xs text-zinc-500">
                        No matching teammates found
                      </div>
                    ) : (
                      filteredMemberUsers.map((u) => {
                        const isAssigned = selectedMemberIds.includes(u.id);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => handleToggleMember(u.id)}
                            className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                              isAssigned
                                ? 'bg-emerald-500/10 text-white'
                                : 'text-zinc-300 hover:bg-white/[0.05] hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {renderUserAvatar(u, 'w-6 h-6', 11)}
                              <div className="truncate">
                                <p className="font-semibold leading-tight text-white">
                                  {u.name}
                                </p>
                                <p className="text-[10px] text-zinc-500 leading-tight font-mono">
                                  {u.email}
                                </p>
                              </div>
                            </div>
                            {isAssigned && (
                              <Check size={13} className="text-emerald-400 shrink-0" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Selected Member Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedMembers.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.1] text-xs text-zinc-200"
                  >
                    {renderUserAvatar(m, 'w-4 h-4', 9)}
                    <span className="truncate max-w-[120px] text-xs">{m.name}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleMember(m.id)}
                      className="text-zinc-500 hover:text-white cursor-pointer ml-0.5"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </SettingsRow>
        </SettingsSection>

        {/* ─── SECTION 4: Timeline & Schedule ──────────────────────────────── */}
        <SettingsSection
          id="timeline"
          title="Timeline & Schedule"
          description="Establish planned delivery dates, sprint horizons, and quarterly roadmap targets."
        >
          {/* Start Date */}
          <SettingsRow
            label="Start Date"
            description="When architecture, design, or active sprint work initiates."
          >
            <div className="max-w-md">
              <CustomDatePicker
                value={startDate}
                onChange={setStartDate}
                presetMode="start"
                placeholder="Select start date..."
              />
            </div>
          </SettingsRow>

          {/* End Date */}
          <SettingsRow
            label="Target Delivery / End Date"
            description="Planned delivery deadline or milestone release target."
          >
            <div className="max-w-md">
              <CustomDatePicker
                value={endDate}
                onChange={setEndDate}
                presetMode="end"
                placeholder="Select end date..."
              />
            </div>
          </SettingsRow>

          {/* Timeline Summary Widget */}
          {startDate && endDate && (
            <SettingsRow
              label="Schedule Overview"
              description="Calculated duration and active roadmap horizon."
            >
              <div className="p-4 rounded-xl bg-[#090A0D] border border-[#27272A] max-w-md space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 font-mono">Planned Duration:</span>
                  <span className="text-white font-bold font-mono">
                    {Math.max(
                      0,
                      Math.round(
                        (new Date(endDate).getTime() - new Date(startDate).getTime()) /
                          (1000 * 60 * 60 * 24)
                      )
                    )}{' '}
                    days (
                    {Math.max(
                      0,
                      Math.round(
                        (new Date(endDate).getTime() - new Date(startDate).getTime()) /
                          (1000 * 60 * 60 * 24 * 7)
                      )
                    )}{' '}
                    weeks)
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                  <span>Start: {startDate}</span>
                  <span>End: {endDate}</span>
                </div>
              </div>
            </SettingsRow>
          )}
        </SettingsSection>

        {/* ─── SECTION 5: Danger Zone ──────────────────────────────────────── */}
        <SettingsSection
          id="danger"
          title="Danger Zone"
          description="Actions here can permanently alter project availability or erase historical tasks."
        >
          {/* Archive Project */}
          <SettingsRow
            label="Archive Project"
            description="Mark this project as read-only and hide it from active sprint boards."
          >
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-500/[0.04] border border-amber-500/20 max-w-lg">
              <div>
                <p className="text-xs font-semibold text-amber-200">
                  {status === 'ARCHIVED' ? 'Project is Archived' : 'Archive Project'}
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {status === 'ARCHIVED'
                    ? 'Project is read-only. Unarchive to resume active development.'
                    : 'Removes project from active views without deleting issues.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStatus((prev) => (prev === 'ARCHIVED' ? 'IN_PROGRESS' : 'ARCHIVED'))}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 transition-colors cursor-pointer shrink-0"
              >
                {status === 'ARCHIVED' ? 'Unarchive Project' : 'Archive'}
              </button>
            </div>
          </SettingsRow>

          {/* Delete Project */}
          <SettingsRow
            label="Delete Project"
            description="Permanently delete this project, all associated tasks, and relational records."
          >
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-red-500/[0.04] border border-red-500/20 max-w-lg">
              <div>
                <p className="text-xs font-semibold text-red-300">Permanent Deletion</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  This action is irreversible. All issues and memberships will be deleted.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-red-600/90 hover:bg-red-600 text-white shadow-md transition-colors cursor-pointer shrink-0"
              >
                Delete Project
              </button>
            </div>
          </SettingsRow>
        </SettingsSection>
      </main>

      {/* ─── Floating Bottom Save Bar ───────────────────────────────────────── */}
      <AnimatePresence>
        {isDirty && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 inset-x-0 z-40 flex items-center justify-center px-4 pointer-events-none"
          >
            <div className="w-full max-w-2xl bg-[#14161C]/95 backdrop-blur-2xl border border-[#27272A] rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-4 pointer-events-auto">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-2.5 h-2.5 rounded-full animate-pulse"
                  style={{ backgroundColor: accentColor }}
                />
                <span className="text-xs font-semibold text-white">
                  You have unsaved changes
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDiscardChanges}
                  disabled={isSaving}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold text-black hover:brightness-110 active:scale-[0.98] shadow-md transition-all cursor-pointer disabled:opacity-50"
                  style={{
                    backgroundColor: accentColor,
                    boxShadow: `0 4px 14px ${accentColor}40`,
                  }}
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={13} className="animate-spin text-black" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save size={13} strokeWidth={2.5} />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Delete Confirmation Modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setIsDeleteModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-md p-6 bg-[#0E1015] border border-red-500/30 rounded-2xl shadow-2xl text-left space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Delete Project</h3>
                  <p className="text-xs text-zinc-400">This action cannot be undone.</p>
                </div>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                To confirm permanent deletion of{' '}
                <strong className="text-white font-semibold">
                  "{initialProject?.title}"
                </strong>{' '}
                and all associated tasks, type the project name below:
              </p>

              <input
                type="text"
                value={deleteConfirmationPhrase}
                onChange={(e) => setDeleteConfirmationPhrase(e.target.value)}
                placeholder={initialProject?.title || ''}
                className="w-full px-3 py-2 bg-[#14161C] border border-[#27272A] rounded-xl text-xs text-white placeholder-zinc-600 outline-none focus:border-red-500 transition-colors"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#27272A]/70">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setDeleteConfirmationPhrase('');
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    deleteConfirmationPhrase.trim() !== (initialProject?.title || '').trim() ||
                    isDeleting
                  }
                  onClick={handleDeleteProject}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white shadow-md transition-colors cursor-pointer"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={13} className="animate-spin text-white" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={13} />
                      <span>Delete Permanently</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

