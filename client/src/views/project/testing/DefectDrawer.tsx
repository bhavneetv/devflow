import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowRight,
  Bug,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  GitBranch,
  GripHorizontal,
  History,
  Layers,
  Link2,
  RotateCcw,
  RotateCw,
  Sparkles,
  Unlink,
  Wrench,
  X,
} from 'lucide-react';
import { testingService } from '../../../services/testing.service';
import { gitService } from '../../../services/git.service';
import { useAccentTheme } from '../../../services/accentTheme.service';
import { useToast } from '../../../context/ToastContext';
import { confirmDeleteSwal } from '../../../lib/confirmAlert';
import { AnimatedSelect, type SelectOption } from '../../../components/settings/AnimatedSelect';
import { UserAvatar } from '../../../components/common/UserAvatar';
import { TestingAttachmentsPanel } from '../../../components/testing/TestingAttachmentsPanel';
import { useTestingNavigation } from '../../../components/testing/TestingPageHeader';
import {
  DefectStatusBadge,
  ExecutionStatusBadge,
  TestingPriorityBadge,
  TestingSeverityBadge,
  formatTestingDate,
  formatTestingDateTime,
} from '../../../components/testing/testingBadges';
import type {
  QaDefectDetail,
  QaDefectItem,
  TestingConfigurationItem,
  TestingMetaData,
  TestingPermissions,
} from '../../../types/testing';

interface DefectDrawerProps {
  projectId: number;
  defectId: number | null;
  meta: TestingMetaData;
  config: TestingConfigurationItem | null;
  permissions: TestingPermissions;
  onClose: () => void;
  onEdit: (detail: QaDefectDetail) => void;
  onArchived: (defect: QaDefectItem) => void;
  onStatusChanged: () => void;
}

const DEFECT_STATUS_OPTIONS: SelectOption[] = [
  { value: 'Open', label: 'Open' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Fixed', label: 'Fixed (Pending Retest)' },
  { value: 'Ready for Retest', label: 'Ready for Retest' },
  { value: 'Verified', label: 'Verified (QA)' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Reopened', label: 'Reopened' },
];

interface DefectPhaseItem {
  name: string;
  color: string;
  icon: any;
}

const BASE_DEFECT_PHASES: DefectPhaseItem[] = [
  { name: 'Open', color: '#3B82F6', icon: AlertCircle },
  { name: 'In Progress', color: '#8B5CF6', icon: Clock },
  { name: 'Fixed', color: '#F59E0B', icon: Wrench },
  { name: 'Ready for Retest', color: '#06B6D4', icon: RotateCw },
  { name: 'Verified', color: '#10B981', icon: CheckCircle2 },
  { name: 'Closed', color: '#71717A', icon: CheckCheck },
];

const DefectPhaseSliderControl: React.FC<{
  currentStatus: string;
  disabled: boolean;
  accentColor: string;
  onSelectStatus: (status: string) => void;
}> = ({ currentStatus, disabled, accentColor, onSelectStatus }) => {
  const phases = useMemo<DefectPhaseItem[]>(() => {
    if (currentStatus === 'Reopened') {
      return [
        { name: 'Reopened', color: '#F43F5E', icon: AlertTriangle },
        ...BASE_DEFECT_PHASES.filter((p: DefectPhaseItem) => p.name !== 'Open'),
      ];
    }
    return BASE_DEFECT_PHASES;
  }, [currentStatus]);

  const railRef = useRef<HTMLDivElement | null>(null);
  const fillRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const hoverIdxRef = useRef<number | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const currentIdx = useMemo(() => {
    const idx = phases.findIndex((p: DefectPhaseItem) => p.name.toLowerCase() === currentStatus.toLowerCase());
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
      if (fillRef.current) fillRef.current.style.width = `${restPercent}%`;
      if (handleRef.current) handleRef.current.style.left = `${restPercent}%`;
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

  const NextIcon = nextPhase ? nextPhase.icon : CheckCircle2;

  return (
    <div className="space-y-3">
      {/* Advance Phase Button */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          disabled={disabled || !nextPhase}
          onClick={() => nextPhase && onSelectStatus(nextPhase.name)}
          className="flex-1 min-w-[200px] group relative overflow-hidden rounded-xl px-4 py-3 flex items-center justify-between gap-3 border transition-all cursor-pointer disabled:opacity-65 disabled:cursor-default"
          style={{
            backgroundColor: nextPhase ? `${nextPhase.color}18` : 'rgba(16, 185, 129, 0.12)',
            borderColor: nextPhase ? `${nextPhase.color}55` : 'rgba(16, 185, 129, 0.45)',
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor: nextPhase ? `${nextPhase.color}28` : 'rgba(16, 185, 129, 0.25)',
                color: nextPhase ? nextPhase.color : '#34D399',
              }}
            >
              <NextIcon size={16} />
            </span>
            <div className="text-left min-w-0">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                {nextPhase ? 'Click to Advance Phase' : 'Defect Lifecycle'}
              </span>
              <span className="block text-xs sm:text-sm font-semibold text-white truncate">
                {nextPhase ? `Move to ${nextPhase.name}` : `Resolved (${currentStatus})`}
              </span>
            </div>
          </div>
          {nextPhase && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#0A0B10] shrink-0 transition-transform group-hover:translate-x-0.5"
              style={{ backgroundColor: nextPhase.color }}
            >
              <span>Next Phase</span>
              <ArrowRight size={13} />
            </span>
          )}
        </button>

        {/* Reopen button for verified/closed/fixed defects */}
        {['Fixed', 'Ready for Retest', 'Verified', 'Closed'].includes(currentStatus) && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelectStatus('Reopened')}
            className="px-3.5 py-3 rounded-xl border border-rose-500/35 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Reopen</span>
          </button>
        )}
      </div>

      {/* Slider Rail */}
      <div className="rounded-xl bg-[#0D0E14] border border-[#232531] px-3.5 py-3 space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <GripHorizontal size={12} style={{ color: phaseColor }} />
            <span>
              {isDragging && activePhase
                ? `Drop onto "${activePhase.name}"`
                : 'Drag slider to change defect phase'}
            </span>
          </span>
          <span className="font-semibold" style={{ color: phaseColor }}>
            {activePhase?.name || currentStatus}
          </span>
        </div>

        <div className="px-2.5 pt-2 pb-1 select-none">
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

              {/* Stop dots */}
              <div className="absolute inset-0 flex items-center justify-between pointer-events-none">
                {phases.map((phase: DefectPhaseItem, idx: number) => {
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
                        backgroundColor: isReached ? phase.color : '#12141B',
                        borderColor: isReached ? '#0A0B10' : '#3F3F46',
                        boxShadow: isTarget ? `0 0 0 4px ${phase.color}40` : undefined,
                      }}
                    >
                      {idx < currentIdx && !isDragging && (
                        <Check size={8} className="text-[#0A0B10] stroke-[3]" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Thumb Handle */}
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

          {/* Clickable Phase Labels */}
          <div className="mt-1.5 flex items-center justify-between gap-1 overflow-x-auto">
            {phases.map((phase: DefectPhaseItem, idx: number) => {
              const isSelected = idx === activeIdx;
              const PhaseIcon = phase.icon;
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
                    style={{ color: isSelected ? phase.color : '#71717A' }}
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

export const DefectDrawer: React.FC<DefectDrawerProps> = ({
  projectId,
  defectId,
  meta,
  config,
  permissions,
  onClose,
  onEdit,
  onArchived,
  onStatusChanged,
}) => {
  const { accentColor } = useAccentTheme();
  const { toast } = useToast();
  const { goToSubmodule } = useTestingNavigation(projectId);

  const [detail, setDetail] = useState<QaDefectDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // Git Issue / MR Linking Modal State
  const [gitLinkOpen, setGitLinkOpen] = useState(false);
  const [gitOptionsLoading, setGitOptionsLoading] = useState(false);
  const [gitIssues, setGitIssues] = useState<any[]>([]);
  const [gitMrs, setGitMrs] = useState<any[]>([]);
  const [gitLinkType, setGitLinkType] = useState<'issue' | 'merge_request'>('issue');
  const [gitRecordId, setGitRecordId] = useState('');
  const [linkingGit, setLinkingGit] = useState(false);

  const canManage = Boolean(permissions.canManageDefects);
  const canArchive = Boolean(permissions.canArchiveRecords);

  const loadDetail = useCallback(async () => {
    if (!defectId) return;
    setLoading(true);
    try {
      const res = await testingService.getDefectDetail(projectId, defectId);
      if (res.success && res.data) {
        setDetail(res.data);
      } else {
        toast.error(res.error || 'Failed to load defect details');
      }
    } catch {
      toast.error('Failed to load defect details');
    } finally {
      setLoading(false);
    }
  }, [projectId, defectId, toast]);

  useEffect(() => {
    if (defectId) {
      void loadDetail();
    } else {
      setDetail(null);
    }
  }, [defectId, loadDetail]);

  // Keyboard shortcut: Escape closes drawer
  useEffect(() => {
    if (!defectId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !gitLinkOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [defectId, gitLinkOpen, onClose]);

  const handleStatusTransition = async (nextStatus: string) => {
    if (!detail) return;
    try {
      const res = await testingService.updateDefect(projectId, detail.id, { status: nextStatus });
      if (res.success) {
        toast.success(
          nextStatus === 'Fixed'
            ? 'Marked Fixed — awaiting QA verification'
            : nextStatus === 'Reopened'
            ? 'Defect reopened'
            : `Status changed to ${nextStatus}`
        );
        await loadDetail();
        onStatusChanged();
      } else {
        toast.error(res.error || 'Could not change status');
      }
    } catch {
      toast.error('Failed to transition status');
    }
  };

  const handleArchive = async () => {
    if (!detail) return;
    const confirmed = await confirmDeleteSwal({
      title: detail.isArchived ? `Restore ${detail.defectKey}?` : `Archive ${detail.defectKey}?`,
      text: detail.isArchived
        ? 'Restoring returns this defect to active triage.'
        : 'Archiving hides the defect from default active views.',
      confirmText: detail.isArchived ? 'Restore Defect' : 'Archive Defect',
    });
    if (!confirmed) return;

    try {
      const res = await testingService.updateDefect(projectId, detail.id, {
        isArchived: !detail.isArchived,
      });
      if (res.success) {
        toast.success(detail.isArchived ? 'Defect restored' : 'Defect archived');
        onArchived(detail);
        await loadDetail();
        onStatusChanged();
      }
    } catch {
      toast.error('Failed to archive defect');
    }
  };

  const openGitLinkModal = async () => {
    setGitLinkOpen(true);
    setGitRecordId('');
    setGitOptionsLoading(true);
    try {
      const [issuesRes, mrsRes] = await Promise.all([
        gitService.getIssues(projectId, { state: 'all' }).catch(() => null),
        gitService.getMergeRequests(projectId, { state: 'all' }).catch(() => null),
      ]);
      setGitIssues(Array.isArray(issuesRes) ? issuesRes : (issuesRes as any)?.data || []);
      setGitMrs(Array.isArray(mrsRes) ? mrsRes : (mrsRes as any)?.data || []);
    } finally {
      setGitOptionsLoading(false);
    }
  };

  const handleLinkGitRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !gitRecordId) return;
    const pool = gitLinkType === 'issue' ? gitIssues : gitMrs;
    const picked = pool.find((item) => String(item.iid || item.id) === gitRecordId);
    const defaultRepo = meta?.gitRepositories?.[0];
    if (!defaultRepo) {
      toast.error('No Git repository connected to this project');
      return;
    }

    setLinkingGit(true);
    try {
      const res = await testingService.linkDefectGitRecord(projectId, detail.id, {
        repositoryId: picked?.repositoryId || defaultRepo.id,
        provider: defaultRepo.provider || 'github',
        recordType: gitLinkType,
        recordId: gitRecordId,
        recordNumber: picked?.iid || picked?.number || undefined,
        recordTitle: picked?.title || undefined,
        recordUrl: picked?.webUrl || picked?.htmlUrl || picked?.url || undefined,
      });
      if (res.success) {
        toast.success('Git record linked to defect');
        setGitLinkOpen(false);
        await loadDetail();
      } else {
        toast.error(res.error || 'Could not link Git record');
      }
    } catch {
      toast.error('Could not link Git record');
    } finally {
      setLinkingGit(false);
    }
  };

  const handleUnlinkGitRecord = async (linkId: number) => {
    if (!detail) return;
    try {
      const res = await testingService.unlinkDefectGitRecord(projectId, detail.id, linkId);
      if (res.success) {
        toast.success('Git link removed');
        await loadDetail();
      }
    } catch {
      toast.error('Could not unlink Git record');
    }
  };

  if (!defectId) return null;

  return createPortal(
    <AnimatePresence>
      {defectId && (
        <div className="fixed inset-0 z-[75] flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm cursor-pointer"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="relative w-full max-w-3xl bg-[#0F1117] border-l border-[#27272A] shadow-2xl h-full flex flex-col z-10 text-xs text-zinc-300"
          >
            {/* Header */}
            <div className="p-5 border-b border-[#27272A] bg-[#14161F] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/35 text-rose-300 font-bold shrink-0">
                  {detail?.defectKey || '...'}
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-semibold text-white truncate">
                    {detail?.title || 'Loading defect...'}
                  </h2>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5 flex-wrap">
                    {detail?.environment && <span>Env: {detail.environment}</span>}
                    {detail?.buildVersion && <span>• Build: {detail.buildVersion}</span>}
                    {detail && detail.reopenCount > 0 && (
                      <span className="text-rose-400 font-semibold">
                        • Reopened {detail.reopenCount}x
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {canManage && detail && (
                  <button
                    type="button"
                    onClick={() => onEdit(detail)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-white/[0.06] hover:bg-white/10 text-zinc-200 border border-[#27272A] transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                )}
                {canArchive && detail && (
                  <button
                    type="button"
                    onClick={() => void handleArchive()}
                    className="p-2 rounded-xl text-zinc-400 hover:text-amber-300 hover:bg-white/5 transition-colors cursor-pointer"
                    title={detail.isArchived ? 'Restore Defect' : 'Archive Defect'}
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 scrollbar-thin scrollbar-thumb-zinc-700">
              {loading || !detail ? (
                <div className="space-y-4">
                  <div className="h-24 rounded-2xl bg-[#14161F] border border-[#27272A] animate-pulse" />
                  <div className="h-40 rounded-2xl bg-[#14161F] border border-[#27272A] animate-pulse" />
                  <div className="h-32 rounded-2xl bg-[#14161F] border border-[#27272A] animate-pulse" />
                </div>
              ) : (
                <>
                  {/* Interactive Status Slider & Advancement (Matches Development Task Slider) */}
                  <div className="bg-[#14161F] border border-[#27272A] rounded-2xl p-4 space-y-3.5 shadow-sm">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <TestingSeverityBadge severity={detail.severity} size="sm" />
                        <TestingPriorityBadge priority={detail.priority} size="sm" />
                        <DefectStatusBadge status={detail.status} size="sm" />
                      </div>
                      <span className="text-[11px] font-mono text-zinc-400">
                        Status: <strong className="text-white">{detail.status}</strong>
                      </span>
                    </div>

                    <DefectPhaseSliderControl
                      currentStatus={detail.status}
                      disabled={!canManage}
                      accentColor={accentColor}
                      onSelectStatus={(next) => void handleStatusTransition(next)}
                    />

                    {/* Pending Retest QA Verification Box */}
                    {detail.status === 'Fixed' && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>
                            Developer marked this defect <strong>Fixed</strong>. QA verification is required before closing.
                          </span>
                        </div>
                        {canManage && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleStatusTransition('Verified')}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold hover:bg-emerald-500/30 transition-colors cursor-pointer"
                            >
                              Verify Fix
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleStatusTransition('Reopened')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold hover:bg-rose-500/30 transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Reopen
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {detail.verifiedBy && (
                      <div className="flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          Verified by {detail.verifiedBy.name} on {formatTestingDateTime(detail.verifiedAt)}
                        </span>
                      </div>
                    )}

                    {detail.description && (
                      <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed pt-1">
                        {detail.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-[11px] text-zinc-400 pt-2 border-t border-[#27272A]/70 flex-wrap">
                      {(detail.module || detail.submodule) && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-500">Module:</span>
                          <span className="text-emerald-400 font-medium">
                            {detail.module?.name}
                            {detail.submodule ? ` › ${detail.submodule.name}` : ''}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500">Reported By:</span>
                        {detail.reporter ? (
                          <div className="flex items-center gap-1.5 text-zinc-200">
                            <UserAvatar user={detail.reporter} size="xs" />
                            <span>{detail.reporter.name}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-500 italic">Unknown</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500">Assignee:</span>
                        {detail.assignee ? (
                          <div className="flex items-center gap-1.5 text-zinc-200">
                            <UserAvatar user={detail.assignee} size="xs" />
                            <span>{detail.assignee.name}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-500 italic">Unassigned</span>
                        )}
                      </div>
                      <div>
                        <span className="text-zinc-500">Created:</span>{' '}
                        <span>{formatTestingDate(detail.createdAt)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Updated:</span>{' '}
                        <span>{formatTestingDate(detail.updatedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Steps to Reproduce & Observed Behavior */}
                  {(detail.stepsToReproduce || detail.expectedResult || detail.actualResult) && (
                    <div className="bg-[#14161F] border border-[#27272A] rounded-2xl p-4 space-y-3 text-xs">
                      <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                        Reproduction &amp; Results
                      </h3>
                      {detail.stepsToReproduce && (
                        <div>
                          <span className="text-[11px] font-semibold text-zinc-400 block mb-1">
                            Steps to Reproduce
                          </span>
                          <pre className="whitespace-pre-wrap font-mono text-[11px] text-zinc-200 bg-[#0B0D12] p-3 rounded-xl border border-[#27272A] leading-relaxed">
                            {detail.stepsToReproduce}
                          </pre>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {detail.expectedResult && (
                          <div className="bg-[#0B0D12] p-3 rounded-xl border border-emerald-500/20">
                            <span className="text-[11px] font-semibold text-emerald-400 block mb-1">
                              Expected Result
                            </span>
                            <p className="text-zinc-300 leading-relaxed">{detail.expectedResult}</p>
                          </div>
                        )}
                        {detail.actualResult && (
                          <div className="bg-[#0B0D12] p-3 rounded-xl border border-rose-500/20">
                            <span className="text-[11px] font-semibold text-rose-400 block mb-1">
                              Actual Result
                            </span>
                            <p className="text-zinc-300 leading-relaxed">{detail.actualResult}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Traceability Links */}
                  <div className="bg-[#14161F] border border-[#27272A] rounded-2xl p-4 space-y-3 text-xs">
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                      Traceability Links
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {detail.linkedTestCase && (
                        <button
                          type="button"
                          onClick={() => goToSubmodule('test-cases', { caseId: detail.linkedTestCase!.id })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                        >
                          <span className="font-mono font-bold">{detail.linkedTestCase.caseKey}</span>
                          <span className="truncate max-w-[200px]">{detail.linkedTestCase.title}</span>
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </button>
                      )}
                      {detail.linkedDevTask && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300 font-mono">
                          Dev Task: {detail.linkedDevTask.taskKey} — {detail.linkedDevTask.title}
                        </span>
                      )}
                      {detail.linkedRequirement && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300">
                          Req: {detail.linkedRequirement.code} — {detail.linkedRequirement.title}
                        </span>
                      )}
                      {!detail.linkedTestCase && !detail.linkedDevTask && !detail.linkedRequirement && (
                        <span className="text-zinc-500 italic">No direct requirement or task links.</span>
                      )}
                    </div>

                    {/* Linked Executions from Test Runs */}
                    {detail.linkedExecutions && detail.linkedExecutions.length > 0 && (
                      <div className="space-y-1.5 pt-2">
                        <span className="text-[11px] text-zinc-400 font-medium">Linked Test Executions</span>
                        {detail.linkedExecutions.map((ex) => (
                          <div
                            key={ex.id}
                            onClick={() => goToSubmodule('test-runs', { runId: ex.testRunId })}
                            className="bg-[#0B0D12] border border-[#27272A] rounded-xl px-3 py-2 flex items-center justify-between cursor-pointer hover:border-zinc-500 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-emerald-400 font-semibold">{ex.runKey}</span>
                              <span className="text-white truncate">{ex.caseTitleSnapshot}</span>
                              <span className="text-[10px] text-zinc-500 font-mono">#{ex.attemptNumber}</span>
                            </div>
                            <ExecutionStatusBadge status={ex.status} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Git Issues & Merge Requests */}
                  <div className="bg-[#14161F] border border-[#27272A] rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                        Linked Git Issues &amp; MRs ({detail.gitLinks?.length || 0})
                      </h3>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => void openGitLinkModal()}
                          className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-200 transition-colors cursor-pointer"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          Link Issue / MR
                        </button>
                      )}
                    </div>

                    {!detail.gitLinks || detail.gitLinks.length === 0 ? (
                      <p className="text-xs text-zinc-500 italic">No Git issues or merge requests linked yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {detail.gitLinks.map((gl) => (
                          <div
                            key={gl.id}
                            className="bg-[#0B0D12] border border-[#27272A] rounded-xl px-3 py-2 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 font-mono font-semibold">
                                {gl.recordType}
                              </span>
                              <span className="text-white truncate">
                                #{gl.recordId} {gl.recordTitle || ''}
                              </span>
                              {gl.recordUrl && (
                                <a
                                  href={gl.recordUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-zinc-500 hover:text-white transition-colors"
                                  title="Open in Git provider"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => void handleUnlinkGitRecord(gl.id)}
                                className="p-1 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Unlink"
                              >
                                <Unlink className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Screenshots & Crash Logs Panel */}
                  <TestingAttachmentsPanel
                    projectId={projectId}
                    entityType="defect"
                    entityId={detail.id}
                    attachments={detail.attachments || []}
                    availableDocuments={meta.projectDocuments || []}
                    canEdit={canManage}
                    title="Screenshots & Crash Logs"
                    onUpdated={() => void loadDetail()}
                  />

                  {/* Activity Timeline */}
                  <div className="bg-[#14161F] border border-[#27272A] rounded-2xl p-4 space-y-2.5">
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-zinc-400" />
                      Activity Timeline
                    </h3>
                    {!detail.activities || detail.activities.length === 0 ? (
                      <p className="text-xs text-zinc-500 italic">No activity recorded yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {detail.activities.map((act) => (
                          <div
                            key={act.id}
                            className="flex items-center justify-between text-[11px] bg-[#0B0D12] border border-[#27272A] rounded-xl px-3 py-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <UserAvatar user={act.actor} size="xs" />
                              <span className="text-zinc-200 font-medium">{act.actor?.name || 'System'}</span>
                              <span className="text-zinc-400 truncate">
                                {act.action.replace(/_/g, ' ')}
                                {act.field ? ` (${act.field}: ${act.previousValue || '—'} → ${act.newValue || '—'})` : ''}
                              </span>
                            </div>
                            <span className="text-zinc-500 font-mono text-[10px] shrink-0">
                              {formatTestingDate(act.createdAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Git Link Modal */}
      {gitLinkOpen && (
        <div className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#12141C] border border-[#27272A] rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#27272A] bg-[#161824] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Link Git Issue or Merge Request</h3>
              <button
                type="button"
                onClick={() => setGitLinkOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleLinkGitRecord} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-zinc-300 mb-1.5">Record Type</label>
                <AnimatedSelect
                  options={[
                    { value: 'issue', label: 'Git Issue' },
                    { value: 'merge_request', label: 'Merge Request' },
                  ]}
                  value={gitLinkType}
                  onChange={(val) => {
                    setGitLinkType(val as 'issue' | 'merge_request');
                    setGitRecordId('');
                  }}
                  dropdownMinWidth="w-full"
                  accentColor={accentColor}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-300 mb-1.5">
                  {gitLinkType === 'issue' ? 'Select Issue' : 'Select Merge Request'}
                </label>
                {gitOptionsLoading ? (
                  <div className="h-9 rounded-xl bg-white/5 animate-pulse" />
                ) : (
                  <AnimatedSelect
                    options={(gitLinkType === 'issue' ? gitIssues : gitMrs).map((item) => ({
                      value: String(item.iid || item.id),
                      label: `#${item.iid || item.id} — ${item.title || 'Untitled'}`,
                      sublabel: item.state,
                    }))}
                    value={gitRecordId}
                    onChange={setGitRecordId}
                    placeholder="Choose record..."
                    dropdownMinWidth="w-full"
                    accentColor={accentColor}
                  />
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGitLinkOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs bg-[#181A22] border border-[#27272A] text-zinc-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!gitRecordId || linkingGit}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-md disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: accentColor }}
                >
                  {linkingGit ? 'Linking...' : 'Link Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

