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
  Download,
  FolderKanban,
  Users,
  User as UserIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAccentTheme } from '../../services/accentTheme.service';
import { UserAvatar } from '../common/UserAvatar';
import { FloatingTooltip } from '../common/FloatingTooltip';
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
  const { accentColor } = useAccentTheme();
  const shouldReduceMotion = useReducedMotion();
  const [showActionBar, setShowActionBar] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [localReactions, setLocalReactions] = useState<{ [emoji: string]: number }>({});
  const [userReacted, setUserReacted] = useState<{ [emoji: string]: boolean }>({});

  const senderName = message.sender?.name || 'Collaborator';
  const senderColor = message.sender?.avatarColor || (isMyMessage ? accentColor : '#3B82F6');

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
  let parsedAttachments: Array<{ name: string; url?: string; size?: string; type?: string }> = [];
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

  // Render message text with highlight chips for @members, #projects, $teams, REQ-xxx, PR-xxx
  const renderMessageContent = (content: string) => {
    const tokenRegex = /(@\[[^\]]+\]|#\[[^\]]+\]|\$\[[^\]]+\]|@[a-zA-Z0-9_.-]+|#[a-zA-Z0-9_.-]+|\$[a-zA-Z0-9_.-]+|REQ-\d+|PR-\d+)/g;
    const parts = content.split(tokenRegex);

    return parts.map((part, idx) => {
      // 1. Member Tag (@member or @[Member Name]) -> Strip @ and render highlight chip
      if (part.startsWith('@')) {
        const cleanName = part.replace(/^@(?:\[([^\]]+)\]|([a-zA-Z0-9_.-]+))$/, '$1$2');
        return (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[11px] font-semibold mx-0.5 border shadow-2xs"
            style={{
              backgroundColor: `${accentColor}25`,
              borderColor: `${accentColor}60`,
              color: isMyMessage ? '#FFFFFF' : accentColor,
            }}
          >
            <UserIcon size={10} className="shrink-0" />
            <span>{cleanName}</span>
          </span>
        );
      }

      // 2. Project Tag (#project or #[Project Name]) -> Strip # and render highlight chip
      if (part.startsWith('#')) {
        const cleanProject = part.replace(/^#(?:\[([^\]]+)\]|([a-zA-Z0-9_.-]+))$/, '$1$2');
        return (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[11px] font-semibold mx-0.5 border shadow-2xs"
            style={{
              backgroundColor: `${accentColor}25`,
              borderColor: `${accentColor}60`,
              color: isMyMessage ? '#FFFFFF' : accentColor,
            }}
          >
            <FolderKanban size={10} className="shrink-0" />
            <span>{cleanProject}</span>
          </span>
        );
      }

      // 3. Team Tag ($team or $[Team Name]) -> Strip $ and render highlight chip
      if (part.startsWith('$')) {
        const cleanTeam = part.replace(/^\$(?:\[([^\]]+)\]|([a-zA-Z0-9_.-]+))$/, '$1$2');
        return (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[11px] font-semibold mx-0.5 border shadow-2xs"
            style={{
              backgroundColor: `${accentColor}25`,
              borderColor: `${accentColor}60`,
              color: isMyMessage ? '#FFFFFF' : accentColor,
            }}
          >
            <Users size={10} className="shrink-0" />
            <span>{cleanTeam}</span>
          </span>
        );
      }

      if (/^REQ-\d+$/i.test(part)) {
        return (
          <Link
            key={idx}
            to={`/requirements`}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[11px] font-mono font-semibold mx-0.5 border hover:opacity-90 transition-opacity"
            style={{
              backgroundColor: `${accentColor}25`,
              borderColor: `${accentColor}55`,
              color: isMyMessage ? '#FFFFFF' : accentColor,
            }}
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
            className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[11px] font-mono font-semibold text-blue-300 bg-blue-950/70 border border-blue-800/60 hover:bg-blue-900/50 mx-0.5 transition-colors"
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
      <div
        className={`px-3.5 py-1 text-xs text-zinc-500 italic flex items-center gap-2 ${
          isMyMessage ? 'justify-end' : 'justify-start'
        }`}
      >
        <span>This message was deleted</span>
        <span className="text-[10px] text-zinc-600 font-mono">{formatTime(message.createdAt)}</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      onMouseEnter={() => setShowActionBar(true)}
      onMouseLeave={() => setShowActionBar(false)}
      className={`relative px-2.5 py-1 group transition-colors flex ${
        isMyMessage ? 'justify-end' : 'justify-start'
      } ${isGrouped ? 'mt-0.5' : 'mt-2'}`}
    >
      {/* Outer row with avatar + bubble */}
      <div
        className={`relative flex items-end gap-2 max-w-[88%] sm:max-w-[78%] ${
          isMyMessage ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        {/* Avatar - only shown if not grouped */}
        <div className="shrink-0 mb-0.5">
          {!isGrouped ? (
            <UserAvatar
              user={message.sender}
              name={senderName}
              avatarColor={senderColor}
              size="xs"
              rounded="xl"
            />
          ) : (
            <div className="w-5" />
          )}
        </div>

        {/* Message Bubble + Meta Container */}
        <div className={`flex flex-col ${isMyMessage ? 'items-end' : 'items-start'} min-w-0`}>
          {/* Sender Name & Timestamp (if not grouped) */}
          {!isGrouped && (
            <div
              className={`flex items-baseline gap-1.5 mb-1 px-1 text-[11px] ${
                isMyMessage ? 'flex-row-reverse text-right' : 'flex-row text-left'
              }`}
            >
              <span className="font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer">
                {isMyMessage ? 'You' : senderName}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {formatTime(message.createdAt)}
              </span>
              {message.isEdited && (
                <span className="text-[9px] text-zinc-500 italic">(edited)</span>
              )}
            </div>
          )}

          {/* Floating Action Bar on hover */}
          {showActionBar && !isEditing && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 2 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.12 }}
              className={`absolute -top-3.5 z-20 flex items-center gap-0.5 p-1 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-xl text-xs backdrop-blur-md ${
                isMyMessage ? 'right-8' : 'left-8'
              }`}
            >
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleToggleReaction(emoji)}
                  className="p-1 hover:bg-zinc-800 rounded-lg transition-transform active:scale-125 cursor-pointer text-xs"
                >
                  {emoji}
                </button>
              ))}

              {onReply && (
                <FloatingTooltip content="Reply" side="top">
                  <button
                    onClick={() => onReply(message)}
                    className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <Reply size={12} />
                  </button>
                </FloatingTooltip>
              )}

              {onTogglePin && (
                <FloatingTooltip content={message.isPinned ? 'Unpin message' : 'Pin message'} side="top">
                  <button
                    onClick={() => onTogglePin(message.id)}
                    className="p-1 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer text-zinc-400 hover:text-white"
                    style={{
                      color: message.isPinned ? accentColor : undefined,
                    }}
                  >
                    <Pin size={12} />
                  </button>
                </FloatingTooltip>
              )}

              {onCreateTaskFromMessage && (
                <FloatingTooltip content="Create task from message" side="top">
                  <button
                    onClick={() => onCreateTaskFromMessage(message)}
                    className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-emerald-300 transition-colors cursor-pointer"
                  >
                    <CheckSquare size={12} />
                  </button>
                </FloatingTooltip>
              )}

              {isMyMessage && onEditMessage && (
                <FloatingTooltip content="Edit message" side="top">
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setEditContent(message.content);
                    }}
                    className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <Pencil size={12} />
                  </button>
                </FloatingTooltip>
              )}

              {isMyMessage && onDeleteMessage && (
                <FloatingTooltip content="Delete message" side="top">
                  <button
                    onClick={() => onDeleteMessage(message.id)}
                    className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                </FloatingTooltip>
              )}
            </motion.div>
          )}

          {/* Actual Chat Bubble */}
          <div
            className={`relative px-3.5 py-2.5 transition-all text-xs leading-relaxed break-words whitespace-pre-wrap select-text border shadow-xs ${
              isMyMessage
                ? 'rounded-2xl rounded-br-xs text-white'
                : 'rounded-2xl rounded-bl-xs text-zinc-200 bg-zinc-900/90 border-zinc-800'
            }`}
            style={{
              backgroundColor: isMyMessage ? `${accentColor}25` : undefined,
              borderColor: isMyMessage ? `${accentColor}55` : undefined,
            }}
          >
            {/* Pinned Pill Header */}
            {message.isPinned && (
              <div
                className="flex items-center gap-1.5 mb-1.5 text-[10px] font-semibold"
                style={{ color: accentColor }}
              >
                <Pin size={10} className="rotate-45" />
                <span>Pinned message</span>
              </div>
            )}

            {isEditing ? (
              <div className="space-y-1.5 pt-0.5 min-w-[200px]">
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
                  className="w-full bg-zinc-950/80 border rounded-lg p-2 text-xs text-white focus:outline-none"
                  style={{ borderColor: accentColor }}
                  rows={2}
                  autoFocus
                />
                <div className="flex items-center gap-2 text-[10px]">
                  <button
                    onClick={handleSaveEdit}
                    className="px-2 py-0.5 rounded text-white font-semibold cursor-pointer shadow-sm"
                    style={{ backgroundColor: accentColor }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-2 py-0.5 rounded text-zinc-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>{renderMessageContent(message.content)}</div>
            )}

            {/* Render Shared DevFlow Entity Card */}
            {parsedEntity && (
              <div className="mt-2 p-2 rounded-xl bg-zinc-950/70 border border-zinc-800 hover:border-zinc-700 transition-all shadow-sm max-w-xs">
                <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold text-zinc-300">
                  {parsedEntity.type === 'REQUIREMENT' ? (
                    <FileText size={12} style={{ color: accentColor }} />
                  ) : parsedEntity.type === 'PULL_REQUEST' ? (
                    <GitPullRequest size={12} className="text-blue-400" />
                  ) : (
                    <CheckSquare size={12} className="text-emerald-400" />
                  )}
                  <span className="font-mono" style={{ color: accentColor }}>
                    {parsedEntity.id}
                  </span>
                  {parsedEntity.status && (
                    <span className="px-1 py-0.2 rounded text-[8px] uppercase tracking-wider bg-zinc-800 text-zinc-300">
                      {parsedEntity.status}
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-medium text-white truncate">{parsedEntity.title || 'DevFlow Record'}</p>
              </div>
            )}

            {/* Render Attachments */}
            {parsedAttachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {parsedAttachments.map((att, i) => (
                  <div key={i} className="rounded-xl overflow-hidden">
                    {att.url && att.type?.startsWith('image/') ? (
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group/img relative"
                      >
                        <img
                          src={att.url}
                          alt={att.name}
                          className="max-w-[190px] max-h-[130px] object-cover rounded-xl border border-zinc-800 group-hover/img:border-zinc-600 transition-colors shadow-sm"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-xs gap-1 font-medium rounded-xl">
                          <Download size={12} />
                          <span>View</span>
                        </div>
                      </a>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-[11px] text-zinc-300 hover:border-zinc-700 transition-colors">
                        <FileText size={13} style={{ color: accentColor }} className="shrink-0" />
                        <div className="truncate max-w-[130px]">
                          <div className="font-medium truncate text-zinc-200">{att.name}</div>
                          {att.size && <div className="text-[9px] text-zinc-500 font-mono">{att.size}</div>}
                        </div>
                        {att.url && (
                          <FloatingTooltip content="Download file" side="top">
                            <a
                              href={att.url}
                              download={att.name}
                              className="p-1 text-zinc-400 hover:text-white rounded ml-1"
                            >
                              <Download size={12} />
                            </a>
                          </FloatingTooltip>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Bubble Footer for Sender: Small time indicator */}
            {isGrouped && (
              <div
                className={`text-[9px] font-mono mt-1 text-right opacity-60 ${
                  isMyMessage ? 'text-zinc-300' : 'text-zinc-500'
                }`}
              >
                {formatTime(message.createdAt)}
              </div>
            )}
          </div>

          {/* Render Reactions below bubble */}
          {Object.entries(localReactions).some(([_, count]) => count > 0) && (
            <div className={`flex items-center gap-1 flex-wrap pt-1 ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
              {Object.entries(localReactions).map(([emoji, count]) => {
                if (count <= 0) return null;
                const active = userReacted[emoji];
                return (
                  <button
                    key={emoji}
                    onClick={() => handleToggleReaction(emoji)}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: active ? `${accentColor}25` : '#18181B',
                      borderColor: active ? `${accentColor}55` : '#27272A',
                      color: active ? accentColor : '#A1A1AA',
                    }}
                  >
                    <span>{emoji}</span>
                    <span className="text-[10px] font-mono">{count}</span>
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

