import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  Building2,
  Users,
  FolderKanban,
  MessageSquare,
  Settings,
  Volume2,
  VolumeX,
  X,
  Hash,
  LucideIcon,
} from 'lucide-react';
import { useChat, ChatCategory } from '../../context/ChatContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import { FloatingTooltip } from '../common/FloatingTooltip';
import { cn } from '../../lib/utils';
import type { TeamConversation } from '../../types/team';

interface ChatHeaderProps {
  conversation: TeamConversation | null;
  onClose: () => void;
}

const CATEGORY_TABS: Array<{ key: ChatCategory; label: string; icon: LucideIcon }> = [
  { key: 'org', label: 'Organisation', icon: Building2 },
  { key: 'teams', label: 'Teams', icon: Users },
  { key: 'project', label: 'Projects', icon: FolderKanban },
  { key: 'direct', label: 'One to One', icon: MessageSquare },
];

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  conversation,
  onClose,
}) => {
  const {
    chatCategory,
    setChatCategory,
    isLeftMenuOpen,
    toggleLeftMenu,
    isMuted,
    toggleMute,
    playNotificationSound,
  } = useChat();

  const { accentColor } = useAccentTheme();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close settings popover on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isSettingsOpen]);

  const isDirect = conversation?.type === 'DIRECT';
  const title = isDirect
    ? conversation?.otherUser?.name || conversation?.name || 'Direct Message'
    : conversation?.name
    ? `#${conversation.name.toLowerCase()}`
    : '#general';

  const avatarColor = conversation?.otherUser?.avatarColor || accentColor;
  const effectiveCategory = chatCategory === 'team' ? 'teams' : chatCategory;

  const handleTabChange = (cat: ChatCategory) => {
    setChatCategory(cat);
  };

  return (
    <div className="h-[54px] px-3 bg-zinc-950/95 border-b border-zinc-800/80 backdrop-blur-md flex items-center justify-between shrink-0 select-none z-20">
      {/* ── Left Side: Hamburger Menu & Active Channel Title Chip ── */}
      <div className="flex items-center gap-2 min-w-0">
        {/* ── Hamburger Menu Button: Located on the LEFT SIDE of right navbar as requested ── */}
        <FloatingTooltip content={isLeftMenuOpen ? 'Hide Channels' : 'Show Channels'} side="bottom">
          <button
            type="button"
            onClick={toggleLeftMenu}
            className={cn(
              'p-2 rounded-xl transition-all duration-150 cursor-pointer flex items-center justify-center shrink-0 border',
              isLeftMenuOpen
                ? 'bg-zinc-850/90 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border-transparent'
            )}
            style={{
              backgroundColor: isLeftMenuOpen ? `${accentColor}20` : undefined,
              borderColor: isLeftMenuOpen ? `${accentColor}50` : 'transparent',
              color: isLeftMenuOpen ? accentColor : undefined,
            }}
          >
            <Menu size={16} />
          </button>
        </FloatingTooltip>

        {/* Mobile View: Category Switcher placed on the LEFT */}
        <div className="flex sm:hidden items-center p-0.5 rounded-xl bg-zinc-900 border border-zinc-800/80 shrink-0">
          {CATEGORY_TABS.map((tab) => {
            const isActive = effectiveCategory === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={cn(
                  'relative p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center shrink-0 z-10',
                  isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                )}
                style={{
                  color: isActive ? accentColor : undefined,
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobile-chat-tab-pill"
                    className="absolute inset-0 rounded-lg border shadow-xs"
                    style={{
                      backgroundColor: `${accentColor}25`,
                      borderColor: `${accentColor}60`,
                    }}
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.3 }}
                  />
                )}
                <Icon size={14} className="relative z-10" />
              </button>
            );
          })}
        </div>

        {/* Active Channel / Direct Chat Title Chip */}
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          {isDirect ? (
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0 shadow-xs"
              style={{ backgroundColor: avatarColor }}
            >
              {title.slice(0, 2).toUpperCase()}
            </div>
          ) : (
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center text-xs shrink-0 shadow-xs"
              style={{
                backgroundColor: `${accentColor}20`,
                color: accentColor,
              }}
            >
              <Hash size={12} />
            </div>
          )}

          <span className="text-xs font-bold text-white truncate max-w-[100px] sm:max-w-[180px]">
            {title}
          </span>
        </div>
      </div>

      {/* ── Right Side: Sliding Category Tabs (PC) + Settings + Mute + Close ── */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Desktop View: Sliding Category Tabs */}
        <div className="hidden sm:flex items-center p-0.5 rounded-xl bg-zinc-900 border border-zinc-800/80 shrink-0">
          {CATEGORY_TABS.map((tab) => {
            const isActive = effectiveCategory === tab.key;
            const Icon = tab.icon;
            return (
              <FloatingTooltip key={tab.key} content={tab.label} side="bottom">
                <button
                  type="button"
                  onClick={() => handleTabChange(tab.key)}
                  className={cn(
                    'relative p-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center shrink-0 z-10',
                    isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                  )}
                  style={{
                    color: isActive ? accentColor : undefined,
                  }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="desktop-chat-tab-pill"
                      className="absolute inset-0 rounded-lg border shadow-xs"
                      style={{
                        backgroundColor: `${accentColor}25`,
                        borderColor: `${accentColor}60`,
                      }}
                      transition={{ type: 'spring', bounce: 0.15, duration: 0.3 }}
                    />
                  )}
                  <Icon size={15} className="relative z-10" />
                </button>
              </FloatingTooltip>
            );
          })}
        </div>

        {/* Vertical Divider */}
        <div className="w-[1px] h-4 bg-zinc-800 mx-0.5" />

        {/* Settings Icon Popover */}
        <div className="relative" ref={settingsRef}>
          <FloatingTooltip content="Chat Settings" side="bottom">
            <button
              type="button"
              onClick={() => setIsSettingsOpen((prev) => !prev)}
              className={cn(
                'p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer border',
                isSettingsOpen ? 'bg-zinc-800 text-white' : 'border-transparent'
              )}
              style={{
                borderColor: isSettingsOpen ? `${accentColor}50` : undefined,
                color: isSettingsOpen ? accentColor : undefined,
              }}
            >
              <Settings size={16} />
            </button>
          </FloatingTooltip>

          {/* Settings Popover */}
          <AnimatePresence>
            {isSettingsOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 6 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 rounded-2xl bg-zinc-900/95 border border-zinc-700/80 shadow-2xl p-3 backdrop-blur-md space-y-3"
              >
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Settings size={13} style={{ color: accentColor }} />
                    <span>Chat Preferences</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="text-zinc-500 hover:text-zinc-300"
                  >
                    <X size={13} />
                  </button>
                </div>

                {/* Sound Settings */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300">Notification Sound</span>
                    <button
                      type="button"
                      onClick={toggleMute}
                      className={cn(
                        'px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer border',
                        isMuted
                          ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          : 'text-white border-transparent'
                      )}
                      style={{
                        backgroundColor: !isMuted ? accentColor : undefined,
                      }}
                    >
                      {isMuted ? 'Muted' : 'Enabled'}
                    </button>
                  </div>

                  {!isMuted && (
                    <button
                      type="button"
                      onClick={() => playNotificationSound('chime')}
                      className="w-full py-1 text-[11px] font-medium text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-800 rounded-lg border border-zinc-700/60 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Volume2 size={12} style={{ color: accentColor }} />
                      <span>Test Chime Sound</span>
                    </button>
                  )}
                </div>

                {/* Accent Theme Indicator */}
                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Chat Accent</span>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-3 h-3 rounded-full border border-white/20 shadow-xs"
                      style={{ backgroundColor: accentColor }}
                    />
                    <span className="font-mono text-zinc-300">{accentColor}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mute Sound Button */}
        <FloatingTooltip content={isMuted ? 'Unmute Sound' : 'Mute Sound'} side="bottom">
          <button
            type="button"
            onClick={toggleMute}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            {isMuted ? (
              <VolumeX size={16} className="text-red-400" />
            ) : (
              <Volume2 size={16} style={{ color: accentColor }} />
            )}
          </button>
        </FloatingTooltip>

        {/* Close Chat Button */}
        <FloatingTooltip content="Close Chat" side="bottom">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </FloatingTooltip>
      </div>
    </div>
  );
};

