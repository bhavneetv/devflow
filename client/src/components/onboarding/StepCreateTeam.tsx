import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Search,
  Check,
  X,
  Plus,
  Shield,
  Trash2,
  ChevronDown,
  Sparkles,
  Globe,
  Smile,
  Palette,
  UserCheck,
  Crown,
  Loader2,
} from 'lucide-react';
import {
  OnboardingData,
  TeamMemberSetup,
  PublicAccountOption,
  MOCK_PUBLIC_ACCOUNTS,
  AVATAR_COLORS,
  QUICK_AVATAR_ICONS,
  MORE_AVATAR_ICONS,
  AvatarIconOption,
} from '../../types/onboarding';
import { AVATAR_ICON_COMPONENTS } from './StepProfile';
import { AnimatedSelect, SelectOption } from '../settings/AnimatedSelect';
import { apiUrl } from '../../config/api';
import { useToast } from '../../context/ToastContext';

interface StepCreateTeamProps {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
  error?: string;
}

const ROLE_OPTIONS: SelectOption[] = [
  { value: 'Lead', label: 'Lead', icon: <Crown size={14} className="text-amber-400" />, sublabel: 'Leadership' },
  { value: 'Admin', label: 'Admin', icon: <Shield size={14} className="text-indigo-400" />, sublabel: 'Manage & settings' },
  { value: 'Engineer', label: 'Engineer', icon: <Users size={14} className="text-emerald-400" />, sublabel: 'Code & reviews' },
  { value: 'Designer', label: 'Designer', icon: <Sparkles size={14} className="text-purple-400" />, sublabel: 'Design & assets' },
  { value: 'Product Manager', label: 'Product Manager', icon: <Globe size={14} className="text-blue-400" />, sublabel: 'Roadmaps & sprints' },
  { value: 'Viewer', label: 'Viewer', icon: <UserCheck size={14} className="text-zinc-400" />, sublabel: 'Read-only access' },
];

export const StepCreateTeam: React.FC<StepCreateTeamProps> = ({
  data,
  onChange,
  error,
}) => {
  const { toast } = useToast();
  const accent = data.accentColor || '#8B5CF6';

  // Team Name state
  const teamName = data.teamName ?? 'Core Engineering';
  const handleTeamNameChange = (val: string) => {
    onChange({ teamName: val });
  };

  // Current user member template
  const currentUserMember: TeamMemberSetup = {
    id: 'current-user',
    name: data.displayName || 'Developer',
    username: data.username || 'developer',
    role: 'Lead',
    avatarType: data.avatarType || 'initials',
    avatarId: data.avatarId || null,
    avatarColor: data.avatarColor || '#7C3AED',
    avatarUrl: data.avatarUrl || null,
    isCurrentUser: true,
  };

  // Members list (ensure current user is present)
  const teamMembers: TeamMemberSetup[] =
    data.teamMembers && data.teamMembers.length > 0
      ? data.teamMembers
      : [currentUserMember];

  // Helper to update team members
  const updateMembers = (newMembers: TeamMemberSetup[]) => {
    onChange({ teamMembers: newMembers });
  };

  // Role select state (using AnimatedSelect from settings)
  const [selectedRole, setSelectedRole] = useState<string>('Engineer');

  // Real Database accounts state
  const [dbAccounts, setDbAccounts] = useState<PublicAccountOption[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);

  // Fetch real users from database
  useEffect(() => {
    let isMounted = true;
    async function fetchRealAccounts() {
      setIsLoadingAccounts(true);
      try {
        const res = await fetch(apiUrl('/api/users'));
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            const mapped: PublicAccountOption[] = json.data
              .filter((u: any) => u.isPublicProfile !== false)
              .map((u: any) => {
                const handle =
                  u.username ||
                  (u.email
                    ? u.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.-]/g, '')
                    : `user_${u.id}`);
                return {
                  id: String(u.id),
                  name: u.name || 'Developer',
                  username: handle,
                  email: u.email || '',
                  avatarType: (u.avatarType as any) || (u.avatarUrl ? 'upload' : 'icon'),
                  avatarId: u.avatarId || 'smile',
                  avatarColor: u.avatarColor || '#8B5CF6',
                  avatarUrl: u.avatarUrl || null,
                  isPublicProfile: u.isPublicProfile ?? true,
                  defaultRole: u.role === 'ADMIN' ? 'Admin' : 'Engineer',
                };
              });

            if (isMounted) {
              // Combine real DB accounts with fallback mock accounts ensuring uniqueness
              const existingHandles = new Set(mapped.map((m) => m.username.toLowerCase()));
              const nonCollidingMocks = MOCK_PUBLIC_ACCOUNTS.filter(
                (m) => !existingHandles.has(m.username.toLowerCase())
              );
              setDbAccounts([...mapped, ...nonCollidingMocks]);
            }
          }
        }
      } catch (err) {
        console.warn('Could not load database users, using fallback public accounts:', err);
        if (isMounted) {
          setDbAccounts(MOCK_PUBLIC_ACCOUNTS);
        }
      } finally {
        if (isMounted) setIsLoadingAccounts(false);
      }
    }

    fetchRealAccounts();
    return () => {
      isMounted = false;
    };
  }, []);

  // Account selector state (matching AnimatedSelect open dropdown style)
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<PublicAccountOption | null>(null);
  const [accountSearchQuery, setAccountSearchQuery] = useState('');
  const accountSelectRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Focus search input when account select opens
  useEffect(() => {
    if (isAccountOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isAccountOpen]);

  // Clean query for search
  const cleanAccountQuery = accountSearchQuery.trim().toLowerCase().replace(/^@+/, '');

  // CRITICAL REQUIREMENT: "not show the list of users only show when user type and mathc the username"
  const matchingAccounts = cleanAccountQuery.length > 0
    ? dbAccounts.filter((acc) => {
        if (!acc.isPublicProfile) return false;
        return (
          acc.username.toLowerCase().includes(cleanAccountQuery) ||
          acc.name.toLowerCase().includes(cleanAccountQuery)
        );
      })
    : [];

  // Avatar Customization Popup state (small popup same as first tab)
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const editingMember = teamMembers.find((m) => m.id === editingMemberId);

  // Handle adding member
  const handleAddMember = (accountToAdd?: PublicAccountOption) => {
    let acc = accountToAdd || selectedAccount;

    // Direct match if query typed and not clicked
    if (!acc && cleanAccountQuery.length > 0) {
      const match = matchingAccounts.find(
        (a) => a.username.toLowerCase() === cleanAccountQuery
      ) || matchingAccounts[0];
      if (match) acc = match;
    }

    if (!acc) {
      toast.error('Please search and select a database account to add.');
      return;
    }

    const alreadyExists = teamMembers.some(
      (m) =>
        m.username.toLowerCase() === acc.username.toLowerCase() ||
        m.id === acc.id
    );

    if (alreadyExists) {
      toast.info(`@${acc.username} is already a member of this team.`);
      return;
    }

    const newMember: TeamMemberSetup = {
      id: acc.id,
      name: acc.name,
      username: acc.username,
      role: selectedRole,
      avatarType: acc.avatarType,
      avatarId: acc.avatarId || null,
      avatarColor: acc.avatarColor,
      avatarUrl: acc.avatarUrl || null,
      isCurrentUser: false,
    };

    updateMembers([...teamMembers, newMember]);
    setSelectedAccount(null);
    setAccountSearchQuery('');
    setIsAccountOpen(false);
    toast.success(`@${acc.username} added as ${selectedRole}!`);
  };

  // Handle removing member
  const handleRemoveMember = (id: string) => {
    const updated = teamMembers.filter((m) => m.id !== id);
    updateMembers(updated);
  };

  // Handle changing avatar color for specific team member
  const handleUpdateMemberColor = (colorHex: string) => {
    if (!editingMemberId) return;
    const updated = teamMembers.map((m) =>
      m.id === editingMemberId ? { ...m, avatarColor: colorHex } : m
    );
    updateMembers(updated);
  };

  // Handle changing avatar icon for specific team member
  const handleUpdateMemberIcon = (iconOption: AvatarIconOption) => {
    if (!editingMemberId) return;
    const updated = teamMembers.map((m) =>
      m.id === editingMemberId
        ? {
            ...m,
            avatarType: 'icon' as const,
            avatarId: iconOption.id,
          }
        : m
    );
    updateMembers(updated);
  };

  // Render member avatar circle
  const renderMemberAvatar = (
    member: TeamMemberSetup,
    sizeClass = 'w-9 h-9',
    iconSize = 15
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
          className={`${sizeClass} rounded-full flex items-center justify-center text-white shadow-sm transition-transform shrink-0`}
          style={{ backgroundColor: member.avatarColor }}
        >
          <IconComp size={iconSize} strokeWidth={2.2} />
        </div>
      );
    }

    // Initials fallback
    const initials =
      member.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('') || member.username.slice(0, 2).toUpperCase();

    return (
      <div
        className={`${sizeClass} rounded-full flex items-center justify-center text-white font-mono font-bold text-[11px] shadow-sm shrink-0`}
        style={{ backgroundColor: member.avatarColor }}
      >
        {initials}
      </div>
    );
  };

  // Render public account avatar option in search dropdown
  const renderAccountOptionAvatar = (acc: PublicAccountOption) => {
    if (acc.avatarType === 'upload' && acc.avatarUrl) {
      return (
        <img
          src={acc.avatarUrl}
          alt={acc.name}
          className="w-6 h-6 rounded-full object-cover border border-white/10 shrink-0"
        />
      );
    }
    if (acc.avatarType === 'icon' && acc.avatarId) {
      const IconComp = AVATAR_ICON_COMPONENTS[acc.avatarId] || Smile;
      return (
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0"
          style={{ backgroundColor: acc.avatarColor }}
        >
          <IconComp size={12} strokeWidth={2.2} />
        </div>
      );
    }
    const initials = acc.name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
    return (
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-white font-mono text-[9px] font-bold shrink-0"
        style={{ backgroundColor: acc.avatarColor }}
      >
        {initials}
      </div>
    );
  };

  const allAvatarIcons = [...QUICK_AVATAR_ICONS, ...MORE_AVATAR_ICONS];

  return (
    <div className="w-full flex flex-col gap-3.5 select-none relative">
      {/* 1. Header */}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center"
            style={{ backgroundColor: `${accent}25`, color: accent }}
          >
            <Users size={12} />
          </div>
          <span className="text-[10.5px] font-mono font-semibold tracking-wider uppercase text-zinc-400">
            Team Workspace
          </span>
        </div>
        <h1 className="text-[20px] sm:text-[23px] font-bold text-white tracking-tight leading-snug">
          Create your first team
        </h1>
        <p className="mt-0.5 text-[12.5px] text-zinc-400 leading-relaxed">
          Assemble your core team to collaborate on projects, code reviews, and sprints.
        </p>
      </div>

      {/* 2. Team Name Input */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="team-name-input"
          className="text-[11.5px] font-medium text-zinc-300 flex items-center justify-between"
        >
          <span>Team Name</span>
          <span className="text-[10px] font-mono text-zinc-500">
            devflow.io/teams/{teamName.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'team'}
          </span>
        </label>
        <div className="relative flex items-center">
          <Users size={13} className="absolute left-3 text-zinc-500 pointer-events-none" />
          <input
            id="team-name-input"
            type="text"
            required
            maxLength={40}
            value={teamName}
            onChange={(e) => handleTeamNameChange(e.target.value)}
            placeholder="e.g. Core Engineering, Product Squad, Mobile Team"
            className="w-full h-9 pl-8 pr-4 rounded-xl bg-[#111216] border border-[#27272A] text-xs text-white placeholder-zinc-500 transition-colors focus:outline-none focus:border-zinc-400 font-medium"
          />
        </div>
        {error && <span className="text-[10.5px] text-red-400">{error}</span>}
      </div>

      {/* 3. Add Member Section: Two Selects using AnimatedSelect */}
      <div className="p-3 sm:p-3.5 rounded-2xl bg-[#111216]/95 border border-[#27272A] space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11.5px] font-semibold text-zinc-200 flex items-center gap-1.5">
            <Plus size={12} style={{ color: accent }} />
            <span>Add Member</span>
          </span>
          <span className="text-[10px] font-mono text-zinc-500">
            {isLoadingAccounts ? (
              <span className="flex items-center gap-1">
                <Loader2 size={10} className="animate-spin text-zinc-400" />
                <span>Loading accounts...</span>
              </span>
            ) : (
              'Real accounts from database'
            )}
          </span>
        </div>

        {/* Inputs Row: Role Select + Account Select + Add Button */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
          {/* Input 1: Select Role (AnimatedSelect from account settings) */}
          <div className="sm:col-span-4">
            <label className="block text-[10px] font-mono text-zinc-400 mb-1">
              Select Role
            </label>
            <AnimatedSelect
              value={selectedRole}
              onChange={(val) => setSelectedRole(val)}
              options={ROLE_OPTIONS}
              accentColor={accent}
              placeholder="Select role..."
              searchPlaceholder="Filter roles..."
              className="w-full"
            />
          </div>

          {/* Input 2: Select Account (same AnimatedSelect design, search real accounts from DB) */}
          <div ref={accountSelectRef} className="relative sm:col-span-6">
            <label className="block text-[10px] font-mono text-zinc-400 mb-1">
              Select Account
            </label>

            {/* Trigger Button with same animated select styling */}
            <button
              type="button"
              onClick={() => setIsAccountOpen((prev) => !prev)}
              className={`w-full h-9 flex items-center justify-between gap-2 px-3 bg-[#111216] border rounded-lg text-xs text-left transition-all outline-none cursor-pointer ${
                isAccountOpen
                  ? 'border-[#27272A] shadow-md ring-1'
                  : 'border-[#27272A] hover:border-zinc-600'
              }`}
              style={
                isAccountOpen
                  ? { borderColor: accent, boxShadow: `0 0 0 1px ${accent}` }
                  : undefined
              }
            >
              <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                {selectedAccount ? (
                  <div className="flex items-center gap-2 truncate">
                    {renderAccountOptionAvatar(selectedAccount)}
                    <span className="text-white font-medium truncate">
                      {selectedAccount.name}
                    </span>
                    <span className="text-[10.5px] font-mono text-zinc-400 truncate">
                      @{selectedAccount.username}
                    </span>
                  </div>
                ) : (
                  <span className="text-zinc-500 truncate flex items-center gap-1.5">
                    <Search size={12} className="text-zinc-600 shrink-0" />
                    <span>Select database account...</span>
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
                    className="text-zinc-500 hover:text-zinc-300 p-0.5"
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
                  style={isAccountOpen ? { color: accent } : undefined}
                />
              </div>
            </button>

            {/* Floating Dropdown: ONLY SHOWS LIST WHEN TYPING & MATCHING USERNAME */}
            <AnimatePresence>
              {isAccountOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 4, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute left-0 right-0 top-full z-50 p-2 bg-[#14161C]/95 backdrop-blur-xl border border-[#27272A] rounded-xl shadow-2xl overflow-hidden max-h-64 flex flex-col"
                >
                  {/* Search Input Bar */}
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
                      placeholder="Type username (e.g. sarah, bob, bhavneet)..."
                      className="w-full pl-8 pr-7 py-1.5 bg-[#0C0D10] border border-[#27272A] rounded-lg text-xs font-mono text-white placeholder-zinc-500 outline-none transition-colors focus:border-zinc-400"
                    />
                    {accountSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setAccountSearchQuery('')}
                        className="absolute right-2 text-zinc-500 hover:text-white p-0.5"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>

                  {/* Options List */}
                  <div className="overflow-y-auto space-y-0.5 pr-1 scrollbar-thin scrollbar-thumb-zinc-700 max-h-48">
                    {cleanAccountQuery.length === 0 ? (
                      <div className="py-5 text-center text-xs font-mono text-zinc-500 flex flex-col items-center gap-1.5">
                        <Search size={14} className="text-zinc-600" />
                        <span>Type username to search database accounts</span>
                      </div>
                    ) : matchingAccounts.length === 0 ? (
                      <div className="py-4 text-center text-xs font-mono text-zinc-500">
                        No public user matching "@{cleanAccountQuery}"
                      </div>
                    ) : (
                      matchingAccounts.map((acc) => {
                        const isAdded = teamMembers.some(
                          (m) =>
                            m.username.toLowerCase() === acc.username.toLowerCase() ||
                            m.id === acc.id
                        );
                        const isSelected = selectedAccount?.id === acc.id;

                        return (
                          <motion.button
                            key={acc.id}
                            type="button"
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setSelectedAccount(acc);
                              setIsAccountOpen(false);
                            }}
                            className={`w-full flex items-center justify-between gap-2 p-2 rounded-lg text-xs text-left transition-all ${
                              isSelected
                                ? 'bg-white/10 text-white font-medium'
                                : 'text-zinc-300 hover:bg-white/[0.06] hover:text-white'
                            }`}
                            style={
                              isSelected
                                ? { backgroundColor: `${accent}20`, color: '#FFFFFF' }
                                : undefined
                            }
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {renderAccountOptionAvatar(acc)}
                              <div className="min-w-0">
                                <div className="font-semibold text-white truncate flex items-center gap-1.5 text-xs">
                                  <span>{acc.name}</span>
                                  {isAdded && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                                      In Team
                                    </span>
                                  )}
                                </div>
                                <div
                                  className="text-[10.5px] font-mono truncate"
                                  style={{ color: accent }}
                                >
                                  @{acc.username}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                                Public
                              </span>
                              {isSelected && (
                                <Check
                                  size={12}
                                  strokeWidth={2.5}
                                  style={{ color: accent }}
                                />
                              )}
                            </div>
                          </motion.button>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Add Button */}
          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={() => handleAddMember()}
              className="w-full h-9 rounded-lg font-semibold text-xs text-black flex items-center justify-center gap-1 transition-all hover:brightness-110 active:scale-95 shadow cursor-pointer"
              style={{ backgroundColor: accent }}
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>Add</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Team Members: Card Shape, 3 Cards in One Row, with Scroll */}
      <div className="space-y-1.5 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[11.5px] font-semibold text-zinc-300">
              Team Members
            </span>
            <span
              className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium"
              style={{ backgroundColor: `${accent}25`, color: accent }}
            >
              {teamMembers.length}
            </span>
          </div>
          <span className="text-[10px] text-zinc-400 flex items-center gap-1">
            <Sparkles size={10} style={{ color: accent }} />
            <span>Click avatar to customize icon & color</span>
          </span>
        </div>

        {/* 3 cards per row grid with scroll */}
        <div className="overflow-y-auto max-h-[195px] pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="p-2.5 rounded-xl bg-[#13141A] border border-[#27272A] hover:border-zinc-700 transition-all flex flex-col justify-between gap-2 group relative shadow-sm"
              >
                {/* Card Top: Avatar (Clickable to customize) + Actions (You badge or Trash) */}
                <div className="flex items-start justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingMemberId(member.id)}
                    className="relative rounded-full p-0.5 transition-transform hover:scale-108 cursor-pointer focus:outline-none ring-2 ring-transparent hover:ring-white/40 shrink-0 group/avatar"
                    title="Click to customize avatar icon and color for this team"
                  >
                    {renderMemberAvatar(member, 'w-8 h-8', 13)}
                    <div
                      className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center text-[7px] text-zinc-950 shadow group-hover/avatar:scale-110 transition-transform"
                      style={{ backgroundColor: accent }}
                    >
                      <Palette size={7} strokeWidth={3} />
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    {member.isCurrentUser ? (
                      <span
                        className="text-[9px] px-1.5 py-0.2 rounded-full font-mono font-medium border"
                        style={{
                          backgroundColor: `${accent}20`,
                          borderColor: `${accent}40`,
                          color: accent,
                        }}
                      >
                        You
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Remove member"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Middle: Name and Username */}
                <div className="min-w-0">
                  <div
                    className="font-semibold text-xs text-white truncate"
                    title={member.name}
                  >
                    {member.name}
                  </div>
                  <div
                    className="text-[10px] font-mono text-zinc-400 truncate"
                    title={`@${member.username}`}
                  >
                    @{member.username}
                  </div>
                </div>

                {/* Card Bottom: Role badge with color dot + Edit avatar link */}
                <div className="pt-1.5 border-t border-white/[0.04] flex items-center justify-between">
                  <span
                    className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-medium border inline-flex items-center gap-1 truncate max-w-[70%]"
                    style={{
                      backgroundColor: `${member.avatarColor}18`,
                      borderColor: `${member.avatarColor}35`,
                      color: '#FFFFFF',
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: member.avatarColor }}
                    />
                    <span className="truncate">{member.role}</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => setEditingMemberId(member.id)}
                    className="text-[9.5px] text-zinc-500 hover:text-zinc-300 font-mono transition-colors cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Avatar Customization Popup: Small compact modal same as first tab */}
      <AnimatePresence>
        {editingMember && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-150"
            onClick={() => setEditingMemberId(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 8 }}
              transition={{ duration: 0.16 }}
              className="w-[300px] bg-[#17181D] border border-[#27272A] rounded-2xl shadow-2xl p-3 space-y-2.5 backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header: Mini member info and Close button */}
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  {renderMemberAvatar(editingMember, 'w-6 h-6', 11)}
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

              {/* Color Palette (At Top) - Small same as tab 1 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-zinc-300 flex items-center gap-1.5">
                    <Palette size={11} style={{ color: accent }} />
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

              {/* Icons Grid (Developer emojis) - Small same as tab 1 */}
              <div className="space-y-1 pt-1 border-t border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-zinc-300 flex items-center gap-1.5">
                    <Smile size={11} style={{ color: accent }} />
                    <span>Choose icon ({allAvatarIcons.length})</span>
                  </span>
                  <span className="text-[9.5px] font-mono text-zinc-500">
                    Developer emojis
                  </span>
                </div>

                <div className="grid grid-cols-6 gap-1 max-h-36 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
                  {allAvatarIcons.map((icon) => {
                    const isSelected =
                      editingMember.avatarType === 'icon' &&
                      editingMember.avatarId === icon.id;
                    const IconComp = AVATAR_ICON_COMPONENTS[icon.id] || Smile;

                    return (
                      <button
                        key={icon.id}
                        type="button"
                        onClick={() => handleUpdateMemberIcon(icon)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'text-white font-bold scale-105 shadow'
                            : 'hover:bg-white/[0.08] text-zinc-400 hover:text-white'
                        }`}
                        style={{
                          backgroundColor: isSelected
                            ? editingMember.avatarColor
                            : undefined,
                        }}
                        title={icon.name}
                      >
                        <IconComp size={13} strokeWidth={2.2} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Done button */}
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => setEditingMemberId(null)}
                  className="px-3 py-1 rounded-lg text-black font-semibold text-[11px] shadow transition-all hover:brightness-110 active:scale-95 cursor-pointer"
                  style={{ backgroundColor: accent }}
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
