import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Smile,
  Reply,
  Shield,
  Crown,
  Check,
  CheckCheck,
  ExternalLink,
  Pin,
  Pencil,
  Trash2,
  CheckSquare,
  FileText,
  GitPullRequest,
  AlertCircle,
  Paperclip,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { TeamMessage } from '../../types/team';

interface ChatMessageItemProps {
  message: TeamMessage;
  isMyMessage: boolean;
  isGrouped: boolean;
  onReply?: (message: TeamMessage) => void;
  onAddReaction?: (messageId: number, emoji: string) => void;
  onEditMessage?: (messageId: number, newContent: string) => void;
  onDeleteMessage?: (messageId: number) => void;
  onTogglePin?: (messageId: number) => void;
  onCreateTaskFromMessage?: (message: TeamMessage) => void;
}

const QUICK_REACTIONS = ['👍', '❤️', '🚀', '👀', '🎉'];

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  isMyMessage,
  isGrouped,
  onReply,
  onAddReaction,
  onEditMessage,
  onDeleteMessage,
  onTogglePin,
  onCreateTaskFromMessage,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [showActionBar, setShowActionBar] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [localReactions, setLocalReactions] = useState<{ [emoji: string]: number }>({});
  const [userReacted, setUserReacted] = useState<{ [emoji: string]: boolean }>({});

  const senderName = message.sender?.name || 'Collaborator';
  const senderColor = message.sender?.avatarColor || (isMyMessage ? '#3B82F6' : '#8B5CF6');
  const initials = senderName.slice(0, 2).toUpperCase();

  const handleToggleReaction = (emoji: string) => {
    setLocalReactions((prev) => {
      const current = prev[emoji] || 0;
      const isAlready = userReacted[emoji];
      return {
        ...prev,
        [emoji]: isAlready ? Math.max(0, current - 1) : current + 1,
      };
    });
    setUserReacted((prev) => ({
      ...prev,
      [emoji]: !prev[emoji],
    }));
    onAddReaction?.(message.id, emoji);
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent.trim() !== message.content) {
      onEditMessage?.(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Parse attachments if present
  let parsedAttachments: Array<{ name: string; url?: string; size?: string }> = [];
  if (message.attachments) {
    try {
      parsedAttachments = JSON.parse(message.attachments);
    } catch {
      // ignore
    }
  }

  // Parse shared DevFlow record if present
  let parsedEntity: { type?: string; id?: string; title?: string; status?: string; priority?: string } | null = null;
  if (message.sharedEntity) {
    try {
      parsedEntity = JSON.parse(message.sharedEntity);
    } catch {
      // ignore
    }
  }

  // Render message text with @mention highlights, REQ-xxx tokens, #tasks, PR-xxx
  const renderMessageContent = (content: string) => {
    const tokenRegex = /(@[a-zA-Z0-9_.-]+|REQ-\d+|#[0-9]+|PR-\d+)/g;
    const parts = content.split(tokenRegex);

    return parts.map((part, idx) => {
      if (part.startsWith('@')) {
        return (
          <span
            key={idx}
            className="inline-flex items-center px-1.5 py-0.2 rounded-md text-[11px] font-semibold text-purple-300 bg-purple-950/60 border border-purple-800/50 mx-0.5"
          >
            {part}
          </span>
        );
      }
      if (/^REQ-\d+$/i.test(part)) {
        return (
          <Link
            key={idx}
            to={`/requirements`}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[11px] font-mono font-semibold text-purple-300 bg-purple-950/60 border border-purple-800/50 hover:bg-purple-900/50 mx-0.5 transition-colors"
          >
            <span>{part}</span>
            <ExternalLink size={9} />
          </Link>
        );
      }
      if (/^#[0-9]+$/.test(part)) {
        return (
          <Link
            key={idx}
            to={`/tasks`}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[11px] font-mono font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-800/50 hover:bg-emerald-900/50 mx-0.5 transition-colors"
          >
            <span>{part}</span>
            <ExternalLink size={9} />
          </Link>
        );
      }
      if (/^PR-\d+$/i.test(part)) {
        return (
          <Link
            key={idx}
            to={`/pull-requests`}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[11px] font-mono font-semibold text-blue-300 bg-blue-950/60 border border-blue-800/50 hover:bg-blue-900/50 mx-0.5 transition-colors"
          >
            <GitPullRequest size={9} />
            <span>{part}</span>
          </Link>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  if (message.isDeleted) {
    return (
      <div className="px-3.5 py-1 text-xs text-zinc-500 italic flex items-center gap-2">
        <span>This message was deleted</span>
        <span className="text-[10px] text-zinc-600 font-mono">{formatTime(message.createdAt)}</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setShowActionBar(true)}
      onMouseLeave={() => setShowActionBar(false)}
      className={`relative px-3.5 py-1.5 rounded-xl group transition-colors ${
        showActionBar ? 'bg-zinc-900/50' : 'hover:bg-zinc-900/30'
      } ${isGrouped ? 'mt-0.5' : 'mt-2.5'} ${message.isPinned ? 'border-l-2 border-purple-500 bg-purple-950/10' : ''}`}
    >
      {/* Pinned Pill Header */}
      {message.isPinned && (
        <div className="flex items-center gap-1.5 mb-1 text-[10px] text-purple-400 font-medium">
          <Pin size={10} className="rotate-45" />
          <span>Pinned by team</span>
        </div>
      )}

      {/* Floating Action Bar on hover */}
      {showActionBar && !isEditing && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.15 }}
          className="absolute right-4 -top-3 z-20 flex items-center gap-0.5 p-1 bg-zinc-900 border border-zinc-700/80 rounded-lg shadow-xl text-xs"
        >
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleToggleReaction(emoji)}
              className="p-1 hover:bg-zinc-800 rounded transition-transform active:scale-125 cursor-pointer text-sm"
              title={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}

          {onReply && (
            <button
              onClick={() => onReply(message)}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Reply to message"
            >
              <Reply size={13} />
            </button>
          )}

          {onTogglePin && (
            <button
              onClick={() => onTogglePin(message.id)}
              className={`p-1 hover:bg-zinc-800 rounded transition-colors cursor-pointer ${
                message.isPinned ? 'text-purple-400' : 'text-zinc-400 hover:text-white'
              }`}
              title={message.isPinned ? 'Unpin message' : 'Pin message'}
            >
              <Pin size={13} />
            </button>
          )}

          {onCreateTaskFromMessage && (
            <button
              onClick={() => onCreateTaskFromMessage(message)}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-emerald-300 transition-colors cursor-pointer"
              title="Create Task from this message"
            >
              <CheckSquare size={13} />
            </button>
          )}

          {isMyMessage && onEditMessage && (
            <button
              onClick={() => {
                setIsEditing(true);
                setEditContent(message.content);
              }}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Edit message"
            >
              <Pencil size={13} />
            </button>
          )}

          {isMyMessage && onDeleteMessage && (
            <button
              onClick={() => onDeleteMessage(message.id)}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
              title="Delete message"
            >
              <Trash2 size={13} />
            </button>
          )}
        </motion.div>
      )}

      <div className="flex items-start gap-3">
        {/* Avatar */}
        {!isGrouped ? (
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5 shadow-sm border border-white/10"
            style={{ backgroundColor: senderColor }}
          >
            {initials}
          </div>
        ) : (
          <div className="w-8 shrink-0 text-[10px] text-zinc-600 font-mono opacity-0 group-hover:opacity-100 transition-opacity text-right pt-0.5">
            {formatTime(message.createdAt)}
          </div>
        )}

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          {!isGrouped && (
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs font-semibold text-white hover:underline cursor-pointer">
                {senderName}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {formatTime(message.createdAt)}
              </span>
              {message.isEdited && (
                <span className="text-[10px] text-zinc-500 font-normal italic">(edited)</span>
              )}
            </div>
          )}

          {isEditing ? (
            <div className="space-y-1.5 pt-1">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveEdit();
                  } else if (e.key === 'Escape') {
                    setIsEditing(false);
                  }
                }}
                className="w-full bg-zinc-900 border border-purple-500/50 rounded-lg p-2 text-xs text-white focus:outline-none"
                rows={2}
                autoFocus
              />
              <div className="flex items-center gap-2 text-[10px]">
                <button
                  onClick={handleSaveEdit}
                  className="px-2 py-0.5 rounded bg-purple-600 text-white font-semibold cursor-pointer"
                >
                  Save (Enter)
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-2 py-0.5 rounded text-zinc-400 hover:text-white cursor-pointer"
                >
                  Cancel (Esc)
                </button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-zinc-300 leading-relaxed break-words whitespace-pre-wrap select-text">
              {renderMessageContent(message.content)}
            </div>
          )}

          {/* Render Shared DevFlow Entity Card */}
          {parsedEntity && (
            <div className="mt-2 p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-purple-500/40 transition-all shadow-sm max-w-sm">
              <div className="flex items-center gap-2 mb-1 text-[11px] font-bold text-zinc-300">
                {parsedEntity.type === 'REQUIREMENT' ? (
                  <FileText size={13} className="text-purple-400" />
                ) : parsedEntity.type === 'PULL_REQUEST' ? (
                  <GitPullRequest size={13} className="text-blue-400" />
                ) : (
                  <CheckSquare size={13} className="text-emerald-400" />
                )}
                <span className="font-mono text-purple-300">{parsedEntity.id}</span>
                {parsedEntity.status && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] uppercase tracking-wider bg-zinc-800 text-zinc-300">
                    {parsedEntity.status}
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-white truncate">{parsedEntity.title || 'DevFlow Record'}</p>
            </div>
          )}

          {/* Render Attachments */}
          {parsedAttachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {parsedAttachments.map((att, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors"
                >
                  <Paperclip size={12} className="text-purple-400" />
                  <span className="truncate max-w-[160px]">{att.name}</span>
                  {att.size && <span className="text-[10px] text-zinc-500 font-mono">({att.size})</span>}
                </div>
              ))}
            </div>
          )}

          {/* Render Reactions */}
          {Object.entries(localReactions).some(([_, count]) => count > 0) && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1.5">
              {Object.entries(localReactions).map(([emoji, count]) => {
                if (count <= 0) return null;
                const active = userReacted[emoji];
                return (
                  <button
                    key={emoji}
                    onClick={() => handleToggleReaction(emoji)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                      active
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-xs'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <span>{emoji}</span>
                    <span className="text-[11px] font-mono">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
