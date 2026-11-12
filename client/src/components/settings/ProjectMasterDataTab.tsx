import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Check,
  Database,
  Flag,
  FolderTree,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  Zap,
} from 'lucide-react';
import { developmentService } from '../../services/development.service';
import type {
  DevMasterChoiceItem,
  DevelopmentModuleMaster,
  DevelopmentProjectConfig,
} from '../../types/development';
import { AnimatedSelect, type SelectOption } from './AnimatedSelect';
import { CustomSweetAlert } from '../common/CustomSweetAlert';
import {
  DEV_MASTER_COLORS,
  DEV_MASTER_ICONS,
  MasterIconBadge,
  getMasterIconComponent,
} from '../development/devIcons';

type MasterTabKey = 'modules' | 'submodules' | 'priorities' | 'statuses';

interface ProjectMasterDataTabProps {
  projectId: number;
}

const DEFAULT_PRIORITY_ITEMS: DevMasterChoiceItem[] = [
  { name: 'Critical', icon: 'Flame', color: '#EF4444' },
  { name: 'High', icon: 'ArrowUp', color: '#F97316' },
  { name: 'Medium', icon: 'Minus', color: '#F59E0B' },
  { name: 'Low', icon: 'ArrowDown', color: '#3B82F6' },
];

const DEFAULT_STATUS_ITEMS: DevMasterChoiceItem[] = [
  { name: 'Not Started', icon: 'Circle', color: '#71717A' },
  { name: 'In Progress', icon: 'Zap', color: '#3B82F6' },
  { name: 'In Review', icon: 'Eye', color: '#8B5CF6' },
  { name: 'Blocked', icon: 'AlertTriangle', color: '#EF4444' },
  { name: 'Completed', icon: 'CheckCircle2', color: '#10B981', isEnd: true },
];

export const ProjectMasterDataTab: React.FC<ProjectMasterDataTabProps> = ({ projectId }) => {
  const [activeTab, setActiveTab] = useState<MasterTabKey>('modules');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [modules, setModules] = useState<DevelopmentModuleMaster[]>([]);
  const [config, setConfig] = useState<DevelopmentProjectConfig | null>(null);

  // Module creation form
  const [modName, setModName] = useState('');
  const [modDesc, setModDesc] = useState('');
  const [modIcon, setModIcon] = useState('Layers');
  const [modColor, setModColor] = useState('#10B981');

  // Submodule creation form
  const [subModuleParentId, setSubModuleParentId] = useState('');
  const [subName, setSubName] = useState('');
  const [subDesc, setSubDesc] = useState('');
  const [subIcon, setSubIcon] = useState('Box');

  // Priority creation form
  const [prioName, setPrioName] = useState('');
  const [prioIcon, setPrioIcon] = useState('Flag');
  const [prioColor, setPrioColor] = useState('#F59E0B');

  // Status creation form
  const [statusName, setStatusName] = useState('');
  const [statusIcon, setStatusIcon] = useState('Circle');
  const [statusColor, setStatusColor] = useState('#3B82F6');
  const [statusIsEnd, setStatusIsEnd] = useState(false);

  // Confirm SweetAlert state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    text: string;
    highlightLabel?: string;
    warningNote?: string;
    variant: 'danger' | 'warning';
    confirmText: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    window.setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  const loadMasterData = useCallback(async () => {
    setLoading(true);
    try {
      const [modRes, cfgRes] = await Promise.all([
        developmentService.listModules(projectId, true),
        developmentService.getSettings(projectId),
      ]);
      if (modRes.success && modRes.data) {
        setModules(modRes.data);
        const firstActive = modRes.data.find((m) => !m.isArchived);
        setSubModuleParentId((prev) => prev || (firstActive ? String(firstActive.id) : ''));
      }
      if (cfgRes.success && cfgRes.data) {
        setConfig(cfgRes.data);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  const priorityItems: DevMasterChoiceItem[] = useMemo(() => {
    if (config?.priorityItems && config.priorityItems.length > 0) return config.priorityItems;
    return DEFAULT_PRIORITY_ITEMS;
  }, [config]);

  const statusItems: DevMasterChoiceItem[] = useMemo(() => {
    if (config?.statusItems && config.statusItems.length > 0) return config.statusItems;
    return DEFAULT_STATUS_ITEMS;
  }, [config]);

  const iconOptions: SelectOption[] = useMemo(
    () =>
      DEV_MASTER_ICONS.map(({ name, label, Icon }) => ({
        value: name,
        label,
        icon: <Icon size={14} className="text-zinc-300" />,
      })),
    []
  );

  const activeModuleOptions: SelectOption[] = useMemo(
    () =>
      modules
        .filter((m) => !m.isArchived)
        .map((m) => ({
          value: String(m.id),
          label: m.name,
          sublabel: `${m.submodules.length} submodules`,
          icon: <MasterIconBadge icon={m.icon} color={m.color || '#10B981'} size={12} />,
        })),
    [modules]
  );

  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modName.trim()) {
      showToast('error', 'Application module name is required.');
      return;
    }
    setSaving(true);
    try {
      const res = await developmentService.createModule(projectId, {
        name: modName.trim(),
        description: modDesc.trim() || undefined,
        icon: modIcon,
        color: modColor,
      });
      if (res.success && res.data) {
        setModName('');
        setModDesc('');
        showToast('success', `Application module "${res.data.name}" created.`);
        await loadMasterData();
        setSubModuleParentId(String(res.data.id));
      } else {
        showToast('error', res.error || 'Failed to create application module.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSubmodule = async (e: React.FormEvent) => {
    e.preventDefault();
    const parentId = Number(subModuleParentId);
    if (!parentId) {
      showToast('error', 'Select a parent application module first.');
      return;
    }
    if (!subName.trim()) {
      showToast('error', 'Application submodule name is required.');
      return;
    }
    setSaving(true);
    try {
      const res = await developmentService.createSubmodule(projectId, {
        moduleId: parentId,
        name: subName.trim(),
        description: subDesc.trim() || undefined,
        icon: subIcon,
      });
      if (res.success && res.data) {
        setSubName('');
        setSubDesc('');
        showToast('success', `Application submodule "${res.data.name}" created.`);
        await loadMasterData();
      } else {
        showToast('error', res.error || 'Failed to create application submodule.');
      }
    } finally {
      setSaving(false);
    }
  };

  const persistPriorityItems = async (nextItems: DevMasterChoiceItem[], successMsg: string) => {
    setSaving(true);
    try {
      const res = await developmentService.updateSettings(projectId, {
        priorityItems: nextItems,
        priorities: nextItems.map((i) => i.name),
      });
      if (res.success && res.data) {
        setConfig(res.data);
        showToast('success', successMsg);
        return true;
      }
      showToast('error', res.error || 'Failed to save priority master data.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const persistStatusItems = async (nextItems: DevMasterChoiceItem[], successMsg: string) => {
    setSaving(true);
    try {
      const res = await developmentService.updateSettings(projectId, {
        statusItems: nextItems,
        statuses: nextItems.map((i) => i.name),
      });
      if (res.success && res.data) {
        setConfig(res.data);
        showToast('success', successMsg);
        return true;
      }
      showToast('error', res.error || 'Failed to save status master data.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAddPriority = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = prioName.trim();
    if (!clean) {
      showToast('error', 'Priority name is required.');
      return;
    }
    if (priorityItems.some((p) => p.name.toLowerCase() === clean.toLowerCase())) {
      showToast('error', `Priority "${clean}" already exists.`);
      return;
    }
    const ok = await persistPriorityItems(
      [...priorityItems, { name: clean, icon: prioIcon, color: prioColor }],
      `Priority "${clean}" added.`
    );
    if (ok) setPrioName('');
  };

  const handleAddStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = statusName.trim();
    if (!clean) {
      showToast('error', 'Status name is required.');
      return;
    }
    if (statusItems.some((s) => s.name.toLowerCase() === clean.toLowerCase())) {
      showToast('error', `Status "${clean}" already exists.`);
      return;
    }
    const ok = await persistStatusItems(
      [...statusItems, { name: clean, icon: statusIcon, color: statusColor, isEnd: statusIsEnd }],
      `Status "${clean}" added.`
    );
    if (ok) {
      setStatusName('');
      setStatusIsEnd(false);
    }
  };

  const toggleArchiveModule = async (mod: DevelopmentModuleMaster) => {
    setSaving(true);
    try {
      const res = await developmentService.updateModule(projectId, mod.id, {
        isArchived: !mod.isArchived,
      });
      if (res.success) {
        showToast('success', mod.isArchived ? `Restored "${mod.name}".` : `Archived "${mod.name}".`);
        await loadMasterData();
      } else {
        showToast('error', res.error || 'Failed to update module.');
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleArchiveSubmodule = async (subId: number, subNameVal: string, currentlyArchived: boolean) => {
    setSaving(true);
    try {
      const res = await developmentService.updateSubmodule(projectId, subId, {
        isArchived: !currentlyArchived,
      });
      if (res.success) {
        showToast('success', currentlyArchived ? `Restored "${subNameVal}".` : `Archived "${subNameVal}".`);
        await loadMasterData();
      } else {
        showToast('error', res.error || 'Failed to update submodule.');
      }
    } finally {
      setSaving(false);
    }
  };

  const renderColorSwatches = (selectedColor: string, onSelect: (c: string) => void) => (
    <div className="flex flex-wrap items-center gap-1.5">
      {DEV_MASTER_COLORS.map((c) => {
        const active = selectedColor.toLowerCase() === c.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            onClick={() => onSelect(c)}
            title={c}
            className={`w-6 h-6 rounded-md flex items-center justify-center transition-transform ${
              active ? 'ring-2 ring-white/80 scale-105' : 'opacity-80 hover:opacity-100'
            }`}
            style={{ backgroundColor: c }}
          >
            {active && <Check size={12} className="text-white drop-shadow" />}
          </button>
        );
      })}
    </div>
  );

  const tabs: Array<{ key: MasterTabKey; label: string; icon: React.ComponentType<any>; count: number }> = [
    { key: 'modules', label: 'Application Module', icon: Layers, count: modules.length },
    {
      key: 'submodules',
      label: 'Application Sub Module',
      icon: FolderTree,
      count: modules.reduce((acc, m) => acc + m.submodules.length, 0),
    },
    { key: 'priorities', label: 'Priority', icon: Flag, count: priorityItems.length },
    { key: 'statuses', label: 'Status', icon: Zap, count: statusItems.length },
  ];

  const SelectedModIcon = getMasterIconComponent(modIcon, Layers);
  const SelectedSubIcon = getMasterIconComponent(subIcon, Layers);
  const SelectedPrioIcon = getMasterIconComponent(prioIcon, Flag);
  const SelectedStatusIcon = getMasterIconComponent(statusIcon, Zap);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/[0.08] bg-[#121319]/90 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Database size={18} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-white">
                Project Master Data
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5 max-w-2xl">
                Configure Application Modules, Application Sub Modules, Priorities, and Task Statuses with custom icons and colors. Entries created here appear directly in Development task forms and filters.
              </p>
            </div>
          </div>
        </div>

        {/* Sub-navigation tabs */}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                  active
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm shadow-emerald-500/10'
                    : 'bg-black/25 border-white/[0.07] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.14]'
                }`}
              >
                <TabIcon size={14} />
                <span>{tab.label}</span>
                <span className="px-1.5 py-0.5 rounded-md bg-white/[0.06] text-[10px] font-mono text-zinc-300">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {feedback && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-white/[0.07] bg-[#121319]/80 p-10 flex items-center justify-center gap-2.5 text-sm text-zinc-400">
          <Loader2 size={16} className="animate-spin text-emerald-400" />
          Loading project master data...
        </div>
      ) : (
        <>
          {/* ── 1. APPLICATION MODULES ─────────────────────────────────── */}
          {activeTab === 'modules' && (
            <div className="space-y-5">
              <form
                onSubmit={handleCreateModule}
                className="rounded-2xl border border-white/[0.08] bg-[#121319]/90 p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Create New Application Module</h3>
                  <div className="inline-flex items-center gap-2 text-xs text-zinc-400">
                    <span>Preview:</span>
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium"
                      style={{
                        backgroundColor: `${modColor}1A`,
                        borderColor: `${modColor}45`,
                        color: modColor,
                      }}
                    >
                      <SelectedModIcon size={13} />
                      {modName.trim() || 'Module Name'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                  <div className="md:col-span-4">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                      Icon
                    </label>
                    <AnimatedSelect
                      value={modIcon}
                      onChange={setModIcon}
                      options={iconOptions}
                      placeholder="Choose icon..."
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                      Module Name *
                    </label>
                    <input
                      type="text"
                      value={modName}
                      onChange={(e) => setModName(e.target.value)}
                      placeholder="e.g. Authentication, Billing"
                      className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/[0.1] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                      Description (optional)
                    </label>
                    <input
                      type="text"
                      value={modDesc}
                      onChange={(e) => setModDesc(e.target.value)}
                      placeholder="Short scope note"
                      className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/[0.1] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                      Color
                    </span>
                    {renderColorSwatches(modColor, setModColor)}
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold disabled:opacity-50 transition-colors"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Add Module
                  </button>
                </div>
              </form>

              <div className="rounded-2xl border border-white/[0.08] bg-[#121319]/90 p-5">
                <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400 mb-3">
                  Configured Application Modules ({modules.length})
                </h4>
                {modules.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-6 text-center">
                    No application modules yet. Create one above to start organizing development tasks.
                  </p>
                ) : (
                  <div className="divide-y divide-white/[0.06]">
                    {modules.map((mod) => (
                      <div
                        key={mod.id}
                        className="py-3 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <MasterIconBadge icon={mod.icon} color={mod.color || '#10B981'} size={14} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-sm font-medium ${
                                  mod.isArchived ? 'text-zinc-500 line-through' : 'text-white'
                                }`}
                              >
                                {mod.name}
                              </span>
                              {mod.isArchived && (
                                <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-400">
                                  Archived
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-500">
                              ID #{mod.id} · {mod.submodules.length} submodules · {mod.taskCount || 0} tasks
                              {mod.description ? ` · ${mod.description}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleArchiveModule(mod)}
                            disabled={saving}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] text-[11px] text-zinc-300"
                          >
                            {mod.isArchived ? <RotateCcw size={12} /> : <Archive size={12} />}
                            {mod.isArchived ? 'Restore' : 'Archive'}
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              setConfirmState({
                                isOpen: true,
                                variant: 'danger',
                                title: 'Delete Application Module?',
                                text: 'Modules linked to existing tasks cannot be deleted permanently (archive them instead).',
                                highlightLabel: mod.name,
                                confirmText: 'Delete Module',
                                onConfirm: async () => {
                                  const res = await developmentService.deleteModule(projectId, mod.id);
                                  if (res.success) {
                                    showToast('success', `Deleted module "${mod.name}".`);
                                    await loadMasterData();
                                  } else {
                                    showToast('error', res.error || 'Could not delete module.');
                                  }
                                },
                              })
                            }
                            className="p-1.5 rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400"
                            title="Delete module"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 2. APPLICATION SUBMODULES ──────────────────────────────── */}
          {activeTab === 'submodules' && (
            <div className="space-y-5">
              <form
                onSubmit={handleCreateSubmodule}
                className="rounded-2xl border border-white/[0.08] bg-[#121319]/90 p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Create New Application Sub Module</h3>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/[0.1] bg-white/[0.03] text-xs text-zinc-200">
                    <SelectedSubIcon size={13} className="text-emerald-400" />
                    <span>{subName.trim() || 'Submodule Name'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                  <div className="md:col-span-4">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                      Parent Module *
                    </label>
                    <AnimatedSelect
                      value={subModuleParentId}
                      onChange={setSubModuleParentId}
                      options={activeModuleOptions}
                      placeholder="Select parent module..."
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                      Icon
                    </label>
                    <AnimatedSelect
                      value={subIcon}
                      onChange={setSubIcon}
                      options={iconOptions}
                      placeholder="Choose icon..."
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                      Sub Module Name *
                    </label>
                    <input
                      type="text"
                      value={subName}
                      onChange={(e) => setSubName(e.target.value)}
                      placeholder="e.g. OAuth Login, Invoice PDF"
                      className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/[0.1] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-end">
                    <button
                      type="submit"
                      disabled={saving || activeModuleOptions.length === 0}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold disabled:opacity-50 transition-colors"
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      Add Sub
                    </button>
                  </div>
                </div>
                <div>
                  <input
                    type="text"
                    value={subDesc}
                    onChange={(e) => setSubDesc(e.target.value)}
                    placeholder="Optional description..."
                    className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/[0.08] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
              </form>

              <div className="rounded-2xl border border-white/[0.08] bg-[#121319]/90 p-5 space-y-4">
                <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                  Configured Sub Modules by Application Module
                </h4>
                {modules.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-6 text-center">
                    Create an Application Module first before adding submodules.
                  </p>
                ) : (
                  modules.map((mod) => (
                    <div
                      key={mod.id}
                      className="rounded-xl border border-white/[0.07] bg-black/25 p-3.5 space-y-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <MasterIconBadge icon={mod.icon} color={mod.color || '#10B981'} size={13} />
                        <span className="text-xs font-semibold text-white">{mod.name}</span>
                        <span className="text-[10px] font-mono text-zinc-500">
                          ({mod.submodules.length})
                        </span>
                      </div>
                      {mod.submodules.length === 0 ? (
                        <p className="text-[11px] text-zinc-500 pl-8">No submodules in this module yet.</p>
                      ) : (
                        <div className="pl-2 divide-y divide-white/[0.05]">
                          {mod.submodules.map((sub) => (
                            <div
                              key={sub.id}
                              className="py-2 flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <MasterIconBadge
                                  icon={sub.icon || 'Box'}
                                  color={mod.color || '#10B981'}
                                  size={12}
                                />
                                <div className="min-w-0">
                                  <span
                                    className={`text-xs font-medium ${
                                      sub.isArchived ? 'text-zinc-500 line-through' : 'text-zinc-200'
                                    }`}
                                  >
                                    {sub.name}
                                  </span>
                                  <span className="ml-2 text-[10px] font-mono text-zinc-500">
                                    {sub.taskCount || 0} tasks
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleArchiveSubmodule(sub.id, sub.name, sub.isArchived)
                                  }
                                  className="px-2 py-1 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] text-[10px] text-zinc-300"
                                >
                                  {sub.isArchived ? 'Restore' : 'Archive'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmState({
                                      isOpen: true,
                                      variant: 'danger',
                                      title: 'Delete Application Sub Module?',
                                      text: 'Submodules referenced by tasks cannot be permanently deleted.',
                                      highlightLabel: `${mod.name} / ${sub.name}`,
                                      confirmText: 'Delete Submodule',
                                      onConfirm: async () => {
                                        const res = await developmentService.deleteSubmodule(
                                          projectId,
                                          sub.id
                                        );
                                        if (res.success) {
                                          showToast('success', `Deleted submodule "${sub.name}".`);
                                          await loadMasterData();
                                        } else {
                                          showToast('error', res.error || 'Could not delete submodule.');
                                        }
                                      },
                                    })
                                  }
                                  className="p-1 rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── 3. PRIORITIES ─────────────────────────────────────────── */}
          {activeTab === 'priorities' && (
            <div className="space-y-5">
              <form
                onSubmit={handleAddPriority}
                className="rounded-2xl border border-white/[0.08] bg-[#121319]/90 p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Create New Priority</h3>
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium"
                    style={{
                      backgroundColor: `${prioColor}1A`,
                      borderColor: `${prioColor}45`,
                      color: prioColor,
                    }}
                  >
                    <SelectedPrioIcon size={12} />
                    {prioName.trim() || 'Priority Label'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                  <div className="md:col-span-4">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                      Icon
                    </label>
                    <AnimatedSelect
                      value={prioIcon}
                      onChange={setPrioIcon}
                      options={iconOptions}
                      placeholder="Choose icon..."
                    />
                  </div>
                  <div className="md:col-span-5">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                      Priority Text *
                    </label>
                    <input
                      type="text"
                      value={prioName}
                      onChange={(e) => setPrioName(e.target.value)}
                      placeholder="e.g. Blocker, P0 Urgent, Normal"
                      className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/[0.1] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
                    />
                  </div>
                  <div className="md:col-span-3 flex items-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold disabled:opacity-50 transition-colors"
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      Add Priority
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                    Badge Color
                  </span>
                  {renderColorSwatches(prioColor, setPrioColor)}
                </div>
              </form>

              <div className="rounded-2xl border border-white/[0.08] bg-[#121319]/90 p-5">
                <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400 mb-3">
                  Configured Priorities ({priorityItems.length})
                </h4>
                <div className="divide-y divide-white/[0.06]">
                  {priorityItems.map((item) => (
                    <div
                      key={item.name}
                      className="py-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <MasterIconBadge icon={item.icon} color={item.color} size={14} />
                        <div>
                          <div className="text-sm font-medium text-white">{item.name}</div>
                          <div className="text-[10px] font-mono text-zinc-500">
                            Icon: {item.icon} · Color: {item.color}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={saving || priorityItems.length <= 1}
                        onClick={() =>
                          setConfirmState({
                            isOpen: true,
                            variant: 'danger',
                            title: 'Remove Priority Option?',
                            text: 'Existing tasks keep their saved value, and this option will be removed from future dropdowns.',
                            highlightLabel: item.name,
                            confirmText: 'Remove Priority',
                            onConfirm: async () => {
                              const next = priorityItems.filter(
                                (p) => p.name.toLowerCase() !== item.name.toLowerCase()
                              );
                              await persistPriorityItems(next, `Removed priority "${item.name}".`);
                            },
                          })
                        }
                        className="p-1.5 rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 disabled:opacity-30"
                        title={priorityItems.length <= 1 ? 'At least 1 priority required' : 'Remove priority'}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 4. STATUSES ───────────────────────────────────────────── */}
          {activeTab === 'statuses' && (
            <div className="space-y-5">
              <form
                onSubmit={handleAddStatus}
                className="rounded-2xl border border-white/[0.08] bg-[#121319]/90 p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Create New Status</h3>
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium"
                    style={{
                      backgroundColor: `${statusColor}1A`,
                      borderColor: `${statusColor}45`,
                      color: statusColor,
                    }}
                  >
                    <SelectedStatusIcon size={12} />
                    {statusName.trim() || 'Status Label'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                  <div className="md:col-span-4">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                      Icon
                    </label>
                    <AnimatedSelect
                      value={statusIcon}
                      onChange={setStatusIcon}
                      options={iconOptions}
                      placeholder="Choose icon..."
                    />
                  </div>
                  <div className="md:col-span-5">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                      Status Text *
                    </label>
                    <input
                      type="text"
                      value={statusName}
                      onChange={(e) => setStatusName(e.target.value)}
                      placeholder="e.g. QA Testing, Ready for Release"
                      className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/[0.1] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
                    />
                  </div>
                  <div className="md:col-span-3 flex items-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold disabled:opacity-50 transition-colors"
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      Add Status
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                      Badge Color
                    </span>
                    {renderColorSwatches(statusColor, setStatusColor)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setStatusIsEnd((prev) => !prev)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-colors ${
                      statusIsEnd
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-black/40 border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center border ${
                        statusIsEnd
                          ? 'bg-emerald-500 border-emerald-400 text-zinc-950'
                          : 'border-white/20 bg-white/[0.03]'
                      }`}
                    >
                      {statusIsEnd && <Check size={11} strokeWidth={3} />}
                    </span>
                    Mark as End Status (e.g. Completed / Skipped)
                  </button>
                </div>
              </form>

              <div className="rounded-2xl border border-white/[0.08] bg-[#121319]/90 p-5">
                <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400 mb-3">
                  Configured Statuses ({statusItems.length})
                </h4>
                <div className="divide-y divide-white/[0.06]">
                  {statusItems.map((item) => {
                    const isCompletedCore = item.name.trim().toLowerCase() === 'completed';
                    const isEndChecked = isCompletedCore || Boolean(item.isEnd);
                    return (
                      <div
                        key={item.name}
                        className="py-3 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <MasterIconBadge icon={item.icon} color={item.color} size={14} />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-white">{item.name}</span>
                              {isCompletedCore && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-[10px] font-mono text-emerald-300">
                                  Core Completion
                                </span>
                              )}
                              {isEndChecked && !isCompletedCore && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-[10px] font-mono text-emerald-300">
                                  End Status
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-zinc-500">
                              Icon: {item.icon} · Color: {item.color}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={saving || isCompletedCore}
                            onClick={async () => {
                              const next = statusItems.map((s) =>
                                s.name.toLowerCase() === item.name.toLowerCase()
                                  ? { ...s, isEnd: !s.isEnd }
                                  : s
                              );
                              await persistStatusItems(
                                next,
                                `${item.name} ${!item.isEnd ? 'marked as End Status' : 'unmarked as End Status'}.`
                              );
                            }}
                            title={
                              isCompletedCore
                                ? 'Completed is always an End Status'
                                : 'Tasks entering an End Status record actual end time and stop calendar span'
                            }
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors disabled:opacity-60 ${
                              isEndChecked
                                ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/20'
                                : 'bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.15]'
                            }`}
                          >
                            <span
                              className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                                isEndChecked
                                  ? 'bg-emerald-500 border-emerald-400 text-zinc-950'
                                  : 'border-white/25 bg-transparent'
                              }`}
                            >
                              {isEndChecked && <Check size={9} strokeWidth={3} />}
                            </span>
                            End Status
                          </button>
                          <button
                            type="button"
                            disabled={saving || isCompletedCore || statusItems.length <= 1}
                            onClick={() =>
                              setConfirmState({
                                isOpen: true,
                                variant: 'danger',
                                title: 'Remove Status Option?',
                                text: 'Existing tasks keep their saved status, and this stage will no longer appear in selectors or board columns.',
                                highlightLabel: item.name,
                                confirmText: 'Remove Status',
                                onConfirm: async () => {
                                  const next = statusItems.filter(
                                    (s) => s.name.toLowerCase() !== item.name.toLowerCase()
                                  );
                                  await persistStatusItems(next, `Removed status "${item.name}".`);
                                },
                              })
                            }
                            className="p-1.5 rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 disabled:opacity-30"
                            title={isCompletedCore ? 'Completed status is required' : 'Remove status'}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {confirmState && (
        <CustomSweetAlert
          isOpen={confirmState.isOpen}
          variant={confirmState.variant}
          title={confirmState.title}
          text={confirmState.text}
          highlightLabel={confirmState.highlightLabel}
          warningNote={confirmState.warningNote}
          confirmText={confirmState.confirmText}
          isLoading={confirmBusy}
          onCancel={() => !confirmBusy && setConfirmState(null)}
          onConfirm={async () => {
            setConfirmBusy(true);
            try {
              await confirmState.onConfirm();
              setConfirmState(null);
            } finally {
              setConfirmBusy(false);
            }
          }}
        />
      )}
    </div>
  );
};
