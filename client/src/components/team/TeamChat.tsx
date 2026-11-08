import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  MessageSquare,
  Hash,
  Users,
  Search,
  AtSign,
  Check,
  CheckCheck,
  Smile,
  X,
  Sparkles,
  ChevronRight,
  Shield,
  Crown,
  Bell,
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { teamService } from '../../services/team.service';
import { useAccentTheme } from '../../services/accentTheme.service';
import { getSocketUrl } from '../../config/api';
import type { Team, TeamMember, TeamConversation, TeamMessage, TeamUser } from '../../types/team';

interface TeamChatProps {
  team: Team;
  currentUserId?: number;
}

export const TeamChat: React.FC<TeamChatProps> = ({ team, currentUserId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { accentColor } = useAccentTheme();
  const myUserId = currentUserId || user?.id;

  const [conversations, setConversations] = useState<TeamConversation[]>([]);
  const [activeConv, setActiveConv] = useState<TeamConversation | null>(null);
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Mention state
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Initialize socket connection
  useEffect(() => {
    const socketUrl = getSocketUrl();
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.emit('join_team', team.id);
    if (myUserId) {
      socket.emit('join_user', myUserId);
    }

    socket.on('new_message', (payload: { conversationId: number; message: TeamMessage }) => {
      setActiveConv((curr) => {
        if (curr && curr.id === payload.conversationId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.message.id)) return prev;
            return [...prev, payload.message];
          });
          // Mark read
          teamService.markConversationRead(team.id, payload.conversationId);
        }
        return curr;
      });

      // Update conversations list last message & unread
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === payload.conversationId) {
            const isCurrent = activeConv?.id === c.id;
            return {
              ...c,
              lastMessage: payload.message,
              unreadCount: isCurrent ? 0 : c.unreadCount + 1,
              updatedAt: new Date().toISOString(),
            };
          }
          return c;
        })
      );
    });

    socket.on(
      'mention_notification',
      (payload: { teamId: number; conversationId: number; senderName: string; content: string }) => {
        toast.info(
          `@Mention from ${payload.senderName}`,
          payload.content.length > 50 ? payload.content.slice(0, 50) + '...' : payload.content
        );
      }
    );

    return () => {
      socket.emit('leave_team', team.id);
      socket.disconnect();
    };
  }, [team.id, myUserId, activeConv?.id, toast]);

  // Load conversations
  const loadConversations = async () => {
    const res = await teamService.getConversations(team.id);
    if (res.success && res.data) {
      setConversations(res.data);
      if (!activeConv && res.data.length > 0) {
        setActiveConv(res.data[0]);
      }
    }
  };

  useEffect(() => {
    loadConversations();
  }, [team.id]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConv) return;
    let isCancelled = false;
    setIsLoadingMessages(true);

    teamService.getMessages(team.id, activeConv.id).then((res) => {
      if (!isCancelled && res.success && res.data) {
        setMessages(res.data);
        setIsLoadingMessages(false);
        // Mark read
        teamService.markConversationRead(team.id, activeConv.id);
        // Clear unread badge in state
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConv.id ? { ...c, unreadCount: 0 } : c))
        );
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [activeConv?.id, team.id]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Filtered members for mentions and sidebar
  const activeMembers = useMemo(() => {
    return team.members.filter((m) => m.userId !== myUserId);
  }, [team.members, myUserId]);

  const mentionCandidates = useMemo(() => {
    if (!showMentionMenu) return [];
    const query = mentionQuery.toLowerCase();
    return team.members
      .filter((m) => {
        const name = (m.user.name || '').toLowerCase();
        const username = (m.user.username || '').toLowerCase();
        return name.includes(query) || username.includes(query);
      })
      .slice(0, 6);
  }, [team.members, mentionQuery, showMentionMenu]);

  // Handle typing & mention detection
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtMatch = textBeforeCursor.match(/@([a-zA-Z0-9_.-]*)$/);

    if (lastAtMatch) {
      setShowMentionMenu(true);
      setMentionQuery(lastAtMatch[1] || '');
      setMentionIndex(0);
    } else {
      setShowMentionMenu(false);
    }
  };

  const insertMention = (member: TeamMember) => {
    const handle = member.user.username || member.user.name.replace(/\s+/g, '');
    const cursorPos = inputRef.current?.selectionStart || inputText.length;
    const textBeforeCursor = inputText.slice(0, cursorPos);
    const textAfterCursor = inputText.slice(cursorPos);

    const newBefore = textBeforeCursor.replace(/@([a-zA-Z0-9_.-]*)$/, `@${handle} `);
    setInputText(newBefore + textAfterCursor);
    setShowMentionMenu(false);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = newBefore.length;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionMenu && mentionCandidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % mentionCandidates.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + mentionCandidates.length) % mentionCandidates.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionCandidates[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowMentionMenu(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isSending || !activeConv) return;
    const content = inputText.trim();
    setInputText('');
    setShowMentionMenu(false);
    setIsSending(true);

    try {
      const res = await teamService.sendMessage(team.id, activeConv.id, content);
      if (res.success && res.data) {
        // Handled via socket broadcast or optimistic update
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

  const openDirectMessage = async (member: TeamMember) => {
    const res = await teamService.getOrCreateDirectConversation(team.id, member.userId);
    if (res.success && res.data) {
      setConversations((prev) => {
        if (!prev.some((c) => c.id === res.data!.id)) {
          return [res.data!, ...prev];
        }
        return prev;
      });
      setActiveConv(res.data);
    }
  };

  // Render styled message text with @mention highlights
  const renderMessageContent = (content: string) => {
    const mentionRegex = /(@[a-zA-Z0-9_.-]+)/g;
    const parts = content.split(mentionRegex);

    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span
            key={i}
            className="inline-block px-1.5 py-0.5 rounded text-[13px] font-semibold text-purple-300 bg-purple-950/60 border border-purple-800/40 mx-0.5"
          >
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-[720px] w-full rounded-2xl border border-zinc-800/80 bg-[#0C0D10] overflow-hidden shadow-2xl">
      {/* ─── Left Sidebar: Channels & Team Members ─── */}
      <div className="w-72 border-r border-zinc-800/70 bg-[#08090B] flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: team.color || accentColor }}
            />
            <h3 className="text-sm font-semibold text-zinc-100 truncate">{team.name} Chat</h3>
          </div>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-800/80 text-zinc-400">
            {team.members.length} members
          </span>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-zinc-800/50">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              type="text"
              placeholder="Search chat or member..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#111216] border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500/50"
            />
          </div>
        </div>

        {/* Channels List */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 custom-scrollbar">
          <div>
            <div className="px-2 mb-1.5 flex items-center justify-between text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <span>Channels</span>
            </div>
            <div className="space-y-0.5">
              {conversations
                .filter((c) => c.type === 'GROUP')
                .map((conv) => {
                  const isActive = activeConv?.id === conv.id;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => setActiveConv(conv)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-purple-600/15 text-purple-300 font-semibold border border-purple-500/30'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Hash size={14} className={isActive ? 'text-purple-400' : 'text-zinc-500'} />
                        <span className="truncate">{conv.name}</span>
                      </div>
                      {conv.unreadCount > 0 && !isActive && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-purple-600 text-white">
                          {conv.unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Direct Messages */}
          <div>
            <div className="px-2 mb-1.5 flex items-center justify-between text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <span>Direct Messages</span>
            </div>
            <div className="space-y-0.5">
              {conversations
                .filter((c) => c.type === 'DIRECT')
                .map((conv) => {
                  const isActive = activeConv?.id === conv.id;
                  const name = conv.otherUser?.name || conv.name;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => setActiveConv(conv)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-purple-600/15 text-purple-300 font-semibold border border-purple-500/30'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div className="relative">
                          {conv.otherUser?.avatarUrl ? (
                            <img
                              src={conv.otherUser.avatarUrl}
                              alt=""
                              className="w-5 h-5 rounded-full object-cover"
                            />
                          ) : (
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                              style={{ backgroundColor: conv.otherUser?.avatarColor || '#8B5CF6' }}
                            >
                              {(name || 'U')[0].toUpperCase()}
                            </div>
                          )}
                          <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-[#08090B]" />
                        </div>
                        <span className="truncate">{name}</span>
                      </div>
                      {conv.unreadCount > 0 && !isActive && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-purple-600 text-white">
                          {conv.unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Team Members Roster */}
          <div>
            <div className="px-2 mb-1.5 flex items-center justify-between text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <span>Team Members ({activeMembers.length})</span>
            </div>
            <div className="space-y-0.5">
              {activeMembers
                .filter(
                  (m) =>
                    !searchQuery ||
                    m.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (m.user.username && m.user.username.toLowerCase().includes(searchQuery.toLowerCase()))
                )
                .map((m) => (
                  <button
                    key={m.userId}
                    onClick={() => openDirectMessage(m)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 transition-all group"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="relative">
                        {m.user.avatarUrl ? (
                          <img
                            src={m.user.avatarUrl}
                            alt=""
                            className="w-5 h-5 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ backgroundColor: m.user.avatarColor || '#8B5CF6' }}
                          >
                            {m.user.name[0].toUpperCase()}
                          </div>
                        )}
                        <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-[#08090B]" />
                      </div>
                      <span className="truncate">{m.user.name}</span>
                    </div>
                    <span className="text-[10px] opacity-0 group-hover:opacity-100 text-purple-400 transition-opacity">
                      Chat
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Right: Main Chat Window ─── */}
      <div className="flex-1 flex flex-col bg-[#0C0D10] relative">
        {/* Chat Header */}
        <div className="h-16 border-b border-zinc-800/70 px-6 flex items-center justify-between bg-[#08090B]/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {activeConv?.type === 'GROUP' ? (
              <div className="w-8 h-8 rounded-lg bg-purple-900/30 border border-purple-700/40 flex items-center justify-center text-purple-400">
                <Hash size={18} />
              </div>
            ) : (
              <div className="relative">
                {activeConv?.otherUser?.avatarUrl ? (
                  <img
                    src={activeConv.otherUser.avatarUrl}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: activeConv?.otherUser?.avatarColor || '#8B5CF6' }}
                  >
                    {(activeConv?.otherUser?.name || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[#0C0D10]" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-zinc-100">
                  {activeConv?.type === 'GROUP' ? `#${activeConv.name}` : activeConv?.name}
                </h4>
                {activeConv?.type === 'GROUP' && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                    Team Channel
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500">
                {activeConv?.type === 'GROUP'
                  ? 'All members have access to this channel'
                  : 'Direct conversation with end-to-end delivery'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Connected</span>
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-3">
                <MessageSquare size={24} />
              </div>
              <h5 className="text-sm font-semibold text-zinc-300">No messages yet</h5>
              <p className="text-xs max-w-sm mt-1">
                Say hello to the team or start a discussion. Type @ to mention anyone.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = msg.senderId === myUserId;
              const sender = msg.sender;
              const hasMentions = Boolean(msg.mentions);

              return (
                <div
                  key={msg.id || idx}
                  className={`flex gap-3 items-start group ${isMe ? 'flex-row-reverse' : ''}`}
                >
                  {/* Sender Avatar */}
                  <div className="flex-shrink-0">
                    {sender.avatarUrl ? (
                      <img
                        src={sender.avatarUrl}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover ring-1 ring-zinc-700/50"
                      />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow"
                        style={{ backgroundColor: sender.avatarColor || '#8B5CF6' }}
                      >
                        {(sender.name || 'U')[0].toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div className={`max-w-[70%] space-y-1 ${isMe ? 'items-end' : ''}`}>
                    <div
                      className={`flex items-center gap-2 text-[11px] ${
                        isMe ? 'flex-row-reverse text-right' : ''
                      }`}
                    >
                      <span className="font-semibold text-zinc-300">{sender.name}</span>
                      <span className="text-zinc-500">{formatMessageTime(msg.createdAt)}</span>
                    </div>

                    <div
                      className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm transition-all ${
                        isMe
                          ? 'bg-purple-600 text-white rounded-tr-none'
                          : 'bg-[#14151B] text-zinc-200 border border-zinc-800 rounded-tl-none hover:border-zinc-700'
                      }`}
                    >
                      {renderMessageContent(msg.content)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Mention Dropdown Suggestions */}
        <AnimatePresence>
          {showMentionMenu && mentionCandidates.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-20 left-6 z-20 w-72 rounded-xl bg-[#14151B] border border-zinc-700/80 shadow-2xl p-1.5 space-y-1 overflow-hidden backdrop-blur-md"
            >
              <div className="px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                Mention Team Member
              </div>
              {mentionCandidates.map((m, idx) => (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => insertMention(m)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs transition-all ${
                    idx === mentionIndex
                      ? 'bg-purple-600/20 text-purple-200 border border-purple-500/30'
                      : 'text-zinc-300 hover:bg-zinc-800/50'
                  }`}
                >
                  {m.user.avatarUrl ? (
                    <img src={m.user.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ backgroundColor: m.user.avatarColor || '#8B5CF6' }}
                    >
                      {m.user.name[0].toUpperCase()}
                    </div>
                  )}
                  <div className="truncate flex-1">
                    <p className="font-medium text-zinc-200 truncate">{m.user.name}</p>
                    {m.user.username && (
                      <p className="text-[10px] text-zinc-500">@{m.user.username}</p>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase">
                    {m.role}
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Bar */}
        <div className="p-4 border-t border-zinc-800/70 bg-[#08090B]/80 backdrop-blur-sm">
          <div className="flex items-end gap-2 bg-[#111216] border border-zinc-800 rounded-xl p-2.5 focus-within:border-purple-500/50 transition-all shadow-inner">
            <textarea
              ref={inputRef}
              rows={1}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${
                activeConv?.type === 'GROUP' ? '#' + activeConv.name : activeConv?.name || 'team'
              }... (type @ to mention)`}
              className="flex-1 bg-transparent text-xs text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none max-h-32 custom-scrollbar py-1 leading-relaxed"
            />
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!inputText.trim() || isSending}
              className="p-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600 text-white transition-all flex-shrink-0"
            >
              <Send size={15} />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-zinc-500">
            <span>Press Enter to send, Shift+Enter for new line</span>
            <span className="text-zinc-600">DevFlow Realtime</span>
          </div>
        </div>
      </div>
    </div>
  );
};

