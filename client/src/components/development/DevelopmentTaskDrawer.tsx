import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  FileText,
  Flag,
  GitCommitHorizontal,
  GripHorizontal,
  Layers,
  Link2,
  MessageSquare,
  Paperclip,
  Send,
  Sparkles,
  Trash2,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { developmentService } from '../../services/development.service';
import { documentService } from '../../services/document.service';
import { authService } from '../../services/auth.service';
import { confirmDeleteSwal } from '../../lib/confirmAlert';
import { formatDistanceToNow } from '../../lib/dateUtils';
import { AnimatedSelect } from '../settings/AnimatedSelect';
import { useAccentTheme } from '../../services/accentTheme.service';
import type {
  DevAssigneeGroups,
  DevMasterChoiceItem,
  DevGitCommitLink,
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
  isDevelopmentTaskType,
  isEndStatusName,
  PriorityBadge,
  StatusBadge,
  TaskTypeBadge,
} from './devBadges';
import { getMasterIconComponent, MasterIconBadge } from './devIcons';
import { CommitCompletionModal } from './CommitCompletionModal';
import {
  GitCommit as DevCommitIcon,
  ExternalLink as DevExternalLinkIcon,
  Link2 as DevLinkIcon,
  Unlink as DevUnlinkIcon,
} from 'lucide-react';

type DrawerTab = 'details' | 'attachments' | 'chat' | 'activity';

interface DevelopmentTaskDrawerProps {
  projectId: number;
  task: DevelopmentTaskItem | null;
  config: DevelopmentProjectConfig;
  assigneeGroups?: DevAssigneeGroups;
  canEditTasks: boolean;
  onClose: () => void;
  onEditFull: (task: DevelopmentTaskItem) => void;
  onTaskUpdated: (task: DevelopmentTaskItem) => void;
  onTaskDeleted: (taskId: number) => void;
}

const PhaseSliderControl: React.FC<{
  phases: DevMasterChoiceItem[];
  currentStatus: string;
  disabled: boolean;
  accentColor: string;
  onSelectStatus: (status: string) => void;
}> = ({ phases, currentStatus, disabled, accentColor, onSelectStatus }) => {
  const railRef = useRef<HTMLDivElement | null>(null);
  const fillRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const hoverIdxRef = useRef<number | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const currentIdx = useMemo(() => {
    const idx = phases.findIndex((p) => p.name.toLowerCase() === currentStatus.toLowerCase());
    return idx >= 0 ? idx : 0;
  }, [phases, currentStatus]);

  const activeIdx = hoverIdx !== null ? hoverIdx : currentIdx;
  const activePhase = phases[activeIdx] || phases[0];
  const nextPhase = currentIdx < phases.length - 1 ? phases[currentIdx + 1] : null;
  const phaseColor = activePhase?.color || accentColor;

  const restPercent =
    phases.length > 1 ? (currentIdx / (phases.length - 1)) * 100 : 100;

  useEffect(() => {
    if (!isDraggingRef.current) {
      if (fillRef.current) {
        fillRef.current.style.width = `${restPercent}%`;
      }
      if (handleRef.current) {
        handleRef.current.style.left = `${restPercent}%`;
      }
    }
  }, [restPercent]);

  const computeFromClientX = (clientX: number) => {
    if (!railRef.current || phases.length === 0) return null;
    const rect = railRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, 1);
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / width));
    const idx =
      phases.length > 1
        ? Math.min(phases.length - 1, Math.max(0, Math.round(ratio * (phases.length - 1))))
        : 0;
    return { percent: ratio * 100, idx };
  };

  const applyDomPosition = (percent: number, color: string) => {
    if (fillRef.current) {
      fillRef.current.style.width = `${percent}%`;
      fillRef.current.style.backgroundColor = color;
    }
    if (handleRef.current) {
      handleRef.current.style.left = `${percent}%`;
      handleRef.current.style.backgroundColor = color;
      handleRef.current.style.boxShadow = `0 0 14px ${color}99`;
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || phases.length === 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    setIsDragging(true);
    const res = computeFromClientX(e.clientX);
    if (res) {
      const targetColor = phases[res.idx]?.color || accentColor;
      applyDomPosition(res.percent, targetColor);
      hoverIdxRef.current = res.idx;
      setHoverIdx(res.idx);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const res = computeFromClientX(e.clientX);
    if (!res) return;
    const targetColor = phases[res.idx]?.color || accentColor;
    applyDomPosition(res.percent, targetColor);
    if (res.idx !== hoverIdxRef.current) {
      hoverIdxRef.current = res.idx;
      setHoverIdx(res.idx);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const res = computeFromClientX(e.clientX);
    const targetIdx = res ? res.idx : hoverIdxRef.current;

    isDraggingRef.current = false;
    hoverIdxRef.current = null;
    setIsDragging(false);
    setHoverIdx(null);

    if (targetIdx !== null && targetIdx !== undefined && phases[targetIdx]) {
      const targetPhase = phases[targetIdx];
      const snappedPercent =
        phases.length > 1 ? (targetIdx / (phases.length - 1)) * 100 : 100;
      applyDomPosition(snappedPercent, targetPhase.color || accentColor);
      if (targetPhase.name !== currentStatus) {
        onSelectStatus(targetPhase.name);
      }
    } else {
      applyDomPosition(restPercent, phaseColor);
    }
  };

  const NextIcon = nextPhase
    ? getMasterIconComponent(nextPhase.icon, ArrowRight)
    : CheckCircle2;

  return (
    <div className="space-y-3">
      {/* Big Click / Advance Next Phase Button */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          disabled={disabled || !nextPhase}
          onClick={() => nextPhase && onSelectStatus(nextPhase.name)}
          className="flex-1 min-w-[200px] group relative overflow-hidden rounded-xl px-4 py-3 flex items-center justify-between gap-3 border transition-all cursor-pointer disabled:opacity-65 disabled:cursor-default"
          style={{
            backgroundColor: nextPhase ? `${nextPhase.color || accentColor}18` : 'rgba(16, 185, 129, 0.12)',
            borderColor: nextPhase ? `${nextPhase.color || accentColor}55` : 'rgba(16, 185, 129, 0.45)',
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor: nextPhase ? `${nextPhase.color || accentColor}28` : 'rgba(16, 185, 129, 0.25)',
                color: nextPhase ? nextPhase.color || accentColor : '#34D399',
              }}
            >
              <NextIcon size={16} />
            </span>
            <div className="text-left min-w-0">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                {nextPhase ? 'Click to Advance Phase' : 'Workflow Status'}
              </span>
              <span className="block text-xs sm:text-sm font-semibold text-white truncate">
                {nextPhase ? `Move to ${nextPhase.name}` : `Completed (${currentStatus})`}
              </span>
            </div>
          </div>
          {nextPhase && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#0A0B10] shrink-0 transition-transform group-hover:translate-x-0.5"
              style={{ backgroundColor: nextPhase.color || accentColor }}
            >
              <span>Next Phase</span>
              <ArrowRight size={13} />
            </span>
          )}
        </button>
      </div>

      {/* Zero-Lag Cursor Slide & Drop Phase Track */}
      <div className="rounded-xl bg-[#0D0E14] border border-[#232531] px-3.5 py-3 space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <GripHorizontal size={12} style={{ color: phaseColor }} />
            <span>
              {isDragging && activePhase
                ? `Drop onto "${activePhase.name}"`
                : 'Drag slider to any phase'}
            </span>
          </span>
          <span className="font-semibold" style={{ color: phaseColor }}>
            {activePhase?.name || currentStatus}
          </span>
        </div>

        <div className="px-2.5 pt-2 pb-1 select-none">
          {/* Hit area directly aligned 1:1 with rail width */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`relative py-2 touch-none ${
              disabled ? 'opacity-50 pointer-events-none' : 'cursor-grab active:cursor-grabbing'
            }`}
          >
            <div ref={railRef} className="relative h-2.5 rounded-full bg-[#1C1E28]">
              <div
                ref={fillRef}
                className={`absolute inset-y-0 left-0 rounded-full ${
                  isDragging ? '' : 'transition-[width] duration-150 ease-out'
                }`}
                style={{
                  width: `${restPercent}%`,
                  backgroundColor: phaseColor,
                }}
              />

              {/* Phase stop dots */}
              <div className="absolute inset-0 flex items-center justify-between pointer-events-none">
                {phases.map((phase, idx) => {
                  const isReached = idx <= activeIdx;
                  const isTarget = isDragging && hoverIdx === idx;
                  const isCurrent = phase.name === currentStatus && !isDragging;
                  return (
                    <div
                      key={phase.name}
                      className={`relative w-4 h-4 -mx-2 rounded-full border-2 flex items-center justify-center transition-transform ${
                        isTarget || isCurrent ? 'scale-125' : ''
                      }`}
                      style={{
                        backgroundColor: isReached ? phase.color || accentColor : '#12141B',
                        borderColor: isReached ? '#0A0B10' : '#3F3F46',
                        boxShadow: isTarget ? `0 0 0 4px ${phase.color || accentColor}40` : undefined,
                      }}
                    >
                      {idx < currentIdx && !isDragging && (
                        <Check size={8} className="text-[#0A0B10] stroke-[3]" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Smooth Cursor Thumb Handle */}
              <div
                ref={handleRef}
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 border-white shadow-lg flex items-center justify-center pointer-events-none ${
                  isDragging ? 'scale-125' : 'transition-[left] duration-150 ease-out'
                }`}
                style={{
                  left: `${restPercent}%`,
                  backgroundColor: phaseColor,
                  boxShadow: `0 0 12px ${phaseColor}88`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#0A0B10]" />
              </div>
            </div>
          </div>

          {/* Clickable phase labels row */}
          <div className="mt-1.5 flex items-center justify-between gap-1">
            {phases.map((phase, idx) => {
              const isSelected = idx === activeIdx;
              const PhaseIcon = getMasterIconComponent(phase.icon, CheckCircle2);
              return (
                <button
                  key={phase.name}
                  type="button"
                  disabled={disabled}
                  onClick={() => phase.name !== currentStatus && onSelectStatus(phase.name)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-colors truncate cursor-pointer ${
                    isSelected ? 'text-white bg-[#1B1D27] border border-[#2F3242]' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <PhaseIcon
                    size={10}
                    style={{ color: isSelected ? phase.color || accentColor : '#71717A' }}
                  />
                  <span className="truncate">{phase.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export const DevelopmentTaskDrawer: React.FC<DevelopmentTaskDrawerProps> = ({
  projectId,
  task,
  config,
  assigneeGroups,
  canEditTasks,
  onClose,
  onEditFull,
  onTaskUpdated,
  onTaskDeleted,
}) => {
  const { accentColor } = useAccentTheme();
  const currentUser = useMemo(() => authService.getUser(), []);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
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

  // Chat messages (persisted via development task comments endpoint)
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

  const statusPhases = useMemo<DevMasterChoiceItem[]>(() => {
    if (config.statusItems && config.statusItems.length > 0) {
      return config.statusItems;
    }
    return config.statuses.map((s) => ({
      name: s,
      icon: 'Circle',
      color: '#71717A',
    }));
  }, [config.statusItems, config.statuses]);

  const linkedTeams = useMemo(
    () => (detailTask?.assignedTeams ?? task?.assignedTeams ?? []),
    [detailTask?.assignedTeams, task?.assignedTeams]
  );

  const sortedChatMessages = useMemo(() => {
    const msgs = detailTask?.comments || [];
    return [...msgs].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [detailTask?.comments]);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab, sortedChatMessages.length]);

  if (!task) return null;

  const active = detailTask || {
    ...task,
    comments: [] as DevelopmentTaskComment[],
    activities: [] as DevelopmentTaskActivity[],
    attachments: (task.attachments || []) as DevelopmentTaskAttachment[],
  };

  const [commitModalState, setCommitModalState] = useState<{
    mode: 'complete' | 'link_only';
    targetStatus: string;
  } | null>(null);

  const refreshDetail = async () => {
    const res = await developmentService.getTaskDetail(projectId, task.id);
    if (res.success && res.data) {
      setDetailTask(res.data);
      onTaskUpdated(res.data);
    }
  };

  const executeQuickPatch = async (patch: Record<string, any>) => {
    if (!canEditTasks) return;
    const prevDetail = detailTask;
    setDetailTask((prev) => (prev ? { ...prev, ...patch } : prev));
    setIsUpdatingField(true);
    const res = await developmentService.updateTask(projectId, task.id, patch);
    setIsUpdatingField(false);
    if (res.success && res.data) {
      onTaskUpdated(res.data);
      await refreshDetail();
    } else {
      setDetailTask(prevDetail);
    }
  };

  const handleQuickPatch = async (patch: Record<string, any>) => {
    if (!canEditTasks) return;
    if (typeof patch.status === 'string') {
      const wasAlreadyEnded = isEndStatusName(active.status, config.statusItems);
      const nextIsEnd = isEndStatusName(patch.status, config.statusItems);
      if (!wasAlreadyEnded && nextIsEnd && isDevelopmentTaskType(active.taskType)) {
        setCommitModalState({ mode: 'complete', targetStatus: patch.status });
        return;
      }
    }
    await executeQuickPatch(patch);
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

  const handleAddComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = commentBody.trim();
    if (!trimmed || isPostingComment) return;
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
      key: 'chat',
      label: 'Chat',
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
    <>
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
                <StatusBadge
                  status={active.status}
                  compact
                  customItem={config.statusItems?.find((s) => s.name === active.status)}
                />
                <PriorityBadge
                  priority={active.priority}
                  compact
                  customItem={config.priorityItems?.find((p) => p.name === active.priority)}
                />
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
                {/* Interactive Status Phase Slider + Priority */}
                {canEditTasks && (
                  <div className="p-4 rounded-2xl bg-[#12141B] border border-[#27272A] space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                        Phase Progression & Status
                      </span>
                      <StatusBadge
                        status={active.status}
                        compact
                        customItem={statusPhases.find(
                          (s) => s.name.toLowerCase() === active.status.toLowerCase()
                        )}
                      />
                    </div>

                    <PhaseSliderControl
                      phases={statusPhases}
                      currentStatus={active.status}
                      disabled={isUpdatingField}
                      accentColor={accentColor}
                      onSelectStatus={(nextStatus) => handleQuickPatch({ status: nextStatus })}
                    />

                    <div className="pt-2 border-t border-[#22242E] flex items-center justify-between gap-3">
                      <label className="text-[10px] font-mono uppercase text-zinc-400">
                        Priority Level
                      </label>
                      <div className="w-48">
                        <AnimatedSelect
                          value={active.priority}
                          onChange={(v) => handleQuickPatch({ priority: v })}
                          disabled={isUpdatingField}
                          accentColor={accentColor}
                          dropdownMinWidth="w-48"
                          options={(config.priorityItems && config.priorityItems.length > 0
                            ? config.priorityItems
                            : DEV_PRIORITIES.map((p) => ({ name: p, icon: 'Flag', color: '#F59E0B' }))
                          ).map((p) => ({
                            value: p.name,
                            label: p.name,
                            icon: <MasterIconBadge icon={p.icon} color={p.color} size={11} />,
                          }))}
                        />
                      </div>
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
                      Linked Teams
                    </span>
                    {linkedTeams.length === 0 ? (
                      <span className="text-zinc-500 italic">No full team linked</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {linkedTeams.map((team) => (
                          <span
                            key={team.id}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#181B25] border border-[#2B2F40] text-[11px] font-medium text-white"
                          >
                            <MasterIconBadge
                              icon={team.icon || 'Users'}
                              color={team.color || accentColor}
                              size={11}
                            />
                            <span>{team.name}</span>
                            <span className="text-[10px] font-mono text-zinc-400">
                              ({team.memberIds.length})
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">
                      Assignees
                    </span>
                      {active.assignees.length === 0 && linkedTeams.length === 0 ? (
                      <span className="text-zinc-500 italic">Unassigned</span>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <DevAvatarStack
                          users={active.assignees}
                          assignedTeams={linkedTeams}
                          max={5}
                          size="sm"
                        />
                        {active.assignees.length > 0 && (
                          <span className="text-zinc-300 text-[11px]">
                            {active.assignees.map((u) => u.name).join(', ')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">
                      Planned Schedule
                    </span>
                    <div className="flex items-center gap-2 text-zinc-300">
                      <Calendar size={13} className="text-zinc-500 shrink-0" />
                      <span>
                        {formatDevDate(active.startDate)} → {formatDevDate(active.dueDate)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">
                      Actual Start & End
                    </span>
                    {(() => {
                      const fmtActual = (iso?: string | null) => {
                        if (!iso) return null;
                        const d = new Date(iso);
                        if (Number.isNaN(d.getTime())) return formatDevDate(iso);
                        return d.toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                      };
                      const actualStartText = fmtActual(active.startedAt) || 'Not started yet';
                      const actualEndText =
                        fmtActual(active.completedAt) ||
                        (active.isEndStatus
                          ? 'Ended'
                          : active.startedAt
                          ? 'In progress'
                          : '—');
                      return (
                        <div className="space-y-0.5 text-[11px] font-mono text-zinc-300">
                          <div className="flex items-center gap-1.5">
                            <Clock size={12} className="text-sky-400 shrink-0" />
                            <span className="text-zinc-500">Start:</span>
                            <span className="text-zinc-200">{actualStartText}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2
                              size={12}
                              className={
                                active.completedAt ? 'text-emerald-400 shrink-0' : 'text-zinc-500 shrink-0'
                              }
                            />
                            <span className="text-zinc-500">End:</span>
                            <span
                              className={
                                active.completedAt ? 'text-emerald-300' : 'text-zinc-400'
                              }
                            >
                              {actualEndText}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
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

                {(active.gitCommit || (canEditTasks && isDevelopmentTaskType(active.taskType))) && (
                  <div className="p-4 rounded-2xl bg-[#12141B] border border-[#27272A] space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 inline-flex items-center gap-1.5">
                        <DevCommitIcon size={12} style={{ color: accentColor }} />
                        Linked Git Commit
                      </span>

                      {canEditTasks && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isUpdatingField}
                            onClick={() =>
                              setCommitModalState({ mode: 'link_only', targetStatus: active.status })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1A1C26] border border-[#27272A] hover:border-emerald-500/40 text-[11px] font-medium text-zinc-200 hover:text-white transition-colors cursor-pointer"
                          >
                            <DevLinkIcon size={11} />
                            {active.gitCommit ? 'Change Commit' : 'Link Commit'}
                          </button>
                          {active.gitCommit && (
                            <button
                              type="button"
                              disabled={isUpdatingField}
                              onClick={() => executeQuickPatch({ gitCommit: null })}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#1A1C26] border border-[#27272A] hover:border-red-500/40 text-[11px] font-medium text-zinc-400 hover:text-red-300 transition-colors cursor-pointer"
                              title="Unlink Git Commit"
                            >
                              <DevUnlinkIcon size={11} />
                              Unlink
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {active.gitCommit ? (
                      <div className="p-3 rounded-xl bg-[#0D0F14] border border-emerald-500/25 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-mono text-[11px] font-semibold">
                              {active.gitCommit.shortSha}
                            </span>
                            {active.gitCommit.repoName && (
                              <span className="px-2 py-0.5 rounded-md bg-[#181A24] border border-[#27272A] text-zinc-300 text-[11px] font-mono">
                                {active.gitCommit.repoName}
                              </span>
                            )}
                          </div>
                          {active.gitCommit.url && (
                            <a
                              href={active.gitCommit.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors"
                            >
                              View Commit
                              <DevExternalLinkIcon size={11} />
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-white font-medium break-words">
                          {active.gitCommit.message || 'Commit linked'}
                        </p>
                        {(active.gitCommit.author || active.gitCommit.committedAt) && (
                          <div className="text-[11px] text-zinc-400 flex items-center gap-2 flex-wrap">
                            {active.gitCommit.author && <span>by {active.gitCommit.author}</span>}
                            {active.gitCommit.committedAt && (
                              <span className="text-zinc-500">
                                · {formatDevDate(active.gitCommit.committedAt)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500">
                        Optional — link a Git commit from this project&apos;s repositories or enter a commit SHA.
                      </p>
                    )}
                  </div>
                )}
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
                          {(att.fileUrl || att.documentId) && (
                            <a
                              href={
                                att.fileUrl ||
                                documentService.getContentUrl(projectId, att.documentId!, false)
                              }
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

            {activeTab === 'chat' && (
              <div className="flex flex-col h-[calc(100vh-235px)] min-h-[360px]">
                <div className="flex-1 overflow-y-auto pr-1 space-y-3 pb-3">
                  {isLoadingDetail ? (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-14 w-2/3 rounded-2xl bg-[#161820]" />
                      <div className="h-14 w-2/3 ml-auto rounded-2xl bg-[#161820]" />
                    </div>
                  ) : sortedChatMessages.length === 0 ? (
                    <div className="py-12 text-center rounded-2xl bg-[#12141B]/50 border border-dashed border-[#27272A]">
                      <MessageSquare size={22} className="mx-auto text-zinc-500 mb-2" />
                      <p className="text-xs font-medium text-zinc-300">No task messages yet</p>
                      <p className="text-[11px] text-zinc-500 mt-1">
                        Start a live conversation with assignees on {active.taskKey}.
                      </p>
                    </div>
                  ) : (
                    sortedChatMessages.map((msg) => {
                      const isMine =
                        currentUser?.id !== undefined && msg.author.id === currentUser.id;
                      const initials = (msg.author.name || '?')
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();
                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          className={`flex items-end gap-2 ${
                            isMine ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {!isMine && (
                            <div className="w-7 h-7 rounded-full bg-[#1C1F2B] border border-[#2C3042] text-[10px] font-bold text-zinc-200 flex items-center justify-center shrink-0">
                              {initials}
                            </div>
                          )}
                          <div
                            className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 space-y-1 border ${
                              isMine
                                ? 'rounded-br-sm text-white'
                                : 'rounded-bl-sm bg-[#12141B] border-[#27272A] text-zinc-200'
                            }`}
                            style={
                              isMine
                                ? {
                                    backgroundColor: `${accentColor}22`,
                                    borderColor: `${accentColor}55`,
                                  }
                                : undefined
                            }
                          >
                            <div className="flex items-center justify-between gap-3 text-[10px]">
                              <span
                                className="font-semibold"
                                style={{ color: isMine ? accentColor : '#E4E4E7' }}
                              >
                                {isMine ? 'You' : msg.author.name}
                              </span>
                              <span className="text-zinc-500 shrink-0">
                                {formatDistanceToNow(msg.createdAt)}
                              </span>
                            </div>
                            <p className="text-xs whitespace-pre-wrap leading-relaxed break-words">
                              {msg.body}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                {canEditTasks && (
                  <form
                    onSubmit={handleAddComment}
                    className="pt-3 border-t border-[#232530] flex items-end gap-2 shrink-0"
                  >
                    <textarea
                      rows={2}
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAddComment();
                        }
                      }}
                      placeholder="Type a message (Enter to send, Shift+Enter for new line)..."
                      className="flex-1 px-3.5 py-2 rounded-xl bg-[#12141B] border border-[#27272A] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 resize-none"
                    />
                    <button
                      type="submit"
                      disabled={!commentBody.trim() || isPostingComment}
                      title="Send message"
                      className="h-10 px-3.5 rounded-xl inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[#0A0B10] disabled:opacity-40 cursor-pointer shrink-0 transition-transform active:scale-95"
                      style={{ backgroundColor: accentColor }}
                    >
                      <Send size={13} />
                      <span>{isPostingComment ? '...' : 'Send'}</span>
                    </button>
                  </form>
                )}
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="space-y-3">
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
                  <div className="relative pl-8 pr-1 py-1 space-y-4">
                    {/* Continuous Vertical Connecting Graph Line */}
                    <motion.div
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ duration: 0.45, ease: 'easeOut' }}
                      style={{
                        originY: 0,
                        background: `linear-gradient(to bottom, ${accentColor}, #38BDF8 50%, #27272A)`,
                      }}
                      className="absolute left-[13px] top-4 bottom-4 w-[2px] rounded-full opacity-75"
                    />

                    {(detailTask?.activities || []).map((act, idx) => {
                      const actionKey = act.action.toLowerCase();
                      let NodeIcon: React.ComponentType<any> = GitCommitHorizontal;
                      let nodeColor = '#A1A1AA';
                      if (actionKey === 'created') {
                        NodeIcon = Sparkles;
                        nodeColor = '#10B981';
                      } else if (actionKey === 'status_changed') {
                        NodeIcon = Zap;
                        nodeColor = '#38BDF8';
                      } else if (actionKey === 'priority_changed') {
                        NodeIcon = Flag;
                        nodeColor = '#F59E0B';
                      } else if (actionKey === 'assignees_changed') {
                        NodeIcon = Users;
                        nodeColor = '#A78BFA';
                      } else if (actionKey === 'commented') {
                        NodeIcon = MessageSquare;
                        nodeColor = '#22D3EE';
                      } else if (actionKey.includes('attachment')) {
                        NodeIcon = Paperclip;
                        nodeColor = '#818CF8';
                      }

                      return (
                        <motion.div
                          key={act.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.25, delay: Math.min(idx * 0.04, 0.35) }}
                          className="relative"
                        >
                          {/* Glowing Graph Node */}
                          <div
                            className="absolute -left-8 top-2.5 w-7 h-7 rounded-full bg-[#0E0F14] border-2 flex items-center justify-center z-10"
                            style={{
                              borderColor: nodeColor,
                              boxShadow: `0 0 10px ${nodeColor}55`,
                            }}
                          >
                            <NodeIcon size={12} style={{ color: nodeColor }} />
                          </div>

                          {/* Horizontal connector tick */}
                          <div
                            className="absolute -left-[6px] top-[23px] w-2 h-[2px]"
                            style={{ backgroundColor: `${nodeColor}88` }}
                          />

                          {/* Activity Event Node Card */}
                          <div className="p-3 rounded-xl bg-[#12141B] border border-[#27272A] hover:border-[#343747] transition-colors text-xs space-y-1.5">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-zinc-200 leading-snug">
                                <span className="font-semibold text-white">
                                  {act.actor?.name || 'System'}
                                </span>{' '}
                                <span className="text-zinc-400">
                                  {act.action.replace(/_/g, ' ')}
                                </span>
                                {act.field ? (
                                  <span className="text-zinc-500"> ({act.field})</span>
                                ) : null}
                              </p>
                              <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                                {formatDistanceToNow(act.createdAt)}
                              </span>
                            </div>

                            {(act.previousValue || act.newValue) && (
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono pt-0.5">
                                {act.previousValue && (
                                  <span className="px-2 py-0.5 rounded-md bg-[#1A1C25] border border-[#27272A] text-zinc-400 line-through">
                                    {act.previousValue}
                                  </span>
                                )}
                                {act.previousValue && act.newValue && (
                                  <ArrowRight size={11} className="text-zinc-500" />
                                )}
                                {act.newValue && (
                                  <span
                                    className="px-2 py-0.5 rounded-md font-medium border"
                                    style={{
                                      color: nodeColor,
                                      backgroundColor: `${nodeColor}18`,
                                      borderColor: `${nodeColor}44`,
                                    }}
                                  >
                                    {act.newValue}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.aside>
      </div>
    </AnimatePresence>
    <CommitCompletionModal
      isOpen={Boolean(commitModalState)}
      projectId={projectId}
      taskKey={active.taskKey}
      taskTitle={active.title}
      targetStatus={commitModalState?.targetStatus || active.status}
      mode={commitModalState?.mode || 'complete'}
      existingCommit={active.gitCommit || null}
      isSubmitting={isUpdatingField}
      onCancel={() => {
        if (!isUpdatingField) setCommitModalState(null);
      }}
      onConfirm={async (commit) => {
        const current = commitModalState;
        if (!current) return;
        if (current.mode === 'complete') {
          await executeQuickPatch({
            status: current.targetStatus,
            ...(commit ? { gitCommit: commit } : {}),
          });
        } else {
          await executeQuickPatch({ gitCommit: commit ?? null });
        }
        setCommitModalState(null);
      }}
    />
    </>,
    document.body
  );
};

