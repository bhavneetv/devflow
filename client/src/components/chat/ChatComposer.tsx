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
} from 'lucide-react';
import type { TeamMember } from '../../types/team';

interface ChatComposerProps {
  conversationId?: number;
  onSendMessage: (
    content: string,
    options?: {
      mentions?: number[];
      attachments?: Array<{ name: string; size: string }>;
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

const COMMON_EMOJIS = [
  '👍', '❤️', '🚀', '🎉', '🔥', '👀', '✨', '🙌',
  '💡', '⚡', '✅', '❌', '💯', '👏', '🤖', '💬'
];

export const ChatComposer: React.FC<ChatComposerProps> = ({
  conversationId,
  onSendMessage,
  isSending,
  teamMembers,
  replyingTo,
  onCancelReply,
  onTyping,
}) => {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachment, setAttachment] = useState<{ name: string; size: string } | null>(null);

  // Mention State
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);

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

  // Save draft to localStorage on change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);

    // Emit typing indicator
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

    // Auto resize textarea
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }

    // Detect @mentions
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

  const mentionCandidates = teamMembers
    .filter((m) => {
      if (!showMentionMenu) return false;
      const q = mentionQuery.toLowerCase();
      const name = (m.user?.name || '').toLowerCase();
      const username = (m.user?.username || '').toLowerCase();
      return name.includes(q) || username.includes(q);
    })
    .slice(0, 5);

  const insertMention = (member: TeamMember) => {
    const handle = member.user?.username || member.user?.name.replace(/\s+/g, '');
    const cursorPos = inputRef.current?.selectionStart || inputText.length;
    const textBeforeCursor = inputText.slice(0, cursorPos);
    const textAfterCursor = inputText.slice(cursorPos);

    const newBefore = textBeforeCursor.replace(/@([a-zA-Z0-9_.-]*)$/, `@${handle} `);
    const updated = newBefore + textAfterCursor;
    setInputText(updated);
    setShowMentionMenu(false);

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
    setShowMentionMenu(false);

    if (conversationId) {
      localStorage.removeItem(`devflow_chat_draft_${conversationId}`);
    }

    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    onCancelReply?.();
    await onSendMessage(finalContent || (currentAttachment ? `Attached: ${currentAttachment.name}` : ''), {
      attachments: currentAttachment ? [currentAttachment] : undefined,
      replyToId: currentReplyTo?.id,
    });
  };

  const handleInsertEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    setShowEmojiPicker(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setAttachment({ name: file.name, size: `${sizeMb} MB` });
    }
  };

  return (
    <div className="p-3 bg-zinc-950/95 border-t border-zinc-800/80 shrink-0 relative select-none">
      {/* Mention Auto-complete Menu */}
      <AnimatePresence>
        {showMentionMenu && mentionCandidates.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-4 bottom-[calc(100%+8px)] z-30 w-56 rounded-xl bg-zinc-900 border border-zinc-700/80 shadow-2xl p-1 divide-y divide-zinc-800"
          >
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Mention Member
            </div>
            <div className="space-y-0.5 pt-1">
              {mentionCandidates.map((m, idx) => (
                <button
                  key={m.id}
                  onClick={() => insertMention(m)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left cursor-pointer transition-colors ${
                    idx === mentionIndex
                      ? 'bg-purple-600/20 text-purple-300 font-semibold'
                      : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{ backgroundColor: m.user?.avatarColor || '#3B82F6' }}
                  >
                    {(m.user?.name || 'U').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="truncate min-w-0">
                    <span className="truncate block">{m.user?.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emoji Picker Popover */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-4 bottom-[calc(100%+8px)] z-30 p-2 rounded-xl bg-zinc-900 border border-zinc-700/80 shadow-2xl grid grid-cols-8 gap-1"
          >
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleInsertEmoji(emoji)}
                className="w-8 h-8 flex items-center justify-center text-lg hover:bg-zinc-800 rounded-lg cursor-pointer transition-transform active:scale-125"
              >
                {emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Replying Context Bar */}
      {replyingTo && (
        <div className="flex items-center justify-between px-3 py-1.5 mb-2 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs">
          <div className="flex items-center gap-2 truncate text-zinc-400">
            <span className="text-purple-400 font-semibold">Replying to {replyingTo.senderName}:</span>
            <span className="truncate text-zinc-300 max-w-[240px]">{replyingTo.content}</span>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 text-zinc-500 hover:text-white rounded cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Attachment Preview Chip */}
      {attachment && (
        <div className="flex items-center gap-2 px-2.5 py-1 mb-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 w-fit">
          <FileText size={13} className="text-purple-400" />
          <span className="font-medium truncate max-w-[180px]">{attachment.name}</span>
          <span className="text-[10px] text-zinc-500">({attachment.size})</span>
          <button
            onClick={() => setAttachment(null)}
            className="p-0.5 text-zinc-500 hover:text-white rounded cursor-pointer"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Composer Input Box */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-2 focus-within:border-purple-500/80 focus-within:ring-1 focus-within:ring-purple-500/20 transition-all shadow-inner">
        <textarea
          ref={inputRef}
          value={inputText}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Message or type @ to mention..."
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
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-lg hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Attach image or file"
            >
              <Paperclip size={15} />
            </button>

            {/* Emoji Button */}
            <button
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className="p-1.5 rounded-lg hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Add emoji"
            >
              <Smile size={15} />
            </button>

            <span className="text-[10px] text-zinc-600 pl-1 hidden sm:inline">
              Return to send, Shift+Return for newline
            </span>
          </div>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={(!inputText.trim() && !attachment) || isSending}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              inputText.trim() || attachment
                ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md active:scale-95'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
            }`}
            title="Send message (Enter)"
          >
            <Send size={13} className={isSending ? 'animate-pulse' : ''} />
          </button>
        </div>
      </div>
    </div>
  );
};

