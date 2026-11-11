import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDown, MessageSquare, Sparkles } from 'lucide-react';
import { useAccentTheme } from '../../services/accentTheme.service';
import { ChatMessageItem } from './ChatMessageItem';
import type { TeamMessage } from '../../types/team';

interface ChatMessageListProps {
  messages: TeamMessage[];
  currentUserId?: number;
  isLoading: boolean;
  isTyping?: boolean;
  typingUserName?: string;
  onReply?: (message: TeamMessage) => void;
  onAddReaction?: (messageId: number, emoji: string) => void;
  onEditMessage?: (messageId: number, newContent: string) => void;
  onDeleteMessage?: (messageId: number) => void;
  onTogglePin?: (messageId: number) => void;
  onCreateTaskFromMessage?: (message: TeamMessage) => void;
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  currentUserId,
  isLoading,
  isTyping = false,
  typingUserName = 'Someone',
  onReply,
  onAddReaction,
  onEditMessage,
  onDeleteMessage,
  onTogglePin,
  onCreateTaskFromMessage,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { accentColor } = useAccentTheme();

  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [unreadCountBelow, setUnreadCountBelow] = useState(0);

  // Monitor scroll position
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    const isUp = distanceToBottom > 80;
    setIsScrolledUp(isUp);
    if (!isUp) {
      setUnreadCountBelow(0);
    }
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
    setUnreadCountBelow(0);
  };

  // When messages change, either auto-scroll or increment unreadCountBelow
  useEffect(() => {
    if (isScrolledUp) {
      setUnreadCountBelow((prev) => prev + 1);
    } else {
      scrollToBottom('smooth');
    }
  }, [messages.length]);

  // Initial scroll on load
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      scrollToBottom('auto');
    }
  }, [isLoading]);

  // Date Divider Helpers
  const formatDateDivider = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="relative flex-1 min-h-0 flex flex-col bg-zinc-950">
      {/* Scrollable Message Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-2 py-4 space-y-1 select-text scroll-smooth"
      >
        {isLoading ? (
          /* Alternating Left/Right Shimmer Skeleton Loading */
          <div className="space-y-4 p-4 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => {
              const isRight = i % 2 === 0;
              return (
                <div
                  key={i}
                  className={`flex items-end gap-2 ${isRight ? 'justify-end' : 'justify-start'}`}
                >
                  {!isRight && <div className="w-6 h-6 rounded-lg bg-zinc-800/80 shrink-0 mb-1" />}
                  <div className={`space-y-1.5 flex flex-col ${isRight ? 'items-end' : 'items-start'} max-w-[70%]`}>
                    <div className="w-16 h-2.5 rounded bg-zinc-800/60" />
                    <div
                      className={`h-9 rounded-2xl ${
                        isRight
                          ? 'rounded-br-xs bg-zinc-800/80 w-44'
                          : 'rounded-bl-xs bg-zinc-850/80 bg-zinc-900 border border-zinc-800 w-56'
                      }`}
                      style={{ width: `${Math.max(120, ((i * 47) % 180) + 100)}px` }}
                    />
                  </div>
                  {isRight && <div className="w-6 h-6 rounded-lg bg-zinc-800/80 shrink-0 mb-1" />}
                </div>
              );
            })}
          </div>
        ) : messages.length === 0 ? (
          /* Empty State */
          <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner border"
              style={{
                backgroundColor: `${accentColor}18`,
                borderColor: `${accentColor}40`,
                color: accentColor,
              }}
            >
              <MessageSquare size={22} style={{ color: accentColor }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">No messages yet</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-[240px]">
                Start the conversation with your team or share project updates here.
              </p>
            </div>
          </div>
        ) : (
          /* Grouped Messages with Date Dividers */
          messages.map((message, idx) => {
            const isMyMessage = message.senderId === currentUserId;
            const prevMessage = messages[idx - 1];

            // Show date divider if first message or calendar date changes
            const showDateDivider =
              !prevMessage ||
              new Date(prevMessage.createdAt).toDateString() !==
                new Date(message.createdAt).toDateString();

            // Group if same sender within 2 minutes and no date divider
            const isGrouped =
              !showDateDivider &&
              prevMessage &&
              prevMessage.senderId === message.senderId &&
              Math.abs(
                new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime()
              ) < 120000;

            return (
              <React.Fragment key={message.id}>
                {showDateDivider && (
                  <div className="relative flex items-center justify-center my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-zinc-800/80" />
                    </div>
                    <span className="relative px-3 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-900 border border-zinc-800 text-zinc-400 shadow-xs">
                      {formatDateDivider(message.createdAt)}
                    </span>
                  </div>
                )}

                <ChatMessageItem
                  message={message}
                  isMyMessage={isMyMessage}
                  isGrouped={Boolean(isGrouped)}
                  onReply={onReply}
                  onAddReaction={onAddReaction}
                  onEditMessage={onEditMessage}
                  onDeleteMessage={onDeleteMessage}
                  onTogglePin={onTogglePin}
                  onCreateTaskFromMessage={onCreateTaskFromMessage}
                />
              </React.Fragment>
            );
          })
        )}

        {/* Typing Indicator with 3 Bouncing Dots */}
        <AnimatePresence>
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2 }}
              className="px-4 py-2 flex items-center gap-2 text-xs text-zinc-400"
            >
              <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-full shadow-xs">
                <span
                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ backgroundColor: accentColor }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ backgroundColor: accentColor, animationDelay: '150ms' }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ backgroundColor: accentColor, animationDelay: '300ms' }}
                />
                <span className="text-[11px] text-zinc-400 ml-1.5 font-medium">
                  {typingUserName} is typing...
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} className="h-2" />
      </div>

      {/* Floating "↓ New messages" pill when scrolled up */}
      <AnimatePresence>
        {isScrolledUp && (
          <motion.button
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 8 }}
            transition={{ type: 'spring', bounce: 0.2 }}
            onClick={() => scrollToBottom('smooth')}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow-xl cursor-pointer transition-transform active:scale-95"
            style={{ backgroundColor: accentColor }}
          >
            <ChevronDown size={14} />
            <span>
              {unreadCountBelow > 0
                ? `${unreadCountBelow} new message${unreadCountBelow > 1 ? 's' : ''}`
                : 'Jump to bottom'}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

