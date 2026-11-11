import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Paperclip,
  Smile,
  X,
  Sparkles,
  FileText,
  Image as ImageIcon,
  FolderKanban,
  Users,
  User as UserIcon,
  Search,
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import { FloatingTooltip } from '../common/FloatingTooltip';
import type { TeamMember } from '../../types/team';

interface ChatComposerProps {
  conversationId?: number;
  onSendMessage: (
    content: string,
    options?: {
      mentions?: number[];
      attachments?: Array<{ name: string; size: string; url?: string; type?: string }>;
      sharedEntity?: any;
      replyToId?: number;
    }
  ) => Promise<void>;
  isSending: boolean;
  teamMembers: TeamMember[];
  replyingTo?: { id: number; senderName: string; content: string } | null;
  onCancelReply?: () => void;
  onTyping?: (isTyping: boolean) => void;
}

const EMOJI_CATEGORIES = [
  {
    name: 'Reactions',
    emojis: ['👍', '👎', '❤️', '🔥', '🎉', '🚀', '👀', '🙌', '👏', '💯', '✨', '💡', '⚡', '✅', '❌', '🤖'],
  },
  {
    name: 'Smileys',
    emojis: ['😀', '😂', '🤣', '😊', '😍', '🥰', '😎', '🤔', '🤫', '😴', '🥳', '🤯', '🥺', '😇', '🤩', '🫠'],
  },
  {
    name: 'Work & Tech',
    emojis: ['💻', '📱', '⌨️', '🖱️', '📁', '📂', '📊', '📈', '📌', '📍', '📝', '✏️', '📦', '🔒', '🔑', '⚙️'],
  },
  {
    name: 'Gestures',
    emojis: ['🤝', '✌️', '🤞', '👊', '🤛', '🤜', '👋', '🫡', '🙏', '💪', '🤙', '👈', '👉', '👆', '👇', '🖐️'],
  },
  {
    name: 'Symbols & Fun',
    emojis: ['☕', '🍕', '🍔', '🎂', '🍻', '🏆', '🥇', '🎯', '🎲', '🎨', '🎭', '🎪', '🌟', '⭐', '🌈', '☀️'],
  },
];

type TagMode = 'member' | 'project' | 'team';

export const ChatComposer: React.FC<ChatComposerProps> = ({
  conversationId,
  onSendMessage,
  isSending,
  teamMembers,
  replyingTo,
  onCancelReply,
  onTyping,
}) => {
  const { orgMembers, projects, teams, playNotificationSound } = useChat();
  const { accentColor } = useAccentTheme();

  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState(0);

  // Attachment state
  const [attachment, setAttachment] = useState<{
    name: string;
    size: string;
    url?: string;
    type?: string;
  } | null>(null);

  // Tagging State (@ Member, # Project, $ Team)
  const [tagMode, setTagMode] = useState<TagMode | null>(null);
  const [tagQuery, setTagQuery] = useState('');
  const [tagIndex, setTagIndex] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up typing timeout
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // Load draft from localStorage on conversation switch
  useEffect(() => {
    if (!conversationId) return;
    const draftKey = `devflow_chat_draft_${conversationId}`;
    const saved = localStorage.getItem(draftKey) || '';
    setInputText(saved);
  }, [conversationId]);

  // Handle Text Change & Detect Tag Triggers (@, #, $)
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (onTyping) {
      onTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 2000);
    }

    if (conversationId) {
      const draftKey = `devflow_chat_draft_${conversationId}`;
      if (val.trim()) {
        localStorage.setItem(draftKey, val);
      } else {
        localStorage.removeItem(draftKey);
      }
    }

    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }

    // Detect cursor and tag triggers
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);

    const atMatch = textBeforeCursor.match(/@([a-zA-Z0-9_.-]*)$/);
    const hashMatch = textBeforeCursor.match(/#([a-zA-Z0-9_.-]*)$/);
    const dollarMatch = textBeforeCursor.match(/\$([a-zA-Z0-9_.-]*)$/);

    if (atMatch) {
      setTagMode('member');
      setTagQuery(atMatch[1] || '');
      setTagIndex(0);
    } else if (hashMatch) {
      setTagMode('project');
      setTagQuery(hashMatch[1] || '');
      setTagIndex(0);
    } else if (dollarMatch) {
      setTagMode('team');
      setTagQuery(dollarMatch[1] || '');
      setTagIndex(0);
    } else {
      setTagMode(null);
    }
  };

  // Filter tag candidates
  const tagCandidates = (() => {
    if (!tagMode) return [];
    const q = tagQuery.toLowerCase().trim();

    if (tagMode === 'member') {
      const combined = [
        ...teamMembers.map((tm) => ({
          id: tm.userId,
          name: tm.user?.name || 'Member',
          username: tm.user?.username || tm.user?.name.replace(/\s+/g, '').toLowerCase() || '',
          color: tm.user?.avatarColor || '#3B82F6',
        })),
        ...orgMembers.map((om) => ({
          id: om.userId,
          name: om.user?.name || 'Member',
          username: om.user && 'username' in om.user ? (om.user as any).username : om.user?.name.replace(/\s+/g, '').toLowerCase() || '',
          color: om.user?.avatarColor || '#8B5CF6',
        })),
      ];
      // Deduplicate by id
      const seen = new Set<number>();
      return combined
        .filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          if (!q) return true;
          return m.name.toLowerCase().includes(q) || m.username.toLowerCase().includes(q);
        })
        .slice(0, 5);
    }

    if (tagMode === 'project') {
      return (projects || [])
        .filter((p) => {
          if (!q) return true;
          return (
            (p.title || p.name || '').toLowerCase().includes(q) ||
            (p.key || p.identifier || '').toLowerCase().includes(q)
          );
        })
        .map((p) => ({
          id: p.id,
          name: p.title || p.name || `Project #${p.id}`,
          key: p.key || p.identifier || 'PROJ',
          color: p.avatarColor || p.color || '#10B981',
        }))
        .slice(0, 5);
    }

    if (tagMode === 'team') {
      return (teams || [])
        .filter((t) => {
          if (!q) return true;
          return t.name.toLowerCase().includes(q);
        })
        .map((t) => ({
          id: t.id,
          name: t.name,
          color: t.color || '#3B82F6',
        }))
        .slice(0, 5);
    }

    return [];
  })();

  // Insert selected tag into textarea
  const insertTag = (item: any) => {
    const cursorPos = inputRef.current?.selectionStart || inputText.length;
    const textBeforeCursor = inputText.slice(0, cursorPos);
    const textAfterCursor = inputText.slice(cursorPos);

    let newBefore = textBeforeCursor;
    if (tagMode === 'member') {
      newBefore = textBeforeCursor.replace(/@([a-zA-Z0-9_.-]*)$/, `@[${item.name}] `);
    } else if (tagMode === 'project') {
      newBefore = textBeforeCursor.replace(/#([a-zA-Z0-9_.-]*)$/, `#[${item.name}] `);
    } else if (tagMode === 'team') {
      newBefore = textBeforeCursor.replace(/\$([a-zA-Z0-9_.-]*)$/, `$[${item.name}] `);
    }

    const updated = newBefore + textAfterCursor;
    setInputText(updated);
    setTagMode(null);

    if (conversationId) {
      localStorage.setItem(`devflow_chat_draft_${conversationId}`, updated);
    }

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = newBefore.length;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (tagMode && tagCandidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setTagIndex((prev) => (prev + 1) % tagCandidates.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setTagIndex((prev) => (prev - 1 + tagCandidates.length) % tagCandidates.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertTag(tagCandidates[tagIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setTagMode(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    let finalContent = inputText.trim();
    if (!finalContent && !attachment) return;
    if (isSending) return;

    if (onTyping) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      onTyping(false);
    }

    const currentAttachment = attachment;
    const currentReplyTo = replyingTo;

    setInputText('');
    setAttachment(null);
    setShowEmojiPicker(false);
    setTagMode(null);

    if (conversationId) {
      localStorage.removeItem(`devflow_chat_draft_${conversationId}`);
    }

    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    onCancelReply?.();
    playNotificationSound('pop');

    await onSendMessage(finalContent || (currentAttachment ? `Attached: ${currentAttachment.name}` : ''), {
      attachments: currentAttachment ? [currentAttachment] : undefined,
      replyToId: currentReplyTo?.id,
    });
  };

  const handleInsertEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const sizeMb = file.size / (1024 * 1024);
      const sizeFormatted = sizeMb < 1 ? `${(file.size / 1024).toFixed(0)} KB` : `${sizeMb.toFixed(1)} MB`;

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setAttachment({
            name: file.name,
            size: sizeFormatted,
            url: event.target?.result as string,
            type: file.type,
          });
        };
        reader.readAsDataURL(file);
      } else {
        setAttachment({
          name: file.name,
          size: sizeFormatted,
          type: file.type,
        });
      }
    }
  };

  return (
    <div className="p-3 bg-zinc-950/95 border-t border-zinc-800/80 shrink-0 relative select-none">
      {/* ── Smart Tagging Autocomplete Menu (@ Member, # Project, $ Team) ── */}
      <AnimatePresence>
        {tagMode && tagCandidates.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-4 bottom-[calc(100%+8px)] z-40 w-64 rounded-2xl bg-zinc-900 border border-zinc-700/80 shadow-2xl p-1.5 divide-y divide-zinc-800"
          >
            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              {tagMode === 'member' && <UserIcon size={12} style={{ color: accentColor }} />}
              {tagMode === 'project' && <FolderKanban size={12} style={{ color: accentColor }} />}
              {tagMode === 'team' && <Users size={12} style={{ color: accentColor }} />}
              <span>
                {tagMode === 'member'
                  ? 'Tag Member (@)'
                  : tagMode === 'project'
                  ? 'Tag Project (#)'
                  : 'Tag Team ($)'}
              </span>
            </div>

            <div className="space-y-0.5 pt-1 max-h-44 overflow-y-auto no-scrollbar">
              {tagCandidates.map((item: any, idx) => {
                const isSelected = idx === tagIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => insertTag(item)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-left cursor-pointer transition-colors"
                    style={{
                      backgroundColor: isSelected ? `${accentColor}25` : undefined,
                      color: isSelected ? accentColor : undefined,
                    }}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      {tagMode === 'member' ? (
                        <div
                          className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                          style={{ backgroundColor: item.color }}
                        >
                          {item.name.slice(0, 2).toUpperCase()}
                        </div>
                      ) : tagMode === 'project' ? (
                        <FolderKanban size={13} style={{ color: item.color }} className="shrink-0" />
                      ) : (
                        <Users size={13} style={{ color: item.color }} className="shrink-0" />
                      )}

                      <span className="truncate font-medium text-zinc-200">
                        {item.name}
                      </span>
                    </div>

                    {item.key && (
                      <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                        {item.key}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Expanded Emoji Picker Popover ── */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-4 bottom-[calc(100%+8px)] z-40 p-2.5 rounded-2xl bg-zinc-900 border border-zinc-700/80 shadow-2xl w-[290px] space-y-2 backdrop-blur-md"
          >
            {/* Category Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar border-b border-zinc-800">
              {EMOJI_CATEGORIES.map((cat, idx) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setActiveEmojiCategory(idx)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap transition-colors cursor-pointer"
                  style={{
                    backgroundColor: activeEmojiCategory === idx ? `${accentColor}25` : undefined,
                    color: activeEmojiCategory === idx ? accentColor : '#A1A1AA',
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Emoji Grid */}
            <div className="grid grid-cols-8 gap-1 max-h-36 overflow-y-auto no-scrollbar">
              {EMOJI_CATEGORIES[activeEmojiCategory].emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleInsertEmoji(emoji)}
                  className="w-7 h-7 flex items-center justify-center text-base hover:bg-zinc-800 rounded-lg cursor-pointer transition-transform active:scale-125"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Replying Context Bar ── */}
      {replyingTo && (
        <div className="flex items-center justify-between px-3 py-1.5 mb-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs">
          <div className="flex items-center gap-2 truncate text-zinc-400">
            <span style={{ color: accentColor }} className="font-semibold">
              Replying to {replyingTo.senderName}:
            </span>
            <span className="truncate text-zinc-300 max-w-[240px]">{replyingTo.content}</span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="p-1 text-zinc-500 hover:text-white rounded cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Attachment Preview Chip ── */}
      {attachment && (
        <div className="flex items-center gap-2 px-3 py-1.5 mb-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 w-fit shadow-xs">
          {attachment.url ? (
            <img
              src={attachment.url}
              alt={attachment.name}
              className="w-6 h-6 object-cover rounded shrink-0 border border-zinc-700"
            />
          ) : (
            <FileText size={14} style={{ color: accentColor }} />
          )}
          <span className="font-medium truncate max-w-[180px]">{attachment.name}</span>
          <span className="text-[10px] text-zinc-500 font-mono">({attachment.size})</span>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            className="p-0.5 text-zinc-500 hover:text-white rounded cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Composer Input Box ── */}
      <div
        className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-2.5 transition-all shadow-inner focus-within:border-zinc-700"
        style={{
          boxShadow: `0 0 0 1px ${accentColor}15`,
        }}
      >
        <textarea
          ref={inputRef}
          value={inputText}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Message or type @ for members, # for projects, $ for teams..."
          rows={1}
          className="w-full bg-transparent px-2 text-xs text-white placeholder-zinc-500 resize-none focus:outline-none max-h-32 leading-relaxed"
        />

        {/* Bottom Bar: Action Icons + Send Button */}
        <div className="flex items-center justify-between pt-1.5 px-1">
          <div className="flex items-center gap-1 text-zinc-400">
            {/* Attachment Button */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
            />
            <FloatingTooltip content="Attach file or image" side="top">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded-lg hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <Paperclip size={15} />
              </button>
            </FloatingTooltip>

            {/* Emoji Button */}
            <FloatingTooltip content="Add emoji" side="top">
              <button
                type="button"
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                className="p-1.5 rounded-lg hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <Smile size={15} />
              </button>
            </FloatingTooltip>

            <span className="text-[10px] text-zinc-500 pl-1 hidden sm:inline">
              @ member • # project • $ team
            </span>
          </div>

          {/* Send Button */}
          <FloatingTooltip content="Send message (Enter)" side="top">
            <button
              type="button"
              onClick={handleSend}
              disabled={(!inputText.trim() && !attachment) || isSending}
              className="p-2 rounded-xl transition-all cursor-pointer shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: inputText.trim() || attachment ? accentColor : '#27272A',
                color: '#FFFFFF',
              }}
            >
              <Send size={13} className={isSending ? 'animate-pulse' : ''} />
            </button>
          </FloatingTooltip>
        </div>
      </div>
    </div>
  );
};
