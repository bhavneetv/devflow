import React from 'react';
import { motion } from 'framer-motion';
import {
  Hash,
  Search,
  Minus,
  X,
  Volume2,
  VolumeX,
  Users,
  ChevronDown,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { TeamConversation } from '../../types/team';

interface ChatHeaderProps {
  conversation: TeamConversation | null;
  teamName: string;
  isSwitcherOpen: boolean;
  onToggleSwitcher: () => void;
  isSearchOpen: boolean;
  onToggleSearch: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onMinimize: () => void;
  onClose: () => void;
  memberCount?: number;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  conversation,
  teamName,
  isSwitcherOpen,
  onToggleSwitcher,
  isSearchOpen,
  onToggleSearch,
  isMuted,
  onToggleMute,
  onMinimize,
  onClose,
  memberCount = 5,
}) => {
  const isDirect = conversation?.type === 'DIRECT';
  const title = isDirect
    ? conversation?.otherUser?.name || conversation?.name || 'Direct Message'
    : conversation?.name ? `#${conversation.name.toLowerCase()}` : '#general';

  const categoryBadge = isDirect
    ? 'Direct'
    : teamName.includes('(Organisation)') || teamName.includes('Workspace')
    ? 'Organisation'
    : 'Team';

  const subtitle = isDirect
    ? conversation?.otherUser?.username
      ? `@${conversation.otherUser.username} • 1:1 Direct Message`
      : '1:1 Direct Conversation'
    : `${teamName} • ${memberCount} members`;

  const avatarColor = conversation?.otherUser?.avatarColor || '#8B5CF6';

  return (
    <div className="h-[62px] px-4 bg-zinc-950/95 border-b border-zinc-800/80 backdrop-blur-md flex items-center justify-between shrink-0 select-none z-10">
      {/* Left: Avatar & Title & Switcher Trigger */}
      <button
        onClick={onToggleSwitcher}
        className="flex items-center gap-3 min-w-0 text-left hover:bg-zinc-900/60 p-1.5 -ml-1 rounded-xl transition-all duration-150 cursor-pointer group"
        title="Switch channels or team members"
      >
        {isDirect ? (
          <div className="relative shrink-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold border border-white/10 shadow-sm"
              style={{ backgroundColor: avatarColor }}
            >
              {title.slice(0, 2).toUpperCase()}
            </div>
            {/* Animated Online Presence Dot */}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-zinc-950" />
            </span>
          </div>
        ) : (
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 shadow-sm">
            <Hash size={18} />
          </div>
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-bold text-white truncate group-hover:text-purple-300 transition-colors">
              {title}
            </h2>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-zinc-800/80 text-purple-300 border border-purple-500/20 shrink-0">
              {categoryBadge}
            </span>
            <ChevronDown
              size={13}
              className={`text-zinc-500 transition-transform duration-200 ${
                isSwitcherOpen ? 'rotate-180 text-purple-400' : 'group-hover:text-zinc-300'
              }`}
            />
          </div>
          <p className="text-[11px] text-zinc-400 truncate mt-0.2">{subtitle}</p>
        </div>
      </button>

      {/* Right: Actions (Search, Sound, Minimize, Close) */}
      <div className="flex items-center gap-1 shrink-0 text-zinc-400">
        <button
          onClick={onToggleSearch}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            isSearchOpen
              ? 'text-purple-400 bg-purple-500/15 border border-purple-500/30'
              : 'hover:text-white hover:bg-zinc-800/70'
          }`}
          title="Search messages in conversation"
        >
          <Search size={15} />
        </button>

        <button
          onClick={onToggleMute}
          className="p-1.5 rounded-lg hover:text-white hover:bg-zinc-800/70 transition-colors cursor-pointer"
          title={isMuted ? 'Unmute notifications' : 'Mute notifications'}
        >
          {isMuted ? <VolumeX size={15} className="text-zinc-500" /> : <Volume2 size={15} />}
        </button>

        <button
          onClick={onMinimize}
          className="p-1.5 rounded-lg hover:text-white hover:bg-zinc-800/70 transition-colors cursor-pointer hidden sm:block"
          title="Minimize chat drawer"
        >
          <Minus size={15} />
        </button>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:text-white hover:bg-red-500/15 hover:border-red-500/30 text-zinc-400 hover:text-red-400 transition-all cursor-pointer"
          title="Close chat drawer (Esc)"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

