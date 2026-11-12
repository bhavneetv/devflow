import React, { useState } from 'react';
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowUp,
  Ban,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  FileCheck2,
  FileEdit,
  Minus,
  PlayCircle,
  Plus,
  RotateCcw,
  ShieldAlert,
  SkipForward,
  Sparkles,
  Wrench,
  XCircle,
} from 'lucide-react';
import { AnimatedSelect, type SelectOption } from '../settings/AnimatedSelect';
import type { TestingMasterOption } from '../../types/testing';
import { testingService } from '../../services/testing.service';
import { useToast } from '../../context/ToastContext';

export type TestingMasterCategory = 'testTypes' | 'priorities' | 'defectSeverities' | 'environments';

interface PillStyle {
  color: string;
  bg: string;
  border: string;
  icon: React.ComponentType<any>;
}

const PRIORITY_STYLE_MAP: Record<string, PillStyle> = {
  critical: { color: '#F87171', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.34)', icon: AlertOctagon },
  high: { color: '#FB923C', bg: 'rgba(249,115,22,0.14)', border: 'rgba(249,115,22,0.34)', icon: ArrowUp },
  medium: { color: '#FBBF24', bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.34)', icon: Minus },
  low: { color: '#60A5FA', bg: 'rgba(59,130,246,0.14)', border: 'rgba(59,130,246,0.34)', icon: ArrowDown },
};

const SEVERITY_STYLE_MAP: Record<string, PillStyle> = {
  critical: { color: '#F87171', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.38)', icon: ShieldAlert },
  major: { color: '#FB923C', bg: 'rgba(249,115,22,0.14)', border: 'rgba(249,115,22,0.34)', icon: AlertTriangle },
  moderate: { color: '#FBBF24', bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.34)', icon: AlertCircle },
  minor: { color: '#60A5FA', bg: 'rgba(59,130,246,0.14)', border: 'rgba(59,130,246,0.34)', icon: Circle },
};

const EXECUTION_STATUS_MAP: Record<string, PillStyle> = {
  passed: { color: '#34D399', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.35)', icon: CheckCircle2 },
  failed: { color: '#F87171', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.35)', icon: XCircle },
  blocked: { color: '#FB923C', bg: 'rgba(249,115,22,0.14)', border: 'rgba(249,115,22,0.35)', icon: Ban },
  skipped: { color: '#A78BFA', bg: 'rgba(139,92,246,0.14)', border: 'rgba(139,92,246,0.35)', icon: SkipForward },
  'not run': { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.28)', icon: Clock },
};

const DEFECT_STATUS_MAP: Record<string, PillStyle> = {
  open: { color: '#F87171', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.35)', icon: AlertCircle },
  'in progress': { color: '#60A5FA', bg: 'rgba(59,130,246,0.14)', border: 'rgba(59,130,246,0.35)', icon: Wrench },
  fixed: { color: '#FBBF24', bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.35)', icon: Sparkles },
  'ready for retest': { color: '#A78BFA', bg: 'rgba(139,92,246,0.14)', border: 'rgba(139,92,246,0.35)', icon: RotateCcw },
  verified: { color: '#34D399', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.35)', icon: CheckCircle2 },
  closed: { color: '#2DD4BF', bg: 'rgba(20,184,166,0.14)', border: 'rgba(20,184,166,0.35)', icon: Check },
  reopened: { color: '#FB7185', bg: 'rgba(244,63,94,0.16)', border: 'rgba(244,63,94,0.38)', icon: RotateCcw },
};

const CASE_STATUS_MAP: Record<string, PillStyle> = {
  ready: { color: '#34D399', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.35)', icon: FileCheck2 },
  draft: { color: '#FBBF24', bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.35)', icon: FileEdit },
  deprecated: { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.28)', icon: Archive },
};

const PLAN_RUN_STATUS_MAP: Record<string, PillStyle> = {
  draft: { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.28)', icon: FileEdit },
  planned: { color: '#60A5FA', bg: 'rgba(59,130,246,0.14)', border: 'rgba(59,130,246,0.35)', icon: Clock },
  'not started': { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.28)', icon: Clock },
  'in progress': { color: '#A78BFA', bg: 'rgba(139,92,246,0.14)', border: 'rgba(139,92,246,0.35)', icon: PlayCircle },
  active: { color: '#34D399', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.35)', icon: CheckCircle2 },
  completed: { color: '#34D399', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.35)', icon: CheckCircle2 },
  cancelled: { color: '#F87171', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.35)', icon: Ban },
  aborted: { color: '#F87171', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.35)', icon: XCircle },
  archived: { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.28)', icon: Archive },
};

const FALLBACK_STYLE: PillStyle = {
  color: '#CBD5E1',
  bg: 'rgba(148,163,184,0.12)',
  border: 'rgba(148,163,184,0.28)',
  icon: Circle,
};

function renderPill(label: string, style: PillStyle, size: 'xs' | 'sm' = 'xs') {
  const Icon = style.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ${
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'
      }`}
      style={{
        color: style.color,
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
      }}
    >
      <Icon className={size === 'sm' ? 'w-3.5 h-3.5 shrink-0' : 'w-3 h-3 shrink-0'} />
      <span>{label}</span>
    </span>
  );
}

export const TestingPriorityBadge: React.FC<{ priority: string; size?: 'xs' | 'sm' }> = ({ priority, size = 'xs' }) =>
  renderPill(priority || 'Medium', PRIORITY_STYLE_MAP[(priority || '').toLowerCase()] || FALLBACK_STYLE, size);

export const TestingSeverityBadge: React.FC<{ severity: string; size?: 'xs' | 'sm' }> = ({ severity, size = 'xs' }) =>
  renderPill(severity || 'Major', SEVERITY_STYLE_MAP[(severity || '').toLowerCase()] || FALLBACK_STYLE, size);

export const ExecutionStatusBadge: React.FC<{ status: string; size?: 'xs' | 'sm' }> = ({ status, size = 'xs' }) =>
  renderPill(status || 'Not Run', EXECUTION_STATUS_MAP[(status || '').toLowerCase()] || FALLBACK_STYLE, size);

export const DefectStatusBadge: React.FC<{ status: string; size?: 'xs' | 'sm' }> = ({ status, size = 'xs' }) =>
  renderPill(status || 'Open', DEFECT_STATUS_MAP[(status || '').toLowerCase()] || FALLBACK_STYLE, size);

export const TestCaseStatusBadge: React.FC<{ status: string; size?: 'xs' | 'sm' }> = ({ status, size = 'xs' }) =>
  renderPill(status || 'Draft', CASE_STATUS_MAP[(status || '').toLowerCase()] || FALLBACK_STYLE, size);

export const PlanRunStatusBadge: React.FC<{ status: string; size?: 'xs' | 'sm' }> = ({ status, size = 'xs' }) =>
  renderPill(status || 'Draft', PLAN_RUN_STATUS_MAP[(status || '').toLowerCase()] || FALLBACK_STYLE, size);

export const TestTypeBadge: React.FC<{ testType: string }> = ({ testType }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/[0.06] text-gray-200 border border-white/10 whitespace-nowrap">
    {testType || 'Functional'}
  </span>
);

export function formatTestingDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTestingDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, idx);
  return `${val >= 10 || idx === 0 ? val.toFixed(0) : val.toFixed(1)} ${units[idx]}`;
}

interface MasterOptionSelectProps {
  projectId: number;
  category: TestingMasterCategory;
  label?: string;
  options: TestingMasterOption[];
  value: string;
  onChange: (value: string) => void;
  canCreate?: boolean;
  onOptionCreated?: (updated: TestingMasterOption[]) => void;
  placeholder?: string;
  includeAllOption?: boolean;
  allLabel?: string;
  className?: string;
}

export const MasterOptionSelect: React.FC<MasterOptionSelectProps> = ({
  projectId,
  category,
  label,
  options,
  value,
  onChange,
  canCreate = false,
  onOptionCreated,
  placeholder = 'Select option...',
  includeAllOption = false,
  allLabel = 'All',
  className,
}) => {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const activeOptions = options.filter((o) => !o.isArchived);
  const selectOptions: SelectOption[] = [
    ...(includeAllOption ? [{ value: '', label: allLabel }] : []),
    ...activeOptions.map((o) => ({
      value: o.name,
      label: o.name,
    })),
  ];

  if (value && !selectOptions.some((o) => o.value === value)) {
    selectOptions.push({ value, label: `${value} (Archived)` });
  }

  const handleQuickAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const res = await testingService.addMasterOption(projectId, {
        category,
        name: trimmed,
      });
      if (res.success && res.data) {
        const updatedList = res.data.config?.[category] || options;
        const createdName = res.data.created?.name || trimmed;
        onOptionCreated?.(updatedList);
        onChange(createdName);
        setNewName('');
        setAdding(false);
        toast.success(`Added "${createdName}"`);
      } else {
        toast.error(res.error || 'Could not add option');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={className}>
      {(label || canCreate) && (
        <div className="flex items-center justify-between mb-1.5">
          {label ? <span className="text-xs font-medium text-gray-300">{label}</span> : <span />}
          {canCreate && (
            <button
              type="button"
              onClick={() => setAdding((prev) => !prev)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <Plus className="w-3 h-3" />
              {adding ? 'Cancel' : 'Add New'}
            </button>
          )}
        </div>
      )}
      {adding && (
        <div className="flex items-center gap-2 mb-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleQuickAdd();
              }
            }}
            placeholder="Type name..."
            className="flex-1 bg-[#0B0D10] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/60"
            autoFocus
          />
          <button
            type="button"
            disabled={saving || !newName.trim()}
            onClick={() => void handleQuickAdd()}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/30 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}
      <AnimatedSelect
        options={selectOptions}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </div>
  );
};
