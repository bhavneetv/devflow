import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Calendar,
  Clock,
  Edit3,
  ExternalLink,
  FileText,
  Layers,
  Link2,
  MessageSquare,
  Paperclip,
  Send,
  Tag,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { developmentService } from '../../services/development.service';
import { documentService } from '../../services/document.service';
import { confirmDeleteSwal } from '../../lib/confirmAlert';
import { formatDistanceToNow } from '../../lib/dateUtils';
import { AnimatedSelect } from '../settings/AnimatedSelect';
import { useAccentTheme } from '../../services/accentTheme.service';
import type {
  DevelopmentProjectConfig,
  DevelopmentTaskActivity,
  DevelopmentTaskAttachment,
  DevelopmentTaskComment,
  DevelopmentTaskItem,
} from '../../types/development';
import { DEV_PRIORITIES } from '../../types/development';
import type { ProjectDocument } from '../../types/document';
import {
  DevAvatarStack,
  formatDevDate,
  formatEffort,
  PriorityBadge,
  StatusBadge,
  TaskTypeBadge,
} from './devBadges';

type DrawerTab = 'details' | 'attachments' | 'comments' | 'activity';

interface DevelopmentTaskDrawerProps {
  projectId: number;
  task: DevelopmentTaskItem | null;
  config: DevelopmentProjectConfig;
  canEditTasks: boolean;
  onClose: () => void;
  onEditFull: (task: DevelopmentTaskItem) => void;
  onTaskUpdated: (task: DevelopmentTaskItem) => void;
  onTaskDeleted: (taskId: number) => void;
}

export const DevelopmentTaskDrawer: React.FC<DevelopmentTaskDrawerProps> = ({
  projectId,
  task,
  config,
  canEditTasks,
  onClose,
  onEditFull,
  onTaskUpdated,
  onTaskDeleted,
}) => {
  const { accentColor } = useAccentTheme();
  const [activeTab, setActiveTab] = useState<DrawerTab>('details');
  const [detailTask, setDetailTask] = useState<
    | (DevelopmentTaskItem & {
        comments: DevelopmentTaskComment[];
        activities: DevelopmentTaskActivity[];
      })
    | null
  >(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Quick update fields
  const [isUpdatingField, setIsUpdatingField] = useState(false);

  // Comments
  const [commentBody, setCommentBody] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);

  // Attachments
  const [projectDocs, setProjectDocs] = useState<ProjectDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [extName, setExtName] = useState('');
  const [extUrl, setExtUrl] = useState('');
  const [isAddingAttachment, setIsAddingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  useEffect(() => {
    if (!task) {
      setDetailTask(null);
      return;
    }
    setActiveTab('details');
    setAttachmentError(null);
    setCommentBody('');
    setIsLoadingDetail(true);

    Promise.all([
      developmentService.getTaskDetail(projectId, task.id),
      documentService.listDocuments(projectId, { limit: 100 }),
    ]).then(([detailRes, docsRes]) => {
      setIsLoadingDetail(false);
      if (detailRes.success && detailRes.data) {
        setDetailTask(detailRes.data);
      }
      if (docsRes.success && docsRes.data?.documents) {
        setProjectDocs(docsRes.data.documents);
      }
    });
  }, [projectId, task?.id]);

  if (!task) return null;

  const active = detailTask || {
    ...task,
    comments: [] as DevelopmentTaskComment[],
    activities: [] as DevelopmentTaskActivity[],
    attachments: (task.attachments || []) as DevelopmentTaskAttachment[],
  };

  const refreshDetail = async () => {
    const res = await developmentService.getTaskDetail(projectId, task.id);
    if (res.success && res.data) {
      setDetailTask(res.data);
      onTaskUpdated(res.data);
    }
  };

  const handleQuickPatch = async (patch: Record<string, any>) => {
    if (!canEditTasks) return;
    setIsUpdatingField(true);
    const res = await developmentService.updateTask(projectId, task.id, patch);
    setIsUpdatingField(false);
    if (res.success && res.data) {
      onTaskUpdated(res.data);
      await refreshDetail();
    }
  };

  const handleDeleteTask = async () => {
    const confirmed = await confirmDeleteSwal({
      title: `Delete ${task.taskKey}?`,
      text: 'This work item, its comments, attachments, and activity log will be permanently deleted.',
      highlightLabel: `${task.taskKey} · ${task.title}`,
      confirmText: 'Yes, delete task',
      accentColor,
    });
    if (!confirmed) return;
    const res = await developmentService.deleteTask(projectId, task.id);
    if (res.success) {
      onTaskDeleted(task.id);
      onClose();
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = commentBody.trim();
    if (!trimmed) return;
    setIsPostingComment(true);
    const res = await developmentService.addComment(projectId, task.id, trimmed);
    setIsPostingComment(false);
    if (res.success) {
      setCommentBody('');
      await refreshDetail();
    }
  };

  const handleAttachDoc = async () => {
    if (!selectedDocId) return;
    const docId = parseInt(selectedDocId, 10);
    if (Number.isNaN(docId)) return;
    setIsAddingAttachment(true);
    setAttachmentError(null);
    const res = await developmentService.addAttachment(projectId, task.id, { documentId: docId });
    setIsAddingAttachment(false);
    if (res.success) {
      setSelectedDocId('');
      await refreshDetail();
    } else {
      setAttachmentError(res.error || 'Failed to attach document');
    }
  };

  const handleAttachExternal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extName.trim() || !extUrl.trim()) return;
    setIsAddingAttachment(true);
    setAttachmentError(null);
    const res = await developmentService.addAttachment(projectId, task.id, {
      fileName: extName.trim(),
      fileUrl: extUrl.trim(),
    });
    setIsAddingAttachment(false);
    if (res.success) {
      setExtName('');
      setExtUrl('');
      await refreshDetail();
    } else {
      setAttachmentError(res.error || 'Failed to add link attachment');
    }
  };

  const handleRemoveAttachment = async (att: DevelopmentTaskAttachment) => {
    const confirmed = await confirmDeleteSwal({
      title: 'Remove Attachment?',
      text: 'This will unlink the attachment from the task (project documents stay safe in Documents).',
      highlightLabel: att.fileName,
      confirmText: 'Remove',
      accentColor,
    });
    if (!confirmed) return;
    const res = await developmentService.removeAttachment(projectId, task.id, att.id);
    if (res.success) {
      await refreshDetail();
    }
  };

  const TABS: { key: DrawerTab; label: string; icon: React.ComponentType<any>; count?: number }[] = [
    { key: 'details', label: 'Details', icon: Layers },
    {
      key: 'attachments',
      label: 'Attachments',
      icon: Paperclip,
      count: active.attachments?.length || active.attachmentCount || 0,
    },
    {
      key: 'comments',
      label: 'Comments',
      icon: MessageSquare,
      count: detailTask?.comments?.length ?? active.commentCount ?? 0,
    },
    {
      key: 'activity',
      label: 'Activity',
      icon: Activity,
      count: detailTask?.activities?.length || 0,
    },
  ];

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex justify-end bg-black/60 backdrop-blur-[2px]">
        <div className="flex-1" onClick={onClose} />
        <motion.aside
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 360, damping: 34 }}
          className="w-full max-w-2xl h-full bg-[#0E0F14] border-l border-[#27272A] shadow-2xl flex flex-col"
        >
          {/* Drawer Header */}
          <div className="px-5 py-4 border-b border-[#27272A] bg-[#12141B] flex items-start justify-between gap-3 shrink-0">
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-[#181A22] border border-[#27272A]"
                  style={{ color: accentColor }}
                >
                  {active.taskKey}
                </span>
                <TaskTypeBadge taskType={active.taskType} compact />
                <StatusBadge status={active.status} compact />
                <PriorityBadge priority={active.priority} compact />
                {active.isOverdue && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-red-500/15 border border-red-500/35 text-red-300">
                    <AlertTriangle size={10} />
                    Overdue
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-white leading-snug">{active.title}</h2>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {canEditTasks && (
                <>
                  <button
                    type="button"
                    onClick={() => onEditFull(active)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-200 bg-[#181A22] hover:bg-[#20232E] border border-[#27272A] cursor-pointer"
                  >
                    <Edit3 size={13} />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteTask}
                    title="Delete task"
                    className="p-1.5 rounded-xl text-red-400 hover:bg-red-500/10 border border-[#27272A] cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-[#1E202B] cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Drawer Tabs */}
          <div className="px-5 py-2.5 border-b border-[#27272A] bg-[#0B0C10] shrink-0 overflow-x-auto">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#12141B] border border-[#27272A]/80">
              {TABS.map((t) => {
                const Icon = t.icon;
                const isActive = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActiveTab(t.key)}
                    className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    style={{ color: isActive ? '#FFFFFF' : '#71717A' }}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="devDrawerTabPill"
                        className="absolute inset-0 rounded-lg bg-[#1D202A] border border-[#2E313D]"
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      />
                    )}
                    <Icon size={13} className="relative z-10" />
                    <span className="relative z-10">{t.label}</span>
                    {t.count !== undefined && t.count > 0 && (
                      <span className="relative z-10 text-[10px] font-mono px-1.5 rounded-full bg-white/10 text-zinc-200">
                        {t.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {activeTab === 'details' && (
              <>
                {/* Inline Quick Controls */}
                {canEditTasks && (
                  <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[#12141B] border border-[#27272A]">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase text-zinc-400">
                        Status
                      </label>
                      <AnimatedSelect
                        value={active.status}
                        onChange={(v) => handleQuickPatch({ status: v })}
                        disabled={isUpdatingField}
                        accentColor={accentColor}
                        dropdownMinWidth="w-48"
                        options={config.statuses.map((s) => ({ value: s, label: s }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase text-zinc-400">
                        Priority
                      </label>
                      <AnimatedSelect
                        value={active.priority}
                        onChange={(v) => handleQuickPatch({ priority: v })}
                        disabled={isUpdatingField}
                        accentColor={accentColor}
                        dropdownMinWidth="w-48"
                        options={DEV_PRIORITIES.map((p) => ({ value: p, label: p }))}
                      />
                    </div>
                  </div>
                )}

                {/* Description */}
                <div className="rounded-2xl bg-[#12141B]/70 border border-[#27272A] p-4 space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                    Description
                  </div>
                  {active.description ? (
                    <p className="text-xs sm:text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
                      {active.description}
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-500 italic">No description provided.</p>
                  )}
                </div>

                {/* Metadata Grid */}
                <div className="rounded-2xl bg-[#12141B]/70 border border-[#27272A] p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">
                      Module & Submodule
                    </span>
                    <div className="flex items-center gap-1.5 font-medium text-white">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: active.module?.color || accentColor }}
                      />
                      <span>{active.module?.name}</span>
                      <span className="text-zinc-500">/</span>
                      <span className="text-zinc-300">{active.submodule?.name}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">
                      Assignees
                    </span>
                    {active.assignees.length === 0 ? (
                      <span className="text-zinc-500 italic">Unassigned</span>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <DevAvatarStack users={active.assignees} max={5} size="sm" />
                        <span className="text-zinc-300 text-[11px]">
                          {active.assignees.map((u) => u.name).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">
                      Schedule
                    </span>
                    <div className="flex items-center gap-2 text-zinc-300">
                      <Calendar size={13} className="text-zinc-500" />
                      <span>
                        {formatDevDate(active.startDate)} → {formatDevDate(active.dueDate)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">
                      Estimated / Actual Effort
                    </span>
                    <div className="flex items-center gap-2 font-mono text-zinc-300">
                      <Clock size={13} className="text-zinc-500" />
                      <span>
                        Est: {formatEffort(active.estimatedEffort, active.effortUnit)} · Act:{' '}
                        {formatEffort(active.actualEffort, active.effortUnit)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">
                      Created By
                    </span>
                    <div className="flex items-center gap-1.5 text-zinc-300">
                      <User size={13} className="text-zinc-500" />
                      <span>{active.createdBy?.name}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">
                      Timestamps
                    </span>
                    <div className="text-zinc-400 text-[11px]">
                      Created {formatDistanceToNow(active.createdAt)} · Updated{' '}
                      {formatDistanceToNow(active.updatedAt)}
                    </div>
                  </div>
                </div>

                {/* Labels */}
                <div className="rounded-2xl bg-[#12141B]/70 border border-[#27272A] p-4 space-y-2">
                  <div className="text-[10px] font-mono uppercase text-zinc-400 flex items-center gap-1.5">
                    <Tag size={11} />
                    <span>Labels</span>
                  </div>
                  {active.labels.length === 0 ? (
                    <span className="text-xs text-zinc-500 italic">No labels attached.</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {active.labels.map((lbl) => (
                        <span
                          key={lbl}
                          className="px-2.5 py-1 rounded-lg text-[11px] bg-[#181A22] border border-[#27272A] text-zinc-200"
                        >
                          #{lbl}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === 'attachments' && (
              <div className="space-y-4">
                {attachmentError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                    {attachmentError}
                  </div>
                )}

                {canEditTasks && (
                  <div className="rounded-2xl bg-[#12141B] border border-[#27272A] p-4 space-y-3">
                    <div className="text-xs font-semibold text-white">Attach File or Link</div>
                    {projectDocs.length > 0 && (
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <AnimatedSelect
                            value={selectedDocId}
                            onChange={setSelectedDocId}
                            placeholder="Select a file from Documents module..."
                            searchPlaceholder="Search documents..."
                            accentColor={accentColor}
                            dropdownMinWidth="w-full"
                            options={projectDocs.map((d) => ({
                              value: String(d.id),
                              label: d.displayName || d.originalName,
                              sublabel: d.extension?.toUpperCase(),
                            }))}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAttachDoc}
                          disabled={!selectedDocId || isAddingAttachment}
                          className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#0A0B10] disabled:opacity-40 cursor-pointer"
                          style={{ backgroundColor: accentColor }}
                        >
                          Link Doc
                        </button>
                      </div>
                    )}

                    <form onSubmit={handleAttachExternal} className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                      <input
                        type="text"
                        value={extName}
                        onChange={(e) => setExtName(e.target.value)}
                        placeholder="Resource title..."
                        className="sm:col-span-2 px-3 py-2 rounded-xl bg-[#0A0B0F] border border-[#27272A] text-xs text-white focus:outline-none focus:border-zinc-500"
                      />
                      <input
                        type="text"
                        value={extUrl}
                        onChange={(e) => setExtUrl(e.target.value)}
                        placeholder="https://..."
                        className="sm:col-span-2 px-3 py-2 rounded-xl bg-[#0A0B0F] border border-[#27272A] text-xs text-white focus:outline-none focus:border-zinc-500"
                      />
                      <button
                        type="submit"
                        disabled={!extName.trim() || !extUrl.trim() || isAddingAttachment}
                        className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-medium bg-[#181A22] hover:bg-[#20232E] text-white border border-[#27272A] disabled:opacity-40 cursor-pointer"
                      >
                        <Link2 size={12} />
                        <span>Add</span>
                      </button>
                    </form>
                  </div>
                )}

                {isLoadingDetail ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="h-12 rounded-xl bg-[#161820]" />
                    <div className="h-12 rounded-xl bg-[#161820]" />
                  </div>
                ) : (active.attachments || []).length === 0 ? (
                  <div className="py-10 text-center rounded-2xl bg-[#12141B]/50 border border-dashed border-[#27272A]">
                    <Paperclip size={20} className="mx-auto text-zinc-500 mb-2" />
                    <p className="text-xs text-zinc-400">No attachments on this work item</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(active.attachments || []).map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#12141B] border border-[#27272A]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${accentColor}1A`, color: accentColor }}
                          >
                            <FileText size={15} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-white truncate">{att.fileName}</p>
                            <p className="text-[10px] text-zinc-500">
                              {att.document ? 'Linked Project Document' : att.fileUrl || 'Attachment'}
                              {att.uploadedBy ? ` · by ${att.uploadedBy.name}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {att.fileUrl && (
                            <a
                              href={att.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1E202B]"
                            >
                              <ExternalLink size={13} />
                            </a>
                          )}
                          {canEditTasks && (
                            <button
                              type="button"
                              onClick={() => handleRemoveAttachment(att)}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'comments' && (
              <div className="space-y-4">
                {canEditTasks && (
                  <form onSubmit={handleAddComment} className="space-y-2">
                    <textarea
                      rows={3}
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      placeholder="Write a development update or review note..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#12141B] border border-[#27272A] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 resize-none"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={!commentBody.trim() || isPostingComment}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold text-[#0A0B10] disabled:opacity-40 cursor-pointer"
                        style={{ backgroundColor: accentColor }}
                      >
                        <Send size={12} />
                        <span>{isPostingComment ? 'Posting...' : 'Post Comment'}</span>
                      </button>
                    </div>
                  </form>
                )}

                {isLoadingDetail ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="h-16 rounded-xl bg-[#161820]" />
                  </div>
                ) : (detailTask?.comments || []).length === 0 ? (
                  <div className="py-10 text-center rounded-2xl bg-[#12141B]/50 border border-dashed border-[#27272A]">
                    <MessageSquare size={20} className="mx-auto text-zinc-500 mb-2" />
                    <p className="text-xs text-zinc-400">No comments yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(detailTask?.comments || []).map((c) => (
                      <div
                        key={c.id}
                        className="p-3.5 rounded-xl bg-[#12141B] border border-[#27272A] space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-white">{c.author.name}</span>
                          <span className="text-[10px] text-zinc-500">
                            {formatDistanceToNow(c.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
                          {c.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="space-y-2.5">
                {isLoadingDetail ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="h-12 rounded-xl bg-[#161820]" />
                    <div className="h-12 rounded-xl bg-[#161820]" />
                  </div>
                ) : (detailTask?.activities || []).length === 0 ? (
                  <div className="py-10 text-center rounded-2xl bg-[#12141B]/50 border border-dashed border-[#27272A]">
                    <Activity size={20} className="mx-auto text-zinc-500 mb-2" />
                    <p className="text-xs text-zinc-400">No recorded activity yet</p>
                  </div>
                ) : (
                  (detailTask?.activities || []).map((act) => (
                    <div
                      key={act.id}
                      className="flex items-start justify-between gap-3 p-3 rounded-xl bg-[#12141B] border border-[#27272A] text-xs"
                    >
                      <div className="space-y-0.5">
                        <p className="text-zinc-200">
                          <span className="font-semibold text-white">
                            {act.actor?.name || 'System'}
                          </span>{' '}
                          <span className="text-zinc-400">{act.action.replace(/_/g, ' ')}</span>
                          {act.field ? (
                            <span className="text-zinc-500"> ({act.field})</span>
                          ) : null}
                        </p>
                        {(act.previousValue || act.newValue) && (
                          <p className="text-[11px] font-mono text-zinc-400">
                            {act.previousValue ? `${act.previousValue} → ` : ''}
                            <span className="text-zinc-200">{act.newValue}</span>
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-500 shrink-0">
                        {formatDistanceToNow(act.createdAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </motion.aside>
      </div>
    </AnimatePresence>,
    document.body
  );
};

