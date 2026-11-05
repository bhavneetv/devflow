import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Users,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Search,
  Sparkles,
  MoreHorizontal,
  Hash,
  AlertCircle,
  Smile,
  Shield,
  Crown,
  ChevronDown,
  Trash2,
  Palette,
  Globe,
  UserCheck,
} from 'lucide-react';
import {
  QUICK_AVATAR_ICONS,
  MORE_AVATAR_ICONS,
  AVATAR_COLORS,
  AvatarIconOption,
} from '../../types/onboarding';
import { AVATAR_ICON_COMPONENTS } from '../onboarding/StepProfile';
import { AnimatedSelect, SelectOption } from '../settings/AnimatedSelect';
import { teamService } from '../../services/team.service';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import { apiUrl } from '../../config/api';

interface CreateTeamModalProps {
  onClose: () => void;
  onCreated: (team: any) => void;
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
  role?: string;
  isPublicProfile?: boolean;
}

interface TeamMemberItem {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  avatarType: 'initials' | 'icon' | 'upload';
  avatarId?: string | null;
  avatarColor: string;
  avatarUrl?: string | null;
  isCurrentUser?: boolean;
}

const ROLE_OPTIONS: SelectOption[] = [
  { value: 'Lead', label: 'Lead', icon: <Crown size={14} className="text-amber-400" />, sublabel: 'Leadership' },
  { value: 'Admin', label: 'Admin', icon: <Shield size={14} className="text-indigo-400" />, sublabel: 'Manage & settings' },
  { value: 'Engineer', label: 'Engineer', icon: <Users size={14} className="text-emerald-400" />, sublabel: 'Code & reviews' },
  { value: 'Designer', label: 'Designer', icon: <Sparkles size={14} className="text-purple-400" />, sublabel: 'Design & assets' },
  { value: 'Product Manager', label: 'Product Manager', icon: <Globe size={14} className="text-blue-400" />, sublabel: 'Roadmaps & sprints' },
  { value: 'Viewer', label: 'Viewer', icon: <UserCheck size={14} className="text-zinc-400" />, sublabel: 'Read-only access' },
];

const ALL_AVATAR_ICONS: AvatarIconOption[] = [...QUICK_AVATAR_ICONS, ...MORE_AVATAR_ICONS];

// Helper to auto-suggest team identifier (e.g. "Frontend Engineering" -> "FE")
function suggestIdentifier(teamName: string): string {
  const clean = teamName.trim();
  if (!clean) return '';
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, 4)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('')
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 5);
  }
  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  return '';
}

export const CreateTeamModal: React.FC<CreateTeamModalProps> = ({ onClose, onCreated }) => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { accentColor } = useAccentTheme();

  // Modal Step State: 1 = Team Identity, 2 = Add Members
  const [step, setStep] = useState<1 | 2>(1);
  const [isSuccess, setIsSuccess] = useState(false);

  // Step 1: Form State
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [isIdentifierManual, setIsIdentifierManual] = useState(false);

  // Step 1: Avatar Selection (Initials, 5 Quick Icons, 3-dots More, NO photo)
  const [avatarType, setAvatarType] = useState<'initials' | 'icon'>('initials');
  const [avatarId, setAvatarId] = useState<string>('code');
  const [avatarColor, setAvatarColor] = useState<string>('#7C3AED');
  const [showMoreModal, setShowMoreModal] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const moreButtonRef = useRef<HTMLDivElement>(null);

  // Step 2: Database Users & Selection State
  const [dbUsers, setDbUsers] = useState<WorkspaceUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Step 2: Inputs Row State
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<WorkspaceUser | null>(null);
  const [accountSearchQuery, setAccountSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('Engineer');
  const accountSelectRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Team Members List (Creator initialized as Lead/Owner)
  const [teamMembers, setTeamMembers] = useState<TeamMemberItem[]>([]);

  // Step 2: Member Avatar Customization Popup State (Both Color & Emoji in one popup!)
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const editingMember = teamMembers.find((m) => m.id === editingMemberId);

  // Submission & Discard Confirmation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDiscard, setShowConfirmDiscard] = useState(false);

  // Responsive desktop detection for smooth 50% -> 100% full container expansion
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsDesktop(e.matches);
    };
    setIsDesktop(mql.matches);
    try {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    } catch {
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    }
  }, []);

  // Lock body scroll while modal is active
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Initialize Team Creator member
  useEffect(() => {
    if (currentUser) {
      const creator: TeamMemberItem = {
        id: String(currentUser.id),
        name: currentUser.name || 'Developer',
        username: currentUser.username || currentUser.email?.split('@')[0] || 'developer',
        email: currentUser.email || '',
        role: 'Lead',
        avatarType: (currentUser.avatarType as any) || 'initials',
        avatarId: currentUser.avatarId || null,
        avatarColor: currentUser.avatarColor || '#7C3AED',
        avatarUrl: currentUser.avatarUrl || null,
        isCurrentUser: true,
      };
      setTeamMembers((prev) => (prev.length === 0 ? [creator] : prev));
    }
  }, [currentUser]);

  // Fetch real workspace users from database
  useEffect(() => {
    let isMounted = true;
    async function fetchUsers() {
      setIsLoadingUsers(true);
      try {
        const res = await fetch(apiUrl('/users'));
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            if (isMounted) {
              setDbUsers(json.data);
            }
          }
        }
      } catch (err) {
        console.warn('Could not load workspace users:', err);
      } finally {
        if (isMounted) setIsLoadingUsers(false);
      }
    }
    fetchUsers();
    return () => {
      isMounted = false;
    };
  }, []);

  // Close account dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        accountSelectRef.current &&
        !accountSelectRef.current.contains(e.target as Node)
      ) {
        setIsAccountOpen(false);
      }
    };
    if (isAccountOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isAccountOpen]);

  // Close 3-dot emoji popover on outside click
  useEffect(() => {
    const handleOutsideMore = (e: MouseEvent) => {
      if (moreButtonRef.current && !moreButtonRef.current.contains(e.target as Node)) {
        setShowMoreModal(false);
      }
    };
    if (showMoreModal) {
      document.addEventListener('mousedown', handleOutsideMore);
    }
    return () => document.removeEventListener('mousedown', handleOutsideMore);
  }, [showMoreModal]);

  // Focus search input when account select opens
  useEffect(() => {
    if (isAccountOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isAccountOpen]);

  // Clean account search query
  const cleanAccountQuery = accountSearchQuery.trim().toLowerCase().replace(/^@+/, '');

  // CRITICAL: "in options not show any user only show the matched username ( that is public)"
  const matchingAccounts = useMemo(() => {
    if (!cleanAccountQuery) return [];
    return dbUsers.filter((u) => {
      // Must be public profile
      if (u.isPublicProfile === false) return false;
      const uname = (u.username || u.email?.split('@')[0] || '').toLowerCase();
      return uname.includes(cleanAccountQuery);
    });
  }, [cleanAccountQuery, dbUsers]);

  // Handle Team Name Change with Auto-Identifier
  const handleNameChange = (val: string) => {
    setName(val);
    if (validationError) setValidationError(null);
    if (!isIdentifierManual) {
      setIdentifier(suggestIdentifier(val));
    }
  };

  // Handle Identifier Manual Edit
  const handleIdentifierChange = (val: string) => {
    setIsIdentifierManual(true);
    const sanitized = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setIdentifier(sanitized);
  };

  // Check if form is dirty for close confirmation
  const isDirty = useMemo(() => {
    return name.trim().length > 0 || teamMembers.length > 1 || isIdentifierManual;
  }, [name, teamMembers, isIdentifierManual]);

  const handleRequestClose = () => {
    if (isSubmitting || isSuccess) return;
    if (isDirty) {
      setShowConfirmDiscard(true);
    } else {
      onClose();
    }
  };

  // Keyboard navigation & Escape handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showConfirmDiscard) {
          setShowConfirmDiscard(false);
        } else if (editingMemberId) {
          setEditingMemberId(null);
        } else if (showMoreModal) {
          setShowMoreModal(false);
        } else if (isAccountOpen) {
          setIsAccountOpen(false);
        } else {
          handleRequestClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showConfirmDiscard, editingMemberId, showMoreModal, isAccountOpen, isDirty, isSubmitting, isSuccess]);

  // Derived display identifier
  const displayIdentifier = identifier.trim() || suggestIdentifier(name) || 'FE';

  // Derived team initials for the initials avatar option
  const teamInitials = useMemo(() => {
    if (identifier.trim()) return identifier.trim().slice(0, 2).toUpperCase();
    const clean = name.trim();
    if (!clean) return 'FE';
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  }, [identifier, name]);

  // Check if current icon is one of the "more" icons
  const isCurrentMoreIcon =
    avatarType === 'icon' &&
    MORE_AVATAR_ICONS.some((icon) => icon.id === avatarId);

  const CurrentMoreIconComponent =
    isCurrentMoreIcon && avatarId ? AVATAR_ICON_COMPONENTS[avatarId] : null;

  // Step 1 Validation & Proceed
  const handleProceedToStep2 = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setValidationError('Team name is required');
      return;
    }
    if (trimmed.length < 2) {
      setValidationError('Team name must be at least 2 characters');
      return;
    }
    setValidationError(null);
    setStep(2);
  };

  // Step 2: Add member using the small arrow button
  const handleAddMember = (accountToAdd?: WorkspaceUser) => {
    let acc = accountToAdd || selectedAccount;

    // Direct match if query typed and not clicked
    if (!acc && cleanAccountQuery.length > 0) {
      acc = matchingAccounts[0];
    }

    if (!acc) {
      toast.error('Search and select a user to add');
      return;
    }

    const uHandle = acc.username || acc.email.split('@')[0];
    const alreadyExists = teamMembers.some(
      (m) => m.username.toLowerCase() === uHandle.toLowerCase() || m.id === String(acc.id)
    );

    if (alreadyExists) {
      toast.info(`@${uHandle} is already in this team.`);
      return;
    }

    const newMember: TeamMemberItem = {
      id: String(acc.id),
      name: acc.name,
      username: uHandle,
      email: acc.email,
      role: selectedRole,
      avatarType: acc.avatarType || (acc.avatarUrl ? 'upload' : 'icon'),
      avatarId: acc.avatarId || 'smile',
      avatarColor: acc.avatarColor || '#8B5CF6',
      avatarUrl: acc.avatarUrl || null,
      isCurrentUser: false,
    };

    setTeamMembers((prev) => [...prev, newMember]);
    setSelectedAccount(null);
    setAccountSearchQuery('');
    setIsAccountOpen(false);
    toast.success(`@${uHandle} added as ${selectedRole}!`);
  };

  // Step 2: Remove member
  const handleRemoveMember = (id: string) => {
    setTeamMembers((prev) => prev.filter((m) => m.id !== id));
  };

  // Step 2: Update member's avatar color (This team only)
  const handleUpdateMemberColor = (colorHex: string) => {
    if (!editingMemberId) return;
    setTeamMembers((prev) =>
      prev.map((m) => (m.id === editingMemberId ? { ...m, avatarColor: colorHex } : m))
    );
  };

  // Step 2: Update member's avatar icon (This team only)
  const handleUpdateMemberIcon = (iconOption: AvatarIconOption) => {
    if (!editingMemberId) return;
    setTeamMembers((prev) =>
      prev.map((m) =>
        m.id === editingMemberId
          ? {
              ...m,
              avatarType: 'icon',
              avatarId: iconOption.id,
            }
          : m
      )
    );
  };

  // Step 2: Submission to Backend
  const handleCreateTeamSubmit = async () => {
    if (isSubmitting) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setStep(1);
      setValidationError('Team name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const cleanId = identifier.trim() || suggestIdentifier(trimmed) || 'TEAM';
      const descPayload = `[key:${cleanId}] [icon:${avatarType === 'icon' ? avatarId : 'initials'}]`;

      const addedMemberIds = teamMembers
        .filter((m) => !m.isCurrentUser)
        .map((m) => Number(m.id))
        .filter((id) => !isNaN(id));

      const res = await teamService.createTeam({
        name: trimmed,
        description: descPayload,
        color: avatarColor,
        memberIds: addedMemberIds,
        identifier: cleanId,
        icon: avatarType === 'icon' ? avatarId : 'initials',
      });

      if (res.success && res.data) {
        setIsSuccess(true);
        setTimeout(() => {
          toast.success('Team created!', `"${trimmed}" is ready.`);
          onCreated(res.data);
        }, 1800);
      } else {
        setIsSubmitting(false);
        toast.error('Failed to create team', res.error || 'Server rejected creation');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      toast.error('Network Error', err.message || 'Could not connect to server');
    }
  };

  // Render Member Avatar Helper
  const renderMemberAvatar = (
    member: TeamMemberItem | WorkspaceUser,
    sizeClass = 'w-8 h-8',
    iconSize = 14
  ) => {
    if (member.avatarType === 'upload' && member.avatarUrl) {
      return (
        <img
          src={member.avatarUrl}
          alt={member.name}
          className={`${sizeClass} rounded-full object-cover border border-white/10 shrink-0`}
        />
      );
    }

    if (member.avatarType === 'icon' && member.avatarId) {
      const IconComp = AVATAR_ICON_COMPONENTS[member.avatarId] || Smile;
      return (
        <div
          className={`${sizeClass} rounded-full flex items-center justify-center text-white shadow-sm shrink-0`}
          style={{ backgroundColor: member.avatarColor || '#8B5CF6' }}
        >
          <IconComp size={iconSize} strokeWidth={2.2} />
        </div>
      );
    }

    const initials =
      member.name
        ?.split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join('') || member.username?.slice(0, 2).toUpperCase() || 'U';

    return (
      <div
        className={`${sizeClass} rounded-full flex items-center justify-center text-white font-mono font-bold text-[10.5px] shadow-sm shrink-0`}
        style={{ backgroundColor: member.avatarColor || '#8B5CF6' }}
      >
        {initials}
      </div>
    );
  };

  // Render Team Preview Avatar
  const renderTeamAvatar = (sizeClass = 'w-14 h-14', iconSize = 26) => {
    if (avatarType === 'icon' && avatarId) {
      const IconComponent = AVATAR_ICON_COMPONENTS[avatarId] || Smile;
      return (
        <div
          className={`${sizeClass} rounded-2xl flex items-center justify-center text-white shadow-xl transition-all duration-300 shrink-0`}
          style={{
            backgroundColor: avatarColor,
            boxShadow: `0 8px 24px ${avatarColor}40`,
          }}
        >
          <IconComponent size={iconSize} strokeWidth={2.2} />
        </div>
      );
    }

    return (
      <div
        className={`${sizeClass} rounded-2xl flex items-center justify-center text-white font-mono font-bold text-lg shadow-xl transition-all duration-300 shrink-0`}
        style={{
          backgroundColor: avatarColor,
          boxShadow: `0 8px 24px ${avatarColor}40`,
        }}
      >
        {teamInitials}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm select-none"
      onClick={handleRequestClose}
    >
      {/* Main Centered Window: Expands from split-screen (Step 1) to full container (Step 2) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[960px] h-[580px] sm:h-[620px] max-h-[92vh] rounded-2xl sm:rounded-3xl border border-[#27272A] bg-[#0C0D10] shadow-2xl flex flex-row overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Glow */}
        <motion.div
          animate={{ backgroundColor: avatarColor }}
          transition={{ duration: 0.5 }}
          className="absolute -top-24 -right-24 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-20 transition-colors"
        />

        {/* ─── SUCCESS ANIMATION STATE (After Creation) ──────────────────────── */}
        <AnimatePresence>
          {isSuccess && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0 z-40 bg-[#0C0D10] flex flex-col items-center justify-center p-6 text-center"
            >
              <div className="relative mb-6 flex items-center justify-center">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0.8 }}
                  animate={{ scale: [0.6, 2.2, 3], opacity: [0.8, 0.3, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                  className="absolute w-24 h-24 rounded-full border pointer-events-none"
                  style={{ borderColor: avatarColor }}
                />

                <motion.div
                  initial={{ scale: 0.4, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 14, stiffness: 220 }}
                  className="relative z-10"
                >
                  {renderTeamAvatar('w-20 h-20', 36)}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.45, type: 'spring', damping: 12 }}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-md border-2 border-[#0C0D10]"
                  >
                    <Check size={14} strokeWidth={3} />
                  </motion.div>
                </motion.div>
              </div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="text-2xl font-bold text-white tracking-tight"
              >
                Your team is ready.
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="text-sm text-zinc-400 mt-1 max-w-sm"
              >
                "{name.trim()}" has been created successfully. Loading your workspace...
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── FORM CONTAINER: Animates width from 50% (Step 1) to 100% Full Container (Step 2) ─── */}
        <motion.div
          animate={{ width: isDesktop ? (step === 1 ? '50%' : '100%') : '100%' }}
          transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
          className="h-full flex flex-col justify-between p-4 sm:p-6 pb-3 sm:pb-4 relative z-10 bg-[#0C0D10] overflow-hidden shrink-0 border-r border-[#27272A]/50"
        >
          {/* Inner Content with animated maxWidth: Header fixed, content scrolls, footer fixed */}
          <motion.div
            animate={{ maxWidth: isDesktop ? (step === 1 ? 460 : 880) : '100%' }}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            className="w-full mx-auto flex flex-col h-full overflow-hidden justify-between"
          >
            {/* Top Header: Responsive Close Button + 2-Segment Progress (DevFlow logo removed) */}
            <div className="w-full space-y-2.5 shrink-0 pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
                  <span className="text-[10.5px] font-mono text-zinc-400 uppercase tracking-widest font-semibold">
                    Team Setup
                  </span>
                </div>
                {!isSuccess && (
                  <button
                    type="button"
                    onClick={handleRequestClose}
                    className="p-1.5 -mr-1 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer z-30"
                    title="Close (Esc)"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Segmented Step Progress Indicator (Step 1 of 2) */}
              <div className="w-full space-y-1.5" aria-label={`Step ${step} of 2`}>
                <div className="flex items-center gap-1.5 w-full">
                  <div className="relative h-1 flex-1 rounded-full overflow-hidden bg-white/[0.08]">
                    <div className="absolute inset-0 rounded-full" style={{ backgroundColor: accentColor }} />
                  </div>
                  <div className="relative h-1 flex-1 rounded-full overflow-hidden bg-white/[0.08]">
                    {step === 2 && (
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
                  <span>Step {step} of 2</span>
                  <span className="uppercase tracking-wider text-zinc-400 font-medium">
                    {step === 1 ? 'Team Identity' : 'Add Members'}
                  </span>
                </div>
              </div>
            </div>

            {/* Scrollable Form Content Container (Internal Scroll, Footer is Fixed) */}
            <div className="flex-1 min-h-0 overflow-y-auto py-2 pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
              <AnimatePresence mode="wait">
                {/* ─── STEP ONE: Create Your Team (Identity First) ────────────── */}
                {step === 1 ? (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3.5"
                  >
                    {/* Step Heading */}
                    <div>
                      <h2 className="text-[19px] sm:text-[21px] font-bold text-white tracking-tight leading-snug">
                        Create your team
                      </h2>
                      <p className="mt-0.5 text-xs text-zinc-400 leading-relaxed">
                        Give your team an identity before bringing everyone together.
                      </p>
                    </div>

                    {/* 1. Team Name Input */}
                    <div className="space-y-1">
                      <label
                        htmlFor="modal-team-name-input"
                        className="text-[11.5px] font-medium text-zinc-300 flex items-center justify-between"
                      >
                        <span>
                          Team name <span className="text-red-400">*</span>
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {name.length}/50
                        </span>
                      </label>
                      <div className="relative flex items-center">
                        <Users size={13} className="absolute left-3 text-zinc-500 pointer-events-none" />
                        <input
                          id="modal-team-name-input"
                          autoFocus
                          type="text"
                          maxLength={50}
                          value={name}
                          onChange={(e) => handleNameChange(e.target.value)}
                          placeholder="e.g. Frontend Engineering"
                          className={`w-full h-9 sm:h-10 pl-8 pr-3 rounded-xl bg-[#111216] border text-xs sm:text-[13px] text-white placeholder-zinc-500 transition-colors focus:outline-none focus:ring-1 font-medium ${
                            validationError
                              ? 'border-red-500/80 focus:border-red-400 focus:ring-red-400/30'
                              : 'border-[#27272A] focus:border-zinc-400 focus:ring-zinc-400/30'
                          }`}
                        />
                      </div>
                      {validationError && (
                        <p className="text-[10.5px] text-red-400 flex items-center gap-1 pt-0.5">
                          <AlertCircle size={11} />
                          <span>{validationError}</span>
                        </p>
                      )}
                    </div>

                    {/* 2. Team Identifier Input */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="modal-team-id-input"
                          className="text-[11.5px] font-medium text-zinc-300"
                        >
                          Team identifier
                        </label>
                        <span className="text-[10px] font-mono text-zinc-500">
                          Prefix: <span className="text-zinc-300 font-semibold">{displayIdentifier}-1</span>
                        </span>
                      </div>
                      <div className="relative flex items-center">
                        <Hash size={13} className="absolute left-3 text-zinc-500 pointer-events-none" />
                        <input
                          id="modal-team-id-input"
                          type="text"
                          maxLength={6}
                          value={identifier}
                          onChange={(e) => handleIdentifierChange(e.target.value)}
                          placeholder="e.g. FE"
                          className="w-full h-9 pl-8 pr-3 rounded-xl bg-[#111216] border border-[#27272A] text-xs font-mono uppercase tracking-wider text-white placeholder-zinc-500 transition-colors focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/30 font-semibold"
                        />
                      </div>
                    </div>

                    {/* 3. Team Avatar Selection: Same UI as onboarding StepProfile (Initials, 5 Quick Icons, 3-dots More, NO photo) */}
                    <div ref={moreButtonRef} className="space-y-1.5 pt-0.5 relative">
                      <div className="flex items-center justify-between">
                        <label className="text-[11.5px] font-medium text-zinc-300">
                          Choose team avatar
                        </label>
                        <span className="text-[10px] font-mono text-zinc-500">
                          Initials · Icons
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap py-2 px-1.5 overflow-visible">
                        {/* Order 1: Text Initials (Round and Small) */}
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
                          title="Use team initials"
                        >
                          {teamInitials}
                          {avatarType === 'initials' && (
                            <div
                              className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center text-white text-[7px] shadow"
                              style={{ backgroundColor: accentColor }}
                            >
                              <Check size={8} strokeWidth={3} />
                            </div>
                          )}
                        </button>

                        {/* Order 2: 5 Quick Icons (Round and Small) */}
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
                          onClick={() => setShowMoreModal((prev) => !prev)}
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

                      {/* Popover exactly like in onboard (Screenshot 1), positioned at left-0 bottom-12 so all 6 columns and X button fit completely */}
                      <AnimatePresence>
                        {showMoreModal && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.94, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.94, y: 8 }}
                            transition={{ duration: 0.18 }}
                            className="absolute left-0 bottom-12 z-50 p-3 rounded-2xl bg-[#17181D] border border-[#27272A] shadow-2xl w-[280px] max-w-full backdrop-blur-xl"
                          >
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.08]">
                              <span className="text-[11.5px] font-medium text-white flex items-center gap-1.5">
                                <Sparkles size={12} className="text-[#A78BFA]" />
                                <span>Choose Emoji ({MORE_AVATAR_ICONS.length})</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowMoreModal(false)}
                                className="text-zinc-500 hover:text-white p-0.5 rounded transition-colors cursor-pointer"
                              >
                                <X size={13} />
                              </button>
                            </div>

                            <div className="grid grid-cols-6 gap-1.5 max-h-52 overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-zinc-700">
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
                                      setShowMoreModal(false);
                                    }}
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                      isSelected
                                        ? 'bg-[#A78BFA] text-zinc-950 font-bold scale-105 shadow'
                                        : 'hover:bg-white/[0.08] text-zinc-300 hover:text-white'
                                    }`}
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

                    {/* 4. Team Color Palette (Below Avatar Icons) - Only changes avatar color, NOT button color! */}
                    <div className="space-y-1.5 pt-0.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11.5px] font-medium text-zinc-300">
                          Team color
                        </label>
                        <span className="text-[10px] font-mono text-zinc-500">
                          Avatar badge tone
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap py-2 px-1.5 overflow-visible">
                        {AVATAR_COLORS.map((c) => {
                          const isSelected = avatarColor.toLowerCase() === c.hex.toLowerCase();
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setAvatarColor(c.hex)}
                              className={`relative w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                                isSelected
                                  ? 'scale-115 ring-2 ring-offset-2 ring-offset-[#0C0D10]'
                                  : 'hover:scale-110 opacity-80 hover:opacity-100'
                              }`}
                              style={{
                                backgroundColor: c.hex,
                                borderColor: isSelected ? '#ffffff' : c.borderHex,
                              }}
                              title={c.name}
                            >
                              {isSelected && (
                                <Check size={11} strokeWidth={3} className="text-white drop-shadow-sm" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  /* ─── STEP TWO: Add Team Members (Two-Select Row + 3 Cards Row) ─── */
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.24 }}
                    className="space-y-3.5 w-full"
                  >
                    {/* Step Heading */}
                    <div>
                      <h2 className="text-[19px] sm:text-[21px] font-bold text-white tracking-tight leading-snug">
                        Bring your team together
                      </h2>
                      <p className="mt-0.5 text-xs text-zinc-400 leading-relaxed">
                        Choose the people who will collaborate with you.
                      </p>
                    </div>

                    {/* Two Selection Input One Row: First is User, Second is Role + Small Arrow Button */}
                    <div className="p-3 sm:p-3.5 rounded-2xl bg-[#111216]/95 border border-[#27272A] space-y-2 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11.5px] font-semibold text-zinc-200 flex items-center gap-1.5">
                          <span>Add Team Member</span>
                        </span>
                        {isLoadingUsers && (
                          <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                            <Loader2 size={10} className="animate-spin text-zinc-400" />
                            <span>Loading accounts...</span>
                          </span>
                        )}
                      </div>

                      {/* Inputs Row: First User, Second Role, Third Small Arrow Button */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
                        {/* 1. First: User Selection (only shows matched username that is public) */}
                        <div ref={accountSelectRef} className="relative flex-1 min-w-0">
                          <label className="block text-[10px] font-mono text-zinc-400 mb-1">
                            Select User
                          </label>

                          <button
                            type="button"
                            onClick={() => setIsAccountOpen((prev) => !prev)}
                            className={`w-full h-[38px] flex items-center justify-between gap-2 px-3 bg-[#111216] border rounded-lg text-xs text-left transition-all outline-none cursor-pointer ${
                              isAccountOpen
                                ? 'shadow-md'
                                : 'border-[#27272A] hover:border-zinc-600'
                            }`}
                            style={isAccountOpen ? { borderColor: accentColor, boxShadow: `0 0 0 1px ${accentColor}` } : {}}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                              {selectedAccount ? (
                                <div className="flex items-center gap-2 truncate">
                                  {renderMemberAvatar(selectedAccount, 'w-5 h-5', 10)}
                                  <span className="text-white font-medium truncate">
                                    {selectedAccount.name}
                                  </span>
                                  <span className="text-[10.5px] font-mono text-zinc-400 truncate flex items-center gap-1">
                                    <span
                                      className="w-1.5 h-1.5 rounded-full shrink-0"
                                      style={{ backgroundColor: selectedAccount.avatarColor || accentColor }}
                                    />
                                    <span>@{selectedAccount.username || selectedAccount.email.split('@')[0]}</span>
                                  </span>
                                </div>
                              ) : (
                                <span className="text-zinc-500 truncate flex items-center gap-1.5">
                                  <Search size={12} className="text-zinc-600 shrink-0" />
                                  <span>Enter username</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {selectedAccount && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAccount(null);
                                    setAccountSearchQuery('');
                                  }}
                                  className="text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer"
                                  title="Clear selection"
                                >
                                  <X size={11} />
                                </button>
                              )}
                              <ChevronDown
                                size={13}
                                className={`text-zinc-500 transition-transform duration-200 ${
                                  isAccountOpen ? 'rotate-180' : ''
                                }`}
                                style={isAccountOpen ? { color: accentColor } : {}}
                              />
                            </div>
                          </button>

                          {/* Account Search Dropdown: ONLY SHOWS MATCHED USERNAMES */}
                          <AnimatePresence>
                            {isAccountOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                                animate={{ opacity: 1, y: 4, scale: 1 }}
                                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                                className="absolute left-0 right-0 top-full z-50 p-2 bg-[#14161C]/98 backdrop-blur-xl border border-[#27272A] rounded-xl shadow-2xl overflow-hidden max-h-60 flex flex-col"
                              >
                                <div className="relative mb-2 flex items-center">
                                  <Search
                                    size={12}
                                    className="absolute left-2.5 text-zinc-500 pointer-events-none"
                                  />
                                  <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={accountSearchQuery}
                                    onChange={(e) => setAccountSearchQuery(e.target.value)}
                                    placeholder="Enter username"
                                    className="w-full pl-8 pr-7 py-1.5 bg-[#0C0D10] border border-[#27272A] rounded-lg text-xs font-mono text-white placeholder-zinc-500 outline-none transition-colors focus:border-zinc-400"
                                  />
                                  {accountSearchQuery && (
                                    <button
                                      type="button"
                                      onClick={() => setAccountSearchQuery('')}
                                      className="absolute right-2 text-zinc-500 hover:text-white p-0.5 cursor-pointer"
                                    >
                                      <X size={11} />
                                    </button>
                                  )}
                                </div>

                                <div className="overflow-y-auto space-y-0.5 pr-1 scrollbar-thin scrollbar-thumb-zinc-700 max-h-44">
                                  {cleanAccountQuery.length === 0 ? (
                                    <div className="py-5 text-center text-xs font-mono text-zinc-500 flex flex-col items-center gap-1.5">
                                      <Search size={14} className="text-zinc-600" />
                                      <span>Enter username to search accounts</span>
                                    </div>
                                  ) : matchingAccounts.length === 0 ? (
                                    <div className="py-4 text-center text-xs font-mono text-zinc-500">
                                      No public user matching "@{cleanAccountQuery}"
                                    </div>
                                  ) : (
                                    matchingAccounts.map((acc) => {
                                      const uHandle = acc.username || acc.email.split('@')[0];
                                      const isAdded = teamMembers.some(
                                        (m) =>
                                          m.username.toLowerCase() === uHandle.toLowerCase() ||
                                          m.id === String(acc.id)
                                      );
                                      const isSelected = selectedAccount?.id === acc.id;

                                      return (
                                        <button
                                          key={acc.id}
                                          type="button"
                                          onClick={() => {
                                            setSelectedAccount(acc);
                                            setIsAccountOpen(false);
                                          }}
                                          className={`w-full flex items-center justify-between gap-2 p-2 rounded-lg text-xs text-left transition-all cursor-pointer ${
                                            isSelected
                                              ? 'text-white font-medium'
                                              : 'text-zinc-300 hover:bg-white/[0.06] hover:text-white'
                                          }`}
                                          style={isSelected ? { backgroundColor: `${accentColor}25` } : {}}
                                        >
                                          <div className="flex items-center gap-2.5 min-w-0">
                                            {renderMemberAvatar(acc, 'w-6 h-6', 11)}
                                            <div className="min-w-0">
                                              <div className="font-semibold text-white truncate flex items-center gap-1.5 text-xs">
                                                <span>{acc.name}</span>
                                                {isAdded && (
                                                  <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                                                    In Team
                                                  </span>
                                                )}
                                              </div>
                                              <div className="text-[10.5px] font-mono text-[#A78BFA] truncate flex items-center gap-1.5">
                                                <span
                                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                                  style={{ backgroundColor: acc.avatarColor || '#8B5CF6' }}
                                                  title={`Avatar color: ${acc.avatarColor || '#8B5CF6'}`}
                                                />
                                                <span>@{uHandle}</span>
                                              </div>
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                                              Public
                                            </span>
                                            {isSelected && (
                                              <Check size={12} strokeWidth={2.5} className="text-[#A78BFA]" />
                                            )}
                                          </div>
                                        </button>
                                      );
                                    })
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* 2. Second: Role Selection (same AnimatedSelect from onboarding/settings) */}
                        <div className="w-full sm:w-44 md:w-48 shrink-0">
                          <label className="block text-[10px] font-mono text-zinc-400 mb-1">
                            Select Role
                          </label>
                          <AnimatedSelect
                            value={selectedRole}
                            onChange={(val) => setSelectedRole(val)}
                            options={ROLE_OPTIONS}
                            accentColor={accentColor}
                            placeholder="Select role..."
                            searchPlaceholder="Filter roles..."
                            className="w-full"
                            dropdownAlign="right"
                            dropdownMinWidth="w-full sm:min-w-[280px]"
                            hideSublabelInTrigger={true}
                          />
                        </div>

                        {/* 3. Third: Small Arrow Button to Make Entry */}
                        <div className="shrink-0 flex items-end">
                          <button
                            type="button"
                            onClick={() => handleAddMember()}
                            className="h-[38px] w-full sm:w-[38px] rounded-lg font-semibold text-black hover:brightness-110 active:scale-95 shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            style={{ backgroundColor: accentColor, boxShadow: `0 3px 12px ${accentColor}40` }}
                            title="Add member to team"
                          >
                            <span className="sm:hidden text-xs">Add</span>
                            <ArrowRight size={15} strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Team Members List (Pill Capsule Shape with side round) */}
                    <div className="space-y-2 flex-1 min-h-0 flex flex-col pt-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11.5px] font-semibold text-zinc-300">
                            Team Members
                          </span>
                          <span
                            className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium"
                            style={{ backgroundColor: `${accentColor}25`, color: accentColor }}
                          >
                            {teamMembers.length}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                          <Sparkles size={10} style={{ color: accentColor }} />
                          <span>Click avatar to customize icon & color</span>
                        </span>
                      </div>

                      {/* Capsule pills list */}
                      <div className="overflow-y-auto max-h-[145px] pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
                        <div className="flex flex-wrap gap-2">
                          {teamMembers.map((member) => (
                            <div
                              key={member.id}
                              className="inline-flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-full bg-[#13141A] border border-[#27272A] hover:border-zinc-700 transition-all shadow-sm group"
                            >
                              {/* Avatar (Clickable to customize) */}
                              <button
                                type="button"
                                onClick={() => setEditingMemberId(member.id)}
                                className="relative rounded-full p-0.5 transition-transform hover:scale-105 cursor-pointer shrink-0"
                                title="Click to customize avatar icon and color"
                              >
                                {renderMemberAvatar(member, 'w-7 h-7', 12)}
                                <div
                                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center text-[7px] text-zinc-950 shadow"
                                  style={{ backgroundColor: accentColor }}
                                >
                                  <Palette size={6} strokeWidth={3} />
                                </div>
                              </button>

                              {/* Name & Role */}
                              <div className="flex flex-col min-w-0 pr-1 text-left">
                                <div className="font-bold text-xs text-white truncate max-w-[120px] sm:max-w-[150px]">
                                  {member.name}
                                </div>
                                <div className="text-[10px] font-mono text-zinc-400 truncate flex items-center gap-1">
                                  <span
                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: member.avatarColor }}
                                  />
                                  <span>{member.role}</span>
                                </div>
                              </div>

                              {/* Delete / Close or You Badge */}
                              {member.isCurrentUser ? (
                                <span
                                  className="text-[9px] px-1.5 py-0.5 rounded-full font-mono font-medium border shrink-0"
                                  style={{
                                    backgroundColor: `${accentColor}25`,
                                    borderColor: `${accentColor}40`,
                                    color: accentColor,
                                  }}
                                >
                                  You
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="p-1 rounded-full text-zinc-500 hover:text-red-400 hover:bg-white/[0.08] transition-colors cursor-pointer shrink-0"
                                  title="Remove member"
                                >
                                  <X size={12} strokeWidth={2.5} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Small note: members only add when they accept invitations */}
                      <p className="text-[10.5px] text-zinc-400 flex items-center gap-1.5 pt-0.5">
                        <span className="text-zinc-500 font-mono">*</span>
                        <span>Members will only be added to the team once they accept their invitation.</span>
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom Navigation Buttons: Follows accentColor */}
            <div className="w-full pt-3 border-t border-white/[0.06] flex items-center justify-between shrink-0 bg-[#0C0D10]">
              {step === 1 ? (
                <button
                  type="button"
                  onClick={handleRequestClose}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <ArrowLeft size={13} />
                  <span>Back</span>
                </button>
              )}

              <div className="flex items-center gap-2">
                {step === 2 && (
                  <button
                    type="button"
                    onClick={handleRequestClose}
                    disabled={isSubmitting}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}

                {step === 1 ? (
                  <button
                    type="button"
                    onClick={handleProceedToStep2}
                    className="h-9 px-4 rounded-xl text-xs font-semibold text-black hover:brightness-110 active:scale-[0.98] shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                    style={{ backgroundColor: accentColor, boxShadow: `0 4px 14px ${accentColor}40` }}
                  >
                    <span>Continue</span>
                    <ArrowRight size={13} strokeWidth={2.5} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateTeamSubmit}
                    disabled={isSubmitting}
                    className="h-9 px-4 rounded-xl text-xs font-semibold text-black hover:brightness-110 active:scale-[0.98] shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: accentColor, boxShadow: `0 4px 14px ${accentColor}40` }}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={13} className="animate-spin text-black" />
                        <span>Saving and sending invitations...</span>
                      </>
                    ) : (
                      <>
                        <span>Save and send invitations</span>
                        <Sparkles size={13} />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* ─── RIGHT PANEL: Live Preview on Step 1 (Smoothly removed on Step 2 like OnboardingLayout) ─── */}
        <AnimatePresence>
          {step === 1 && (
            <motion.div
              key="preview-panel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 35, filter: 'blur(5px)' }}
              transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
              className="hidden md:flex w-1/2 h-full flex-col justify-center items-center p-6 sm:p-8 bg-[#101116] border-l border-white/[0.06] relative overflow-hidden select-none"
            >
              <div
                className="absolute inset-0 pointer-events-none opacity-[0.035]"
                style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
                  backgroundSize: '18px 18px',
                }}
              />

              <div className="w-full max-w-[340px] rounded-2xl bg-[#17181D]/90 backdrop-blur-md border border-white/[0.08] p-5 shadow-2xl flex flex-col items-center text-center relative z-10">
                <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-white/[0.06]">
                  <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-zinc-400">
                    <span
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{ backgroundColor: avatarColor }}
                    />
                    <span>TEAM PASSPORT</span>
                  </div>
                  <span className="text-[9.5px] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-zinc-300">
                    DevFlow Core
                  </span>
                </div>

                <div className="mb-2.5">{renderTeamAvatar('w-14 h-14', 26)}</div>

                <h3
                  className={`text-[17px] font-bold tracking-tight truncate max-w-full ${
                    name.trim() ? 'text-white' : 'text-zinc-500 italic'
                  }`}
                >
                  {name.trim() || 'Your team name'}
                </h3>

                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className="px-2 py-0.5 rounded-md font-mono text-[10.5px] font-semibold border"
                    style={{
                      backgroundColor: `${avatarColor}18`,
                      borderColor: `${avatarColor}40`,
                      color: avatarColor,
                    }}
                  >
                    {displayIdentifier}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {name.trim() ? 'Your team is taking shape' : "Your team's workspace starts here."}
                  </span>
                </div>

                <div className="w-full border-t border-white/[0.06] my-3.5" />

                <div className="w-full space-y-1.5 text-left">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Live issue preview</span>
                    <span>Sprint 1</span>
                  </div>

                  <div className="p-1.5 rounded-lg bg-black/30 border border-white/[0.04] flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono text-[10px] font-bold text-zinc-400">
                        {displayIdentifier}-1
                      </span>
                      <span className="text-zinc-300 text-[11px] truncate">
                        Build navigation components
                      </span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono shrink-0">
                      TODO
                    </span>
                  </div>

                  <div className="p-1.5 rounded-lg bg-black/30 border border-white/[0.04] flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono text-[10px] font-bold text-zinc-400">
                        {displayIdentifier}-2
                      </span>
                      <span className="text-zinc-300 text-[11px] truncate">
                        Improve dashboard layout
                      </span>
                    </div>
                    <span
                      className="text-[9px] px-1.5 py-0.2 rounded font-mono shrink-0 font-medium"
                      style={{ backgroundColor: `${avatarColor}25`, color: avatarColor }}
                    >
                      IN PROGRESS
                    </span>
                  </div>

                  <div className="p-1.5 rounded-lg bg-black/30 border border-white/[0.04] flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono text-[10px] font-bold text-zinc-400">
                        {displayIdentifier}-3
                      </span>
                      <span className="text-zinc-300 text-[11px] truncate">
                        Review component structure
                      </span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-mono shrink-0">
                      DONE
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>



        {/* ─── STEP 2: MEMBER AVATAR CUSTOMIZATION POPUP (Both Color & Emoji in ONE Popup!) ─── */}
        <AnimatePresence>
          {editingMember && (
            <div
              className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 rounded-2xl sm:rounded-3xl"
              onClick={() => setEditingMemberId(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 8 }}
                transition={{ duration: 0.16 }}
                className="w-[320px] bg-[#17181D] border border-[#27272A] rounded-2xl shadow-2xl p-3.5 space-y-3 backdrop-blur-xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header: Member info & Close button */}
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2">
                    {renderMemberAvatar(editingMember, 'w-7 h-7', 12)}
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate leading-tight">
                        {editingMember.name}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-400">
                        @{editingMember.username} · {editingMember.role}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingMemberId(null)}
                    className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                </div>

                {/* 1. Color Palette (At Top) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-zinc-300 flex items-center gap-1.5">
                      <Palette size={11} className="text-[#A78BFA]" />
                      <span>Avatar color</span>
                    </span>
                    <span className="text-[9.5px] font-mono text-zinc-500">
                      This team only
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap py-1 px-0.5">
                    {AVATAR_COLORS.map((c) => {
                      const isSelected =
                        editingMember.avatarColor.toLowerCase() === c.hex.toLowerCase();
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleUpdateMemberColor(c.hex)}
                          className={`relative w-5 h-5 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'scale-115 ring-2 ring-offset-2 ring-offset-[#17181D]'
                              : 'hover:scale-110 opacity-80 hover:opacity-100'
                          }`}
                          style={{
                            backgroundColor: c.hex,
                            borderColor: isSelected ? '#ffffff' : c.borderHex,
                          }}
                          title={c.name}
                        >
                          {isSelected && (
                            <Check size={9} strokeWidth={3} className="text-white drop-shadow-sm" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Choose Icon / Emoji Grid (Below Color) */}
                <div className="space-y-1 pt-1.5 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-zinc-300 flex items-center gap-1.5">
                      <Smile size={11} className="text-[#A78BFA]" />
                      <span>Choose icon ({ALL_AVATAR_ICONS.length})</span>
                    </span>
                    <span className="text-[9.5px] font-mono text-zinc-500">
                      Developer emojis
                    </span>
                  </div>

                  <div className="grid grid-cols-6 gap-1.5 max-h-36 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700 pt-0.5">
                    {ALL_AVATAR_ICONS.map((icon) => {
                      const IconComp = AVATAR_ICON_COMPONENTS[icon.id] || Smile;
                      const isSelected =
                        editingMember.avatarType === 'icon' && editingMember.avatarId === icon.id;

                      return (
                        <button
                          key={icon.id}
                          type="button"
                          onClick={() => handleUpdateMemberIcon(icon)}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'text-white shadow ring-2 ring-white/80 scale-105'
                              : 'text-zinc-400 hover:text-white hover:bg-white/[0.08]'
                          }`}
                          style={{
                            backgroundColor: isSelected ? editingMember.avatarColor : 'transparent',
                          }}
                          title={icon.name}
                        >
                          <IconComp size={13} strokeWidth={2.2} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ─── CONFIRM DISCARD DIALOG ────────────────────────────────────────── */}
        <AnimatePresence>
          {showConfirmDiscard && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-sm rounded-2xl bg-[#16171E] border border-[#27272A] p-5 shadow-2xl space-y-3"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <AlertCircle size={16} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Discard team setup?</h4>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Your entered team details and member selections will be lost.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowConfirmDiscard(false)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    Keep editing
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowConfirmDiscard(false);
                      onClose();
                    }}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-colors cursor-pointer"
                  >
                    Discard
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
