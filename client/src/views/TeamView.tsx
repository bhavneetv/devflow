import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Users, UserPlus, Search, Clock, CheckCircle2, Crown,
  MoreHorizontal, Shield, Trash2, RefreshCw, X, ChevronDown,
  Copy, Check, AlertCircle, Loader2, Mail, Building2, Plus,
  Filter, UserMinus, Settings, LayoutGrid, List, ArrowLeft, ArrowRight,
  Star, Edit3, Key, Terminal, Code, Sparkles, Globe, UserCheck, RotateCcw,
  FolderKanban, PieChart, TrendingUp, CheckSquare, Activity, Info, Palette, Smile
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { teamService } from '../services/team.service';
import { authService } from '../services/auth.service';
import { accountSettingsService } from '../services/accountSettings.service';
import { CreateTeamModal } from '../components/team/CreateTeamModal';
import { AVATAR_ICON_COMPONENTS } from '../components/onboarding/StepProfile';
import { AnimatedSelect, SelectOption } from '../components/settings/AnimatedSelect';
import { SettingsSectionNav, SettingsCategory } from '../components/settings/SettingsSectionNav';
import { SettingsSection } from '../components/settings/SettingsSection';
import { SettingsRow } from '../components/settings/SettingsRow';
import { AccountSettingsLayout } from '../components/settings/AccountSettingsLayout';
import { useAccentTheme } from '../services/accentTheme.service';
import { useNavigation } from '../context/NavigationContext';
import { QUICK_AVATAR_ICONS, MORE_AVATAR_ICONS, AVATAR_COLORS } from '../types/onboarding';
import { cn } from '../lib/utils';
import { apiUrl } from '../config/api';
import type { Team, TeamMember, TeamInvitation, TeamMemberRole } from '../types/team';
import { ROLE_LABELS, ROLE_COLORS, ASSIGNABLE_ROLES } from '../types/team';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface RemovedMemberItem {
  id: number;
  userId: number;
  teamId: number;
  name: string;
  email: string;
  role: TeamMemberRole;
  removedAt: string;
  avatarUrl?: string | null;
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

// ─── Role Options for Custom AnimatedSelects ────────────────────────────────

const DISPLAY_ROLE_LABELS: Record<string, string> = {
  OWNER: 'Lead',
  ADMIN: 'Admin',
  DEVELOPER: 'Engineer',
  FRONTEND_DEVELOPER: 'Engineer',
  BACKEND_DEVELOPER: 'Engineer',
  TESTER: 'Engineer',
  DESIGNER: 'Designer',
  PROJECT_MANAGER: 'Product Manager',
  VIEWER: 'Viewer',
};

const INVITE_ROLE_OPTIONS: SelectOption[] = [
  { value: 'ADMIN', label: 'Admin', icon: <Shield size={14} className="text-indigo-400" />, sublabel: 'Manage & settings' },
  { value: 'DEVELOPER', label: 'Engineer', icon: <Users size={14} className="text-emerald-400" />, sublabel: 'Code & reviews' },
  { value: 'DESIGNER', label: 'Designer', icon: <Sparkles size={14} className="text-purple-400" />, sublabel: 'Design & assets' },
  { value: 'PROJECT_MANAGER', label: 'Product Manager', icon: <Globe size={14} className="text-blue-400" />, sublabel: 'Roadmaps & sprints' },
  { value: 'VIEWER', label: 'Viewer', icon: <UserCheck size={14} className="text-zinc-400" />, sublabel: 'Read-only access' },
];

const EDIT_ROLE_OPTIONS: SelectOption[] = [
  { value: 'OWNER', label: 'Lead', icon: <Crown size={14} className="text-amber-400" />, sublabel: 'Leadership & ownership' },
  { value: 'ADMIN', label: 'Admin', icon: <Shield size={14} className="text-indigo-400" />, sublabel: 'Manage & settings' },
  { value: 'DEVELOPER', label: 'Engineer', icon: <Users size={14} className="text-emerald-400" />, sublabel: 'Code & reviews' },
  { value: 'DESIGNER', label: 'Designer', icon: <Sparkles size={14} className="text-purple-400" />, sublabel: 'Design & assets' },
  { value: 'PROJECT_MANAGER', label: 'Product Manager', icon: <Globe size={14} className="text-blue-400" />, sublabel: 'Roadmaps & sprints' },
  { value: 'VIEWER', label: 'Viewer', icon: <UserCheck size={14} className="text-zinc-400" />, sublabel: 'Read-only access' },
];

const ROLE_FILTER_OPTIONS: SelectOption[] = [
  { value: '', label: 'All roles', icon: <Filter size={13} className="text-zinc-400" /> },
  { value: 'OWNER', label: 'Lead', icon: <Crown size={13} className="text-amber-400" />, sublabel: 'Leadership' },
  { value: 'ADMIN', label: 'Admin', icon: <Shield size={13} className="text-indigo-400" />, sublabel: 'Manage & settings' },
  { value: 'DEVELOPER', label: 'Engineer', icon: <Users size={13} className="text-emerald-400" />, sublabel: 'Code & reviews' },
  { value: 'DESIGNER', label: 'Designer', icon: <Sparkles size={13} className="text-purple-400" />, sublabel: 'Design & assets' },
  { value: 'PROJECT_MANAGER', label: 'Product Manager', icon: <Globe size={13} className="text-blue-400" />, sublabel: 'Roadmaps & sprints' },
  { value: 'VIEWER', label: 'Viewer', icon: <UserCheck size={13} className="text-zinc-400" />, sublabel: 'Read-only access' },
];

// ─── Utility helpers ─────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getAvatarBg(str: string): string {
  const colors = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#BE185D', '#0891B2', '#6D28D9'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const getCustomMemberAvatar = (
  userId?: number | string | null
): { color: string; iconId: string; type: 'initials' | 'icon' } | null => {
  if (!userId) return null;
  try {
    const saved = localStorage.getItem('devflow_team_member_custom_avatars');
    if (!saved) return null;
    const map = JSON.parse(saved);
    return map[String(userId)] || null;
  } catch {
    return null;
  }
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Avatar: React.FC<{
  name: string;
  avatarUrl?: string | null;
  size?: number;
  muted?: boolean;
  avatarColor?: string | null;
  avatarId?: string | null;
  avatarType?: 'initials' | 'icon' | 'upload' | string | null;
  userId?: number | string | null;
}> = ({
  name,
  avatarUrl,
  size = 32,
  muted = false,
  avatarColor,
  avatarId,
  avatarType,
  userId,
}) => {
  const custom = userId ? getCustomMemberAvatar(userId) : null;
  const effectiveColor = avatarColor || custom?.color || getAvatarBg(name);
  const effectiveType = avatarType || custom?.type;
  const effectiveId = avatarId || custom?.iconId;
  const IconComp = effectiveType === 'icon' && effectiveId ? (AVATAR_ICON_COMPONENTS[effectiveId] || Sparkles) : null;

  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 overflow-hidden font-semibold text-white shadow-sm"
      style={{
        width: size,
        height: size,
        backgroundColor: avatarUrl ? 'transparent' : effectiveColor,
        fontSize: size * 0.33,
        opacity: muted ? 0.5 : 1,
      }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
      ) : IconComp ? (
        <IconComp size={Math.round(size * 0.52)} strokeWidth={2.2} />
      ) : (
        getInitials(name)
      )}
    </div>
  );
};

const RoleBadge: React.FC<{ role: TeamMemberRole; small?: boolean }> = ({ role, small = false }) => {
  const colors = ROLE_COLORS[role] || { bg: '#27272A', text: '#A1A1AA', border: '#3F3F46' };
  const label = DISPLAY_ROLE_LABELS[role] || ROLE_LABELS[role] || role;
  return (
    <span
      className={`inline-flex items-center font-medium rounded-md whitespace-nowrap ${small ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'}`}
      style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
    >
      {role === 'OWNER' && <Crown size={small ? 9 : 10} className="mr-1" />}
      {role === 'ADMIN' && <Shield size={small ? 9 : 10} className="mr-1" />}
      {label}
    </span>
  );
};

// Helper to parse key and icon metadata encoded in description
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

// Render team icon or initials avatar with team color
const renderTeamAvatar = (
  team: { name: string; color: string; description?: string | null },
  sizeClass = 'w-11 h-11',
  iconSize = 20
) => {
  const { key, icon } = parseTeamMetadata(team.description, team.name);
  if (icon && icon !== 'initials' && AVATAR_ICON_COMPONENTS[icon]) {
    const IconComp = AVATAR_ICON_COMPONENTS[icon];
    return (
      <div
        className={`${sizeClass} rounded-xl flex items-center justify-center text-white shrink-0 shadow-md transition-transform duration-200 group-hover:scale-105`}
        style={{
          backgroundColor: team.color || '#8B5CF6',
          boxShadow: `0 4px 14px ${team.color || '#8B5CF6'}35`,
        }}
      >
        <IconComp size={iconSize} strokeWidth={2.2} />
      </div>
    );
  }

  const initials = key.slice(0, 3) || getInitials(team.name);
  return (
    <div
      className={`${sizeClass} rounded-xl flex items-center justify-center text-white font-mono font-bold text-xs shrink-0 shadow-md transition-transform duration-200 group-hover:scale-105`}
      style={{
        backgroundColor: team.color || '#8B5CF6',
        boxShadow: `0 4px 14px ${team.color || '#8B5CF6'}35`,
      }}
    >
      {initials}
    </div>
  );
};

// ─── Audi-Style Overlapping Circle Group for Team Members ───────────────────

const renderMemberAvatarStack = (
  members: any[],
  max: number = 6,
  onMemberClick?: (member: any) => void
) => {
  if (!members || members.length === 0) return null;
  const visible = members.slice(0, max);
  const remaining = members.length - max;

  return (
    <div className="flex items-center -space-x-2.5 overflow-visible select-none py-0.5">
      {visible.map((m: any, idx: number) => {
        const uName = m?.user?.name || m?.name || 'Member';
        const uAvatar = m?.user?.avatarUrl || m?.avatarUrl;
        const uUserId = m?.userId || m?.user?.id || m?.id;
        const custom = getCustomMemberAvatar(uUserId);
        const uColor = m?.user?.avatarColor || m?.avatarColor || custom?.color || getAvatarBg(uName);
        const uType = m?.user?.avatarType || m?.avatarType || custom?.type;
        const uIconId = m?.user?.avatarId || m?.avatarId || custom?.iconId;
        const uRole = m?.role ? (ROLE_LABELS[m.role as TeamMemberRole] || m.role) : 'Member';
        const IconComp = uType === 'icon' && uIconId ? (AVATAR_ICON_COMPONENTS[uIconId] || Sparkles) : null;

        return (
          <div
            key={m?.id || idx}
            onClick={() => onMemberClick && onMemberClick(m)}
            className="relative rounded-full ring-2 ring-[#0C0D10] overflow-hidden shrink-0 hover:z-30 hover:scale-115 transition-all duration-150 cursor-pointer shadow-md"
            style={{
              width: 30,
              height: 30,
              zIndex: 10 - idx,
            }}
            title={`${uName} (${uRole})`}
          >
            {uAvatar ? (
              <img src={uAvatar} alt={uName} className="w-full h-full object-cover" />
            ) : IconComp ? (
              <div
                className="w-full h-full flex items-center justify-center font-bold text-white"
                style={{ backgroundColor: uColor }}
              >
                <IconComp size={15} strokeWidth={2.2} />
              </div>
            ) : (
              <div
                className="w-full h-full flex items-center justify-center font-bold text-white text-[10px]"
                style={{ backgroundColor: uColor }}
              >
                {getInitials(uName)}
              </div>
            )}
          </div>
        );
      })}
      {remaining > 0 && (
        <div
          className="relative rounded-full ring-2 ring-[#0C0D10] bg-[#1E1F26] border border-[#27272A] flex items-center justify-center shrink-0 text-[11px] font-bold font-mono text-zinc-300 shadow-md hover:z-30 hover:scale-115 transition-all duration-150 cursor-pointer"
          style={{
            width: 30,
            height: 30,
            zIndex: 1,
          }}
          title={`${remaining} more member${remaining > 1 ? 's' : ''}`}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
};

// Skeleton loader
const SkeletonRow: React.FC = () => (
  <div className="flex items-center gap-3 p-3.5 animate-pulse">
    <div className="w-8 h-8 rounded-full bg-zinc-800" />
    <div className="flex-1 space-y-1.5">
      <div className="h-3 bg-zinc-800 rounded w-32" />
      <div className="h-2.5 bg-zinc-800 rounded w-48" />
    </div>
    <div className="h-5 bg-zinc-800 rounded w-24" />
    <div className="h-5 bg-zinc-800 rounded w-16" />
    <div className="w-7 h-7 rounded bg-zinc-800" />
  </div>
);

// ─── Invite Member Modal (Username Search & Custom Select Logic) ─────────────

const InviteModal: React.FC<{
  teamId: number;
  teamName: string;
  onClose: () => void;
  onInvited: (invitation: TeamInvitation, inviteLink: string) => void;
}> = ({ teamId, teamName, onClose, onInvited }) => {
  const { toast } = useToast();
  const { accentColor } = useAccentTheme();
  const [role, setRole] = useState<TeamMemberRole>('DEVELOPER');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);

  // Database accounts search & selection state (same logic as Create team)
  const [dbUsers, setDbUsers] = useState<WorkspaceUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<WorkspaceUser | null>(null);
  const [accountSearchQuery, setAccountSearchQuery] = useState('');
  const [manualEmail, setManualEmail] = useState('');

  const accountSelectRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch real workspace users
  useEffect(() => {
    let isMounted = true;
    async function fetchUsers() {
      setIsLoadingUsers(true);
      try {
        const token = localStorage.getItem('devflow_token');
        const res = await fetch(apiUrl('/users'), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data) && isMounted) {
            setDbUsers(json.data);
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
      if (accountSelectRef.current && !accountSelectRef.current.contains(e.target as Node)) {
        setIsAccountOpen(false);
      }
    };
    if (isAccountOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isAccountOpen]);

  // Focus search input when user selector opens
  useEffect(() => {
    if (isAccountOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isAccountOpen]);

  // Filter matched usernames that are public
  const cleanAccountQuery = accountSearchQuery.trim().toLowerCase().replace(/^@+/, '');
  const matchingAccounts = useMemo(() => {
    if (!cleanAccountQuery) return [];
    return dbUsers.filter((u) => {
      if (u.isPublicProfile === false) return false;
      const uname = (u.username || u.email?.split('@')[0] || '').toLowerCase();
      const dname = (u.name || '').toLowerCase();
      return uname.includes(cleanAccountQuery) || dname.includes(cleanAccountQuery);
    });
  }, [cleanAccountQuery, dbUsers]);

  const effectiveEmail = selectedUser ? selectedUser.email : manualEmail.trim();

  const handleSend = async () => {
    if (!effectiveEmail) {
      toast.error('Missing recipient', 'Please select a user or enter an email address.');
      return;
    }
    setLoading(true);
    const res = await teamService.sendInvitation(teamId, {
      email: effectiveEmail,
      role,
      message: remarks.trim() || undefined,
    });
    setLoading(false);
    if (res.success && res.data) {
      const link = `${window.location.origin}${res.inviteLink || `/invite/${res.data.invitationToken}`}`;
      setInviteLink(link);
      onInvited(res.data, link);
      toast.success('Invitation sent!', `Invite link created for ${effectiveEmail}`);
    } else {
      toast.error('Failed to send invitation', res.error);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied!', 'Invite link copied to clipboard');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md bg-[#0C0D10] border border-[#27272A] rounded-2xl shadow-2xl overflow-visible"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-[#27272A]">
          <div>
            <h2 className="text-[15px] font-semibold text-white">Invite to {teamName}</h2>
            <p className="text-[12px] text-zinc-400 mt-0.5">Search by username and assign permissions</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {inviteLink ? (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <div className="flex items-center gap-2 text-[#4ADE80]">
                <CheckCircle2 size={16} />
                <span className="text-[13px] font-medium">Invitation created!</span>
              </div>
              <div className="p-3 rounded-xl bg-[#111216] border border-[#27272A] space-y-2">
                <p className="text-[11px] text-zinc-500">Share this link with {effectiveEmail}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[11px] text-zinc-300 font-mono truncate">{inviteLink}</code>
                  <button
                    onClick={handleCopy}
                    className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-400 hover:text-white transition-colors shrink-0 cursor-pointer"
                  >
                    {copied ? <Check size={13} className="text-[#4ADE80]" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-zinc-500">The link expires in 7 days. The invited user must log in with this account.</p>
              <button
                onClick={onClose}
                className="w-full h-9 rounded-lg hover:brightness-110 text-[#0A0B10] text-[13px] font-semibold transition-all cursor-pointer shadow-md"
                style={{ backgroundColor: accentColor, boxShadow: `0 3px 14px ${accentColor}30` }}
              >
                Done
              </button>
            </motion.div>
          ) : (
            <>
              {/* User Selection: Search by username (matching Create Team logic) */}
              <div ref={accountSelectRef} className="relative z-40">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[12px] font-medium text-zinc-300">
                    Username <span className="text-red-400">*</span>
                  </label>
                  {isLoadingUsers && (
                    <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                      <Loader2 size={10} className="animate-spin text-zinc-400" />
                      <span>Loading accounts...</span>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsAccountOpen((prev) => !prev)}
                  className={`w-full h-10 flex items-center justify-between gap-2 px-3 bg-[#111216] border rounded-lg text-xs sm:text-[13px] text-left transition-all outline-none cursor-pointer ${
                    isAccountOpen
                      ? 'shadow-md'
                      : 'border-[#27272A] hover:border-zinc-500'
                  }`}
                  style={isAccountOpen ? { borderColor: accentColor, boxShadow: `0 0 0 1px ${accentColor}` } : {}}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                    {selectedUser ? (
                      <div className="flex items-center gap-2 truncate">
                        <Avatar name={selectedUser.name} avatarUrl={selectedUser.avatarUrl} size={22} />
                        <span className="text-white font-medium truncate">{selectedUser.name}</span>
                        <span className="text-[11px] font-mono text-zinc-400 truncate flex items-center gap-1">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: selectedUser.avatarColor || accentColor }}
                          />
                          <span>@{selectedUser.username || selectedUser.email.split('@')[0]}</span>
                        </span>
                      </div>
                    ) : manualEmail ? (
                      <span className="text-zinc-200 font-mono truncate">{manualEmail}</span>
                    ) : (
                      <span className="text-zinc-500 truncate flex items-center gap-2">
                        <Search size={13} className="text-zinc-500 shrink-0" />
                        <span>Enter username or email</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {(selectedUser || manualEmail) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUser(null);
                          setManualEmail('');
                          setAccountSearchQuery('');
                        }}
                        className="text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer"
                        title="Clear selection"
                      >
                        <X size={12} />
                      </button>
                    )}
                    <ChevronDown
                      size={13}
                      className={`text-zinc-400 transition-transform duration-200 ${
                        isAccountOpen ? 'rotate-180' : ''
                      }`}
                      style={isAccountOpen ? { color: accentColor } : {}}
                    />
                  </div>
                </button>

                {/* Dropdown Options: only shows matched public usernames */}
                <AnimatePresence>
                  {isAccountOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 4, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.16 }}
                      className="absolute left-0 right-0 top-full z-50 p-2 bg-[#14161C] border border-[#27272A] rounded-xl shadow-2xl overflow-hidden max-h-60 flex flex-col"
                    >
                      <div className="relative mb-2 flex items-center">
                        <Search size={12} className="absolute left-2.5 text-zinc-500 pointer-events-none" />
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
                            className="absolute right-2 text-zinc-500 hover:text-white p-0.5"
                          >
                            <X size={11} />
                          </button>
                        )}
                      </div>

                      {matchingAccounts.length > 0 ? (
                        <div className="overflow-y-auto max-h-44 space-y-1">
                          {matchingAccounts.map((account) => {
                            const uName = account.username || account.email.split('@')[0];
                            return (
                              <button
                                key={account.id}
                                type="button"
                                onClick={() => {
                                  setSelectedUser(account);
                                  setManualEmail(account.email);
                                  setIsAccountOpen(false);
                                }}
                                className="w-full flex items-center justify-between p-2 rounded-lg text-left hover:bg-white/[0.06] transition-colors cursor-pointer group"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <Avatar name={account.name} avatarUrl={account.avatarUrl} size={24} />
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-white truncate group-hover:text-[#A78BFA]">
                                      {account.name}
                                    </p>
                                    <p className="text-[10.5px] font-mono text-zinc-400 truncate flex items-center gap-1">
                                      <span
                                        className="w-1.5 h-1.5 rounded-full shrink-0"
                                        style={{ backgroundColor: account.avatarColor || '#8B5CF6' }}
                                      />
                                      <span>@{uName}</span>
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">
                                  {account.role || 'Member'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : accountSearchQuery ? (
                        <div className="py-2 text-center space-y-1">
                          <p className="text-zinc-500 text-xs">No matching username</p>
                          {accountSearchQuery.includes('@') && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedUser(null);
                                setManualEmail(accountSearchQuery.trim());
                                setIsAccountOpen(false);
                              }}
                              className="text-xs text-[#A78BFA] hover:underline cursor-pointer"
                            >
                              Invite email &quot;{accountSearchQuery.trim()}&quot;
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-zinc-500 text-xs py-3 text-center">Type to search by username</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Role Selection: Custom AnimatedSelect */}
              <div className="relative z-30">
                <label className="block text-[12px] font-medium text-zinc-300 mb-1.5">Role & Permission</label>
                <AnimatedSelect
                  value={role}
                  onChange={(val) => setRole(val as TeamMemberRole)}
                  options={INVITE_ROLE_OPTIONS}
                  placeholder="Select role..."
                  accentColor={accentColor}
                />
              </div>

              {/* Remarks: Personal message renamed to Remarks */}
              <div>
                <label className="block text-[12px] font-medium text-zinc-300 mb-1.5">
                  Remarks <span className="text-zinc-500">(optional)</span>
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add remarks or onboarding note..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#111216] border border-[#27272A] text-[13px] text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-colors resize-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 h-9 rounded-lg border border-[#27272A] text-zinc-400 hover:text-white text-[13px] font-medium transition-colors hover:bg-white/[0.04] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={!effectiveEmail || loading}
                  className="flex-1 h-9 rounded-lg hover:brightness-110 text-[#0A0B10] text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer"
                  style={{ backgroundColor: accentColor, boxShadow: `0 3px 14px ${accentColor}30` }}
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  <span>{loading ? 'Sending...' : 'Save & Send Invitation'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// ─── Edit Team Member Modal (3-dot Edit action) ─────────────────────────────

const EditMemberModal: React.FC<{
  member: TeamMember;
  isSelf: boolean;
  onClose: () => void;
  onSaveRole: (role: TeamMemberRole) => void;
  onSaveDetails?: (
    memberId: number,
    userId: number,
    role: TeamMemberRole,
    avatarColor: string,
    avatarId: string,
    avatarType: 'initials' | 'icon'
  ) => void;
}> = ({ member, isSelf, onClose, onSaveRole, onSaveDetails }) => {
  const { accentColor } = useAccentTheme();
  const { user } = useAuth();
  const customSaved = getCustomMemberAvatar(member.userId);
  const [selectedRole, setSelectedRole] = useState<TeamMemberRole>(member.role);
  const [avatarColor, setAvatarColor] = useState<string>(
    (member.user as any)?.avatarColor || customSaved?.color || (isSelf ? (user as any)?.avatarColor : null) || getAvatarBg(member.user.name)
  );
  const [avatarId, setAvatarId] = useState<string>(
    (member.user as any)?.avatarId || customSaved?.iconId || (isSelf ? (user as any)?.avatarId : null) || 'smile'
  );
  const [avatarType, setAvatarType] = useState<'initials' | 'icon'>(
    ((member.user as any)?.avatarType || customSaved?.type || (isSelf ? (user as any)?.avatarType : null)) === 'icon' ? 'icon' : 'initials'
  );
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isCurrentMoreIcon =
    avatarType === 'icon' &&
    MORE_AVATAR_ICONS.some((m) => m.id === avatarId);
  const CurrentMoreIconComponent =
    isCurrentMoreIcon && avatarId ? AVATAR_ICON_COMPONENTS[avatarId] || Sparkles : null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (onSaveDetails) {
        await onSaveDetails(
          member.id,
          member.userId,
          selectedRole,
          avatarColor,
          avatarId,
          avatarType
        );
      } else {
        onSaveRole(selectedRole);
      }
    } finally {
      setIsSaving(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.18 }}
        className="relative z-10 w-full max-w-md bg-[#0C0D10] border border-[#27272A] rounded-2xl shadow-2xl overflow-visible"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Live Avatar Preview */}
        <div className="flex items-center justify-between p-5 border-b border-[#27272A]">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-md transition-all shrink-0 ring-2 ring-white/10 overflow-hidden"
              style={{ backgroundColor: avatarColor }}
            >
              {avatarType === 'icon' && avatarId && AVATAR_ICON_COMPONENTS[avatarId] ? (
                React.createElement(AVATAR_ICON_COMPONENTS[avatarId], { size: 20, strokeWidth: 2.2 })
              ) : (
                <span className="text-sm font-semibold">{getInitials(member.user.name)}</span>
              )}
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-white">
                {isSelf ? 'Edit My Details' : 'Edit Team Member'}
              </h2>
              <p className="text-[12px] text-zinc-400 mt-0.5">{member.user.name} · {member.user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content: Just Role, Color, and Icons */}
        <div className="p-5 space-y-4">
          {/* 1. Permission / Role */}
          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-zinc-300">
              Role & Permission
            </label>
            <AnimatedSelect
              value={selectedRole}
              onChange={(val) => setSelectedRole(val as TeamMemberRole)}
              options={EDIT_ROLE_OPTIONS}
              placeholder="Select role..."
              accentColor={accentColor}
            />
          </div>

          {/* 2. Color Palette */}
          <div className="space-y-2 pt-2 border-t border-[#27272A]/70">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-medium text-zinc-300 flex items-center gap-1.5">
                <Palette size={13} style={{ color: accentColor }} />
                <span>Avatar Color</span>
              </label>
              <span className="text-[10.5px] font-mono text-zinc-500">Pick theme</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap py-0.5">
              {AVATAR_COLORS.map((c) => {
                const isSelected = avatarColor.toLowerCase() === c.hex.toLowerCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setAvatarColor(c.hex)}
                    className={`relative w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#0C0D10] shadow-md'
                        : 'hover:scale-105 opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {isSelected && <Check size={11} strokeWidth={3} className="text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Developer Icon / Emoji Selector */}
          <div className="space-y-2 pt-2 border-t border-[#27272A]/70">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-medium text-zinc-300 flex items-center gap-1.5">
                <Smile size={13} style={{ color: accentColor }} />
                <span>Developer Icon</span>
              </label>
              <span className="text-[10.5px] font-mono text-zinc-500">
                {avatarType === 'initials' ? 'Initials active' : 'Icon active'}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap relative">
              {/* Option 1: Initials */}
              <button
                type="button"
                onClick={() => setAvatarType('initials')}
                className={`relative h-8 px-2.5 rounded-xl text-xs font-mono font-bold flex items-center justify-center transition-all cursor-pointer ${
                  avatarType === 'initials'
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0C0D10] shadow-md scale-105 text-white'
                    : 'border border-[#27272A] bg-[#111216] text-zinc-400 hover:text-white hover:border-zinc-500'
                }`}
                style={{
                  backgroundColor: avatarType === 'initials' ? avatarColor : '#111216',
                }}
                title="Use member initials"
              >
                <span>{getInitials(member.user.name)}</span>
                {avatarType === 'initials' && (
                  <div
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-black text-[7px] font-bold shadow"
                    style={{ backgroundColor: accentColor }}
                  >
                    ✓
                  </div>
                )}
              </button>

              {/* Option 2: 5 Quick Icons */}
              {QUICK_AVATAR_ICONS.map((iconOpt) => {
                const isSelected = avatarType === 'icon' && avatarId === iconOpt.id;
                const IconComponent = AVATAR_ICON_COMPONENTS[iconOpt.id] || Sparkles;

                return (
                  <button
                    key={iconOpt.id}
                    type="button"
                    onClick={() => {
                      setAvatarId(iconOpt.id);
                      setAvatarType('icon');
                    }}
                    className={`relative w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0C0D10] shadow-md scale-105'
                        : 'border border-[#27272A] bg-[#111216] text-zinc-400 hover:text-white hover:border-zinc-500'
                    }`}
                    style={{
                      backgroundColor: isSelected ? avatarColor : '#111216',
                      color: isSelected ? '#FFFFFF' : undefined,
                    }}
                    title={iconOpt.name}
                  >
                    <IconComponent size={15} strokeWidth={2.2} />
                    {isSelected && (
                      <div
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-black text-[7px] font-bold shadow"
                        style={{ backgroundColor: accentColor }}
                      >
                        ✓
                      </div>
                    )}
                  </button>
                );
              })}

              {/* Option 3: 3-Dot More Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMoreModal((prev) => !prev)}
                  className={`relative w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                    isCurrentMoreIcon
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0C0D10] shadow-md scale-105'
                      : 'border border-[#27272A] bg-[#111216] text-zinc-400 hover:text-white hover:border-zinc-500'
                  }`}
                  style={{
                    backgroundColor: isCurrentMoreIcon ? avatarColor : '#111216',
                    color: isCurrentMoreIcon ? '#FFFFFF' : undefined,
                  }}
                  title="More developer emoji icons"
                >
                  {isCurrentMoreIcon && CurrentMoreIconComponent ? (
                    <CurrentMoreIconComponent size={15} strokeWidth={2.2} />
                  ) : (
                    <MoreHorizontal size={15} />
                  )}
                  {isCurrentMoreIcon && (
                    <div
                      className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-black text-[7px] font-bold shadow"
                      style={{ backgroundColor: accentColor }}
                    >
                      ✓
                    </div>
                  )}
                </button>

                {/* Popover Emoji Grid Modal */}
                <AnimatePresence>
                  {showMoreModal && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 8 }}
                      transition={{ duration: 0.16 }}
                      className="absolute left-0 bottom-11 z-50 p-3 rounded-2xl bg-[#17181D] border border-[#27272A] shadow-2xl w-72 backdrop-blur-xl"
                    >
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.08]">
                        <span className="text-[11.5px] font-medium text-white flex items-center gap-1.5">
                          <Sparkles size={12} style={{ color: accentColor }} />
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

                      <div className="grid grid-cols-6 gap-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
                        {MORE_AVATAR_ICONS.map((iconOpt) => {
                          const IconComponent = AVATAR_ICON_COMPONENTS[iconOpt.id] || Sparkles;
                          const isSelected = avatarType === 'icon' && avatarId === iconOpt.id;

                          return (
                            <button
                              key={iconOpt.id}
                              type="button"
                              onClick={() => {
                                setAvatarId(iconOpt.id);
                                setAvatarType('icon');
                                setShowMoreModal(false);
                              }}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                isSelected
                                  ? 'text-black font-bold scale-105 shadow'
                                  : 'hover:bg-white/[0.08] text-zinc-300 hover:text-white'
                              }`}
                              style={isSelected ? { backgroundColor: accentColor } : undefined}
                              title={iconOpt.name}
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
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2.5 pt-3 border-t border-[#27272A]/70">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 h-9 rounded-xl border border-[#27272A] text-zinc-400 hover:text-white text-[13px] font-medium transition-colors hover:bg-white/[0.04] cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 h-9 rounded-xl hover:brightness-110 text-[#0A0B10] text-[13px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: accentColor, boxShadow: `0 3px 14px ${accentColor}35` }}
            >
              {isSaving ? <Loader2 size={14} className="animate-spin text-black" /> : <Check size={14} strokeWidth={2.5} />}
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Team Settings Full Page Screen (Matching Account Settings Layout) ───────

const TEAM_SETTINGS_CATEGORIES: SettingsCategory[] = [
  { id: 'general-information', label: 'General Information' },
  { id: 'appearance-branding', label: 'Appearance & Branding' },
  { id: 'members-access', label: 'Members & Access' },
  { id: 'danger-zone', label: 'Danger Zone' },
];

const TeamSettingsPage: React.FC<{
  team: any;
  onBack: () => void;
  onUpdated: (updatedTeam: any) => void;
}> = ({ team, onBack, onUpdated }) => {
  const { toast } = useToast();
  const { accentColor } = useAccentTheme();
  const { isCollapsed } = useNavigation();
  const initialMeta = parseTeamMetadata(team.description, team.name);

  const [name, setName] = useState(team.name || '');
  const [key, setKey] = useState(initialMeta.key || '');
  const [desc, setDesc] = useState(initialMeta.cleanDesc || '');
  const [color, setColor] = useState(team.color || accentColor || '#8B5CF6');
  const [customColor, setCustomColor] = useState(team.color || accentColor || '#8B5CF6');
  const [icon, setIcon] = useState(initialMeta.icon || 'initials');
  const [avatarType, setAvatarType] = useState<'initials' | 'icon'>(
    initialMeta.icon && initialMeta.icon !== 'initials' ? 'icon' : 'initials'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showMoreModal, setShowMoreModal] = useState(false);

  const isCurrentMoreIcon =
    avatarType === 'icon' &&
    MORE_AVATAR_ICONS.some((m) => m.id === icon);
  const CurrentMoreIconComponent =
    isCurrentMoreIcon && icon ? AVATAR_ICON_COMPONENTS[icon] || Sparkles : null;

  const teamInitials = key.slice(0, 3) || getInitials(name || team.name || 'Team');

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.origin + '/teams/' + team.id);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast.success('Link copied', 'Team URL copied to clipboard');
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      toast.error('Team name cannot be empty');
      return;
    }
    setIsSaving(true);
    let serializedDesc = '';
    if (key.trim()) serializedDesc += `[key:${key.trim().toUpperCase()}] `;
    if (avatarType === 'icon' && icon && icon !== 'initials') {
      serializedDesc += `[icon:${icon}] `;
    }
    serializedDesc += desc.trim();

    const res = await teamService.updateTeam(team.id, {
      name: name.trim(),
      color,
      description: serializedDesc,
    });
    setIsSaving(false);

    if (res.success && res.data) {
      toast.success('Team settings saved', 'Team details updated successfully');
      onUpdated({ ...team, ...res.data, color, description: serializedDesc, name: name.trim() });
    } else {
      toast.error('Failed to update team', res.error);
    }
  };

  const presetColors = [
    '#8B5CF6', '#6366F1', '#3B82F6', '#06B6D4',
    '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#27272A'
  ];

  return (
    <AccountSettingsLayout>
      {/* Top Back Navigation Button */}
      <div className="pt-2 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer group"
        >
          <ArrowLeft size={14} className="transition-transform duration-150 group-hover:-translate-x-1" />
          <span>Back to {team.name || 'teams'}</span>
        </button>
      </div>

      {/* Header and Hero Summary Banner */}
      <div className="space-y-6 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-[32px] font-extrabold text-[#FFFFFF] tracking-tight leading-tight">
              Team Settings
            </h1>
            <p className="text-sm sm:text-[14.5px] text-[#A1A1AA] mt-1.5 leading-relaxed">
              Manage your team workspace, visual branding, members, and configuration.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={onBack}
              className="h-9 px-4 rounded-xl border border-[#27272A] text-zinc-400 hover:text-white text-xs font-medium hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !name.trim()}
              className="h-9 px-5 rounded-xl hover:brightness-110 active:scale-[0.98] text-[#0A0B10] text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: accentColor, boxShadow: `0 2px 14px ${accentColor}30` }}
            >
              {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={2.5} />}
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>

        {/* Hero Profile Summary Banner with Square-Type Card Background matching Screenshot 3 */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#161820] to-[#111217] border border-[#27272A] p-6 sm:p-7 shadow-lg flex flex-col items-center justify-center text-center">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
              backgroundSize: '16px 16px',
            }}
          />

          {/* Avatar with square-type background & color glow */}
          <div className="relative mb-3.5 z-10">
            <div
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-[#27272A] shadow-xl transition-all duration-300 flex items-center justify-center text-white font-mono font-bold text-2xl sm:text-3xl"
              style={{
                backgroundColor: color,
                boxShadow: `0 0 0 3px ${color}30, 0 8px 24px rgba(0,0,0,0.5)`,
              }}
            >
              {avatarType === 'icon' && icon && icon !== 'initials' && AVATAR_ICON_COMPONENTS[icon] ? (
                React.createElement(AVATAR_ICON_COMPONENTS[icon], { size: 36, strokeWidth: 2.2 })
              ) : (
                teamInitials
              )}
            </div>
          </div>

          {/* Name & Key Badge */}
          <div className="flex items-center justify-center gap-2 z-10">
            <h2 className="text-xl sm:text-2xl font-bold text-[#F4F4F5] tracking-tight">
              {name || team.name}
            </h2>
            {key && (
              <span
                className="px-2 py-0.5 rounded font-mono text-[11px] font-bold border"
                style={{
                  backgroundColor: `${color}18`,
                  borderColor: `${color}40`,
                  color: color,
                }}
              >
                {key.toUpperCase()}
              </span>
            )}
          </div>

          {/* Creator & Status */}
          <p className="text-xs sm:text-[13px] text-[#A1A1AA] mt-1 font-mono z-10 flex items-center gap-2">
            <span>{team.createdBy?.name ? `Created by ${team.createdBy.name}` : 'DevFlow Team Workspace'}</span>
            <span>•</span>
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Active Workspace
            </span>
          </p>
        </div>
      </div>

      {/* Sticky Horizontal Category Navigation Bar */}
      {/* When the user scrolls down, this bar sticks to the top of the screen */}
      <SettingsSectionNav categories={TEAM_SETTINGS_CATEGORIES} />

      {/* ONE continuous scrollable screen with all sections matching DevFlow Settings layout */}
      <form onSubmit={handleSave} className="pb-28 space-y-2">
        {/* ── Section 1: General Information ── */}
        <SettingsSection
          id="general-information"
          title="General Information"
          description="Configure your team workspace display name, key identifier, and description."
        >
          <SettingsRow
            label="Team Name"
            description="Used on dashboards, sidebars, issue cards, and project headers."
            required
          >
            <div className="max-w-md">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Frontend Engineering, Product Design"
                className="w-full h-10 px-3.5 rounded-xl bg-[#111216] border border-[#27272A] text-xs sm:text-[13px] text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--settings-accent)] transition-colors"
                style={{ '--settings-accent': accentColor } as React.CSSProperties}
              />
            </div>
          </SettingsRow>

          <SettingsRow
            label="Team Key / Identifier"
            description="Short 2-5 letter prefix used for team badges and issue keys."
          >
            <div className="max-w-xs space-y-1">
              <input
                type="text"
                maxLength={5}
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                placeholder="e.g. ENG, DES, PROD"
                className="w-40 h-10 px-3.5 rounded-xl bg-[#111216] border border-[#27272A] text-xs font-mono font-bold text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--settings-accent)] uppercase transition-colors"
                style={{ '--settings-accent': accentColor } as React.CSSProperties}
              />
            </div>
          </SettingsRow>

          <SettingsRow
            label="Team Description"
            description="Brief overview of this team's mission, stack, and domain."
          >
            <div className="max-w-xl">
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="What does this team build and collaborate on?"
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#111216] border border-[#27272A] text-xs sm:text-[13px] text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--settings-accent)] transition-colors resize-none"
                style={{ '--settings-accent': accentColor } as React.CSSProperties}
              />
            </div>
          </SettingsRow>

          <SettingsRow
            label="Workspace Status"
            description="Current operational status of this team workspace."
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Active Workspace</span>
              </span>
            </div>
          </SettingsRow>
        </SettingsSection>

        {/* ── Section 2: Appearance & Branding ── */}
        <SettingsSection
          id="appearance-branding"
          title="Appearance & Branding"
          description="Customize your team visual identity, avatar style, developer icons, and color palette."
        >
          {/* Avatar Style Picker */}
          <SettingsRow
            label="Avatar Style"
            description="Choose whether this team displays initial letters or a developer icon."
          >
            <div className="flex items-center gap-2.5 max-w-md">
              <button
                type="button"
                onClick={() => { setAvatarType('initials'); setIcon('initials'); }}
                className={`flex-1 py-2.5 px-3.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  avatarType === 'initials'
                    ? 'text-white ring-1 shadow-sm'
                    : 'border-[#27272A] bg-[#111216] text-zinc-400 hover:text-white'
                }`}
                style={
                  avatarType === 'initials'
                    ? {
                        borderColor: accentColor,
                        backgroundColor: `${accentColor}20`,
                        boxShadow: `0 0 14px ${accentColor}25`,
                      }
                    : undefined
                }
              >
                <span className="w-4 h-4 rounded font-mono font-bold text-[10px] flex items-center justify-center bg-white/20 text-white">
                  {teamInitials.slice(0, 2)}
                </span>
                <span>Team Initials</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAvatarType('icon');
                  if (!icon || icon === 'initials') setIcon('smile');
                }}
                className={`flex-1 py-2.5 px-3.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  avatarType === 'icon'
                    ? 'text-white ring-1 shadow-sm'
                    : 'border-[#27272A] bg-[#111216] text-zinc-400 hover:text-white'
                }`}
                style={
                  avatarType === 'icon'
                    ? {
                        borderColor: accentColor,
                        backgroundColor: `${accentColor}20`,
                        boxShadow: `0 0 14px ${accentColor}25`,
                      }
                    : undefined
                }
              >
                <Sparkles size={13} style={{ color: accentColor }} />
                <span>Developer Icon</span>
              </button>
            </div>
          </SettingsRow>

          {/* Quick Icons + 3-Dot More Modal (exact matching ProfileSettingsPage) */}
          {avatarType === 'icon' && (
            <SettingsRow
              label="Choose Developer Icon"
              description="Select a quick emoji or open the 3-dot menu for extended developer icons."
            >
              <div className="flex items-center gap-2.5 flex-wrap max-w-lg">
                {/* 5 Quick Icons */}
                {QUICK_AVATAR_ICONS.map((iconOpt) => {
                  const isSelected = avatarType === 'icon' && icon === iconOpt.id;
                  const IconComponent = AVATAR_ICON_COMPONENTS[iconOpt.id] || Sparkles;

                  return (
                    <button
                      key={iconOpt.id}
                      type="button"
                      onClick={() => {
                        setIcon(iconOpt.id);
                        setAvatarType('icon');
                      }}
                      className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0C0D10] shadow-md scale-105'
                          : 'border border-[#27272A] bg-[#111216] text-zinc-400 hover:text-white hover:border-zinc-500'
                      }`}
                      style={{
                        backgroundColor: isSelected ? color : '#111216',
                        color: isSelected ? '#FFFFFF' : undefined,
                      }}
                      title={iconOpt.name}
                    >
                      <IconComponent size={16} strokeWidth={2.2} />
                      {isSelected && (
                        <div
                          className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-black text-[8px] font-bold shadow"
                          style={{ backgroundColor: accentColor }}
                        >
                          ✓
                        </div>
                      )}
                    </button>
                  );
                })}

                {/* 3-Dots Button ('More' Emojis Popup) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowMoreModal((prev) => !prev)}
                    className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                      isCurrentMoreIcon
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0C0D10] shadow-md scale-105'
                        : 'border border-[#27272A] bg-[#111216] text-zinc-400 hover:text-white hover:border-zinc-500'
                    }`}
                    style={{
                      backgroundColor: isCurrentMoreIcon ? color : '#111216',
                      color: isCurrentMoreIcon ? '#FFFFFF' : undefined,
                    }}
                    title="More developer emoji icons"
                  >
                    {isCurrentMoreIcon && CurrentMoreIconComponent ? (
                      <CurrentMoreIconComponent size={16} strokeWidth={2.2} />
                    ) : (
                      <MoreHorizontal size={16} />
                    )}
                    {isCurrentMoreIcon && (
                      <div
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-black text-[8px] font-bold shadow"
                        style={{ backgroundColor: accentColor }}
                      >
                        ✓
                      </div>
                    )}
                  </button>

                  {/* Popover Emoji Grid Modal */}
                  <AnimatePresence>
                    {showMoreModal && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 8 }}
                        transition={{ duration: 0.16 }}
                        className="absolute left-0 bottom-12 z-50 p-3 rounded-2xl bg-[#17181D] border border-[#27272A] shadow-2xl w-72 backdrop-blur-xl"
                      >
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.08]">
                          <span className="text-[11.5px] font-medium text-white flex items-center gap-1.5">
                            <Sparkles size={12} style={{ color: accentColor }} />
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

                        <div className="grid grid-cols-6 gap-1.5 max-h-52 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
                          {MORE_AVATAR_ICONS.map((iconOpt) => {
                            const IconComponent = AVATAR_ICON_COMPONENTS[iconOpt.id] || Sparkles;
                            const isSelected = avatarType === 'icon' && icon === iconOpt.id;

                            return (
                              <button
                                key={iconOpt.id}
                                type="button"
                                onClick={() => {
                                  setIcon(iconOpt.id);
                                  setAvatarType('icon');
                                  setShowMoreModal(false);
                                }}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                  isSelected
                                    ? 'text-black font-bold scale-105 shadow'
                                    : 'hover:bg-white/[0.08] text-zinc-300 hover:text-white'
                                }`}
                                style={isSelected ? { backgroundColor: accentColor } : undefined}
                                title={iconOpt.name}
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
              </div>
            </SettingsRow>
          )}

          {/* Theme Color Picker */}
          <SettingsRow
            label="Team Theme Color"
            description="Accent color applied to badges, avatar background, and highlights."
          >
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                {presetColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { setColor(c); setCustomColor(c); }}
                    className={`w-7 h-7 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                      color === c ? 'scale-115 ring-2 ring-white ring-offset-2 ring-offset-[#0C0D10]' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  >
                    {color === c && <Check size={12} className="text-white" strokeWidth={3} />}
                  </button>
                ))}
                <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-700">
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => { setCustomColor(e.target.value); setColor(e.target.value); }}
                    className="w-7 h-7 rounded-full cursor-pointer bg-transparent border-0"
                    title="Custom color picker"
                  />
                  <span className="text-[11px] text-zinc-500 font-mono">{color}</span>
                </div>
              </div>
            </div>
          </SettingsRow>
        </SettingsSection>

        {/* ── Section 3: Members & Access ── */}
        <SettingsSection
          id="members-access"
          title="Members & Access"
          description="View active team members, membership status, and direct invite link."
        >
          <SettingsRow
            label="Active Members"
            description="Collaborators currently active in this workspace."
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {team.members && team.members.length > 0 ? (
                <div className="p-3.5 rounded-2xl bg-[#111216] border border-[#27272A] flex items-center gap-4 max-w-md">
                  {renderMemberAvatarStack(team.members, 6)}

                  <div className="border-l border-[#27272A] pl-3 py-0.5">
                    <span className="text-sm font-bold text-white block">
                      {team.members.length} {team.members.length === 1 ? 'Member' : 'Members'}
                    </span>
                    <span className="text-[11px] text-zinc-400">Assigned with roles & permissions</span>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-zinc-500">No active members yet</span>
              )}
            </div>
          </SettingsRow>

          <SettingsRow
            label="Pending Invitations"
            description="Invites sent waiting for recipient confirmation."
          >
            <div className="p-3.5 rounded-xl bg-[#111216] border border-[#27272A] inline-flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
                <Clock size={16} />
              </div>
              <div>
                <span className="text-base font-bold text-white block">{team.invitations?.length || 0} Pending</span>
                <span className="text-[11px] text-zinc-400">Awaiting workspace join response</span>
              </div>
            </div>
          </SettingsRow>

          <SettingsRow
            label="Share Team Link"
            description="Workspace teammates can quickly navigate to this team view using this link."
          >
            <div className="max-w-md flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-[#0C0D10] border border-[#27272A] text-xs font-mono text-zinc-300 truncate">
                {window.location.origin}/teams/{team.id}
              </code>
              <button
                type="button"
                onClick={handleCopyLink}
                className="h-9 px-3 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                {copiedLink ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </SettingsRow>
        </SettingsSection>

        {/* ── Section 4: Danger Zone ── */}
        <SettingsSection
          id="danger-zone"
          title="Danger Zone"
          description="Destructive actions that permanently impact this team workspace."
        >
          <div className="p-4 sm:p-5 rounded-2xl bg-red-500/[0.03] border border-red-500/20 space-y-4 max-w-3xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs sm:text-[13px] font-semibold text-white block">Archive Team</span>
                <span className="text-[11px] text-zinc-400">Lock all member activities, boards, and make this team read-only.</span>
              </div>
              <button
                type="button"
                onClick={() => toast.info('Team archived', 'Team workspace has been archived.')}
                className="px-3.5 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-medium transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
              >
                Archive Team
              </button>
            </div>

            <div className="pt-3.5 border-t border-red-500/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs sm:text-[13px] font-semibold text-red-300 block">Delete Team</span>
                <span className="text-[11px] text-zinc-500">Permanently delete this team and remove all memberships. This cannot be undone.</span>
              </div>
              <button
                type="button"
                onClick={() => toast.error('Action restricted', 'Only root workspace owner can delete teams.')}
                className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
              >
                Delete Team
              </button>
            </div>
          </div>
        </SettingsSection>

        {/* ── Fixed Bottom Actions Bar matching ProfileSettingsPage ── */}
        <div
          className={cn(
            'fixed bottom-0 right-0 z-40 bg-[#0D0F14]/95 backdrop-blur-xl border-t border-[#27272A] px-6 sm:px-8 py-3.5 flex items-center justify-between shadow-[0_-8px_30px_rgba(0,0,0,0.7)] transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]',
            isCollapsed ? 'left-0 md:left-[60px]' : 'left-0 md:left-[250px]'
          )}
        >
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
            <span className="hidden sm:inline font-medium text-white">{name || team.name}</span>
            <span className="text-zinc-600 hidden sm:inline">•</span>
            <span className="text-zinc-500 text-[11px] truncate max-w-[200px] sm:max-w-none">
              Save changes to update workspace profile
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg border border-[#27272A] hover:border-zinc-500 text-xs font-semibold text-[#A1A1AA] hover:text-white bg-[#14161C] hover:bg-[#1A1C23] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="px-5 py-2 rounded-lg text-black font-bold text-xs shadow-lg transition-all disabled:opacity-50 cursor-pointer hover:brightness-110 active:scale-[0.98] flex items-center gap-1.5"
              style={{
                backgroundColor: accentColor,
                boxShadow: `0 4px 14px ${accentColor}40`,
              }}
            >
              {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={2.5} />}
              <span>{isSaving ? 'Saving Changes...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      </form>
    </AccountSettingsLayout>
  );
};

const TeamSettingsModal = TeamSettingsPage;

// ─── Active Member Row (List View) ──────────────────────────────────────────

const MemberRow: React.FC<{
  member: TeamMember;
  myRole: TeamMemberRole;
  currentUserId: number;
  onEdit: (member: TeamMember) => void;
  onRoleChange: (memberId: number, role: TeamMemberRole) => void;
  onRemove: (member: TeamMember) => void;
}> = ({ member, myRole, currentUserId, onEdit, onRoleChange, onRemove }) => {
  const { toast } = useToast();
  const { accentColor } = useAccentTheme();
  const [showMenu, setShowMenu] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  const isSelf = member.userId === currentUserId;
  const isOwner = member.role === 'OWNER';
  const canManage = ['OWNER', 'ADMIN'].includes(myRole);
  const canEdit = (canManage && !isOwner) || isSelf;
  const canModifyThisMember = canManage && !isOwner;

  return (
    <div className="group flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors border-b border-[#27272A]/40 last:border-b-0">
      <Avatar
        name={member.user.name}
        avatarUrl={member.user.avatarUrl}
        userId={member.userId}
        avatarColor={(member.user as any)?.avatarColor}
        avatarId={(member.user as any)?.avatarId}
        avatarType={(member.user as any)?.avatarType}
        size={34}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-white truncate">{member.user.name}</span>
          {isSelf && (
            <button
              type="button"
              onClick={() => onEdit(member)}
              className="text-[10px] px-1.5 py-0.5 rounded font-medium border flex items-center gap-1 hover:brightness-125 transition-all cursor-pointer"
              style={{
                backgroundColor: `${accentColor}25`,
                borderColor: `${accentColor}40`,
                color: accentColor,
              }}
              title="Click to edit your details"
            >
              <span>You</span>
              <Edit3 size={9} />
            </button>
          )}
        </div>
        <span className="text-[11px] text-zinc-500 truncate block">{member.user.email}</span>
      </div>

      <div className="hidden sm:block">
        {canModifyThisMember ? (
          <div className="relative">
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer"
            >
              <RoleBadge role={member.role} small />
              <ChevronDown size={10} className="text-zinc-500" />
            </button>
            <AnimatePresence>
              {showRoleDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowRoleDropdown(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.97 }}
                    transition={{ duration: 0.14 }}
                    className="absolute left-0 top-full mt-1.5 z-20 w-48 bg-[#17181D] border border-[#27272A] rounded-xl shadow-xl overflow-hidden py-1"
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <button
                        key={r}
                        onClick={() => { onRoleChange(member.userId, r); setShowRoleDropdown(false); }}
                        className={`w-full px-3 py-2 text-left text-[12px] flex items-center justify-between hover:bg-white/[0.05] transition-colors cursor-pointer ${
                          member.role === r ? 'text-white' : 'text-zinc-400'
                        }`}
                      >
                        <span>{DISPLAY_ROLE_LABELS[r] || ROLE_LABELS[r]}</span>
                        {member.role === r && <Check size={11} className="text-[#A78BFA]" />}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <RoleBadge role={member.role} small />
        )}
      </div>

      <div className="hidden md:flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />
        <span className="text-[11px] text-zinc-400">Active</span>
      </div>

      <span className="hidden lg:block text-[11px] text-zinc-500 whitespace-nowrap">{formatDate(member.joinedAt)}</span>

      {/* 3-Dot Dropdown Actions: edit team member, change permission, copy email, remove/leave */}
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer ${
            showMenu ? 'bg-white/[0.1] text-white' : ''
          }`}
          title="Member actions"
        >
          <MoreHorizontal size={15} />
        </button>
        <AnimatePresence>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.97 }}
                transition={{ duration: 0.14 }}
                className="absolute right-0 top-full mt-1 z-20 w-52 bg-[#17181D] border border-[#27272A] rounded-xl shadow-xl overflow-hidden py-1"
              >
                {isOwner && (
                  <div className="px-3 py-1.5 border-b border-[#27272A]/70 flex items-center gap-1.5 text-[11px] text-amber-400 font-semibold bg-amber-400/5">
                    <Crown size={12} className="shrink-0" />
                    <span>Team Lead / Owner</span>
                  </div>
                )}

                {(canManage || isSelf) && (
                  <button
                    onClick={() => { setShowMenu(false); onEdit(member); }}
                    className="w-full px-3 py-2 text-left text-[12px] text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Edit3 size={13} className="text-zinc-400" />
                    <span>{isSelf ? 'Edit my details' : 'Edit team member'}</span>
                  </button>
                )}

                {canModifyThisMember && (
                  <button
                    onClick={() => { setShowMenu(false); setShowRoleDropdown(true); }}
                    className="w-full px-3 py-2 text-left text-[12px] text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Shield size={13} className="text-indigo-400" />
                    <span>Change permission</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowMenu(false);
                    navigator.clipboard.writeText(member.user.email);
                    toast.success('Email copied', member.user.email);
                  }}
                  className="w-full px-3 py-2 text-left text-[12px] text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Copy size={13} className="text-zinc-400" />
                  <span>Copy email</span>
                </button>

                {isSelf && !isOwner && (
                  <button
                    onClick={() => { setShowMenu(false); onRemove(member); }}
                    className="w-full px-3 py-2 text-left text-[12px] text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors flex items-center gap-2 cursor-pointer border-t border-[#27272A]/50 mt-1"
                  >
                    <UserMinus size={13} />
                    <span>Leave team</span>
                  </button>
                )}

                {!isSelf && canModifyThisMember && (
                  <button
                    onClick={() => { setShowMenu(false); onRemove(member); }}
                    className="w-full px-3 py-2 text-left text-[12px] text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors flex items-center gap-2 cursor-pointer border-t border-[#27272A]/50 mt-1"
                  >
                    <Trash2 size={13} />
                    <span>Remove member</span>
                  </button>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─── Active Member Card (Card View) ─────────────────────────────────────────

const MemberCard: React.FC<{
  member: TeamMember;
  myRole: TeamMemberRole;
  currentUserId: number;
  onEdit: (member: TeamMember) => void;
  onRoleChange: (memberId: number, role: TeamMemberRole) => void;
  onRemove: (member: TeamMember) => void;
}> = ({ member, myRole, currentUserId, onEdit, onRoleChange, onRemove }) => {
  const { toast } = useToast();
  const { accentColor } = useAccentTheme();
  const [showMenu, setShowMenu] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const isSelf = member.userId === currentUserId;
  const isOwner = member.role === 'OWNER';
  const canManage = ['OWNER', 'ADMIN'].includes(myRole);
  const canModifyThisMember = canManage && !isOwner;

  return (
    <div className="rounded-xl bg-[#0E0F14]/90 border border-[#27272A] p-4 hover:border-zinc-500/70 hover:bg-[#12131A] transition-all duration-150 flex flex-col justify-between group shadow-sm relative">
      <div className="space-y-3">
        {/* Top: Avatar + Status + 3-dot */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Avatar
              name={member.user.name}
              avatarUrl={member.user.avatarUrl}
              userId={member.userId}
              avatarColor={(member.user as any)?.avatarColor}
              avatarId={(member.user as any)?.avatarId}
              avatarType={(member.user as any)?.avatarType}
              size={38}
            />
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10.5px] font-medium text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Active</span>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              title="Member actions"
            >
              <MoreHorizontal size={15} />
            </button>
            <AnimatePresence>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.97 }}
                    transition={{ duration: 0.14 }}
                    className="absolute right-0 top-full mt-1 z-30 w-52 bg-[#17181D] border border-[#27272A] rounded-xl shadow-xl overflow-hidden py-1"
                  >
                    {isOwner && (
                      <div className="px-3 py-1.5 border-b border-[#27272A]/70 flex items-center gap-1.5 text-[11px] text-amber-400 font-semibold bg-amber-400/5">
                        <Crown size={12} className="shrink-0" />
                        <span>Team Lead / Owner</span>
                      </div>
                    )}

                    {(canManage || isSelf) && (
                      <button
                        onClick={() => { setShowMenu(false); onEdit(member); }}
                        className="w-full px-3 py-2 text-left text-[12px] text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <Edit3 size={13} className="text-zinc-400" />
                        <span>{isSelf ? 'Edit my details' : 'Edit team member'}</span>
                      </button>
                    )}

                    {canModifyThisMember && (
                      <button
                        onClick={() => { setShowMenu(false); setShowRoleDropdown(true); }}
                        className="w-full px-3 py-2 text-left text-[12px] text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <Shield size={13} className="text-indigo-400" />
                        <span>Change permission</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setShowMenu(false);
                        navigator.clipboard.writeText(member.user.email);
                        toast.success('Email copied', member.user.email);
                      }}
                      className="w-full px-3 py-2 text-left text-[12px] text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Copy size={13} className="text-zinc-400" />
                      <span>Copy email</span>
                    </button>

                    {isSelf && !isOwner && (
                      <button
                        onClick={() => { setShowMenu(false); onRemove(member); }}
                        className="w-full px-3 py-2 text-left text-[12px] text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors flex items-center gap-2 cursor-pointer border-t border-[#27272A]/50 mt-1"
                      >
                        <UserMinus size={13} />
                        <span>Leave team</span>
                      </button>
                    )}

                    {!isSelf && canModifyThisMember && (
                      <button
                        onClick={() => { setShowMenu(false); onRemove(member); }}
                        className="w-full px-3 py-2 text-left text-[12px] text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors flex items-center gap-2 cursor-pointer border-t border-[#27272A]/50 mt-1"
                      >
                        <Trash2 size={13} />
                        <span>Remove member</span>
                      </button>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Name & Email */}
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm text-white truncate">{member.user.name}</h4>
            {isSelf && (
              <span
                className="text-[10px] px-1.5 py-0.2 rounded font-medium border"
                style={{
                  backgroundColor: `${accentColor}25`,
                  borderColor: `${accentColor}40`,
                  color: accentColor,
                }}
              >
                You
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 truncate mt-0.5">{member.user.email}</p>
        </div>

        {/* Role badge with interactive dropdown if can modify */}
        <div className="relative">
          {canModifyThisMember ? (
            <div>
              <button
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                className="flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer"
              >
                <RoleBadge role={member.role} small />
                <ChevronDown size={10} className="text-zinc-500" />
              </button>
              <AnimatePresence>
                {showRoleDropdown && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setShowRoleDropdown(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.97 }}
                      transition={{ duration: 0.14 }}
                      className="absolute left-0 bottom-full mb-1 z-30 w-48 bg-[#17181D] border border-[#27272A] rounded-xl shadow-xl overflow-hidden py-1"
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <button
                          key={r}
                          onClick={() => { onRoleChange(member.userId, r); setShowRoleDropdown(false); }}
                          className={`w-full px-3 py-2 text-left text-[12px] flex items-center justify-between hover:bg-white/[0.05] transition-colors cursor-pointer ${
                            member.role === r ? 'text-white font-medium' : 'text-zinc-400'
                          }`}
                        >
                          <span>{DISPLAY_ROLE_LABELS[r] || ROLE_LABELS[r]}</span>
                          {member.role === r && <Check size={11} className="text-[#A78BFA]" />}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <RoleBadge role={member.role} small />
          )}
        </div>
      </div>

      {/* Bottom: Joined date */}
      <div className="pt-3 mt-3 border-t border-[#27272A]/70 flex items-center justify-between text-[11px] text-zinc-500">
        <span>Joined</span>
        <span className="font-mono text-zinc-400">{formatDate(member.joinedAt)}</span>
      </div>
    </div>
  );
};

// ─── Pending Invitation Row (List View) ─────────────────────────────────────

const UnifiedPendingRow: React.FC<{
  invitation: TeamInvitation;
  myRole: TeamMemberRole;
  onResend: (invId: number) => void;
  onCancel: (invId: number) => void;
}> = ({ invitation, myRole, onResend, onCancel }) => {
  const [copied, setCopied] = useState(false);
  const isExpired = new Date() > new Date(invitation.expiresAt);
  const canManage = ['OWNER', 'ADMIN'].includes(myRole);
  const link = `${window.location.origin}/invite/${invitation.invitationToken}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group flex items-center gap-3 px-4 py-3 hover:bg-[#FBBF24]/[0.02] transition-colors border-b border-[#27272A]/40 last:border-b-0">
      <div className="w-8 h-8 rounded-full bg-[#FBBF2415] border border-[#FBBF2430] flex items-center justify-center shrink-0">
        <Clock size={14} className="text-[#FBBF24]" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-medium text-zinc-300 truncate">{invitation.invitedEmail}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FBBF2415] text-[#FBBF24] border border-[#FBBF2430] font-medium whitespace-nowrap">
            {isExpired ? 'Expired' : 'Invitation Pending'}
          </span>
        </div>
        <span className="text-[11px] text-zinc-500">
          Invited {formatDate(invitation.createdAt)} · Expires {formatDate(invitation.expiresAt)}
        </span>
      </div>

      <div className="hidden sm:block opacity-75">
        <RoleBadge role={invitation.assignedRole} small />
      </div>

      <div className="hidden md:flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]" />
        <span className="text-[11px] text-amber-400/90 font-mono">Pending</span>
      </div>

      {canManage && (
        <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            title="Copy invite link"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            {copied ? <Check size={13} className="text-[#4ADE80]" /> : <Copy size={13} />}
          </button>
          <button
            onClick={() => onResend(invitation.id)}
            title="Resend invitation"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-[#A78BFA] hover:bg-[#8B5CF620] transition-colors cursor-pointer"
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={() => onCancel(invitation.id)}
            title="Cancel invitation"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Pending Invitation Card (Card View) ────────────────────────────────────

const PendingInvitationCard: React.FC<{
  invitation: TeamInvitation;
  canManage: boolean;
  onResend: (id: number) => void;
  onCancel: (id: number) => void;
}> = ({ invitation, canManage, onResend, onCancel }) => {
  const [copied, setCopied] = useState(false);
  const isExpired = new Date() > new Date(invitation.expiresAt);
  const link = `${window.location.origin}/invite/${invitation.invitationToken}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl bg-[#0E0F14]/90 border border-dashed border-[#FBBF2435] p-4 hover:bg-[#12131A] transition-all duration-150 flex flex-col justify-between shadow-sm relative">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="w-9 h-9 rounded-full bg-[#FBBF2415] border border-[#FBBF2430] flex items-center justify-center shrink-0">
            <Clock size={16} className="text-[#FBBF24]" />
          </div>
          <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-[#FBBF2415] text-[#FBBF24] border border-[#FBBF2430] font-medium">
            {isExpired ? 'Expired' : 'Pending'}
          </span>
        </div>

        <div>
          <h4 className="font-semibold text-sm text-zinc-200 truncate">{invitation.invitedEmail}</h4>
          <p className="text-[11px] text-zinc-500 mt-0.5">Invited {formatDate(invitation.createdAt)}</p>
        </div>

        <div>
          <RoleBadge role={invitation.assignedRole} small />
        </div>
      </div>

      <div className="pt-3 mt-3 border-t border-[#27272A]/70 flex items-center justify-between text-[11px]">
        <span className="text-zinc-500 font-mono">Expires {formatDate(invitation.expiresAt)}</span>
        {canManage && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              title="Copy link"
              className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
            >
              {copied ? <Check size={13} className="text-[#4ADE80]" /> : <Copy size={13} />}
            </button>
            <button
              onClick={() => onResend(invitation.id)}
              title="Resend invite"
              className="p-1 rounded-md text-zinc-400 hover:text-[#A78BFA] hover:bg-[#8B5CF620] cursor-pointer"
            >
              <RefreshCw size={13} />
            </button>
            <button
              onClick={() => onCancel(invitation.id)}
              title="Cancel invite"
              className="p-1 rounded-md text-zinc-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Removed Member Row (List View) ─────────────────────────────────────────

const UnifiedRemovedRow: React.FC<{
  removed: RemovedMemberItem;
  canManage: boolean;
  onRestore: (removed: RemovedMemberItem) => void;
}> = ({ removed, canManage, onRestore }) => {
  return (
    <div className="group flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors border-b border-[#27272A]/30 last:border-b-0 opacity-70 hover:opacity-100">
      <Avatar name={removed.name} avatarUrl={removed.avatarUrl} size={34} muted />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-zinc-400 line-through truncate">{removed.name}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-medium">
            Removed
          </span>
        </div>
        <span className="text-[11px] text-zinc-500 truncate block">{removed.email}</span>
      </div>

      <div className="hidden sm:block opacity-60">
        <RoleBadge role={removed.role} small />
      </div>

      <div className="hidden md:flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-red-400/60" />
        <span className="text-[11px] text-zinc-500">Removed</span>
      </div>

      <span className="hidden lg:block text-[11px] text-zinc-500 whitespace-nowrap">
        {formatDate(removed.removedAt)}
      </span>

      {canManage && (
        <button
          onClick={() => onRestore(removed)}
          className="text-xs text-[#A78BFA] hover:text-[#C4B5FD] font-medium flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#8B5CF615] transition-colors cursor-pointer"
          title="Re-invite member"
        >
          <RotateCcw size={12} />
          <span className="hidden sm:inline">Re-invite</span>
        </button>
      )}
    </div>
  );
};

// ─── Removed Member Card (Card View) ────────────────────────────────────────

const RemovedMemberCard: React.FC<{
  removed: RemovedMemberItem;
  canManage: boolean;
  onRestore: (removed: RemovedMemberItem) => void;
}> = ({ removed, canManage, onRestore }) => {
  return (
    <div className="rounded-xl bg-[#0E0F14]/70 border border-[#27272A]/60 p-4 opacity-75 hover:opacity-100 transition-opacity flex flex-col justify-between shadow-sm">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Avatar name={removed.name} avatarUrl={removed.avatarUrl} size={38} muted />
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-medium">
            Removed
          </span>
        </div>

        <div>
          <h4 className="font-semibold text-sm text-zinc-400 line-through truncate">{removed.name}</h4>
          <p className="text-xs text-zinc-500 truncate mt-0.5">{removed.email}</p>
        </div>

        <div>
          <RoleBadge role={removed.role} small />
        </div>
      </div>

      <div className="pt-3 mt-3 border-t border-[#27272A]/70 flex items-center justify-between text-[11px] text-zinc-500">
        <span>Removed {formatDate(removed.removedAt)}</span>
        {canManage && (
          <button
            onClick={() => onRestore(removed)}
            className="text-[11px] font-medium text-[#A78BFA] hover:text-[#C4B5FD] flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={11} />
            <span>Re-invite</span>
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Remove Member Confirm Dialog ─────────────────────────────────────────────

const ConfirmRemoveDialog: React.FC<{
  member: TeamMember;
  isSelf: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}> = ({ member, isSelf, onConfirm, onCancel, loading }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.18 }}
      className="relative z-10 w-full max-w-sm bg-[#0C0D10] border border-[#27272A] rounded-2xl shadow-2xl p-5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
          <AlertCircle size={18} className="text-red-400" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-white">{isSelf ? 'Leave team?' : 'Remove member?'}</h3>
          <p className="text-[12px] text-zinc-400">{isSelf ? 'You will lose access to this team.' : `${member.user.name} will lose access.`}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 h-9 rounded-lg border border-[#27272A] text-zinc-400 hover:text-white text-[13px] font-medium transition-colors hover:bg-white/[0.04] cursor-pointer">
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 h-9 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-60 cursor-pointer"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : null}
          {isSelf ? 'Leave' : 'Remove'}
        </button>
      </div>
    </motion.div>
  </div>
);

// ─── Empty State ───────────────────────────────────────────────────────────────

const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  size?: 'normal' | 'large';
}> = ({
  icon,
  title,
  description,
  action,
  size = 'normal',
}) => {
  const isLarge = size === 'large';
  return (
    <div className={`flex flex-col items-center justify-center text-center mx-auto w-full max-w-lg ${isLarge ? 'py-8' : 'py-12'}`}>
      <div
        className={`${
          isLarge ? 'w-16 h-16 rounded-2xl mb-5' : 'w-12 h-12 rounded-2xl mb-3'
        } bg-transparent border border-[#27272A] flex items-center justify-center text-zinc-400 mx-auto`}
      >
        {icon}
      </div>
      <p
        className={`${
          isLarge
            ? 'text-xl sm:text-2xl font-bold text-white tracking-tight text-center'
            : 'text-[13px] font-medium text-zinc-300 text-center'
        }`}
      >
        {title}
      </p>
      <p
        className={`${
          isLarge
            ? 'text-sm sm:text-[15px] text-zinc-400 mt-2.5 max-w-md leading-relaxed text-center mx-auto'
            : 'text-[12px] text-zinc-500 mt-1 max-w-xs text-center mx-auto'
        }`}
      >
        {description}
      </p>
      {action && (
        <div className={`flex items-center justify-center w-full ${isLarge ? 'mt-8' : 'mt-4'}`}>
          {action}
        </div>
      )}
    </div>
  );
};

// ─── Team Details Box (Right Side Panel) ───────────────────────────────────

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `${datePart} • ${timePart}`;
  } catch {
    return dateStr;
  }
}

function getTeamRecentChanges(team: Team): Array<{ id: string; title: string; time: string; timestamp: number }> {
  const events: Array<{ id: string; title: string; time: string; timestamp: number }> = [];

  // Team created
  if (team.createdAt) {
    events.push({
      id: 'team-created',
      title: `Team created by ${team.createdBy?.name || 'Owner'}`,
      time: formatDateTime(team.createdAt),
      timestamp: new Date(team.createdAt).getTime(),
    });
  }

  // Team updated
  if (team.updatedAt && team.updatedAt !== team.createdAt) {
    events.push({
      id: 'team-updated',
      title: 'Team details and settings updated',
      time: formatDateTime(team.updatedAt),
      timestamp: new Date(team.updatedAt).getTime(),
    });
  }

  // Members joined
  (team.members || []).forEach((m) => {
    if (m.joinedAt) {
      events.push({
        id: `member-${m.id}`,
        title: `${m.user.name} joined as ${DISPLAY_ROLE_LABELS[m.role] || m.role}`,
        time: formatDateTime(m.joinedAt),
        timestamp: new Date(m.joinedAt).getTime(),
      });
    }
  });

  // Invitations sent
  (team.invitations || []).forEach((inv) => {
    if (inv.createdAt) {
      events.push({
        id: `invite-${inv.id}`,
        title: `Invitation created for ${inv.invitedEmail}`,
        time: formatDateTime(inv.createdAt),
        timestamp: new Date(inv.createdAt).getTime(),
      });
    }
  });

  return events.sort((a, b) => b.timestamp - a.timestamp).slice(0, 4);
}

// ─── Default Projects & Tasks for Team ───────────────────────────────────────

function getDefaultTeamProjects(teamName: string) {
  return [
    {
      id: 1,
      title: `${teamName} Core Infrastructure`,
      status: 'IN_PROGRESS',
      tasks: [
        { id: 101, title: 'Setup CI/CD deployment pipeline', status: 'DONE', priority: 'HIGH' },
        { id: 102, title: 'Database indexing & query optimization', status: 'IN_PROGRESS', priority: 'URGENT' },
        { id: 103, title: 'Configure Redis caching layer', status: 'TODO', priority: 'MEDIUM' },
      ],
    },
    {
      id: 2,
      title: 'DevFlow UI & Design System',
      status: 'COMPLETED',
      tasks: [
        { id: 201, title: 'Build modern animated select element', status: 'DONE', priority: 'HIGH' },
        { id: 202, title: 'Dark mode theme token configuration', status: 'DONE', priority: 'MEDIUM' },
      ],
    },
    {
      id: 3,
      title: 'Real-time Activity Analytics',
      status: 'PLANNING',
      tasks: [
        { id: 301, title: 'Event telemetry and logging schema', status: 'IN_REVIEW', priority: 'HIGH' },
        { id: 302, title: 'Grafana & Prometheus dashboards', status: 'TODO', priority: 'MEDIUM' },
      ],
    },
    {
      id: 4,
      title: 'Legacy API Migration',
      status: 'ARCHIVED',
      tasks: [
        { id: 401, title: 'Archive v1 REST endpoints', status: 'DONE', priority: 'LOW' },
      ],
    },
  ];
}

// ─── Team Activity Line Graph Component (Last Changes in Line Graph) ─────────

const TeamActivityLineGraph: React.FC<{
  changes: Array<{ id: string; title: string; time: string; timestamp: number }>;
  accentColor?: string;
}> = ({ changes, accentColor: propAccent }) => {
  const { accentColor: themeAccent } = useAccentTheme();
  const accentColor = propAccent || themeAccent;
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const chronological = useMemo(() => {
    if (!changes || changes.length === 0) return [];
    return [...changes].reverse();
  }, [changes]);

  const points = useMemo(() => {
    const n = Math.max(chronological.length, 2);
    const width = 280;
    const paddingX = 28;
    const availableW = width - paddingX * 2;
    const stepX = availableW / Math.max(n - 1, 1);
    const baseHeights = [70, 42, 58, 22];

    return chronological.map((c, i) => {
      const x = paddingX + i * stepX;
      const y = baseHeights[i % baseHeights.length];
      return { x, y, change: c, index: i };
    });
  }, [chronological]);

  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx1 = p0.x + (p1.x - p0.x) / 2;
      const cy1 = p0.y;
      const cx2 = p0.x + (p1.x - p0.x) / 2;
      const cy2 = p1.y;
      d += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p1.x} ${p1.y}`;
    }
    return d;
  }, [points]);

  const areaD = useMemo(() => {
    if (!pathD || points.length === 0) return '';
    const first = points[0];
    const last = points[points.length - 1];
    return `${pathD} L ${last.x} 92 L ${first.x} 92 Z`;
  }, [pathD, points]);

  if (chronological.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-zinc-500 italic">
        No recent changes recorded
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* SVG Line Graph */}
      <div className="relative bg-[#0C0D12] border border-[#27272A]/70 rounded-xl p-3 overflow-hidden">
        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono mb-1">
          <span className="flex items-center gap-1 text-[#A78BFA]">
            <TrendingUp size={11} />
            <span>Activity Velocity</span>
          </span>
          <span>{changes.length} Events</span>
        </div>

        <svg viewBox="0 0 280 96" className="w-full h-24 overflow-visible">
          <defs>
            <linearGradient id="lineGraphGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accentColor} stopOpacity="0.4" />
              <stop offset="100%" stopColor={accentColor} stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="strokeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={accentColor} />
              <stop offset="100%" stopColor={accentColor} />
            </linearGradient>
            <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={accentColor} floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Grid guides */}
          <line x1="20" y1="28" x2="260" y2="28" stroke="#27272A" strokeDasharray="3 3" opacity="0.6" />
          <line x1="20" y1="62" x2="260" y2="62" stroke="#27272A" strokeDasharray="3 3" opacity="0.6" />

          {/* Area fill */}
          {areaD && <path d={areaD} fill="url(#lineGraphGrad)" />}

          {/* Curve stroke */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="url(#strokeGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#lineGlow)"
            />
          )}

          {/* Points */}
          {points.map((pt, i) => {
            const isHovered = hoveredIdx === i;
            return (
              <g
                key={i}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 6 : 4}
                  fill="#0C0D12"
                  stroke={isHovered ? '#FFFFFF' : accentColor}
                  strokeWidth="2.5"
                  className="transition-all duration-200"
                />
                <circle cx={pt.x} cy={pt.y} r="2" fill={isHovered ? '#FFFFFF' : '#DDD6FE'} />
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <div
            className="absolute top-2 right-2 px-2 py-1 rounded-md bg-[#181922] border text-[10px] text-white shadow-xl pointer-events-none max-w-[200px] truncate"
            style={{ borderColor: `${accentColor}40` }}
          >
            <span className="font-mono" style={{ color: accentColor }}>#{hoveredIdx + 1} </span>
            <span>{points[hoveredIdx].change.title}</span>
          </div>
        )}
      </div>

      {/* Sequential Changes List below graph */}
      <div className="space-y-1.5">
        {changes.map((change, idx) => {
          const isHovered = hoveredIdx === (changes.length - 1 - idx);
          return (
            <div
              key={change.id}
              onMouseEnter={() => setHoveredIdx(changes.length - 1 - idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`p-2 rounded-lg border transition-all text-left ${
                isHovered
                  ? 'bg-[#181924] shadow-sm'
                  : 'bg-[#111216]/80 border-[#27272A]/50 hover:border-zinc-600'
              }`}
              style={isHovered ? { borderColor: `${accentColor}60` } : {}}
            >
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: isHovered ? '#FFFFFF' : accentColor }}
                  />
                  <p className="text-[11.5px] font-medium text-zinc-200 truncate">{change.title}</p>
                </div>
                <span className="text-[9.5px] font-mono text-zinc-500 shrink-0">#{changes.length - idx}</span>
              </div>
              <p className="text-[10px] text-zinc-500 font-mono pl-3 mt-0.5">{change.time}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Team Details Box (Right Side Panel with Tabs) ───────────────────────────

const TeamDetailsBox: React.FC<{
  team: Team;
  metadata: { key: string; icon: string; cleanDesc: string };
  onOpenSettings: () => void;
  onLeaveTeam: () => void;
  canManage: boolean;
  userRole: TeamMemberRole;
}> = ({ team, metadata, onOpenSettings, onLeaveTeam, canManage, userRole }) => {
  const { toast } = useToast();
  const { accentColor } = useAccentTheme();
  const [activeTab, setActiveTab] = useState<'projects' | 'details'>('projects');
  const [copiedLink, setCopiedLink] = useState(false);
  const [projects, setProjects] = useState<any[]>(() => getDefaultTeamProjects(team.name));
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Fetch real projects from /api/projects if available
  useEffect(() => {
    let isMounted = true;
    const fetchProjects = async () => {
      setLoadingProjects(true);
      try {
        const token = authService.getToken();
        const res = await fetch(apiUrl('/projects'), {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.data) && data.data.length > 0) {
          setProjects(data.data);
        } else if (isMounted) {
          setProjects(getDefaultTeamProjects(team.name));
        }
      } catch {
        if (isMounted) {
          setProjects(getDefaultTeamProjects(team.name));
        }
      } finally {
        if (isMounted) setLoadingProjects(false);
      }
    };
    fetchProjects();
    return () => { isMounted = false; };
  }, [team.id, team.name]);

  const handleCopyTeamLink = async () => {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast.success('Link copied!', 'Team URL copied to clipboard');
  };

  const leadMember = team.members.find((m) => m.role === 'OWNER') || team.members[0];
  const leadName = leadMember?.user.name || team.createdBy?.name || 'Team Lead';
  const leadAvatar = leadMember?.user.avatarUrl || team.createdBy?.avatarUrl;
  const isOwner = userRole === 'OWNER';
  const recentChanges = getTeamRecentChanges(team);

  // Pie / Donut Chart calculations
  const statusCounts = useMemo(() => {
    const counts = { IN_PROGRESS: 0, COMPLETED: 0, PLANNING: 0, ARCHIVED: 0 };
    projects.forEach((p) => {
      const s = (p.status || 'IN_PROGRESS') as keyof typeof counts;
      if (counts[s] !== undefined) counts[s]++;
      else counts.IN_PROGRESS++;
    });
    return counts;
  }, [projects]);

  const totalProjects = Math.max(projects.length, 1);
  const circumference = 2 * Math.PI * 38; // r = 38 => ~238.76

  const statusConfigs = [
    { status: 'IN_PROGRESS', label: 'In Progress', count: statusCounts.IN_PROGRESS, color: accentColor },
    { status: 'COMPLETED', label: 'Completed', count: statusCounts.COMPLETED, color: '#10B981' },
    { status: 'PLANNING', label: 'Planning', count: statusCounts.PLANNING, color: '#F59E0B' },
    { status: 'ARCHIVED', label: 'Archived', count: statusCounts.ARCHIVED, color: '#6B7280' },
  ];

  let currentOffset = 0;
  const donutSegments = statusConfigs
    .filter((cfg) => cfg.count > 0)
    .map((cfg) => {
      const slicePct = cfg.count / totalProjects;
      const sliceLength = slicePct * circumference;
      const seg = {
        ...cfg,
        pct: Math.round(slicePct * 100),
        length: sliceLength,
        offset: currentOffset,
      };
      currentOffset += sliceLength;
      return seg;
    });

  // Extract all tasks across projects for tasks section
  const allTasks = useMemo(() => {
    const list: any[] = [];
    projects.forEach((p) => {
      (p.tasks || []).forEach((t: any) => {
        list.push({ ...t, projectTitle: p.title });
      });
    });
    return list;
  }, [projects]);

  return (
    <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-4 text-left">
      {/* Box Header: Team name + Top right icon buttons (Settings & Copy Link) */}
      <div className="flex items-center justify-between pb-3.5 border-b border-[#27272A]/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-3 h-3 rounded-full shrink-0 shadow-sm"
            style={{ backgroundColor: team.color || '#8B5CF6' }}
          />
          <h3 className="font-bold text-sm text-white truncate tracking-tight">Team Details</h3>
        </div>

        {/* Quick icon-only actions (Settings & Copy Link, no text) */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleCopyTeamLink}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            title="Copy team link"
          >
            {copiedLink ? <Check size={14} className="text-[#4ADE80]" /> : <Copy size={14} />}
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            title="Team settings"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* 2 Tabs: 1st is Projects, 2nd is Details (Smooth Animated Pill Switcher) */}
      <div className="relative flex items-center p-1 rounded-xl bg-[#111216] border border-[#27272A]/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
        <button
          type="button"
          onClick={() => setActiveTab('projects')}
          className="relative flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer select-none"
        >
          {activeTab === 'projects' && (
            <motion.div
              layoutId="teamDetailsTabPill"
              className="absolute inset-0 rounded-lg shadow-md"
              style={{
                backgroundColor: accentColor,
                boxShadow: `0 2px 12px ${accentColor}40`,
              }}
              transition={{ type: 'spring', bounce: 0.18, duration: 0.32 }}
            />
          )}
          <span
            className={`relative z-10 flex items-center gap-1.5 transition-colors duration-150 ${
              activeTab === 'projects' ? 'text-black font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FolderKanban size={13} />
            <span>Projects</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('details')}
          className="relative flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer select-none"
        >
          {activeTab === 'details' && (
            <motion.div
              layoutId="teamDetailsTabPill"
              className="absolute inset-0 rounded-lg shadow-md"
              style={{
                backgroundColor: accentColor,
                boxShadow: `0 2px 12px ${accentColor}40`,
              }}
              transition={{ type: 'spring', bounce: 0.18, duration: 0.32 }}
            />
          )}
          <span
            className={`relative z-10 flex items-center gap-1.5 transition-colors duration-150 ${
              activeTab === 'details' ? 'text-black font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Info size={13} />
            <span>Details</span>
          </span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {/* ── Tab 1: PROJECTS TAB (Pie Chart & Tasks below) ────────────────── */}
        {activeTab === 'projects' ? (
          <motion.div
            key="team-tab-projects"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.16 }}
            className="space-y-4"
          >
          {/* Total Projects Pie / Donut Chart */}
          <div className="p-3.5 rounded-xl bg-[#111216] border border-[#27272A]/70 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 font-mono">
                Project Status
              </span>
              <span className="text-[11px] font-mono text-[#A78BFA]">
                {projects.length} Total
              </span>
            </div>

            {/* Donut Chart and Legend */}
            <div className="flex items-center justify-between gap-3 py-1">
              {/* SVG Donut */}
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="#1C1D24"
                    strokeWidth="10"
                  />
                  {donutSegments.map((seg, idx) => (
                    <circle
                      key={idx}
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth="10"
                      strokeDasharray={`${seg.length} ${circumference - seg.length}`}
                      strokeDashoffset={-seg.offset}
                      strokeLinecap="round"
                      className="transition-all duration-500"
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-black text-white">{projects.length}</span>
                  <span className="text-[9px] font-mono uppercase text-zinc-400 tracking-wider">Projects</span>
                </div>
              </div>

              {/* Status Legend */}
              <div className="space-y-1.5 flex-1 min-w-0">
                {statusConfigs.map((item) => {
                  const pct = Math.round((item.count / totalProjects) * 100);
                  return (
                    <div key={item.status} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-zinc-300 truncate">{item.label}</span>
                      </div>
                      <span className="text-zinc-400 font-mono shrink-0 ml-1">
                        {item.count} <span className="text-zinc-600 text-[10px]">({pct}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tasks Section below chart */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 font-mono">
                Tasks ({allTasks.length})
              </p>
              <div className="flex items-center gap-1.5 text-[10px] font-mono">
                <span className="text-emerald-400">{allTasks.filter((t) => t.status === 'DONE').length} done</span>
                <span className="text-zinc-600">·</span>
                <span style={{ color: accentColor }}>{allTasks.filter((t) => t.status === 'IN_PROGRESS').length} in prog</span>
              </div>
            </div>

            {/* Tasks List */}
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
              {allTasks.length === 0 ? (
                <p className="text-xs text-zinc-500 italic py-2">No tasks created yet</p>
              ) : (
                allTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-2 rounded-xl bg-[#111216] border border-[#27272A]/70 hover:border-zinc-600 transition-colors space-y-1 text-left"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {task.status === 'DONE' ? (
                          <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                        ) : task.status === 'IN_PROGRESS' ? (
                          <Clock size={13} className="shrink-0" style={{ color: accentColor }} />
                        ) : task.status === 'IN_REVIEW' ? (
                          <AlertCircle size={13} className="text-amber-400 shrink-0" />
                        ) : (
                          <CheckSquare size={13} className="text-zinc-500 shrink-0" />
                        )}
                        <p className="text-xs font-medium text-white truncate">{task.title}</p>
                      </div>
                      <span
                        className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold uppercase shrink-0 border"
                        style={{
                          backgroundColor:
                            task.status === 'DONE'
                              ? '#10B98115'
                              : task.status === 'IN_PROGRESS'
                              ? `${accentColor}25`
                              : '#F59E0B15',
                          borderColor:
                            task.status === 'DONE'
                              ? '#10B98135'
                              : task.status === 'IN_PROGRESS'
                              ? `${accentColor}40`
                              : '#F59E0B35',
                          color:
                            task.status === 'DONE'
                              ? '#34D399'
                              : task.status === 'IN_PROGRESS'
                              ? accentColor
                              : '#FBBF24',
                        }}
                      >
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono pl-5">
                      <span className="truncate">{task.projectTitle}</span>
                      {task.priority && (
                        <span
                          className={`capitalize text-[9.5px] ${
                            task.priority === 'HIGH' || task.priority === 'URGENT'
                              ? 'text-red-400'
                              : 'text-zinc-400'
                          }`}
                        >
                          {task.priority.toLowerCase()}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      ) : (
        /* ── Tab 2: DETAILS TAB (Details, Dates, Description, Line Graph) ─── */
        <motion.div
          key="team-tab-details"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.16 }}
          className="space-y-4"
        >
          {/* Section 1: DETAILS */}
          <div className="space-y-3">
            <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 font-mono">Details</p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-400">Team:</span>
                <div className="flex items-center gap-1.5 font-medium text-white truncate max-w-[200px]">
                  <span className="truncate">{team.name}</span>
                  {metadata.key && (
                    <span
                      className="px-1.5 py-0.2 rounded font-mono text-[9.5px] font-semibold border shrink-0"
                      style={{
                        backgroundColor: `${team.color || '#8B5CF6'}18`,
                        borderColor: `${team.color || '#8B5CF6'}40`,
                        color: team.color || '#8B5CF6',
                      }}
                    >
                      {metadata.key}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-400">Status:</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-medium text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>ACTIVE</span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-400">Lead:</span>
                <div className="flex items-center gap-2 truncate max-w-[200px]">
                  <Avatar name={leadName} avatarUrl={leadAvatar} userId={leadMember?.userId} size={20} />
                  <span className="text-white font-medium truncate">{leadName}</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-400">Members:</span>
                <div className="flex items-center gap-2">
                  {renderMemberAvatarStack(team.members, 4)}
                  <span className="text-zinc-200 font-mono font-medium text-xs">
                    {team.members.length} active
                    {team.invitations.length > 0 && ` • ${team.invitations.length} pending`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: DATES */}
          <div className="space-y-2 pt-3 border-t border-[#27272A]/70">
            <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 font-mono">Dates</p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-400">Created:</span>
                <span className="text-zinc-300 font-mono text-[11px]">{formatDateTime(team.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-400">Updated:</span>
                <span className="text-zinc-300 font-mono text-[11px]">{formatDateTime(team.updatedAt)}</span>
              </div>
            </div>
          </div>

          {/* Section 3: DESCRIPTION */}
          <div className="space-y-1.5 pt-3 border-t border-[#27272A]/70">
            <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 font-mono">Description</p>
            <p className="text-xs text-zinc-400 leading-relaxed bg-[#111216] p-2.5 rounded-xl border border-[#27272A]/60">
              {metadata.cleanDesc || 'Collaborative team workspace on DevFlow'}
            </p>
          </div>

          {/* Section 4: LAST 4 CHANGES IN LINE GRAPH FORM */}
          <div className="space-y-2.5 pt-3 border-t border-[#27272A]/70">
            <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 font-mono">
              Last Changes (Activity Graph)
            </p>
            <TeamActivityLineGraph changes={recentChanges} accentColor={team.color || '#8B5CF6'} />
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Bottom Actions: Copy link and settings removed; only Leave Team if non-owner */}
      {!isOwner && (
        <div className="pt-2 border-t border-[#27272A]/70">
          <button
            type="button"
            onClick={onLeaveTeam}
            className="w-full h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 hover:text-red-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <UserMinus size={13} />
            <span>Leave Team</span>
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Main TeamView ─────────────────────────────────────────────────────────────

export const TeamView: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { accentColor } = useAccentTheme();

  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [teamLoading, setTeamLoading] = useState(false);

  // Teams Index View state
  const [teamsSearchQuery, setTeamsSearchQuery] = useState('');
  const [teamsViewMode, setTeamsViewMode] = useState<'grid' | 'list'>('grid');

  // Favorites state persisted in localStorage
  const [favoriteTeamIds, setFavoriteTeamIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('devflow_favorite_teams');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleFavoriteTeam = (id: number) => {
    setFavoriteTeamIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem('devflow_favorite_teams', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  // Modals state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [memberToEdit, setMemberToEdit] = useState<TeamMember | null>(null);
  const [settingsTeam, setSettingsTeam] = useState<any | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  // Team Details Members View Mode: 'list' or 'card'
  const [membersViewMode, setMembersViewMode] = useState<'list' | 'card'>('list');

  // Detail members search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<TeamMemberRole | ''>('');

  // Persisted removed members history per team
  const [removedMembersMap, setRemovedMembersMap] = useState<Record<number, RemovedMemberItem[]>>(() => {
    try {
      const saved = localStorage.getItem('devflow_team_removed_members');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const saveRemovedMembers = (updated: Record<number, RemovedMemberItem[]>) => {
    setRemovedMembersMap(updated);
    try {
      localStorage.setItem('devflow_team_removed_members', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  // Persisted custom avatars for team members
  const [memberAvatarsMap, setMemberAvatarsMap] = useState<
    Record<string, { color: string; iconId: string; type: 'initials' | 'icon' }>
  >(() => {
    try {
      const saved = localStorage.getItem('devflow_team_member_custom_avatars');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const loadTeamDetail = useCallback(async (id: number) => {
    setTeamLoading(true);
    const res = await teamService.getTeam(id);
    setTeamLoading(false);
    if (res.success && res.data) {
      setSelectedTeam(res.data);
      setLoadError('');
    } else {
      setLoadError(res.error || 'Failed to load team');
      toast.error('Failed to load team', res.error);
    }
  }, [toast]);

  // Load all teams on mount or refresh
  const loadTeamsList = useCallback(async () => {
    const res = await teamService.listTeams();
    setLoading(false);
    if (res.success && res.data) {
      setTeams(res.data);
    } else {
      setLoadError(res.error || 'Failed to load teams');
    }
  }, []);

  useEffect(() => {
    loadTeamsList();
  }, [loadTeamsList]);

  // If teamId is specified in URL, load details; otherwise we're on the Index page
  useEffect(() => {
    if (teamId && /^\d+$/.test(teamId)) {
      loadTeamDetail(Number(teamId));
    } else {
      setSelectedTeam(null);
    }
  }, [teamId, loadTeamDetail]);

  // Filtered teams for Index page search
  const filteredTeams = useMemo(() => {
    if (!teamsSearchQuery.trim()) return teams;
    const q = teamsSearchQuery.toLowerCase().trim();
    return teams.filter((t) => {
      const { key, cleanDesc } = parseTeamMetadata(t.description, t.name);
      return (
        t.name.toLowerCase().includes(q) ||
        key.toLowerCase().includes(q) ||
        cleanDesc.toLowerCase().includes(q)
      );
    });
  }, [teams, teamsSearchQuery]);

  // Filtered members for Team Details view
  const filteredMembers = useMemo(() => {
    if (!selectedTeam) return [];
    return selectedTeam.members.filter((m) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || m.user.name.toLowerCase().includes(q) || m.user.email.toLowerCase().includes(q);
      const matchesRole =
        !roleFilter ||
        m.role === roleFilter ||
        (roleFilter === 'DEVELOPER' && ['DEVELOPER', 'FRONTEND_DEVELOPER', 'BACKEND_DEVELOPER', 'TESTER'].includes(m.role));
      return matchesSearch && matchesRole;
    });
  }, [selectedTeam, searchQuery, roleFilter]);

  const filteredInvitations = useMemo(() => {
    if (!selectedTeam) return [];
    return selectedTeam.invitations.filter((inv) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || inv.invitedEmail.toLowerCase().includes(q);
      const matchesRole =
        !roleFilter ||
        inv.assignedRole === roleFilter ||
        (roleFilter === 'DEVELOPER' && ['DEVELOPER', 'FRONTEND_DEVELOPER', 'BACKEND_DEVELOPER', 'TESTER'].includes(inv.assignedRole));
      return matchesSearch && matchesRole;
    });
  }, [selectedTeam, searchQuery, roleFilter]);

  const currentRemovedMembers = useMemo(() => {
    if (!selectedTeam) return [];
    return removedMembersMap[selectedTeam.id] || [];
  }, [selectedTeam, removedMembersMap]);

  const filteredRemovedMembers = useMemo(() => {
    return currentRemovedMembers.filter((rm) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || rm.name.toLowerCase().includes(q) || rm.email.toLowerCase().includes(q);
      const matchesRole = !roleFilter || rm.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [currentRemovedMembers, searchQuery, roleFilter]);

  const myRole = selectedTeam?.myRole ?? 'VIEWER';
  const canManageTeam = ['OWNER', 'ADMIN'].includes(myRole);

  const selectedTeamMetadata = useMemo(() => {
    if (!selectedTeam) return { key: '', icon: 'initials', cleanDesc: '' };
    return parseTeamMetadata(selectedTeam.description, selectedTeam.name);
  }, [selectedTeam]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleInvited = (invitation: TeamInvitation, _link: string) => {
    if (!selectedTeam) return;
    setSelectedTeam((prev) => prev ? { ...prev, invitations: [invitation, ...prev.invitations] } : prev);
    setShowInviteModal(false);
  };

  const handleResendInvitation = async (invId: number) => {
    if (!selectedTeam) return;
    const res = await teamService.resendInvitation(selectedTeam.id, invId);
    if (res.success) {
      toast.success('Invitation resent', 'A fresh invite link has been generated');
      loadTeamDetail(selectedTeam.id);
    } else {
      toast.error('Failed to resend', res.error);
    }
  };

  const handleCancelInvitation = async (invId: number) => {
    if (!selectedTeam) return;
    const res = await teamService.cancelInvitation(selectedTeam.id, invId);
    if (res.success) {
      toast.success('Invitation cancelled');
      setSelectedTeam((prev) => prev ? { ...prev, invitations: prev.invitations.filter((i) => i.id !== invId) } : prev);
    } else {
      toast.error('Failed to cancel', res.error);
    }
  };

  const handleRoleChange = async (memberId: number, newRole: TeamMemberRole) => {
    if (!selectedTeam) return;
    const res = await teamService.changeMemberRole(selectedTeam.id, memberId, newRole);
    if (res.success) {
      toast.success('Role updated');
      setSelectedTeam((prev) => prev
        ? { ...prev, members: prev.members.map((m) => m.userId === memberId ? { ...m, role: newRole } : m) }
        : prev
      );
    } else {
      toast.error('Failed to change role', res.error);
    }
  };

  const handleSaveMemberDetails = async (
    memberId: number,
    userId: number,
    newRole: TeamMemberRole,
    avatarColor: string,
    avatarId: string,
    avatarType: 'initials' | 'icon'
  ) => {
    // 1. If role changed, sync with backend if possible
    if (selectedTeam) {
      const currentMember = selectedTeam.members.find((m) => m.userId === userId);
      if (currentMember && currentMember.role !== newRole) {
        try {
          const res = await teamService.changeMemberRole(selectedTeam.id, userId, newRole);
          if (!res.success) {
            console.warn('Backend role update notice:', res.error);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }

    // 2. Persist custom avatar to map and localStorage
    const updatedMap = {
      ...memberAvatarsMap,
      [String(userId)]: { color: avatarColor, iconId: avatarId, type: avatarType },
    };
    setMemberAvatarsMap(updatedMap);
    try {
      localStorage.setItem('devflow_team_member_custom_avatars', JSON.stringify(updatedMap));
    } catch (e) {
      console.error(e);
    }

    // 3. If editing oneself, update user profile and active session
    if (user && user.id === userId) {
      const authUser = authService.getUser();
      if (authUser) {
        authService.setSession(authService.getToken() || 'devflow_token', {
          ...authUser,
          avatarColor,
          avatarId,
          avatarType,
        });
      }
      try {
        await accountSettingsService.updateProfile({ avatarColor, avatarId, avatarType });
      } catch (e) {
        console.error('Failed to sync profile update:', e);
      }
    }

    // 4. Update selectedTeam state in-memory so UI immediately reflects role & avatar
    if (selectedTeam) {
      setSelectedTeam((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          members: prev.members.map((m) =>
            m.userId === userId
              ? {
                  ...m,
                  role: newRole,
                  user: {
                    ...m.user,
                    avatarColor,
                    avatarId,
                    avatarType,
                  },
                }
              : m
          ),
        };
      });
    }

    toast.success('Details updated', 'Member details updated successfully');
    setMemberToEdit(null);
  };

  const handleRemoveMember = async () => {
    if (!selectedTeam || !memberToRemove) return;
    setRemoveLoading(true);
    const res = await teamService.removeMember(selectedTeam.id, memberToRemove.userId);
    setRemoveLoading(false);
    if (res.success) {
      toast.success(memberToRemove.userId === user?.id ? 'You left the team' : `${memberToRemove.user.name} removed`);

      // Add to removed members history
      const removedRecord: RemovedMemberItem = {
        id: Date.now(),
        userId: memberToRemove.userId,
        teamId: selectedTeam.id,
        name: memberToRemove.user.name,
        email: memberToRemove.user.email,
        role: memberToRemove.role,
        removedAt: new Date().toISOString(),
        avatarUrl: memberToRemove.user.avatarUrl,
      };

      const updated = {
        ...removedMembersMap,
        [selectedTeam.id]: [removedRecord, ...(removedMembersMap[selectedTeam.id] || [])]
      };
      saveRemovedMembers(updated);

      if (memberToRemove.userId === user?.id) {
        loadTeamsList();
        navigate('/teams');
      } else {
        setSelectedTeam((prev) => prev
          ? { ...prev, members: prev.members.filter((m) => m.userId !== memberToRemove.userId) }
          : prev
        );
      }
      setMemberToRemove(null);
    } else {
      toast.error('Failed to remove member', res.error);
    }
  };

  const handleRestoreRemoved = async (item: RemovedMemberItem) => {
    if (!selectedTeam) return;
    const res = await teamService.sendInvitation(selectedTeam.id, {
      email: item.email,
      role: item.role,
      message: 'Re-invitation to rejoin the team.',
    });
    if (res.success && res.data) {
      toast.success('Re-invitation sent', `Invitation sent to ${item.email}`);
      // Remove from removed history
      const updated = {
        ...removedMembersMap,
        [selectedTeam.id]: (removedMembersMap[selectedTeam.id] || []).filter((r) => r.id !== item.id)
      };
      saveRemovedMembers(updated);
      setSelectedTeam((prev) => prev ? { ...prev, invitations: [res.data!, ...prev.invitations] } : prev);
    } else {
      toast.error('Failed to re-invite', res.error);
    }
  };

  const handleTeamCreated = (team: any) => {
    setTeams((prev) => [team, ...prev]);
    setShowCreateTeamModal(false);
    navigate(`/teams/${team.id}`);
  };

  const handleTeamUpdated = (updatedTeam: any) => {
    setTeams((prev) => prev.map((t) => t.id === updatedTeam.id ? { ...t, ...updatedTeam } : t));
    if (selectedTeam && selectedTeam.id === updatedTeam.id) {
      setSelectedTeam((prev) => prev ? { ...prev, ...updatedTeam } : prev);
    }
  };

  const handleLeaveTeamClick = () => {
    if (!selectedTeam || !user) return;
    const myMember = selectedTeam.members.find((m) => m.userId === user.id);
    if (myMember) {
      setMemberToRemove(myMember);
    } else {
      toast.error('Cannot leave team', 'You are not listed as an active member of this team.');
    }
  };

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-full max-w-7xl pl-4 sm:pl-8 lg:pl-10 pr-4 sm:pr-8 pt-4 sm:pt-6 pb-12 mr-auto space-y-5">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-800/60 rounded-lg w-48" />
          <div className="h-10 bg-zinc-800/40 rounded-xl w-full max-w-md" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-36 bg-zinc-800/40 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error loading teams
  if (loadError && teams.length === 0) {
    return (
      <div className="w-full max-w-6xl pl-4 sm:pl-8 lg:pl-10 pr-4 sm:pr-8 pt-4 sm:pt-6 pb-12 mr-auto">
        <EmptyState
          icon={<AlertCircle size={22} />}
          title="Could not load teams"
          description={loadError}
          action={
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-[#A78BFA] hover:underline cursor-pointer"
            >
              Try again
            </button>
          }
        />
      </div>
    );
  }

  // No teams created in workspace yet
  if (teams.length === 0 && !loading) {
    return (
      <div className="w-full min-h-[calc(100vh-80px)] flex flex-col">
        <AnimatePresence>
          {showCreateTeamModal && (
            <CreateTeamModal
              onClose={() => setShowCreateTeamModal(false)}
              onCreated={handleTeamCreated}
            />
          )}
        </AnimatePresence>

        {/* Page Header */}
        <div className="w-full max-w-7xl pl-4 sm:pl-8 lg:pl-10 pr-4 sm:pr-8 pt-4 mr-auto shrink-0">
          <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-6 sm:pb-8 border-b border-[#27272A]/70 bg-transparent">
            <h1 className="text-2xl sm:text-3xl md:text-[32px] font-extrabold text-[#FFFFFF] tracking-tight leading-tight">
              Teams
            </h1>
            <p className="text-sm sm:text-[14.5px] text-[#A1A1AA] mt-1.5 leading-relaxed">
              Collaborate with your teammates
            </p>
          </div>
        </div>

        {/* Centered Empty State */}
        <div className="flex-1 w-full flex flex-col items-center justify-center my-auto px-4 py-12 text-center">
          <EmptyState
            size="large"
            icon={<Users size={30} className="text-[#A78BFA]" />}
            title="No teams yet"
            description="Create your first team to start inviting members and collaborating across your workspace."
            action={
              <button
                onClick={() => setShowCreateTeamModal(true)}
                className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-xl hover:brightness-110 text-[#0A0B10] text-sm font-semibold transition-all shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer mx-auto"
                style={{ backgroundColor: accentColor, boxShadow: `0 4px 18px ${accentColor}35` }}
              >
                <Plus size={16} strokeWidth={2.5} />
                <span>Create your first team</span>
              </button>
            }
          />
        </div>
      </div>
    );
  }

  const totalMembersCount =
    (selectedTeam?.members.length || 0) +
    (selectedTeam?.invitations.length || 0) +
    currentRemovedMembers.length;

  const totalFilteredCount =
    filteredMembers.length + filteredInvitations.length + filteredRemovedMembers.length;

  if (settingsTeam) {
    return (
      <TeamSettingsPage
        team={settingsTeam}
        onBack={() => setSettingsTeam(null)}
        onUpdated={(updated) => {
          handleTeamUpdated(updated);
          setSettingsTeam(null);
        }}
      />
    );
  }

  return (
    <div className={`w-full ${teamId ? 'pr-4 sm:pr-8 lg:pr-10' : 'max-w-7xl pr-4 sm:pr-8 mr-auto'} pl-4 sm:pl-8 lg:pl-10 pt-4 sm:pt-6 pb-16 space-y-6`}>
      {/* ── Modals ── */}
      <AnimatePresence>
        {showInviteModal && selectedTeam && (
          <InviteModal
            teamId={selectedTeam.id}
            teamName={selectedTeam.name}
            onClose={() => setShowInviteModal(false)}
            onInvited={handleInvited}
          />
        )}
        {showCreateTeamModal && (
          <CreateTeamModal
            onClose={() => setShowCreateTeamModal(false)}
            onCreated={handleTeamCreated}
          />
        )}
        {memberToEdit && (
          <EditMemberModal
            member={memberToEdit}
            isSelf={memberToEdit.userId === user?.id}
            onClose={() => setMemberToEdit(null)}
            onSaveRole={(newRole) => handleRoleChange(memberToEdit.userId, newRole)}
            onSaveDetails={handleSaveMemberDetails}
          />
        )}
        {memberToRemove && (
          <ConfirmRemoveDialog
            member={memberToRemove}
            isSelf={memberToRemove.userId === user?.id}
            onConfirm={handleRemoveMember}
            onCancel={() => setMemberToRemove(null)}
            loading={removeLoading}
          />
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════════
          INDEX VIEW: All Teams (when no teamId in URL)
         ═══════════════════════════════════════════════════════════════════════ */}
      {!teamId ? (
        <div className="space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#27272A]/70">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-[32px] font-extrabold text-[#FFFFFF] tracking-tight leading-tight">
                Teams
              </h1>
              <p className="text-sm sm:text-[14.5px] text-[#A1A1AA] mt-1.5 leading-relaxed">
                Collaborate with your teammates, manage roles, and organize projects
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setShowCreateTeamModal(true)}
                className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-xl hover:brightness-110 active:scale-[0.98] text-[#0A0B10] text-xs sm:text-sm font-semibold transition-all shadow-md cursor-pointer"
                style={{ backgroundColor: accentColor, boxShadow: `0 4px 18px ${accentColor}35` }}
              >
                <Plus size={16} strokeWidth={2.5} />
                <span>New team</span>
              </button>
            </div>
          </div>

          {/* Controls Bar: Search Input + Count & View Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={teamsSearchQuery}
                onChange={(e) => setTeamsSearchQuery(e.target.value)}
                placeholder="Search teams by name, key, description..."
                className="w-full h-10 pl-9 pr-8 rounded-xl bg-[#111216] border border-[#27272A] text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/30 transition-colors"
              />
              {teamsSearchQuery && (
                <button
                  onClick={() => setTeamsSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-1 cursor-pointer"
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* View Switcher: Card / List */}
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <span className="text-xs font-mono text-zinc-400">
                {filteredTeams.length} {filteredTeams.length === 1 ? 'team' : 'teams'}
              </span>

              <div className="p-1 rounded-xl bg-[#111216] border border-[#27272A] flex items-center gap-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => setTeamsViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    teamsViewMode === 'grid'
                      ? 'text-black shadow-sm font-bold'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                  style={teamsViewMode === 'grid' ? { backgroundColor: accentColor } : {}}
                  title="Grid / Card view"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setTeamsViewMode('list')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    teamsViewMode === 'list'
                      ? 'text-black shadow-sm font-bold'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                  style={teamsViewMode === 'list' ? { backgroundColor: accentColor } : {}}
                  title="List view"
                >
                  <List size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Empty Search Results */}
          {filteredTeams.length === 0 ? (
            <div className="py-16 text-center">
              <EmptyState
                icon={<Search size={22} className="text-zinc-500" />}
                title={`No teams found matching "${teamsSearchQuery}"`}
                description="Try checking for typos or searching by another keyword."
                action={
                  <button
                    onClick={() => setTeamsSearchQuery('')}
                    className="text-xs text-[#A78BFA] hover:underline cursor-pointer"
                  >
                    Clear search filter
                  </button>
                }
              />
            </div>
          ) : teamsViewMode === 'grid' ? (
            /* ─── GRID / CARD VIEW (with Favorite and Settings button) ─── */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              {filteredTeams.map((team) => {
                const { key, cleanDesc } = parseTeamMetadata(team.description, team.name);
                const membersCount = team._count?.members || 1;
                const invitesCount = team._count?.invitations || 0;
                const isFavorite = favoriteTeamIds.includes(team.id);

                return (
                  <motion.div
                    key={team.id}
                    whileHover={{ y: -3, transition: { duration: 0.18 } }}
                    onClick={() => navigate(`/teams/${team.id}`)}
                    className="rounded-2xl bg-[#0E0F14]/90 border border-[#27272A] p-5 hover:border-zinc-500/70 hover:bg-[#12131A] transition-all duration-200 cursor-pointer group flex flex-col justify-between shadow-sm relative overflow-hidden"
                  >
                    {/* Ambient Hover Glow */}
                    <div
                      className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl pointer-events-none opacity-0 group-hover:opacity-15 transition-opacity duration-300"
                      style={{ backgroundColor: team.color || '#8B5CF6' }}
                    />

                    <div className="space-y-3.5 relative z-10">
                      {/* Top Row: Avatar + Key + Role + Favorite & Settings Buttons */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          {renderTeamAvatar(team, 'w-11 h-11', 18)}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {key && (
                                <span
                                  className="px-1.5 py-0.5 rounded font-mono text-[10.5px] font-semibold border"
                                  style={{
                                    backgroundColor: `${team.color || '#8B5CF6'}18`,
                                    borderColor: `${team.color || '#8B5CF6'}40`,
                                    color: team.color || '#8B5CF6',
                                  }}
                                >
                                  {key}
                                </span>
                              )}
                              <RoleBadge role={team.myRole || 'OWNER'} small />
                            </div>
                          </div>
                        </div>

                        {/* Fav button & Setting button */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavoriteTeam(team.id);
                            }}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                              isFavorite
                                ? 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 shadow-sm'
                                : 'text-zinc-500 hover:text-amber-400 hover:bg-white/[0.06]'
                            }`}
                            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <Star size={15} className={isFavorite ? 'fill-amber-400' : ''} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSettingsTeam(team);
                            }}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
                            title="Team settings"
                          >
                            <Settings size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Team Name & Description */}
                      <div>
                        <h3 className="font-bold text-base text-white group-hover:text-[#A78BFA] transition-colors truncate">
                          {team.name}
                        </h3>
                        <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed min-h-[32px]">
                          {cleanDesc || 'Collaborative team workspace on DevFlow'}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Row: Members count & View team */}
                    <div className="pt-3.5 mt-3.5 border-t border-[#27272A]/70 flex items-center justify-between text-xs text-zinc-400 relative z-10">
                      <div className="flex items-center gap-2">
                        {renderMemberAvatarStack(team.members, 3)}
                        <span>
                          {membersCount} {membersCount === 1 ? 'member' : 'members'}
                        </span>
                        {invitesCount > 0 && (
                          <span className="text-amber-400/90 text-[11px] font-mono">
                            · {invitesCount} pending
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[11.5px] font-medium text-zinc-400 group-hover:text-white transition-colors">
                        <span>View team</span>
                        <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-1" />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            /* ─── LIST VIEW (with Favorite and Settings button) ─── */
            <div className="flex flex-col gap-2 pt-1">
              {filteredTeams.map((team) => {
                const { key, cleanDesc } = parseTeamMetadata(team.description, team.name);
                const membersCount = team._count?.members || 1;
                const invitesCount = team._count?.invitations || 0;
                const isFavorite = favoriteTeamIds.includes(team.id);

                return (
                  <motion.div
                    key={team.id}
                    whileHover={{ x: 2, transition: { duration: 0.15 } }}
                    onClick={() => navigate(`/teams/${team.id}`)}
                    className="rounded-xl bg-[#0E0F14]/90 border border-[#27272A] px-4 py-3 sm:px-5 sm:py-3.5 hover:border-zinc-500/70 hover:bg-[#12131A] transition-all duration-150 cursor-pointer group flex items-center justify-between gap-4 shadow-sm"
                  >
                    {/* Left Side: Avatar + Name + Key + Description */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {renderTeamAvatar(team, 'w-9 h-9', 16)}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-white group-hover:text-[#A78BFA] transition-colors truncate">
                            {team.name}
                          </span>
                          {key && (
                            <span
                              className="px-1.5 py-0.2 rounded font-mono text-[10px] font-semibold border"
                              style={{
                                backgroundColor: `${team.color || '#8B5CF6'}18`,
                                borderColor: `${team.color || '#8B5CF6'}40`,
                                color: team.color || '#8B5CF6',
                              }}
                            >
                              {key}
                            </span>
                          )}
                        </div>
                        {cleanDesc && (
                          <p className="text-xs text-zinc-400 truncate max-w-lg mt-0.5">
                            {cleanDesc}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right Side: Members Count + Role Badge + Fav + Settings + Arrow */}
                    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                      <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-400">
                        {renderMemberAvatarStack(team.members, 4)}
                        <span>
                          {membersCount} {membersCount === 1 ? 'member' : 'members'}
                        </span>
                        {invitesCount > 0 && (
                          <span className="text-amber-400/90 text-[11px] font-mono">
                            ({invitesCount})
                          </span>
                        )}
                      </div>

                      <RoleBadge role={team.myRole || 'OWNER'} small />

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavoriteTeam(team.id);
                        }}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                          isFavorite
                            ? 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 shadow-sm'
                            : 'text-zinc-500 hover:text-amber-400 hover:bg-white/[0.06]'
                        }`}
                        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <Star size={14} className={isFavorite ? 'fill-amber-400' : ''} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSettingsTeam(team);
                        }}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
                        title="Team settings"
                      >
                        <Settings size={14} />
                      </button>

                      <div className="p-1 rounded-lg text-zinc-500 group-hover:text-white transition-colors">
                        <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ═══════════════════════════════════════════════════════════════════════
            DETAIL VIEW: Particular Team (when teamId is in URL)
           ═══════════════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          {/* Top Breadcrumb Back button */}
          <div>
            <button
              onClick={() => navigate('/teams')}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer group"
            >
              <ArrowLeft size={13} className="transition-transform duration-150 group-hover:-translate-x-1" />
              <span>Back to all teams</span>
            </button>
          </div>

          {/* ── Detail Header (New team button removed; Audi avatar stack on right of team name) ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 sm:pb-6 border-b border-[#27272A]/70">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              {selectedTeam && renderTeamAvatar(selectedTeam, 'w-12 h-12', 22)}
              <div className="min-w-0 text-left">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl md:text-[32px] font-extrabold text-[#FFFFFF] tracking-tight leading-tight truncate">
                    {selectedTeam?.name || 'Teams'}
                  </h1>

                  {selectedTeamMetadata.key && (
                    <span
                      className="px-2 py-0.5 rounded-md font-mono text-xs font-semibold border"
                      style={{
                        backgroundColor: `${selectedTeam?.color || '#8B5CF6'}18`,
                        borderColor: `${selectedTeam?.color || '#8B5CF6'}40`,
                        color: selectedTeam?.color || '#8B5CF6',
                      }}
                    >
                      {selectedTeamMetadata.key}
                    </span>
                  )}
                  {selectedTeam && <RoleBadge role={myRole} small />}
                </div>
                {selectedTeamMetadata.cleanDesc && (
                  <p className="text-sm sm:text-[14.5px] text-[#A1A1AA] mt-1.5 leading-relaxed truncate">
                    {selectedTeamMetadata.cleanDesc}
                  </p>
                )}
              </div>
            </div>

            {/* Header Actions: Profile icons of teams, Settings, and Leave button on the LEFT SIDE of Invite member */}
            <div className="flex items-center gap-2.5 shrink-0">
              {selectedTeam && selectedTeam.members && selectedTeam.members.length > 0 && (
                <div className="flex items-center">
                  {renderMemberAvatarStack(selectedTeam.members, 6, (m) => {
                    const memberObj = selectedTeam.members.find(
                      (sm) => sm.userId === (m.userId || m.user?.id || m.id)
                    );
                    if (memberObj) {
                      setMemberToEdit(memberObj);
                    }
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={() => setSettingsTeam(selectedTeam)}
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#27272A] text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                title="Team settings"
              >
                <Settings size={14} className="text-zinc-400" />
              </button>

              {myRole !== 'OWNER' && (
                <button
                  type="button"
                  onClick={handleLeaveTeamClick}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-500/25 text-red-400 hover:text-red-300 hover:bg-red-500/10 text-[12px] font-medium transition-colors cursor-pointer"
                  title="Leave team"
                >
                  <UserMinus size={13} />
                  <span className="hidden sm:inline">Leave team</span>
                </button>
              )}

              {canManageTeam && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg hover:brightness-110 text-[#0A0B10] text-[12px] font-semibold transition-all shadow-sm cursor-pointer"
                  style={{ backgroundColor: accentColor, boxShadow: `0 2px 10px ${accentColor}25` }}
                >
                  <UserPlus size={13} />
                  <span>Invite member</span>
                </button>
              )}
            </div>
          </div>

          {/* ── Team Switcher (if multiple teams exist) ── */}
          {teams.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {teams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/teams/${t.id}`)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-all cursor-pointer ${
                    selectedTeam?.id === t.id
                      ? 'bg-[#1C1C1F] text-white border border-[#3F3F46]'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
          )}

          {teamLoading ? (
            <div className="bg-[#0E0E10] border border-[#27272A] rounded-xl overflow-hidden">
              {[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : loadError ? (
            <EmptyState
              icon={<AlertCircle size={18} />}
              title="Could not load this team"
              description={loadError}
              action={
                <button
                  onClick={() => selectedTeam && loadTeamDetail(selectedTeam.id)}
                  className="text-[12px] text-[#A78BFA] hover:underline cursor-pointer"
                >
                  Try again
                </button>
              }
            />
          ) : selectedTeam ? (
            <div className="flex flex-col lg:flex-row items-start gap-6 w-full">
              {/* Left Column: Members & Search (covers 65-70% of screen) */}
              <div className="w-full lg:w-[68%] xl:w-[72%] min-w-0 space-y-4">
                {/* ── Search & Filter Members + List / Card View Switcher ── */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search members by name, username, or email..."
                    className="w-full h-9 pl-8 pr-3 rounded-lg bg-[#111216] border border-[#27272A] text-[12px] text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Custom AnimatedSelect (replaces native OS browser select) + Member View Switcher */}
                <div className="flex items-center gap-2">
                  <div className="w-44 sm:w-48 shrink-0">
                    <AnimatedSelect
                      value={roleFilter}
                      onChange={(val) => setRoleFilter(val as TeamMemberRole | '')}
                      options={ROLE_FILTER_OPTIONS}
                      placeholder="All roles"
                      searchPlaceholder="Filter role..."
                      accentColor={accentColor}
                      dropdownMinWidth="w-52"
                    />
                  </div>

                  {/* List / Card View Switcher for Members */}
                  <div className="p-1 rounded-lg bg-[#111216] border border-[#27272A] flex items-center gap-0.5 shrink-0 shadow-inner">
                    <button
                      type="button"
                      onClick={() => setMembersViewMode('list')}
                      className={`p-1.5 rounded-md transition-all cursor-pointer ${
                        membersViewMode === 'list'
                          ? 'text-black shadow-sm font-bold'
                          : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                      }`}
                      style={membersViewMode === 'list' ? { backgroundColor: accentColor } : {}}
                      title="List view"
                    >
                      <List size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMembersViewMode('card')}
                      className={`p-1.5 rounded-md transition-all cursor-pointer ${
                        membersViewMode === 'card'
                          ? 'text-black shadow-sm font-bold'
                          : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                      }`}
                      style={membersViewMode === 'card' ? { backgroundColor: accentColor } : {}}
                      title="Card view"
                    >
                      <LayoutGrid size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════════════════
                  UNIFIED MEMBERS SECTION
                  (Active members 1st, Pending invitations 2nd, Removed members 3rd)
                 ═══════════════════════════════════════════════════════════════════ */}
              <div className="bg-[#0E0E10] border border-[#27272A] rounded-xl overflow-hidden shadow-sm">
                {/* Unified Section Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272A]">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-zinc-400" />
                    <span className="text-[13px] font-semibold text-white">Members</span>
                    <span className="text-[11px] text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-full font-mono">
                      {totalMembersCount}
                    </span>
                  </div>

                  {/* Status counts pills */}
                  <div className="flex items-center gap-3 text-xs text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>{filteredMembers.length} active</span>
                    </span>
                    {filteredInvitations.length > 0 && (
                      <span className="flex items-center gap-1.5 text-amber-400/90 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span>{filteredInvitations.length} pending</span>
                      </span>
                    )}
                    {filteredRemovedMembers.length > 0 && (
                      <span className="flex items-center gap-1.5 text-zinc-500 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                        <span>{filteredRemovedMembers.length} removed</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Members Content: List View or Card View */}
                {membersViewMode === 'list' ? (
                  <div>
                    {/* Column Headers for List View */}
                    <div className="hidden lg:flex items-center justify-between px-4 py-2 bg-[#121318]/60 border-b border-[#27272A]/50 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                      <span>User / Account</span>
                      <div className="flex items-center gap-8 pr-12">
                        <span className="w-24 text-center">Role</span>
                        <span className="w-20 text-center">Status</span>
                        <span className="w-24 text-center">Date</span>
                      </div>
                    </div>

                    {totalFilteredCount === 0 ? (
                      <EmptyState
                        icon={<Users size={18} />}
                        title={searchQuery ? 'No members match your search' : 'No members found'}
                        description={searchQuery ? 'Try another search query or clear your role filter.' : 'Invite your first team member to collaborate.'}
                      />
                    ) : (
                      <div className="divide-y divide-[#27272A]/30">
                        {/* 1. Active members first */}
                        {filteredMembers.map((member) => (
                          <MemberRow
                            key={`active-${member.id}`}
                            member={member}
                            myRole={myRole}
                            currentUserId={user?.id ?? -1}
                            onEdit={setMemberToEdit}
                            onRoleChange={handleRoleChange}
                            onRemove={setMemberToRemove}
                          />
                        ))}

                        {/* 2. Pending invitations second */}
                        {filteredInvitations.map((inv) => (
                          <UnifiedPendingRow
                            key={`pending-${inv.id}`}
                            invitation={inv}
                            myRole={myRole}
                            onResend={handleResendInvitation}
                            onCancel={handleCancelInvitation}
                          />
                        ))}

                        {/* 3. Removed members last */}
                        {filteredRemovedMembers.map((removed) => (
                          <UnifiedRemovedRow
                            key={`removed-${removed.id}`}
                            removed={removed}
                            canManage={canManageTeam}
                            onRestore={handleRestoreRemoved}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* ─── Members Card View ─── */
                  <div className="p-4">
                    {totalFilteredCount === 0 ? (
                      <EmptyState
                        icon={<Users size={18} />}
                        title={searchQuery ? 'No members match your search' : 'No members found'}
                        description={searchQuery ? 'Try another search query or clear your role filter.' : 'Invite your first team member to collaborate.'}
                      />
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {/* 1. Active members first */}
                        {filteredMembers.map((member) => (
                          <MemberCard
                            key={`card-active-${member.id}`}
                            member={member}
                            myRole={myRole}
                            currentUserId={user?.id ?? -1}
                            onEdit={setMemberToEdit}
                            onRoleChange={handleRoleChange}
                            onRemove={setMemberToRemove}
                          />
                        ))}

                        {/* 2. Pending invitations second */}
                        {filteredInvitations.map((inv) => (
                          <PendingInvitationCard
                            key={`card-pending-${inv.id}`}
                            invitation={inv}
                            canManage={canManageTeam}
                            onResend={handleResendInvitation}
                            onCancel={handleCancelInvitation}
                          />
                        ))}

                        {/* 3. Removed members last */}
                        {filteredRemovedMembers.map((removed) => (
                          <RemovedMemberCard
                            key={`card-removed-${removed.id}`}
                            removed={removed}
                            canManage={canManageTeam}
                            onRestore={handleRestoreRemoved}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Team Details Box (covers 25-30% of screen) */}
            <div className="w-full lg:w-[32%] xl:w-[28%] shrink-0 lg:sticky lg:top-6">
              <TeamDetailsBox
                team={selectedTeam}
                metadata={selectedTeamMetadata}
                onOpenSettings={() => setSettingsTeam(selectedTeam)}
                onLeaveTeam={handleLeaveTeamClick}
                canManage={canManageTeam}
                userRole={myRole}
              />
            </div>
          </div>
        ) : null}
        </div>
      )}
    </div>
  );
};
