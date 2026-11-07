import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  ListFilter,
  Shield,
  Trash2,
  Mail,
  ChevronDown,
  Check,
  X,
  AlertCircle,
  Clock,
  Send,
  RefreshCw,
  MoreHorizontal,
  CheckCircle2,
  ShieldAlert,
  Copy,
  ArrowRight,
  MessageSquare,
  BarChart2,
  TrendingUp,
  Sparkles,
  UserCheck,
  Crown,
  Activity,
  Layers,
  FolderKanban,
  Building2,
  Zap,
  Rocket,
  CheckSquare,
  Calendar,
  LayoutGrid,
  List,
  Loader2,
  Settings,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowDownAZ,
  ArrowUpZA,
  GitCommit,
  Flame,
  ChevronRight,
} from 'lucide-react';
import { useOrganization } from '../../context/OrganizationContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import { useToast } from '../../context/ToastContext';
import { organizationService } from '../../services/organization.service';
import { AnimatedSelect, SelectOption } from '../../components/settings/AnimatedSelect';
import { apiUrl } from '../../config/api';
import type {
  OrganizationMember,
  OrganizationInvitation,
  OrganizationRole,
  OrganizationActivity,
} from '../../types/organization';

// ─── Interfaces ─────────────────────────────────────────────────────────────

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

export type MemberSortOption =
  | 'name-asc'
  | 'name-desc'
  | 'commits-desc'
  | 'tasks-desc'
  | 'recent'
  | 'role';

export type MemberGroupOption =
  | 'none'
  | 'team'
  | 'role'
  | 'project'
  | 'commits';

// ─── Custom AnimatedSelect Role Options ──────────────────────────────────────

const ROLE_FILTER_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'All roles', icon: <Filter size={13} className="text-zinc-400" /> },
  { value: 'OWNER', label: 'Owner', icon: <Crown size={13} className="text-amber-400" />, sublabel: 'Full control' },
  { value: 'ADMIN', label: 'Admin', icon: <Shield size={13} className="text-indigo-400" />, sublabel: 'Manage & settings' },
  { value: 'MEMBER', label: 'Member', icon: <Users size={13} className="text-emerald-400" />, sublabel: 'Collaborate' },
  { value: 'VIEWER', label: 'Viewer', icon: <UserCheck size={13} className="text-zinc-400" />, sublabel: 'Read-only access' },
];

const INVITE_ROLE_OPTIONS: SelectOption[] = [
  { value: 'ADMIN', label: 'Admin', icon: <Shield size={14} className="text-indigo-400" />, sublabel: 'Can manage members, teams & projects' },
  { value: 'MEMBER', label: 'Member', icon: <Users size={14} className="text-emerald-400" />, sublabel: 'Can collaborate across workspaces' },
  { value: 'VIEWER', label: 'Viewer', icon: <UserCheck size={14} className="text-zinc-400" />, sublabel: 'Read-only access to resources' },
];

const EDIT_ROLE_OPTIONS: SelectOption[] = [
  { value: 'ADMIN', label: 'Admin', icon: <Shield size={14} className="text-indigo-400" />, sublabel: 'Full management access' },
  { value: 'MEMBER', label: 'Member', icon: <Users size={14} className="text-emerald-400" />, sublabel: 'Standard collaboration role' },
  { value: 'VIEWER', label: 'Viewer', icon: <UserCheck size={14} className="text-zinc-400" />, sublabel: 'Read-only observer role' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'N/A';
  }
}

function formatRelativeTime(isoString: string): string {
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
}

function getAvatarBg(str: string): string {
  const colors = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#BE185D', '#0891B2', '#6D28D9'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ─── Role Badge Component ───────────────────────────────────────────────────

const RoleBadge: React.FC<{ role: OrganizationRole; small?: boolean }> = ({ role, small = false }) => {
  const badgeConfig: Record<OrganizationRole, { bg: string; text: string; border: string; label: string }> = {
    OWNER: { bg: 'rgba(245, 158, 11, 0.1)', text: '#FBBF24', border: 'rgba(245, 158, 11, 0.25)', label: 'Owner' },
    ADMIN: { bg: 'rgba(99, 102, 241, 0.1)', text: '#A5B4FC', border: 'rgba(99, 102, 241, 0.25)', label: 'Admin' },
    MEMBER: { bg: 'rgba(16, 185, 129, 0.1)', text: '#6EE7B7', border: 'rgba(16, 185, 129, 0.25)', label: 'Member' },
    VIEWER: { bg: 'rgba(161, 161, 170, 0.1)', text: '#D4D4D8', border: 'rgba(161, 161, 170, 0.25)', label: 'Viewer' },
  };

  const cfg = badgeConfig[role] || badgeConfig.MEMBER;

  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded-md whitespace-nowrap uppercase tracking-wider ${
        small ? 'text-[9.5px] px-1.5 py-0.5' : 'text-[10.5px] px-2 py-0.5'
      }`}
      style={{ backgroundColor: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
    >
      {role === 'OWNER' && <Crown size={small ? 9 : 10} className="mr-1 text-amber-400" />}
      {role === 'ADMIN' && <Shield size={small ? 9 : 10} className="mr-1 text-indigo-400" />}
      {role === 'MEMBER' && <Users size={small ? 9 : 10} className="mr-1 text-emerald-400" />}
      {role === 'VIEWER' && <UserCheck size={small ? 9 : 10} className="mr-1 text-zinc-400" />}
      {cfg.label}
    </span>
  );
};

// ─── Main OrganizationMembersView Component ─────────────────────────────────

export const OrganizationMembersView: React.FC = () => {
  const { organizationSlug } = useParams<{ organizationSlug: string }>();
  const { currentOrganization, isAdminOrOwner } = useOrganization();
  const { accentColor } = useAccentTheme();
  const { toast } = useToast();

  const targetSlug = organizationSlug || currentOrganization?.slug;

  // Primary Data
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [auditLogs, setAuditLogs] = useState<OrganizationActivity[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'members' | 'invitations' | 'progress'>('members');
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Sort & Group State
  const [sortBy, setSortBy] = useState<MemberSortOption>('name-asc');
  const [groupBy, setGroupBy] = useState<MemberGroupOption>('none');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState<boolean>(false);
  const [isGroupByHovered, setIsGroupByHovered] = useState<boolean>(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  // Modals & Popups
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMember | null>(null);
  const [isRemoving, setIsRemoving] = useState<boolean>(false);

  const [memberToEditRole, setMemberToEditRole] = useState<OrganizationMember | null>(null);
  const [newSelectedRole, setNewSelectedRole] = useState<OrganizationRole>('MEMBER');
  const [isUpdatingRole, setIsUpdatingRole] = useState<boolean>(false);

  const [memberToChat, setMemberToChat] = useState<OrganizationMember | null>(null);
  const [chatMessage, setChatMessage] = useState<string>('');
  const [isSendingChat, setIsSendingChat] = useState<boolean>(false);

  // 3-dots action menu open tracker
  const [activeMenuMemberId, setActiveMenuMemberId] = useState<number | null>(null);

  // Invite Modal State
  const [dbUsers, setDbUsers] = useState<WorkspaceUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [isAccountOpen, setIsAccountOpen] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<WorkspaceUser | null>(null);
  const [accountSearchQuery, setAccountSearchQuery] = useState<string>('');
  const [manualEmail, setManualEmail] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<OrganizationRole>('MEMBER');
  const [isSendingInvite, setIsSendingInvite] = useState<boolean>(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const accountSelectRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ─── Data Loading ──────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!targetSlug) return;
    setIsLoading(true);
    try {
      const [membersRes, invitesRes, activityRes, teamsRes, projectsRes] = await Promise.all([
        organizationService.listMembers(targetSlug),
        organizationService.listInvitations(targetSlug),
        organizationService.listActivity(targetSlug, 'all'),
        organizationService.listTeams(targetSlug),
        organizationService.listProjects(targetSlug),
      ]);

      if (membersRes.success && membersRes.data) {
        setMembers(membersRes.data);
      }
      if (invitesRes.success && invitesRes.data) {
        setInvitations(invitesRes.data);
      }
      if (activityRes.success && activityRes.data) {
        setAuditLogs(activityRes.data);
      }
      if (teamsRes.success && Array.isArray(teamsRes.data)) {
        setTeams(teamsRes.data);
      }
      if (projectsRes.success && Array.isArray(projectsRes.data)) {
        setProjects(projectsRes.data);
      }
    } catch (err) {
      console.error('Error fetching members, teams, and audit data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [targetSlug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load workspace users for username search in invite popup
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
        console.warn('Could not load workspace users for invite selector:', err);
      } finally {
        if (isMounted) setIsLoadingUsers(false);
      }
    }
    if (isInviteModalOpen) {
      fetchUsers();
    }
    return () => {
      isMounted = false;
    };
  }, [isInviteModalOpen]);

  // Close username dropdown on outside click
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

  // Auto focus search input when user selector opens
  useEffect(() => {
    if (isAccountOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isAccountOpen]);

  // Close 3-dots menu on window click
  useEffect(() => {
    const closeMenu = () => setActiveMenuMemberId(null);
    if (activeMenuMemberId !== null) {
      window.addEventListener('click', closeMenu);
    }
    return () => window.removeEventListener('click', closeMenu);
  }, [activeMenuMemberId]);

  // Close Filter & Group menu on outside click
  useEffect(() => {
    const handleOutsideFilter = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setIsFilterMenuOpen(false);
        setIsGroupByHovered(false);
      }
    };
    if (isFilterMenuOpen) {
      document.addEventListener('mousedown', handleOutsideFilter);
    }
    return () => document.removeEventListener('mousedown', handleOutsideFilter);
  }, [isFilterMenuOpen]);

  // ─── Filtered Users for Invite ────────────────────────────────────────────

  const cleanAccountQuery = accountSearchQuery.trim().toLowerCase().replace(/^@+/, '');
  const matchingAccounts = useMemo(() => {
    if (!cleanAccountQuery) return dbUsers.slice(0, 8);
    return dbUsers.filter((u) => {
      const uname = (u.username || u.email?.split('@')[0] || '').toLowerCase();
      const dname = (u.name || '').toLowerCase();
      const mail = (u.email || '').toLowerCase();
      return uname.includes(cleanAccountQuery) || dname.includes(cleanAccountQuery) || mail.includes(cleanAccountQuery);
    });
  }, [cleanAccountQuery, dbUsers]);

  const effectiveEmail = selectedUser ? selectedUser.email : manualEmail.trim();

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleChangeRole = async () => {
    if (!targetSlug || !memberToEditRole) return;
    setIsUpdatingRole(true);
    try {
      const res = await organizationService.changeMemberRole(targetSlug, memberToEditRole.id, newSelectedRole);
      if (res.success) {
        setMembers((prev) =>
          prev.map((m) => (m.id === memberToEditRole.id ? { ...m, role: newSelectedRole } : m))
        );
        toast.success('Role updated', `${memberToEditRole.user.name}'s role changed to ${newSelectedRole}`);
        setMemberToEditRole(null);
      } else {
        toast.error('Update failed', res.error || 'Could not change member role');
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!targetSlug || !memberToRemove) return;
    setIsRemoving(true);
    try {
      const res = await organizationService.removeMember(targetSlug, memberToRemove.id);
      if (res.success) {
        setMembers((prev) => prev.filter((m) => m.id !== memberToRemove.id));
        toast.success('Member removed', `${memberToRemove.user.name} has been removed from the organization.`);
        setMemberToRemove(null);
      } else {
        toast.error('Remove failed', res.error || 'Could not remove member');
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setIsRemoving(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSlug) return;
    if (!effectiveEmail || !effectiveEmail.includes('@')) {
      setInviteError('Please select a user or enter a valid email address');
      return;
    }

    setIsSendingInvite(true);
    setInviteError(null);
    try {
      const res = await organizationService.sendInvitation(targetSlug, effectiveEmail, inviteRole);
      if (res.success && res.data) {
        setInvitations((prev) => [res.data!, ...prev]);
        toast.success('Invitation sent', `Invited ${effectiveEmail} as ${inviteRole}`);
        setSelectedUser(null);
        setManualEmail('');
        setAccountSearchQuery('');
        setIsInviteModalOpen(false);
      } else {
        setInviteError(res.error || 'Failed to send invitation');
      }
    } catch (err: any) {
      setInviteError(err.message || 'Error sending invitation');
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleCancelInvite = async (invitationId: number, email: string) => {
    if (!targetSlug) return;
    try {
      const res = await organizationService.cancelInvitation(targetSlug, invitationId);
      if (res.success) {
        setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
        toast.success('Invitation revoked', `Revoked invitation for ${email}`);
      } else {
        toast.error('Failed to revoke', res.error);
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    }
  };

  const handleSendChat = () => {
    if (!memberToChat) return;
    setIsSendingChat(true);
    setTimeout(() => {
      setIsSendingChat(false);
      toast.success('Message sent', `Direct message delivered to ${memberToChat.user.name}`);
      setChatMessage('');
      setMemberToChat(null);
    }, 450);
  };

  // ─── Filtered Data ─────────────────────────────────────────────────────────

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        m.user.name.toLowerCase().includes(q) ||
        m.user.email.toLowerCase().includes(q);
      const matchesRole = roleFilter === 'ALL' || m.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [members, searchQuery, roleFilter]);

  const filteredInvitations = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return invitations.filter((inv) => !q || inv.invitedEmail.toLowerCase().includes(q));
  }, [invitations, searchQuery]);

  // ─── Audit Log Helpers ─────────────────────────────────────────────────────

  const getActivityIcon = (act: OrganizationActivity) => {
    switch (act.action) {
      case 'DEPLOYED_RELEASE':
        return <Rocket size={12} className="text-emerald-400" />;
      case 'UPDATED_ORGANIZATION':
      case 'CONFIGURED_SECURITY':
        return <Shield size={12} className="text-amber-400" />;
      case 'CREATED_ORGANIZATION':
        return <Building2 size={12} className="text-purple-400" />;
      case 'CREATED_TEAM':
        return <Layers size={12} className="text-violet-400" />;
      case 'CREATED_PROJECT':
        return <FolderKanban size={12} className="text-blue-400" />;
      case 'INVITED_MEMBER':
      case 'JOINED_ORGANIZATION':
        return <UserPlus size={12} className="text-indigo-400" />;
      case 'ASSIGNED_ROLE':
      case 'CHANGED_MEMBER_ROLE':
        return <Zap size={12} className="text-cyan-400" />;
      case 'REMOVED_MEMBER':
        return <Trash2 size={12} className="text-red-400" />;
      default:
        return <Activity size={12} className="text-zinc-400" />;
    }
  };

  const formatActivityText = (act: OrganizationActivity) => {
    const actorName = act.actor?.name || 'A team member';
    switch (act.action) {
      case 'DEPLOYED_RELEASE':
        return `${actorName} deployed a production release`;
      case 'UPDATED_ORGANIZATION':
        return `${actorName} updated organization settings`;
      case 'CREATED_ORGANIZATION':
        return `${actorName} founded the workspace`;
      case 'JOINED_ORGANIZATION':
        return `${actorName} joined the organization`;
      case 'INVITED_MEMBER':
        return `${actorName} invited a new collaborator`;
      case 'ASSIGNED_ROLE':
      case 'CHANGED_MEMBER_ROLE':
        return `${actorName} changed member role permissions`;
      case 'REMOVED_MEMBER':
        return `${actorName} removed a member from organization`;
      case 'CREATED_TEAM':
        return `${actorName} established a new team`;
      case 'CREATED_PROJECT':
        return `${actorName} created a new workspace project`;
      default:
        return `${actorName} performed ${act.action.toLowerCase().replace(/_/g, ' ')}`;
    }
  };

  const last8AuditLogs = useMemo(() => auditLogs.slice(0, 8), [auditLogs]);

  // ─── Member Progress Mock / Computed Data ──────────────────────────────────

  const getMemberProgress = useCallback((m: OrganizationMember) => {
    // Deterministic stats per member
    const seed = m.user.name.length + m.id * 7;
    const totalTasks = 15 + (seed % 16);
    const completedTasks = Math.round(totalTasks * (0.65 + ((seed % 30) / 100)));
    const completionRate = Math.min(100, Math.round((completedTasks / totalTasks) * 100));
    const codeReviews = 4 + (seed % 9);
    const commits = 18 + (seed % 35);
    const totalActivities = completedTasks + codeReviews + commits;

    // Status label
    let statusLabel = 'On Track';
    let statusColor = '#10B981';
    if (completionRate >= 88) {
      statusLabel = 'Top Contributor';
      statusColor = accentColor;
    } else if (completionRate >= 75) {
      statusLabel = 'High Velocity';
      statusColor = '#38BDF8';
    }

    // 7-day mini bar values (Mon to Sun)
    const weeklyBars = [
      3 + (seed % 5),
      5 + ((seed * 2) % 6),
      4 + ((seed * 3) % 7),
      7 + ((seed * 4) % 6),
      6 + ((seed * 5) % 8),
      2 + (seed % 4),
      1 + (seed % 3),
    ];
    const maxBar = Math.max(...weeklyBars, 1);

    return {
      member: m,
      totalTasks,
      completedTasks,
      completionRate,
      codeReviews,
      commits,
      totalActivities,
      statusLabel,
      statusColor,
      weeklyBars,
      maxBar,
    };
  }, [accentColor]);

  // ─── Sorted Members & Progress ─────────────────────────────────────────────

  const sortedMembers = useMemo(() => {
    const list = [...filteredMembers];
    const rolePriority: Record<string, number> = { OWNER: 1, ADMIN: 2, MEMBER: 3, VIEWER: 4 };

    return list.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.user.name.localeCompare(b.user.name);
        case 'name-desc':
          return b.user.name.localeCompare(a.user.name);
        case 'commits-desc': {
          const statsA = getMemberProgress(a);
          const statsB = getMemberProgress(b);
          return statsB.commits - statsA.commits;
        }
        case 'tasks-desc': {
          const statsA = getMemberProgress(a);
          const statsB = getMemberProgress(b);
          return statsB.completedTasks - statsA.completedTasks;
        }
        case 'recent':
          return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
        case 'role':
          return (rolePriority[a.role] || 99) - (rolePriority[b.role] || 99);
        default:
          return 0;
      }
    });
  }, [filteredMembers, sortBy, getMemberProgress]);

  const memberProgressData = useMemo(() => {
    return sortedMembers.map((m) => getMemberProgress(m));
  }, [sortedMembers, getMemberProgress]);

  // ─── Grouped Members & Progress ────────────────────────────────────────────

  interface MemberGroupBucket<T> {
    id: string;
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    color?: string;
    items: T[];
  }

  const groupedMembers = useMemo((): MemberGroupBucket<OrganizationMember>[] => {
    if (groupBy === 'none') {
      return [{ id: 'all', title: '', items: sortedMembers }];
    }

    if (groupBy === 'role') {
      const roles: OrganizationRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
      const roleConfig: Record<OrganizationRole, { title: string; color: string; icon: React.ReactNode }> = {
        OWNER: { title: 'Workspace Owners', color: '#F59E0B', icon: <Crown size={14} className="text-amber-400" /> },
        ADMIN: { title: 'Administrators', color: '#8B5CF6', icon: <ShieldAlert size={14} className="text-purple-400" /> },
        MEMBER: { title: 'Members', color: '#38BDF8', icon: <Users size={14} className="text-sky-400" /> },
        VIEWER: { title: 'Viewers', color: '#71717A', icon: <UserCheck size={14} className="text-zinc-400" /> },
      };

      return roles
        .map((r) => ({
          id: `role-${r}`,
          title: roleConfig[r].title,
          icon: roleConfig[r].icon,
          color: roleConfig[r].color,
          items: sortedMembers.filter((m) => m.role === r),
        }))
        .filter((g) => g.items.length > 0);
    }

    if (groupBy === 'team') {
      if (teams.length > 0) {
        const groups: MemberGroupBucket<OrganizationMember>[] = [];
        teams.forEach((t) => {
          const tMembers = sortedMembers.filter((m) =>
            t.members?.some((tm: any) => tm.userId === m.userId || tm.id === m.userId || tm.user?.id === m.userId)
          );
          if (tMembers.length > 0) {
            groups.push({
              id: `team-${t.id}`,
              title: t.name,
              subtitle: t.description || undefined,
              color: t.color || accentColor,
              icon: <Users size={14} style={{ color: t.color || accentColor }} />,
              items: tMembers,
            });
          }
        });

        const unassigned = sortedMembers.filter(
          (m) => !teams.some((t) => t.members?.some((tm: any) => tm.userId === m.userId || tm.id === m.userId || tm.user?.id === m.userId))
        );
        if (unassigned.length > 0) {
          groups.push({
            id: 'team-unassigned',
            title: 'Unassigned Team',
            subtitle: 'Members without team assignment',
            color: '#71717A',
            icon: <Users size={14} className="text-zinc-500" />,
            items: unassigned,
          });
        }
        if (groups.length > 0) return groups;
      }

      const teamNames = ['Core Engineering', 'Design & UI/UX', 'Platform & DevOps'];
      const teamColors = [accentColor, '#38BDF8', '#10B981'];
      return teamNames
        .map((tName, idx) => ({
          id: `team-mock-${idx}`,
          title: tName,
          color: teamColors[idx],
          icon: <Users size={14} style={{ color: teamColors[idx] }} />,
          items: sortedMembers.filter((m) => (m.id + m.user.name.length) % teamNames.length === idx),
        }))
        .filter((g) => g.items.length > 0);
    }

    if (groupBy === 'project') {
      if (projects.length > 0) {
        const groups: MemberGroupBucket<OrganizationMember>[] = [];
        projects.forEach((p) => {
          const pMembers = sortedMembers.filter((m) =>
            p.members?.some((pm: any) => pm.userId === m.userId || pm.id === m.userId) ||
            p.leadId === m.userId ||
            p.createdById === m.userId
          );
          if (pMembers.length > 0) {
            groups.push({
              id: `project-${p.id}`,
              title: p.title || p.name,
              subtitle: p.key || undefined,
              color: '#38BDF8',
              icon: <FolderKanban size={14} className="text-sky-400" />,
              items: pMembers,
            });
          }
        });

        const unassigned = sortedMembers.filter(
          (m) =>
            !projects.some((p) =>
              p.members?.some((pm: any) => pm.userId === m.userId || pm.id === m.userId) ||
              p.leadId === m.userId ||
              p.createdById === m.userId
            )
        );
        if (unassigned.length > 0) {
          groups.push({
            id: 'project-unassigned',
            title: 'General Workspace',
            subtitle: 'No assigned project',
            color: '#71717A',
            icon: <FolderKanban size={14} className="text-zinc-500" />,
            items: unassigned,
          });
        }
        if (groups.length > 0) return groups;
      }

      const projectNames = ['DevFlow Web Platform', 'API Gateway & Services', 'Mobile Applications'];
      return projectNames
        .map((pName, idx) => ({
          id: `proj-mock-${idx}`,
          title: pName,
          color: '#818CF8',
          icon: <FolderKanban size={14} className="text-indigo-400" />,
          items: sortedMembers.filter((m) => (m.id * 3 + m.user.name.length) % projectNames.length === idx),
        }))
        .filter((g) => g.items.length > 0);
    }

    if (groupBy === 'commits') {
      const high = sortedMembers.filter((m) => getMemberProgress(m).commits >= 35);
      const moderate = sortedMembers.filter((m) => {
        const c = getMemberProgress(m).commits;
        return c >= 25 && c < 35;
      });
      const low = sortedMembers.filter((m) => getMemberProgress(m).commits < 25);

      const groups: MemberGroupBucket<OrganizationMember>[] = [];
      if (high.length > 0) {
        groups.push({
          id: 'commits-high',
          title: 'High Activity (35+ commits)',
          subtitle: 'Top contributing members this cycle',
          color: '#F59E0B',
          icon: <Flame size={14} className="text-amber-400" />,
          items: high,
        });
      }
      if (moderate.length > 0) {
        groups.push({
          id: 'commits-moderate',
          title: 'Active Contributors (25-34 commits)',
          subtitle: 'Steady consistent contribution',
          color: '#10B981',
          icon: <TrendingUp size={14} className="text-emerald-400" />,
          items: moderate,
        });
      }
      if (low.length > 0) {
        groups.push({
          id: 'commits-low',
          title: 'Getting Started (< 25 commits)',
          subtitle: 'Newer or onboarding members',
          color: '#71717A',
          icon: <Clock size={14} className="text-zinc-400" />,
          items: low,
        });
      }
      return groups;
    }

    return [{ id: 'all', title: '', items: sortedMembers }];
  }, [sortedMembers, groupBy, teams, projects, accentColor, getMemberProgress]);

  const groupedProgress = useMemo(() => {
    return groupedMembers.map((g) => ({
      ...g,
      items: g.items.map((m) => getMemberProgress(m)),
    }));
  }, [groupedMembers, getMemberProgress]);

  const totalProgressTasks = memberProgressData.reduce((acc, curr) => acc + curr.totalTasks, 0);
  const totalCompletedTasks = memberProgressData.reduce((acc, curr) => acc + curr.completedTasks, 0);
  const avgCompletionRate = memberProgressData.length
    ? Math.round((totalCompletedTasks / Math.max(totalProgressTasks, 1)) * 100)
    : 0;

  return (
    <div className="w-full max-w-[1600px] pl-4 sm:pl-8 lg:pl-10 pr-4 sm:pr-8 mr-auto pt-4 sm:pt-6 pb-16 space-y-6 text-left">
      {/* ─── Page Header (No icon, exact teams index typography & layout) ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#27272A]/70">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-[32px] font-extrabold text-[#FFFFFF] tracking-tight leading-tight">
            Members & Permissions
          </h1>
          <p className="text-sm sm:text-[14.5px] text-[#A1A1AA] mt-1.5 leading-relaxed">
            Manage organization memberships, seat allocations, and administrative roles
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isAdminOrOwner && (
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-xl hover:brightness-110 active:scale-[0.98] text-[#0A0B10] text-xs sm:text-sm font-semibold transition-all shadow-md cursor-pointer"
              style={{ backgroundColor: accentColor, boxShadow: `0 4px 18px ${accentColor}35` }}
            >
              <UserPlus size={16} strokeWidth={2.5} />
              <span>Invite member</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Main 2-Column Directory Layout ────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-start gap-6 w-full">
        {/* ─── LEFT COLUMN: Tabs, Filters, Content ─────────────────────────── */}
        <div className="flex-1 w-full lg:min-w-0 space-y-4">
          {/* Top Bar: Modern Tab Switcher + Search + AnimatedSelect Role Filter + View Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Pill Tab Switcher */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#111216] border border-[#27272A] w-fit shadow-inner">
              <button
                type="button"
                onClick={() => setActiveTab('members')}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'members'
                    ? 'text-white font-semibold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {activeTab === 'members' && (
                  <motion.div
                    layoutId="memberActiveTabPill"
                    className="absolute inset-0 rounded-lg shadow-sm"
                    style={{ backgroundColor: `${accentColor}25`, border: `1px solid ${accentColor}50` }}
                    transition={{ duration: 0.18 }}
                  />
                )}
                <span className="relative z-10">Members</span>
                <span
                  className={`relative z-10 px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                    activeTab === 'members' ? 'bg-white/15 text-white' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {members.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('invitations')}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'invitations'
                    ? 'text-white font-semibold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {activeTab === 'invitations' && (
                  <motion.div
                    layoutId="memberActiveTabPill"
                    className="absolute inset-0 rounded-lg shadow-sm"
                    style={{ backgroundColor: `${accentColor}25`, border: `1px solid ${accentColor}50` }}
                    transition={{ duration: 0.18 }}
                  />
                )}
                <span className="relative z-10">Pending</span>
                <span
                  className={`relative z-10 px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                    activeTab === 'invitations' ? 'bg-white/15 text-white' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {invitations.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('progress')}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'progress'
                    ? 'text-white font-semibold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {activeTab === 'progress' && (
                  <motion.div
                    layoutId="memberActiveTabPill"
                    className="absolute inset-0 rounded-lg shadow-sm"
                    style={{ backgroundColor: `${accentColor}25`, border: `1px solid ${accentColor}50` }}
                    transition={{ duration: 0.18 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1">
                  <BarChart2 size={13} className="text-emerald-400" />
                  <span>Progress</span>
                </span>
              </button>
            </div>

            {/* Right Controls: Search, Custom AnimatedSelect Role Filter, View Switcher */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Search */}
              <div className="relative flex-1 sm:w-64">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search members..."
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

              {/* Custom AnimatedSelect Role Filter */}
              {activeTab === 'members' && (
                <div className="w-36 shrink-0">
                  <AnimatedSelect
                    value={roleFilter}
                    onChange={(val) => setRoleFilter(val)}
                    options={ROLE_FILTER_OPTIONS}
                    placeholder="All Roles"
                    accentColor={accentColor}
                    dropdownMinWidth="min-w-[190px]"
                  />
                </div>
              )}

              {/* Filter & Group (Sort & Group) Icon Button + Flyout Popover */}
              {(activeTab === 'members' || activeTab === 'progress') && (
                <div ref={filterMenuRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsFilterMenuOpen((prev) => !prev)}
                    className="relative w-10 h-10 rounded-xl bg-[#111216] border border-[#27272A] hover:border-zinc-500 text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-inner"
                    title="Sort and group options"
                    aria-label="Sort and group options"
                  >
                    <ListFilter
                      size={15}
                      className={groupBy !== 'none' || sortBy !== 'name-asc' ? 'text-white' : 'text-zinc-400'}
                      style={groupBy !== 'none' || sortBy !== 'name-asc' ? { color: accentColor } : {}}
                    />
                    {(groupBy !== 'none' || sortBy !== 'name-asc') && (
                      <span
                        className="absolute top-2 right-2 w-2 h-2 rounded-full ring-2 ring-[#111216]"
                        style={{ backgroundColor: accentColor }}
                      />
                    )}
                  </button>

                  {/* Filter & Group Popover Menu (Matching AnimatedSelect Styling) */}
                  <AnimatePresence>
                    {isFilterMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 4, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-[#14161C]/98 backdrop-blur-xl border border-[#27272A] p-2 shadow-2xl z-50 text-left space-y-1.5"
                      >
                        {/* Section Header: Sort by */}
                        <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                          <span>Sort by</span>
                          <ArrowUpDown size={11} className="text-zinc-500" />
                        </div>

                        {/* Sort Options with Colorful Icons & Sublabels */}
                        <div className="space-y-1">
                          {[
                            {
                              value: 'name-asc',
                              label: 'Name (A → Z)',
                              sublabel: 'Alphabetical',
                              icon: <ArrowDownAZ size={14} className="text-blue-400" />,
                            },
                            {
                              value: 'name-desc',
                              label: 'Name (Z → A)',
                              sublabel: 'Reverse',
                              icon: <ArrowUpZA size={14} className="text-sky-400" />,
                            },
                            {
                              value: 'tasks-desc',
                              label: 'Most Tasks Done',
                              sublabel: 'Completion rate',
                              icon: <CheckCircle2 size={14} className="text-emerald-400" />,
                            },
                            {
                              value: 'commits-desc',
                              label: 'Most Commits',
                              sublabel: 'High activity',
                              icon: <GitCommit size={14} className="text-amber-400" />,
                            },
                            {
                              value: 'recent',
                              label: 'Recently Joined',
                              sublabel: 'Newest first',
                              icon: <Calendar size={14} className="text-violet-400" />,
                            },
                            {
                              value: 'role',
                              label: 'Role Hierarchy',
                              sublabel: 'Owner → Viewer',
                              icon: <Crown size={14} className="text-yellow-400" />,
                            },
                          ].map((opt) => {
                            const isSelected = sortBy === opt.value;
                            return (
                              <motion.button
                                key={opt.value}
                                type="button"
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                  setSortBy(opt.value as MemberSortOption);
                                  setIsFilterMenuOpen(false);
                                  setIsGroupByHovered(false);
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

                        {/* Section Header: Group by with Hover Submenu Flyout */}
                        <div className="relative">
                          <div
                            onMouseEnter={() => setIsGroupByHovered(true)}
                            onMouseLeave={() => setIsGroupByHovered(false)}
                            className="relative"
                          >
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setIsGroupByHovered((p) => !p)}
                              className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs sm:text-[12.5px] transition-all cursor-pointer group border ${
                                groupBy !== 'none'
                                  ? 'font-medium shadow-sm'
                                  : 'text-[#D4D4D8] border-transparent hover:bg-white/[0.06] hover:text-white'
                              }`}
                              style={
                                groupBy !== 'none'
                                  ? {
                                      backgroundColor: `${accentColor}18`,
                                      borderColor: `${accentColor}35`,
                                      color: '#FFFFFF',
                                    }
                                  : undefined
                              }
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="shrink-0 flex items-center justify-center">
                                  <Layers size={14} className="text-purple-400" />
                                </span>
                                <span className="font-semibold text-white">Group by</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border ${
                                    groupBy !== 'none'
                                      ? 'bg-white/10 text-white'
                                      : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/60'
                                  }`}
                                  style={
                                    groupBy !== 'none'
                                      ? { borderColor: `${accentColor}50`, color: accentColor }
                                      : {}
                                  }
                                >
                                  {groupBy === 'none'
                                    ? 'None'
                                    : groupBy === 'team'
                                    ? 'Team'
                                    : groupBy === 'role'
                                    ? 'Role'
                                    : groupBy === 'project'
                                    ? 'Project'
                                    : 'Activity'}
                                </span>
                                <ChevronRight
                                  size={13}
                                  className="text-zinc-500 group-hover:translate-x-0.5 transition-transform"
                                />
                              </div>
                            </motion.button>

                            {/* Submenu Flyout (Matching AnimatedSelect Palette) */}
                            <AnimatePresence>
                              {isGroupByHovered && (
                                <motion.div
                                  initial={{ opacity: 0, x: -8, scale: 0.96 }}
                                  animate={{ opacity: 1, x: 0, scale: 1 }}
                                  exit={{ opacity: 0, x: -8, scale: 0.96 }}
                                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                                  className="absolute right-full top-0 mr-2 w-64 rounded-2xl bg-[#14161C]/98 backdrop-blur-xl border border-[#27272A] p-2 shadow-2xl z-50 space-y-1 text-left"
                                >
                                  <div className="px-2.5 py-1 text-[9.5px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                                    <span>Group By</span>
                                    <Layers size={11} className="text-zinc-500" />
                                  </div>
                                  {[
                                    {
                                      value: 'none',
                                      label: 'None',
                                      sublabel: 'Flat list',
                                      icon: <List size={14} className="text-zinc-400" />,
                                    },
                                    {
                                      value: 'team',
                                      label: 'By Team',
                                      sublabel: 'Departments',
                                      icon: <Users size={14} className="text-violet-400" />,
                                    },
                                    {
                                      value: 'role',
                                      label: 'By Role',
                                      sublabel: 'Permissions',
                                      icon: <Shield size={14} className="text-indigo-400" />,
                                    },
                                    {
                                      value: 'project',
                                      label: 'By Project',
                                      sublabel: 'Workstreams',
                                      icon: <FolderKanban size={14} className="text-sky-400" />,
                                    },
                                    {
                                      value: 'commits',
                                      label: 'By Activity',
                                      sublabel: 'Commits & tasks',
                                      icon: <Flame size={14} className="text-orange-400" />,
                                    },
                                  ].map((gOpt) => {
                                    const isGroupSelected = groupBy === gOpt.value;
                                    return (
                                      <motion.button
                                        key={gOpt.value}
                                        type="button"
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => {
                                          setGroupBy(gOpt.value as MemberGroupOption);
                                          setIsFilterMenuOpen(false);
                                          setIsGroupByHovered(false);
                                        }}
                                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs sm:text-[12.5px] transition-all cursor-pointer border ${
                                          isGroupSelected
                                            ? 'font-medium shadow-sm'
                                            : 'text-[#D4D4D8] border-transparent hover:bg-white/[0.06] hover:text-white'
                                        }`}
                                        style={
                                          isGroupSelected
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
                                            {gOpt.icon}
                                          </span>
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="font-semibold text-white truncate shrink-0">
                                              {gOpt.label}
                                            </span>
                                            {gOpt.sublabel && (
                                              <span className="text-[10px] font-mono text-zinc-400 truncate">
                                                {gOpt.sublabel}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        {isGroupSelected && (
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
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>

                        {/* Reset button if active */}
                        {(sortBy !== 'name-asc' || groupBy !== 'none') && (
                          <div className="pt-1.5 border-t border-[#27272A]/80">
                            <button
                              type="button"
                              onClick={() => {
                                setSortBy('name-asc');
                                setGroupBy('none');
                                setIsFilterMenuOpen(false);
                                setIsGroupByHovered(false);
                              }}
                              className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-mono text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer group"
                            >
                              <RefreshCw size={11} className="transition-transform group-hover:rotate-180 duration-300" />
                              <span>Reset sorting & grouping</span>
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* View Switcher: Card / List Toggle (active on members & progress) */}
              {activeTab !== 'invitations' && (
                <div className="p-1 rounded-xl bg-[#111216] border border-[#27272A] flex items-center gap-1 shadow-inner shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewMode('card')}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      viewMode === 'card'
                        ? 'text-black shadow-sm font-bold'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                    style={viewMode === 'card' ? { backgroundColor: accentColor } : {}}
                    title="Card view"
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
                    title="List view"
                  >
                    <List size={15} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ─── TAB 1: MEMBERS (LIST OR CARD VIEW) ─────────────────────────── */}
          {activeTab === 'members' && (
            <div>
              {isLoading ? (
                <div className="py-20 rounded-2xl bg-[#0E0F14] border border-[#27272A] text-center space-y-3">
                  <div
                    className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin mx-auto"
                    style={{ borderColor: `${accentColor} transparent ${accentColor} ${accentColor}` }}
                  />
                  <p className="text-xs text-zinc-400 font-mono">Loading members...</p>
                </div>
              ) : sortedMembers.length === 0 ? (
                <div className="py-16 rounded-2xl bg-[#0E0F14] border border-[#27272A] text-center space-y-3 p-6">
                  <div className="w-12 h-12 rounded-full bg-zinc-800/80 flex items-center justify-center mx-auto text-zinc-400">
                    <Users size={22} />
                  </div>
                  <h3 className="text-sm font-semibold text-white">No members match your criteria</h3>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    Try searching for another name or email address, or change the role filter.
                  </p>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-xs text-[#A78BFA] hover:underline cursor-pointer"
                    >
                      Clear search filter
                    </button>
                  )}
                </div>
              ) : viewMode === 'list' ? (
                /* ── LIST VIEW (SUPPORTING GROUPING & SORTING) ── */
                <div className="space-y-4">
                  {groupedMembers.map((group) => (
                    <div key={group.id} className="space-y-2.5">
                      {groupBy !== 'none' && (
                        <div className="flex items-center justify-between py-2 px-3.5 rounded-xl bg-[#111216]/80 border border-[#27272A]/80">
                          <div className="flex items-center gap-2.5">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color || accentColor }} />
                            <span className="font-bold text-xs sm:text-sm text-white tracking-tight">{group.title}</span>
                            {group.subtitle && <span className="text-[11px] text-zinc-500 font-mono">({group.subtitle})</span>}
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-[10px] font-mono text-zinc-300 border border-white/[0.08]">
                            {group.items.length} {group.items.length === 1 ? 'member' : 'members'}
                          </span>
                        </div>
                      )}

                      <div className="rounded-2xl border border-[#27272A] bg-[#0E0F14] overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-[#27272A] bg-[#111216]/60 text-zinc-400 uppercase tracking-wider font-mono text-[10px]">
                                <th className="py-3 px-4 font-semibold">User</th>
                                <th className="py-3 px-4 font-semibold">Role</th>
                                <th className="py-3 px-4 font-semibold">Status</th>
                                <th className="py-3 px-4 font-semibold">Joined Date</th>
                                <th className="py-3 px-4 font-semibold text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#27272A]/40">
                              {group.items.map((member) => {
                          const isMemberOwner = member.role === 'OWNER';
                          const avatarColor = member.user.avatarColor || getAvatarBg(member.user.name);

                          return (
                            <tr key={member.id} className="hover:bg-white/[0.02] transition-colors group">
                              {/* User Info */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  {member.user.avatarUrl ? (
                                    <img
                                      src={member.user.avatarUrl}
                                      alt={member.user.name}
                                      className="w-8 h-8 rounded-full object-cover border border-zinc-700 shadow-sm"
                                    />
                                  ) : (
                                    <div
                                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0"
                                      style={{ backgroundColor: avatarColor }}
                                    >
                                      {getInitials(member.user.name)}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <div className="font-medium text-white flex items-center gap-1.5 truncate">
                                      <span>{member.user.name}</span>
                                      {isMemberOwner && <Crown size={12} className="text-amber-400 shrink-0" />}
                                    </div>
                                    <div className="text-[11px] text-zinc-500 font-mono truncate">
                                      {member.user.email}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Role */}
                              <td className="py-3.5 px-4">
                                <RoleBadge role={member.role} small />
                              </td>

                              {/* Status */}
                              <td className="py-3.5 px-4">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10.5px] font-medium text-emerald-400">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  <span>Active</span>
                                </span>
                              </td>

                              {/* Joined Date */}
                              <td className="py-3.5 px-4 text-zinc-400 font-mono text-[11px]">
                                {formatDate(member.joinedAt)}
                              </td>

                              {/* 3-Dots Action Menu */}
                              <td className="py-3.5 px-4 text-right">
                                <div className="relative inline-block text-left">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMenuMemberId(
                                        activeMenuMemberId === member.id ? null : member.id
                                      );
                                    }}
                                    className={`p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer ${
                                      activeMenuMemberId === member.id ? 'bg-white/[0.1] text-white' : ''
                                    }`}
                                    title="Member actions"
                                  >
                                    <MoreHorizontal size={15} />
                                  </button>

                                  <AnimatePresence>
                                    {activeMenuMemberId === member.id && (
                                      <motion.div
                                        initial={{ opacity: 0, y: 4, scale: 0.96 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 4, scale: 0.96 }}
                                        transition={{ duration: 0.15 }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="absolute right-0 top-full mt-1.5 z-30 w-48 bg-[#14161C] border border-[#27272A] rounded-xl shadow-2xl overflow-hidden py-1.5"
                                      >
                                        {/* Action 1: Change Role (Custom Animated Role Trigger) */}
                                        {isAdminOrOwner && !isMemberOwner && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveMenuMemberId(null);
                                              setMemberToEditRole(member);
                                              setNewSelectedRole(member.role);
                                            }}
                                            className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors flex items-center gap-2 cursor-pointer"
                                          >
                                            <Shield size={13} className="text-indigo-400" />
                                            <span>Change Role</span>
                                          </button>
                                        )}

                                        {/* Action 2: Chat */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveMenuMemberId(null);
                                            setMemberToChat(member);
                                          }}
                                          className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors flex items-center gap-2 cursor-pointer"
                                        >
                                          <MessageSquare size={13} className="text-emerald-400" />
                                          <span>Chat</span>
                                        </button>

                                        {/* Copy email */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveMenuMemberId(null);
                                            navigator.clipboard.writeText(member.user.email);
                                            toast.success('Email copied', member.user.email);
                                          }}
                                          className="w-full px-3 py-2 text-left text-xs text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors flex items-center gap-2 cursor-pointer"
                                        >
                                          <Copy size={13} />
                                          <span>Copy Email</span>
                                        </button>

                                        {/* Action 3: Delete / Remove */}
                                        {isAdminOrOwner && !isMemberOwner && (
                                          <div className="pt-1 mt-1 border-t border-[#27272A]/70">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActiveMenuMemberId(null);
                                                setMemberToRemove(member);
                                              }}
                                              className="w-full px-3 py-2 text-left text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors flex items-center gap-2 cursor-pointer"
                                            >
                                              <Trash2 size={13} />
                                              <span>Delete Member</span>
                                            </button>
                                          </div>
                                        )}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── CARD VIEW (SUPPORTING GROUPING & SORTING) ── */
          <div className="space-y-4">
            {groupedMembers.map((group) => (
              <div key={group.id} className="space-y-3">
                {groupBy !== 'none' && (
                  <div className="flex items-center justify-between py-2 px-3.5 rounded-xl bg-[#111216]/80 border border-[#27272A]/80">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color || accentColor }} />
                      <span className="font-bold text-xs sm:text-sm text-white tracking-tight">{group.title}</span>
                      {group.subtitle && <span className="text-[11px] text-zinc-500 font-mono">({group.subtitle})</span>}
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-[10px] font-mono text-zinc-300 border border-white/[0.08]">
                      {group.items.length} {group.items.length === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {group.items.map((member) => {
                    const isMemberOwner = member.role === 'OWNER';
                    const avatarColor = member.user.avatarColor || getAvatarBg(member.user.name);

                    return (
                      <motion.div
                        key={member.id}
                        whileHover={{ y: -2, transition: { duration: 0.15 } }}
                        className="rounded-2xl bg-[#0E0F14] border border-[#27272A] p-4 hover:border-zinc-500/70 hover:bg-[#12131A] transition-all duration-150 flex flex-col justify-between group shadow-sm relative"
                      >
                        <div className="space-y-3">
                          {/* Top: Avatar + Status + 3-dot Action */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              {member.user.avatarUrl ? (
                                <img
                                  src={member.user.avatarUrl}
                                  alt={member.user.name}
                                  className="w-10 h-10 rounded-full object-cover border border-zinc-700 shadow-sm"
                                />
                              ) : (
                                <div
                                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
                                  style={{ backgroundColor: avatarColor }}
                                >
                                  {getInitials(member.user.name)}
                                </div>
                              )}
                              <div>
                                <RoleBadge role={member.role} small />
                              </div>
                            </div>

                            {/* 3-Dots Action Menu */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuMemberId(
                                    activeMenuMemberId === member.id ? null : member.id
                                  );
                                }}
                                className={`p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer ${
                                  activeMenuMemberId === member.id ? 'bg-white/[0.1] text-white' : ''
                                }`}
                                title="Member actions"
                              >
                                <MoreHorizontal size={15} />
                              </button>

                              <AnimatePresence>
                                {activeMenuMemberId === member.id && (
                                  <motion.div
                                    initial={{ opacity: 0, y: 4, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                                    transition={{ duration: 0.15 }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute right-0 top-full mt-1.5 z-30 w-48 bg-[#14161C] border border-[#27272A] rounded-xl shadow-2xl overflow-hidden py-1.5"
                                  >
                                    {isAdminOrOwner && !isMemberOwner && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveMenuMemberId(null);
                                          setMemberToEditRole(member);
                                          setNewSelectedRole(member.role);
                                        }}
                                        className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors flex items-center gap-2 cursor-pointer"
                                      >
                                        <Shield size={13} className="text-indigo-400" />
                                        <span>Change Role</span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuMemberId(null);
                                        setMemberToChat(member);
                                      }}
                                      className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors flex items-center gap-2 cursor-pointer"
                                    >
                                      <MessageSquare size={13} className="text-emerald-400" />
                                      <span>Chat</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuMemberId(null);
                                        navigator.clipboard.writeText(member.user.email);
                                        toast.success('Email copied', member.user.email);
                                      }}
                                      className="w-full px-3 py-2 text-left text-xs text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors flex items-center gap-2 cursor-pointer"
                                    >
                                      <Copy size={13} />
                                      <span>Copy Email</span>
                                    </button>

                                    {isAdminOrOwner && !isMemberOwner && (
                                      <div className="pt-1 mt-1 border-t border-[#27272A]/70">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveMenuMemberId(null);
                                            setMemberToRemove(member);
                                          }}
                                          className="w-full px-3 py-2 text-left text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors flex items-center gap-2 cursor-pointer"
                                        >
                                          <Trash2 size={13} />
                                          <span>Delete Member</span>
                                        </button>
                                      </div>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>

                          {/* Member Name & Email */}
                          <div>
                            <h3 className="font-bold text-sm text-white truncate flex items-center gap-1.5">
                              <span>{member.user.name}</span>
                              {isMemberOwner && <Crown size={12} className="text-amber-400" />}
                            </h3>
                            <p className="text-[11px] text-zinc-400 font-mono mt-0.5 truncate">
                              {member.user.email}
                            </p>
                          </div>
                        </div>

                        {/* Card Footer: Joined Date + Active Status */}
                        <div className="pt-3 mt-3 border-t border-[#27272A]/70 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                          <span>Joined {formatDate(member.joinedAt)}</span>
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>Active</span>
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )}

          {/* ─── TAB 2: PENDING INVITATIONS ──────────────────────────────────── */}
          {activeTab === 'invitations' && (
            <div>
              {isLoading ? (
                <div className="py-20 rounded-2xl bg-[#0E0F14] border border-[#27272A] text-center space-y-3">
                  <div
                    className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin mx-auto"
                    style={{ borderColor: `${accentColor} transparent ${accentColor} ${accentColor}` }}
                  />
                  <p className="text-xs text-zinc-400 font-mono">Loading invitations...</p>
                </div>
              ) : filteredInvitations.length === 0 ? (
                <div className="py-16 rounded-2xl bg-[#0E0F14] border border-[#27272A] text-center space-y-3 p-6">
                  <div className="w-12 h-12 rounded-full bg-zinc-800/80 flex items-center justify-center mx-auto text-zinc-400">
                    <Mail size={22} />
                  </div>
                  <h3 className="text-sm font-semibold text-white">No pending invitations</h3>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    All invitations have been claimed or expired. Click &quot;Invite Member&quot; to invite a collaborator.
                  </p>
                </div>
              ) : viewMode === 'list' ? (
                /* ── INVITATIONS LIST VIEW ── */
                <div className="rounded-2xl border border-[#27272A] bg-[#0E0F14] overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#27272A] bg-[#111216]/60 text-zinc-400 uppercase tracking-wider font-mono text-[10px]">
                          <th className="py-3 px-4 font-semibold">Invited Email</th>
                          <th className="py-3 px-4 font-semibold">Assigned Role</th>
                          <th className="py-3 px-4 font-semibold">Sent Date</th>
                          <th className="py-3 px-4 font-semibold">Expires</th>
                          {isAdminOrOwner && <th className="py-3 px-4 font-semibold text-right">Action</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#27272A]/40">
                        {filteredInvitations.map((inv) => (
                          <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5 text-white font-medium">
                                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                                  <Mail size={13} />
                                </div>
                                <span className="font-mono text-xs">{inv.invitedEmail}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <RoleBadge role={inv.assignedRole} small />
                            </td>
                            <td className="py-3.5 px-4 text-zinc-400 font-mono text-[11px]">
                              {formatDate(inv.createdAt)}
                            </td>
                            <td className="py-3.5 px-4 text-zinc-400 font-mono text-[11px]">
                              {formatDate(inv.expiresAt)}
                            </td>
                            {isAdminOrOwner && (
                              <td className="py-3.5 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleCancelInvite(inv.id, inv.invitedEmail)}
                                  className="px-2.5 py-1 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors font-medium cursor-pointer"
                                >
                                  Revoke
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* ── INVITATIONS CARD VIEW ── */
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {filteredInvitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="rounded-2xl bg-[#0E0F14] border border-[#27272A] p-4 flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                            <Mail size={15} />
                          </div>
                          <RoleBadge role={inv.assignedRole} small />
                        </div>
                        <div>
                          <p className="text-xs font-mono font-medium text-white truncate">{inv.invitedEmail}</p>
                          <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Sent on {formatDate(inv.createdAt)}</p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#27272A]/70 flex items-center justify-between text-xs">
                        <span className="text-[10.5px] font-mono text-zinc-400">Expires {formatDate(inv.expiresAt)}</span>
                        {isAdminOrOwner && (
                          <button
                            type="button"
                            onClick={() => handleCancelInvite(inv.id, inv.invitedEmail)}
                            className="text-xs text-red-400 hover:underline cursor-pointer"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── TAB 3: MEMBER PROGRESS (WITH BAR GRAPHS) ──────────────────── */}
          {activeTab === 'progress' && (
            <div className="space-y-4">
              {/* Overall Progress Metrics Bar */}
              <div className="rounded-2xl bg-[#0E0F14] border border-[#27272A] p-4 sm:p-5 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#27272A]/70">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={16} style={{ color: accentColor }} />
                    <h3 className="font-bold text-sm text-white">Organization Performance & Velocity</h3>
                  </div>
                  <span className="text-xs font-mono text-zinc-400">
                    Live team completion: <strong className="text-white">{avgCompletionRate}%</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-[#111216] border border-[#27272A]/60 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Avg Completion</span>
                    <p className="text-lg font-bold font-mono text-emerald-400">{avgCompletionRate}%</p>
                    <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${avgCompletionRate}%` }} />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#111216] border border-[#27272A]/60 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Tasks Completed</span>
                    <p className="text-lg font-bold font-mono text-white">
                      {totalCompletedTasks} <span className="text-xs text-zinc-500">/ {totalProgressTasks}</span>
                    </p>
                    <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, Math.round((totalCompletedTasks / Math.max(totalProgressTasks, 1)) * 100))}%`,
                          backgroundColor: accentColor,
                        }}
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#111216] border border-[#27272A]/60 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Active Contributors</span>
                    <p className="text-lg font-bold font-mono text-indigo-400">{filteredMembers.length}</p>
                    <span className="text-[10px] font-mono text-zinc-500">100% active this week</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#111216] border border-[#27272A]/60 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Delivery Velocity</span>
                    <p className="text-lg font-bold font-mono text-amber-400">96.4</p>
                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <span>↑ 12% vs last cycle</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Member Progress: Card or List View with Grouping & Sorting */}
              {sortedMembers.length === 0 ? (
                <div className="py-16 rounded-2xl bg-[#0E0F14] border border-[#27272A] text-center space-y-3 p-6">
                  <div className="w-12 h-12 rounded-full bg-zinc-800/80 flex items-center justify-center mx-auto text-zinc-400">
                    <BarChart2 size={22} />
                  </div>
                  <h3 className="text-sm font-semibold text-white">No progress data available</h3>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    No members match your search or role filters.
                  </p>
                </div>
              ) : viewMode === 'card' ? (
                /* ── PROGRESS CARD / GRID VIEW ── */
                <div className="space-y-4">
                  {groupedProgress.map((group) => (
                    <div key={group.id} className="space-y-3">
                      {groupBy !== 'none' && (
                        <div className="flex items-center justify-between py-2 px-3.5 rounded-xl bg-[#111216]/80 border border-[#27272A]/80">
                          <div className="flex items-center gap-2.5">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color || accentColor }} />
                            <span className="font-bold text-xs sm:text-sm text-white tracking-tight">{group.title}</span>
                            {group.subtitle && <span className="text-[11px] text-zinc-500 font-mono">({group.subtitle})</span>}
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-[10px] font-mono text-zinc-300 border border-white/[0.08]">
                            {group.items.length} {group.items.length === 1 ? 'member' : 'members'}
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                        {group.items.map((item) => {
                          const { member, totalTasks, completedTasks, completionRate, codeReviews, commits, statusLabel, statusColor, weeklyBars, maxBar } = item;
                          const avatarColor = member.user.avatarColor || getAvatarBg(member.user.name);
                          const totalWeeklyPoints = weeklyBars.reduce((a, b) => a + b, 0);

                          return (
                            <motion.div
                              key={`progress-card-${member.id}`}
                              whileHover={{ y: -2 }}
                              className="rounded-2xl bg-[#0E0F14] border border-[#27272A] p-4 sm:p-5 shadow-sm space-y-4 hover:border-zinc-500/60 transition-colors flex flex-col justify-between"
                            >
                              {/* Member Header */}
                              <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#27272A]/60">
                                <div className="flex items-center gap-3 min-w-0">
                                  {member.user.avatarUrl ? (
                                    <img
                                      src={member.user.avatarUrl}
                                      alt={member.user.name}
                                      className="w-10 h-10 rounded-full object-cover border border-zinc-700 shadow-sm shrink-0"
                                    />
                                  ) : (
                                    <div
                                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0"
                                      style={{ backgroundColor: avatarColor }}
                                    >
                                      {getInitials(member.user.name)}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-bold text-sm text-white truncate">{member.user.name}</h4>
                                      <RoleBadge role={member.role} small />
                                    </div>
                                    <span className="text-[11px] font-mono text-zinc-400 truncate block">{member.user.email}</span>
                                  </div>
                                </div>

                                <span
                                  className="px-2.5 py-1 rounded-full text-[10.5px] font-mono font-semibold flex items-center gap-1.5 border shrink-0"
                                  style={{
                                    backgroundColor: `${statusColor}18`,
                                    borderColor: `${statusColor}40`,
                                    color: statusColor,
                                  }}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
                                  <span>{statusLabel}</span>
                                </span>
                              </div>

                              {/* Task Progress Horizontal Bar */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-zinc-400 font-medium">Task Completion</span>
                                  <span className="font-mono font-bold text-white">
                                    {completionRate}% <span className="text-[11px] text-zinc-500 font-normal">({completedTasks}/{totalTasks})</span>
                                  </span>
                                </div>
                                <div className="w-full h-2.5 rounded-full bg-[#181A20] border border-[#27272A] p-0.5 overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${completionRate}%` }}
                                    transition={{ duration: 0.6, ease: 'easeOut' }}
                                    className="h-full rounded-full"
                                    style={{
                                      backgroundColor: completionRate >= 80 ? '#10B981' : accentColor,
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Activity Breakdown Bar */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-zinc-400 font-medium">Activity Distribution</span>
                                  <span className="font-mono text-zinc-400 text-[10.5px]">Tasks · Reviews · Commits</span>
                                </div>
                                <div className="w-full h-2.5 rounded-full bg-[#181A20] border border-[#27272A] overflow-hidden flex">
                                  <div
                                    className="h-full bg-blue-500"
                                    style={{ width: `${(completedTasks / (completedTasks + codeReviews + commits)) * 100}%` }}
                                    title={`${completedTasks} Tasks`}
                                  />
                                  <div
                                    className="h-full bg-purple-500"
                                    style={{ width: `${(codeReviews / (completedTasks + codeReviews + commits)) * 100}%` }}
                                    title={`${codeReviews} Reviews`}
                                  />
                                  <div
                                    className="h-full bg-emerald-400"
                                    style={{ width: `${(commits / (completedTasks + codeReviews + commits)) * 100}%` }}
                                    title={`${commits} Commits`}
                                  />
                                </div>
                              </div>

                              {/* 7-Day Velocity Vertical Chart */}
                              <div className="space-y-1 bg-[#111216] p-2.5 rounded-xl border border-[#27272A]/70">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-zinc-400 font-mono text-[10px] uppercase">7-Day Activity</span>
                                  <span className="text-zinc-400 font-mono font-semibold text-[10px]">
                                    {totalWeeklyPoints} pts
                                  </span>
                                </div>
                                <div className="h-8 flex items-end justify-between gap-1 px-1">
                                  {weeklyBars.map((val, bIdx) => {
                                    const pct = Math.round((val / maxBar) * 100);
                                    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
                                    return (
                                      <div key={bIdx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group/bar">
                                        <div
                                          className="w-full rounded-t transition-all group-hover/bar:brightness-125"
                                          style={{
                                            height: `${Math.max(15, pct)}%`,
                                            backgroundColor: bIdx >= 5 ? '#3F3F46' : accentColor,
                                          }}
                                          title={`${days[bIdx]}: ${val} contributions`}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="flex items-center justify-between text-[8.5px] font-mono text-zinc-500 px-0.5">
                                  <span>M</span>
                                  <span>T</span>
                                  <span>W</span>
                                  <span>T</span>
                                  <span>F</span>
                                  <span>S</span>
                                  <span>S</span>
                                </div>
                              </div>

                              {/* Bottom Activity Chips */}
                              <div className="flex items-center justify-between pt-2 border-t border-[#27272A]/50 text-[10.5px] font-mono text-zinc-400">
                                <span className="flex items-center gap-1 text-blue-400">
                                  <CheckSquare size={11} /> {completedTasks} tasks
                                </span>
                                <span className="flex items-center gap-1 text-purple-400">
                                  <MessageSquare size={11} /> {codeReviews} reviews
                                </span>
                                <span className="flex items-center gap-1 text-emerald-400">
                                  <GitCommit size={11} /> {commits} commits
                                </span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* ── PROGRESS LIST VIEW (FULL-WIDTH COMPACT ROWS) ── */
                <div className="space-y-4">
                  {groupedProgress.map((group) => (
                    <div key={group.id} className="space-y-2.5">
                      {groupBy !== 'none' && (
                        <div className="flex items-center justify-between py-2 px-3.5 rounded-xl bg-[#111216]/80 border border-[#27272A]/80">
                          <div className="flex items-center gap-2.5">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color || accentColor }} />
                            <span className="font-bold text-xs sm:text-sm text-white tracking-tight">{group.title}</span>
                            {group.subtitle && <span className="text-[11px] text-zinc-500 font-mono">({group.subtitle})</span>}
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-[10px] font-mono text-zinc-300 border border-white/[0.08]">
                            {group.items.length} {group.items.length === 1 ? 'member' : 'members'}
                          </span>
                        </div>
                      )}

                      <div className="space-y-3">
                        {group.items.map((item) => {
                          const { member, totalTasks, completedTasks, completionRate, codeReviews, commits, statusLabel, statusColor, weeklyBars, maxBar } = item;
                          const avatarColor = member.user.avatarColor || getAvatarBg(member.user.name);

                          return (
                            <motion.div
                              key={`progress-row-${member.id}`}
                              whileHover={{ y: -1 }}
                              className="rounded-2xl bg-[#0E0F14] border border-[#27272A] p-4 sm:p-5 shadow-sm space-y-4 hover:border-zinc-500/60 transition-colors"
                            >
                              {/* Member Info Row */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#27272A]/60">
                                <div className="flex items-center gap-3">
                                  {member.user.avatarUrl ? (
                                    <img
                                      src={member.user.avatarUrl}
                                      alt={member.user.name}
                                      className="w-10 h-10 rounded-full object-cover border border-zinc-700 shadow-sm"
                                    />
                                  ) : (
                                    <div
                                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
                                      style={{ backgroundColor: avatarColor }}
                                    >
                                      {getInitials(member.user.name)}
                                    </div>
                                  )}
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-bold text-sm text-white">{member.user.name}</h4>
                                      <RoleBadge role={member.role} small />
                                    </div>
                                    <span className="text-[11px] font-mono text-zinc-400">{member.user.email}</span>
                                  </div>
                                </div>

                                {/* Status badge */}
                                <div className="flex items-center gap-2 self-start sm:self-auto">
                                  <span
                                    className="px-2.5 py-1 rounded-full text-[10.5px] font-mono font-semibold flex items-center gap-1.5 border"
                                    style={{
                                      backgroundColor: `${statusColor}18`,
                                      borderColor: `${statusColor}40`,
                                      color: statusColor,
                                    }}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
                                    <span>{statusLabel}</span>
                                  </span>
                                </div>
                              </div>

                              {/* Bar Graphs Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                {/* 1. Main Task Completion Horizontal Bar Graph (5 cols) */}
                                <div className="md:col-span-5 space-y-1.5">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-zinc-400 font-medium">Task Completion</span>
                                    <span className="font-mono font-bold text-white">
                                      {completionRate}% <span className="text-[11px] text-zinc-500 font-normal">({completedTasks}/{totalTasks})</span>
                                    </span>
                                  </div>

                                  {/* Horizontal Progress Bar */}
                                  <div className="w-full h-3 rounded-full bg-[#181A20] border border-[#27272A] p-0.5 overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${completionRate}%` }}
                                      transition={{ duration: 0.6, ease: 'easeOut' }}
                                      className="h-full rounded-full"
                                      style={{
                                        backgroundColor: completionRate >= 80 ? '#10B981' : accentColor,
                                      }}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                                    <span>{completedTasks} completed</span>
                                    <span>{totalTasks - completedTasks} remaining</span>
                                  </div>
                                </div>

                                {/* 2. Activity Breakdown Multi-color Bar (4 cols) */}
                                <div className="md:col-span-4 space-y-1.5">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-zinc-400 font-medium">Activity Distribution</span>
                                    <span className="font-mono text-zinc-400 text-[11px]">Tasks · Reviews · Commits</span>
                                  </div>

                                  {/* Multi-segment Colored Bar */}
                                  <div className="w-full h-3 rounded-full bg-[#181A20] border border-[#27272A] overflow-hidden flex">
                                    <div
                                      className="h-full bg-blue-500"
                                      style={{ width: `${(completedTasks / (completedTasks + codeReviews + commits)) * 100}%` }}
                                      title={`${completedTasks} Tasks`}
                                    />
                                    <div
                                      className="h-full bg-purple-500"
                                      style={{ width: `${(codeReviews / (completedTasks + codeReviews + commits)) * 100}%` }}
                                      title={`${codeReviews} Reviews`}
                                    />
                                    <div
                                      className="h-full bg-emerald-400"
                                      style={{ width: `${(commits / (completedTasks + codeReviews + commits)) * 100}%` }}
                                      title={`${commits} Commits`}
                                    />
                                  </div>

                                  <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-400">
                                    <span className="flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                      <span>{completedTasks} Tasks</span>
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                                      <span>{codeReviews} Reviews</span>
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                                      <span>{commits} Commits</span>
                                    </span>
                                  </div>
                                </div>

                                {/* 3. 7-Day Velocity Vertical Bar Chart (3 cols) */}
                                <div className="md:col-span-3 space-y-1.5 bg-[#111216] p-2.5 rounded-xl border border-[#27272A]/70">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-zinc-400 font-mono text-[10px] uppercase">7-Day Activity</span>
                                    <span className="text-zinc-400 font-mono font-semibold text-[10px]">
                                      {weeklyBars.reduce((a, b) => a + b, 0)} pts
                                    </span>
                                  </div>

                                  {/* Mini Bar Chart */}
                                  <div className="h-9 flex items-end justify-between gap-1 px-1">
                                    {weeklyBars.map((val, bIdx) => {
                                      const pct = Math.round((val / maxBar) * 100);
                                      const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
                                      return (
                                        <div key={bIdx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group/bar">
                                          <div
                                            className="w-full rounded-t transition-all group-hover/bar:brightness-125"
                                            style={{
                                              height: `${Math.max(15, pct)}%`,
                                              backgroundColor: bIdx >= 5 ? '#3F3F46' : accentColor,
                                            }}
                                            title={`${days[bIdx]}: ${val} contributions`}
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500 px-0.5">
                                    <span>M</span>
                                    <span>T</span>
                                    <span>W</span>
                                    <span>T</span>
                                    <span>F</span>
                                    <span>S</span>
                                    <span>S</span>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── RIGHT COLUMN: DETAILS & AUDIT LOG (Sticky 320px / 360px, exact Teams index structure) ──── */}
        <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 lg:sticky lg:top-6 space-y-4">
          {/* Box 1: Organization & Membership Details */}
          <div className="rounded-2xl bg-[#0E0F14] border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-4 text-left">
            {/* Box Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-[#27272A]/80">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: accentColor }}
                />
                <h3 className="font-bold text-sm text-white truncate tracking-tight">Organization Details</h3>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    toast.success('Link copied', 'Organization page URL copied');
                  }}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                  title="Copy link"
                >
                  <Copy size={13} />
                </button>
                <Link
                  to={`/organizations/${targetSlug}/settings`}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                  title="Organization settings"
                >
                  <Settings size={13} />
                </Link>
              </div>
            </div>

            {/* Stats Breakdown */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Total Members:</span>
                <span className="font-mono font-bold text-white">{members.length} active</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Pending Invites:</span>
                <span className="font-mono text-amber-400 font-medium">{invitations.length} pending</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Admins & Owners:</span>
                <span className="font-mono text-zinc-300">
                  {members.filter((m) => m.role === 'OWNER' || m.role === 'ADMIN').length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">System Status:</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Operational
                </span>
              </div>
            </div>

            {/* Seat Allocation Bar Graph */}
            <div className="space-y-1.5 pt-3 border-t border-[#27272A]/70">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 font-medium">Seat Utilization</span>
                <span className="font-mono text-zinc-300 text-[11px]">
                  {members.length} / 50 seats ({Math.round((members.length / 50) * 100)}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#181A20] border border-[#27272A] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.round((members.length / 50) * 100))}%`,
                    backgroundColor: accentColor,
                  }}
                />
              </div>
            </div>

            {/* Role Breakdown Bar */}
            <div className="space-y-1.5 pt-3 border-t border-[#27272A]/70">
              <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 font-mono">
                Role Breakdown
              </p>
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span className="text-amber-400">{members.filter((m) => m.role === 'OWNER').length} Owner</span>
                <span className="text-zinc-600">·</span>
                <span className="text-indigo-400">{members.filter((m) => m.role === 'ADMIN').length} Admin</span>
                <span className="text-zinc-600">·</span>
                <span className="text-emerald-400">{members.filter((m) => m.role === 'MEMBER').length} Member</span>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-400">{members.filter((m) => m.role === 'VIEWER').length} Viewer</span>
              </div>
            </div>
          </div>

          {/* Box 2: Audit Logs (Last 8) */}
          <div className="rounded-2xl bg-[#0E0F14] border border-[#27272A] p-4 sm:p-5 shadow-xl space-y-3.5 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272A]/80">
              <div className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
                <Activity size={13} className="text-blue-400" />
                <span>Audit Logs (Last 8)</span>
              </div>
              <Link
                to={`/organizations/${targetSlug}/activity`}
                className="text-[10.5px] font-mono text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight size={10} />
              </Link>
            </div>

            {last8AuditLogs.length === 0 ? (
              <p className="text-xs text-zinc-500 italic py-3 text-center">No audit logs recorded yet.</p>
            ) : (
              <div className="relative pl-5 space-y-3.5">
                {/* Vertical timeline connecting line */}
                <div className="absolute left-2 top-2 bottom-2 w-[1.5px] bg-[#27272A]" />

                {last8AuditLogs.map((act) => (
                  <div key={act.id} className="relative text-left group">
                    {/* Node Dot */}
                    <div className="absolute -left-5 top-0.5 w-4.5 h-4.5 rounded-full border border-[#27272A] bg-[#12131A] flex items-center justify-center shrink-0 shadow-sm z-10 group-hover:border-zinc-500 transition-colors">
                      {getActivityIcon(act)}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 pl-1">
                      <p className="text-xs text-zinc-200 leading-snug font-medium line-clamp-2">
                        {formatActivityText(act)}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-mono text-zinc-400">
                        <span className="px-1 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60 uppercase text-[8.5px]">
                          {act.resourceType}
                        </span>
                        <span>•</span>
                        <span>{formatRelativeTime(act.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Direct link button to full audit trail */}
            <Link
              to={`/organizations/${targetSlug}/activity`}
              className="w-full py-2 rounded-xl bg-[#111216] hover:bg-[#161820] border border-[#27272A] text-zinc-400 hover:text-white transition-colors flex items-center justify-center gap-1.5 text-xs font-mono font-medium block text-center"
            >
              <span>Full Organization Audit Trail</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>

      {/* ─── 3. MODAL: Send Invitation (Username Search & Custom Select) ──── */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0E0F14] border border-[#27272A] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-left">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-[#0A0B10]"
                  style={{ backgroundColor: accentColor }}
                >
                  <UserPlus size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Invite Member</h3>
                  <p className="text-[11px] text-zinc-400">Search by username or enter an email address</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsInviteModalOpen(false);
                  setSelectedUser(null);
                  setManualEmail('');
                  setAccountSearchQuery('');
                  setInviteError(null);
                }}
                className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-white/[0.05]"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4">
              {/* Field 1: Username / User Search Dropdown (Same as Create Team) */}
              <div ref={accountSelectRef} className="relative z-40">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    Username / Member Account <span className="text-red-400">*</span>
                  </label>
                  {isLoadingUsers && (
                    <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                      <Loader2 size={10} className="animate-spin text-zinc-400" />
                      <span>Loading accounts...</span>
                    </span>
                  )}
                </div>

                {/* Dropdown Trigger */}
                <button
                  type="button"
                  onClick={() => setIsAccountOpen((prev) => !prev)}
                  className={`w-full h-10 flex items-center justify-between gap-2 px-3 bg-[#111216] border rounded-xl text-xs text-left transition-all outline-none cursor-pointer ${
                    isAccountOpen
                      ? 'border-zinc-500 shadow-md ring-1'
                      : 'border-[#27272A] hover:border-zinc-600'
                  }`}
                  style={isAccountOpen ? { borderColor: accentColor } : undefined}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                    {selectedUser ? (
                      <div className="flex items-center gap-2 truncate">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                          style={{ backgroundColor: selectedUser.avatarColor || accentColor }}
                        >
                          {selectedUser.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-white font-medium truncate">{selectedUser.name}</span>
                        <span className="text-[11px] font-mono text-zinc-400 truncate">
                          @{selectedUser.username || selectedUser.email.split('@')[0]}
                        </span>
                      </div>
                    ) : manualEmail ? (
                      <span className="text-zinc-200 font-mono truncate">{manualEmail}</span>
                    ) : (
                      <span className="text-zinc-500 truncate flex items-center gap-2">
                        <Search size={13} className="text-zinc-500 shrink-0" />
                        <span>Search by username or enter email</span>
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

                {/* Dropdown Menu */}
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
                          placeholder="Type username..."
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
                        <div className="overflow-y-auto max-h-44 space-y-1 pr-1 scrollbar-thin">
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
                                  <div
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                                    style={{ backgroundColor: account.avatarColor || '#8B5CF6' }}
                                  >
                                    {account.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-white truncate group-hover:text-[#A78BFA]">
                                      {account.name}
                                    </p>
                                    <p className="text-[10px] font-mono text-zinc-400 truncate">
                                      @{uName} · {account.email}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[9.5px] font-mono text-zinc-500">Select</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : accountSearchQuery ? (
                        <div className="py-2.5 text-center space-y-1">
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
                        <p className="text-zinc-500 text-xs py-3 text-center">Type to search registered users</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Field 2: Role Selection (Custom AnimatedSelect with admin, member, viewer) */}
              <div className="relative z-30">
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Assigned Organization Role
                </label>
                <AnimatedSelect
                  value={inviteRole}
                  onChange={(val) => setInviteRole(val as OrganizationRole)}
                  options={INVITE_ROLE_OPTIONS}
                  placeholder="Select role..."
                  accentColor={accentColor}
                />
              </div>

              {inviteError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{inviteError}</span>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsInviteModalOpen(false);
                    setSelectedUser(null);
                    setManualEmail('');
                    setInviteError(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingInvite || !effectiveEmail}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#0A0B10] shadow-md disabled:opacity-50 transition-all cursor-pointer hover:brightness-110"
                  style={{ backgroundColor: accentColor }}
                >
                  {isSendingInvite ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send size={13} />
                  )}
                  <span>Send Invitation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 4. MODAL: Change Role (Custom AnimatedSelect) ────────────────── */}
      {memberToEditRole && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0E0F14] border border-[#27272A] rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-left animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Change Member Role</h3>
              </div>
              <button
                type="button"
                onClick={() => setMemberToEditRole(null)}
                className="text-zinc-500 hover:text-white p-1 rounded-lg"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-white font-medium">{memberToEditRole.user.name}</p>
              <p className="text-[11px] text-zinc-400 font-mono">{memberToEditRole.user.email}</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Select New Role</label>
              <AnimatedSelect
                value={newSelectedRole}
                onChange={(val) => setNewSelectedRole(val as OrganizationRole)}
                options={EDIT_ROLE_OPTIONS}
                accentColor={accentColor}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMemberToEditRole(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-white hover:bg-white/[0.05]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleChangeRole}
                disabled={isUpdatingRole || newSelectedRole === memberToEditRole.role}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#0A0B10] disabled:opacity-50 shadow-md hover:brightness-110 cursor-pointer"
                style={{ backgroundColor: accentColor }}
              >
                {isUpdatingRole ? 'Saving...' : 'Update Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 5. MODAL: Chat / Quick Message ──────────────────────────────── */}
      {memberToChat && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0E0F14] border border-[#27272A] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-left animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Chat with {memberToChat.user.name}</h3>
                  <p className="text-[11px] font-mono text-zinc-400">{memberToChat.user.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMemberToChat(null)}
                className="text-zinc-500 hover:text-white p-1 rounded-lg"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Direct Message</label>
              <textarea
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder={`Hey ${memberToChat.user.name.split(' ')[0]}, let's discuss...`}
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl bg-[#111216] border border-[#27272A] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <a
                href={`mailto:${memberToChat.user.email}`}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 font-mono hover:underline"
              >
                <Mail size={12} />
                <span>Open in Mail</span>
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMemberToChat(null)}
                  className="px-3.5 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-white hover:bg-white/[0.05]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendChat}
                  disabled={isSendingChat || !chatMessage.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#0A0B10] disabled:opacity-50 shadow-md hover:brightness-110 cursor-pointer"
                  style={{ backgroundColor: accentColor }}
                >
                  {isSendingChat ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  <span>Send Message</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 6. MODAL: Remove Member Confirmation ─────────────────────────── */}
      {memberToRemove && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0E0F14] border border-red-500/30 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto border border-red-500/20 shadow-sm">
              <ShieldAlert size={22} />
            </div>
            <h3 className="text-base font-bold text-white tracking-tight">Remove Member?</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Are you sure you want to remove <strong className="text-white">{memberToRemove.user.name}</strong> from this organization? They will immediately lose access to all internal teams, projects, and notes.
            </p>

            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setMemberToRemove(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                disabled={isRemoving}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors shadow-md disabled:opacity-50 cursor-pointer"
              >
                {isRemoving ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationMembersView;
