import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hash,
  Users,
  Search,
  MessageSquare,
  Sparkles,
  ChevronRight,
  Shield,
  Crown,
  Check,
  Building2,
  Code2,
  Palette,
  CheckCircle2,
  Megaphone,
  Coffee,
  Globe,
  Radio,
} from 'lucide-react';
import { useChat, ChatCategory } from '../../context/ChatContext';
import { useOrganization } from '../../context/OrganizationContext';
import type { TeamConversation, TeamMember, TeamSummary } from '../../types/team';
import type { OrganizationMember } from '../../types/organization';

export interface ChatTargetUser {
  userId: number;
  name: string;
  username?: string;
  email?: string;
  avatarColor?: string;
  role?: string;
}

interface ChatConversationSwitcherProps {
  conversations: TeamConversation[];
  activeConvId?: number;
  onSelectConversation: (conv: TeamConversation) => void;
  teamMembers: TeamMember[];
  currentUserId?: number;
  onSelectMember: (user: ChatTargetUser) => void;
  teamName: string;
}

export const ChatConversationSwitcher: React.FC<ChatConversationSwitcherProps> = ({
  conversations,
  activeConvId,
  onSelectConversation,
  teamMembers,
  currentUserId,
  onSelectMember,
  teamName,
}) => {
  const {
    chatCategory,
    setChatCategory,
    orgTeam,
    squadTeams,
    orgMembers,
    activeTeam,
    setActiveTeam,
  } = useChat();

  const { currentOrganization } = useOrganization();
  const [searchQuery, setSearchQuery] = useState('');

  // Get channel icon by channel name
  const getChannelIcon = (name: string = '') => {
    const lower = name.toLowerCase();
    if (lower.includes('announce')) return <Megaphone size={13} className="text-amber-400 shrink-0" />;
    if (lower.includes('dev')) return <Code2 size={13} className="text-blue-400 shrink-0" />;
    if (lower.includes('design')) return <Palette size={13} className="text-pink-400 shrink-0" />;
    if (lower.includes('test')) return <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />;
    if (lower.includes('all-hands')) return <Globe size={13} className="text-indigo-400 shrink-0" />;
    if (lower.includes('random')) return <Coffee size={13} className="text-teal-400 shrink-0" />;
    return <Hash size={13} className="text-purple-400 shrink-0" />;
  };

  // Group channels and direct conversations
  const channels = useMemo(() => {
    return conversations.filter((c) => c.type === 'GROUP');
  }, [conversations]);

  const directConvs = useMemo(() => {
    return conversations.filter((c) => c.type === 'DIRECT');
  }, [conversations]);

  // Filter channels based on search query
  const filteredChannels = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return channels;
    return channels.filter((c) => (c.name || '').toLowerCase().includes(q));
  }, [channels, searchQuery]);

  // Filter organization members for One to One chat
  const filteredOrgMembers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    // Fallback to team members if orgMembers not yet loaded
    const sourceList: ChatTargetUser[] = orgMembers && orgMembers.length > 0
      ? orgMembers.map((om) => ({
          userId: om.user?.id || om.userId,
          name: om.user?.name || 'Member',
          username: om.user && 'username' in om.user ? (om.user as any).username : '',
          email: om.user?.email || '',
          avatarColor: om.user?.avatarColor || '#8B5CF6',
          role: om.role || 'MEMBER',
        }))
      : teamMembers.map((tm) => ({
          userId: tm.userId,
          name: tm.user?.name || 'Member',
          username: tm.user && 'username' in tm.user ? (tm.user as any).username : '',
          email: tm.user?.email || '',
          avatarColor: tm.user?.avatarColor || '#8B5CF6',
          role: tm.role || 'MEMBER',
        }));

    return sourceList.filter((m) => {
      if (m.userId === currentUserId) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        (m.username ? m.username.toLowerCase().includes(q) : false) ||
        (m.email ? m.email.toLowerCase().includes(q) : false) ||
        (m.role ? m.role.toLowerCase().includes(q) : false)
      );
    });
  }, [orgMembers, teamMembers, currentUserId, searchQuery]);

  const orgName = currentOrganization?.name || 'DevFlow Organisation';

  return (
    <div className="bg-zinc-950 border-b border-zinc-800/90 p-3 space-y-3 select-none max-h-[420px] overflow-y-auto no-scrollbar shadow-inner">
      {/* ── 3 Main Chat Category Tabs ── */}
      <div className="flex items-center gap-1 p-1 bg-zinc-900/90 rounded-xl border border-zinc-800/80 text-[11px] font-semibold text-zinc-400">
        <button
          type="button"
          onClick={() => {
            setChatCategory('org');
            if (orgTeam) setActiveTeam(orgTeam);
          }}
          className={`relative flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
            chatCategory === 'org'
              ? 'text-white font-bold'
              : 'hover:text-zinc-200 hover:bg-white/[0.03]'
          }`}
        >
          {chatCategory === 'org' && (
            <motion.div
              layoutId="active-chat-category-pill"
              className="absolute inset-0 bg-purple-600/30 border border-purple-500/50 rounded-lg shadow-sm"
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            />
          )}
          <Building2 size={12} className={chatCategory === 'org' ? 'text-purple-400 relative z-10' : 'text-zinc-400'} />
          <span className="relative z-10 truncate">Organisation</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setChatCategory('team');
            if (squadTeams.length > 0 && (!activeTeam || activeTeam.name.includes('(Organisation)'))) {
              setActiveTeam(squadTeams[0]);
            }
          }}
          className={`relative flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
            chatCategory === 'team'
              ? 'text-white font-bold'
              : 'hover:text-zinc-200 hover:bg-white/[0.03]'
          }`}
        >
          {chatCategory === 'team' && (
            <motion.div
              layoutId="active-chat-category-pill"
              className="absolute inset-0 bg-purple-600/30 border border-purple-500/50 rounded-lg shadow-sm"
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            />
          )}
          <Users size={12} className={chatCategory === 'team' ? 'text-purple-400 relative z-10' : 'text-zinc-400'} />
          <span className="relative z-10 truncate">Team Chat</span>
        </button>

        <button
          type="button"
          onClick={() => setChatCategory('direct')}
          className={`relative flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
            chatCategory === 'direct'
              ? 'text-white font-bold'
              : 'hover:text-zinc-200 hover:bg-white/[0.03]'
          }`}
        >
          {chatCategory === 'direct' && (
            <motion.div
              layoutId="active-chat-category-pill"
              className="absolute inset-0 bg-purple-600/30 border border-purple-500/50 rounded-lg shadow-sm"
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            />
          )}
          <MessageSquare size={12} className={chatCategory === 'direct' ? 'text-purple-400 relative z-10' : 'text-zinc-400'} />
          <span className="relative z-10 truncate">One to One</span>
        </button>
      </div>

      {/* Search Input for Current Mode */}
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-2.5 text-zinc-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            chatCategory === 'org'
              ? 'Search organisation channels...'
              : chatCategory === 'team'
              ? 'Search team channels...'
              : 'Search any member in organisation...'
          }
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
        />
      </div>

      {/* ── 1. ORGANISATION CHAT VIEW ── */}
      {chatCategory === 'org' && (
        <div className="space-y-2">
          {/* Org Info Banner */}
          <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-purple-950/25 border border-purple-800/30">
            <div className="flex items-center gap-2 truncate">
              <div className="w-6 h-6 rounded-lg bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                <Building2 size={13} />
              </div>
              <div className="truncate">
                <div className="text-[12px] font-bold text-zinc-100 truncate">{orgName}</div>
                <div className="text-[10px] text-purple-300/80">Company-wide chat & announcements</div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/25 shrink-0">
              {orgMembers.length || 1} members
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              <span>Organisation Channels</span>
              <span className="text-zinc-600 font-mono">{filteredChannels.length}</span>
            </div>

            <div className="space-y-0.5">
              {filteredChannels.map((channel) => {
                const isActive = activeConvId === channel.id;
                return (
                  <button
                    key={channel.id}
                    onClick={() => onSelectConversation(channel)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-purple-500/15 text-purple-300 font-semibold border border-purple-500/30'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {getChannelIcon(channel.name)}
                      <span className="truncate">#{channel.name?.toLowerCase() || 'general'}</span>
                    </div>

                    {channel.unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-500 text-white animate-pulse">
                        {channel.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── 2. TEAM CHAT VIEW (SQUADS) ── */}
      {chatCategory === 'team' && (
        <div className="space-y-2.5">
          {/* Squad Selector Pill Bar */}
          {squadTeams.length > 0 && (
            <div className="space-y-1">
              <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Select Squad / Team
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {squadTeams.map((squad) => {
                  const isSelected = activeTeam?.id === squad.id;
                  return (
                    <button
                      key={squad.id}
                      onClick={() => setActiveTeam(squad)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-purple-600/20 text-purple-200 border border-purple-500/40 shadow-xs'
                          : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                      }`}
                    >
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: squad.color || '#8B5CF6' }}
                      />
                      <span className="truncate max-w-[120px]">{squad.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Squad Header */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800/80">
            <div className="flex items-center gap-2 truncate">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: activeTeam?.color || '#8B5CF6' }}
              />
              <span className="text-xs font-bold text-zinc-200 truncate">{activeTeam?.name || teamName}</span>
            </div>
            <span className="text-[10px] text-zinc-500">Squad Channels</span>
          </div>

          {/* Channels for this squad */}
          <div className="space-y-1">
            <div className="space-y-0.5">
              {filteredChannels.map((channel) => {
                const isActive = activeConvId === channel.id;
                return (
                  <button
                    key={channel.id}
                    onClick={() => onSelectConversation(channel)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-purple-500/15 text-purple-300 font-semibold border border-purple-500/30'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {getChannelIcon(channel.name)}
                      <span className="truncate">#{channel.name?.toLowerCase() || 'general'}</span>
                    </div>

                    {channel.unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-500 text-white animate-pulse">
                        {channel.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── 3. ONE TO ONE CHAT (ALL ORG MEMBERS) ── */}
      {chatCategory === 'direct' && (
        <div className="space-y-2">
          {/* Subheader */}
          <div className="flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            <span>All Members ({filteredOrgMembers.length})</span>
            <span className="text-zinc-600 font-mono">1:1 Direct Chat</span>
          </div>

          {/* Existing Direct Conversations */}
          {directConvs.length > 0 && (
            <div className="space-y-1 mb-2">
              <div className="text-[10px] font-semibold text-zinc-400 px-1">Recent Conversations</div>
              <div className="space-y-0.5">
                {directConvs.map((conv) => {
                  const isActive = activeConvId === conv.id;
                  const name = conv.otherUser?.name || conv.name || 'Direct Message';
                  const initials = name.slice(0, 2).toUpperCase();
                  const avatarColor = conv.otherUser?.avatarColor || '#8B5CF6';

                  return (
                    <button
                      key={conv.id}
                      onClick={() => onSelectConversation(conv)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 cursor-pointer ${
                        isActive
                          ? 'bg-purple-500/15 text-purple-300 font-semibold border border-purple-500/30'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="relative shrink-0">
                          <div
                            className="w-5.5 h-5.5 rounded-md flex items-center justify-center text-[10px] font-bold text-white shadow-xs"
                            style={{ backgroundColor: avatarColor }}
                          >
                            {initials}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-zinc-950" />
                        </div>
                        <div className="truncate text-left">
                          <div className="truncate font-medium text-zinc-200">{name}</div>
                          {conv.lastMessage && (
                            <div className="text-[10px] text-zinc-500 truncate max-w-[180px]">
                              {conv.lastMessage.content}
                            </div>
                          )}
                        </div>
                      </div>

                      {conv.unreadCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-500 text-white animate-pulse">
                          {conv.unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Directory of Members to start chat with */}
          <div className="space-y-0.5">
            {filteredOrgMembers.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-500">
                No members found matching "{searchQuery}"
              </div>
            ) : (
              filteredOrgMembers.map((member) => {
                const initials = (member.name || 'U').slice(0, 2).toUpperCase();
                const avatarBg = member.avatarColor || '#3B82F6';

                return (
                  <button
                    key={member.userId}
                    onClick={() => onSelectMember(member)}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white shadow-xs"
                          style={{ backgroundColor: avatarBg }}
                        >
                          {initials}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-zinc-950" />
                      </div>

                      <div className="truncate text-left">
                        <div className="truncate font-medium text-zinc-200 group-hover:text-purple-300 transition-colors">
                          {member.name}
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate capitalize">
                          {member.role ? member.role.toLowerCase().replace('_', ' ') : 'Member'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-zinc-500 group-hover:text-purple-400 transition-colors shrink-0">
                      <span className="text-[10px] font-medium hidden group-hover:inline">Message</span>
                      <ChevronRight size={12} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
