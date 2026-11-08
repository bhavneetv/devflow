import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FolderKanban,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Search,
  Sparkles,
  MoreHorizontal,
  AlertCircle,
  Smile,
  Crown,
  Calendar,
  Layers,
  Clock,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowUp,
  Equal,
  ArrowDown,
  Users,
  PauseCircle,
  Tag,
  Building2,
} from 'lucide-react';
import {
  QUICK_AVATAR_ICONS,
  MORE_AVATAR_ICONS,
  AVATAR_COLORS,
} from '../../types/onboarding';
import { AVATAR_ICON_COMPONENTS } from '../onboarding/StepProfile';
import { AnimatedSelect, AnimatedMultiSelect } from '../settings/AnimatedSelect';
import { CustomDatePicker } from '../settings/CustomDatePicker';
import { organizationService } from '../../services/organization.service';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import { apiUrl } from '../../config/api';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (project: any) => void;
  organizationSlug?: string;
  organizationId?: number;
}

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
  role?: string;
  isPublicProfile?: boolean;
}

interface OrganizationTeam {
  id: number;
  name: string;
  color?: string;
  description?: string;
}

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

function suggestProjectKey(name: string): string {
  const clean = name.trim();
  if (!clean) return '';
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, 4)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('')
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 4);
  }
  return clean.slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  organizationSlug,
  organizationId,
}) => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { currentOrganization } = useOrganization();
  const { accentColor } = useAccentTheme();

  const targetSlug = organizationSlug || currentOrganization?.slug;
  const targetOrgId = organizationId || currentOrganization?.id;

  // Active Step: 1 = Identity, 2 = Classification & Workflow, 3 = Team & Timeline
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showConfirmDiscard, setShowConfirmDiscard] = useState(false);

  // ─── TAB 1: Project Identity ───────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [isIdentifierManual, setIsIdentifierManual] = useState(false);
  const [avatarType, setAvatarType] = useState<'icon' | 'initials'>('icon');
  const [avatarId, setAvatarId] = useState<string>('code');
  const [avatarColor, setAvatarColor] = useState<string>(accentColor || '#8B5CF6');
  const [description, setDescription] = useState('');
  const [showMoreIcons, setShowMoreIcons] = useState(false);
  const moreButtonRef = useRef<HTMLDivElement>(null);

  // ─── TAB 2: Categories, Status & Priority ──────────────────────────────────
  const [availableCategories, setAvailableCategories] = useState<string[]>(PREDEFINED_CATEGORIES);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['Core Platform']);
  const [status, setStatus] = useState<string>('IN_PROGRESS');
  const [priority, setPriority] = useState<string>('MEDIUM');

  // ─── TAB 3: Team, Lead & Schedule ──────────────────────────────────────────
  const [dbUsers, setDbUsers] = useState<WorkspaceUser[]>([]);
  const [dbTeams, setDbTeams] = useState<OrganizationTeam[]>([]);
  const [isLoadingResources, setIsLoadingResources] = useState(false);

  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const memberDropdownRef = useRef<HTMLDivElement>(null);

  // Dates (YYYY-MM-DD)
  const [startDate, setStartDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  // Load workspace users & organization teams
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadResources() {
      setIsLoadingResources(true);
      try {
        const [usersRes, teamsRes] = await Promise.all([
          fetch(apiUrl('/users')).then((r) => r.json()).catch(() => ({ success: false })),
          targetSlug
            ? organizationService.listTeams(targetSlug)
            : Promise.resolve({ success: false, data: [] }),
        ]);

        if (isMounted) {
          if (usersRes.success && Array.isArray(usersRes.data)) {
            setDbUsers(usersRes.data);
            if (currentUser?.id) {
              setSelectedLeadId(currentUser.id);
              setSelectedMemberIds([currentUser.id]);
            } else if (usersRes.data.length > 0) {
              setSelectedLeadId(usersRes.data[0].id);
              setSelectedMemberIds([usersRes.data[0].id]);
            }
          }
          if (teamsRes.success && Array.isArray(teamsRes.data)) {
            setDbTeams(teamsRes.data);
          }
        }
      } catch (err) {
        console.warn('Error loading users/teams for project creation modal:', err);
      } finally {
        if (isMounted) setIsLoadingResources(false);
      }
    }

    loadResources();
    return () => {
      isMounted = false;
    };
  }, [isOpen, targetSlug, currentUser?.id]);

  // Handle outside click for popup trays
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

  // Auto-suggest identifier
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (validationError) setValidationError(null);
    if (!isIdentifierManual) {
      setIdentifier(suggestProjectKey(val));
    }
  };

  const handleIdentifierChange = (val: string) => {
    setIsIdentifierManual(true);
    const sanitized = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    setIdentifier(sanitized);
  };

  // Add custom category
  const handleCreateCategory = (catName: string) => {
    const trimmed = catName.trim();
    if (!trimmed) return;
    if (!availableCategories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setAvailableCategories((prev) => [...prev, trimmed]);
    }
    if (!selectedCategories.includes(trimmed)) {
      setSelectedCategories((prev) => [...prev, trimmed]);
    }
  };

  // Check dirty state
  const isDirty = useMemo(() => {
    return title.trim().length > 0 || description.trim().length > 0;
  }, [title, description]);

  const handleRequestClose = () => {
    if (isSubmitting || isSuccess) return;
    if (isDirty) {
      setShowConfirmDiscard(true);
    } else {
      onClose();
    }
  };

  // Keyboard navigation & Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showConfirmDiscard) {
          setShowConfirmDiscard(false);
        } else if (showMoreIcons) {
          setShowMoreIcons(false);
        } else if (isMemberDropdownOpen) {
          setIsMemberDropdownOpen(false);
        } else {
          handleRequestClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showConfirmDiscard, showMoreIcons, isMemberDropdownOpen, isDirty, isSubmitting, isSuccess]);

  // Initials for avatar
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

  // Check if current avatarId is in MORE_AVATAR_ICONS
  const isCurrentMoreIcon =
    avatarType === 'icon' && MORE_AVATAR_ICONS.some((i) => i.id === avatarId);
  const CurrentMoreIconComponent =
    isCurrentMoreIcon && avatarId ? AVATAR_ICON_COMPONENTS[avatarId] : null;

  // Step 1 Validation & Proceed
  const handleProceedToStep2 = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setValidationError('Project name is required');
      return;
    }
    if (trimmed.length < 2) {
      setValidationError('Project name must be at least 2 characters');
      return;
    }
    setValidationError(null);
    setStep(2);
  };

  // Step 2 Proceed to Step 3
  const handleProceedToStep3 = () => {
    setStep(3);
  };

  // Toggle member selection
  const handleToggleMember = (userId: number) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // Submit project creation
  const handleSaveProject = async () => {
    if (isSubmitting) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setStep(1);
      setValidationError('Project name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const projectInput = {
        title: trimmedTitle,
        description: description.trim() || undefined,
        identifier: identifier.trim() || undefined,
        avatarColor,
        avatarIcon: avatarType === 'icon' ? avatarId : undefined,
        status,
        priority,
        category: selectedCategories.length > 0 ? selectedCategories.join(', ') : 'General',
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        ownerId: currentUser?.id || 1,
        leadId: selectedLeadId || undefined,
        teamId: selectedTeamId || undefined,
        memberIds: selectedMemberIds,
        organizationId: targetOrgId || undefined,
        organizationSlug: targetSlug || undefined,
      };

      let createdProject: any = null;

      const res = await organizationService.createProject(projectInput);
      if (res && res.success) {
        createdProject = res.data;
      } else {
        throw new Error(res?.error || 'Failed to create project');
      }

      setIsSuccess(true);
      toast.success(
        'Project Initiated',
        `"${trimmedTitle}" was created successfully.`
      );

      setTimeout(() => {
        if (onCreated) onCreated(createdProject);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Project creation failed:', err);
      toast.error(
        'Error Creating Project',
        err.message || 'An unexpected error occurred while creating project'
      );
      setIsSubmitting(false);
    }
  };

  // Selected lead and team objects
  const selectedLead = useMemo(() => {
    return dbUsers.find((u) => u.id === selectedLeadId) || null;
  }, [dbUsers, selectedLeadId]);

  const selectedTeam = useMemo(() => {
    return dbTeams.find((t) => t.id === selectedTeamId) || null;
  }, [dbTeams, selectedTeamId]);

  // Selected members objects
  const selectedMembers = useMemo(() => {
    return dbUsers.filter((u) => selectedMemberIds.includes(u.id));
  }, [dbUsers, selectedMemberIds]);

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

  // Render user avatar helper
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

  // Render project icon helper
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

  // Current active metadata
  const currentStatusMeta =
    STATUS_OPTIONS.find((s) => s.id === status) || STATUS_OPTIONS[0];
  const currentPriorityMeta =
    PRIORITY_OPTIONS.find((p) => p.id === priority) || PRIORITY_OPTIONS[2];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm select-none animate-in fade-in duration-200"
      onClick={handleRequestClose}
    >
      {/* Main Centered Modal Window */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[980px] h-[610px] sm:h-[650px] max-h-[92vh] rounded-2xl sm:rounded-3xl border border-[#27272A] bg-[#0C0D10] shadow-2xl flex flex-row overflow-hidden relative text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Glow following accentColor */}
        <motion.div
          animate={{ backgroundColor: accentColor }}
          transition={{ duration: 0.5 }}
          className="absolute -top-24 -right-24 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-20 transition-colors"
        />

        {/* ─── SUCCESS ANIMATION STATE ────────────────────────────────────── */}
        <AnimatePresence>
          {isSuccess && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 z-50 bg-[#0C0D10] flex flex-col items-center justify-center p-6 text-center"
            >
              <div className="relative mb-6 flex items-center justify-center">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0.8 }}
                  animate={{ scale: [0.6, 2.2, 3], opacity: [0.8, 0.3, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                  className="absolute w-24 h-24 rounded-full border pointer-events-none"
                  style={{ borderColor: accentColor }}
                />

                <motion.div
                  initial={{ scale: 0.4, rotate: -15 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 14, stiffness: 220 }}
                  className="relative z-10"
                >
                  {renderProjectIcon('w-20 h-20', 36)}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.35, type: 'spring', damping: 12 }}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-md border-2 border-[#0C0D10]"
                  >
                    <Check size={14} strokeWidth={3} />
                  </motion.div>
                </motion.div>
              </div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-2xl font-bold text-white tracking-tight"
              >
                Project Initiated!
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-sm text-zinc-400 mt-1 max-w-sm"
              >
                "{title.trim()}" is now live in your workspace. Initializing roadmap...
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── LEFT: FORM CONFIGURATION COLUMN ────────────────────────────── */}
        <div className="w-full lg:w-[58%] h-full flex flex-col justify-between p-4 sm:p-6 relative z-10 bg-[#0C0D10] overflow-hidden shrink-0 border-r border-[#27272A]/70">
          {/* Header: Segmented Progress Bar (-- --- -- wise) */}
          <div className="w-full space-y-2.5 shrink-0 pb-2 border-b border-[#27272A]/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
                <span className="text-[10.5px] font-mono text-zinc-400 uppercase tracking-widest font-semibold">
                  Project Setup
                </span>
              </div>

              {!isSuccess && (
                <button
                  type="button"
                  onClick={handleRequestClose}
                  className="p-1 -mr-1 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Segmented Step Progress Indicator (Step 1 of 3: -- --- -- wise) */}
            <div className="w-full space-y-1.5" aria-label={`Step ${step} of 3`}>
              <div className="flex items-center gap-1.5 w-full">
                {/* Segment 1 */}
                <div
                  onClick={() => setStep(1)}
                  className="relative h-1 flex-1 rounded-full overflow-hidden bg-white/[0.08] cursor-pointer"
                  title="Step 1: Project Identity"
                >
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{ backgroundColor: accentColor }}
                  />
                </div>

                {/* Segment 2 */}
                <div
                  onClick={() => {
                    if (title.trim()) setStep(2);
                  }}
                  className={`relative h-1 flex-1 rounded-full overflow-hidden bg-white/[0.08] ${
                    title.trim() ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                  }`}
                  title="Step 2: Workflow & Categories"
                >
                  {step >= 2 && (
                    <motion.div
                      initial={{ scaleX: 0, originX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      className="absolute inset-0 rounded-full"
                      style={{ backgroundColor: accentColor }}
                    />
                  )}
                </div>

                {/* Segment 3 */}
                <div
                  onClick={() => {
                    if (title.trim()) setStep(3);
                  }}
                  className={`relative h-1 flex-1 rounded-full overflow-hidden bg-white/[0.08] ${
                    title.trim() ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                  }`}
                  title="Step 3: Team & Timeline"
                >
                  {step >= 3 && (
                    <motion.div
                      initial={{ scaleX: 0, originX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      className="absolute inset-0 rounded-full"
                      style={{ backgroundColor: accentColor }}
                    />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-[10.5px] font-mono text-zinc-500 pt-0.5">
                <span>Step {step} of 3</span>
                <span className="uppercase tracking-wider text-zinc-400 font-medium">
                  {step === 1
                    ? 'Project Identity'
                    : step === 2
                    ? 'Workflow & Categories'
                    : 'Team & Timeline'}
                </span>
              </div>
            </div>
          </div>

          {/* Form Content Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1 text-left custom-scrollbar">
            {/* ══════════════════════════════════════════════════════════════
                STEP 1: Project Identity (Name, Avatar, Color, Description)
               ══════════════════════════════════════════════════════════════ */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Project Name & Key */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200">
                      Project Name <span className="text-red-400">*</span>
                    </label>
                    <span className="text-[11px] font-mono text-zinc-500">
                      Key: #{identifier || suggestProjectKey(title) || 'PRJ'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      autoFocus
                      value={title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="e.g. NextGen Microservices Platform"
                      className={`flex-1 h-10 px-3 bg-[#111216] border rounded-xl text-xs sm:text-sm text-white placeholder-zinc-500 outline-none transition-colors ${
                        validationError
                          ? 'border-red-500/80 focus:border-red-400'
                          : 'border-[#27272A] focus:border-zinc-400'
                      }`}
                    />
                    <div className="relative w-24">
                      <input
                        type="text"
                        value={identifier}
                        onChange={(e) => handleIdentifierChange(e.target.value)}
                        placeholder="KEY"
                        title="Short project key"
                        className="w-full h-10 px-2.5 bg-[#111216] border border-[#27272A] rounded-xl text-xs font-mono font-bold text-center text-zinc-200 uppercase outline-none focus:border-zinc-400"
                      />
                    </div>
                  </div>
                  {validationError && (
                    <p className="text-[11px] text-red-400 flex items-center gap-1 mt-1">
                      <AlertCircle size={12} />
                      <span>{validationError}</span>
                    </p>
                  )}
                </div>

                {/* Standardized Avatar Icon Tray (Matches Settings, Team Modal & Onboarding) */}
                <div ref={moreButtonRef} className="space-y-1.5 pt-0.5 relative">
                  <div className="flex items-center justify-between">
                    <label className="text-[11.5px] font-medium text-zinc-300">
                      Choose project avatar
                    </label>
                    <span className="text-[10px] font-mono text-zinc-500">
                      Initials · 30+ Icons
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap py-1.5 px-1 overflow-visible">
                    {/* Order 1: Text Initials (Round & Small) */}
                    <button
                      type="button"
                      onClick={() => setAvatarType('initials')}
                      className={`relative w-8 h-8 rounded-full flex items-center justify-center font-mono text-[11px] font-semibold transition-all cursor-pointer ${
                        avatarType === 'initials'
                          ? 'ring-2 ring-offset-2 ring-offset-[#0C0D10] shadow-md scale-105'
                          : 'border border-white/[0.08] hover:scale-105 bg-[#17181D] text-zinc-400 hover:text-white'
                      }`}
                      style={{
                        backgroundColor: avatarType === 'initials' ? avatarColor : '#17181D',
                        color: avatarType === 'initials' ? '#FFFFFF' : '#A1A1AA',
                        borderColor: avatarType === 'initials' ? avatarColor : undefined,
                      }}
                      title="Use project initials"
                    >
                      {projectInitials}
                      {avatarType === 'initials' && (
                        <div
                          className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center text-white text-[7px] shadow"
                          style={{ backgroundColor: accentColor }}
                        >
                          <Check size={8} strokeWidth={3} />
                        </div>
                      )}
                    </button>

                    {/* Order 2: 5 Quick Icons (Round & Small) */}
                    {QUICK_AVATAR_ICONS.map((icon) => {
                      const isSelected = avatarType === 'icon' && avatarId === icon.id;
                      const IconComp = AVATAR_ICON_COMPONENTS[icon.id] || Smile;

                      return (
                        <button
                          key={icon.id}
                          type="button"
                          onClick={() => {
                            setAvatarType('icon');
                            setAvatarId(icon.id);
                          }}
                          className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'ring-2 ring-offset-2 ring-offset-[#0C0D10] shadow-md scale-105'
                              : 'border border-white/[0.08] hover:scale-105 bg-[#17181D] text-zinc-400 hover:text-white'
                          }`}
                          style={{
                            backgroundColor: isSelected ? avatarColor : '#17181D',
                            color: isSelected ? '#FFFFFF' : '#A1A1AA',
                            borderColor: isSelected ? avatarColor : undefined,
                          }}
                          title={icon.name}
                        >
                          <IconComp size={14} strokeWidth={2.2} />
                          {isSelected && (
                            <div
                              className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center text-white text-[7px] shadow"
                              style={{ backgroundColor: accentColor }}
                            >
                              <Check size={8} strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      );
                    })}

                    {/* Order 3: 3-Dot More Button */}
                    <button
                      type="button"
                      onClick={() => setShowMoreIcons((prev) => !prev)}
                      className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                        isCurrentMoreIcon
                          ? 'ring-2 ring-offset-2 ring-offset-[#0C0D10] shadow-md scale-105'
                          : 'border border-white/[0.08] hover:scale-105 bg-[#17181D] text-zinc-400 hover:text-white'
                      }`}
                      style={{
                        backgroundColor: isCurrentMoreIcon ? avatarColor : '#17181D',
                        color: isCurrentMoreIcon ? '#FFFFFF' : undefined,
                        borderColor: isCurrentMoreIcon ? avatarColor : undefined,
                      }}
                      title="More avatar icons"
                    >
                      {isCurrentMoreIcon && CurrentMoreIconComponent ? (
                        <CurrentMoreIconComponent size={14} strokeWidth={2.2} />
                      ) : (
                        <MoreHorizontal size={14} />
                      )}
                      {isCurrentMoreIcon && (
                        <div
                          className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center text-white text-[7px] shadow"
                          style={{ backgroundColor: accentColor }}
                        >
                          <Check size={8} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  </div>

                  {/* Popover (Opens downward so it never clips against modal top!) */}
                  <AnimatePresence>
                    {showMoreIcons && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.94, y: 6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 6 }}
                        transition={{ duration: 0.18 }}
                        className="absolute left-0 top-full mt-1.5 z-50 p-3 rounded-2xl bg-[#17181D] border border-[#27272A] shadow-2xl w-[284px] max-w-full backdrop-blur-xl"
                      >
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.08]">
                          <span className="text-[11.5px] font-medium text-white flex items-center gap-1.5">
                            <Sparkles size={12} style={{ color: accentColor }} />
                            <span>Choose Emoji ({MORE_AVATAR_ICONS.length})</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowMoreIcons(false)}
                            className="text-zinc-500 hover:text-white p-0.5 rounded transition-colors cursor-pointer"
                          >
                            <X size={13} />
                          </button>
                        </div>

                        <div className="grid grid-cols-6 gap-1.5 max-h-52 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
                          {MORE_AVATAR_ICONS.map((icon) => {
                            const IconComponent = AVATAR_ICON_COMPONENTS[icon.id] || Sparkles;
                            const isSelected =
                              avatarType === 'icon' && avatarId === icon.id;

                            return (
                              <button
                                key={icon.id}
                                type="button"
                                onClick={() => {
                                  setAvatarType('icon');
                                  setAvatarId(icon.id);
                                  setShowMoreIcons(false);
                                }}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                  isSelected
                                    ? 'text-zinc-950 font-bold scale-105 shadow'
                                    : 'hover:bg-white/[0.08] text-zinc-300 hover:text-white'
                                }`}
                                style={isSelected ? { backgroundColor: accentColor } : undefined}
                                title={icon.name}
                              >
                                <IconComponent size={14} />
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Project Color Palette (Tone swatches) */}
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11.5px] font-medium text-zinc-300">
                      Project color
                    </label>
                    <span className="text-[10px] font-mono text-zinc-500">
                      Avatar badge tone
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap py-1 px-1 overflow-visible">
                    {AVATAR_COLORS.map((color) => {
                      const isSelected =
                        avatarColor.toLowerCase() === color.hex.toLowerCase();
                      return (
                        <button
                          key={color.id}
                          type="button"
                          onClick={() => setAvatarColor(color.hex)}
                          className={`relative w-6 h-6 rounded-full transition-transform cursor-pointer hover:scale-110 flex items-center justify-center ${
                            isSelected
                              ? 'ring-2 ring-offset-2 ring-offset-[#0C0D10] shadow-md scale-110'
                              : ''
                          }`}
                          style={{ backgroundColor: color.hex }}
                          title={color.name}
                        >
                          {isSelected && (
                            <Check
                              size={11}
                              strokeWidth={3}
                              className="text-white drop-shadow"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Description (Increased size as requested) */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200">
                      Description
                    </label>
                    <span className="text-[11px] text-zinc-500">Scope & Objectives</span>
                  </div>
                  <textarea
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Outline key architectural goals, user impact, milestones, technical deliverables, and roadmap context..."
                    className="w-full min-h-[120px] p-3 bg-[#111216] border border-[#27272A] rounded-xl text-xs sm:text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-zinc-400 resize-none leading-relaxed"
                  />
                </div>
              </motion.div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                STEP 2: Workflow & Categories (AnimatedSelect & AnimatedMultiSelect)
               ══════════════════════════════════════════════════════════════ */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* 1. Category (AnimatedMultiSelect following accentColor) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <Tag size={13} style={{ color: accentColor }} />
                      <span>Categories</span>
                    </label>
                    <span className="text-[10px] font-mono text-zinc-500">
                      Multi-select
                    </span>
                  </div>

                  <AnimatedMultiSelect
                    values={selectedCategories}
                    onChange={setSelectedCategories}
                    options={availableCategories.map((c) => ({ value: c, label: c }))}
                    placeholder="Select categories..."
                    searchPlaceholder="Search or add category..."
                    accentColor={accentColor}
                    allowCustom={true}
                    onAddCustom={handleCreateCategory}
                  />
                </div>

                {/* 2. Workflow Status (AnimatedSelect following accentColor) */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200 block">
                      Workflow Status
                    </label>
                    <span className="text-[10px] font-mono text-zinc-500">
                      Single select
                    </span>
                  </div>

                  <AnimatedSelect
                    value={status}
                    onChange={setStatus}
                    options={STATUS_OPTIONS.map((s) => ({
                      value: s.id,
                      label: s.label,
                      sublabel: s.sublabel,
                      icon: (
                        <div
                          className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: `${s.color}25`,
                            color: s.color,
                          }}
                        >
                          <s.icon size={12} />
                        </div>
                      ),
                    }))}
                    accentColor={accentColor}
                    placeholder="Select workflow status..."
                    searchPlaceholder="Search status..."
                  />
                </div>

                {/* 3. Priority Selector (AnimatedSelect following accentColor) */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200 block">
                      Priority Level
                    </label>
                    <span className="text-[10px] font-mono text-zinc-500">
                      Urgency & pacing
                    </span>
                  </div>

                  <AnimatedSelect
                    value={priority}
                    onChange={setPriority}
                    options={PRIORITY_OPTIONS.map((pOpt) => {
                      const PIcon = pOpt.icon;
                      return {
                        value: pOpt.id,
                        label: pOpt.label,
                        icon: (
                          <div
                            className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: `${pOpt.color}25`,
                              color: pOpt.color,
                            }}
                          >
                            <PIcon size={12} />
                          </div>
                        ),
                      };
                    })}
                    accentColor={accentColor}
                    placeholder="Select priority..."
                    searchPlaceholder="Search priority..."
                  />
                </div>
              </motion.div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                STEP 3: Team, Lead & Schedule (AnimatedSelect & Timeline)
               ══════════════════════════════════════════════════════════════ */}
            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* 1. Project Lead Selection (AnimatedSelect) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <Crown size={13} className="text-amber-400" />
                      <span>Project Lead (Lead by)</span>
                    </label>
                    <span className="text-[10px] font-mono text-zinc-500">
                      Primary owner
                    </span>
                  </div>

                  <AnimatedSelect
                    value={selectedLeadId ? String(selectedLeadId) : ''}
                    onChange={(val) => {
                      const num = Number(val);
                      setSelectedLeadId(num);
                      if (!selectedMemberIds.includes(num)) {
                        setSelectedMemberIds((prev) => [...prev, num]);
                      }
                    }}
                    options={dbUsers.map((u) => ({
                      value: String(u.id),
                      label: u.name,
                      sublabel: u.jobTitle || u.email,
                      icon: renderUserAvatar(u, 'w-5 h-5', 10),
                    }))}
                    accentColor={accentColor}
                    placeholder="Select project lead..."
                    searchPlaceholder="Search teammates by name or email..."
                  />
                </div>

                {/* 2. Squad / Team Selection (AnimatedSelect) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <Building2 size={13} className="text-blue-400" />
                      <span>Assign Squad / Team</span>
                    </label>
                    <span className="text-[10px] font-mono text-zinc-500">
                      Organizational unit
                    </span>
                  </div>

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

                {/* 3. Collaborating Members Multi-select */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <Users size={13} className="text-emerald-400" />
                      <span>
                        Collaborating Members ({selectedMemberIds.length})
                      </span>
                    </label>
                    <span className="text-[10px] font-mono text-zinc-500">
                      Multi-select
                    </span>
                  </div>

                  {/* Member Search & Selector */}
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
                        placeholder="Search teammate to add..."
                        className="w-full bg-transparent border-0 outline-none text-xs text-white placeholder-zinc-500"
                      />
                    </div>

                    {/* Dropdown Menu */}
                    {isMemberDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 max-h-44 overflow-y-auto p-1.5 rounded-xl bg-[#14161C] border border-[#27272A] shadow-2xl z-50 space-y-1">
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
                                  <Check
                                    size={13}
                                    className="text-emerald-400 shrink-0"
                                  />
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {/* Selected Members Chips */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedMembers.map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.1] text-xs text-zinc-200"
                      >
                        {renderUserAvatar(m, 'w-4 h-4', 9)}
                        <span className="truncate max-w-[120px] text-xs">
                          {m.name}
                        </span>
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

                {/* 4. Planned Timeline Dates */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Calendar size={13} className="text-sky-400" />
                    <span>Planned Timeline (Start & End Date)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[10px] font-mono uppercase text-zinc-500 mb-1">
                        Start Date
                      </span>
                      <CustomDatePicker
                        value={startDate}
                        onChange={setStartDate}
                        presetMode="start"
                        dropUp={true}
                        placeholder="Select start date..."
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] font-mono uppercase text-zinc-500 mb-1">
                        End Date
                      </span>
                      <CustomDatePicker
                        value={endDate}
                        onChange={setEndDate}
                        presetMode="end"
                        align="right"
                        dropUp={true}
                        placeholder="Select end date..."
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Footer Navigation Bar */}
          <div className="flex items-center justify-between pt-3 border-t border-[#27272A]/70 shrink-0">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((prev) => (prev - 1) as 1 | 2 | 3)}
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
              >
                <ArrowLeft size={13} />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRequestClose}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}

            <div className="flex items-center gap-2">
              {step < 3 ? (
                <button
                  type="button"
                  onClick={
                    step === 1 ? handleProceedToStep2 : handleProceedToStep3
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-black hover:brightness-110 active:scale-[0.98] shadow-md transition-all cursor-pointer"
                  style={{
                    backgroundColor: accentColor,
                    boxShadow: `0 4px 14px ${accentColor}40`,
                  }}
                >
                  <span>Continue</span>
                  <ArrowRight size={13} strokeWidth={2.5} />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting || !title.trim()}
                  onClick={handleSaveProject}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold text-black disabled:opacity-50 shadow-lg hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: accentColor,
                    boxShadow: `0 4px 14px ${accentColor}40`,
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={13} className="animate-spin text-black" />
                      <span>Initiating...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} strokeWidth={2.5} />
                      <span>Save & Initiate Project</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ─── RIGHT: LIVE INTERACTIVE PREVIEW PANEL (Desktop) ────────────── */}
        <div className="hidden lg:flex w-[42%] h-full bg-[#0E1015] p-6 flex-col justify-between relative overflow-hidden border-l border-[#27272A]/40">
          {/* Subtle Background Mesh */}
          <div
            className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-10"
            style={{ backgroundColor: avatarColor }}
          />

          <div className="space-y-4 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Live Preview
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                Card & Directory View
              </span>
            </div>

            {/* Simulated Project Card */}
            <div className="p-5 rounded-2xl bg-[#090A0D] border border-[#27272A] space-y-4 shadow-xl">
              {/* Header with Project Icon, Title & Status */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  {renderProjectIcon('w-11 h-11', 20)}
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate leading-snug">
                      {title.trim() || 'Untitled Project'}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] font-mono text-zinc-500">
                        #{identifier || suggestProjectKey(title) || 'PRJ-101'}
                      </span>
                      {selectedCategories.slice(0, 2).map((cat) => (
                        <span
                          key={cat}
                          className="text-[10px] font-mono px-1.5 py-0.2 rounded"
                          style={{
                            backgroundColor: `${avatarColor}20`,
                            color: avatarColor,
                          }}
                        >
                          {cat}
                        </span>
                      ))}
                      {selectedCategories.length > 2 && (
                        <span className="text-[10px] font-mono text-zinc-500">
                          +{selectedCategories.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono uppercase font-bold border shrink-0 flex items-center gap-1 ${currentStatusMeta.badgeClass}`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: currentStatusMeta.color }}
                  />
                  <span>{currentStatusMeta.label.split('/')[0].trim()}</span>
                </span>
              </div>

              {/* Description preview */}
              <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                {description.trim() ||
                  'No description entered yet. Detail key scope and milestones here.'}
              </p>

              {/* Priority & Lead Info */}
              <div className="pt-2 border-t border-[#1C1D24] grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="block text-[10px] font-mono uppercase text-zinc-500">
                    Lead by
                  </span>
                  <p className="text-white font-medium truncate mt-0.5 flex items-center gap-1.5">
                    {selectedLead ? (
                      <>
                        {renderUserAvatar(selectedLead, 'w-4 h-4', 8)}
                        <span className="truncate">{selectedLead.name}</span>
                      </>
                    ) : (
                      'Unassigned'
                    )}
                  </p>
                </div>
                <div>
                  <span className="block text-[10px] font-mono uppercase text-zinc-500">
                    Priority
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-semibold mt-0.5"
                    style={{ color: currentPriorityMeta.color }}
                  >
                    <currentPriorityMeta.icon size={11} />
                    <span>{currentPriorityMeta.label}</span>
                  </span>
                </div>
              </div>

              {/* Squad & Collaborators Stack */}
              <div className="pt-2 border-t border-[#1C1D24] flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <Building2 size={12} className="text-zinc-500" />
                  <span className="text-zinc-300 font-mono text-[11px]">
                    {selectedTeam ? selectedTeam.name : 'All Squads'}
                  </span>
                </div>

                <div className="flex items-center -space-x-1.5">
                  {selectedMembers.slice(0, 4).map((m) => (
                    <div
                      key={m.id}
                      className="w-5 h-5 rounded-full border border-[#090A0D] flex items-center justify-center text-[8.5px] font-bold text-white shrink-0"
                      style={{ backgroundColor: m.avatarColor || '#6366F1' }}
                      title={m.name}
                    >
                      {m.name.slice(0, 1)}
                    </div>
                  ))}
                  {selectedMembers.length > 4 && (
                    <div className="w-5 h-5 rounded-full bg-zinc-800 border border-[#090A0D] flex items-center justify-center text-[8px] font-bold text-zinc-400">
                      +{selectedMembers.length - 4}
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline Indicator */}
              <div className="pt-2 border-t border-[#1C1D24] flex items-center justify-between text-[11px] font-mono text-zinc-400">
                <span className="flex items-center gap-1">
                  <Calendar size={11} className="text-zinc-500" />
                  <span>{startDate || 'TBD'}</span>
                </span>
                <span>→</span>
                <span>{endDate || 'TBD'}</span>
              </div>
            </div>
          </div>

          {/* Bottom Guidance Card */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-left text-xs text-zinc-400 space-y-1">
            <p className="font-semibold text-zinc-200">
              Enterprise Project Workspaces
            </p>
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Creating a project establishes relational task boards, Gantt
              schedules, and squad access controls across{' '}
              {currentOrganization?.name || 'your workspace'}.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Discard Confirmation Dialog */}
      {showConfirmDiscard && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowConfirmDiscard(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-[#14161C] border border-[#27272A] p-5 shadow-2xl text-left space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-amber-400">
              <AlertTriangle size={18} />
              <h3 className="font-bold text-white text-sm">
                Discard project setup?
              </h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              You have unsaved changes. Exiting now will discard the project
              configuration you've entered.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmDiscard(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmDiscard(false);
                  onClose();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Discard & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateProjectModal;
