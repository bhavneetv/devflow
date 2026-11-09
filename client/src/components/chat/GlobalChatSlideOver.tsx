import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  MessageSquare,
  Maximize2,
  X,
  Search,
  Sparkles,
  ChevronRight,
  Hash,
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { teamService } from '../../services/team.service';
import { ChatHeader } from './ChatHeader';
import { ChatConversationSwitcher, ChatTargetUser } from './ChatConversationSwitcher';
import { ChatMessageList } from './ChatMessageList';
import { ChatComposer } from './ChatComposer';
import type { TeamConversation, TeamMessage, TeamMember } from '../../types/team';

export const GlobalChatSlideOver: React.FC = () => {
  const {
    isOpen,
    isMinimized,
    closeChat,
    minimizeChat,
    expandChat,
    activeTeam,
    setActiveTeam,
    activeConversation,
    setActiveConversation,
    chatCategory,
    setChatCategory,
    orgTeam,
    squadTeams,
    unreadTotal,
    refreshUnread,
    socket,
  } = useChat();

  const { user } = useAuth();
  const { toast } = useToast();
  const shouldReduceMotion = useReducedMotion();

  const [conversations, setConversations] = useState<TeamConversation[]>([]);
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('devflow_chat_muted') === 'true';
  });

  const [replyingTo, setReplyingTo] = useState<{
    id: number;
    senderName: string;
    content: string;
  } | null>(null);

  // Play subtle audio ping
  const playPing = useCallback(() => {
    if (isMuted) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    } catch {
      // AudioContext not allowed or not supported
    }
  }, [isMuted]);

  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem('devflow_chat_muted', String(next));
      return next;
    });
  };

  // Load team members and conversations when activeTeam changes
  const loadTeamData = useCallback(async () => {
    if (!activeTeam) return;
    try {
      const [convRes, teamDetailRes] = await Promise.all([
        teamService.getConversations(activeTeam.id),
        teamService.getTeam(activeTeam.id),
      ]);

      if (convRes.success && convRes.data) {
        setConversations(convRes.data);
        if (!activeConversation && convRes.data.length > 0) {
          // Default to General channel or first conversation
          const general = convRes.data.find(
            (c) => c.type === 'GROUP' && c.name?.toLowerCase() === 'general'
          );
          setActiveConversation(general || convRes.data[0]);
        }
      }

      if (teamDetailRes.success && teamDetailRes.data) {
        setTeamMembers(teamDetailRes.data.members || []);
      }
    } catch (err) {
      console.warn('Failed to load team conversations:', err);
    }
  }, [activeTeam, activeConversation, setActiveConversation]);

  useEffect(() => {
    if (isOpen && activeTeam) {
      loadTeamData();
    }
  }, [isOpen, activeTeam, loadTeamData]);

  // Load messages when activeConversation changes
  const loadMessages = useCallback(async () => {
    if (!activeTeam || !activeConversation) return;
    try {
      setIsLoadingMessages(true);
      const res = await teamService.getMessages(activeTeam.id, activeConversation.id);
      if (res.success && res.data) {
        setMessages(res.data);
        // Mark conversation as read
        teamService.markConversationRead(activeTeam.id, activeConversation.id);
        refreshUnread();
      }
    } catch (err) {
      console.warn('Failed to fetch messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [activeTeam, activeConversation, refreshUnread]);

  useEffect(() => {
    if (activeConversation) {
      loadMessages();
    }
  }, [activeConversation?.id, loadMessages]);

  // Socket real-time message handler
  useEffect(() => {
    if (!socket || !activeTeam) return;

    const handleNewMessage = (payload: { conversationId: number; message: TeamMessage }) => {
      if (activeConversation && payload.conversationId === activeConversation.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.message.id)) return prev;
          return [...prev, payload.message];
        });
        teamService.markConversationRead(activeTeam.id, activeConversation.id);
        playPing();
      }

      // Update conversations list badge
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === payload.conversationId) {
            const isCurrent = activeConversation?.id === c.id;
            return {
              ...c,
              lastMessage: payload.message,
              unreadCount: isCurrent ? 0 : (c.unreadCount || 0) + 1,
            };
          }
          return c;
        })
      );
      refreshUnread();
    };

    socket.on('new_message', handleNewMessage);

    const handleMessageEdited = (payload: { conversationId: number; message: TeamMessage }) => {
      if (activeConversation && payload.conversationId === activeConversation.id) {
        setMessages((prev) => prev.map((m) => (m.id === payload.message.id ? payload.message : m)));
      }
    };

    const handleMessageDeleted = (payload: { conversationId: number; messageId: number }) => {
      if (activeConversation && payload.conversationId === activeConversation.id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === payload.messageId ? { ...m, isDeleted: true, content: 'This message was deleted' } : m))
        );
      }
    };

    const handleMessagePinned = (payload: { conversationId: number; message: TeamMessage }) => {
      if (activeConversation && payload.conversationId === activeConversation.id) {
        setMessages((prev) => prev.map((m) => (m.id === payload.message.id ? payload.message : m)));
      }
    };

    const handleUserTyping = (payload: { teamId: number; conversationId: number; userId: number; userName: string; isTyping: boolean }) => {
      if (activeConversation && payload.conversationId === activeConversation.id && payload.userId !== user?.id) {
        setTypingUser(payload.isTyping ? payload.userName : null);
      }
    };

    socket.on('message_edited', handleMessageEdited);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('message_pinned', handleMessagePinned);
    socket.on('user_typing', handleUserTyping);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('message_edited', handleMessageEdited);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('message_pinned', handleMessagePinned);
      socket.off('user_typing', handleUserTyping);
    };
  }, [socket, activeTeam, activeConversation, playPing, refreshUnread, user?.id]);

  // Send Message
  const handleSendMessage = async (
    content: string,
    options?: {
      mentions?: number[];
      attachments?: Array<{ name: string; size: string }>;
      sharedEntity?: any;
      replyToId?: number;
    }
  ) => {
    if (!activeTeam || !activeConversation || isSending) return;
    setIsSending(true);
    try {
      const res = await teamService.sendMessage(
        activeTeam.id,
        activeConversation.id,
        content,
        options
      );
      if (res.success && res.data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === res.data!.id)) return prev;
          return [...prev, res.data!];
        });
      }
    } catch (err: any) {
      toast.error('Failed to send message', err.message);
    } finally {
      setIsSending(false);
    }
  };

  // Edit message
  const handleEditMessage = async (messageId: number, newContent: string) => {
    if (!activeTeam || !activeConversation) return;
    try {
      const res = await teamService.editMessage(activeTeam.id, activeConversation.id, messageId, newContent);
      if (res.success && res.data) {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? res.data! : m)));
        toast.success('Message updated');
      }
    } catch (err: any) {
      toast.error('Failed to edit message', err.message);
    }
  };

  // Delete message
  const handleDeleteMessage = async (messageId: number) => {
    if (!activeTeam || !activeConversation) return;
    try {
      const res = await teamService.deleteMessage(activeTeam.id, activeConversation.id, messageId);
      if (res.success) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, isDeleted: true, content: 'This message was deleted' } : m))
        );
        toast.info('Message deleted');
      }
    } catch (err: any) {
      toast.error('Failed to delete message', err.message);
    }
  };

  // Toggle Pin message
  const handleTogglePin = async (messageId: number) => {
    if (!activeTeam || !activeConversation) return;
    try {
      const res = await teamService.togglePinMessage(activeTeam.id, activeConversation.id, messageId);
      if (res.success && res.data) {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? res.data! : m)));
        toast.info(res.data.isPinned ? 'Message pinned' : 'Message unpinned');
      }
    } catch (err: any) {
      toast.error('Failed to pin message', err.message);
    }
  };

  // Create Task from Message
  const handleCreateTaskFromMessage = async (message: TeamMessage) => {
    toast.success('Task created from message', `Created task from "${message.content.slice(0, 30)}..."`);
    window.dispatchEvent(
      new CustomEvent('devflow:create-task-from-chat', {
        detail: {
          title: message.content.slice(0, 80),
          description: `Created from chat message by ${message.sender?.name || 'team member'}:\n\n${message.content}`,
        },
      })
    );
  };

  // Handle user typing
  const handleTyping = (isTyping: boolean) => {
    if (!socket || !activeTeam || !activeConversation || !user) return;
    const event = isTyping ? 'typing_start' : 'typing_stop';
    socket.emit(event, {
      teamId: activeTeam.id,
      conversationId: activeConversation.id,
      userId: user.id,
      userName: user.name || 'Member',
    });
  };

  // Switch to Direct Conversation with member
  const handleSelectMember = async (member: ChatTargetUser) => {
    const targetTeamId = activeTeam?.id || orgTeam?.id;
    if (!targetTeamId) return;
    try {
      const res = await teamService.getOrCreateDirectConversation(targetTeamId, member.userId);
      if (res.success && res.data) {
        setConversations((prev) => {
          if (!prev.some((c) => c.id === res.data!.id)) {
            return [res.data!, ...prev];
          }
          return prev;
        });
        setActiveConversation(res.data);
        setIsSwitcherOpen(false);
      }
    } catch (err: any) {
      toast.error('Failed to open chat with member', err.message);
    }
  };

  const handleSelectConversation = (conv: TeamConversation) => {
    setActiveConversation(conv);
    setIsSwitcherOpen(false);
  };

  // Filter messages if search is active
  const filteredMessages = messages.filter((m) => {
    if (!isSearchOpen || !searchFilter.trim()) return true;
    return m.content.toLowerCase().includes(searchFilter.toLowerCase().trim());
  });

  return (
    <>
      {/* 1. Minimized Floating Dock Pill (When minimized) */}
      <AnimatePresence>
        {isOpen && isMinimized && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-zinc-900 border border-purple-500/40 shadow-2xl backdrop-blur-md select-none cursor-pointer group hover:border-purple-400 transition-colors"
            onClick={expandChat}
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                <MessageSquare size={16} />
              </div>
              {unreadTotal > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-purple-500 text-[9px] font-bold text-white items-center justify-center">
                    {unreadTotal}
                  </span>
                </span>
              )}
            </div>

            <div className="text-left pr-2">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>DevFlow Chat</span>
                <span className="text-[10px] text-purple-400 font-normal">
                  ({activeConversation?.name ? `#${activeConversation.name.toLowerCase()}` : 'Channel'})
                </span>
              </div>
              <p className="text-[10px] text-zinc-400">Click to expand overlay</p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                closeChat();
              }}
              className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Close"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Full Floating Right-Side Overlay Drawer */}
      <AnimatePresence>
        {isOpen && !isMinimized && (
          <div className="fixed inset-0 z-[100] pointer-events-none">
            {/* Semi-transparent Dark Backdrop Overlay */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={closeChat}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
            />

            {/* Right-Side Overlay Chat Drawer */}
            <motion.div
              initial={shouldReduceMotion ? { x: 0 } : { x: '100%', opacity: 0.9 }}
              animate={{ x: 0, opacity: 1 }}
              exit={shouldReduceMotion ? { x: 0 } : { x: '100%', opacity: 0.9 }}
              transition={{
                type: 'spring',
                damping: 26,
                stiffness: 290,
                mass: 0.85,
              }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] md:w-[460px] lg:w-[33vw] min-w-[390px] max-w-[520px] h-screen bg-zinc-950 border-l border-zinc-800/90 shadow-[-20px_0_50px_rgba(0,0,0,0.85),-4px_0_24px_rgba(139,92,246,0.15)] flex flex-col pointer-events-auto z-10 overflow-hidden"
            >
              {/* Luminous Purple Accent Left Edge Line */}
              <div className="absolute left-0 top-0 bottom-0 w-[1.5px] bg-gradient-to-b from-purple-500/80 via-purple-600/40 to-transparent pointer-events-none z-30" />

              {/* Header */}
              <ChatHeader
                conversation={activeConversation}
                teamName={activeTeam?.name || 'Workspace Team'}
                isSwitcherOpen={isSwitcherOpen}
                onToggleSwitcher={() => setIsSwitcherOpen((prev) => !prev)}
                isSearchOpen={isSearchOpen}
                onToggleSearch={() => setIsSearchOpen((prev) => !prev)}
                isMuted={isMuted}
                onToggleMute={toggleMute}
                onMinimize={minimizeChat}
                onClose={closeChat}
                memberCount={teamMembers.length}
              />

              {/* In-Drawer Search Bar (Slide-down animation) */}
              <AnimatePresence>
                {isSearchOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden bg-zinc-900/90 border-b border-zinc-800 px-3 py-2 flex items-center gap-2 shrink-0"
                  >
                    <Search size={14} className="text-zinc-500 shrink-0" />
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Filter messages in this conversation..."
                      autoFocus
                      className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
                    />
                    {searchFilter && (
                      <button
                        onClick={() => setSearchFilter('')}
                        className="text-zinc-500 hover:text-white p-0.5 rounded cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* In-Drawer Conversation & Direct Message Switcher */}
              <AnimatePresence>
                {isSwitcherOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden shrink-0 z-20"
                  >
                    <ChatConversationSwitcher
                      conversations={conversations}
                      activeConvId={activeConversation?.id}
                      onSelectConversation={handleSelectConversation}
                      teamMembers={teamMembers}
                      currentUserId={user?.id}
                      onSelectMember={handleSelectMember}
                      teamName={activeTeam?.name || 'Team'}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Independently Scrollable Message Area */}
              <ChatMessageList
                messages={filteredMessages}
                currentUserId={user?.id}
                isLoading={isLoadingMessages}
                isTyping={Boolean(typingUser)}
                typingUserName={typingUser || undefined}
                onReply={(m) =>
                  setReplyingTo({
                    id: m.id,
                    senderName: m.sender?.name || 'Collaborator',
                    content: m.content,
                  })
                }
                onAddReaction={(msgId, emoji) => {
                  // Handled optimistically inside ChatMessageItem
                }}
                onEditMessage={handleEditMessage}
                onDeleteMessage={handleDeleteMessage}
                onTogglePin={handleTogglePin}
                onCreateTaskFromMessage={handleCreateTaskFromMessage}
              />

              {/* Fixed Bottom Message Composer */}
              <ChatComposer
                conversationId={activeConversation?.id}
                onSendMessage={handleSendMessage}
                isSending={isSending}
                teamMembers={teamMembers}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
                onTyping={handleTyping}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

