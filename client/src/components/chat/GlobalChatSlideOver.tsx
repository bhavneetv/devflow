import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  MessageSquare,
  X,
  Sparkles,
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import { teamService } from '../../services/team.service';
import { ChatHeader } from './ChatHeader';
import { ChatLeftSidebar, ChatTargetUser } from './ChatLeftSidebar';
import { ChatMessageList } from './ChatMessageList';
import { ChatComposer } from './ChatComposer';
import { FloatingTooltip } from '../common/FloatingTooltip';
import { cn } from '../../lib/utils';
import type { TeamConversation, TeamMessage, TeamMember } from '../../types/team';

export const GlobalChatSlideOver: React.FC = () => {
  const {
    isOpen,
    isMinimized,
    closeChat,
    expandChat,
    activeTeam,
    setActiveTeam,
    activeConversation,
    setActiveConversation,
    chatCategory,
    setChatCategory,
    orgTeam,
    squadTeams,
    teams,
    projects,
    activeProjectChat,
    setActiveProjectChat,
    isLeftMenuOpen,
    setIsLeftMenuOpen,
    unreadTotal,
    refreshUnread,
    playNotificationSound,
    socket,
  } = useChat();

  const { user } = useAuth();
  const { toast } = useToast();
  const { accentColor } = useAccentTheme();
  const shouldReduceMotion = useReducedMotion();

  const [conversations, setConversations] = useState<TeamConversation[]>([]);
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingTeamData, setIsLoadingTeamData] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);

  const [replyingTo, setReplyingTo] = useState<{
    id: number;
    senderName: string;
    content: string;
  } | null>(null);

  // Synchronize category switch with active team & default general topic selection
  useEffect(() => {
    if (chatCategory === 'org') {
      if (orgTeam && activeTeam?.id !== orgTeam.id) {
        setActiveTeam(orgTeam);
      }
    } else if (chatCategory === 'teams' || chatCategory === 'team') {
      if (squadTeams.length > 0 && (!activeTeam || activeTeam.name.includes('(Organisation)'))) {
        setActiveTeam(squadTeams[0]);
      }
    } else if (chatCategory === 'project') {
      if (activeProjectChat) {
        if (activeProjectChat.teamId) {
          const matchedTeam = teams.find((t) => t.id === activeProjectChat.teamId);
          if (matchedTeam) {
            setActiveTeam(matchedTeam);
            return;
          }
        }
      }
      if (orgTeam && (!activeTeam || activeTeam.id !== orgTeam.id)) {
        setActiveTeam(orgTeam);
      }
    }
  }, [chatCategory, orgTeam, squadTeams, activeProjectChat, teams]);

  // Load team members and conversations when activeTeam changes
  const loadTeamData = useCallback(async () => {
    if (!activeTeam) return;
    try {
      setIsLoadingTeamData(true);
      const [convRes, teamDetailRes] = await Promise.all([
        teamService.getConversations(activeTeam.id),
        teamService.getTeam(activeTeam.id),
      ]);

      if (convRes.success && convRes.data) {
        setConversations(convRes.data);
        // By default show and select #general topic if active conversation is not set or belongs to another team
        const isCurrentConvInTeam = activeConversation && convRes.data.some((c) => c.id === activeConversation.id);
        if (!isCurrentConvInTeam && convRes.data.length > 0) {
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
    } finally {
      setIsLoadingTeamData(false);
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
      }

      // Play audio chime notification
      playNotificationSound('chime');

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
  }, [socket, activeTeam, activeConversation, playNotificationSound, refreshUnread, user?.id]);

  // Send Message with instant optimistic delivery (0ms perceived delay)
  const handleSendMessage = async (
    content: string,
    options?: {
      mentions?: number[];
      attachments?: Array<{ name: string; size: string; url?: string; type?: string }>;
      sharedEntity?: any;
      replyToId?: number;
    }
  ) => {
    if (!activeTeam || !activeConversation) return;

    // 1. Instantly create and display optimistic message
    const tempId = -Date.now();
    const optimisticMsg: TeamMessage = {
      id: tempId,
      teamId: activeTeam.id,
      conversationId: activeConversation.id,
      senderId: user?.id || 0,
      content,
      mentions: options?.mentions ? JSON.stringify(options.mentions) : null,
      attachments: options?.attachments ? JSON.stringify(options.attachments) : null,
      sharedEntity: options?.sharedEntity ? JSON.stringify(options.sharedEntity) : null,
      replyToId: options?.replyToId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sender: {
        id: user?.id || 0,
        name: user?.name || 'You',
        email: user?.email || '',
        username: (user as any)?.username || '',
        avatarUrl: user?.avatarUrl || null,
        avatarColor: user?.avatarColor || accentColor,
        avatarType: user?.avatarType || 'initials',
        avatarId: user?.avatarId || null,
      },
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    // 2. Sync with backend in background
    try {
      const res = await teamService.sendMessage(
        activeTeam.id,
        activeConversation.id,
        content,
        options
      );
      if (res.success && res.data) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? res.data! : m))
        );
      }
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error('Failed to send message', err.message);
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
      }
    } catch (err: any) {
      toast.error('Failed to open chat with member', err.message);
    }
  };

  const handleSelectConversation = (conv: TeamConversation) => {
    setActiveConversation(conv);
  };

  return (
    <>
      {/* ── 1. Minimized Floating Dock Pill ── */}
      <AnimatePresence>
        {isOpen && isMinimized && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-zinc-900 border shadow-2xl backdrop-blur-md select-none cursor-pointer group transition-colors"
            style={{ borderColor: `${accentColor}50` }}
            onClick={expandChat}
          >
            <div className="relative">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center border shadow-xs"
                style={{
                  backgroundColor: `${accentColor}20`,
                  color: accentColor,
                  borderColor: `${accentColor}40`,
                }}
              >
                <MessageSquare size={16} />
              </div>
              {unreadTotal > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ backgroundColor: accentColor }}
                  />
                  <span
                    className="relative inline-flex rounded-full h-4 w-4 text-[9px] font-bold text-white items-center justify-center"
                    style={{ backgroundColor: accentColor }}
                  >
                    {unreadTotal}
                  </span>
                </span>
              )}
            </div>

            <div className="text-left pr-2">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>DevFlow Chat</span>
                <span className="text-[10px] font-normal" style={{ color: accentColor }}>
                  ({activeConversation?.name ? `#${activeConversation.name.toLowerCase()}` : 'Channel'})
                </span>
              </div>
              <p className="text-[10px] text-zinc-400">Click to expand overlay</p>
            </div>

            <FloatingTooltip content="Close" side="top">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeChat();
                }}
                className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X size={14} />
              </button>
            </FloatingTooltip>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 2. Full Floating Right-Side Overlay Drawer ── */}
      <AnimatePresence>
        {isOpen && !isMinimized && (
          <div className="fixed inset-0 z-[100] pointer-events-none">
            {/* Semi-transparent Dark Backdrop Overlay */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={closeChat}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
            />

            {/* Right-Side Overlay Chat Drawer */}
            <motion.div
              initial={shouldReduceMotion ? { x: 0 } : { x: '100%', opacity: 0.9 }}
              animate={{ x: 0, opacity: 1 }}
              exit={shouldReduceMotion ? { x: 0 } : { x: '100%', opacity: 0.9 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="fixed right-0 top-0 bottom-0 h-screen bg-zinc-950 border-l border-zinc-800/90 shadow-[-20px_0_50px_rgba(0,0,0,0.85)] flex flex-row pointer-events-auto z-10 overflow-hidden"
            >
              {/* Luminous Accent Left Edge Line */}
              <div
                className="absolute left-0 top-0 bottom-0 w-[2px] pointer-events-none z-30 opacity-80"
                style={{
                  background: `linear-gradient(to bottom, ${accentColor}, ${accentColor}40, transparent)`,
                }}
              />

              {/* Slide-out Left Navigation Menu (Org Topics / Teams / Projects / 1:1 Members) */}
              <AnimatePresence initial={false}>
                {isLeftMenuOpen && (
                  <motion.div
                    initial={shouldReduceMotion ? { opacity: 1 } : { width: 0, opacity: 0 }}
                    animate={{ width: 280, opacity: 1 }}
                    exit={shouldReduceMotion ? { opacity: 0 } : { width: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="h-full overflow-hidden shrink-0 flex border-r border-zinc-800/80 sm:relative absolute left-0 top-0 bottom-0 z-30 bg-zinc-950 shadow-2xl sm:shadow-none"
                  >
                    <ChatLeftSidebar
                      conversations={conversations}
                      activeConvId={activeConversation?.id}
                      onSelectConversation={handleSelectConversation}
                      teamMembers={teamMembers}
                      currentUserId={user?.id}
                      onSelectMember={handleSelectMember}
                      onCloseLeftMenu={() => setIsLeftMenuOpen(false)}
                      isLoading={isLoadingTeamData}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Right Chat Bar (Right Navbar + Messages + Composer) - NEVER SMALLS! */}
              <div className="w-full sm:w-[480px] md:w-[500px] lg:w-[520px] flex flex-col h-full shrink-0 overflow-hidden bg-zinc-950">
                {/* Right Navbar (Header) with Hamburger on Left */}
                <ChatHeader
                  conversation={activeConversation}
                  onClose={closeChat}
                />
                  {/* Independently Scrollable Message Area */}
                  <ChatMessageList
                    messages={messages}
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
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
