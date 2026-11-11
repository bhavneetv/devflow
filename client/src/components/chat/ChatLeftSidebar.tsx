import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hash,
  Users,
  Search,
  MessageSquare,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Building2,
  FolderKanban,
  Plus,
  X,
  Megaphone,
  Code2,
  Palette,
  CheckCircle2,
  Coffee,
  Globe,
  Radio,
  Rocket,
  Flame,
  HelpCircle,
  Shield,
  Layers,
  LucideIcon,
  Check,
  User as UserIcon,
  CircleDot,
} from 'lucide-react';
import { useChat, ChatCategory } from '../../context/ChatContext';
import { useOrganization } from '../../context/OrganizationContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import { teamService } from '../../services/team.service';
import { useToast } from '../../context/ToastContext';
import { UserAvatar } from '../common/UserAvatar';
import { FloatingTooltip } from '../common/FloatingTooltip';
import { AVATAR_ICON_COMPONENTS } from '../onboarding/StepProfile';
import { cn } from '../../lib/utils';
import type { TeamConversation, TeamMember, TeamSummary } from '../../types/team';

export interface ChatTargetUser {
  userId: number;
  name: string;
  username?: string;
  email?: string;
  avatarColor?: string;
  avatarType?: string | null;
  avatarId?: string | null;
  avatarUrl?: string | null;
  role?: string;
}

interface ChatLeftSidebarProps {
  conversations: TeamConversation[];
  activeConvId?: number;
  onSelectConversation: (conv: TeamConversation) => void;
  teamMembers: TeamMember[];
  currentUserId?: number;
  onSelectMember: (user: ChatTargetUser) => void;
  onCloseLeftMenu?: () => void;
  isLoading?: boolean;
}

const TOPIC_ICON_OPTIONS: Array<{ key: string; label: string; icon: LucideIcon }> = [
  { key: 'hash', label: 'General', icon: Hash },
  { key: 'announce', label: 'Announcements', icon: Megaphone },
  { key: 'dev', label: 'Development', icon: Code2 },
  { key: 'design', label: 'Design', icon: Palette },
  { key: 'rocket', label: 'Releases', icon: Rocket },
  { key: 'flame', label: 'Hot Topics', icon: Flame },
  { key: 'coffee', label: 'Watercooler', icon: Coffee },
  { key: 'help', label: 'Q&A', icon: HelpCircle },
];

export const ChatLeftSidebar: React.FC<ChatLeftSidebarProps> = ({
  conversations,
  activeConvId,
  onSelectConversation,
  teamMembers,
  currentUserId,
  onSelectMember,
  onCloseLeftMenu,
  isLoading = false,
}) => {
  const {
    chatCategory,
    setChatCategory,
    orgTeam,
    squadTeams,
    teams,
    projects,
    orgMembers,
    activeTeam,
    setActiveTeam,
    activeProjectChat,
    setActiveProjectChat,
  } = useChat();

  const { currentOrganization } = useOrganization();
  const { accentColor } = useAccentTheme();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicIcon, setNewTopicIcon] = useState('hash');
  const [isSubmittingTopic, setIsSubmittingTopic] = useState(false);

  // Active category normalized
  const effectiveCategory = chatCategory === 'team' ? 'teams' : chatCategory;

  // Resolve topic icon component
  const resolveTopicIcon = (iconKey?: string | null, name: string = '') => {
    if (iconKey) {
      const match = TOPIC_ICON_OPTIONS.find((t) => t.key === iconKey);
      if (match) {
        const IconComp = match.icon;
        return <IconComp size={13} className="shrink-0" />;
      }
    }
    const lower = name.toLowerCase();
    if (lower.includes('announce')) return <Megaphone size={13} className="text-amber-400 shrink-0" />;
    if (lower.includes('dev') || lower.includes('code')) return <Code2 size={13} className="text-blue-400 shrink-0" />;
    if (lower.includes('design') || lower.includes('ui')) return <Palette size={13} className="text-pink-400 shrink-0" />;
    if (lower.includes('test') || lower.includes('qa')) return <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />;
    if (lower.includes('release')) return <Rocket size={13} className="text-indigo-400 shrink-0" />;
    if (lower.includes('random') || lower.includes('coffee')) return <Coffee size={13} className="text-teal-400 shrink-0" />;
    return <Hash size={13} className="shrink-0 text-zinc-400" />;
  };

  // Helper to render Team avatar with icon and color
  const renderTeamAvatar = (team: TeamSummary) => {
    const teamColor = team.color || accentColor;
    const initials = team.name.slice(0, 2).toUpperCase();
    const avatarIcon = (team as any).avatarIcon || (team as any).icon;
    const IconComp = avatarIcon && AVATAR_ICON_COMPONENTS[avatarIcon];

    return (
      <div
        className="w-5 h-5 rounded-md flex items-center justify-center text-white shrink-0 shadow-xs overflow-hidden"
        style={{ backgroundColor: teamColor }}
      >
        {IconComp ? (
          <IconComp size={11} className="text-white" />
        ) : (
          <span className="text-[9px] font-mono font-bold leading-none uppercase">{initials}</span>
        )}
      </div>
    );
  };

  // Helper to render Project avatar with icon and color
  const renderProjectAvatar = (proj: any) => {
    const pColor = proj.avatarColor || proj.color || accentColor;
    const avatarIcon = proj.avatarIcon || proj.icon;
    const hasIcon = avatarIcon && AVATAR_ICON_COMPONENTS[avatarIcon];
    const IconComp = hasIcon ? AVATAR_ICON_COMPONENTS[avatarIcon] : FolderKanban;
    const initials =
      proj.key?.slice(0, 2) ||
      proj.identifier?.slice(0, 2) ||
      proj.title?.slice(0, 2).toUpperCase() ||
      proj.name?.slice(0, 2).toUpperCase() ||
      'PR';

    return (
      <div
        className="w-5 h-5 rounded-md flex items-center justify-center text-white shrink-0 shadow-xs overflow-hidden"
        style={{ backgroundColor: pColor }}
      >
        {avatarIcon && avatarIcon !== 'initials' && hasIcon ? (
          <IconComp size={11} className="text-white" />
        ) : avatarIcon === 'initials' ? (
          <span className="text-[8.5px] font-mono font-bold leading-none tracking-tighter uppercase text-white">
            {initials}
          </span>
        ) : (
          <IconComp size={11} className="text-white" />
        )}
      </div>
    );
  };

  // Group channels and direct conversations
  const groupChannels = useMemo(() => {
    return conversations.filter((c) => c.type === 'GROUP');
  }, [conversations]);

  const directConvs = useMemo(() => {
    return conversations.filter((c) => c.type === 'DIRECT');
  }, [conversations]);

  // Filter group channels based on search
  const filteredChannels = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return groupChannels;
    return groupChannels.filter((c) => (c.name || '').toLowerCase().includes(q));
  }, [groupChannels, searchQuery]);

  // Filter teams based on search
  const filteredTeams = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const list = squadTeams.length > 0 ? squadTeams : teams;
    if (!q) return list;
    return list.filter((t) => t.name.toLowerCase().includes(q));
  }, [squadTeams, teams, searchQuery]);

  // Filter projects based on search
  const filteredProjects = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        (p.title || p.name || '').toLowerCase().includes(q) ||
        (p.key || p.identifier || '').toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  // Filter members: for Team mode (joined members only), Project mode (assigned members), or 1:1 (all org members)
  const filteredMembers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    let sourceList: ChatTargetUser[] = [];

    if (effectiveCategory === 'teams') {
      // ONLY members joined in that selected team
      sourceList = (teamMembers || []).map((tm) => ({
        userId: tm.userId,
        name: tm.user?.name || 'Member',
        username: tm.user && 'username' in tm.user ? (tm.user as any).username : '',
        email: tm.user?.email || '',
        avatarColor: tm.user?.avatarColor || '#3B82F6',
        avatarType: tm.user?.avatarType || 'initials',
        avatarId: tm.user?.avatarId || null,
        avatarUrl: tm.user?.avatarUrl || null,
        role: tm.role || 'MEMBER',
      }));
    } else if (effectiveCategory === 'project') {
      // ONLY members joined/assigned in selected project
      const projMembers = activeProjectChat?.members || [];
      if (projMembers.length > 0) {
        sourceList = projMembers.map((pm: any) => ({
          userId: pm.user?.id || pm.userId,
          name: pm.user?.name || 'Member',
          username: pm.user?.username || '',
          email: pm.user?.email || '',
          avatarColor: pm.user?.avatarColor || '#10B981',
          avatarType: pm.user?.avatarType || 'initials',
          avatarId: pm.user?.avatarId || null,
          avatarUrl: pm.user?.avatarUrl || null,
          role: pm.role || 'COLLABORATOR',
        }));
      } else {
        // Fallback to team members if project has teamId
        sourceList = (teamMembers || []).map((tm) => ({
          userId: tm.userId,
          name: tm.user?.name || 'Member',
          username: tm.user && 'username' in tm.user ? (tm.user as any).username : '',
          email: tm.user?.email || '',
          avatarColor: tm.user?.avatarColor || '#10B981',
          avatarType: tm.user?.avatarType || 'initials',
          avatarId: tm.user?.avatarId || null,
          avatarUrl: tm.user?.avatarUrl || null,
          role: tm.role || 'COLLABORATOR',
        }));
      }
    } else {
      // All organization members for One to One and Org mode
      sourceList = (orgMembers && orgMembers.length > 0 ? orgMembers : []).map((om) => ({
        userId: om.user?.id || om.userId,
        name: om.user?.name || 'Member',
        username: om.user && 'username' in om.user ? (om.user as any).username : '',
        email: om.user?.email || '',
        avatarColor: om.user?.avatarColor || '#8B5CF6',
        avatarType: (om.user as any)?.avatarType || 'initials',
        avatarId: (om.user as any)?.avatarId || null,
        avatarUrl: om.user?.avatarUrl || null,
        role: om.role || 'MEMBER',
      }));
    }

    return sourceList.filter((m) => {
      if (m.userId === currentUserId && effectiveCategory === 'direct') return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        (m.username ? m.username.toLowerCase().includes(q) : false) ||
        (m.email ? m.email.toLowerCase().includes(q) : false)
      );
    });
  }, [effectiveCategory, teamMembers, activeProjectChat, orgMembers, currentUserId, searchQuery]);

  // Handle create new topic / channel
  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;

    const targetTeamId =
      effectiveCategory === 'org'
        ? orgTeam?.id || activeTeam?.id
        : activeTeam?.id || orgTeam?.id;

    if (!targetTeamId) {
      toast.error('Cannot create topic', 'No active workspace team available.');
      return;
    }

    try {
      setIsSubmittingTopic(true);
      const res = await teamService.createConversation(targetTeamId, {
        name: newTopicName.trim(),
        icon: newTopicIcon,
      });

      if (res.success && res.data) {
        toast.success(`Topic #${res.data.name} created!`);
        onSelectConversation(res.data);
        setIsCreatingTopic(false);
        setNewTopicName('');
        setNewTopicIcon('hash');
      } else {
        toast.error('Failed to create topic', res.error || 'Server error');
      }
    } catch (err: any) {
      toast.error('Failed to create topic', err.message);
    } finally {
      setIsSubmittingTopic(false);
    }
  };

  return (
    <div className="w-[260px] sm:w-[280px] h-full bg-zinc-950 flex flex-col select-none shrink-0 overflow-hidden">
      {/* ── Search Input (In all 4 cases) ── */}
      <div className="h-[54px] px-2.5 border-b border-zinc-800/80 flex items-center shrink-0">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-2.5 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              effectiveCategory === 'org'
                ? 'Search org topics...'
                : effectiveCategory === 'teams'
                ? 'Search teams, topics, members...'
                : effectiveCategory === 'project'
                ? 'Search projects, topics...'
                : 'Search members...'
            }
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none transition-colors"
            style={{
              borderColor: searchQuery ? `${accentColor}80` : undefined,
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 text-zinc-500 hover:text-white p-0.5 rounded cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ── Scrollable Body Area ── */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-3">
        {isLoading ? (
          /* Shimmer Skeleton Loading for Left Sidebar */
          <div className="space-y-3 p-1 animate-pulse">
            <div className="h-2.5 w-20 rounded bg-zinc-800/80 mb-2" />
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                <div className="w-5 h-5 rounded-md bg-zinc-800/80 shrink-0" />
                <div className="flex-1 space-y-1">
                  <div
                    className="h-3 rounded bg-zinc-800/70"
                    style={{ width: `${Math.max(45, (i * 37) % 85)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* ── 1. ORG GROUPS (TOPICS) MODE ── */}
            {effectiveCategory === 'org' && (
          <div className="space-y-2">
            {/* Header with Title and "+" button to create topic */}
            <div className="flex items-center justify-between px-1.5 pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Building2 size={12} style={{ color: accentColor }} />
                <span>Org Topics</span>
              </span>

              <FloatingTooltip content="Create new topic" side="bottom">
                <button
                  type="button"
                  onClick={() => setIsCreatingTopic((prev) => !prev)}
                  className="w-5 h-5 rounded flex items-center justify-center hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  style={{
                    color: isCreatingTopic ? accentColor : undefined,
                  }}
                >
                  <Plus size={14} />
                </button>
              </FloatingTooltip>
            </div>

            {/* Create Topic Inline Card */}
            <AnimatePresence>
              {isCreatingTopic && (
                <motion.form
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleCreateTopic}
                  className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2"
                >
                  <div className="text-[11px] font-bold text-white flex items-center justify-between">
                    <span>New Org Topic</span>
                    <button
                      type="button"
                      onClick={() => setIsCreatingTopic(false)}
                      className="text-zinc-500 hover:text-zinc-300"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  <div>
                    <input
                      type="text"
                      value={newTopicName}
                      onChange={(e) => setNewTopicName(e.target.value)}
                      placeholder="e.g. general, announcements"
                      autoFocus
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none"
                    />
                  </div>

                  {/* Icon Selector */}
                  <div>
                    <div className="text-[10px] text-zinc-400 mb-1">Choose Icon:</div>
                    <div className="grid grid-cols-4 gap-1">
                      {TOPIC_ICON_OPTIONS.map((item) => {
                        const Icon = item.icon;
                        const isSelected = newTopicIcon === item.key;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => setNewTopicIcon(item.key)}
                            className={cn(
                              'p-1.5 rounded-lg flex items-center justify-center text-xs transition-all cursor-pointer',
                              isSelected
                                ? 'bg-zinc-800 text-white shadow-xs'
                                : 'bg-zinc-950/60 text-zinc-400 hover:text-zinc-200'
                            )}
                            style={{
                              borderColor: isSelected ? accentColor : undefined,
                              borderWidth: isSelected ? 1 : 0,
                            }}
                          >
                            <Icon size={14} style={{ color: isSelected ? accentColor : undefined }} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsCreatingTopic(false)}
                      className="px-2 py-1 text-[11px] text-zinc-400 hover:text-white rounded"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newTopicName.trim() || isSubmittingTopic}
                      className="px-2.5 py-1 text-[11px] font-semibold text-white rounded-lg transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                      style={{ backgroundColor: accentColor }}
                    >
                      {isSubmittingTopic ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Topics List */}
            <div className="space-y-0.5">
              {filteredChannels.length === 0 ? (
                <div className="py-4 text-center text-xs text-zinc-500">
                  {searchQuery ? `No topics matching "${searchQuery}"` : 'No topics yet.'}
                </div>
              ) : (
                filteredChannels.map((channel) => {
                  const isActive = activeConvId === channel.id;
                  return (
                    <button
                      key={channel.id}
                      onClick={() => onSelectConversation(channel)}
                      className={cn(
                        'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer group text-left border',
                        isActive
                          ? 'font-semibold'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border-transparent'
                      )}
                      style={{
                        backgroundColor: isActive ? `${accentColor}18` : undefined,
                        borderColor: isActive ? `${accentColor}40` : undefined,
                        color: isActive ? accentColor : undefined,
                      }}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {resolveTopicIcon(channel.icon, channel.name)}
                        <span className="truncate">#{channel.name?.toLowerCase() || 'general'}</span>
                      </div>

                      {channel.unreadCount > 0 && (
                        <span
                          className="px-1.5 py-0.2 rounded-full text-[10px] font-bold text-white shrink-0 shadow-xs"
                          style={{ backgroundColor: accentColor }}
                        >
                          {channel.unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── 2. TEAMS MODE ── */}
        {effectiveCategory === 'teams' && (
          <div className="space-y-3">
            {/* Teams Selector / List */}
            <div className="space-y-1">
              <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Teams ({filteredTeams.length})
              </div>
              <div className="space-y-0.5">
                {filteredTeams.map((team) => {
                  const isSelected = activeTeam?.id === team.id;
                  return (
                    <button
                      key={team.id}
                      onClick={() => setActiveTeam(team)}
                      className={cn(
                        'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border text-left',
                        isSelected
                          ? 'font-semibold'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border-transparent'
                      )}
                      style={{
                        backgroundColor: isSelected ? `${accentColor}18` : undefined,
                        borderColor: isSelected ? `${accentColor}40` : undefined,
                        color: isSelected ? accentColor : undefined,
                      }}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {renderTeamAvatar(team)}
                        <span className="truncate">{team.name}</span>
                      </div>
                      <ChevronRight size={12} className={isSelected ? 'opacity-100' : 'opacity-40'} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Team: Topics & Joined Members */}
            {activeTeam && (
              <div className="pt-2 border-t border-zinc-800/80 space-y-3">
                {/* Team Topics Section */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      {activeTeam.name} Topics
                    </span>
                    <FloatingTooltip content="Add topic to this team" side="bottom">
                      <button
                        type="button"
                        onClick={() => setIsCreatingTopic((prev) => !prev)}
                        className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
                      >
                        <Plus size={13} />
                      </button>
                    </FloatingTooltip>
                  </div>

                  {/* Create Topic Inline Form */}
                  <AnimatePresence>
                    {isCreatingTopic && (
                      <motion.form
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        onSubmit={handleCreateTopic}
                        className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2 mb-1"
                      >
                        <input
                          type="text"
                          value={newTopicName}
                          onChange={(e) => setNewTopicName(e.target.value)}
                          placeholder="Topic name..."
                          autoFocus
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white"
                        />
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setIsCreatingTopic(false)}
                            className="px-2 py-0.5 text-[10px] text-zinc-400"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={!newTopicName.trim()}
                            className="px-2 py-0.5 text-[10px] font-semibold text-white rounded"
                            style={{ backgroundColor: accentColor }}
                          >
                            Add
                          </button>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>

                  {/* Topics List */}
                  <div className="space-y-0.5">
                    {filteredChannels.map((channel) => {
                      const isActive = activeConvId === channel.id;
                      return (
                        <button
                          key={channel.id}
                          onClick={() => onSelectConversation(channel)}
                          className={cn(
                            'w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-all cursor-pointer border text-left',
                            isActive
                              ? 'font-semibold'
                              : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border-transparent'
                          )}
                          style={{
                            backgroundColor: isActive ? `${accentColor}18` : undefined,
                            borderColor: isActive ? `${accentColor}40` : undefined,
                            color: isActive ? accentColor : undefined,
                          }}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {resolveTopicIcon(channel.icon, channel.name)}
                            <span className="truncate">#{channel.name?.toLowerCase() || 'general'}</span>
                          </div>
                          {channel.unreadCount > 0 && (
                            <span
                              className="px-1.5 py-0.2 rounded-full text-[10px] font-bold text-white shrink-0"
                              style={{ backgroundColor: accentColor }}
                            >
                              {channel.unreadCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Team Joined Members Only Section */}
                <div className="space-y-1 pt-1">
                  <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Team Members ({filteredMembers.length})
                  </div>
                  <div className="space-y-0.5">
                    {filteredMembers.length === 0 ? (
                      <div className="py-2 text-center text-[11px] text-zinc-500">
                        No team members joined.
                      </div>
                    ) : (
                      filteredMembers.map((member) => (
                        <button
                          key={member.userId}
                          onClick={() => onSelectMember(member)}
                          className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-all cursor-pointer group text-left"
                        >
                          <div className="flex items-center gap-2 truncate min-w-0">
                            <UserAvatar
                              user={member}
                              name={member.name}
                              avatarColor={member.avatarColor}
                              size="xs"
                              rounded="md"
                            />
                            <span className="truncate text-zinc-300 group-hover:text-white">
                              {member.name}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400 capitalize truncate max-w-[70px]">
                            {member.role ? member.role.toLowerCase().replace('_', ' ') : 'Member'}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 3. PROJECTS MODE ── */}
        {effectiveCategory === 'project' && (
          <div className="space-y-3">
            {/* Projects Selector / List */}
            <div className="space-y-1">
              <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Projects ({filteredProjects.length})
              </div>
              <div className="space-y-0.5">
                {filteredProjects.map((proj) => {
                  const isSelected = activeProjectChat?.id === proj.id;
                  return (
                    <button
                      key={proj.id}
                      onClick={() => setActiveProjectChat(proj)}
                      className={cn(
                        'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border text-left',
                        isSelected
                          ? 'font-semibold'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border-transparent'
                      )}
                      style={{
                        backgroundColor: isSelected ? `${accentColor}18` : undefined,
                        borderColor: isSelected ? `${accentColor}40` : undefined,
                        color: isSelected ? accentColor : undefined,
                      }}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {renderProjectAvatar(proj)}
                        <span className="truncate">{proj.title || proj.name}</span>
                      </div>
                      <ChevronRight size={12} className={isSelected ? 'opacity-100' : 'opacity-40'} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Project: Topics & Assigned Members */}
            {activeProjectChat && (
              <div className="pt-2 border-t border-zinc-800/80 space-y-3">
                {/* Project Topics */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      {activeProjectChat.title || activeProjectChat.name} Topics
                    </span>
                    <FloatingTooltip content="Add topic to this project" side="bottom">
                      <button
                        type="button"
                        onClick={() => setIsCreatingTopic((prev) => !prev)}
                        className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
                      >
                        <Plus size={13} />
                      </button>
                    </FloatingTooltip>
                  </div>

                  {/* Create Topic Inline Form */}
                  <AnimatePresence>
                    {isCreatingTopic && (
                      <motion.form
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        onSubmit={handleCreateTopic}
                        className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2 mb-1"
                      >
                        <input
                          type="text"
                          value={newTopicName}
                          onChange={(e) => setNewTopicName(e.target.value)}
                          placeholder="Project topic..."
                          autoFocus
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white"
                        />
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setIsCreatingTopic(false)}
                            className="px-2 py-0.5 text-[10px] text-zinc-400"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={!newTopicName.trim()}
                            className="px-2 py-0.5 text-[10px] font-semibold text-white rounded"
                            style={{ backgroundColor: accentColor }}
                          >
                            Add
                          </button>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>

                  {/* Topics List */}
                  <div className="space-y-0.5">
                    {filteredChannels.map((channel) => {
                      const isActive = activeConvId === channel.id;
                      return (
                        <button
                          key={channel.id}
                          onClick={() => onSelectConversation(channel)}
                          className={cn(
                            'w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-all cursor-pointer border text-left',
                            isActive
                              ? 'font-semibold'
                              : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border-transparent'
                          )}
                          style={{
                            backgroundColor: isActive ? `${accentColor}18` : undefined,
                            borderColor: isActive ? `${accentColor}40` : undefined,
                            color: isActive ? accentColor : undefined,
                          }}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {resolveTopicIcon(channel.icon, channel.name)}
                            <span className="truncate">#{channel.name?.toLowerCase() || 'general'}</span>
                          </div>
                          {channel.unreadCount > 0 && (
                            <span
                              className="px-1.5 py-0.2 rounded-full text-[10px] font-bold text-white shrink-0"
                              style={{ backgroundColor: accentColor }}
                            >
                              {channel.unreadCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Project Assigned Members Only */}
                <div className="space-y-1 pt-1">
                  <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Project Members ({filteredMembers.length})
                  </div>
                  <div className="space-y-0.5">
                    {filteredMembers.length === 0 ? (
                      <div className="py-2 text-center text-[11px] text-zinc-500">
                        No members assigned yet.
                      </div>
                    ) : (
                      filteredMembers.map((member) => (
                        <button
                          key={member.userId}
                          onClick={() => onSelectMember(member)}
                          className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-all cursor-pointer group text-left"
                        >
                          <div className="flex items-center gap-2 truncate min-w-0">
                            <UserAvatar
                              user={member}
                              name={member.name}
                              avatarColor={member.avatarColor}
                              size="xs"
                              rounded="md"
                            />
                            <span className="truncate text-zinc-300 group-hover:text-white">
                              {member.name}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400 capitalize truncate max-w-[70px]">
                            {member.role ? member.role.toLowerCase().replace('_', ' ') : 'Member'}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 4. ONE TO ONE DIRECT CHAT MODE ── */}
        {effectiveCategory === 'direct' && (
          <div className="space-y-3">
            {/* Recent Direct Conversations */}
            {directConvs.length > 0 && (
              <div className="space-y-1">
                <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Recent Direct ({directConvs.length})
                </div>
                <div className="space-y-0.5">
                  {directConvs.map((conv) => {
                    const isActive = activeConvId === conv.id;
                    const name = conv.otherUser?.name || conv.name || 'Direct Message';
                    const initials = name.slice(0, 2).toUpperCase();
                    const avatarColor = conv.otherUser?.avatarColor || accentColor;

                    return (
                      <button
                        key={conv.id}
                        onClick={() => onSelectConversation(conv)}
                        className={cn(
                          'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer border text-left',
                          isActive
                            ? 'font-semibold'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border-transparent'
                        )}
                        style={{
                          backgroundColor: isActive ? `${accentColor}18` : undefined,
                          borderColor: isActive ? `${accentColor}40` : undefined,
                          color: isActive ? accentColor : undefined,
                        }}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <UserAvatar
                            user={conv.otherUser}
                            name={name}
                            avatarColor={avatarColor}
                            size="xs"
                            rounded="md"
                          />
                          <span className="truncate text-zinc-200">{name}</span>
                        </div>
                        {conv.unreadCount > 0 && (
                          <span
                            className="px-1.5 py-0.2 rounded-full text-[10px] font-bold text-white shrink-0"
                            style={{ backgroundColor: accentColor }}
                          >
                            {conv.unreadCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* All Members Directory with Search */}
            <div className="space-y-1">
              <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                All Members ({filteredMembers.length})
              </div>
              <div className="space-y-0.5">
                {filteredMembers.length === 0 ? (
                  <div className="py-4 text-center text-xs text-zinc-500">
                    No members found.
                  </div>
                ) : (
                  filteredMembers.map((member) => (
                    <button
                      key={member.userId}
                      onClick={() => onSelectMember(member)}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-all cursor-pointer group text-left"
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <UserAvatar
                          user={member}
                          name={member.name}
                          avatarColor={member.avatarColor}
                          size="xs"
                          rounded="md"
                        />
                        <div className="truncate min-w-0">
                          <div className="truncate font-medium text-zinc-200 group-hover:text-white">
                            {member.name}
                          </div>
                          <div className="text-[10px] text-zinc-500 truncate capitalize">
                            {member.role ? member.role.toLowerCase().replace('_', ' ') : 'Member'}
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-300 shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
};

